/**
 * La synthèse contre un VRAI Postgres, et branchée là où elle l’est en
 * production : sur le port `aval` de la fin d’entretien.
 *
 * ⚠️ Ce que le test unitaire ne peut pas prouver et qui compte ici : `confiance`
 *    est bien dans SA COLONNE en plus du jsonb, les étiquettes sont recopiées
 *    sur le retour, l’unicité tient, et ⛔ **une synthèse qui échoue ne défait
 *    pas la clôture**.
 *
 * ⛔ Le modèle est bouchonné. Ce qu’on vérifie, c’est le câblage et le SQL.
 *
 * Il faut un Postgres joignable : `docker compose up -d postgres`, et
 * DATABASE_URL renseignée (.env.local sur le poste, service `postgres` en CI).
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { Client, Pool } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { modeleBouchon } from '../entretien/modele'
import type { PortsTour } from '../entretien/tour'
import { MAX_RELANCES, terminerEntretien } from '../entretien/tour'
import { creerDepotEntretien } from '../../infra/base/depot-entretien'
import { creerDepotSyntheses } from '../../infra/base/depot-syntheses'
import { appliquerMigrations } from '../../infra/base/migrations'
import { identifiant } from '../../infra/identifiants'

import { etiquettesDe, produireSynthese } from './produire'
import type { Synthese } from './schema'
import { analyserSynthese } from './schema'

const ICI = path.dirname(fileURLToPath(import.meta.url))
const RACINE = path.resolve(ICI, '../../../..')
const DOSSIER_MIGRATIONS = path.join(RACINE, 'db', 'migrations')

const ADMIN = process.env['DATABASE_URL'] ?? 'postgresql://feedys:feedys@localhost:5432/feedys'

const DOMAINE = 'victoria.exemple.fr'
const CLE = 'fdy_pub_essai_synthese'

/** ⚠️ Écrite à la main. ⛔ Jamais un vrai retour copié d’une base (CLAUDE.md §Secrets). */
const PAROLE =
  'le tri par date de la liste des dossiers il se remet à zéro dès que je reviens en arrière c’est pénible'

const SYNTHESE: Synthese = {
  type: 'bug',
  titre: 'Le tri par date de la liste des dossiers se réinitialise',
  resume: 'Le tri ne survit pas à la navigation. La personne le repose à chaque retour.',
  attendu: 'le tri reste en place au retour',
  constate: 'le tri revient à l’ordre par défaut',
  recurrence: 'systematique',
  zone: 'Liste des dossiers',
  impact: 'ralentit',
  citations: ['il se remet à zéro', 'c’est pénible'],
  confiance: 'moyenne',
  questions_ouvertes: ['Est-ce que ça touche aussi les autres listes ?'],
}

let nomBase: string
let client: Client
let bassin: Pool
let retourId: string

function portsSynthese(modele = modeleBouchon({ synthese: SYNTHESE })) {
  return { depot: creerDepotSyntheses(bassin), modele }
}

function portsTour(aval?: (retourId: string) => Promise<void>): PortsTour {
  return {
    depot: creerDepotEntretien(bassin),
    produits: {
      produitParCle: async (cle) => {
        const { rows } = await bassin.query<{ id: string; domaine: string; actif: boolean }>(
          'select id, domaine, actif from produits where cle_publique = $1',
          [cle],
        )
        const ligne = rows[0]
        // ⚠️ L’entretien ne vérifie aucune identité : elle est attachée à
        //    l’ingestion, une fois pour toutes (P-012).
        return ligne === undefined ? null : { ...ligne, secret: null }
      },
    },
    modele: modeleBouchon({ synthese: SYNTHESE }),
    debitParCle: { autoriser: () => true },
    debitParIp: { autoriser: () => true },
    maintenant: () => 0,
    ...(aval ? { aval } : {}),
  }
}

const acces = () => ({ retourId, cle: CLE, origine: `https://${DOMAINE}`, ip: '203.0.113.9' })

async function ligneSynthese() {
  const { rows } = await client.query('select * from syntheses where retour_id = $1', [retourId])
  return rows[0]
}

beforeAll(async () => {
  nomBase = `feedys_essai_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

  const admin = new Client({ connectionString: ADMIN })
  await admin.connect()
  await admin.query(`create database "${nomBase}"`)
  await admin.end()

  const url = new URL(ADMIN)
  url.pathname = `/${nomBase}`

  client = new Client({ connectionString: url.toString() })
  await client.connect()
  await appliquerMigrations(client, DOSSIER_MIGRATIONS)

  bassin = new Pool({ connectionString: url.toString() })

  await client.query(
    `insert into produits (id, nom, domaine, cle_publique, secret_hash)
     values ('prod_1', 'VictorIA', $1, $2, 'argon2-bidon')`,
    [DOMAINE, CLE],
  )
}, 60_000)

afterAll(async () => {
  await bassin?.end()
  await client?.end()

  const menage = new Client({ connectionString: ADMIN })
  await menage.connect()
  await menage.query(`drop database if exists "${nomBase}" with (force)`)
  await menage.end()
}, 60_000)

beforeEach(async () => {
  retourId = identifiant()

  await client.query(
    `insert into retours (id, produit_id, source, auteur_nom, auteur_role)
     values ($1, 'prod_1', 'voix', 'Camille Martin', 'gestionnaire')`,
    [retourId],
  )
  await client.query(
    `insert into messages (id, retour_id, ordre, role, texte) values
       ($1, $2, 0, 'collaborateur', $3),
       ($4, $2, 1, 'bot', 'C’est nouveau ?'),
       ($5, $2, 2, 'collaborateur', 'non ça a toujours fait ça')`,
    [identifiant(), retourId, PAROLE, identifiant(), identifiant()],
  )
  await client.query(
    `insert into contextes (id, retour_id, url, ecran, navigateur)
     values ($1, $2, 'https://victoria.exemple.fr/dossiers?tri=date', 'dossiers', 'Chrome 141')`,
    [identifiant(), retourId],
  )
})

describe('ce qui est écrit en base', () => {
  it('écrit le contenu, le modèle, les jetons — et `confiance` dans SA colonne', async () => {
    const resultat = await produireSynthese(retourId, portsSynthese(), MAX_RELANCES)

    expect(resultat.ok).toBe(true)
    if (!resultat.ok) return

    await portsSynthese().depot.enregistrer(
      retourId,
      resultat.synthese,
      etiquettesDe(resultat.synthese.contenu),
    )

    const ligne = await ligneSynthese()
    // ⚠️ La colonne typée, hors du jsonb : c’est dessus qu’on filtrera.
    expect(ligne?.['confiance']).toBe('moyenne')
    expect(ligne?.['modele']).toBe('bouchon')
    expect(ligne?.['jetons_entree']).toBe(1_200)
    expect(ligne?.['jetons_sortie']).toBe(340)

    const contenu = analyserSynthese(ligne?.['contenu'])
    expect(contenu?.titre).toBe(SYNTHESE.titre)
    // ⛔ Et la même valeur dans le document : la colonne est une EXTRACTION.
    expect(contenu?.confiance).toBe('moyenne')
  })

  it('⛔ les citations relues depuis le jsonb sont toujours verbatim', async () => {
    const resultat = await produireSynthese(retourId, portsSynthese(), MAX_RELANCES)
    expect(resultat.ok).toBe(true)
    if (!resultat.ok) return

    await portsSynthese().depot.enregistrer(
      retourId,
      resultat.synthese,
      etiquettesDe(resultat.synthese.contenu),
    )

    const contenu = analyserSynthese((await ligneSynthese())?.['contenu'])
    expect(contenu?.citations.length).toBeGreaterThan(0)
    for (const citation of contenu?.citations ?? []) {
      expect(PAROLE.includes(citation)).toBe(true)
    }
  })

  it('recopie les étiquettes sur le retour — corrigeables à la main, plus tard', async () => {
    const resultat = await produireSynthese(retourId, portsSynthese(), MAX_RELANCES)
    expect(resultat.ok).toBe(true)
    if (!resultat.ok) return

    await portsSynthese().depot.enregistrer(
      retourId,
      resultat.synthese,
      etiquettesDe(resultat.synthese.contenu),
    )

    const { rows } = await client.query('select type, titre, zone from retours where id = $1', [retourId])
    expect(rows[0]).toMatchObject({
      type: 'bug',
      titre: SYNTHESE.titre,
      zone: 'Liste des dossiers',
    })
  })

  it('⛔ une seule synthèse par retour, et on ne réécrit jamais', async () => {
    const ports = portsSynthese()
    const premier = await produireSynthese(retourId, ports, MAX_RELANCES)
    expect(premier.ok).toBe(true)
    if (!premier.ok) return

    await ports.depot.enregistrer(retourId, premier.synthese, etiquettesDe(premier.synthese.contenu))

    const second = await produireSynthese(retourId, ports, MAX_RELANCES)
    expect(second).toEqual({ ok: false, motif: 'deja_faite' })
  })

  it('⛔ un fil vide n’écrit rien, et la contrainte d’unicité reste libre', async () => {
    await client.query('delete from messages where retour_id = $1', [retourId]).catch(() => {
      // ⚠️ Le rôle applicatif n’a pas DELETE. En test on est propriétaire, donc
      //    ça passe ; si un jour ça échoue, le test n’a plus de sens et doit
      //    changer, pas être contourné.
    })

    const resultat = await produireSynthese(retourId, portsSynthese(), MAX_RELANCES)

    expect(resultat).toEqual({ ok: false, motif: 'rien_a_synthetiser' })
    expect(await ligneSynthese()).toBeUndefined()
  })
})

describe('⛔ déclenchée à la fin de l’entretien, et jamais avant', () => {
  it.each([
    ['un envoi manuel', 'envoi' as const, 'envoye'],
    ['un abandon', 'abandon' as const, 'abandonne'],
  ])('%s produit la synthèse', async (_cas, raison, statut) => {
    const faites: string[] = []

    const aval = async (id: string): Promise<void> => {
      const ports = portsSynthese()
      const resultat = await produireSynthese(id, ports, MAX_RELANCES)
      if (!resultat.ok) return
      await ports.depot.enregistrer(id, resultat.synthese, etiquettesDe(resultat.synthese.contenu))
      faites.push(id)
    }

    const fin = await terminerEntretien({ ...acces(), raison }, portsTour(aval))

    expect(fin).toEqual({ ok: true, statut })
    expect(faites).toEqual([retourId])
    expect(await ligneSynthese()).toBeDefined()
  })

  it('⛔ un abandon donne `confiance: basse`, même quand le modèle se dit sûr', async () => {
    const sur = modeleBouchon({ synthese: { ...SYNTHESE, confiance: 'haute' } })

    const aval = async (id: string): Promise<void> => {
      const ports = portsSynthese(sur)
      const resultat = await produireSynthese(id, ports, MAX_RELANCES)
      if (!resultat.ok) return
      await ports.depot.enregistrer(id, resultat.synthese, etiquettesDe(resultat.synthese.contenu))
    }

    await terminerEntretien({ ...acces(), raison: 'abandon' }, portsTour(aval))

    expect((await ligneSynthese())?.['confiance']).toBe('basse')
  })

  it('⛔ une synthèse qui échoue NE DÉFAIT PAS la clôture', async () => {
    const signaler = vi.fn()
    const aval = (): Promise<void> => Promise.reject(new Error('le modèle ne répond pas'))

    const fin = await terminerEntretien({ ...acces(), raison: 'envoi' }, {
      ...portsTour(aval),
      signaler,
    })

    expect(fin).toEqual({ ok: true, statut: 'envoye' })

    const { rows } = await client.query('select statut from retours where id = $1', [retourId])
    expect(rows[0]?.['statut']).toBe('envoye')
    expect(await ligneSynthese()).toBeUndefined()
    expect(signaler).toHaveBeenCalledOnce()
  })
})

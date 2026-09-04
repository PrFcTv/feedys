/**
 * La boucle d’entretien contre un VRAI Postgres.
 *
 * ⚠️ Pourquoi ce fichier existe en plus de `tour.test.ts`. Le test unitaire
 *    prouve la logique contre un dépôt de mensonge ; celui-ci prouve qu’elle
 *    tient contre le SQL réel — l’ordre du fil, le compte des lignes `bot`, la
 *    borne par produit, et le statut qui change. La propriété qu’on veut n’est
 *    pas « le code compte bien », c’est « une troisième relance n’existe pas ».
 *
 * ⛔ Le modèle est bouchonné, et c’est le point : le verrou ne doit rien devoir
 *    à la docilité d’un modèle. Il tient sur le fil en base.
 *
 * Il faut un Postgres joignable : `docker compose up -d postgres`, et
 * DATABASE_URL renseignée (.env.local sur le poste, service `postgres` en CI).
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { Client, Pool } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { appliquerMigrations } from '../../infra/base/migrations'
import { creerDepotEntretien } from '../../infra/base/depot-entretien'
import { identifiant } from '../../infra/identifiants'

import type { TourEntretien } from './modele'
import { modeleBouchon } from './modele'
import type { PortsTour } from './tour'
import { MAX_RELANCES, jouerTour, terminerEntretien } from './tour'

const ICI = path.dirname(fileURLToPath(import.meta.url))
const RACINE = path.resolve(ICI, '../../../..')
const DOSSIER_MIGRATIONS = path.join(RACINE, 'db', 'migrations')

const ADMIN = process.env['DATABASE_URL'] ?? 'postgresql://feedys:feedys@localhost:5432/feedys'

const DOMAINE = 'victoria.exemple.fr'
const CLE = 'fdy_pub_essai_entretien'
const CLE_VOISIN = 'fdy_pub_essai_voisin'

/** ⚠️ Écrite à la main. ⛔ Jamais un vrai retour copié d’une base (CLAUDE.md §Secrets). */
const PAROLE = 'le tri de la colonne date remet tout à zéro quand je reviens sur la page'

let nomBase: string
let client: Client
let bassin: Pool
let retourId: string

function tourAvec(question: string | null): TourEntretien {
  return {
    comprehension: {
      type: 'bug',
      titre: 'Le tri par date se réinitialise au retour sur la page',
      resume: 'La personne repose le tri à chaque navigation.',
      ecran: 'Liste des dossiers',
    },
    question,
    motif: 'la récurrence change ce qu’un développeur ferait',
  }
}

function ports(modele: PortsTour['modele']): PortsTour {
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
    modele,
    debitParCle: { autoriser: () => true },
    debitParIp: { autoriser: () => true },
    maintenant: () => 0,
  }
}

const acces = () => ({ retourId, cle: CLE, origine: `https://${DOMAINE}`, ip: '203.0.113.7' })

async function fil(): Promise<{ ordre: number; role: string; texte: string; motif: string | null }[]> {
  const { rows } = await client.query(
    'select ordre, role, texte, motif from messages where retour_id = $1 order by ordre asc',
    [retourId],
  )
  return rows as { ordre: number; role: string; texte: string; motif: string | null }[]
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
     values ('prod_1', 'VictorIA', $1, $2, 'argon2-bidon'),
            ('prod_2', 'Voisin', $1, $3, 'argon2-bidon')`,
    [DOMAINE, CLE, CLE_VOISIN],
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
    `insert into messages (id, retour_id, ordre, role, texte)
     values ($1, $2, 0, 'collaborateur', $3)`,
    [identifiant(), retourId, PAROLE],
  )
  await client.query(
    `insert into contextes (id, retour_id, url, ecran, navigateur, viewport_l, viewport_h)
     values ($1, $2, 'https://victoria.exemple.fr/dossiers?tri=date', 'dossiers', 'Chrome 141', 1920, 1080)`,
    [identifiant(), retourId],
  )
})

describe('⛔ une troisième relance est impossible, contre une vraie base', () => {
  it('joue trois tours : deux questions écrites, puis plus jamais', async () => {
    const modele = modeleBouchon({ tours: [tourAvec('une ?'), tourAvec('deux ?'), tourAvec('trois ?')] })
    const p = ports(modele)

    const premier = await jouerTour(acces(), p)
    const second = await jouerTour({ ...acces(), texte: 'non, ça a toujours fait ça' }, p)
    const troisieme = await jouerTour({ ...acces(), texte: 'ça me ralentit' }, p)

    expect(premier).toMatchObject({ ok: true, tour: { question: 'une ?' } })
    expect(second).toMatchObject({ ok: true, tour: { question: 'deux ?' } })
    // ⛔ Le modèle a produit « trois ? ». Le serveur l’a jetée.
    expect(troisieme).toMatchObject({ ok: true, tour: { question: null } })

    const lignes = await fil()
    expect(lignes.filter((l) => l.role === 'bot')).toHaveLength(MAX_RELANCES)
    expect(lignes.map((l) => l.texte)).not.toContain('trois ?')
    // ⚠️ Les ordres sont denses et croissants : le fil se lit dans l’ordre.
    expect(lignes.map((l) => l.ordre)).toEqual([0, 1, 2, 3, 4])
  })

  it('⛔ même en rejouant dix fois : le fil borne, pas un compteur en mémoire', async () => {
    const modele = modeleBouchon({ tours: [tourAvec('encore ?')] })
    const p = ports(modele)

    for (let essai = 0; essai < 10; essai += 1) {
      await jouerTour({ ...acces(), texte: `réponse ${essai}` }, p)
    }

    const lignes = await fil()
    expect(lignes.filter((l) => l.role === 'bot')).toHaveLength(MAX_RELANCES)
  })

  it('journalise le motif de chaque question — jamais montré, toujours écrit', async () => {
    await jouerTour(acces(), ports(modeleBouchon({ tours: [tourAvec('une ?')] })))

    const bot = (await fil()).find((l) => l.role === 'bot')
    expect(bot?.motif).toBe('la récurrence change ce qu’un développeur ferait')
  })
})

describe('le contexte technique arrive jusqu’au modèle', () => {
  it('⛔ pour que le bot ne redemande jamais la page ni le navigateur', async () => {
    const modele = modeleBouchon({ tours: [tourAvec(null)] })

    await jouerTour(acces(), ports(modele))

    const recu = modele.recues[0]?.contexte
    expect(recu).toMatchObject({
      url: 'https://victoria.exemple.fr/dossiers?tri=date',
      ecran: 'dossiers',
      navigateur: 'Chrome 141',
      viewportL: 1920,
      auteurNom: 'Camille Martin',
      auteurRole: 'gestionnaire',
    })
    expect(recu?.recuLe).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('⛔ la parole arrive en fil, jamais autrement', async () => {
    const modele = modeleBouchon({ tours: [tourAvec(null)] })

    await jouerTour(acces(), ports(modele))

    expect(modele.recues[0]?.fil).toEqual([{ role: 'collaborateur', texte: PAROLE }])
  })
})

describe('la fin de l’entretien', () => {
  it('l’envoi manuel clôt en `envoye` et pose `envoye_le`', async () => {
    const resultat = await terminerEntretien(
      { ...acces(), raison: 'envoi' },
      ports(modeleBouchon()),
    )

    expect(resultat).toEqual({ ok: true, statut: 'envoye' })

    const { rows } = await client.query('select statut, envoye_le from retours where id = $1', [retourId])
    expect(rows[0]?.['statut']).toBe('envoye')
    expect(rows[0]?.['envoye_le']).toBeInstanceOf(Date)
  })

  it('⛔ l’abandon CONSERVE le retour : `abandonne`, et pas d’`envoye_le`', async () => {
    const resultat = await terminerEntretien(
      { ...acces(), raison: 'abandon' },
      ports(modeleBouchon()),
    )

    expect(resultat).toEqual({ ok: true, statut: 'abandonne' })

    const { rows } = await client.query('select statut, envoye_le from retours where id = $1', [retourId])
    expect(rows[0]?.['statut']).toBe('abandonne')
    expect(rows[0]?.['envoye_le']).toBeNull()
    // ⛔ Et la parole est toujours là. C’est tout ce qui compte.
    expect((await fil())[0]?.texte).toBe(PAROLE)
  })

  it('⛔ ce que la personne venait d’écrire part avec la fin', async () => {
    await terminerEntretien(
      { ...acces(), raison: 'envoi', texte: 'et ça me ralentit', corrections: 'Écran — Mandats' },
      ports(modeleBouchon()),
    )

    expect((await fil()).map((l) => l.texte)).toEqual([
      PAROLE,
      'Correction · Écran — Mandats',
      'et ça me ralentit',
    ])
  })

  it('un entretien clos refuse un tour de plus', async () => {
    const p = ports(modeleBouchon({ tours: [tourAvec('une ?')] }))
    await terminerEntretien({ ...acces(), raison: 'envoi' }, p)

    expect(await jouerTour(acces(), p)).toMatchObject({ ok: false, motif: 'entretien_clos' })
  })
})

describe('⛔ la borne par produit', () => {
  it('la clé du voisin ne voit pas ce retour, et il n’apprend pas qu’il existe', async () => {
    const resultat = await jouerTour(
      { ...acces(), cle: CLE_VOISIN },
      ports(modeleBouchon()),
    )

    expect(resultat).toMatchObject({ ok: false, motif: 'retour_inconnu' })
    // ⚠️ Le fil est intact : rien n’a été écrit au nom de quelqu’un d’autre.
    expect(await fil()).toHaveLength(1)
  })
})

/**
 * La veille contre un VRAI Postgres.
 *
 * ⚠️ Ce que le test unitaire ne peut pas prouver : que l’index partiel
 *    `alertes_une_ouverte_par_genre` fait qu’un seul conteneur ouvre — donc
 *    prévient —, et que les faits mesurés sont bien ceux qu’on croit.
 *
 * ⛔ Telegram est un bouchon : rien ne sort d’ici.
 *
 * Il faut un Postgres joignable : `docker compose up -d postgres`, et
 * DATABASE_URL renseignée (.env.local sur le poste, service `postgres` en CI).
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { Client, Pool } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import type { PortsVeille } from '../../domaine/veille/alertes'
import { veiller } from '../../domaine/veille/alertes'
import { urlBaseDessai } from '../../../../tests/base-dessai'
import { identifiant } from '../identifiants'

import { creerDepotReprise } from './depot-reprise'
import { creerDepotVeille } from './depot-veille'
import { appliquerMigrations } from './migrations'

const ICI = path.dirname(fileURLToPath(import.meta.url))
const RACINE = path.resolve(ICI, '../../../..')
const DOSSIER_MIGRATIONS = path.join(RACINE, 'db', 'migrations')

const ADMIN = urlBaseDessai()
const JOUR = 24 * 60 * 60 * 1000

/** ⚠️ Écrite à la main. ⛔ Jamais un vrai retour copié d’une base (CLAUDE.md §Secrets). */
const PAROLE = 'Camille Martin dit que le dossier 4417 ne s’ouvre plus depuis ce matin'

let nomBase: string
let urlBase: string
let client: Client
let bassin: Pool

async function retour(options: { source?: 'voix' | 'texte'; ilYaMs?: number } = {}): Promise<string> {
  const id = identifiant()
  const quand = new Date(Date.now() - (options.ilYaMs ?? 0)).toISOString()
  await client.query(
    `insert into retours (id, produit_id, source, statut, cree_le, maj_le)
     values ($1, 'prod_1', $2::source_retour, 'envoye', $3, $3)`,
    [id, options.source ?? 'voix', quand],
  )
  await client.query(
    `insert into messages (id, retour_id, ordre, role, texte) values ($1, $2, 0, 'collaborateur', $3)`,
    [identifiant(), id, PAROLE],
  )
  return id
}

function ports(envoyes: string[], bassinAUtiliser: Pool = bassin): PortsVeille {
  const depot = creerDepotVeille(bassinAUtiliser)
  return {
    ...depot,
    etatModele: () => ({ etat: 'inconnu', appels: 0, echecs: 0 }),
    installation: async () => ({ produits: await depot.produits(), origine: 'https://feedys.exemple.fr' }),
    prevenir: async (texte) => {
      envoyes.push(texte)
    },
    journal: () => undefined,
  }
}

beforeAll(async () => {
  nomBase = `feedys_essai_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

  const admin = new Client({ connectionString: ADMIN })
  await admin.connect()
  await admin.query(`create database "${nomBase}"`)
  await admin.end()

  const url = new URL(ADMIN)
  url.pathname = `/${nomBase}`
  urlBase = url.toString()

  client = new Client({ connectionString: urlBase })
  await client.connect()
  await appliquerMigrations(client, DOSSIER_MIGRATIONS)

  bassin = new Pool({ connectionString: urlBase })
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
  await client.query('truncate alertes, notifications, syntheses, messages, contextes, indices, audit, retours, produits')
  await client.query(
    `insert into produits (id, nom, domaine, cle_publique, secret_hash)
     values ('prod_1', 'Pistache', 'pistache.exemple.fr', 'fdy_pub_essai_veille', 'argon2-bidon')`,
  )
})

describe('⛔ un incident, une annonce — même à plusieurs conteneurs', () => {
  it('l’index partiel ne laisse ouvrir qu’un incident par genre', async () => {
    const depot = creerDepotVeille(bassin)

    const [a, b] = await Promise.all([depot.ouvrir('modele_en_echec'), depot.ouvrir('modele_en_echec')])

    expect([a, b].filter((id) => id !== null)).toHaveLength(1)
    expect(await depot.ouvrir('aucun_retour')).not.toBeNull()
  })

  it('un incident fermé laisse la place au suivant', async () => {
    const depot = creerDepotVeille(bassin)
    const premier = (await depot.ouvrir('modele_en_echec')) as string

    expect(await depot.fermer(premier)).toBe(true)
    expect(await depot.fermer(premier)).toBe(false)
    expect(await depot.ouvrir('modele_en_echec')).not.toBeNull()
    expect(await depot.derniereFermeture('modele_en_echec')).toBeInstanceOf(Date)
  })

  it('⛔ la base refuse un genre inconnu', async () => {
    await expect(
      client.query(`insert into alertes (id, genre) values ('x', 'phone_home')`),
    ).rejects.toMatchObject({ code: '23514' })
  })

  it('⛔ une note devenue impossible fait partir UNE alerte, même quand deux conteneurs veillent', async () => {
    const id = await retour()
    await creerDepotReprise(bassin).renoncer(id, 'plafond')

    const envoyes: string[] = []
    const autre = new Pool({ connectionString: urlBase })
    try {
      await Promise.all([veiller(ports(envoyes)), veiller(ports(envoyes, autre))])
      await veiller(ports(envoyes))
    } finally {
      await autre.end()
    }

    const annonces = envoyes.filter((texte) => texte.includes('impossible'))
    expect(annonces).toHaveLength(1)
    expect(annonces[0]).toContain(`/bo/r/${id}`)

    const { rows } = await client.query(`select envoyee_le, erreur from alertes where genre = 'notes_impossibles'`)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.['envoyee_le']).toBeInstanceOf(Date)
    expect(rows[0]?.['erreur']).toBeNull()
  })

  it('⛔ aucune alerte ne porte la parole ni le nom — même quand la base en contient', async () => {
    const id = await retour({ ilYaMs: 8 * JOUR })
    await client.query(`update produits set cree_le = now() - interval '9 days'`)
    await creerDepotReprise(bassin).renoncer(id, 'plafond')

    const envoyes: string[] = []
    await veiller(ports(envoyes))

    expect(envoyes.length).toBeGreaterThanOrEqual(2)
    for (const texte of envoyes) {
      expect(texte).not.toContain('Camille')
      expect(texte).not.toContain('4417')
      expect(texte).not.toContain('dossier')
    }
  })
})

describe('les faits', () => {
  it('les notes impossibles : le filet a renoncé faute de modèle — pas faute de parole', async () => {
    const plafond = await retour()
    const sansParole = await retour()
    const reprise = creerDepotReprise(bassin)
    await reprise.renoncer(plafond, 'plafond')
    await reprise.renoncer(sansParole, 'rien_a_synthetiser')

    const depot = creerDepotVeille(bassin)
    expect(await depot.impossiblesDepuis(null)).toEqual({ ids: [plafond], total: 1 })
    expect(await depot.impossiblesDepuis(new Date(Date.now() + 60_000))).toEqual({ ids: [], total: 0 })
  })

  it('le compte reste juste au-delà de la liste', async () => {
    const reprise = creerDepotReprise(bassin)
    for (let n = 0; n < 13; n += 1) await reprise.renoncer(await retour(), 'plafond')

    const notes = await creerDepotVeille(bassin).impossiblesDepuis(null)
    expect(notes.total).toBe(13)
    expect(notes.ids).toHaveLength(11)
  })

  it('une note écrite après un instant', async () => {
    const id = await retour()
    const avant = new Date(Date.now() - 1000)
    await client.query(
      `insert into syntheses (id, retour_id, contenu, modele, confiance)
       values ('s1', $1, '{}'::jsonb, 'bouchon', 'moyenne')`,
      [id],
    )

    const depot = creerDepotVeille(bassin)
    expect(await depot.noteEcriteDepuis(avant)).toBe(true)
    expect(await depot.noteEcriteDepuis(new Date(Date.now() + 60_000))).toBe(false)
  })

  it('le dernier retour, et la pose du produit actif le plus ancien', async () => {
    const depot = creerDepotVeille(bassin)
    expect((await depot.retours()).dernierLe).toBeNull()
    expect((await depot.retours()).poseLe).toBeInstanceOf(Date)

    await retour({ ilYaMs: 3 * JOUR })
    const { dernierLe } = await depot.retours()
    expect(Date.now() - (dernierLe as Date).getTime()).toBeGreaterThan(2.9 * JOUR)

    await client.query('update produits set actif = false')
    expect((await depot.retours()).poseLe).toBeNull()
  })

  it('la part de voix, sur la fenêtre demandée', async () => {
    await retour({ source: 'voix' })
    await retour({ source: 'texte' })
    await retour({ source: 'texte' })
    await retour({ source: 'voix', ilYaMs: 40 * JOUR })

    const part = await creerDepotVeille(bassin).partVoix(new Date(Date.now() - 30 * JOUR))
    expect(part).toEqual({ voix: 1, total: 3 })
  })

  it('les produits actifs, pour dire de quelle installation il s’agit', async () => {
    expect(await creerDepotVeille(bassin).produits()).toEqual(['Pistache'])
  })
})

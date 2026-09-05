/**
 * Le filet contre un VRAI Postgres.
 *
 * ⚠️ Ce que le test unitaire ne peut pas prouver et qui compte ici : la
 *    RÉSERVATION. Deux conteneurs balaient en même temps — `for update skip
 *    locked` et le `statut = 'en_cours'` de l’`update` doivent faire qu’un seul
 *    des deux synthétise. C’est la seule façon de vérifier que le filet ne
 *    double pas les notes le jour où on met deux conteneurs derrière un proxy.
 *
 * ⛔ L’aval est bouchonné. Ce qu’on vérifie, c’est le SQL et le câblage.
 *
 * Il faut un Postgres joignable : `docker compose up -d postgres`, et
 * DATABASE_URL renseignée (.env.local sur le poste, service `postgres` en CI).
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { Client, Pool } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { creerDepotBalayage } from '../../infra/base/depot-balayage'
import { appliquerMigrations } from '../../infra/base/migrations'
import { identifiant } from '../../infra/identifiants'
import { urlBaseDessai } from '../../../../tests/base-dessai'

import type { PortsBalayage } from './balayage'
import { SILENCE_AVANT_CLOTURE_MS, balayer } from './balayage'

const ICI = path.dirname(fileURLToPath(import.meta.url))
const RACINE = path.resolve(ICI, '../../../..')
const DOSSIER_MIGRATIONS = path.join(RACINE, 'db', 'migrations')

const ADMIN = urlBaseDessai()
const DOMAINE = 'victoria.exemple.fr'
const CLE = 'fdy_pub_essai_balayage'

/** ⚠️ Écrite à la main. ⛔ Jamais un vrai retour copié d’une base (CLAUDE.md §Secrets). */
const PAROLE = 'quand je valide le formulaire la page revient en haut et je perds ma place'

const MINUTE = 60 * 1000

let nomBase: string
let client: Client
let bassin: Pool

/**
 * Crée un retour dont le dernier signe de vie remonte à `silenceMs`.
 *
 * ⚠️ `avecMessage: false` couvre le cas du retour ingéré dont aucun tour n’a
 *    suivi — il est jugé sur sa création.
 */
async function retourMuetDepuis(silenceMs: number, avecMessage = true): Promise<string> {
  const id = identifiant()
  const quand = new Date(Date.now() - silenceMs).toISOString()

  await client.query(
    `insert into retours (id, produit_id, source, statut, cree_le)
     values ($1, 'prod_1', 'texte', 'en_cours', $2)`,
    [id, quand],
  )

  if (avecMessage) {
    await client.query(
      `insert into messages (id, retour_id, ordre, role, texte, cree_le)
       values ($1, $2, 1, 'collaborateur', $3, $4)`,
      [identifiant(), id, PAROLE, quand],
    )
  }

  return id
}

async function statutDe(id: string): Promise<string | undefined> {
  const { rows } = await client.query<{ statut: string }>(
    'select statut from retours where id = $1',
    [id],
  )
  return rows[0]?.statut
}

async function auditDe(id: string) {
  const { rows } = await client.query(
    'select acteur, action, detail from audit where retour_id = $1',
    [id],
  )
  return rows
}

function ports(aval: PortsBalayage['aval'] = async () => undefined): PortsBalayage {
  const depot = creerDepotBalayage(bassin)

  return { clore: (avant, limite) => depot.clore(avant, limite), aval, signaler: () => undefined }
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
  await client.query('delete from audit')
  await client.query('delete from messages')
  await client.query('delete from retours')
})

describe('ce que le filet referme', () => {
  it('referme un entretien muet et le passe au chemin ordinaire', async () => {
    const id = await retourMuetDepuis(SILENCE_AVANT_CLOTURE_MS + MINUTE)
    const aval = vi.fn(async () => undefined)

    const bilan = await balayer(ports(aval))

    expect(bilan).toEqual({ clos: 1, synthetises: 1, echoues: 0 })
    expect(await statutDe(id)).toBe('abandonne')
    expect(aval).toHaveBeenCalledExactlyOnceWith(id)
  })

  it('⛔ ne touche PAS un entretien encore vivant', async () => {
    const id = await retourMuetDepuis(5 * MINUTE)
    const aval = vi.fn(async () => undefined)

    const bilan = await balayer(ports(aval))

    expect(bilan.clos).toBe(0)
    expect(await statutDe(id)).toBe('en_cours')
    expect(aval).not.toHaveBeenCalled()
  })

  it('juge sur la création un retour qui n’a aucun message', async () => {
    const id = await retourMuetDepuis(SILENCE_AVANT_CLOTURE_MS + MINUTE, false)

    await balayer(ports())

    expect(await statutDe(id)).toBe('abandonne')
  })

  it('⛔ ne rouvre ni ne retouche un retour déjà clos', async () => {
    const id = await retourMuetDepuis(SILENCE_AVANT_CLOTURE_MS + MINUTE)
    await client.query(`update retours set statut = 'envoye' where id = $1`, [id])

    const bilan = await balayer(ports())

    expect(bilan.clos).toBe(0)
    expect(await statutDe(id)).toBe('envoye')
  })

  it('borne sa passe, et laisse le reste à la suivante', async () => {
    await retourMuetDepuis(SILENCE_AVANT_CLOTURE_MS + MINUTE)
    await retourMuetDepuis(SILENCE_AVANT_CLOTURE_MS + 2 * MINUTE)
    await retourMuetDepuis(SILENCE_AVANT_CLOTURE_MS + 3 * MINUTE)

    const premiere = await balayer(ports(), { parPasse: 2 })
    const seconde = await balayer(ports(), { parPasse: 2 })

    expect(premiere.clos).toBe(2)
    expect(seconde.clos).toBe(1)
  })
})

describe('la trace, qui dira si le filet sert vraiment', () => {
  it('écrit une ligne d’audit « systeme / cloture_balayage »', async () => {
    const id = await retourMuetDepuis(SILENCE_AVANT_CLOTURE_MS + MINUTE)

    await balayer(ports())

    const lignes = await auditDe(id)
    expect(lignes).toHaveLength(1)
    expect(lignes[0]).toMatchObject({ acteur: 'systeme', action: 'cloture_balayage' })
  })

  it('⚠️ la clôture et sa trace sont dans la même transaction', async () => {
    const id = await retourMuetDepuis(SILENCE_AVANT_CLOTURE_MS + MINUTE)

    await balayer(ports())

    expect(await statutDe(id)).toBe('abandonne')
    expect(await auditDe(id)).toHaveLength(1)
  })
})

describe('deux conteneurs qui balaient en même temps', () => {
  it('⛔ ne synthétisent PAS deux fois le même retour', async () => {
    const id = await retourMuetDepuis(SILENCE_AVANT_CLOTURE_MS + MINUTE)
    const vus: string[] = []
    const aval = async (retourId: string) => {
      vus.push(retourId)
    }

    const [a, b] = await Promise.all([balayer(ports(aval)), balayer(ports(aval))])

    expect(vus).toEqual([id])
    expect(a.clos + b.clos).toBe(1)
    expect(await auditDe(id)).toHaveLength(1)
  })

  it('⛔ se partagent le travail sans le dupliquer, sur plusieurs retours', async () => {
    const ids = [
      await retourMuetDepuis(SILENCE_AVANT_CLOTURE_MS + MINUTE),
      await retourMuetDepuis(SILENCE_AVANT_CLOTURE_MS + 2 * MINUTE),
      await retourMuetDepuis(SILENCE_AVANT_CLOTURE_MS + 3 * MINUTE),
    ]
    const vus: string[] = []
    const aval = async (retourId: string) => {
      vus.push(retourId)
    }

    await Promise.all([balayer(ports(aval)), balayer(ports(aval)), balayer(ports(aval))])

    expect([...vus].sort()).toEqual([...ids].sort())
    expect(new Set(vus).size).toBe(vus.length)
  })
})

describe('quand la synthèse échoue', () => {
  it('⛔ ne perd NI le retour NI la parole — il reste clos, avec ses messages', async () => {
    const id = await retourMuetDepuis(SILENCE_AVANT_CLOTURE_MS + MINUTE)

    const bilan = await balayer(
      ports(async () => {
        throw new Error('modèle indisponible')
      }),
    )

    expect(bilan).toEqual({ clos: 1, synthetises: 0, echoues: 1 })
    expect(await statutDe(id)).toBe('abandonne')

    const { rows } = await client.query('select texte from messages where retour_id = $1', [id])
    expect(rows[0]?.['texte']).toBe(PAROLE)
  })

  it('⛔ ne bloque pas les suivants', async () => {
    await retourMuetDepuis(SILENCE_AVANT_CLOTURE_MS + MINUTE)
    await retourMuetDepuis(SILENCE_AVANT_CLOTURE_MS + 2 * MINUTE)
    await retourMuetDepuis(SILENCE_AVANT_CLOTURE_MS + 3 * MINUTE)

    let appels = 0
    const bilan = await balayer(
      ports(async () => {
        appels += 1
        if (appels === 1) throw new Error('SMTP coupé')
      }),
    )

    expect(appels).toBe(3)
    expect(bilan).toEqual({ clos: 3, synthetises: 2, echoues: 1 })
  })

  it('⚠️ le retour reste rattrapable : une passe suivante ne le reprend pas, il est clos', async () => {
    const id = await retourMuetDepuis(SILENCE_AVANT_CLOTURE_MS + MINUTE)

    await balayer(
      ports(async () => {
        throw new Error('modèle indisponible')
      }),
    )
    const seconde = await balayer(ports())

    expect(seconde.clos).toBe(0)
    expect(await statutDe(id)).toBe('abandonne')
  })
})

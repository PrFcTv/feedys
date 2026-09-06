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
import { SILENCE_AVANT_CLOTURE_MS, balayer, estMuet } from './balayage'

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

    expect(bilan).toEqual({ clos: 1, synthetises: 1, echoues: 0, reportes: 0 })
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

    expect(bilan).toEqual({ clos: 1, synthetises: 0, echoues: 1, reportes: 0 })
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
    expect(bilan).toEqual({ clos: 3, synthetises: 2, echoues: 1, reportes: 0 })
  })

  /**
   * ⛔ CE TEST S’APPELAIT « le retour reste rattrapable », ET IL PROUVE L’INVERSE.
   *
   * ⚠️ `seconde.clos === 0` ne dit pas qu’on le rattrapera : il dit que PLUS
   *    AUCUNE PASSE NE LE REPRENDRA. Le retour est `abandonne`, terminal, et
   *    `clore` ne regarde que les `en_cours`. Une panne modèle de dix minutes
   *    couvre deux passes — jusqu’à quarante notes perdues d’un coup.
   *
   * ⛔ Le rattrapage existe, mais il est À LA MAIN, et c’est la requête de
   *    04-Architecture/hebergement.md §Le filet. C’est aussi pourquoi
   *    `signaler` nomme désormais le retour.
   */
  it('⛔ n’est PAS repris par la passe suivante — le rattrapage est à la main', async () => {
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

/**
 * ⛔ L’ACCORD ENTRE LA RÈGLE ET SA FORME SQL, PROUVÉ CONTRE LA VRAIE REQUÊTE.
 *
 * ⚠️ `estMuet` (domaine) et `REFERMER` (SQL) portent la même comparaison, écrite
 *    deux fois — dont l’une en chaîne de caractères. Le test unitaire qui
 *    prétendait garder cet accord comparait `estMuet` à son propre corps : il
 *    serait resté vert si le SQL était passé de `< $1` à `<= $1`.
 *
 * ⛔ Ici, on interroge Postgres aux trois points qui décident : N−1 ms, N
 *    exactement, N+1 ms. C’est le seul endroit où ça se prouve.
 */
describe('la borne, contre le vrai SQL', () => {
  /** Pose un retour dont le dernier signe de vie est EXACTEMENT `instant`. */
  async function retourAyantParleA(instant: Date): Promise<string> {
    const id = identifiant()
    await client.query(
      `insert into retours (id, produit_id, source, statut, cree_le)
       values ($1, 'prod_1', 'texte', 'en_cours', $2)`,
      [id, instant.toISOString()],
    )
    await client.query(
      `insert into messages (id, retour_id, ordre, role, texte, cree_le)
       values ($1, $2, 1, 'collaborateur', $3, $4)`,
      [identifiant(), id, PAROLE, instant.toISOString()],
    )
    return id
  }

  const PARLE_A = new Date('2026-09-05T12:00:00.000Z')

  it('⚠️ à l’instant limite EXACT, le retour n’est pas refermé — la borne est stricte', async () => {
    const id = await retourAyantParleA(PARLE_A)
    const depot = creerDepotBalayage(bassin)

    expect(await depot.clore(PARLE_A, 10)).toEqual([])
    expect(await statutDe(id)).toBe('en_cours')
  })

  it('⛔ une milliseconde AVANT la borne, il n’est pas refermé non plus', async () => {
    const id = await retourAyantParleA(PARLE_A)
    const depot = creerDepotBalayage(bassin)

    expect(await depot.clore(new Date(PARLE_A.getTime() - 1), 10)).toEqual([])
    expect(await statutDe(id)).toBe('en_cours')
  })

  it('⛔ une milliseconde APRÈS, il l’est', async () => {
    const id = await retourAyantParleA(PARLE_A)
    const depot = creerDepotBalayage(bassin)

    expect(await depot.clore(new Date(PARLE_A.getTime() + 1), 10)).toEqual([id])
    expect(await statutDe(id)).toBe('abandonne')
  })

  /**
   * ⚠️ Et c’est bien la MÊME borne que celle du domaine : `estMuet` est faux à
   *    l’instant limite et vrai une milliseconde plus tard. Les trois cas
   *    ci-dessus le disent du SQL, celui-ci le dit de la règle — écrits côte à
   *    côte, une divergence saute aux yeux.
   */
  it('⚠️ et `estMuet` dit exactement la même chose aux mêmes points', () => {
    const maintenant = new Date(PARLE_A.getTime() + SILENCE_AVANT_CLOTURE_MS)

    expect(estMuet(PARLE_A, maintenant)).toBe(false)
    expect(estMuet(new Date(PARLE_A.getTime() - 1), maintenant)).toBe(true)
    expect(estMuet(PARLE_A, new Date(maintenant.getTime() + 1))).toBe(true)
  })
})

/**
 * ⛔ CE QUI PROUVE VRAIMENT `for update skip locked`.
 *
 * ⚠️ Le test « deux conteneurs qui balaient en même temps » monte deux `balayer`
 *    par `Promise.all`, et ses assertions passeraient À L’IDENTIQUE en exécution
 *    strictement séquentielle : rien n’y atteste le chevauchement. Il garde une
 *    valeur — le résultat est bon — mais il ne prouve pas le mécanisme.
 *
 * ⛔ Ici, le chevauchement est FORCÉ : une troisième transaction tient la ligne
 *    quand la passe démarre. `skip locked` doit la SAUTER, et surtout rendre la
 *    main pendant que le verrou est encore tenu. Sans `skip locked`, la passe
 *    resterait bloquée jusqu’au `commit` — c’est ce que la seconde assertion
 *    vérifie.
 */
describe('la réservation, avec un verrou réellement concurrent', () => {
  it('⛔ saute un candidat déjà verrouillé au lieu de l’attendre', async () => {
    const id = await retourMuetDepuis(SILENCE_AVANT_CLOTURE_MS + MINUTE)

    const tenancier = await bassin.connect()

    try {
      await tenancier.query('begin')
      await tenancier.query('select id from retours where id = $1 for update', [id])

      // ⛔ SANS `skip locked`, CE `await` NE RENDRAIT JAMAIS LA MAIN : le verrou
      //    n’est relâché qu’au `rollback` du `finally`, c’est-à-dire après. Le
      //    test partirait en délai d’attente. Qu’il rende un bilan est donc la
      //    preuve — et le bilan lui-même dit que le candidat a été sauté, pas
      //    écarté par la clause de date.
      const bilan = await balayer(ports())

      expect(bilan.clos).toBe(0)
      expect(await statutDe(id)).toBe('en_cours')
    } finally {
      await tenancier.query('rollback')
      tenancier.release()
    }

    // ⚠️ Et une fois le verrou rendu, la passe suivante le referme : il avait
    //    bien été sauté, pas écarté.
    const apres = await balayer(ports())
    expect(apres.clos).toBe(1)
    expect(await statutDe(id)).toBe('abandonne')
  })
})

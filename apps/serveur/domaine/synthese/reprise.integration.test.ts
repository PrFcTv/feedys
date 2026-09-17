/**
 * Les reprises contre un VRAI Postgres — et par le VRAI chemin d’une note.
 *
 * ⚠️ CE QUE CE FICHIER PROUVE, ET QUE RIEN D’AUTRE NE PROUVE (BUGS_LOG 019) :
 *    un modèle coupé puis rétabli rend la note SANS INTERVENTION, y compris pour
 *    un entretien refermé par le widget, qui ne laisse aucune ligne dans `audit`.
 *
 * ⛔ Rien n’est recopié de la production. La chaîne est `synthetiserEtNotifier`,
 *    les dépôts sont ceux de `infra/base`, le canal est `canalTelegram` — seuls
 *    le modèle et `fetch` sont bouchonnés. Un test qui recopierait la requête
 *    resterait vert le jour où elle change : la relecture du lot 7 l’a trouvé
 *    deux fois.
 *
 * ⛔ Hors ligne : `fetch` ne sort jamais d’ici.
 *
 * Il faut un Postgres joignable : `docker compose up -d postgres`, et
 * DATABASE_URL renseignée (.env.local sur le poste, service `postgres` en CI).
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { Client, Pool } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import type { Modele } from '../entretien/modele'
import { MAX_RELANCES } from '../entretien/tour'
import { notifierParCanaux } from '../notification/envoyer'
import { canalTelegram } from '../notification/telegram'
import type { Recuperer } from '../notification/telegram'
import { creerDepotNotifications } from '../../infra/base/depot-notifications'
import { creerDepotReprise } from '../../infra/base/depot-reprise'
import { creerDepotSyntheses } from '../../infra/base/depot-syntheses'
import { appliquerMigrations } from '../../infra/base/migrations'
import { identifiant } from '../../infra/identifiants'
import { urlBaseDessai } from '../../../../tests/base-dessai'

import { synthetiserEtNotifier } from './chaine'
import { refaireLaNote } from './refaire'
import type { PortsReprise } from './reprise'
import { PLAFOND_REPRISES, reprendre } from './reprise'
import type { Synthese } from './schema'

const ICI = path.dirname(fileURLToPath(import.meta.url))
const RACINE = path.resolve(ICI, '../../../..')
const DOSSIER_MIGRATIONS = path.join(RACINE, 'db', 'migrations')

const ADMIN = urlBaseDessai()
const URL_PUBLIQUE = 'https://feedys.exemple.fr'
const MINUTE = 60 * 1000

/** ⛔ Inventé, sans valeur nulle part — et `fetch` est un bouchon. */
const REGLAGES = { jeton: '000000123:jeton-invente-pour-les-tests-sans-valeur', chat: '-1000000000042' }

/** ⚠️ Écrite à la main. ⛔ Jamais un vrai retour copié d’une base (CLAUDE.md §Secrets). */
const PAROLE = 'quand je valide le bordereau la page revient en haut et je perds ma ligne'

const SYNTHESE: Synthese = {
  type: 'bug',
  titre: 'La validation du bordereau renvoie en haut de page',
  resume: 'Après validation, la page remonte. La personne perd la ligne sur laquelle elle travaillait.',
  zone: 'Bordereaux',
  impact: 'ralentit',
  citations: ['la page revient en haut'],
  confiance: 'moyenne',
  questions_ouvertes: [],
}

let nomBase: string
let urlBase: string
let client: Client
let bassin: Pool

/** Le modèle, qu’on coupe et qu’on rétablit — et qui compte ses appels. */
const modele = {
  enPanne: false,
  lenteurMs: 0,
  appels: [] as string[],
}

const MODELE: Modele = {
  identifiant: 'bouchon',
  tour: async () => {
    throw new Error('pas de tour ici')
  },
  synthese: async (demande) => {
    modele.appels.push(demande.fil.map((tour) => tour.texte).join(' '))
    if (modele.lenteurMs > 0) await new Promise((r) => setTimeout(r, modele.lenteurMs))
    if (modele.enPanne) throw new Error('529 overloaded')
    return { synthese: SYNTHESE, modele: 'bouchon', jetonsEntree: 10, jetonsSortie: 5 }
  },
}

/** Ce que Telegram a reçu. */
let avis: string[] = []

const FETCH: Recuperer = async (_url, init) => {
  avis.push(String((JSON.parse(init.body) as { text: string }).text))
  return { status: 200, json: async () => ({ ok: true }) }
}

function synthetiser(retourId: string) {
  return synthetiserEtNotifier(retourId, {
    synthese: { depot: creerDepotSyntheses(bassin), modele: MODELE },
    notifier: (id) =>
      notifierParCanaux(id, {
        depot: creerDepotNotifications(bassin, URL_PUBLIQUE),
        canaux: [canalTelegram(REGLAGES, { fetch: FETCH, attendre: async () => undefined })],
      }),
    maximumRelances: MAX_RELANCES,
  })
}

function ports(): PortsReprise {
  const depot = creerDepotReprise(bassin)
  return {
    reserver: (limites, plafond) => depot.reserver(limites, plafond),
    synthetiser,
    renoncer: (retourId, motif) => depot.renoncer(retourId, motif),
    signaler: () => undefined,
  }
}

/**
 * Un retour clos, sans note.
 *
 * ⚠️ `closLe` est posé dans `maj_le`, comme le fait `clore`. ⛔ Aucune ligne
 *    `audit` : c’est un entretien refermé par le widget, le cas que la requête de
 *    rattrapage ne voyait pas.
 */
async function retourClos(options: {
  statut?: string
  closDepuisMs?: number
  parole?: boolean
  reprises?: number
  repriseDepuisMs?: number
}): Promise<string> {
  const id = identifiant()
  const clos = new Date(Date.now() - (options.closDepuisMs ?? 10 * MINUTE)).toISOString()
  const reprise =
    options.repriseDepuisMs === undefined
      ? null
      : new Date(Date.now() - options.repriseDepuisMs).toISOString()

  await client.query(
    `insert into retours (id, produit_id, source, statut, cree_le, maj_le, synthese_reprises, synthese_reprise_le)
     values ($1, 'prod_1', 'texte', $2::statut_retour, $3, $3, $4, $5)`,
    [id, options.statut ?? 'envoye', clos, options.reprises ?? null, reprise],
  )

  // ⚠️ Sans parole : un retour dicté dont le transcript n’est pas arrivé.
  await client.query(
    `insert into messages (id, retour_id, ordre, role, texte) values ($1, $2, 0, 'collaborateur', $3)`,
    [identifiant(), id, options.parole === false ? '' : PAROLE],
  )

  return id
}

async function etat(id: string) {
  const { rows } = await client.query(
    `select r.synthese_reprises, r.synthese_impossible_motif,
            (select count(*)::int from syntheses s where s.retour_id = r.id) as notes,
            (select count(*)::int from notifications n where n.retour_id = r.id and n.statut = 'envoye') as avis,
            (select count(*)::int from audit a where a.retour_id = r.id) as audit
       from retours r where r.id = $1`,
    [id],
  )
  return rows[0] as {
    synthese_reprises: number | null
    synthese_impossible_motif: string | null
    notes: number
    avis: number
    audit: number
  }
}

const plusTard = (ms: number) => new Date(Date.now() + ms)

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

  await client.query(
    `insert into produits (id, nom, domaine, cle_publique, secret_hash)
     values ('prod_1', 'Pistache', 'pistache.exemple.fr', 'fdy_pub_essai_reprise', 'argon2-bidon')`,
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
  // ⚠️ Une base jetable, à nous : on la vide entre deux essais, parce que la
  //    réservation prend le plus ancien retour dû, quel qu’il soit.
  await client.query(
    'truncate notifications, syntheses, messages, contextes, indices, audit, retours',
  )
  modele.enPanne = false
  modele.lenteurMs = 0
  modele.appels = []
  avis = []
})

describe('⛔ aucune note ne se perd', () => {
  it('le modèle échoue, puis revient : la note est écrite et l’avis part, à la passe suivante', async () => {
    const id = await retourClos({})

    // ── la panne ────────────────────────────────────────────────────────────
    modele.enPanne = true
    const pendant = await reprendre(ports())

    expect(pendant).toMatchObject({ reprises: 1, enAttente: 1, ecrites: 0 })
    expect(await etat(id)).toMatchObject({ synthese_reprises: 1, notes: 0, avis: 0 })

    // ── la même passe, rejouée tout de suite : rien n’est dû ─────────────────
    modele.appels = []
    await reprendre(ports())
    expect(modele.appels).toEqual([])

    // ── le modèle revient ────────────────────────────────────────────────────
    modele.enPanne = false
    const apres = await reprendre(ports(), { maintenant: plusTard(11 * MINUTE) })

    expect(apres).toMatchObject({ reprises: 1, ecrites: 1 })
    expect(await etat(id)).toMatchObject({ synthese_reprises: 2, notes: 1, avis: 1 })
    expect(avis).toHaveLength(1)
    expect(avis[0]).toContain(`${URL_PUBLIQUE}/bo/r/${id}`)
    // ⛔ Un pointeur : ni le titre, ni la parole.
    expect(avis[0]).not.toContain(SYNTHESE.titre)
    expect(avis[0]).not.toContain('page revient en haut')
  })

  it('⛔ un retour refermé par le widget — AUCUNE ligne dans audit — est repris', async () => {
    const id = await retourClos({ statut: 'abandonne' })

    await reprendre(ports())

    expect(await etat(id)).toMatchObject({ audit: 0, notes: 1 })
  })

  it('⚠️ laisse passer la tentative ordinaire : un retour clos il y a deux minutes attend', async () => {
    const id = await retourClos({ closDepuisMs: 2 * MINUTE })

    const bilan = await reprendre(ports())

    expect(bilan.reprises).toBe(0)
    expect(await etat(id)).toMatchObject({ synthese_reprises: null, notes: 0 })
  })

  it('ne reprend ni un entretien en cours, ni un retour déjà lu, ni un retour qui a sa note', async () => {
    await retourClos({ statut: 'en_cours' })
    await retourClos({ statut: 'lu' })
    const note = await retourClos({})
    await synthetiser(note)
    modele.appels = []

    const bilan = await reprendre(ports(), { maintenant: plusTard(60 * MINUTE) })

    expect(bilan.reprises).toBe(0)
    expect(modele.appels).toEqual([])
  })

  it('⛔ `rien_a_synthetiser` est abandonné tout de suite, et n’est JAMAIS retenté', async () => {
    const id = await retourClos({ parole: false })

    await reprendre(ports())
    expect(await etat(id)).toMatchObject({
      synthese_reprises: 1,
      synthese_impossible_motif: 'rien_a_synthetiser',
    })

    // Une semaine plus tard, dix passes : il ne revient pas.
    for (let passe = 0; passe < 10; passe += 1) {
      await reprendre(ports(), { maintenant: plusTard(7 * 24 * 60 * MINUTE) })
    }

    expect(await etat(id)).toMatchObject({ synthese_reprises: 1 })
    expect(modele.appels).toEqual([])
  })

  it('⛔ le plafond tient : à la dernière reprise, le filet renonce — et ne revient plus', async () => {
    const id = await retourClos({
      reprises: PLAFOND_REPRISES - 1,
      repriseDepuisMs: 2 * 24 * 60 * MINUTE,
    })
    modele.enPanne = true

    const bilan = await reprendre(ports())

    expect(bilan.impossibles).toEqual([id])
    expect(await etat(id)).toMatchObject({
      synthese_reprises: PLAFOND_REPRISES,
      synthese_impossible_motif: 'plafond',
      notes: 0,
    })

    // ⚠️ Même rétabli, le modèle n’est plus appelé par le filet.
    modele.enPanne = false
    modele.appels = []
    await reprendre(ports(), { maintenant: plusTard(30 * 24 * 60 * MINUTE) })
    expect(modele.appels).toEqual([])
  })

  /**
   * ⚠️ Vérifié en retirant `for update of r skip locked` de la réservation : le
   *    test rougit cinq fois sur cinq (« expected 9 to be 6 » — jusqu’à dix
   *    appels pour six retours). À deux passes et trois retours, il ne rougissait
   *    que deux fois sur trois : la course dépend de l’ordonnanceur, d’où trois
   *    passes et six retours.
   */
  it('⛔ des passes simultanées n’appellent pas deux fois le modèle pour le même retour', async () => {
    const ids: string[] = []
    for (let n = 0; n < 6; n += 1) ids.push(await retourClos({}))
    modele.lenteurMs = 30

    // ⚠️ Trois bassins : trois conteneurs derrière un proxy.
    const autres = [new Pool({ connectionString: urlBase }), new Pool({ connectionString: urlBase })]
    try {
      const bilans = await Promise.all([
        reprendre(ports()),
        ...autres.map((autre) => {
          const depot = creerDepotReprise(autre)
          return reprendre({ ...ports(), reserver: (l, p) => depot.reserver(l, p) })
        }),
      ])

      expect(bilans.reduce((total, bilan) => total + bilan.reprises, 0)).toBe(6)
      expect(modele.appels).toHaveLength(6)
      for (const id of ids) expect(await etat(id)).toMatchObject({ synthese_reprises: 1, notes: 1 })
    } finally {
      await Promise.all(autres.map((autre) => autre.end()))
    }
  })
})

describe('⛔ « Refaire la note »', () => {
  function portsRefaire() {
    const depot = creerDepotSyntheses(bassin)
    return {
      statut: async (retourId: string) => (await depot.charger(retourId))?.statut ?? null,
      aSaNote: (retourId: string) => depot.dejaFaite(retourId),
      synthetiser,
    }
  }

  it('refuse un retour qui a déjà sa note — sans appeler le modèle', async () => {
    const id = await retourClos({})
    await synthetiser(id)
    modele.appels = []

    expect(await refaireLaNote(id, portsRefaire())).toEqual({ ok: false, motif: 'deja_faite' })
    expect(modele.appels).toEqual([])
    expect(await etat(id)).toMatchObject({ notes: 1 })
  })

  it('refait la note d’un retour auquel le filet a renoncé — sans toucher aux reprises', async () => {
    const id = await retourClos({ reprises: PLAFOND_REPRISES, repriseDepuisMs: MINUTE })
    await creerDepotReprise(bassin).renoncer(id, 'plafond')

    expect(await refaireLaNote(id, portsRefaire())).toEqual({ ok: true })
    expect(await etat(id)).toMatchObject({
      notes: 1,
      avis: 1,
      synthese_reprises: PLAFOND_REPRISES,
      synthese_impossible_motif: 'plafond',
    })
  })

  it('dit quand le modèle ne répond toujours pas, et n’écrit rien', async () => {
    const id = await retourClos({})
    modele.enPanne = true

    expect(await refaireLaNote(id, portsRefaire())).toEqual({ ok: false, motif: 'modele_indisponible' })
    expect(await etat(id)).toMatchObject({ notes: 0, synthese_reprises: null })
  })

  it('refuse un retour inconnu', async () => {
    expect(await refaireLaNote('ret_fantome', portsRefaire())).toEqual({
      ok: false,
      motif: 'retour_inconnu',
    })
  })
})

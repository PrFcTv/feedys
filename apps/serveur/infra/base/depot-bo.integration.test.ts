/**
 * Le dépôt du back-office contre un VRAI Postgres.
 *
 * ⚠️ Ce que le test unitaire ne peut pas prouver et qui compte ici :
 *    ⛔ **chaque correction écrit sa ligne d’audit DANS LA MÊME TRANSACTION**,
 *    les filtres bornent bien, et ⛔ **le fil reste intact après une correction**.
 *
 * Il faut un Postgres joignable : `docker compose up -d postgres`, et
 * DATABASE_URL renseignée.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { Client, Pool } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { AUCUN_FILTRE } from '../../domaine/backoffice/filtres'
import type { Synthese } from '../../domaine/synthese/schema'
import { identifiant } from '../identifiants'

import type { DepotBackOffice } from './depot-bo'
import { creerDepotBackOffice } from './depot-bo'
import { appliquerMigrations } from './migrations'
import { urlBaseDessai } from '../../../../tests/base-dessai'

const ICI = path.dirname(fileURLToPath(import.meta.url))
const RACINE = path.resolve(ICI, '../../../..')
const DOSSIER_MIGRATIONS = path.join(RACINE, 'db', 'migrations')

const ADMIN = urlBaseDessai()

/** ⛔ Inventée. Jamais un vrai retour copié d’une base (CLAUDE.md §Secrets). */
const SYNTHESE: Synthese = {
  type: 'bug',
  titre: 'Le tri par date de la liste des dossiers se réinitialise',
  resume: 'Le tri ne survit pas à la navigation.',
  zone: 'Liste des dossiers',
  impact: 'ralentit',
  citations: ['il se remet à zéro'],
  confiance: 'moyenne',
  questions_ouvertes: [],
}

const PAROLE = 'le tri il se remet à zéro dès que je reviens en arrière'

let nomBase: string
let client: Client
let bassin: Pool
let depot: DepotBackOffice
let retourId: string

const MAINTENANT = Date.now()

async function audits() {
  const { rows } = await client.query(
    'select acteur, action, detail from audit where retour_id = $1 order by cree_le asc',
    [retourId],
  )
  return rows
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
  depot = creerDepotBackOffice(bassin)

  await client.query(
    `insert into produits (id, nom, domaine, cle_publique, secret_hash)
     values ('prod_1', 'Pistache', 'pistache.exemple.fr', 'fdy_pub_essai_bo', 'argon2-bidon')`,
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
  await client.query('delete from syntheses')
  await client.query('delete from contextes')
  await client.query('delete from messages')
  await client.query('delete from retours')

  retourId = identifiant()

  await client.query(
    `insert into retours
       (id, produit_id, source, statut, type, titre, zone, auteur_nom, auteur_role)
     values ($1, 'prod_1', 'voix', 'envoye', 'bug', $2, 'Liste des dossiers',
             'Camille Martin', 'gestionnaire')`,
    [retourId, SYNTHESE.titre],
  )
  await client.query(
    `insert into messages (id, retour_id, ordre, role, texte) values
       ($1, $2, 0, 'collaborateur', $3),
       ($4, $2, 1, 'bot', 'C’est nouveau ?')`,
    [identifiant(), retourId, PAROLE, identifiant()],
  )
  await client.query(
    `insert into contextes (id, retour_id, url, navigateur, viewport_l, viewport_h)
     values ($1, $2, '/dossiers?tri=date', 'Chrome 141', 1512, 982)`,
    [identifiant(), retourId],
  )
  await client.query(
    `insert into syntheses (id, retour_id, contenu, modele, confiance)
     values ($1, $2, $3::jsonb, 'bouchon', 'moyenne'::confiance_synthese)`,
    [identifiant(), retourId, JSON.stringify(SYNTHESE)],
  )
})

describe('la liste', () => {
  it('rend le retour, avec son produit et sa confiance', async () => {
    const lignes = await depot.lister(AUCUN_FILTRE, MAINTENANT)

    expect(lignes).toHaveLength(1)
    expect(lignes[0]?.produitNom).toBe('Pistache')
    expect(lignes[0]?.confiance).toBe('moyenne')
    expect(lignes[0]?.titre).toBe(SYNTHESE.titre)
  })

  it('borne par statut, par type, par zone et par date', async () => {
    expect(await depot.lister({ ...AUCUN_FILTRE, statut: 'envoye' }, MAINTENANT)).toHaveLength(1)
    expect(await depot.lister({ ...AUCUN_FILTRE, statut: 'traite' }, MAINTENANT)).toHaveLength(0)
    expect(await depot.lister({ ...AUCUN_FILTRE, type: 'bug' }, MAINTENANT)).toHaveLength(1)
    expect(await depot.lister({ ...AUCUN_FILTRE, type: 'idee' }, MAINTENANT)).toHaveLength(0)
    expect(await depot.lister({ ...AUCUN_FILTRE, zone: 'dossiers' }, MAINTENANT)).toHaveLength(1)
    expect(await depot.lister({ ...AUCUN_FILTRE, zone: 'facturation' }, MAINTENANT)).toHaveLength(0)
    expect(await depot.lister({ ...AUCUN_FILTRE, periode: '24h' }, MAINTENANT)).toHaveLength(1)
  })

  it('rend les zones connues, pour que le filtre se choisisse au lieu de se deviner', async () => {
    expect(await depot.zonesConnues()).toEqual(['Liste des dossiers'])
  })
})

describe('la fiche', () => {
  it('rend la note, le fil et le contexte', async () => {
    const fiche = await depot.fiche(retourId)

    expect(fiche?.synthese?.titre).toBe(SYNTHESE.titre)
    expect(fiche?.fil.map((tour) => tour.role)).toEqual(['collaborateur', 'bot'])
    expect(fiche?.fil[0]?.texte).toBe(PAROLE)
    expect(fiche?.contexte?.navigateur).toBe('Chrome 141')
  })

  it('rend null sur un retour inconnu', async () => {
    expect(await depot.fiche('ret_absent')).toBeNull()
  })
})

describe('⛔ les corrections, et leur trace', () => {
  it('change le statut ET journalise, dans la même transaction', async () => {
    expect(await depot.changerStatut(retourId, { statut: 'traite' })).toBe(true)

    const { rows } = await client.query('select statut from retours where id = $1', [retourId])
    expect(rows[0]?.['statut']).toBe('traite')

    const trace = await audits()
    expect(trace).toHaveLength(1)
    expect(trace[0]?.['acteur']).toBe('developpeur')
    expect(trace[0]?.['action']).toBe('statut')
    // ⚠️ L’avant ET l’après : sans l’avant, la ligne ne dit rien.
    expect(trace[0]?.['detail']).toEqual({ avant: 'envoye', apres: 'traite' })
  })

  it('corrige les étiquettes ET journalise', async () => {
    expect(
      await depot.corrigerEtiquettes(retourId, { type: 'idee', zone: 'Facturation' }),
    ).toBe(true)

    const { rows } = await client.query('select type, zone from retours where id = $1', [retourId])
    expect(rows[0]?.['type']).toBe('idee')
    expect(rows[0]?.['zone']).toBe('Facturation')

    const trace = await audits()
    expect(trace[0]?.['action']).toBe('etiquettes')
    expect(trace[0]?.['detail']).toEqual({
      avant: { type: 'bug', zone: 'Liste des dossiers' },
      apres: { type: 'idee', zone: 'Facturation' },
    })
  })

  it('⛔ ne touche jamais au fil ni à la note', async () => {
    await depot.changerStatut(retourId, { statut: 'ecarte' })
    await depot.corrigerEtiquettes(retourId, { type: 'gene', zone: 'Ailleurs' })

    const fiche = await depot.fiche(retourId)
    expect(fiche?.fil[0]?.texte).toBe(PAROLE)
    expect(fiche?.synthese?.resume).toBe(SYNTHESE.resume)
    expect(fiche?.synthese?.citations).toEqual(SYNTHESE.citations)
  })

  it('n’écrit rien — pas même une ligne d’audit — sur un retour inconnu', async () => {
    expect(await depot.changerStatut('ret_absent', { statut: 'lu' })).toBe(false)

    const { rows } = await client.query('select count(*)::int as n from audit')
    expect(rows[0]?.['n']).toBe(0)
  })
})

/**
 * `POST /api/retours`, contre un vrai Postgres et la vraie route.
 *
 * ⚠️ On appelle le handler exporté, pas une fonction intermédiaire : ce qui est
 *    vérifié ici, ce sont les codes de statut que verra le widget, et le fait
 *    que les quatre lignes existent réellement — produit, retour, message,
 *    contexte.
 *
 * ⚠️ La route se câble à l’import (`infra/composition.ts` tient les limiteurs de
 *    débit en singletons). D’où le `vi.resetModules()` puis l’import dynamique,
 *    APRÈS avoir pointé DATABASE_URL sur la base jetable.
 *
 * Il faut un Postgres joignable : `docker compose up -d postgres`, et
 * DATABASE_URL renseignée (.env.local sur le poste, service `postgres` en CI).
 */
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { EN_TETE_CLE } from '../../../../../packages/widget/src/contrat'
import { appliquerMigrations } from '../../../infra/base/migrations'

// ⚠️ Type seul : l’import de valeur est dynamique, APRÈS que DATABASE_URL pointe
//    sur la base jetable.
import type * as ModuleRoute from './route'

const ICI = path.dirname(fileURLToPath(import.meta.url))
const RACINE = path.resolve(ICI, '../../../../..')
const DOSSIER_MIGRATIONS = path.join(RACINE, 'db', 'migrations')

const ADMIN = process.env['DATABASE_URL'] ?? 'postgresql://feedys:feedys@localhost:5432/feedys'

const DOMAINE = 'victoria.exemple.fr'
const ORIGINE = `https://${DOMAINE}`
const CLE = 'fdy_pub_essai_ingestion'
const CLE_INACTIF = 'fdy_pub_essai_inactif'

let nomBase: string
let client: Client
let stockage: string
let route: typeof ModuleRoute

/** Chaque appel change d’IP : le compteur par IP ne doit pas gêner la recette. */
let compteurIp = 0

function requete(
  corps: unknown,
  entetes: Record<string, string> = {},
  cle: string | null = CLE,
): Request {
  compteurIp += 1

  const headers = new Headers({
    'content-type': 'application/json',
    origin: ORIGINE,
    'x-forwarded-for': `203.0.113.${compteurIp}`,
    ...entetes,
  })
  if (cle !== null) headers.set(EN_TETE_CLE, cle)

  return new Request('https://feedys.exemple.fr/api/retours', {
    method: 'POST',
    headers,
    body: typeof corps === 'string' ? corps : JSON.stringify(corps),
  })
}

const CORPS = {
  texte: 'le tri de la colonne date remet tout à zéro quand je reviens sur la page',
  transcriptBrut: 'euh le tri de la colonne date remet tout à zéro quand je reviens sur la page',
  source: 'voix',
  contexte: {
    url: 'https://victoria.exemple.fr/dossiers?tri=date',
    titrePage: 'Dossiers — VictorIA',
    ecran: 'dossiers',
    selecteurDom: 'table.dossiers th:nth-child(3)',
    navigateur: 'Chrome 141',
    systeme: 'Windows 11',
    viewportL: 1920,
    viewportH: 1080,
    fuseau: 'Europe/Paris',
    agentBrut: { langue: 'fr-FR' },
  },
} as const

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

  await client.query(
    `insert into produits (id, nom, domaine, cle_publique, secret_hash, actif)
     values ($1, $2, $3, $4, 'argon2-bidon', true),
            ($5, $6, $7, $8, 'argon2-bidon', false)`,
    [
      'prod_actif',
      'VictorIA',
      DOMAINE,
      CLE,
      'prod_inactif',
      'VictorIA (retiré)',
      DOMAINE,
      CLE_INACTIF,
    ],
  )

  stockage = await mkdtemp(path.join(tmpdir(), 'feedys-stockage-'))

  process.env['DATABASE_URL'] = url.toString()
  process.env['FEEDYS_STOCKAGE'] = stockage

  vi.resetModules()
  route = await import('./route')
}, 60_000)

afterAll(async () => {
  const { fermerPool } = await import('../../../infra/base/connexion')
  await fermerPool()
  await client?.end()
  await rm(stockage, { recursive: true, force: true })

  const menage = new Client({ connectionString: ADMIN })
  await menage.connect()
  await menage.query(`drop database if exists "${nomBase}" with (force)`)
  await menage.end()
}, 60_000)

describe('le cas nominal', () => {
  it('rend 201 avec l’id, et crée les quatre lignes', async () => {
    const reponse = await route.POST(requete(CORPS))

    expect(reponse.status).toBe(201)

    const corps = (await reponse.json()) as { retour: string }
    expect(corps.retour).toBeTypeOf('string')
    expect(corps.retour.length).toBeGreaterThan(0)

    const { rows: retours } = await client.query(
      `select r.id, r.produit_id, r.statut, r.source, r.identite_verifiee, p.nom
         from retours r join produits p on p.id = r.produit_id
        where r.id = $1`,
      [corps.retour],
    )
    expect(retours[0]).toMatchObject({
      produit_id: 'prod_actif',
      statut: 'en_cours',
      source: 'voix',
      identite_verifiee: false,
      nom: 'VictorIA',
    })

    const { rows: messages } = await client.query(
      'select ordre, role, texte, transcript_brut, audio_chemin from messages where retour_id = $1',
      [corps.retour],
    )
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      ordre: 0,
      role: 'collaborateur',
      texte: CORPS.texte,
      transcript_brut: CORPS.transcriptBrut,
      audio_chemin: null,
    })

    const { rows: contextes } = await client.query(
      `select url, titre_page, ecran, selecteur_dom, navigateur, systeme,
              viewport_l, viewport_h, fuseau, agent_brut, capture_chemin
         from contextes where retour_id = $1`,
      [corps.retour],
    )
    expect(contextes[0]).toMatchObject({
      url: CORPS.contexte.url,
      titre_page: CORPS.contexte.titrePage,
      ecran: CORPS.contexte.ecran,
      selecteur_dom: CORPS.contexte.selecteurDom,
      navigateur: CORPS.contexte.navigateur,
      systeme: CORPS.contexte.systeme,
      viewport_l: 1920,
      viewport_h: 1080,
      fuseau: 'Europe/Paris',
      agent_brut: { langue: 'fr-FR' },
      capture_chemin: null,
    })
  })

  it('accepte un curl SANS Origin — CORS protège un onglet, pas l’API', async () => {
    const sansOrigine = requete(CORPS, {})
    sansOrigine.headers.delete('origin')

    expect((await route.POST(sansOrigine)).status).toBe(201)
  })

  it('range l’audio et la capture sur le disque, et n’écrit que le chemin en base', async () => {
    const corps = {
      ...CORPS,
      audio: { type: 'audio/webm', donnees: Buffer.from('des octets').toString('base64') },
      contexte: {
        ...CORPS.contexte,
        capture: { type: 'image/webp', donnees: Buffer.from('une image').toString('base64') },
      },
    }

    const reponse = await route.POST(requete(corps))
    expect(reponse.status).toBe(201)

    const { retour } = (await reponse.json()) as { retour: string }

    const { rows } = await client.query(
      `select m.audio_chemin, c.capture_chemin
         from messages m join contextes c on c.retour_id = m.retour_id
        where m.retour_id = $1`,
      [retour],
    )

    expect(rows[0]?.['audio_chemin']).toMatch(/^audio\/\d{4}\/\d{2}\/.+\.webm$/)
    expect(rows[0]?.['capture_chemin']).toMatch(/^capture\/\d{4}\/\d{2}\/.+\.webp$/)

    // ⛔ Les octets vivent sur le volume, pas dans la base.
    expect(await readdir(stockage)).toEqual(expect.arrayContaining(['audio', 'capture']))
  })
})

describe('les refus', () => {
  it('clé inconnue → 404', async () => {
    const reponse = await route.POST(requete(CORPS, {}, 'fdy_pub_personne'))

    expect(reponse.status).toBe(404)
    expect(await reponse.json()).toEqual({ motif: 'produit_inconnu', message: 'Produit inconnu.' })
  })

  it('produit inactif → 404, du même message — on ne dit pas qu’il a existé', async () => {
    const reponse = await route.POST(requete(CORPS, {}, CLE_INACTIF))

    expect(reponse.status).toBe(404)
    expect(await reponse.json()).toEqual({ motif: 'produit_inconnu', message: 'Produit inconnu.' })
  })

  it('clé absente → 401', async () => {
    expect((await route.POST(requete(CORPS, {}, null))).status).toBe(401)
  })

  it('corps trop gros → 413', async () => {
    const enorme = {
      ...CORPS,
      audio: { type: 'audio/webm', donnees: 'A'.repeat(5 * 1024 * 1024) },
    }

    expect((await route.POST(requete(enorme))).status).toBe(413)
  })

  it('corps trop gros annoncé par Content-Length → 413, sans même lire le corps', async () => {
    const reponse = await route.POST(
      requete(CORPS, { 'content-length': String(9 * 1024 * 1024) }),
    )

    expect(reponse.status).toBe(413)
  })

  it('mauvaise origine → 403', async () => {
    const reponse = await route.POST(requete(CORPS, { origin: 'https://mechant.exemple.fr' }))

    expect(reponse.status).toBe(403)
    expect(((await reponse.json()) as { motif: string }).motif).toBe('origine_refusee')
  })

  it('corps invalide → 400', async () => {
    expect((await route.POST(requete('{ pas du json'))).status).toBe(400)
    expect((await route.POST(requete({ contexte: { url: 'https://x.fr' } }))).status).toBe(400)
  })

  it('⛔ un refus n’écrit rien', async () => {
    const { rows } = await client.query('select count(*)::int as n from retours')
    const avant = rows[0]?.['n']

    await route.POST(requete(CORPS, {}, 'fdy_pub_personne'))
    await route.POST(requete(CORPS, { origin: 'https://mechant.exemple.fr' }))
    await route.POST(requete('{'))

    const { rows: apres } = await client.query('select count(*)::int as n from retours')
    expect(apres[0]?.['n']).toBe(avant)
  })
})

describe('CORS', () => {
  it('répond au préflight sans rien divulguer', async () => {
    const reponse = route.OPTIONS(
      new Request('https://feedys.exemple.fr/api/retours', {
        method: 'OPTIONS',
        headers: { origin: ORIGINE },
      }),
    )

    expect(reponse.status).toBe(204)
    expect(reponse.headers.get('access-control-allow-origin')).toBe(ORIGINE)
    expect(reponse.headers.get('access-control-allow-headers')).toContain(EN_TETE_CLE)
    expect(reponse.headers.get('vary')).toBe('Origin')
  })

  it('renvoie les en-têtes CORS même sur un refus — sinon le widget lit « erreur réseau »', async () => {
    const reponse = await route.POST(requete(CORPS, {}, 'fdy_pub_personne'))

    expect(reponse.headers.get('access-control-allow-origin')).toBe(ORIGINE)
  })
})

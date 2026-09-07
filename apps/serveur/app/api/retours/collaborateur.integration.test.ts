/**
 * Intégration de la relève et de l’accusé collaborateur, contre un vrai Postgres.
 *
 * Vérifie le cycle complet :
 * 1. Retour créé avec identité signée
 * 2. Prise en compte par le développeur (statut = 'traite' + mot de réponse)
 * 3. Relève GET par le collaborateur
 * 4. Accusé POST
 * 5. Disparition de la liste d’attente
 * 6. Épreuves de sécurité (mauvais ref, jeton forgé).
 */
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { EN_TETE_CLE, EN_TETE_IDENTITE } from '../../../../../packages/widget/src/contrat'
import { signerIdentite } from '../../../domaine/identite/jeton'
import { appliquerMigrations } from '../../../infra/base/migrations'
import { chiffrer, nouvelleCleDeChiffrement } from '../../../infra/secret'
import { urlBaseDessai } from '../../../../../tests/base-dessai'

import type * as ModuleRouteCollaborateur from './collaborateur/route'
import type * as ModuleRouteAccuse from './[id]/accuse/route'
import type * as ModuleDepotBo from '../../../infra/base/depot-bo'
import type * as ModuleConnexion from '../../../infra/base/connexion'

const ICI = path.dirname(fileURLToPath(import.meta.url))
const RACINE = path.resolve(ICI, '../../../../..')
const DOSSIER_MIGRATIONS = path.join(RACINE, 'db', 'migrations')

const ADMIN = urlBaseDessai()
const DOMAINE = 'victoria.exemple.fr'
const ORIGINE = `https://${DOMAINE}`
const CLE = 'fdy_pub_collab_test'
const SECRET = 'fdy_sec_secret-collab-test-invente'
const CLE_CHIFFREMENT = nouvelleCleDeChiffrement()

let nomBase: string
let client: Client
let stockage: string
let routeCollab: typeof ModuleRouteCollaborateur
let routeAccuse: typeof ModuleRouteAccuse
let depotBoModule: typeof ModuleDepotBo
let connexionModule: typeof ModuleConnexion

function jeton(ref: string, expOffset = 3_600): string {
  return signerIdentite(
    { ref, nom: `Nom ${ref}`, role: 'Gestionnaire', exp: Math.floor(Date.now() / 1_000) + expOffset },
    SECRET,
  )
}

function requeteGet(entetes: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/retours/collaborateur', {
    method: 'GET',
    headers: {
      origin: ORIGINE,
      [EN_TETE_CLE]: CLE,
      ...entetes,
    },
  })
}

function requetePostAccuse(retourId: string, entetes: Record<string, string> = {}): Request {
  return new Request(`http://localhost/api/retours/${retourId}/accuse`, {
    method: 'POST',
    headers: {
      origin: ORIGINE,
      [EN_TETE_CLE]: CLE,
      ...entetes,
    },
  })
}

describe('le cycle de retour au collaborateur (Postgres réel)', () => {
  beforeAll(async () => {
    nomBase = `feedys_collab_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

    const admin = new Client({ connectionString: ADMIN })
    await admin.connect()
    await admin.query(`create database "${nomBase}"`)
    await admin.end()

    const url = new URL(ADMIN)
    url.pathname = `/${nomBase}`
    const baseUri = url.toString()

    client = new Client({ connectionString: baseUri })
    await client.connect()
    await appliquerMigrations(client, DOSSIER_MIGRATIONS)

    stockage = await mkdtemp(path.join(tmpdir(), 'feedys-collab-'))

    process.env['DATABASE_URL'] = baseUri
    process.env['FEEDYS_STOCKAGE'] = stockage
    process.env['FEEDYS_CLE_CHIFFREMENT'] = CLE_CHIFFREMENT
    process.env['FEEDYS_MODELE'] = 'claude-test'

    await client.query(
      `insert into produits (id, nom, domaine, cle_publique, secret_hash, secret_chiffre, actif)
       values ($1, $2, $3, $4, $5, $6, true)`,
      ['prd_collab', 'VictorIA', DOMAINE, CLE, 'argon2_bidon', chiffrer(SECRET, Buffer.from(CLE_CHIFFREMENT, 'base64url'))],
    )

    vi.resetModules()
    connexionModule = await import('../../../infra/base/connexion')
    depotBoModule = await import('../../../infra/base/depot-bo')
    routeCollab = await import('./collaborateur/route')
    routeAccuse = await import('./[id]/accuse/route')
  }, 60_000)

  afterAll(async () => {
    await connexionModule?.fermerPool()
    await client?.end()

    const menage = new Client({ connectionString: ADMIN })
    await menage.connect()
    await menage.query(`drop database if exists "${nomBase}" with (force)`)
    await menage.end()

    if (stockage) await rm(stockage, { recursive: true, force: true })
  }, 60_000)

  it('cycle complet : création -> traité avec réponse -> relève -> accusé -> disparition', async () => {
    const idRetour = 'ret_collab_1'
    const refAuteur = 'usr_alice'

    // 1. Retour en base
    await client.query(
      `insert into retours (id, produit_id, source, statut, auteur_ref, auteur_nom, auteur_role, identite_verifiee, titre)
       values ($1, 'prd_collab', 'texte', 'en_cours', $2, 'Alice', 'Comptable', true, 'Erreur de calcul')`,
      [idRetour, refAuteur],
    )

    const jetonAlice = jeton(refAuteur)

    // 2. Relève initiale : retour non encore traité -> liste vide
    const repInitiale = await routeCollab.GET(requeteGet({ [EN_TETE_IDENTITE]: jetonAlice }))
    expect(repInitiale.status).toBe(200)
    const jsonInitiale = await repInitiale.json()
    expect(jsonInitiale).toEqual({ retours: [] })

    // 3. Développeur passe le retour en 'traite' avec réponse
    const depotBo = depotBoModule.creerDepotBackOffice(connexionModule.pool())
    const okChangement = await depotBo.changerStatut(idRetour, {
      statut: 'traite',
      reponse: 'Corrigé dans la version déployée à midi',
    })
    expect(okChangement).toBe(true)

    // 4. Relève par Alice : le retour apparaît
    const repReleve = await routeCollab.GET(requeteGet({ [EN_TETE_IDENTITE]: jetonAlice }))
    expect(repReleve.status).toBe(200)
    const jsonReleve = await repReleve.json()
    expect(jsonReleve.retours).toHaveLength(1)
    expect(jsonReleve.retours[0]).toMatchObject({
      id: idRetour,
      titre: 'Erreur de calcul',
      statut: 'traite',
      reponseTexte: 'Corrigé dans la version déployée à midi',
    })
    expect(jsonReleve.retours[0].reponseEnvoyeeLe).toBeDefined()

    // 5. Un autre collaborateur (Bob) ne voit rien
    const jetonBob = jeton('usr_bob')
    const repBob = await routeCollab.GET(requeteGet({ [EN_TETE_IDENTITE]: jetonBob }))
    expect(await repBob.json()).toEqual({ retours: [] })

    // 6. Bob tente d’accuser réception du retour d'Alice -> 403 refusé
    const repAccuseBob = await routeAccuse.POST(
      requetePostAccuse(idRetour, { [EN_TETE_IDENTITE]: jetonBob }),
      { params: Promise.resolve({ id: idRetour }) },
    )
    expect(repAccuseBob.status).toBe(403)
    const jsonAccuseBob = await repAccuseBob.json()
    expect(jsonAccuseBob.motif).toBe('auteur_refuse')

    // 7. Alice accuse réception -> 200 OK
    const repAccuseAlice = await routeAccuse.POST(
      requetePostAccuse(idRetour, { [EN_TETE_IDENTITE]: jetonAlice }),
      { params: Promise.resolve({ id: idRetour }) },
    )
    expect(repAccuseAlice.status).toBe(200)
    expect(await repAccuseAlice.json()).toEqual({ ok: true })

    // 8. Relève après accusé : liste vide
    const repFin = await routeCollab.GET(requeteGet({ [EN_TETE_IDENTITE]: jetonAlice }))
    expect(await repFin.json()).toEqual({ retours: [] })

    // 9. Accusé répété reste OK (idempotence)
    const repAccuseBis = await routeAccuse.POST(
      requetePostAccuse(idRetour, { [EN_TETE_IDENTITE]: jetonAlice }),
      { params: Promise.resolve({ id: idRetour }) },
    )
    expect(repAccuseBis.status).toBe(200)
  })

  it('un jeton forgé ou absent rend une liste vide sans casser (échec doux)', async () => {
    const repSansJeton = await routeCollab.GET(requeteGet())
    expect(repSansJeton.status).toBe(200)
    expect(await repSansJeton.json()).toEqual({ retours: [] })

    const repJetonFaux = await routeCollab.GET(
      requeteGet({ [EN_TETE_IDENTITE]: `${jeton('usr_alice')}_truque` }),
    )
    expect(repJetonFaux.status).toBe(200)
    expect(await repJetonFaux.json()).toEqual({ retours: [] })
  })

  it('accuser sans jeton valide rend 401', async () => {
    const rep = await routeAccuse.POST(requetePostAccuse('ret_collab_1'), {
      params: Promise.resolve({ id: 'ret_collab_1' }),
    })
    expect(rep.status).toBe(401)
  })
})

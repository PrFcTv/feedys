/**
 * Le garde-fou de [D-009], prouvé **sur une vraie connexion** et non par un
 * `set role`.
 *
 * ⚠️ CE QUE `migrations.integration.test.ts` NE PROUVE PAS. Son bloc sur les
 *    privilèges fait `set role feedys_app` depuis la session du propriétaire.
 *    C’est probant sur les GRANT du rôle de GROUPE — et ça ne dit rien de ce qui
 *    casse vraiment : l’authentification d’un rôle de login, son héritage
 *    (`INHERIT`), son droit de lire le registre des migrations, et le fait qu’un
 *    rôle **membre du propriétaire** contournerait tout.
 *
 * ⛔ Un `DATABASE_URL` mal configuré passait toute la suite au vert. Plus
 *    maintenant : ici, on se connecte pour de bon avec le rôle de service.
 *
 * Il faut un Postgres joignable, et un rôle de connexion qui puisse
 * `CREATE DATABASE` et `CREATE ROLE` — c’est le cas sur le poste et en CI.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { messageRole, verdictRole } from '../../domaine/demarrage/controles'
import { ETAT_ROLE } from '../demarrage'
import { urlBaseDessai } from '../../../../tests/base-dessai'

import { appliquerMigrations } from './migrations'

const ICI = path.dirname(fileURLToPath(import.meta.url))
const RACINE = path.resolve(ICI, '../../../..')
const DOSSIER_MIGRATIONS = path.join(RACINE, 'db', 'migrations')

const ADMIN = urlBaseDessai()

/** ⛔ Postgres refuse — c’est le verdict qu’on vient chercher. */
const PRIVILEGE_INSUFFISANT = '42501'

/** ⛔ Inventé, alphanumérique, et sans valeur hors de ce test. Le dépôt est public. */
const MOT_DE_PASSE = 'roleDessai2026Invente'

const SUFFIXE = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
const NOM_BASE = `feedys_essai_role_${SUFFIXE}`
/**
 * ⚠️ Les rôles sont **cluster-wide**, pas par base : deux exécutions
 *    simultanées — la CI et un poste sur le même Postgres — ne doivent pas se
 *    marcher dessus. D’où le suffixe, comme pour la base.
 */
const NOM_ROLE = `feedys_service_essai_${SUFFIXE}`

let proprietaire: Client
let service: Client

function urlAvecBase(url: string, base: string): string {
  const u = new URL(url)
  u.pathname = `/${base}`
  return u.toString()
}

function urlDuService(url: string, base: string): string {
  const u = new URL(url)
  u.pathname = `/${base}`
  u.username = NOM_ROLE
  u.password = MOT_DE_PASSE
  return u.toString()
}

/** Rend le SQLSTATE du refus, ou `undefined` si la requête est passée. */
async function refuse(client: Client, sql: string): Promise<string | undefined> {
  try {
    await client.query(sql)
    return undefined
  } catch (erreur) {
    return (erreur as { code?: string }).code
  }
}

beforeAll(async () => {
  const admin = new Client({ connectionString: ADMIN })
  await admin.connect()

  // ⚠️ LES RÔLES SONT CLUSTER-WIDE, ET SURVIVENT À UN PROCESSUS TUÉ. Ctrl+C, un
  //    délai de CI, un `docker stop` du Postgres pendant la passe : `afterAll` ne
  //    tourne pas, la base part avec la machine et le rôle, lui, reste. Rien ne
  //    le balayait — le suffixe le laissait pourtant entendre.
  //
  // ⛔ On ne supprime QUE les rôles de ce test, et seulement ceux dont plus
  //    aucune base ne dépend : `drop role` échoue si des objets subsistent, et
  //    c’est très bien — on avale l’échec plutôt que de forcer.
  const { rows: perimes } = await admin.query<{ rolname: string }>(
    `select rolname from pg_roles where rolname like 'feedys_service_essai_%'`,
  )
  for (const { rolname } of perimes) {
    await admin.query(`drop role if exists "${rolname}"`).catch(() => undefined)
  }

  await admin.query(`create database "${NOM_BASE}"`)
  await admin.end()

  proprietaire = new Client({ connectionString: urlAvecBase(ADMIN, NOM_BASE) })
  await proprietaire.connect()

  // ⚠️ D’abord les migrations : `feedys_app` et ses GRANT n’existent qu’après
  //    `0001_socle.sql`, et le registre n’est lisible qu’après `0003`.
  await appliquerMigrations(proprietaire, DOSSIER_MIGRATIONS)

  await proprietaire.query(
    `insert into produits (id, nom, domaine, cle_publique, secret_hash)
     values ('prd_role', 'Pistache', 'pistache.exemple.fr', 'fdy_pub_role', 'argon2-bidon')`,
  )
  await proprietaire.query(
    `insert into retours (id, produit_id, source) values ('ret_role', 'prd_role', 'texte')`,
  )
  await proprietaire.query(
    `insert into audit (id, retour_id, acteur, action) values ('aud_role', 'ret_role', 'systeme', 'essai')`,
  )

  // ⚠️ `inherit` explicite : sans lui, le service devrait faire `set role` à
  //    chaque connexion, et le test passerait pour la mauvaise raison.
  await proprietaire.query(
    `create role "${NOM_ROLE}" login password '${MOT_DE_PASSE}' inherit in role feedys_app`,
  )

  service = new Client({ connectionString: urlDuService(ADMIN, NOM_BASE) })
  await service.connect()
}, 60_000)

afterAll(async () => {
  await service?.end().catch(() => undefined)
  await proprietaire?.end().catch(() => undefined)

  const menage = new Client({ connectionString: ADMIN })
  await menage.connect()
  try {
    // ⚠️ La base d’abord : un rôle ne se supprime pas tant qu’une base porte
    //    des dépendances vers lui.
    await menage.query(`drop database if exists "${NOM_BASE}" with (force)`)
    await menage.query(`drop role if exists "${NOM_ROLE}"`)
  } finally {
    await menage.end()
  }
}, 60_000)

describe('le rôle de service est bien séparé du propriétaire', () => {
  it('n’est ni superutilisateur, ni propriétaire d’aucune table', async () => {
    const { rows } = await service.query(`
      select
        current_user::text as role,
        coalesce((select rolsuper from pg_roles where rolname = current_user), false) as superutilisateur,
        pg_has_role(current_user, 'feedys_app', 'member') as membre,
        pg_has_role(current_user, 'feedys_app', 'usage') as herite,
        count(*) filter (where pg_has_role(current_user, c.relowner, 'member')) as possedees,
        count(*) as tables
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
    `)

    const etat = rows[0]!

    expect(etat['role']).toBe(NOM_ROLE)
    expect(etat['superutilisateur']).toBe(false)
    expect(etat['membre']).toBe(true)
    // ⛔ ET SURTOUT : il HÉRITE. `membre` seul est vrai d’un rôle NOINHERIT,
    //    qui ne peut pourtant rien lire — voir le bloc dédié plus bas.
    expect(etat['herite']).toBe(true)
    // ⛔ LE POINT DE TOUT L’EXERCICE : zéro table possédée. Un propriétaire —
    //    ou un membre du propriétaire — contournerait tous les GRANT.
    expect(Number(etat['possedees'])).toBe(0)
    expect(Number(etat['tables'])).toBeGreaterThan(0)
  })
})

describe('ce que le rôle de service peut, et ne peut pas', () => {
  it('lit et écrit les tables métier', async () => {
    const { rows } = await service.query('select count(*)::int as n from retours')
    expect(rows[0]?.['n']).toBe(1)

    await service.query(`update retours set zone = 'Liste des dossiers' where id = 'ret_role'`)
  })

  it('⛔ ne peut pas SUPPRIMER dans retours', async () => {
    expect(await refuse(service, 'delete from retours')).toBe(PRIVILEGE_INSUFFISANT)
  })

  it('⛔ ne peut pas toucher à la zone gelée — audit est append-only', async () => {
    expect(await refuse(service, `update audit set action = 'bidon'`)).toBe(PRIVILEGE_INSUFFISANT)
    expect(await refuse(service, 'delete from audit')).toBe(PRIVILEGE_INSUFFISANT)
  })

  it('peut AJOUTER une ligne d’audit — c’est tout l’intérêt d’un journal', async () => {
    await service.query(
      `insert into audit (id, retour_id, acteur, action)
       values ('aud_role_2', 'ret_role', 'systeme', 'cloture_balayage')`,
    )

    const { rows } = await service.query(
      `select count(*)::int as n from audit where retour_id = 'ret_role'`,
    )
    expect(rows[0]?.['n']).toBe(2)
  })

  it('⛔ ne peut supprimer dans AUCUNE des sept tables', async () => {
    for (const table of [
      'produits',
      'retours',
      'messages',
      'contextes',
      'syntheses',
      'notifications',
      'audit',
    ]) {
      expect(await refuse(service, `delete from ${table}`)).toBe(PRIVILEGE_INSUFFISANT)
    }
  })
})

describe('la sonde /sante, sous le rôle de service', () => {
  /**
   * ⚠️ CE TEST EXISTE À CAUSE D’UN MODE DE DÉFAILLANCE QUI NE SE VOYAIT QU’EN
   *    PRODUCTION. La table `migrations` n’est créée par aucune migration : le
   *    runner la pose lui-même, elle appartient donc au propriétaire, et elle
   *    ne portait aucun GRANT.
   *
   * ⛔ `GET /sante` la lit AVEC LE POOL DE SERVICE. Sans `0003`, le passage au
   *    rôle membre faisait rendre 503 à la sonde, le `HEALTHCHECK` de l’image
   *    échouait, et le conteneur redémarrait en boucle — au moment précis où
   *    l’on croyait avoir durci le déploiement.
   */
  it('peut lire le registre des migrations', async () => {
    const { rows } = await service.query('select nom, sha256 from migrations order by nom')

    expect(rows.length).toBeGreaterThan(0)
    expect(rows[0]?.['nom']).toBe('0001_socle.sql')
  })

  it('⛔ ne peut pas RÉÉCRIRE le registre', async () => {
    expect(await refuse(service, `update migrations set sha256 = 'bidon'`)).toBe(
      PRIVILEGE_INSUFFISANT,
    )
  })
})

describe('les migrations sous le rôle de service', () => {
  /**
   * ⚠️ MESURÉ, PAS SUPPOSÉ. On pouvait croire qu’une base déjà à jour passerait :
   *    le runner commence par un `create table if not exists`, et « if not
   *    exists » suggère un court-circuit. Postgres vérifie en réalité le
   *    privilège `CREATE` sur le schéma AVANT de regarder si la table existe.
   *
   * ⛔ Le rôle de service ne peut donc PAS migrer, jamais. C’est le bon
   *    comportement — et c’est ce qui rend `DATABASE_URL_MIGRATIONS`
   *    OBLIGATOIRE dès qu’on sépare les rôles, pas seulement utile.
   */
  it('⛔ sont refusées, même quand la base est déjà à jour', async () => {
    // ⚠️ DISCRIMINANT, ET PAS SEULEMENT `/permission denied/`. Si `0003` était
    //    annulée, le runner passerait le `create table if not exists` puis
    //    échouerait sur `select nom, sha256 from migrations` — « permission
    //    denied for TABLE migrations ». Le test serait resté vert en prétendant
    //    prouver autre chose.
    //
    // ⛔ Ce qu’on vient chercher est précis : le refus sur le SCHÉMA, qui est ce
    //    qui rend `DATABASE_URL_MIGRATIONS` obligatoire et pas seulement utile.
    const erreur = await appliquerMigrations(service, DOSSIER_MIGRATIONS).then(
      () => undefined,
      (raison: unknown) => raison as { code?: string; message?: string },
    )

    expect(erreur?.code).toBe(PRIVILEGE_INSUFFISANT)
    expect(erreur?.message).toMatch(/for schema public/i)
  })

  it('⚠️ et le propriétaire, lui, passe sans rien faire', async () => {
    const { appliquees, deja } = await appliquerMigrations(proprietaire, DOSSIER_MIGRATIONS)

    expect(appliquees).toEqual([])
    expect(deja.length).toBeGreaterThan(0)
  })
})

/**
 * ⛔ LA FAUTE QUE LE CONTRÔLE DE DÉMARRAGE NE VOYAIT PAS.
 *
 * ⚠️ `hebergement.md` insiste depuis toujours sur le `inherit` explicite du rôle
 *    de service. Un rôle créé sans lui — `noinherit`, ou simplement le défaut
 *    d’une installation qui le pose ainsi — EST membre de `feedys_app` :
 *    `pg_has_role(…, 'member')` répond `true`. Et il ne peut RIEN lire, faute
 *    d’un `set role` à chaque connexion.
 *
 * ⛔ Le démarrage annonçait donc « membre de feedys_app… Les GRANT s’appliquent »
 *    sur un rôle à qui Postgres refuse un simple `select`. Le contrôle censé
 *    attraper cette faute passait exactement à côté d’elle.
 *
 * C’est `pg_has_role(…, 'usage')` qui répond à la bonne question — et c’est ce
 * bloc qui le prouve, sur un vrai rôle et une vraie connexion.
 */
describe('⛔ un rôle NOINHERIT : membre du groupe, et incapable de lire', () => {
  const NOM_SANS_HERITAGE = `feedys_service_essai_${SUFFIXE}_ni`
  let sansHeritage: Client

  beforeAll(async () => {
    await proprietaire.query(
      `create role "${NOM_SANS_HERITAGE}" login password '${MOT_DE_PASSE}' noinherit in role feedys_app`,
    )

    const u = new URL(ADMIN)
    u.pathname = `/${NOM_BASE}`
    u.username = NOM_SANS_HERITAGE
    u.password = MOT_DE_PASSE

    sansHeritage = new Client({ connectionString: u.toString() })
    await sansHeritage.connect()
  }, 60_000)

  afterAll(async () => {
    await sansHeritage?.end().catch(() => undefined)
    await proprietaire?.query(`drop role if exists "${NOM_SANS_HERITAGE}"`).catch(() => undefined)
  }, 60_000)

  it('⚠️ « membre » dit OUI, « usage » dit NON — et c’est « usage » qui a raison', async () => {
    const { rows } = await sansHeritage.query(`
      select
        pg_has_role(current_user, 'feedys_app', 'member') as membre,
        pg_has_role(current_user, 'feedys_app', 'usage') as herite
    `)

    expect(rows[0]?.['membre']).toBe(true)
    expect(rows[0]?.['herite']).toBe(false)
  })

  it('⛔ et Postgres lui refuse un simple SELECT', async () => {
    expect(await refuse(sansHeritage, 'select count(*) from retours')).toBe(PRIVILEGE_INSUFFISANT)
  })

  /**
   * ⛔ LA REQUÊTE DE PRODUCTION, IMPORTÉE — pas recopiée. La recopier aurait
   *    donné un test qui reste vert le jour où `ETAT_ROLE` repasse à `'member'`,
   *    c’est-à-dire un test qui ne garde rien.
   */
  it('⛔ le verdict du démarrage dit « pas séparé », au lieu de rassurer', async () => {
    const { rows } = await sansHeritage.query(ETAT_ROLE)

    const ligne = rows[0]!
    const verdict = verdictRole({
      role: String(ligne['role']),
      superutilisateur: ligne['superutilisateur'] === true,
      heriteDuGroupe: ligne['herite'] === true,
      tablesPossedees: Number(ligne['possedees']),
      tables: Number(ligne['tables']),
    })

    expect(verdict).toMatchObject({ separe: false, motif: 'sans_heritage' })
    expect(messageRole(verdict)).toContain('NOINHERIT')
  })
})

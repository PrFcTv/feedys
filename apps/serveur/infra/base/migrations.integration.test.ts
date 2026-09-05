/**
 * La migration, contre un vrai Postgres.
 *
 * Chaque bloc travaille sur SA base, créée vierge et détruite à la fin : une
 * migration « à blanc » qui tournerait sur une base déjà peuplée ne prouverait
 * rien.
 *
 * Il faut un Postgres joignable : `docker compose up -d postgres`, et
 * DATABASE_URL renseignée (.env.local sur le poste, service `postgres` en CI).
 */
import { spawnSync } from 'node:child_process'
import { cp, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { DivergenceError, appliquerMigrations } from './migrations'
import { urlBaseDessai } from '../../../../tests/base-dessai'

const ICI = path.dirname(fileURLToPath(import.meta.url))
const RACINE = path.resolve(ICI, '../../../..')
const DOSSIER_MIGRATIONS = path.join(RACINE, 'db', 'migrations')

const ADMIN =
  urlBaseDessai()

const TABLES_METIER = [
  'produits',
  'retours',
  'messages',
  'contextes',
  'syntheses',
  'notifications',
  'audit',
] as const

const ENUMS = [
  'canal_notification',
  'confiance_synthese',
  'role_message',
  'source_retour',
  'statut_retour',
  'type_retour',
] as const

const INDEX = [
  'messages_retour_ordre_idx',
  'produits_cle_publique_uniq',
  'retours_produit_statut_cree_idx',
  'retours_produit_type_cree_idx',
] as const

/** Le code SQLSTATE d’un refus de privilège. */
const PRIVILEGE_INSUFFISANT = '42501'
/** Le code SQLSTATE d’une clé étrangère violée. */
const CLE_ETRANGERE = '23503'

function urlAvecBase(url: string, nom: string): string {
  const u = new URL(url)
  u.pathname = `/${nom}`
  return u.toString()
}

/** Une base vierge, jetable, au nom improbable. */
async function baseJetable(): Promise<{ nom: string; client: Client; fermer: () => Promise<void> }> {
  const nom = `feedys_essai_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

  const admin = new Client({ connectionString: ADMIN })
  await admin.connect()
  await admin.query(`create database "${nom}"`)
  await admin.end()

  const client = new Client({ connectionString: urlAvecBase(ADMIN, nom) })
  await client.connect()

  return {
    nom,
    client,
    fermer: async () => {
      await client.end()
      const menage = new Client({ connectionString: ADMIN })
      await menage.connect()
      await menage.query(`drop database if exists "${nom}" with (force)`)
      await menage.end()
    },
  }
}

function codeSql(erreur: unknown): string | undefined {
  return typeof erreur === 'object' && erreur !== null && 'code' in erreur
    ? String((erreur as { code: unknown }).code)
    : undefined
}

async function refuse(client: Client, sql: string): Promise<string | undefined> {
  try {
    await client.query(sql)
    return undefined
  } catch (erreur) {
    return codeSql(erreur)
  }
}

// ─────────────────────────────────────────────────────────────────────────────

describe('le socle, appliqué sur une base vierge', () => {
  let base: Awaited<ReturnType<typeof baseJetable>>

  beforeAll(async () => {
    base = await baseJetable()
  }, 60_000)

  afterAll(async () => {
    await base?.fermer()
  }, 60_000)

  it('applique les migrations du dépôt, dans l’ordre des noms', async () => {
    const resultat = await appliquerMigrations(base.client, DOSSIER_MIGRATIONS)

    expect(resultat.appliquees).toEqual(['0001_socle.sql', '0002_identite.sql'])
    expect(resultat.deja).toEqual([])
  })

  it('crée les sept tables métier, et rien d’autre que le registre en plus', async () => {
    const { rows } = await base.client.query<{ table_name: string }>(
      `select table_name from information_schema.tables
       where table_schema = 'public' and table_type = 'BASE TABLE'
       order by table_name`,
    )
    const noms = rows.map((r) => r.table_name)

    for (const table of TABLES_METIER) {
      expect(noms).toContain(table)
    }

    // Le registre appartient au runner, pas à la migration.
    expect(noms.filter((n) => !TABLES_METIER.includes(n as (typeof TABLES_METIER)[number]))).toEqual(
      ['migrations'],
    )
  })

  it('crée les six enums, avec leurs valeurs — ⛔ ni priorité, ni sévérité, ni score', async () => {
    const { rows } = await base.client.query<{ nom: string; valeurs: string[] }>(
      `select t.typname as nom, array_agg(e.enumlabel::text order by e.enumsortorder) as valeurs
       from pg_type t
       join pg_enum e on e.enumtypid = t.oid
       join pg_namespace n on n.oid = t.typnamespace
       where n.nspname = 'public'
       group by t.typname
       order by t.typname`,
    )

    expect(rows.map((r) => r.nom)).toEqual([...ENUMS])

    const parNom = new Map(rows.map((r) => [r.nom, r.valeurs]))
    expect(parNom.get('statut_retour')).toEqual([
      'en_cours',
      'abandonne',
      'envoye',
      'lu',
      'traite',
      'ecarte',
    ])
    expect(parNom.get('type_retour')).toEqual(['bug', 'idee', 'question', 'gene'])
    expect(parNom.get('source_retour')).toEqual(['voix', 'texte'])
  })

  it('crée les quatre index qui comptent', async () => {
    const { rows } = await base.client.query<{ indexname: string }>(
      `select indexname from pg_indexes
       where schemaname = 'public' and indexname = any($1::text[])
       order by indexname`,
      [[...INDEX]],
    )

    expect(rows.map((r) => r.indexname)).toEqual([...INDEX])
  })

  it('⛔ n’installe aucune clé étrangère en cascade', async () => {
    const { rows } = await base.client.query<{ conname: string; confdeltype: string }>(
      `select conname, confdeltype from pg_constraint where contype = 'f'`,
    )

    expect(rows.length).toBeGreaterThan(0)
    // 'a' = NO ACTION. 'c' serait CASCADE.
    expect(rows.every((r) => r.confdeltype === 'a')).toBe(true)
  })

  it('rejoué, ne fait rien et ne casse rien', async () => {
    const resultat = await appliquerMigrations(base.client, DOSSIER_MIGRATIONS)

    expect(resultat.appliquees).toEqual([])
    expect(resultat.deja).toEqual(['0001_socle.sql', '0002_identite.sql'])

    const { rows } = await base.client.query<{ nom: string }>('select nom from migrations')
    expect(rows).toHaveLength(2)

    const { rows: tables } = await base.client.query<{ n: string }>(
      `select count(*)::text as n from information_schema.tables
       where table_schema = 'public' and table_type = 'BASE TABLE'`,
    )
    expect(tables[0]?.n).toBe('8')
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('les privilèges du rôle applicatif', () => {
  let base: Awaited<ReturnType<typeof baseJetable>>

  beforeAll(async () => {
    base = await baseJetable()
    await appliquerMigrations(base.client, DOSSIER_MIGRATIONS)

    // Un jeu d’essai écrit à la main. ⛔ Jamais un retour réel : un vrai retour
    // dicté contient des noms de personnes.
    await base.client.query(
      `insert into produits (id, nom, domaine, cle_publique, secret_hash)
       values ('prd_essai', 'Produit d''essai', 'exemple.fr', 'fdy_pub_essai', 'argon2$factice')`,
    )
    await base.client.query(
      `insert into retours (id, produit_id, source) values ('ret_essai', 'prd_essai', 'texte')`,
    )
    await base.client.query(
      `insert into messages (id, retour_id, ordre, role, texte)
       values ('msg_essai', 'ret_essai', 0, 'collaborateur', 'Le tri de la colonne date se réinitialise.')`,
    )

    // ⚠️ SET ROLE vers un rôle non superutilisateur fait vraiment tomber les
    //    privilèges : c’est ce qui rend les assertions suivantes probantes.
    await base.client.query('set role feedys_app')
  }, 60_000)

  afterAll(async () => {
    await base?.client.query('reset role')
    await base?.fermer()
  }, 60_000)

  it('peut lire et écrire les tables métier', async () => {
    const { rows } = await base.client.query<{ n: string }>(
      `select count(*)::text as n from retours`,
    )
    expect(rows[0]?.n).toBe('1')

    // Une étiquette se corrige à la main — c’est prévu.
    await expect(
      base.client.query(`update retours set zone = 'Dossiers' where id = 'ret_essai'`),
    ).resolves.toBeDefined()
  })

  it('⛔ ne peut SUPPRIMER dans aucune table — aucun GRANT DELETE n’est accordé', async () => {
    for (const table of TABLES_METIER) {
      expect(await refuse(base.client, `delete from ${table}`)).toBe(PRIVILEGE_INSUFFISANT)
    }
  })

  it('⛔ ne peut pas toucher à la zone gelée : audit est append-only', async () => {
    expect(await refuse(base.client, `update audit set action = 'bidon'`)).toBe(
      PRIVILEGE_INSUFFISANT,
    )
    expect(await refuse(base.client, 'delete from audit')).toBe(PRIVILEGE_INSUFFISANT)
  })

  it('peut ajouter une ligne d’audit — lire et ajouter, rien d’autre', async () => {
    await base.client.query(
      `insert into audit (id, retour_id, acteur, action, detail)
       values ('aud_essai', 'ret_essai', 'developpeur', 'statut_change', '{"de":"en_cours","vers":"lu"}')`,
    )

    const { rows } = await base.client.query<{ action: string }>('select action from audit')
    expect(rows.map((r) => r.action)).toEqual(['statut_change'])
  })

  it('refuse un acteur d’audit inconnu, et un statut de notification inconnu', async () => {
    expect(
      await refuse(
        base.client,
        `insert into audit (id, retour_id, acteur, action)
         values ('aud_faux', 'ret_essai', 'inconnu', 'x')`,
      ),
    ).toBe('23514') // check_violation

    expect(
      await refuse(
        base.client,
        `insert into notifications (id, retour_id, destinataire, statut)
         values ('ntf_faux', 'ret_essai', 'dev@exemple.fr', 'peut_etre')`,
      ),
    ).toBe('23514')
  })

  it('ne peut pas inventer un retour rattaché à rien', async () => {
    expect(
      await refuse(
        base.client,
        `insert into retours (id, produit_id, source) values ('ret_orphelin', 'prd_fantome', 'voix')`,
      ),
    ).toBe(CLE_ETRANGERE)
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('la divergence entre la base et le dépôt', () => {
  let base: Awaited<ReturnType<typeof baseJetable>>
  let copie: string

  beforeAll(async () => {
    base = await baseJetable()
    copie = await mkdtemp(path.join(tmpdir(), 'feedys-migrations-'))
    await cp(DOSSIER_MIGRATIONS, copie, { recursive: true })
  }, 60_000)

  afterAll(async () => {
    await base?.fermer()
  }, 60_000)

  it('arrête tout quand un octet a bougé dans une migration déjà appliquée', async () => {
    await appliquerMigrations(base.client, copie)

    const fichier = path.join(copie, '0001_socle.sql')
    const avant = await readFile(fichier, 'utf8')
    await writeFile(fichier, `${avant} `, 'utf8') // un octet, et un seul

    await expect(appliquerMigrations(base.client, copie)).rejects.toThrow(DivergenceError)
    await expect(appliquerMigrations(base.client, copie)).rejects.toThrow(
      /La base et le dépôt ont divergé/,
    )

    // ⚠️ Et rien n’a été touché au passage.
    const { rows } = await base.client.query<{ n: string }>(
      `select count(*)::text as n from migrations`,
    )
    expect(rows[0]?.n).toBe('2')
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('prisma/schema.prisma, le miroir', () => {
  let base: Awaited<ReturnType<typeof baseJetable>>

  beforeAll(async () => {
    base = await baseJetable()
    await appliquerMigrations(base.client, DOSSIER_MIGRATIONS)
  }, 60_000)

  afterAll(async () => {
    await base?.fermer()
  }, 60_000)

  it('dit exactement ce que le SQL a fait — sinon il ment', () => {
    // ⚠️ `migrate diff` LIT, il n’applique rien : ⛔ `prisma migrate` reste
    //    interdit pour produire ou poser une migration (conventions-db.md).
    //    --exit-code : 0 si le diff est vide, 2 s’il ne l’est pas.
    // Commande littérale, sans interpolation : rien d’extérieur n’entre dans le shell.
    const diff = spawnSync(
      'pnpm exec prisma migrate diff --from-schema prisma/schema.prisma' +
        ' --to-config-datasource --exit-code --script',
      {
        cwd: RACINE,
        encoding: 'utf8',
        shell: true,
        env: { ...process.env, DATABASE_URL: urlAvecBase(ADMIN, base.nom) },
      },
    )

    expect(`${diff.stdout ?? ''}${diff.stderr ?? ''}`).toContain('empty migration')
    expect(diff.status).toBe(0)
  }, 120_000)
})

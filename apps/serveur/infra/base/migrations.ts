/**
 * Le runner de migrations.
 *
 * `db/migrations/*.sql` est la source de vérité du schéma. Ce module lit ce
 * dossier, applique ce qui manque en transaction, et enregistre le sha256 de
 * chaque fichier appliqué.
 *
 * ⛔ `prisma migrate` n’est jamais utilisé : `prisma/schema.prisma` est un miroir
 *    tenu à la main. 04-Architecture/conventions-db.md.
 *
 * ⚠️ Le contrôle des empreintes n’est pas un confort. Une migration déjà
 *    appliquée qu’on rééditerait produirait deux bases différentes portant le
 *    même numéro — celle des postes de développement et celle de production —
 *    sans que rien ne le signale. D’où l’arrêt au démarrage.
 *
 * La décision (`planifier`) est séparée de l’effet (`appliquer`) : la première
 * est pure et se teste sans Postgres, la seconde a besoin d’une vraie base.
 */
import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

/** Une migration telle qu’elle est sur le disque. */
export interface MigrationFichier {
  readonly nom: string
  readonly sha256: string
  readonly sql: string
}

/** Une ligne du registre, telle qu’elle est en base. */
export interface MigrationAppliquee {
  readonly nom: string
  readonly sha256: string
}

/**
 * Le port vers la base. Un `pg.Client` le satisfait tel quel.
 *
 * ⚠️ Une CONNEXION, pas un pool : le verrou d’avis est lié à la session, et un
 *    pool le poserait sur une connexion pour le relâcher sur une autre.
 */
export interface ConnexionBase {
  query(texte: string, valeurs?: readonly unknown[]): Promise<{ rows: Record<string, unknown>[] }>
}

/**
 * ⛔ La base et le dépôt ont divergé. Rien ne sera appliqué, et le serveur ne
 *    doit pas servir : 04-Architecture/hebergement.md §Le démarrage.
 */
export class DivergenceError extends Error {
  override readonly name = 'DivergenceError'

  constructor(detail: string) {
    super(`La base et le dépôt ont divergé — ${detail}`)
  }
}

/** Le registre des migrations appliquées. Créé par le runner, pas par une migration. */
const TABLE_REGISTRE = 'migrations'

/**
 * La clé du verrou d’avis. Arbitraire, mais stable : deux conteneurs qui
 * démarrent ensemble ne doivent pas appliquer la même migration deux fois.
 */
const CLE_VERROU = 405_197_026

const EXTENSION = '.sql'

export function empreinte(sql: string): string {
  return createHash('sha256').update(sql, 'utf8').digest('hex')
}

/** Lit le dossier de migrations, dans l’ordre des noms de fichiers. */
export async function lireMigrations(dossier: string): Promise<MigrationFichier[]> {
  const entrees = await readdir(dossier, { withFileTypes: true })

  const noms = entrees
    .filter((e) => e.isFile() && e.name.endsWith(EXTENSION))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b, 'en'))

  return Promise.all(
    noms.map(async (nom) => {
      const sql = await readFile(path.join(dossier, nom), 'utf8')
      return { nom, sha256: empreinte(sql), sql }
    }),
  )
}

/**
 * Décide ce qui reste à appliquer, ou refuse.
 *
 * Trois formes de divergence, et chacune casse une garantie différente :
 *   1. un fichier appliqué a changé      → la base et le dépôt ne décrivent plus le même schéma ;
 *   2. un fichier appliqué a disparu     → on ne sait plus ce que la base contient ;
 *   3. un fichier neuf s’insère AVANT un fichier appliqué → l’ordre a changé sous nos pieds.
 *
 * ⛔ Fonction pure. Elle ne touche ni au disque ni à la base.
 */
export function planifier(
  fichiers: readonly MigrationFichier[],
  registre: readonly MigrationAppliquee[],
): MigrationFichier[] {
  const parNom = new Map(fichiers.map((f) => [f.nom, f]))

  for (const applique of registre) {
    const fichier = parNom.get(applique.nom)

    if (!fichier) {
      throw new DivergenceError(
        `« ${applique.nom} » est appliquée en base mais absente du dépôt. ` +
          'Une migration appliquée ne se supprime pas.',
      )
    }

    if (fichier.sha256 !== applique.sha256) {
      throw new DivergenceError(
        `« ${applique.nom} » a changé depuis son application ` +
          `(base ${applique.sha256.slice(0, 12)}…, dépôt ${fichier.sha256.slice(0, 12)}…). ` +
          'Une migration appliquée ne se réécrit pas, commentaires compris : ' +
          'pour changer quelque chose, une migration de plus.',
      )
    }
  }

  const appliques = new Set(registre.map((m) => m.nom))
  const dernierApplique = [...appliques].sort((a, b) => a.localeCompare(b, 'en')).at(-1)

  const aAppliquer = fichiers.filter((f) => !appliques.has(f.nom))

  if (dernierApplique !== undefined) {
    const intercalee = aAppliquer.find((f) => f.nom.localeCompare(dernierApplique, 'en') < 0)

    if (intercalee) {
      throw new DivergenceError(
        `« ${intercalee.nom} » n’est pas appliquée alors que « ${dernierApplique} », ` +
          'qui vient après elle, l’est. L’ordre du dépôt et celui de la base ne ' +
          'sont plus les mêmes.',
      )
    }
  }

  return aAppliquer
}

export interface ResultatMigration {
  readonly appliquees: string[]
  readonly deja: string[]
}

/**
 * Applique ce qui manque. Chaque migration part dans SA transaction, avec sa
 * ligne de registre : une migration qui échoue ne laisse aucune trace.
 */
export async function appliquerMigrations(
  connexion: ConnexionBase,
  dossier: string,
): Promise<ResultatMigration> {
  await connexion.query(`
    create table if not exists ${TABLE_REGISTRE} (
      nom          text         primary key,
      sha256       text         not null,
      applique_le  timestamptz  not null default now()
    )
  `)

  await connexion.query('select pg_advisory_lock($1)', [CLE_VERROU])

  try {
    const { rows } = await connexion.query(`select nom, sha256 from ${TABLE_REGISTRE} order by nom`)

    const registre: MigrationAppliquee[] = rows.map((r) => ({
      nom: String(r['nom']),
      sha256: String(r['sha256']),
    }))

    const fichiers = await lireMigrations(dossier)
    const aAppliquer = planifier(fichiers, registre)

    for (const migration of aAppliquer) {
      await connexion.query('begin')
      try {
        await connexion.query(migration.sql)
        await connexion.query(
          `insert into ${TABLE_REGISTRE} (nom, sha256) values ($1, $2)`,
          [migration.nom, migration.sha256],
        )
        await connexion.query('commit')
      } catch (erreur) {
        await connexion.query('rollback')
        throw new Error(`La migration « ${migration.nom} » a échoué.`, { cause: erreur })
      }
    }

    return {
      appliquees: aAppliquer.map((m) => m.nom),
      deja: registre.map((m) => m.nom),
    }
  } finally {
    await connexion.query('select pg_advisory_unlock($1)', [CLE_VERROU])
  }
}

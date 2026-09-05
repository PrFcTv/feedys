/**
 * L’URL de la base contre laquelle les tests d’intégration travaillent.
 *
 * ⛔ IL N’Y A PAS DE VALEUR PAR DÉFAUT, ET C’EST TOUT L’INTÉRÊT DE CE FICHIER.
 *
 * Chaque test d’intégration portait la même ligne :
 *
 *     process.env['DATABASE_URL'] ?? 'postgresql://feedys:feedys@localhost:5432/feedys'
 *
 * Or vitest ne charge aucun `.env.local` : le repli s’appliquait donc **à tous
 * les coups** sur un poste, et visait `localhost:5432` — c’est-à-dire le
 * premier Postgres venu. Sur le poste où le défaut a été trouvé, c’était celui
 * d’un AUTRE projet. Ces tests créent et suppriment des bases : ils ne l’ont pas
 * fait uniquement parce que le mot de passe ne concordait pas
 * (03-Bugs/BUGS_LOG.md 006).
 *
 * ⚠️ Un repli silencieux vers un hôte qu’on ne contrôle pas est pire qu’une
 *    variable absente : l’absence se voit, le repli travaille.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Charge le `.env.local` de la racine, s’il existe.
 *
 * ⚠️ Appelé par `setupFiles` de `vitest.integration.config.ts`, donc AVANT que
 *    le moindre test lise l’environnement. En CI il n’y a pas de fichier : les
 *    variables viennent du service `postgres` du workflow.
 */
export function chargerEnvLocal(): void {
  try {
    process.loadEnvFile(path.join(RACINE, '.env.local'))
  } catch {
    // Pas de fichier : les variables viennent de l’environnement.
  }
}

/**
 * ⛔ Échoue franchement plutôt que de deviner un hôte.
 *
 * Le message dit quoi faire, parce qu’un test d’intégration qui refuse de
 * démarrer sans expliquer se contourne au lieu de se réparer.
 */
export function urlBaseDessai(): string {
  const url = process.env['DATABASE_URL']?.trim()
  if (url !== undefined && url !== '') return url

  throw new Error(
    'DATABASE_URL est absente — les tests d’intégration ne devinent pas de base.\n' +
      'Sur un poste : renseignez-la dans .env.local à la racine, puis\n' +
      '  docker compose up -d postgres && pnpm db:migrate\n' +
      '⚠️ Le port n’est pas forcément 5432 : FEEDYS_PORT_PG en décide, et un autre\n' +
      '   projet occupe souvent le 5432. En CI, c’est le service postgres du workflow.',
  )
}

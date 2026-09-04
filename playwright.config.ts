import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig, devices } from '@playwright/test'

/**
 * Les parcours de bout en bout.
 *
 * ⚠️ Ils tournent contre une base DÉDIÉE (`feedys_e2e`), créée, migrée et semée
 *    par `tests/e2e/preparer.ts`. ⛔ Jamais contre la base de développement : un
 *    parcours qui écrit doit pouvoir écrire sans détruire ce qu’on regardait.
 *
 * ⛔ **Une erreur de console fait échouer le parcours.** C’est une règle du
 *    projet, pas une option : la console du navigateur est un résultat de test
 *    (04-Architecture/DESIGN.md §Ce qui vaut pour les deux). Le garde-fou est
 *    posé dans chaque fichier de parcours.
 */
const RACINE = path.dirname(fileURLToPath(import.meta.url))

/** ⚠️ Pas 3000 : le `pnpm dev` de quelqu’un ne doit pas être écrasé par un test. */
export const PORT = 3100
/**
 * ⚠️ `localhost` et non `127.0.0.1` : Next 16 bloque ses ressources de
 *    développement pour les origines qu’il ne reconnaît pas.
 */
export const ORIGINE = `http://localhost:${PORT}`

export const BASE_E2E = 'feedys_e2e'

/** ⛔ Inventé, et sans valeur hors de ce test. Le dépôt est public. */
export const MOT_DE_PASSE_E2E = 'e2e-mot-de-passe-de-test'

export const ADMIN_E2E =
  process.env['DATABASE_URL'] ?? 'postgresql://feedys:feedys@localhost:5432/feedys'

export function urlBaseE2E(): string {
  const url = new URL(ADMIN_E2E)
  url.pathname = `/${BASE_E2E}`
  return url.toString()
}

export default defineConfig({
  testDir: path.join(RACINE, 'tests', 'e2e'),
  globalSetup: path.join(RACINE, 'tests', 'e2e', 'preparer.ts'),
  fullyParallel: false,
  workers: 1,
  reporter: process.env['CI'] ? 'list' : [['list']],
  timeout: 30_000,

  use: {
    baseURL: ORIGINE,
    trace: 'retain-on-failure',
    locale: 'fr-FR',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: {
    // ⚠️ `next dev` plutôt que `build` + `start` : le parcours démarre en
    //    quelques secondes au lieu d’une minute, et les erreurs de rendu
    //    remontent en console — ce qu’on veut justement voir échouer.
    //
    // ⛔ Le widget est construit d’abord, et ce n’est pas une commodité :
    //    `tests/e2e/actifs.spec.ts` mesure `/widget.js` TEL QU’IL EST SERVI
    //    (03-Bugs/BUGS_LOG.md 001). Sans le bundle, la route rend 503 et le
    //    parcours ne mesurerait rien du tout.
    command: `pnpm --filter @feedys/widget build && pnpm --filter @feedys/serveur exec next dev --port ${PORT}`,
    url: ORIGINE,
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
    env: {
      DATABASE_URL: urlBaseE2E(),
      FEEDYS_BO_MOT_DE_PASSE: MOT_DE_PASSE_E2E,
      FEEDYS_URL_PUBLIQUE: ORIGINE,
      // ⚠️ Exigée par la composition, jamais appelée ici : le back-office ne
      //    parle pas au modèle.
      FEEDYS_MODELE: 'bouchon-e2e',
    },
  },
})

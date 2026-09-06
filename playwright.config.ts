import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig, devices } from '@playwright/test'
import { chargerEnvLocal, urlBaseDessai } from './tests/base-dessai'

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

/**
 * La fausse application hôte de `pnpm widget:demo`, servie à côté.
 *
 * ⚠️ C’est LE SEUL endroit où le widget est testé rendu dans la page de
 *    quelqu’un d’autre — le reste des parcours ne voit que `/widget.js` en tant
 *    qu’actif HTTP. T-003 dit que ça ne remplace pas un hôte réel, et c’est vrai.
 */
/**
 * ⚠️ PAS 4321, ET C’EST LA MÊME PRÉCAUTION QUE POUR LE PORT 3100 CI-DESSUS.
 *    4321 est le port par défaut de `packages/widget/demo/serveur.ts`. Avec
 *    `reuseExistingServer`, un développeur qui a `pnpm widget:demo` ouvert à
 *    côté — le geste que CLAUDE.md §Le widget ne se recette pas chez lui
 *    encourage — voyait Playwright RÉUTILISER SON SERVEUR, lequel pointe sur
 *    `http://localhost:3000` et donc sur la base de DÉVELOPPEMENT. Un parcours
 *    y aurait écrit un retour, ce que l’en-tête de ce fichier interdit.
 */
export const PORT_DEMO = 4331
export const ORIGINE_DEMO = `http://localhost:${PORT_DEMO}`

/**
 * ⛔ Inventée, sans valeur hors de ce test. Le produit qui la porte est semé par
 *    `preparer.ts` avec `domaine = 'localhost'` — `origineAutorisee` ignore le
 *    port et le schéma, seul le nom d’hôte compte.
 */
export const CLE_DEMO_E2E = 'fdy_pub_demo_e2e'

/** ⛔ Inventé, et sans valeur hors de ce test. Le dépôt est public. */
export const MOT_DE_PASSE_E2E = 'e2e-mot-de-passe-de-test'

/** ⛔ Inventée, et sans valeur nulle part : aucune requête ne part avec. */
export const CLE_MODELE_E2E = 'cle-de-parcours-jamais-envoyee'

/**
 * L’origine du modèle pendant les parcours.
 *
 * ⛔ LE PORT 9 EST SUR LA LISTE DES « BAD PORTS » DU WHATWG : `fetch` le refuse
 *    d’emblée, sans ouvrir de socket. Aucun paquet ne quitte la machine, quoi
 *    qu’il tourne dessus, sur n’importe quel système — c’est plus fort qu’un
 *    port simplement libre, qui dépend de ce qui écoute.
 *
 * ⚠️ Le tour rend donc 503 par un échec LOCAL et identique partout : sur le
 *    poste comme en CI, avec ou sans `.env.local`.
 */
export const ORIGINE_MODELE_MORTE = 'http://127.0.0.1:9'

/**
 * ⛔ Aucun repli : `urlBaseDessai()` échoue franchement si `DATABASE_URL` est
 *    absente, plutôt que de viser le premier Postgres venu
 *    (03-Bugs/BUGS_LOG.md 006).
 */
chargerEnvLocal()

export const ADMIN_E2E = urlBaseDessai()

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

  webServer: [
    {
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
      // ⚠️ Exigée par la composition, et volontairement invalide : le tour
      //    d’entretien échoue donc en 503, l’état dégradé que
      //    `widget-demo.spec.ts` recette.
      FEEDYS_MODELE: 'bouchon-e2e',
      // ⛔ ET L’ÉCHEC DOIT SE PRODUIRE SANS SORTIR DE LA MACHINE.
      //
      // ⚠️ « bouchon-e2e » laissait croire à une doublure locale. Il n’en est
      //    rien : le fournisseur envoyait pour de bon une requête AUTHENTIFIÉE
      //    à api.anthropic.com, avec la clé du poste lue dans `.env.local`, et
      //    le 404 rapportait `anthropic-organization-id` et
      //    `anthropic-workspace-id` dans les journaux du serveur.
      //
      // ⛔ PIRE QUE LA FUITE : le test passait par DEUX MÉCANISMES DIFFÉRENTS
      //    selon la machine. Le job e2e de la CI n’a aucune `ANTHROPIC_API_KEY`
      //    — l’échec y venait du SDK, jamais du réseau. Un parcours qui est vert
      //    pour deux raisons différentes ne recette ni l’une ni l’autre.
      ANTHROPIC_API_KEY: CLE_MODELE_E2E,
      ANTHROPIC_BASE_URL: ORIGINE_MODELE_MORTE,
    },
    },
    {
      // La fausse application hôte — volontairement hostile (CSS agressif,
      // reset global, une modale à z-index 9999).
      //
      // ⚠️ Elle charge `widget.js` DEPUIS le serveur Feedys ci-dessus, sur un
      //    AUTRE PORT : c’est la seule façon de voir le widget comme un hôte le
      //    voit — deux origines, CORS compris.
      command: `pnpm exec tsx packages/widget/demo/serveur.ts`,
      url: ORIGINE_DEMO,
      reuseExistingServer: !process.env['CI'],
      timeout: 120_000,
      env: {
        PORT: String(PORT_DEMO),
        FEEDYS_URL: ORIGINE,
        FEEDYS_CLE_DEMO: CLE_DEMO_E2E,
      },
    },
  ],
})

import { defineConfig } from 'vitest/config'

/**
 * Les tests d’intégration : ils ont besoin d’un vrai Postgres.
 *
 *   docker compose up -d postgres
 *   pnpm test:integration
 *
 * ⚠️ Ils tournent en série : chacun crée et détruit sa propre base.
 *
 * ⛔ `setupFiles` charge le `.env.local` de la racine AVANT le premier test.
 *    Sans lui, vitest ne voyait aucune variable et chaque fichier se rabattait
 *    sur `localhost:5432` — le premier Postgres venu, celui d’un autre projet
 *    le cas échéant, alors que ces tests créent et suppriment des bases
 *    (03-Bugs/BUGS_LOG.md 006).
 */
export default defineConfig({
  test: {
    setupFiles: ['tests/env-integration.ts'],
    include: ['apps/*/**/*.integration.test.ts', 'packages/*/**/*.integration.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/.turbo/**'],
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
})

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: [
      'tests/**/*.test.ts',
      'apps/*/**/*.test.{ts,tsx}',
      'packages/*/**/*.test.{ts,tsx}',
    ],
    // ⛔ Les tests unitaires sont purs : sans base, hors ligne. Ceux qui ont
    //    besoin d’un Postgres portent .integration et vivent dans
    //    vitest.integration.config.ts.
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/*.integration.test.ts',
    ],
  },
})

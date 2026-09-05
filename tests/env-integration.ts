/**
 * Chargé par `setupFiles` de `vitest.integration.config.ts`, avant tout test.
 *
 * ⚠️ vitest ne lit aucun `.env.local` de lui-même. Sur un poste, c’est ce
 *    fichier qui apporte `DATABASE_URL` ; en CI, il ne trouve rien et les
 *    variables viennent du workflow. Dans les deux cas, `urlBaseDessai()`
 *    tranche ensuite — et refuse de deviner (03-Bugs/BUGS_LOG.md 006).
 */
import { chargerEnvLocal } from './base-dessai'

chargerEnvLocal()

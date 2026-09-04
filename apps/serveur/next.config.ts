import type { NextConfig } from 'next'

/**
 * ⚠️ `standalone` : Next produit un serveur autonome avec les seules
 *    dépendances réellement atteintes. C’est ce qui permet à l’image de
 *    production de ne porter ni `pnpm`, ni le dépôt, ni 600 Mo de
 *    `node_modules` (04-Architecture/hebergement.md).
 *
 * ⚠️ `outputFileTracingRoot` : le monorepo. Sans lui, Next remonte trop haut ou
 *    pas assez pour tracer les fichiers d’un workspace pnpm, et l’image sort
 *    avec des dépendances manquantes — une erreur qui ne se voit qu’à
 *    l’exécution.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

const config: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: RACINE,
}

export default config

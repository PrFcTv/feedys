/**
 * La lecture de la ligne de commande des outils.
 *
 * ⚠️ Extraite de l’outil lui-même pour être testable : importer un script qui
 *    se lance à l’import ouvrirait une connexion à Postgres au milieu d’un test
 *    unitaire.
 */
import { parseArgs } from 'node:util'

export const USAGE_PRODUIT =
  'Usage : pnpm produit:creer -- --nom "VictorIA" --domaine victoria.exemple.fr'

/**
 * ⚠️ `pnpm produit:creer -- --nom …` transmet le `--` tel quel dans `argv`, et
 *    `parseArgs` le prend pour un argument positionnel. On le retire d’abord —
 *    la forme documentée dans 05-Prompts/MVP.md doit marcher telle quelle.
 */
export function lireArgumentsProduit(argv: readonly string[]): { nom: string; domaine: string } {
  const args = [...argv]
  while (args[0] === '--') args.shift()

  const { values } = parseArgs({
    args,
    options: {
      nom: { type: 'string' },
      domaine: { type: 'string' },
    },
  })

  const nom = values.nom?.trim()
  const domaine = values.domaine?.trim()

  if (!nom || !domaine) throw new Error(USAGE_PRODUIT)

  return { nom, domaine }
}

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

export const USAGE_REJOUER =
  'Usage : pnpm entretien:rejouer -- --retour <id> [--modele <id>] [--prompt] [--synthese]'

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

/**
 * ⚠️ `--prompt` imprime le prompt système assemblé plutôt que de le deviner.
 *    C’est la moitié de l’outil : quand une question est mauvaise, la première
 *    chose à regarder est ce que le modèle a réellement lu.
 *
 * ⚠️ `--synthese` rejoue la NOTE plutôt que les questions. Le prompt de la
 *    synthèse se met au point exactement pareil — et c’est lui qui produit le
 *    livrable, donc celui qu’on relit le plus.
 */
export function lireArgumentsRejouer(argv: readonly string[]): {
  retour: string
  modele: string | undefined
  prompt: boolean
  synthese: boolean
} {
  const args = [...argv]
  while (args[0] === '--') args.shift()

  const { values } = parseArgs({
    args,
    options: {
      retour: { type: 'string' },
      modele: { type: 'string' },
      prompt: { type: 'boolean' },
      synthese: { type: 'boolean' },
    },
  })

  const retour = values.retour?.trim()
  if (!retour) throw new Error(USAGE_REJOUER)

  return {
    retour,
    modele: values.modele?.trim() || undefined,
    prompt: values.prompt === true,
    synthese: values.synthese === true,
  }
}

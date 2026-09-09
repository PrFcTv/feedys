/**
 * La lecture de la ligne de commande des outils.
 *
 * ⚠️ Extraite de l’outil lui-même pour être testable : importer un script qui
 *    se lance à l’import ouvrirait une connexion à Postgres au milieu d’un test
 *    unitaire.
 */
import { parseArgs } from 'node:util'

export const USAGE_PRODUIT =
  'Usage : pnpm produit:creer -- --nom "VictorIA" --domaine victoria.exemple.fr ' +
  '[--metier "Contexte métier"] [--forge https://github.com/org/depot] ' +
  '[--observabilite "https://outil.exemple.fr/recherche?q={{ref}}"]'

/**
 * ⛔ `--forge` doit être une URL https, et on le dit MAINTENANT plutôt que de
 *    l’accepter puis de ne jamais composer le moindre lien : un correctif dont
 *    le SHA n’est pas cliquable a l’air d’un défaut d’affichage, et on
 *    chercherait le bug ailleurs.
 */
export const USAGE_FORGE =
  '--forge attend l’URL https du dépôt, par exemple https://github.com/org/depot. ' +
  'Elle ne sert qu’à rendre un SHA de correctif cliquable — Feedys ne l’appelle jamais.'

/**
 * ⛔ `--observabilite` doit être une URL https ET porter la marque `{{ref}}`,
 *    et les deux sont refusés MAINTENANT pour la même raison que `--forge` :
 *    un gabarit sans marque produirait un lien qui n’est pas nul mais qui
 *    n’emmène nulle part, et ce lien-là ment. On préfère refuser à la création
 *    qu’afficher plus tard une référence cliquable vers une page vide.
 *
 * ⚠️ Un gabarit et non un préfixe : les outils d’observabilité ne s’accordent
 *    sur aucune forme d’URL — Sentry veut `/issues/?query=<ref>`, un
 *    agrégateur de journaux veut la référence dans une recherche.
 */
export const USAGE_OBSERVABILITE =
  '--observabilite attend une URL https portant la marque {{ref}}, par exemple ' +
  'https://sentry.io/organizations/org/issues/?query={{ref}}. Elle ne sert qu’à rendre ' +
  'cliquable la référence d’un indice — Feedys n’appelle jamais cet outil.'

export const USAGE_REJOUER =
  'Usage : pnpm entretien:rejouer -- --retour <id> [--modele <id>] [--prompt] [--synthese]'

/**
 * ⚠️ `pnpm produit:creer -- --nom …` transmet le `--` tel quel dans `argv`, et
 *    `parseArgs` le prend pour un argument positionnel. On le retire d’abord —
 *    la forme documentée dans 05-Prompts/MVP.md doit marcher telle quelle.
 */
export function lireArgumentsProduit(argv: readonly string[]): {
  nom: string
  domaine: string
  metier?: string
  forge?: string
  observabilite?: string
} {
  const args = [...argv]
  while (args[0] === '--') args.shift()

  const { values } = parseArgs({
    args,
    options: {
      nom: { type: 'string' },
      domaine: { type: 'string' },
      metier: { type: 'string' },
      forge: { type: 'string' },
      observabilite: { type: 'string' },
    },
  })

  const nom = values.nom?.trim()
  const domaine = values.domaine?.trim()
  const metier = values.metier?.trim() || undefined
  const forge = values.forge?.trim() || undefined
  const observabilite = values.observabilite?.trim() || undefined

  if (!nom || !domaine) throw new Error(USAGE_PRODUIT)
  if (forge !== undefined && !forge.startsWith('https://')) throw new Error(USAGE_FORGE)
  if (
    observabilite !== undefined &&
    (!observabilite.startsWith('https://') || !observabilite.includes('{{ref}}'))
  ) {
    throw new Error(USAGE_OBSERVABILITE)
  }

  return {
    nom,
    domaine,
    ...(metier ? { metier } : {}),
    ...(forge ? { forge } : {}),
    ...(observabilite ? { observabilite } : {}),
  }
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

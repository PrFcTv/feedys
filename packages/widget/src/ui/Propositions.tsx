/**
 * Les réponses d’un clic, sous la question.
 *
 * ⛔ CE N’EST PAS UN CHOIX OBLIGATOIRE, et tout ici en découle. Pas de
 *    `role="radiogroup"`, pas d’état sélectionné, pas de bouton « Autre », pas
 *    de bouton « valider ». Trois raccourcis, posés à côté du micro et du champ
 *    texte qui restent au même niveau de visibilité (CLAUDE.md §La parole
 *    d’abord, mais jamais la parole seulement).
 *
 * ⛔ ET SURTOUT : ces libellés sont ÉCRITS DANS LE DÉPÔT, jamais rendus par le
 *    modèle ([D-025](../../../../00-Projet/DECISIONS_LOG.md)). Le modèle a
 *    déclaré un axe ; les mots sont de nous. C’est ce qui empêche sa prose
 *    d’entrer dans le fil en ligne `collaborateur`, puis dans les citations de
 *    la note ([BUGS_LOG](../../../../03-Bugs/BUGS_LOG.md) 016).
 *
 * ⚠️ Un clic ENVOIE le tour. Pas de sélection à confirmer : deux clics
 *    supprimeraient le seul bénéfice de l’affaire — répondre en une seconde.
 */
import type { Axe, ValeurAxe } from '../contrat'

import { PROPOSITIONS, PROPOSITIONS_LIBELLE } from './textes'

export interface ProprietesPropositions {
  readonly axe: Axe
  /** ⚠️ Envoie le tour immédiatement. Le parent y joint le texte en cours. */
  readonly surReponse: (axe: Axe, valeur: ValeurAxe) => void
  /** ⚠️ Pendant qu’un tour est en vol, on ne reclique pas. */
  readonly fige?: boolean
}

export function Propositions({ axe, surReponse, fige = false }: ProprietesPropositions) {
  const choix = PROPOSITIONS[axe]

  return (
    <div class="propositions" role="group" aria-label={PROPOSITIONS_LIBELLE}>
      {choix.map((proposition) => (
        <button
          key={proposition.valeur}
          class="proposition"
          type="button"
          disabled={fige}
          onClick={() => {
            surReponse(axe, proposition.valeur)
          }}
        >
          {proposition.libelle}
        </button>
      ))}
    </div>
  )
}

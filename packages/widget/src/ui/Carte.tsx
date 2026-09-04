/**
 * La carte de compréhension.
 *
 * ⛔ CE N’EST PAS UN MESSAGE DE CHAT. C’est une fiche dont chaque champ se
 *    corrige sur place. Corriger une carte coûte un clic sur le champ faux ;
 *    corriger une phrase oblige à RÉEXPLIQUER, c’est-à-dire à refaire l’effort
 *    qu’on venait de fournir. C’est toute la différence entre « non, c’est
 *    l’écran d’à côté » et un deuxième paragraphe dicté (01-Specs/entretien.md).
 *
 * ⛔ ELLE N’A PAS DE BOUTON « VALIDER ». On corrige, ça part avec le tour
 *    suivant ou avec l’envoi. Un bouton de validation ferait croire qu’on
 *    remplit un formulaire — l’exact contraire du message
 *    (04-Architecture/DESIGN.md §La carte de compréhension).
 *
 * ⚠️ Les champs sont des contrôles NATIFS, éditables en permanence, stylés pour
 *    ressembler à du texte tant qu’on ne les touche pas. Pas de mode « lecture »
 *    puis « édition » : un mode de plus, c’est un clic de plus, et c’est
 *    exactement le coût que la carte existe pour supprimer. Au clavier, la
 *    tabulation traverse la carte comme n’importe quel formulaire.
 */
import type { Comprehension } from '../contrat'
import { LIBELLES_RECURRENCE, LIBELLES_TYPE } from '../entretien'

export interface ProprietesCarte {
  readonly valeurs: Comprehension
  readonly surCorrection: (valeurs: Comprehension) => void
  /** ⚠️ Pendant l’envoi, on n’édite plus — mais on voit toujours ce qui part. */
  readonly fige?: boolean
}

/** ⚠️ « (non précisé) » et pas « — » : un tiret ne dit pas qu’on peut écrire là. */
const RECURRENCE_ABSENTE = '(non précisé)'

export function Carte({ valeurs, surCorrection, fige = false }: ProprietesCarte) {
  const corriger = <C extends keyof Comprehension>(champ: C, valeur: Comprehension[C]): void => {
    surCorrection({ ...valeurs, [champ]: valeur })
  }

  return (
    <div class="carte">
      <p class="carte__entete">Ce que j’ai compris</p>

      <label class="carte__champ">
        <span class="carte__libelle">Type</span>
        <select
          class="carte__valeur carte__choix"
          disabled={fige}
          value={valeurs.type}
          onChange={(evenement) => {
            corriger('type', evenement.currentTarget.value as Comprehension['type'])
          }}
        >
          {Object.entries(LIBELLES_TYPE).map(([valeur, libelle]) => (
            <option key={valeur} value={valeur}>
              {libelle}
            </option>
          ))}
        </select>
      </label>

      <label class="carte__champ">
        <span class="carte__libelle">Titre</span>
        <textarea
          class="carte__valeur carte__titre"
          rows={2}
          disabled={fige}
          value={valeurs.titre}
          onInput={(evenement) => {
            corriger('titre', evenement.currentTarget.value)
          }}
        />
      </label>

      <label class="carte__champ">
        <span class="carte__libelle">Résumé</span>
        <textarea
          class="carte__valeur"
          rows={3}
          disabled={fige}
          value={valeurs.resume}
          onInput={(evenement) => {
            corriger('resume', evenement.currentTarget.value)
          }}
        />
      </label>

      {/* ⚠️ L’écran est DÉDUIT du contexte, jamais demandé. Il est montré ici
            parce que montrer ce qu’on a collecté rend la collecte visible plutôt
            que subie (01-Specs/widget.md §Ce que le widget joint tout seul). */}
      <label class="carte__champ">
        <span class="carte__libelle">Écran</span>
        <input
          class="carte__valeur"
          type="text"
          disabled={fige}
          value={valeurs.ecran ?? ''}
          onInput={(evenement) => {
            corriger('ecran', evenement.currentTarget.value)
          }}
        />
      </label>

      <label class="carte__champ">
        <span class="carte__libelle">Depuis</span>
        <select
          class="carte__valeur carte__choix"
          disabled={fige}
          value={valeurs.recurrence ?? ''}
          onChange={(evenement) => {
            const choix = evenement.currentTarget.value
            corriger('recurrence', choix === '' ? undefined : (choix as Comprehension['recurrence']))
          }}
        >
          <option value="">{RECURRENCE_ABSENTE}</option>
          {Object.entries(LIBELLES_RECURRENCE).map(([valeur, libelle]) => (
            <option key={valeur} value={valeur}>
              {libelle}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}

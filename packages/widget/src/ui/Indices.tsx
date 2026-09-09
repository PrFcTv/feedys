/**
 * Ce que le navigateur a relevé — montré, et décochable.
 *
 * ⛔ CE COMPOSANT EST LA CONTREPARTIE DU RELEVÉ, PAS SA DÉCORATION. Le principe
 *    de 01-Specs/widget.md §Ce que le widget joint tout seul est que la collecte
 *    se voit — « la carte de compréhension affiche l’écran déduit, ce qui rend
 *    la collecte visible plutôt que subie ». Un relevé d’erreurs joint sans être
 *    montré serait l’inverse exact : le widget saurait de la personne quelque
 *    chose qu’elle ne sait pas. C’est ce qui rend le défaut « actif »
 *    défendable ([D-026](../../../../00-Projet/DECISIONS_LOG.md)).
 *
 * ⚠️ ET IL Y A UN GAIN QU’ON N’ATTENDAIT PAS. Lire « une erreur technique a été
 *    relevée » dit à quelqu’un que **ce n’est pas sa faute**. Dans un logiciel
 *    métier, où l’on soupçonne d’abord d’avoir mal cliqué, c’est un moment réel.
 *
 * ⛔ IL NE DIAGNOSTIQUE RIEN. Ni « voici la cause », ni « erreur 500 sur les
 *    factures ». Il énumère ce qui part, en mots neutres, et s’arrête là — la
 *    règle 4 de l’entretien vaut aussi pour l’interface (01-Specs/entretien.md).
 */
import type { IndiceContexte } from '../contrat'

import { INDICES } from './textes'

export interface ProprietesIndices {
  readonly indices: readonly IndiceContexte[]
  /** ⚠️ Décoché, rien ne part. L’état vit chez `Widget`, pas ici. */
  readonly joints: boolean
  readonly surBascule: (joints: boolean) => void
  readonly deplie: boolean
  readonly surDeplier: (deplie: boolean) => void
  /** Pendant un envoi, on ne change plus d’avis. */
  readonly fige?: boolean
}

/**
 * Une ligne d’indice, en mots.
 *
 * ⚠️ `ecartMs` devient « il y a 2 min » : c’est **l’information la plus utile de
 *    la ligne**. Trois secondes avant, c’est presque sûrement lié ; deux heures
 *    avant, c’est du décor — et c’est au lecteur d’en juger, pas à un seuil.
 */
export function decrire(indice: IndiceContexte): string {
  const quand = depuis(indice.ecartMs)

  if (indice.genre === 'http') {
    const methode = indice.methode ? `${indice.methode} ` : ''
    return `${INDICES.reseau} ${indice.statut} · ${methode}${indice.chemin ?? ''}${quand}`
  }

  return `${indice.nom ?? INDICES.exception}${indice.trame ? ` · ${indice.trame}` : ''}${quand}`
}

/** ⚠️ Approximatif et assumé : « il y a 2 min » suffit, la seconde ne dit rien. */
function depuis(ecartMs: number | undefined): string {
  if (ecartMs === undefined) return ''

  const secondes = Math.round(ecartMs / 1000)
  if (secondes < 60) return ` — ${INDICES.ilYA} ${secondes} s`

  const minutes = Math.round(secondes / 60)
  if (minutes < 60) return ` — ${INDICES.ilYA} ${minutes} min`

  return ` — ${INDICES.ilYA} ${Math.round(minutes / 60)} h`
}

export function Indices({
  indices,
  joints,
  surBascule,
  deplie,
  surDeplier,
  fige,
}: ProprietesIndices) {
  if (indices.length === 0) return null

  return (
    <div class="indices">
      <div class="indices__entete">
        {/*
          ⚠️ Une vraie case à cocher, pas un bouton stylé : elle est annoncée
             comme cochée ou non par un lecteur d’écran, et elle se coche à la
             barre d’espace sans qu’on ait rien à écrire.
        */}
        <label class="indices__bascule">
          <input
            type="checkbox"
            checked={joints}
            disabled={fige}
            onChange={(evenement) => surBascule((evenement.target as HTMLInputElement).checked)}
          />
          <span>{INDICES.resume(indices.length)}</span>
        </label>

        <button
          class="indices__voir"
          type="button"
          onClick={() => surDeplier(!deplie)}
          aria-expanded={deplie}
        >
          {deplie ? INDICES.masquer : INDICES.voir}
        </button>
      </div>

      {deplie && (
        // ⛔ CE QUI EST AFFICHÉ EST EXACTEMENT CE QUI PART. Pas un résumé, pas un
        //    échantillon : la personne doit pouvoir vérifier, sinon « voir » ne
        //    veut rien dire.
        <ul class="indices__liste">
          {indices.map((indice, rang) => (
            <li key={rang} class="indices__ligne">
              {decrire(indice)}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

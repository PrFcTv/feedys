/**
 * Le fil de l’entretien, tel qu’il s’est déroulé.
 *
 * ⛔ IL N’EST JAMAIS REPLIÉ. Pas de « voir les détails », pas d’accordéon, pas de
 *    « afficher les 4 messages restants ». La synthèse est une LECTURE ; le fil
 *    est la SOURCE. Cacher la source revient à décider que la reformulation du
 *    modèle vaut mieux que la parole d’origine
 *    (04-Architecture/DESIGN.md §La règle qui gouverne la fiche).
 *
 * ⛔ Et il n’est pas modifiable. Aucun champ, aucun bouton : le texte d’un
 *    message ne se modifie jamais et ne se supprime jamais
 *    (04-Architecture/conventions-db.md §Ce qu’on n’efface pas).
 */
import type { TourFiche } from '../../infra/base/depot-bo'

export function Fil({ fil }: { fil: readonly TourFiche[] }) {
  if (fil.length === 0) {
    return (
      <p className="text-sm text-encre-3 italic">
        Le fil est vide — le retour a été ouvert puis refermé sans un mot.
      </p>
    )
  }

  return (
    <ol className="flex flex-col gap-3">
      {fil.map((tour) => (
        <li
          key={tour.ordre}
          className={
            tour.role === 'bot'
              ? 'max-w-[42rem] rounded-[var(--radius-bo)] bg-surface-2 px-3.5 py-2.5'
              : 'max-w-[42rem] rounded-[var(--radius-bo)] border border-bord bg-surface px-3.5 py-2.5'
          }
        >
          <p className="text-[12px] font-medium tracking-wide text-encre-3 uppercase">
            {tour.role === 'bot' ? 'le bot' : 'le collaborateur'}
          </p>
          <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap text-encre">
            {tour.texte}
          </p>

          {/* ⚠️ Le transcript AVANT correction, quand il diffère : on garde les
              hésitations, elles portent du sens (conventions-db.md §messages). */}
          {tour.transcriptBrut !== null && tour.transcriptBrut !== tour.texte ? (
            <p className="mt-2 border-l-2 border-bord-fort pl-2.5 font-mono text-[12px] leading-relaxed whitespace-pre-wrap text-encre-3">
              {tour.transcriptBrut}
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  )
}

/**
 * La note, en tête de fiche.
 *
 * ⛔ Les VERBATIMS ont un traitement typographique distinct — mono, retrait,
 *    filet à gauche. Ce sont des PIÈCES, pas de la prose : le lecteur doit voir
 *    au premier coup d’œil ce que la personne a dit et ce que le modèle en a
 *    fait (04-Architecture/DESIGN.md §Les verbatims).
 *
 * ⛔ Rien n’est modifiable ici. Ni le résumé, ni les citations. Ce qui se corrige
 *    — le type et la zone — a son propre formulaire.
 */
import { LIBELLES_TYPE } from '../../domaine/backoffice/filtres'
import type { Synthese } from '../../domaine/synthese/schema'
import { PastilleConfiance, PastilleType } from '../pastille'

const IMPACTS: Record<Synthese['impact'], string> = {
  bloque: 'bloque',
  ralentit: 'ralentit',
  agace: 'agace',
  indetermine: 'impact indéterminé',
}

const RECURRENCES: Record<NonNullable<Synthese['recurrence']>, string> = {
  premiere_fois: 'première fois',
  deja_vu: 'déjà vu',
  systematique: 'systématique',
}

function Champ({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-28 shrink-0 text-[13px] text-encre-3">{libelle}</dt>
      <dd className="text-sm text-encre">{valeur}</dd>
    </div>
  )
}

export function BlocSynthese({ synthese }: { synthese: Synthese }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <PastilleType type={synthese.type} />
        <span className="text-[13px] text-encre-3">{IMPACTS[synthese.impact]}</span>
        <PastilleConfiance confiance={synthese.confiance} />
      </div>

      <p className="max-w-prose text-[15px] leading-relaxed text-encre">{synthese.resume}</p>

      <dl className="flex flex-col gap-1.5">
        {synthese.attendu ? <Champ libelle="Attendu" valeur={synthese.attendu} /> : null}
        {synthese.constate ? <Champ libelle="Constaté" valeur={synthese.constate} /> : null}
        {synthese.recurrence ? (
          <Champ libelle="Récurrence" valeur={RECURRENCES[synthese.recurrence]} />
        ) : null}
        {synthese.besoin ? <Champ libelle="Besoin" valeur={synthese.besoin} /> : null}
        {synthese.frequence ? <Champ libelle="Fréquence" valeur={synthese.frequence} /> : null}
      </dl>

      {synthese.citations.length > 0 ? (
        <div>
          <h3 className="text-[12px] font-medium tracking-wide text-encre-3 uppercase">
            Ce qu’elle a dit
          </h3>
          <ul className="mt-2 flex flex-col gap-2">
            {synthese.citations.map((citation) => (
              <li
                key={citation}
                /* ⛔ Mono, retrait, filet. Une citation n’est pas une phrase du
                   rédacteur : c’est une pièce, et ça doit se voir. */
                className="border-l-2 border-accent pl-3 font-mono text-[13px] leading-relaxed text-encre"
              >
                « {citation} »
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* ⚠️ Une liste vide est un SIGNAL, pas un défaut : elle veut dire que
          l’entretien a suffi. On n’affiche donc pas de rubrique vide. */}
      {synthese.questions_ouvertes.length > 0 ? (
        <div>
          <h3 className="text-[12px] font-medium tracking-wide text-encre-3 uppercase">
            Ce qu’on ne sait pas
          </h3>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm text-encre-2">
            {synthese.questions_ouvertes.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}

export function SansSynthese({ type }: { type: string | null }) {
  return (
    <p className="max-w-prose text-sm leading-relaxed text-encre-2">
      Ce retour n’a pas de note. La synthèse a échoué, ou l’entretien s’est refermé sans un mot —
      ⚠️ <strong className="font-medium text-encre">rien n’est perdu pour autant</strong> : la parole
      est en base depuis l’ingestion, et le fil ci-dessous est intact. La note est rejouable avec{' '}
      <code className="font-mono text-[13px]">pnpm entretien:rejouer</code>.
      {type === null ? '' : ` Le type actuel est « ${LIBELLES_TYPE[type as 'bug'] ?? type} ».`}
    </p>
  )
}

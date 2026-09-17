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
import type { ReactNode } from 'react'

import { dateComplete } from '../../domaine/backoffice/dates'
import { LIBELLES_TYPE } from '../../domaine/backoffice/filtres'
import type { Synthese } from '../../domaine/synthese/schema'
import type { SuiviNoteFiche } from '../../infra/base/depot-bo'
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

/**
 * La fiche d’un retour sans note — et ce qu’il y a à faire.
 *
 * ⛔ Elle ne renvoie plus à `pnpm entretien:rejouer` : cet outil n’écrit rien, et
 *    il n’existe pas dans l’image de production (BUGS_LOG 019). Ce qui marche
 *    partout, c’est le bouton qu’elle porte.
 *
 * ⚠️ Quatre situations, qui ne demandent pas le même geste. Le bouton n’est pas
 *    proposé quand il ne peut que refuser : un entretien en cours, un fil sans
 *    parole.
 */
export function SansSynthese({
  type,
  statut,
  suivi,
  fuseau,
  bouton,
}: {
  type: string | null
  statut: string
  suivi: SuiviNoteFiche
  fuseau: string | null | undefined
  bouton: ReactNode
}) {
  const intact = (
    <>
      ⚠️ <strong className="font-medium text-encre">Rien n’est perdu pour autant</strong> : la
      parole est en base depuis l’ingestion, et le fil ci-dessous est intact.
    </>
  )
  const derniere = suivi.repriseLe ? ` — la dernière le ${dateComplete(suivi.repriseLe, fuseau)}` : ''

  let texte: ReactNode
  let proposerBouton = true

  if (statut === 'en_cours') {
    texte = <>L’entretien est encore en cours : la note sera rédigée à sa fin.</>
    proposerBouton = false
  } else if (suivi.etat === 'sans_parole') {
    texte = (
      <>
        Il n’y a rien à synthétiser : le fil ne contient aucune parole écrite. Un retour dicté dont
        le transcript n’est pas arrivé ne produira pas de note. Le fil ci-dessous est intact.
      </>
    )
    proposerBouton = false
  } else if (suivi.etat === 'impossible') {
    texte = (
      <>
        Le modèle n’a pas répondu, et le filet a renoncé après {suivi.reprises ?? 0} reprise(s)
        {suivi.impossibleLe ? `, le ${dateComplete(suivi.impossibleLe, fuseau)}` : ''}. {intact}{' '}
        Refaites la note quand le modèle répond de nouveau.
      </>
    )
  } else if (suivi.etat === 'en_reprise') {
    texte = (
      <>
        La synthèse a échoué, et le filet la redemande tout seul : {suivi.reprises} reprise(s)
        {derniere}. {intact} Vous pouvez aussi la refaire maintenant.
      </>
    )
  } else {
    texte = (
      <>
        Ce retour n’a pas encore de note. La synthèse a échoué ou n’a pas eu lieu — le filet la
        redemandera dans quelques minutes. {intact}
      </>
    )
  }

  return (
    <div>
      <p className="max-w-prose text-sm leading-relaxed text-encre-2">
        {texte}
        {type === null ? '' : ` Le type actuel est « ${LIBELLES_TYPE[type as 'bug'] ?? type} ».`}
      </p>
      {proposerBouton ? bouton : null}
    </div>
  )
}

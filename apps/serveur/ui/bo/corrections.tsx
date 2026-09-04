'use client'

/**
 * Les deux corrections : le statut, et les étiquettes (type + zone).
 *
 * ⛔ TROIS CHAMPS, ET PAS UN DE PLUS. Il n’y a ici aucun champ pour le résumé,
 *    les citations ou le fil — et le refus ne repose pas sur cette absence : le
 *    serveur refuse tout champ hors liste, schéma strict à l’appui
 *    (domaine/backoffice/correction.ts). L’interface est une commodité ; le
 *    verrou est ailleurs.
 *
 * ⚠️ `useActionState` : le refus du serveur revient DANS la page, à côté du
 *    bouton. Un refus qui n’arrive qu’en console n’est pas un refus lisible.
 */
import { useActionState } from 'react'

import type { StatutALaMain } from '../../domaine/backoffice/correction'
import { STATUTS_A_LA_MAIN } from '../../domaine/backoffice/correction'
import type { TypeRetour } from '../../domaine/backoffice/filtres'
import { LIBELLES_STATUT, LIBELLES_TYPE, TYPES } from '../../domaine/backoffice/filtres'
import { Bouton } from '../bouton'
import { ChampSelect } from '../select'

export type Issue = { readonly ok: true } | { readonly ok: false; readonly message: string }

type Action = (etat: Issue | null, donnees: FormData) => Promise<Issue>

function Refus({ issue }: { issue: Issue | null }) {
  if (issue === null || issue.ok) return null

  return (
    <p role="alert" className="text-[13px] text-signal">
      {issue.message}
    </p>
  )
}

export function FormulaireStatut({
  action,
  statut,
}: {
  action: Action
  statut: string
}) {
  const [issue, envoyer, enCours] = useActionState<Issue | null, FormData>(action, null)

  const courant = (STATUTS_A_LA_MAIN as readonly string[]).includes(statut)
    ? (statut as StatutALaMain)
    : undefined

  return (
    <form action={envoyer} className="flex flex-wrap items-end gap-3">
      <ChampSelect
        nom="statut"
        etiquette="Statut"
        valeur={courant}
        parDefaut="lu"
        options={STATUTS_A_LA_MAIN.map((valeur) => ({
          valeur,
          libelle: LIBELLES_STATUT[valeur],
        }))}
      />
      <Bouton type="submit" ton="contour" disabled={enCours}>
        Changer le statut
      </Bouton>
      <Refus issue={issue} />
    </form>
  )
}

export function FormulaireEtiquettes({
  action,
  type,
  zone,
}: {
  action: Action
  type: TypeRetour | null
  zone: string | null
}) {
  const [issue, envoyer, enCours] = useActionState<Issue | null, FormData>(action, null)

  return (
    <form action={envoyer} className="flex flex-wrap items-end gap-3">
      <ChampSelect
        nom="type"
        etiquette="Type"
        valeur={type ?? undefined}
        parDefaut="bug"
        options={TYPES.map((valeur) => ({ valeur, libelle: LIBELLES_TYPE[valeur] }))}
      />

      <label className="flex flex-col gap-1">
        <span className="text-[12px] font-medium tracking-wide text-encre-3 uppercase">Zone</span>
        <input
          name="zone"
          defaultValue={zone ?? ''}
          maxLength={200}
          placeholder="Liste des dossiers"
          className="h-9 w-56 rounded-[var(--radius-bo)] border border-bord-fort bg-surface px-2.5 text-sm text-encre"
        />
      </label>

      <Bouton type="submit" ton="contour" disabled={enCours}>
        Corriger l’étiquette
      </Bouton>
      <Refus issue={issue} />
    </form>
  )
}

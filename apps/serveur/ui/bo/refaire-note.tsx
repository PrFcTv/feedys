'use client'

/**
 * « Refaire la note » — le rattrapage à la main (P-030).
 *
 * ⚠️ `useActionState` : ce que le serveur répond revient DANS la fiche, à côté
 *    du bouton, comme pour les corrections. Un refus qui n’arrive qu’en console
 *    n’est pas un refus lisible.
 *
 * ⚠️ Le modèle peut mettre une minute : le bouton se désactive et dit qu’il
 *    travaille, pour qu’on ne clique pas trois fois.
 */
import { useActionState } from 'react'

import { Bouton } from '../bouton'

import type { Issue } from './corrections'

type Action = (etat: Issue | null, donnees: FormData) => Promise<Issue>

export function BoutonRefaireNote({ action }: { action: Action }) {
  const [issue, envoyer, enCours] = useActionState<Issue | null, FormData>(action, null)

  return (
    <form action={envoyer} className="mt-4 flex flex-wrap items-center gap-3">
      <Bouton type="submit" ton="contour" disabled={enCours}>
        {enCours ? 'Le modèle rédige la note…' : 'Refaire la note'}
      </Bouton>
      {issue === null ? null : issue.ok ? (
        <p role="status" className="text-[13px] text-encre-2">
          La note est écrite.
        </p>
      ) : (
        <p role="alert" className="text-[13px] text-signal">
          {issue.message}
        </p>
      )}
    </form>
  )
}

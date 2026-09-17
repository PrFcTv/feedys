'use client'

/**
 * « Envoyer un message d’essai » — la ligne de la liste d’installation qui se
 * coche sur un téléphone (04-Architecture/hebergement.md §Installer chez un
 * client).
 *
 * ⚠️ Il marche DANS L’IMAGE : ni `pnpm`, ni `curl` à taper sur le VPS du client.
 * ⛔ Ce qu’il affiche en cas d’échec est déjà nettoyé : le jeton n’y est pas.
 */
import { useActionState } from 'react'

import { Bouton } from '../bouton'

type IssueEssai = { readonly ok: true } | { readonly ok: false; readonly raison: string }

export function EssaiTelegram({ action }: { action: () => Promise<IssueEssai> }) {
  const [issue, envoyer, enCours] = useActionState<IssueEssai | null, FormData>(
    () => action(),
    null,
  )

  return (
    <form action={envoyer} className="flex flex-wrap items-center gap-3">
      <Bouton type="submit" ton="contour" disabled={enCours}>
        {enCours ? 'Envoi…' : 'Envoyer un message d’essai'}
      </Bouton>
      {issue === null ? null : issue.ok ? (
        <p role="status" className="text-[13px] text-encre-2">
          Parti. Il doit être arrivé dans la conversation du bot.
        </p>
      ) : (
        <p role="alert" className="text-[13px] text-signal">
          {issue.raison}
        </p>
      )}
    </form>
  )
}

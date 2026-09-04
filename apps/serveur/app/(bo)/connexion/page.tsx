/**
 * La connexion — une personne, un mot de passe.
 *
 * ⛔ Pas d’inscription, pas de « mot de passe oublié », pas de rôles. Le lecteur
 *    est une seule personne, connue (05-Prompts/MVP.md §P-010).
 *
 * ⚠️ Le message d’échec est le même quelle que soit la cause — mot de passe faux
 *    ou back-office non configuré. Distinguer les deux dirait à un visiteur si
 *    l’instance a un mot de passe, ce qui ne l’aide en rien et aide qui insiste.
 */
import { redirect } from 'next/navigation'

import { ouvrirSession, sessionOuverte } from '../../../infra/backoffice/garde'
import { motDePasseValide } from '../../../infra/backoffice/session'
import { Bouton } from '../../../ui/bouton'

async function seConnecter(donnees: FormData): Promise<void> {
  'use server'

  const saisi = String(donnees.get('mot_de_passe') ?? '')

  if (!motDePasseValide(saisi) || !(await ouvrirSession())) redirect('/connexion?refus=1')

  redirect('/bo')
}

export default async function Connexion({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  if (await sessionOuverte()) redirect('/bo')

  const refuse = (await searchParams)['refus'] !== undefined

  return (
    <div className="mx-auto max-w-sm py-16">
      <h1 className="font-titre text-xl text-encre">Le back-office</h1>
      <p className="mt-1 text-sm text-encre-2">
        Les retours que les collaborateurs ont dictés. Un seul lecteur, un seul mot de passe.
      </p>

      <form action={seConnecter} className="mt-6 flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium tracking-wide text-encre-3 uppercase">
            Mot de passe
          </span>
          <input
            type="password"
            name="mot_de_passe"
            autoComplete="current-password"
            required
            autoFocus
            className="h-9 rounded-[var(--radius-bo)] border border-bord-fort bg-surface px-2.5 text-sm text-encre"
          />
        </label>

        {refuse ? (
          <p role="alert" className="text-sm text-signal">
            Ce mot de passe ne convient pas.
          </p>
        ) : null}

        <Bouton type="submit">Entrer</Bouton>
      </form>
    </div>
  )
}

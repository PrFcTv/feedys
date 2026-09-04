/**
 * La coquille du back-office — en-tête, contenu, pied de page.
 *
 * ⛔ Le pied de page porte le LIEN VERS LA SOURCE et la VERSION DÉPLOYÉE. C’est
 *    l’obligation de l’article 13 de l’AGPL — quiconque interagit avec le
 *    service à travers un réseau a droit à la source de la version qui tourne —
 *    et c’est deux lignes.
 */
import Link from 'next/link'
import type { ReactNode } from 'react'

import { DEPOT, lienSource, versionDeployee } from '../../infra/source'

export default function CoquilleBackOffice({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-bord bg-surface">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-5">
          <Link href="/bo" className="font-titre text-base font-semibold text-encre">
            Feedys
          </Link>
          <span className="text-[13px] text-encre-3">le retour terrain, dicté</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-7">{children}</main>

      <footer className="border-t border-bord bg-surface">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-5 py-4 text-[13px] text-encre-3">
          <span>
            Feedys — logiciel libre sous{' '}
            <a className="underline underline-offset-2 hover:text-encre" href={`${DEPOT}#licence`}>
              AGPL-3.0
            </a>
          </span>
          <span aria-hidden>·</span>
          <a className="underline underline-offset-2 hover:text-encre" href={lienSource()}>
            le code source de cette version
          </a>
          <span aria-hidden>·</span>
          <span className="font-mono">{versionDeployee()}</span>
        </div>
      </footer>
    </div>
  )
}

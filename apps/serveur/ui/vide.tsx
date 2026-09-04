/**
 * Les états vides.
 *
 * ⛔ CE SONT DES ÉCRANS, PAS DES PHRASES GRISES. « Aucun retour pour l’instant »
 *    est le premier écran que le développeur verra : il doit dire QUOI FAIRE
 *    ENSUITE (04-Architecture/DESIGN.md §Ce qui vaut pour les deux).
 */
import type { ReactNode } from 'react'

export function Vide({
  titre,
  children,
  action,
}: {
  titre: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="rounded-[var(--radius-bo)] border border-dashed border-bord-fort bg-surface px-6 py-14 text-center">
      <h2 className="font-titre text-lg text-encre">{titre}</h2>
      <div className="mx-auto mt-2 max-w-prose text-sm leading-relaxed text-encre-2">
        {children}
      </div>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  )
}

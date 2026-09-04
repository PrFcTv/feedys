/**
 * Les pastilles — type de retour, statut, confiance.
 *
 * ⛔ JAMAIS LA COULEUR SEULE. Chaque pastille porte une FORME et un TEXTE en plus
 *    de sa teinte : un daltonien lit « bug » et voit un carré, pas « du rouge »
 *    (04-Architecture/DESIGN.md §2).
 *
 * ⚠️ C’est aussi ce qui rend la liste lisible imprimée, ou en noir et blanc.
 */
import type { ReactNode } from 'react'

import type { Statut, TypeRetour } from '../domaine/backoffice/filtres'
import { LIBELLES_STATUT, LIBELLES_TYPE } from '../domaine/backoffice/filtres'

import { cn } from './cn'

const SOCLE =
  'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 ' +
  'text-[12px] leading-5 font-medium whitespace-nowrap'

/** ⚠️ Une forme par type : le glyphe est l’information, la couleur la renforce. */
const FORMES: Record<TypeRetour, string> = {
  bug: '■',
  idee: '◆',
  question: '●',
  gene: '▲',
}

const TONS_TYPE: Record<TypeRetour, string> = {
  bug: 'border-signal/40 bg-signal-faible text-signal',
  idee: 'border-calme/40 bg-calme-faible text-calme',
  question: 'border-accent/30 bg-accent-faible text-accent',
  gene: 'border-bord-fort bg-surface-2 text-encre-2',
}

export function PastilleType({ type }: { type: TypeRetour | null }) {
  if (type === null) {
    return (
      <span className={cn(SOCLE, 'border-dashed border-bord-fort text-encre-3')}>
        <span aria-hidden>·</span>
        sans étiquette
      </span>
    )
  }

  return (
    <span className={cn(SOCLE, TONS_TYPE[type])}>
      <span aria-hidden>{FORMES[type]}</span>
      {LIBELLES_TYPE[type]}
    </span>
  )
}

/** ⚠️ Les statuts posés par le serveur sont en creux ; ceux posés à la main, pleins. */
const TONS_STATUT: Record<Statut, string> = {
  en_cours: 'border-bord-fort bg-surface text-encre-3',
  abandonne: 'border-bord-fort bg-surface text-encre-3',
  envoye: 'border-bord-fort bg-surface-2 text-encre-2',
  lu: 'border-accent/30 bg-accent-faible text-accent',
  traite: 'border-calme/40 bg-calme-faible text-calme',
  ecarte: 'border-bord-fort bg-surface-2 text-encre-3 line-through',
}

export function PastilleStatut({ statut }: { statut: Statut }) {
  return <span className={cn(SOCLE, TONS_STATUT[statut])}>{LIBELLES_STATUT[statut]}</span>
}

/**
 * ⚠️ Une note en confiance basse SE LIT DIFFÉREMMENT : on ne planifie pas dessus,
 *    on va voir la personne (01-Specs/synthese.md). Elle doit donc se voir depuis
 *    la liste, pas seulement sur la fiche.
 */
export function PastilleConfiance({ confiance }: { confiance: 'haute' | 'moyenne' | 'basse' }) {
  const tons = {
    haute: 'border-bord-fort bg-surface text-encre-3',
    moyenne: 'border-bord-fort bg-surface-2 text-encre-2',
    basse: 'border-signal/40 bg-signal-faible text-signal',
  }

  return <span className={cn(SOCLE, tons[confiance])}>confiance {confiance}</span>
}

export function Meta({ children }: { children: ReactNode }) {
  return <span className="text-[13px] text-encre-3">{children}</span>
}

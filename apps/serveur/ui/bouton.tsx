/**
 * Le bouton — patron shadcn (MIT), tokens de Feedys.
 *
 * ⛔ Aucun HEX ici : tout passe par les tokens de `app/global.css`
 *    (04-Architecture/DESIGN.md §Ce qui vaut pour les deux).
 */
import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'

import { cn } from './cn'

const bouton = cva(
  'inline-flex items-center justify-center gap-2 rounded-[var(--radius-bo)] ' +
    'font-medium whitespace-nowrap transition-colors ' +
    'disabled:pointer-events-none disabled:opacity-50 ' +
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      ton: {
        plein: 'bg-accent text-accent-encre hover:opacity-90',
        contour: 'border border-bord-fort bg-surface text-encre hover:bg-surface-2',
        discret: 'text-encre-2 hover:bg-surface-2 hover:text-encre',
      },
      taille: {
        normal: 'h-9 px-3 text-sm',
        petit: 'h-8 px-2.5 text-[13px]',
      },
    },
    defaultVariants: { ton: 'plein', taille: 'normal' },
  },
)

export type ProprietesBouton = ComponentProps<'button'> & VariantProps<typeof bouton>

export function Bouton({ className, ton, taille, ...reste }: ProprietesBouton) {
  return <button className={cn(bouton({ ton, taille }), className)} {...reste} />
}

export { bouton as classesBouton }

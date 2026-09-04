/**
 * `cn` — la fusion de classes de shadcn, telle quelle.
 *
 * ⚠️ `clsx` assemble, `tailwind-merge` DÉDOUBLONNE : sans lui, `px-2` passé en
 *    prop ne gagne pas contre le `px-3` du composant, parce que les deux
 *    classes existent et que c’est l’ordre de la feuille qui tranche.
 *
 * Emprunt : shadcn/ui (MIT) — voir ATTRIBUTIONS.md.
 */
import type { ClassValue } from 'clsx'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...entrees: ClassValue[]): string {
  return twMerge(clsx(entrees))
}

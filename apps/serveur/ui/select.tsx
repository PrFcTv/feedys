'use client'

/**
 * Le select — patron shadcn, **variante Base UI** et non Radix
 * (04-Architecture/DESIGN.md §2 : c’est celle qui a un avenir et qui s’aligne
 * sur les autres projets de l’auteur).
 *
 * ⚠️ `Select.Root` reçoit `name` : Base UI pose alors un champ caché, et le
 *    select part dans un envoi de formulaire ORDINAIRE. C’est ce qui permet aux
 *    filtres de marcher en `GET`, donc de rester dans l’URL, donc d’être
 *    partageables — et de fonctionner même si le JavaScript n’a pas encore
 *    démarré.
 *
 * Emprunt : shadcn/ui (MIT) pour la forme des parties — voir ATTRIBUTIONS.md.
 */
import { Select } from '@base-ui/react/select'
import { Check, ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from './cn'

export interface Option {
  readonly valeur: string
  readonly libelle: string
}

export interface ProprietesChampSelect {
  readonly nom: string
  readonly etiquette: string
  readonly options: readonly Option[]
  readonly valeur?: string
  readonly parDefaut?: string
  readonly className?: string
}

export function ChampSelect({
  nom,
  etiquette,
  options,
  valeur,
  parDefaut,
  className,
}: ProprietesChampSelect) {
  return (
    <Select.Root
      name={nom}
      defaultValue={valeur ?? parDefaut ?? options[0]?.valeur ?? ''}
      items={options.map((option) => ({ value: option.valeur, label: option.libelle }))}
    >
      <div className={cn('flex flex-col gap-1', className)}>
        <Select.Label className="text-[12px] font-medium tracking-wide text-encre-3 uppercase">
          {etiquette}
        </Select.Label>

        <Select.Trigger
          /* ⚠️ Le nom accessible est posé À LA MAIN : `Select.Label` rend un
             élément qui n’est pas relié au déclencheur, et un `combobox` sans
             nom est illisible au lecteur d’écran comme au test de parcours. */
          aria-label={etiquette}
          className={cn(
            'flex h-9 min-w-[9rem] items-center justify-between gap-2 rounded-[var(--radius-bo)]',
            'border border-bord-fort bg-surface px-2.5 text-sm text-encre',
            'hover:bg-surface-2 data-[popup-open]:bg-surface-2',
          )}
        >
          <Select.Value />
          <Select.Icon>
            <ChevronDown className="size-4 text-encre-3" aria-hidden />
          </Select.Icon>
        </Select.Trigger>
      </div>

      <Select.Portal>
        <Select.Positioner sideOffset={4} className="z-50">
          <Select.Popup
            className={cn(
              'max-h-72 min-w-[var(--anchor-width)] overflow-y-auto rounded-[var(--radius-bo)]',
              'border border-bord bg-surface p-1 shadow-lg',
            )}
          >
            {options.map((option) => (
              <Select.Item
                key={option.valeur}
                value={option.valeur}
                className={cn(
                  'flex cursor-default items-center gap-2 rounded-[4px] px-2 py-1.5 text-sm',
                  'text-encre outline-none data-[highlighted]:bg-accent-faible',
                )}
              >
                <Select.ItemIndicator className="flex size-4 items-center justify-center">
                  <Check className="size-3.5" aria-hidden />
                </Select.ItemIndicator>
                <Select.ItemText className="data-[selected]:font-medium">
                  {option.libelle}
                </Select.ItemText>
              </Select.Item>
            ))}
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  )
}

export function Etiquette({ children }: { children: ReactNode }) {
  return (
    <span className="text-[12px] font-medium tracking-wide text-encre-3 uppercase">{children}</span>
  )
}

/**
 * Les trois polices du back-office.
 *
 * ⚠️ Une police web est légitime ICI, et seulement ici : le back-office est
 *    chez lui, il n’est pas injecté dans la page de quelqu’un. ⛔ Le widget,
 *    lui, reste sur la pile système, point (04-Architecture/DESIGN.md §Aucune
 *    police web).
 *
 * ⚠️ `next/font/google` télécharge les fontes À LA CONSTRUCTION et les SERT
 *    depuis le domaine : aucune requête vers Google au chargement d’une page,
 *    aucun tiers, et pas de saut de mise en page.
 *
 * ⚠️ Les trois rôles sont ceux de DESIGN.md §2 : titres en Montserrat, corps et
 *    données en IBM Plex Sans, ⛔ **verbatims et technique en IBM Plex Mono** —
 *    la mono n’est pas décorative, c’est ce qui distingue une pièce d’une prose.
 */
import { IBM_Plex_Mono, IBM_Plex_Sans, Montserrat } from 'next/font/google'

export const policeTitre = Montserrat({
  subsets: ['latin'],
  weight: ['600', '700'],
  display: 'swap',
  variable: '--police-titre',
})

export const policeCorps = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--police-corps',
})

export const policeMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--police-mono',
})

/** ⚠️ À poser sur `<html>` : les variables doivent couvrir tout le document. */
export const CLASSES_POLICES = [
  policeTitre.variable,
  policeCorps.variable,
  policeMono.variable,
].join(' ')

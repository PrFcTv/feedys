/**
 * Ce qu’on dit d’un retour qui n’a pas de note.
 *
 * ⚠️ POURQUOI ÇA SE DIT. « Sans note — synthèse absente » recouvrait trois
 *    situations qui ne demandent pas le même geste : le filet va la redemander
 *    tout seul ; le filet a renoncé et il faut la refaire à la main ; il n’y a
 *    rien à synthétiser et il n’y aura jamais de note (P-030). Le back-office
 *    le dit sur la liste ET sur la fiche.
 *
 * ⛔ Module pur (architecture.md §3).
 */

export type EtatSansNote = 'impossible' | 'sans_parole' | 'en_reprise' | 'absente'

export interface SuiviNote {
  readonly reprises: number | null
  readonly impossibleMotif: string | null
}

export function etatSansNote(suivi: SuiviNote): EtatSansNote {
  if (suivi.impossibleMotif === 'plafond') return 'impossible'
  if (suivi.impossibleMotif === 'rien_a_synthetiser') return 'sans_parole'
  if ((suivi.reprises ?? 0) > 0) return 'en_reprise'
  return 'absente'
}

/** La ligne de la liste, à la place du titre. */
export const LIBELLES_SANS_NOTE: Record<EtatSansNote, string> = {
  impossible: 'sans note — le modèle n’a pas répondu, à refaire',
  sans_parole: 'sans note — rien à synthétiser',
  en_reprise: 'sans note — le modèle sera relancé',
  absente: 'sans note — synthèse absente',
}

/** Pourquoi « Refaire la note » a refusé, dans les mots de la fiche. */
export const REFUS_REFAIRE: Record<string, string> = {
  retour_inconnu: 'Ce retour n’existe pas.',
  en_cours: 'L’entretien est encore en cours : sa note sera rédigée à la fin.',
  deja_faite: 'Ce retour a déjà sa note — une note ne se refait pas.',
  rien_a_synthetiser:
    'Il n’y a rien à synthétiser : le fil ne contient aucune parole écrite.',
  modele_indisponible:
    'Le modèle ne répond toujours pas. Rien n’a changé ; réessayez plus tard.',
}

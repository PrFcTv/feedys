/**
 * « Refaire la note » — le rattrapage à la main, qui marche DANS L’IMAGE.
 *
 * ⚠️ POURQUOI UN BOUTON. La procédure écrite dans hebergement.md renvoyait à
 *    `pnpm entretien:rejouer --synthese`, qui n’écrit rien, par construction,
 *    et qui n’existe pas dans l’image de production : ni `pnpm`, ni `tsx`, ni
 *    `outils/`, ni le dépôt sur le VPS du client (BUGS_LOG 019). Le seul endroit
 *    qu’un exploitant a toujours sous la main, c’est le back-office.
 *
 * ⛔ IL NE RÉGÉNÈRE JAMAIS UNE NOTE EXISTANTE. Une note par retour
 *    (01-Specs/synthese.md) : un retour qui a la sienne est refusé AVANT tout
 *    appel au modèle, et `syntheses_retour_uniq` refuserait de toute façon.
 *
 * ⛔ NI UN ENTRETIEN EN COURS. Une note écrite maintenant serait celle d’un
 *    entretien inachevé — et la vraie, à la fin, serait refusée comme doublon.
 *
 * ⛔ IL NE TOUCHE À RIEN D’AUTRE. Ni au statut, ni au fil, ni aux reprises du
 *    filet : il demande la note par le chemin ordinaire — celui qui écrit les
 *    étiquettes et notifie —, et il dit ce qui s’est passé.
 *
 * ⛔ `entretien:rejouer` reste en lecture seule. C’est un outil de mise au point
 *    du prompt, pas un rattrapage.
 *
 * ⛔ Module pur (architecture.md §3).
 */
import type { IssueSynthese } from './reprise'

export interface PortsRefaire {
  /** Le statut du retour, ou `null` s’il n’existe pas. */
  statut(retourId: string): Promise<string | null>
  aSaNote(retourId: string): Promise<boolean>
  synthetiser(retourId: string): Promise<IssueSynthese>
}

export type MotifRefusRefaire =
  | 'retour_inconnu'
  | 'en_cours'
  | 'deja_faite'
  | 'rien_a_synthetiser'
  | 'modele_indisponible'

export type IssueRefaire = { readonly ok: true } | { readonly ok: false; readonly motif: MotifRefusRefaire }

export async function refaireLaNote(retourId: string, ports: PortsRefaire): Promise<IssueRefaire> {
  const statut = await ports.statut(retourId)
  if (statut === null) return { ok: false, motif: 'retour_inconnu' }
  if (statut === 'en_cours') return { ok: false, motif: 'en_cours' }

  // ⛔ Refusé ICI, avant le modèle : la règle se lit dans le code, pas seulement
  //    dans une contrainte d’unicité qui refuserait après coup.
  if (await ports.aSaNote(retourId)) return { ok: false, motif: 'deja_faite' }

  const issue = await ports.synthetiser(retourId)
  return issue === 'ecrite' ? { ok: true } : { ok: false, motif: issue }
}

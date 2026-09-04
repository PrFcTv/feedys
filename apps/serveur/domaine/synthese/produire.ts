/**
 * La production de la synthèse — la note que le développeur lit.
 *
 * ⛔ Elle est produite UNE FOIS, à la fin de l’entretien : envoi manuel, deux
 *    relances atteintes, ou abandon. Les trois passent par
 *    `domaine/entretien/tour.ts` §terminerEntretien, qui appelle son port `aval`
 *    APRÈS la clôture — et dont l’échec est avalé. Une synthèse qui rate ne perd
 *    donc rien : la parole est en base depuis l’ingestion.
 *
 * ⛔ Module pur : ni base, ni réseau, ni horloge (architecture.md §3).
 */
import type { Modele } from '../entretien/modele'
import type { ContexteEntretien, FinEntretien, TourFil } from '../entretien/prompts'

import type { Confiance, Synthese } from './schema'
import { verifierCitations } from './verbatim'

export type { FinEntretien }

export interface RetourASynthetiser {
  readonly id: string
  readonly statut: string
  readonly contexte: ContexteEntretien
  readonly fil: readonly TourFil[]
  /** ⚠️ Le nombre de relances posées : le modèle ne le voit pas dans le fil. */
  readonly relancesPosees: number
}

/** Ce qu’on écrit en base. ⚠️ `confiance` est extraite en colonne : on filtre dessus. */
export interface SyntheseAEcrire {
  readonly contenu: Synthese
  readonly modele: string
  readonly confiance: Confiance
  readonly jetonsEntree: number | null
  readonly jetonsSortie: number | null
}

/** Les étiquettes recopiées sur le retour. ⛔ Des étiquettes, pas de la parole. */
export interface EtiquettesRetour {
  readonly type: Synthese['type']
  readonly titre: string
  readonly zone: string
}

export interface PortDepotSyntheses {
  charger(retourId: string): Promise<RetourASynthetiser | null>
  /** Écrit la synthèse et recopie les étiquettes, en UNE transaction. */
  enregistrer(
    retourId: string,
    synthese: SyntheseAEcrire,
    etiquettes: EtiquettesRetour,
  ): Promise<void>
  /** ⛔ Une seule synthèse par retour. `true` s’il y en a déjà une. */
  dejaFaite(retourId: string): Promise<boolean>
}

export interface PortsSynthese {
  readonly depot: PortDepotSyntheses
  readonly modele: Modele
  /** ⛔ Jamais le contenu d’un retour : la parole ne va pas dans les journaux. */
  readonly signaler?: (quoi: string, erreur: unknown) => void
}

export type MotifRefusSynthese =
  | 'retour_inconnu'
  | 'deja_faite'
  | 'rien_a_synthetiser'
  | 'modele_indisponible'

export type ResultatSynthese =
  | { readonly ok: true; readonly synthese: SyntheseAEcrire }
  | { readonly ok: false; readonly motif: MotifRefusSynthese }

/** ⛔ La limite est celle de l’entretien. Elle est importée, pas recopiée. */
export function finDe(statut: string, relancesPosees: number, maximum: number): FinEntretien {
  if (statut === 'abandonne') return 'abandon'
  return relancesPosees >= maximum ? 'limite' : 'envoi'
}

/** Ce que la personne a dit, et rien d’autre. ⚠️ C’est la seule source des citations. */
export function parolesDe(fil: readonly TourFil[]): string[] {
  return fil
    .filter((tour) => tour.role === 'collaborateur')
    .map((tour) => tour.texte)
    .filter((texte) => texte.trim() !== '')
}

/**
 * Produit la synthèse d’un retour.
 *
 * ⚠️ L’ordre : on refuse tôt (retour inconnu, synthèse déjà faite, rien à dire),
 *    on appelle le modèle, **puis on corrige ce qu’il a rendu** — les citations
 *    sont remplacées par les tranches exactes du fil, et la confiance ne peut
 *    pas être plus haute que ce que le serveur sait.
 */
export async function produireSynthese(
  retourId: string,
  ports: PortsSynthese,
  maximumRelances: number,
): Promise<ResultatSynthese> {
  const retour = await ports.depot.charger(retourId)
  if (retour === null) return { ok: false, motif: 'retour_inconnu' }

  // ⛔ Produite une fois, jamais réécrite (01-Specs/synthese.md).
  if (await ports.depot.dejaFaite(retourId)) return { ok: false, motif: 'deja_faite' }

  const paroles = parolesDe(retour.fil)
  if (paroles.length === 0) return { ok: false, motif: 'rien_a_synthetiser' }

  const fin = finDe(retour.statut, retour.relancesPosees, maximumRelances)

  let rendu: Awaited<ReturnType<Modele['synthese']>>
  try {
    rendu = await ports.modele.synthese({ contexte: retour.contexte, fil: retour.fil, fin })
  } catch (erreur) {
    ports.signaler?.('production de la synthèse', erreur)
    return { ok: false, motif: 'modele_indisponible' }
  }

  const { gardees, jetees } = verifierCitations(rendu.synthese.citations, paroles)

  // ⚠️ Une citation jetée n’est pas anodine : c’est le prompt qui dérive vers la
  //    reformulation, et c’est exactement ce qu’on veut voir arriver.
  if (jetees.length > 0) {
    ports.signaler?.(
      `${jetees.length} citation(s) écartée(s) — le modèle a reformulé au lieu de citer`,
      new Error('citations non verbatim'),
    )
  }

  const contenu: Synthese = {
    ...rendu.synthese,
    citations: gardees,
    confiance: plafonnerConfiance(rendu.synthese.confiance, fin, gardees.length),
  }

  return {
    ok: true,
    synthese: {
      contenu,
      modele: rendu.modele,
      confiance: contenu.confiance,
      jetonsEntree: rendu.jetonsEntree,
      jetonsSortie: rendu.jetonsSortie,
    },
  }
}

/**
 * La confiance ne peut pas dépasser ce que le serveur sait de l’entretien.
 *
 * ⛔ Deux faits que le modèle ne peut pas lire dans le fil, et sur lesquels on ne
 *    le laisse pas décider :
 *
 * - **la personne est partie en cours d’entretien.** Le fil s’arrête, mais rien
 *   n’y dit que c’est un abandon. Une note « confiance haute » sur un entretien
 *   qu’on a fui serait un mensonge utile à personne ;
 * - **aucune citation n’a survécu à la vérification.** Si on n’a pas réussi à
 *   citer la personne, on ne prétend pas l’avoir bien comprise.
 *
 * ⚠️ Le reste — transcript pauvre, reformulation non confirmée — est demandé au
 *    prompt, parce que ça se lit dans le fil et que le modèle le lit mieux
 *    qu’une règle.
 */
export function plafonnerConfiance(
  rendue: Confiance,
  fin: FinEntretien,
  citations: number,
): Confiance {
  if (fin === 'abandon' || citations === 0) return 'basse'
  return rendue
}

/** Les étiquettes du retour, tirées de la synthèse. */
export function etiquettesDe(synthese: Synthese): EtiquettesRetour {
  return { type: synthese.type, titre: synthese.titre, zone: synthese.zone }
}

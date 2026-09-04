/**
 * Ce qu’une main humaine a le droit de changer sur un retour — et, surtout, ce
 * qu’elle n’a pas le droit de changer.
 *
 * ⛔ TROIS CHAMPS, ET PAS UN DE PLUS : `statut`, `type`, `zone`. Ce sont des
 *    ÉTIQUETTES. Ni le résumé, ni les citations, ni le fil de l’entretien ne
 *    sont modifiables — le texte d’un `message` ne se modifie jamais et ne se
 *    supprime jamais, ni par le back-office, ni par le MCP, ni pour corriger une
 *    typo (04-Architecture/conventions-db.md §Ce qu’on n’efface pas).
 *
 * ⚠️ Le schéma est `.strict()`, ce qui rend l’interdit VÉRIFIABLE : un formulaire
 *    forgé qui poste `texte`, `resume` ou `citations` est REFUSÉ, pas ignoré en
 *    silence. C’est le point d’acceptation de P-010.
 *
 * ⛔ Module pur : ni base, ni réseau (architecture.md §3).
 */
import { z } from 'zod'

import type { Statut, TypeRetour } from './filtres'
import { TYPES } from './filtres'

/**
 * ⛔ Les trois statuts qu’une PERSONNE pose. Les trois autres — `en_cours`,
 *    `abandonne`, `envoye` — décrivent le déroulé de l’entretien : ils sont
 *    écrits par le serveur, et les réécrire à la main falsifierait l’histoire du
 *    retour. Même liste que celle du MCP (01-Specs/synthese.md §Le rendu MCP).
 */
export const STATUTS_A_LA_MAIN = ['lu', 'traite', 'ecarte'] as const
export type StatutALaMain = (typeof STATUTS_A_LA_MAIN)[number]

const LONGUEUR_ZONE = 200

const SchemaStatut = z
  .object({ statut: z.enum(STATUTS_A_LA_MAIN) })
  .strict()

const SchemaEtiquettes = z
  .object({
    type: z.enum(TYPES),
    /** ⚠️ Une zone vide est légitime : le modèle n’a pas toujours de quoi la déduire. */
    zone: z.string().max(LONGUEUR_ZONE),
  })
  .strict()

export interface ChangementStatut {
  readonly statut: StatutALaMain
}

export interface ChangementEtiquettes {
  readonly type: TypeRetour
  readonly zone: string
}

export type MotifRefusCorrection = 'champ_inconnu' | 'valeur_refusee'

export type Lu<T> = { readonly ok: true; readonly valeur: T } | {
  readonly ok: false
  readonly motif: MotifRefusCorrection
}

/**
 * ⚠️ Le motif distingue « tu m’as envoyé un champ que je ne connais pas » de
 *    « la valeur n’est pas dans la liste ». Le premier est le signe d’un
 *    formulaire forgé, et c’est celui qu’on veut voir dans les journaux.
 */
function lire<T>(schema: z.ZodType<T>, brut: unknown, connus: readonly string[]): Lu<T> {
  const resultat = schema.safeParse(brut)
  if (resultat.success) return { ok: true, valeur: resultat.data }

  const inconnu =
    typeof brut === 'object' &&
    brut !== null &&
    Object.keys(brut).some((champ) => !connus.includes(champ))

  return { ok: false, motif: inconnu ? 'champ_inconnu' : 'valeur_refusee' }
}

export function lireChangementStatut(brut: unknown): Lu<ChangementStatut> {
  return lire(SchemaStatut, brut, ['statut'])
}

export function lireChangementEtiquettes(brut: unknown): Lu<ChangementEtiquettes> {
  return lire(SchemaEtiquettes, brut, ['type', 'zone'])
}

/** Ce qui part dans `audit.detail`. ⚠️ L’avant ET l’après : sans l’avant, la ligne ne dit rien. */
export interface LigneAudit {
  readonly action: 'statut' | 'etiquettes'
  readonly detail: Record<string, unknown>
}

export function auditStatut(avant: Statut, apres: StatutALaMain): LigneAudit {
  return { action: 'statut', detail: { avant, apres } }
}

export function auditEtiquettes(
  avant: { type: TypeRetour | null; zone: string | null },
  apres: ChangementEtiquettes,
): LigneAudit {
  return { action: 'etiquettes', detail: { avant, apres } }
}

/**
 * Le contrat de transport entre le serveur MCP et le serveur Feedys.
 *
 * ⛔ Ce fichier vit du côté MIT, et c’est délibéré — comme
 *    `packages/widget/src/contrat.ts`. `apps/serveur` (AGPL) l’IMPORTE ; jamais
 *    l’inverse (04-Architecture/licences.md).
 *
 * ⚠️ Il ne décrit QUE des formes de requêtes et de réponses. Aucune logique
 *    métier n’a le droit d’y descendre : le jour où elle y descendrait, le
 *    serveur importerait de la logique depuis un paquet MIT, et la frontière
 *    n’aurait plus de sens.
 *
 * ⛔ ET RIEN DE QUACKBACK (AGPL) N’EST ICI. On lui emprunte la FORME de ses
 *    outils — trois verbes, lister / lire / marquer — et rien de son code. Une
 *    API n’est pas du code (04-Architecture/licences.md).
 */
import { z } from 'zod'

export const CHEMIN_MCP = '/api/mcp/retours'

/** ⚠️ Bearer standard : c’est ce que toute bibliothèque HTTP sait déjà poser. */
export const EN_TETE_JETON = 'authorization'

export function cheminRetour(id: string): string {
  return `${CHEMIN_MCP}/${encodeURIComponent(id)}`
}

export function cheminStatut(id: string): string {
  return `${cheminRetour(id)}/statut`
}

/** ⛔ Listes closes, alignées sur les enums de la base. */
export const STATUTS = ['en_cours', 'abandonne', 'envoye', 'lu', 'traite', 'ecarte'] as const
export const TYPES = ['bug', 'idee', 'question', 'gene'] as const

/**
 * ⛔ LE STATUT EST LA SEULE CHOSE QU’UN OUTIL PEUT CHANGER, et seulement vers
 *    ces trois-là. `en_cours`, `abandonne` et `envoye` décrivent le déroulé de
 *    l’entretien : les réécrire falsifierait l’histoire du retour. Même liste
 *    qu’au back-office (01-Specs/back-office.md).
 */
export const STATUTS_MARQUABLES = ['lu', 'traite', 'ecarte'] as const

export const BORNES = {
  zone: 200,
  /** ⚠️ Un agent qui liste veut une page, pas un export. */
  limite: 100,
} as const

// ── lister_retours ──────────────────────────────────────────────────────────

export const RequeteListe = z
  .object({
    statut: z.enum(STATUTS).optional(),
    type: z.enum(TYPES).optional(),
    zone: z.string().max(BORNES.zone).optional(),
    /** ⚠️ Une date ISO, pas une durée : un agent sait calculer une date. */
    depuis: z.iso.datetime().optional(),
    limite: z.number().int().min(1).max(BORNES.limite).optional(),
  })
  .strict()

export type RequeteListe = z.infer<typeof RequeteListe>

export const RetourResume = z.object({
  id: z.string(),
  titre: z.string().nullable(),
  type: z.enum(TYPES).nullable(),
  statut: z.enum(STATUTS),
  zone: z.string().nullable(),
  produit: z.string(),
  confiance: z.enum(['haute', 'moyenne', 'basse']).nullable(),
  recu_le: z.string(),
})

export type RetourResume = z.infer<typeof RetourResume>

export const ReponseListe = z.object({ retours: z.array(RetourResume) })
export type ReponseListe = z.infer<typeof ReponseListe>

// ── lire_retour ─────────────────────────────────────────────────────────────

/**
 * ⚠️ `lire_retour` rend AUSSI LE FIL BRUT, pas seulement la synthèse. Quand un
 *    agent creuse réellement un problème, la parole d’origine contient souvent
 *    ce que le résumé a perdu (01-Specs/synthese.md §Le rendu MCP).
 */
export const TourFil = z.object({
  ordre: z.number().int(),
  role: z.enum(['collaborateur', 'bot']),
  texte: z.string(),
})

export type TourFil = z.infer<typeof TourFil>

export const ReponseRetour = z.object({
  id: z.string(),
  statut: z.enum(STATUTS),
  produit: z.string(),
  auteur: z.string().nullable(),
  auteur_role: z.string().nullable(),
  identite_verifiee: z.boolean(),
  source: z.enum(['voix', 'texte']),
  recu_le: z.string(),
  /** ⚠️ `null` quand la note a raté : le fil, lui, est toujours là. */
  synthese: z.unknown().nullable(),
  modele: z.string().nullable(),
  fil: z.array(TourFil),
  contexte: z.record(z.string(), z.unknown()).nullable(),
})

export type ReponseRetour = z.infer<typeof ReponseRetour>

// ── marquer_retour ──────────────────────────────────────────────────────────

export const RequeteStatut = z.object({ statut: z.enum(STATUTS_MARQUABLES) }).strict()
export type RequeteStatut = z.infer<typeof RequeteStatut>

export const ReponseStatut = z.object({ id: z.string(), statut: z.enum(STATUTS_MARQUABLES) })
export type ReponseStatut = z.infer<typeof ReponseStatut>

// ── les refus ───────────────────────────────────────────────────────────────

export const MOTIFS = [
  'jeton_absent',
  'jeton_refuse',
  'requete_refusee',
  'retour_inconnu',
  'mcp_non_configure',
] as const

export type Motif = (typeof MOTIFS)[number]

export const Refus = z.object({ erreur: z.enum(MOTIFS), message: z.string() })
export type Refus = z.infer<typeof Refus>

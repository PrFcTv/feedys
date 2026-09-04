/**
 * Le schéma de la synthèse — **une seule définition**, partagée entre l’appel au
 * modèle et la validation.
 *
 * ⚠️ C’est le point du prompt P-008, et ce n’est pas une coquetterie : deux
 *    définitions du même objet divergent toujours, et la divergence se découvre
 *    le jour où une note arrive tronquée en production. Ici, le même objet zod
 *    est passé à `generateObject` — qui en fait le JSON Schema envoyé au
 *    modèle — et sert à relire ce qu’on a stocké.
 *
 * ⛔ IL N’Y A NI PRIORITÉ, NI SÉVÉRITÉ, NI SCORE, NI SUGGESTION TECHNIQUE, NI
 *    RAPPROCHEMENT AVEC D’AUTRES RETOURS. Arbitrer est le travail du
 *    développeur ; un modèle qui note à sa place fabrique une fausse objectivité
 *    qu’on finit par suivre (01-Specs/synthese.md §Ce que la synthèse ne
 *    contient pas). `.strict()` rend l’interdit VÉRIFIABLE : un champ de plus
 *    est refusé, pas ignoré.
 */
import { z } from 'zod'

/** Une phrase, sans point final. ⚠️ La borne est dans la spec, pas inventée ici. */
const LONGUEUR_TITRE = 80

export const SchemaSynthese = z
  .object({
    // ── ce que c’est ────────────────────────────────────────────────────────
    type: z.enum(['bug', 'idee', 'question', 'gene']),
    titre: z.string().min(1).max(LONGUEUR_TITRE).describe('Une phrase, sans point final'),
    resume: z.string().min(1).max(2_000).describe('2 à 4 phrases, à la 3e personne'),

    // ── pour un bug ─────────────────────────────────────────────────────────
    attendu: z.string().max(1_000).nullish().describe('Ce que la personne pensait obtenir'),
    constate: z.string().max(1_000).nullish().describe('Ce qu’elle a obtenu'),
    recurrence: z.enum(['premiere_fois', 'deja_vu', 'systematique']).nullish(),

    // ── pour une idée ───────────────────────────────────────────────────────
    besoin: z.string().max(1_000).nullish().describe('Le problème derrière la solution proposée'),
    frequence: z.string().max(300).nullish().describe('À quelle fréquence le besoin se présente'),

    // ── dans tous les cas ───────────────────────────────────────────────────
    zone: z.string().max(200).describe('La partie du logiciel concernée, déduite du contexte'),
    impact: z.enum(['bloque', 'ralentit', 'agace', 'indetermine']),

    /**
     * ⛔ 1 à 3 extraits VERBATIM, jamais reformulés, jamais nettoyés.
     *
     * Un résumé lessive l’émotion, et l’émotion est de l’information.
     * « c’est pénible » et « je perds dix minutes tous les matins là-dessus » se
     * résument tous les deux en « friction sur le tri » — mais ils ne se
     * priorisent pas pareil (01-Specs/synthese.md).
     *
     * ⚠️ Le modèle n’est pas cru sur parole : `verbatim.ts` REPLACE chaque
     *    citation par la tranche exacte du message d’origine, et jette celles
     *    qu’il ne retrouve pas. La liste peut donc être vide après coup.
     */
    citations: z
      .array(z.string().min(1).max(500))
      .min(1)
      .max(3)
      .describe('Extraits mot pour mot de ce que la personne a dit. Ne rien corriger.'),

    confiance: z.enum(['haute', 'moyenne', 'basse']),

    /**
     * ⚠️ Une liste vide est un SIGNAL, pas un défaut : elle veut dire que
     *    l’entretien a suffi. Si elle est vide dans 90 % des cas, c’est le prompt
     *    qui ment ; si elle a six entrées, c’est l’entretien qui a échoué.
     */
    questions_ouvertes: z
      .array(z.string().min(1).max(300))
      .max(6)
      .describe('Ce que l’entretien n’a pas établi'),
  })
  .strict()

export type Synthese = z.infer<typeof SchemaSynthese>
export type TypeRetour = Synthese['type']
export type Confiance = Synthese['confiance']

/** Analyse un objet stocké. ⚠️ Sert à relire le `jsonb`, pas seulement à écrire. */
export function analyserSynthese(valeur: unknown): Synthese | undefined {
  const resultat = SchemaSynthese.safeParse(valeur)
  return resultat.success ? resultat.data : undefined
}

/**
 * Les constantes du transport — sans zod, et c’est tout l’intérêt.
 *
 * ⛔ CE FICHIER NE DOIT DÉPENDRE DE RIEN. Il est séparé de `contrat.ts` pour une
 *    raison mesurée : `contrat.ts` importe zod, et une seule valeur importée
 *    depuis lui fait entrer zod entier dans `widget.js`. Constaté le
 *    2026-09-04 : `import { BORNES } from '../contrat'` dans un module du
 *    widget faisait passer le bundle de 0,1 à 26 Ko gzip, pour trois nombres.
 *
 * Donc : le code du widget importe **ce fichier** pour les valeurs, et
 * `contrat.ts` uniquement en `import type`. `contrat.ts`, lui, réexporte tout ce
 * qui suit — le serveur n’a aucune raison de connaître la découpe.
 *
 * ⚠️ Vérifié par `budget.test.ts`, qui relit les sources et rougit si un module
 *    du widget importe `contrat` autrement qu’en type.
 */

/**
 * L’en-tête qui porte la clé publique du produit.
 *
 * ⚠️ Publique par nature : elle est dans le HTML de l’hôte. Ce qu’elle identifie,
 *    ce n’est pas quelqu’un, c’est un produit — 00-Projet/DECISIONS_LOG.md D-005.
 */
export const EN_TETE_CLE = 'x-feedys-cle'

/** Le préfixe d’une clé publique. Sert aussi à refuser un secret posté par erreur. */
export const PREFIXE_CLE_PUBLIQUE = 'fdy_pub_'

/** Le préfixe d’un secret produit. ⛔ Il ne traverse jamais le navigateur. */
export const PREFIXE_SECRET = 'fdy_sec_'

/** Le chemin d’ingestion. */
export const CHEMIN_RETOURS = '/api/retours'

/**
 * Les bornes. Elles sont ici parce que le widget doit les connaître pour ne pas
 * envoyer ce qui sera refusé, et le serveur pour refuser.
 */
export const BORNES = {
  /** Le corps entier, capture et audio compris. Au-delà : 413. */
  corpsOctets: 4 * 1024 * 1024,
  /** Un retour dicté fait quelques centaines de caractères. 8 000 est déjà large. */
  texte: 8_000,
  url: 2_048,
  titrePage: 300,
  ecran: 120,
  selecteurDom: 300,
  navigateur: 200,
  systeme: 200,
  fuseau: 100,
  /** Les dimensions de fenêtre. Au-delà, c’est du bruit, pas un écran. */
  viewport: 100_000,
  /** Le titre de la carte de compréhension — une phrase, sans point final. */
  titre: 200,
  /** Le résumé de la carte — 1 à 3 phrases. */
  resume: 1_000,
  /** La question du bot. ⛔ Deux phrases au maximum (01-Specs/entretien.md §3). */
  question: 400,
  /**
   * Le motif d’une question. ⚠️ Journalisé, jamais affiché au collaborateur —
   *    il sert à la mise au point du prompt (01-Specs/entretien.md).
   */
  motif: 500,
} as const

/** Les types de capture acceptés. ⛔ Liste close. */
export const TYPES_CAPTURE = ['image/webp', 'image/png', 'image/jpeg'] as const

/** Les types d’audio acceptés. ⛔ Liste close. */
export const TYPES_AUDIO = [
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
] as const

/**
 * Le chemin d’un tour d’entretien.
 *
 * ⚠️ Une fonction et non un gabarit : l’identifiant d’un retour est un cuid, et
 *    le concaténer à la main sur deux sites d’appel finit toujours par produire
 *    un `//` ou un `undefined` dans une URL.
 */
export function cheminTour(retour: string): string {
  return `${CHEMIN_RETOURS}/${encodeURIComponent(retour)}/tour`
}

/** Le chemin de fin d’entretien — envoi manuel ou abandon. */
export function cheminFin(retour: string): string {
  return `${CHEMIN_RETOURS}/${encodeURIComponent(retour)}/fin`
}

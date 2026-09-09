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

/**
 * L’en-tête qui porte le jeton d’identité signé par le serveur de l’hôte.
 *
 * ⚠️ Un en-tête et non un champ du corps : le corps EST la parole de quelqu’un,
 *    l’identité est une enveloppe. Et ⛔ le jeton n’est pas un cookie — le
 *    widget poste en `credentials: 'omit'`, l’hôte le lui passe par
 *    `window.feedys.identite` (D-005, 01-Specs/widget.md).
 */
export const EN_TETE_IDENTITE = 'x-feedys-identite'

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
  /** La situation d’écran déclarée par l’hôte (data-feedys-contexte). */
  situation: 120,
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
  /**
   * Le jeton d’identité, tel qu’il arrive dans l’en-tête.
   *
   * ⚠️ Une borne basse et volontaire : la charge tient en quatre champs courts.
   *    Au-delà, on ne calcule même pas d’empreinte — un en-tête d’un mégaoctet
   *    ne serait pas une identité, ce serait quelqu’un qui s’amuse.
   */
  jeton: 4_096,
  /** L’identifiant du collaborateur chez l’hôte. */
  auteurRef: 200,
  auteurNom: 200,
  /** « gestionnaire », « comptable »… Utile pour lire le retour, pas pour trier. */
  auteurRole: 120,
  /** Le message facultatif du développeur pour le collaborateur. */
  reponseTexte: 500,
  /**
   * La valeur d’un axe répondu d’un clic — `systematique`, `ralentit`…
   *
   * ⚠️ Courte et volontairement : ce n’est pas du texte libre, c’est une valeur
   *    d’énumération. La borne protège la table ; c’est `valeurDAxe` qui décide
   *    de l’appartenance, et lui seul.
   */
  valeurAxe: 40,
  /** Le nom d’une exception — `TypeError`, `AbortError`. ⛔ Jamais son message. */
  indiceNom: 120,
  /** Une trame de pile normalisée — `validerDossier (bundle.js:12:3345)`. */
  indiceTrame: 300,
  /** Un chemin d’API, segments identifiants remplacés par `:id`. */
  indiceChemin: 300,
  /** La méthode HTTP. ⚠️ Seul un indice POUSSÉ la connaît (D-026). */
  indiceMethode: 10,
  /**
   * L’identifiant de corrélation vers l’outil d’observabilité de l’hôte.
   *
   * ⚠️ Une borne large : un `traceparent` W3C fait 55 caractères, un id Sentry
   *    32, et personne ne sait ce que le prochain outil produira. Ce qui compte
   *    est que ce soit court ET opaque — Feedys ne le lit jamais.
   */
  indiceReference: 200,
  /**
   * L’écart entre l’indice et l’ouverture de la bulle, en millisecondes.
   *
   * ⚠️ Vingt-quatre heures, et ce n’est pas un filtre : c’est une borne de
   *    table. ⛔ LE COLLECTEUR NE JETTE RIEN SUR L’ÂGE — il date. Un écart de
   *    deux heures dit « probablement sans rapport », et c’est au développeur
   *    d’en juger, pas à un seuil codé en dur (D-026).
   */
  indiceEcartMs: 86_400_000,
} as const

/**
 * ─── LES INDICES TECHNIQUES ─────────────────────────────────────────────────
 *
 * ⛔ CE QUI EST ICI EST UNE FORME. Ce qui décide de ce qu’on collecte — quoi
 *    écouter, quoi normaliser, quoi refuser — est de la logique et vit dans
 *    `contexte/indices.ts`, côté MIT lui aussi mais séparément.
 */

/**
 * Les genres d’indice. ⛔ Liste close.
 *
 * - `js`   — une exception non capturée, ou un rejet de promesse non traité ;
 * - `http` — une requête de l’hôte revenue en 4xx ou 5xx.
 */
export const GENRES_INDICE = ['js', 'http'] as const

export type GenreIndice = (typeof GENRES_INDICE)[number]

/**
 * Le plafond d’indices joints à un retour.
 *
 * ⛔ TROIS, et il est appliqué PAR LE SERVEUR (le contrat le borne), pas
 *    seulement par le widget — exactement comme la limite de deux relances
 *    (D-006). Un widget forgé ne doit pas pouvoir transformer un retour en
 *    déversoir de journal.
 *
 * ⚠️ Trois parce qu’au-delà on ne lit plus : une liste de dix erreurs est un
 *    journal, et un journal ne se lit pas dans une fiche de retour.
 */
export const INDICES_MAX = 3

/**
 * ─── LES AXES D’UNE RÉPONSE D’UN CLIC ───────────────────────────────────────
 *
 * ⛔ CE QUI EST ICI EST UNE FORME, PAS DE LA LOGIQUE. Deux énumérations closes,
 *    partagées parce que les deux côtés doivent les lire de la même façon : le
 *    widget pour savoir quoi proposer, le serveur pour refuser le reste.
 *
 * ⛔ LES LIBELLÉS NE SONT PAS ICI, ET C’EST LE POINT DE
 *    [D-025](../../../00-Projet/DECISIONS_LOG.md). Le widget écrit les siens
 *    (`ui/textes.ts`, côté MIT), le serveur écrit les siens pour le fil
 *    (`domaine/entretien/axes.ts`, côté AGPL). Ce qui traverse la frontière est
 *    une valeur — `systematique` —, jamais du texte d’interface.
 *
 * ⛔ ET LE MODÈLE N’ÉCRIT AUCUN LIBELLÉ. Il déclare l’axe, le dépôt écrit les
 *    mots : c’est ce qui empêche une réponse d’un clic de faire entrer la prose
 *    du bot dans le fil, puis dans les citations
 *    ([BUGS_LOG](../../../03-Bugs/BUGS_LOG.md) 016).
 */

/**
 * Les axes sur lesquels une question se répond d’un clic.
 *
 * ⛔ DEUX, et pas un de plus. Ce sont les deux seules lignes fermées du tableau
 *    §Ce qu’il est utile de demander (01-Specs/entretien.md) : les quatre autres
 *    appellent un récit, et trois boutons sous une question ouverte
 *    remplaceraient ce récit par un mot.
 */
export const AXES = ['recurrence', 'ampleur'] as const

/**
 * Ce qu’on peut répondre sur chaque axe.
 *
 * ⚠️ Ces valeurs ne sont pas choisies ici : ce sont EXACTEMENT celles que la
 *    synthèse sait déjà ranger — `Synthese.recurrence` et `Synthese.impact`.
 *    `axes.test.ts`, côté serveur, refuse qu’elles divergent.
 *
 * ⚠️ `indetermine` n’est pas proposable : c’est l’échappatoire du modèle quand
 *    il ne sait pas, pas une réponse que quelqu’un donne.
 *
 * ⛔ Il n’y a pas de valeur « autre ». Elle ferait du bloc un choix obligatoire ;
 *    le champ texte et le micro SONT l’autre, au même niveau de visibilité.
 */
export const VALEURS_AXE = {
  recurrence: ['premiere_fois', 'deja_vu', 'systematique'],
  ampleur: ['bloque', 'ralentit', 'agace'],
} as const

export type Axe = (typeof AXES)[number]
export type ValeurAxe = (typeof VALEURS_AXE)[Axe][number]

/** La valeur appartient-elle bien à cet axe ? ⚠️ Pure, sans dépendance. */
export function valeurDAxe(axe: string, valeur: string): boolean {
  const connues: readonly string[] | undefined = (VALEURS_AXE as Record<string, readonly string[]>)[axe]
  return connues !== undefined && connues.includes(valeur)
}

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

/** Le chemin de relève des retours du collaborateur. */
export const CHEMIN_COLLABORATEUR = `${CHEMIN_RETOURS}/collaborateur`

/** Le chemin pour accuser réception d’un retour traité. */
export function cheminAccuse(retour: string): string {
  return `${CHEMIN_RETOURS}/${encodeURIComponent(retour)}/accuse`
}

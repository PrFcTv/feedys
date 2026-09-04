/**
 * Le contrat de transport entre le widget et le serveur.
 *
 * ⛔ Ce fichier vit du côté MIT, et c’est délibéré. `apps/serveur` (AGPL)
 *    l’IMPORTE ; jamais l’inverse. C’est le seul sens qui ne contamine pas
 *    l’hôte — 04-Architecture/licences.md.
 *
 * ⚠️ Il ne décrit QUE des formes de requêtes et de réponses. Aucune logique
 *    métier n’a le droit d’y descendre : le jour où elle y descendrait, le
 *    serveur importerait de la logique depuis un paquet MIT, et la frontière
 *    n’aurait plus de sens.
 *
 * ⚠️ Le widget n’importe ce module qu’en `import type` : zod ne doit pas entrer
 *    dans `widget.js`, dont le budget est de 60 Ko gzip (01-Specs/widget.md).
 *    C’est le serveur qui valide, et c’est lui qui paie zod.
 */
import { z } from 'zod'

import { BORNES, TYPES_AUDIO, TYPES_CAPTURE } from './transport'

/**
 * ⚠️ Les constantes vivent dans `transport.ts`, SANS zod, et sont réexportées
 *    ici. Elles sont les seules valeurs que le code du widget a le droit
 *    d’importer : passer par ce fichier-ci ferait entrer zod dans `widget.js`,
 *    26 Ko gzip pour trois nombres. Voir l’en-tête de `transport.ts`.
 */
export {
  BORNES,
  CHEMIN_RETOURS,
  EN_TETE_CLE,
  PREFIXE_CLE_PUBLIQUE,
  PREFIXE_SECRET,
  TYPES_AUDIO,
  TYPES_CAPTURE,
  cheminFin,
  cheminTour,
} from './transport'

/**
 * Un fichier joint, en base64.
 *
 * ⚠️ base64 et non multipart : le widget tient dans un seul `fetch` JSON, sans
 *    `FormData`, et le surcoût de 33 % reste sous la borne du corps.
 */
const fichier = <T extends readonly [string, ...string[]]>(types: T) =>
  z.object({
    type: z.enum(types),
    /** Le contenu, sans le préfixe `data:` — le widget le retire. */
    donnees: z.string().min(1),
  })

/**
 * Ce que le widget joint tout seul.
 *
 * ⛔ La liste est CLOSE : 01-Specs/widget.md §Ce que le widget joint tout seul.
 *    Le dépôt est public, elle doit pouvoir être lue par n’importe qui sans gêne.
 *    Un champ de plus ici est une décision de produit, pas un détail technique.
 *
 * ⚠️ Tout est facultatif sauf l’URL : la collecte est en échec-doux côté widget.
 *    Une capture qui rate n’empêche jamais l’envoi (P-004).
 */
export const SchemaContexte = z
  .object({
    url: z.string().min(1).max(BORNES.url),
    titrePage: z.string().max(BORNES.titrePage).optional(),
    ecran: z.string().max(BORNES.ecran).optional(),
    selecteurDom: z.string().max(BORNES.selecteurDom).optional(),
    navigateur: z.string().max(BORNES.navigateur).optional(),
    systeme: z.string().max(BORNES.systeme).optional(),
    viewportL: z.number().int().nonnegative().max(BORNES.viewport).optional(),
    viewportH: z.number().int().nonnegative().max(BORNES.viewport).optional(),
    fuseau: z.string().max(BORNES.fuseau).optional(),
    /**
     * L’horodatage du client. ⚠️ Indicatif : `cree_le` fait foi, il est posé par
     * la base. Une horloge de poste peut être fausse de plusieurs heures.
     */
    horodatage: z.iso.datetime({ offset: true }).optional(),
    /** Le contexte navigateur brut — le seul champ légitimement non structuré. */
    agentBrut: z.record(z.string(), z.unknown()).optional(),
    capture: fichier(TYPES_CAPTURE).optional(),
  })
  .strict()

/**
 * Le corps de `POST /api/retours`.
 *
 * ⛔ `texte` OU `audio` — au moins l’un des deux, les deux ensemble sont légitimes.
 *    Le serveur ne suppose JAMAIS que la transcription s’est faite chez le client :
 *    c’est ce qui ouvrira Whisper le jour où Chrome n’est plus tenable, sans
 *    réécriture ni migration (CLAUDE.md §La parole d’abord).
 */
export const SchemaCorpsRetour = z
  .object({
    texte: z.string().max(BORNES.texte).optional(),
    /**
     * Le transcript avant toute correction à la main. On garde les hésitations :
     * elles portent du sens (04-Architecture/conventions-db.md).
     */
    transcriptBrut: z.string().max(BORNES.texte).optional(),
    audio: fichier(TYPES_AUDIO).optional(),
    /**
     * ⚠️ Pas décoratif : c’est la mesure du pari du produit. Le widget le déclare
     *    parce qu’un transcript Web Speech est de la voix sans fichier audio —
     *    le serveur ne peut pas le deviner. Avec un audio, il vaut `voix` quoi
     *    qu’il arrive.
     */
    source: z.enum(['voix', 'texte']).optional(),
    contexte: SchemaContexte,
  })
  .strict()
  .refine((corps) => estNonVide(corps.texte) || corps.audio !== undefined, {
    message: 'Un retour porte du texte ou de l’audio.',
    path: ['texte'],
  })

function estNonVide(valeur: string | undefined): boolean {
  return valeur !== undefined && valeur.trim().length > 0
}

/** 201 — le retour est en base. C’est tout ce que le widget a besoin de savoir. */
export const SchemaRetourCree = z
  .object({
    retour: z.string().min(1),
  })
  .strict()

/**
 * Le corps d’une réponse en échec.
 *
 * ⛔ Le message est en français et ne dit rien de l’intérieur : ni requête SQL,
 *    ni nom de table, ni existence d’un produit voisin. `motif` est un code
 *    stable, destiné au widget et aux tests, pas à l’œil du collaborateur.
 */
export const SchemaErreur = z
  .object({
    motif: z.string().min(1),
    message: z.string().min(1),
  })
  .strict()

/**
 * ─── L’ENTRETIEN ────────────────────────────────────────────────────────────
 *
 * ⛔ Ce qui suit décrit des FORMES de requêtes et de réponses, et rien d’autre.
 *    La règle des deux relances, la machine à états et le choix des questions
 *    sont de la logique métier : ils vivent dans `apps/serveur/domaine/entretien`,
 *    du côté AGPL. Les faire descendre ici ferait importer de la logique au
 *    serveur depuis un paquet MIT, et la frontière n’aurait plus de sens
 *    (CLAUDE.md §frontière de licence).
 *
 * ⛔ Et surtout : la limite de deux relances est appliquée par le SERVEUR. Le
 *    widget ne la connaît pas, ne la compte pas, et ne pourrait pas la
 *    contourner en forgeant une requête — c’est tout l’intérêt.
 */

/**
 * Ce que le bot a compris, en champs corrigeables sur place.
 *
 * ⚠️ Ce n’est PAS un message de chat : c’est une fiche dont chaque champ se
 *    corrige d’un clic. Corriger une carte coûte un clic sur le champ faux ;
 *    corriger une phrase oblige à réexpliquer (01-Specs/entretien.md).
 */
export const SchemaComprehension = z
  .object({
    type: z.enum(['bug', 'idee', 'question', 'gene']),
    /** Une phrase, sans point final. */
    titre: z.string().min(1).max(BORNES.titre),
    /** 1 à 3 phrases, à la 3e personne. */
    resume: z.string().min(1).max(BORNES.resume),
    /** ⚠️ Déduit du contexte, jamais demandé (01-Specs/entretien.md §1). */
    ecran: z.string().max(BORNES.ecran).optional(),
    recurrence: z.enum(['premiere_fois', 'deja_vu', 'systematique']).optional(),
  })
  .strict()

/**
 * Le corps de `POST /api/retours/:id/tour`.
 *
 * ⚠️ Tout est facultatif : le PREMIER tour n’apporte rien de neuf — la parole
 *    d’origine est déjà en base, écrite par l’ingestion. Le widget demande
 *    simplement au bot de la lire.
 */
export const SchemaCorpsTour = z
  .object({
    /** Ce que la personne vient de dire ou d’écrire en réponse. */
    texte: z.string().max(BORNES.texte).optional(),
    /** Le transcript avant correction à la main. On garde les hésitations. */
    transcriptBrut: z.string().max(BORNES.texte).optional(),
    /**
     * Ce que la personne a corrigé sur la carte, rendu en clair par le widget.
     *
     * ⚠️ La carte n’a pas de bouton « valider » : on corrige, ça part avec le
     *    tour suivant ou avec l’envoi. Une correction n’est donc jamais perdue,
     *    et elle entre dans le fil comme ce qu’elle est — la personne qui
     *    reprend le bot (04-Architecture/DESIGN.md §La carte de compréhension).
     */
    corrections: z.string().max(BORNES.texte).optional(),
    source: z.enum(['voix', 'texte']).optional(),
  })
  .strict()

/**
 * Ce qu’un tour rend.
 *
 * ⚠️ `comprehension` est nullable, et ce n’est pas de la prudence : quand le
 *    transcript est vide ou inintelligible, le bot relance sans prétendre avoir
 *    compris quoi que ce soit. Une carte vide serait un mensonge.
 *
 * ⚠️ `question: null` veut dire « l’entretien est terminé » — soit le bot estime
 *    en savoir assez, soit la limite de relances est atteinte. Le widget ne fait
 *    pas la différence, et n’a pas à la faire.
 */
export const SchemaTourRendu = z
  .object({
    comprehension: SchemaComprehension.nullable(),
    question: z.string().max(BORNES.question).nullable(),
    /**
     * Pourquoi cette question.
     *
     * ⛔ JAMAIS AFFICHÉ AU COLLABORATEUR. Il est journalisé et sert à la mise au
     *    point du prompt : quand une question est mauvaise, c’est le motif qui
     *    dit pourquoi le modèle l’a choisie (01-Specs/entretien.md).
     */
    motif: z.string().max(BORNES.motif),
  })
  .strict()

/**
 * Le corps de `POST /api/retours/:id/fin`.
 *
 * ⛔ `abandonne` n’est pas un échec : « le retour est conservé et envoyé en
 *    l’état ». Un retour partiel vaut mieux que rien, et aucun mode de
 *    défaillance ne perd la parole de quelqu’un (01-Specs/entretien.md).
 */
export const SchemaCorpsFin = z
  .object({
    raison: z.enum(['envoi', 'abandon']),
    /**
     * ⛔ Ce que la personne venait d’écrire quand elle a cliqué sur « Envoyer
     *    maintenant ». Il PART AVEC LA FIN plutôt que d’être perdu : quelqu’un
     *    qui a tapé une phrase puis décidé d’en finir n’a pas voulu la jeter.
     */
    texte: z.string().max(BORNES.texte).optional(),
    transcriptBrut: z.string().max(BORNES.texte).optional(),
    corrections: z.string().max(BORNES.texte).optional(),
  })
  .strict()

/** Ce que la fin rend. Le widget n’en a besoin que pour cesser d’attendre. */
export const SchemaFinRendue = z
  .object({
    statut: z.enum(['envoye', 'abandonne']),
  })
  .strict()

export type Contexte = z.infer<typeof SchemaContexte>
export type CorpsRetour = z.infer<typeof SchemaCorpsRetour>
export type RetourCree = z.infer<typeof SchemaRetourCree>
export type Erreur = z.infer<typeof SchemaErreur>
export type Comprehension = z.infer<typeof SchemaComprehension>
export type CorpsTour = z.infer<typeof SchemaCorpsTour>
export type TourRendu = z.infer<typeof SchemaTourRendu>
export type CorpsFin = z.infer<typeof SchemaCorpsFin>
export type FinRendue = z.infer<typeof SchemaFinRendue>
/** Une capture d’écran jointe. */
export type FichierCapture = NonNullable<Contexte['capture']>
/** Un enregistrement audio joint. */
export type FichierAudio = NonNullable<CorpsRetour['audio']>
/** L’un ou l’autre — ce que le stockage sait ranger. */
export type Fichier = FichierCapture | FichierAudio

/** Le verdict d’une analyse de corps. Volontairement sans dépendance à zod. */
export type Analyse<T> = { readonly ok: true; readonly valeur: T } | { readonly ok: false; readonly message: string }

/**
 * Analyse un corps reçu.
 *
 * ⚠️ Le serveur passe par ici plutôt que par zod directement : c’est ce qui lui
 *    évite d’importer zod, et donc de dupliquer la version du validateur de part
 *    et d’autre de la frontière de licence.
 */
export function analyserCorpsRetour(valeur: unknown): Analyse<CorpsRetour> {
  return analyser(SchemaCorpsRetour, valeur)
}

/** Analyse le corps d’un tour d’entretien. */
export function analyserCorpsTour(valeur: unknown): Analyse<CorpsTour> {
  return analyser(SchemaCorpsTour, valeur)
}

/** Analyse le corps d’une fin d’entretien. */
export function analyserCorpsFin(valeur: unknown): Analyse<CorpsFin> {
  return analyser(SchemaCorpsFin, valeur)
}

function analyser<T>(schema: z.ZodType<T>, valeur: unknown): Analyse<T> {
  const resultat = schema.safeParse(valeur)

  if (resultat.success) {
    return { ok: true, valeur: resultat.data }
  }

  const premier = resultat.error.issues[0]
  const chemin = premier?.path.join('.')

  return {
    ok: false,
    message: chemin ? `${chemin} — ${premier?.message ?? 'invalide'}` : (premier?.message ?? 'Corps invalide.'),
  }
}

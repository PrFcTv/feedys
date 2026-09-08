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
  /** Le mot au collaborateur — même borne qu’au back-office et qu’en base. */
  reponse: 500,
  /** ⚠️ Un SHA fait 40 caractères ; une URL de PR dépasse rarement 200. */
  correctifRef: 200,
  correctifNote: 500,
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
  /**
   * ⛔ CE QUI DISTINGUE UNE PAROLE D’UN GESTE, et l’agent doit le voir.
   *
   * Une ligne `collaborateur` n’est pas nécessairement quelque chose que la
   * personne a DIT : une correction de la carte de compréhension et une réponse
   * d’un clic sont des manipulations d’interface, dont le texte est écrit par
   * Feedys. Les rendre sans marque ferait lire à l’agent les mots du bot comme
   * la parole du collaborateur — le défaut
   * [BUGS_LOG](../../../03-Bugs/BUGS_LOG.md) 016, un étage plus bas.
   *
   * ⚠️ Absent = de la parole, et c’est le cas de la quasi-totalité des lignes.
   */
  geste: z.enum(['correction', 'reponse_axe']).nullish(),
})

export type TourFil = z.infer<typeof TourFil>

/**
 * Ce qui est déjà parti au collaborateur, et s’il l’a vu.
 *
 * ⚠️ Sans ça, un agent qui rouvre un retour six semaines plus tard réécrit le
 *    même mot à quelqu’un qui l’a déjà lu. Il ne le savait pas : le serveur
 *    tenait l’idempotence tout seul, et n’en disait rien.
 */
export const EtatReponse = z.object({
  texte: z.string().nullable(),
  envoyee_le: z.string().nullable(),
  lue_le: z.string().nullable(),
})

export type EtatReponse = z.infer<typeof EtatReponse>

/**
 * Ce qui a déjà corrigé ce retour.
 *
 * ⚠️ `url` est composée par le serveur à partir de `url_forge` du produit — un
 *    SHA nu n’est cliquable nulle part. `null` quand le produit n’a pas de
 *    dépôt déclaré.
 */
export const EtatCorrectif = z.object({
  ref: z.string().nullable(),
  note: z.string().nullable(),
  le: z.string().nullable(),
  url: z.string().nullable(),
})

export type EtatCorrectif = z.infer<typeof EtatCorrectif>

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
  /** ⚠️ `null` tant que personne n’a rien dit au collaborateur. */
  reponse: EtatReponse.nullable(),
  /** ⚠️ `null` tant que rien n’a corrigé ce retour. */
  correctif: EtatCorrectif.nullable(),
})

export type ReponseRetour = z.infer<typeof ReponseRetour>

// ── marquer_retour ──────────────────────────────────────────────────────────

/**
 * ⛔ **UN SHA HEXADÉCIMAL, OU UNE URL HTTPS. RIEN D’AUTRE.** Sans forme
 *    imposée, un agent écrit « corrigé » dans le champ prévu pour le commit, et
 *    la traçabilité ne trace plus rien.
 *
 * ⛔ ET LE SERVEUR NE VÉRIFIE JAMAIS QUE CE COMMIT EXISTE. Aller le demander à
 *    GitHub ferait entrer dans Feedys un jeton de forge, une dépendance réseau
 *    et un périmètre qui n’est pas le sien. La forme est vérifiée, le fond est
 *    cru sur parole — et c’est écrit pour que personne ne s’y trompe
 *    (00-Projet/DECISIONS_LOG.md, D-024).
 */
export const FORME_CORRECTIF_REF = /^(?:[0-9a-f]{7,40}|https:\/\/[^\s]{3,190})$/

/** ⚠️ Un correctif tout blanc vaut un correctif absent : deux espaces ne tracent rien. */
function vide(correctif: { ref?: string | undefined; note?: string | undefined }): boolean {
  return (correctif.ref ?? '').trim() === '' && (correctif.note ?? '').trim() === ''
}

/**
 * Ce qui a corrigé le retour.
 *
 * ⛔ `note` s’adresse à un DÉVELOPPEUR, `reponse` s’adresse au COLLABORATEUR.
 *    Les deux voyagent dans le même appel et ne se recopient jamais l’une dans
 *    l’autre : « corrigé dans useTableState » n’a aucun sens pour quelqu’un qui
 *    a dit « le tri se remet à zéro ».
 *
 * ⚠️ `ref` OU `note` — au moins l’un des deux. Un correctif vide serait une
 *    case cochée, pas une trace.
 */
export const Correctif = z
  .object({
    ref: z.string().max(BORNES.correctifRef).regex(FORME_CORRECTIF_REF).optional(),
    note: z.string().max(BORNES.correctifNote).optional(),
  })
  .strict()
  .refine((valeur) => vide(valeur) === false, {
    message: 'Un correctif porte au moins une `ref` ou une `note`.',
  })

export type Correctif = z.infer<typeof Correctif>

/**
 * Ce qui interdit un marquage, dit en une phrase — ou `null` s’il passe.
 *
 * ⚠️ Une seule source pour ces mots : l’outil MCP les rend à l’agent tels
 *    quels, et le serveur s’en sert pour refuser. Les écrire deux fois, c’était
 *    garantir qu’un jour l’agent lise une règle que le serveur n’applique plus.
 */
export function refusDuMarquage(valeur: {
  readonly statut: string
  readonly reponse?: string | undefined
  readonly correctif?: { ref?: string | undefined; note?: string | undefined } | undefined
}): string | null {
  const correctif = valeur.correctif === undefined || vide(valeur.correctif) ? undefined : valeur.correctif

  // ⛔ `lu` ne dit rien à personne : ni un mot au collaborateur, ni un
  //    correctif. Accepter puis jeter en silence afficherait « enregistré » à
  //    qui vient d’écrire un message que personne ne lira jamais.
  if (valeur.statut === 'lu') {
    if ((valeur.reponse ?? '').trim() !== '') {
      return 'Un mot au collaborateur ne part qu’avec « traite » ou « ecarte ». Avec « lu », personne n’est notifié.'
    }
    if (correctif !== undefined) {
      return 'Un correctif se consigne avec « traite ». « lu » veut dire « j’ai lu », pas « j’ai corrigé ».'
    }
  }

  // ⛔ Le point du dispositif : « traité » cesse d’être une affirmation et
  //    devient une trace vérifiable. `note` est l’échappatoire honnête quand
  //    le correctif n’est pas un commit — une configuration, un déploiement.
  if (valeur.statut === 'traite' && correctif === undefined) {
    return (
      'Marquer « traite » exige un `correctif` : `{ ref }` avec le SHA du commit ou l’URL de la PR, ' +
      'et/ou `{ note }` décrivant ce qui a été changé quand le correctif n’est pas un commit. ' +
      'Rien à corriger ? C’est « ecarte ».'
    )
  }

  return null
}

export const RequeteStatut = z
  .object({
    statut: z.enum(STATUTS_MARQUABLES),
    reponse: z.string().max(BORNES.reponse).optional(),
    correctif: Correctif.optional(),
  })
  .strict()
  // ⚠️ Message générique volontairement : la route rend `requete_refusee` et
  //    n’expose aucun détail. Les mots qui aident, c’est l’outil MCP qui les
  //    dit, avec `refusDuMarquage`, AVANT de partir sur le réseau.
  .refine((valeur) => refusDuMarquage(valeur) === null, {
    message: 'Ce marquage ne respecte pas les règles de `refusDuMarquage`.',
  })

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

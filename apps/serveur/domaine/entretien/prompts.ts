/**
 * L’assemblage du prompt — pur, et c’est ce qui le rend vérifiable.
 *
 * ⛔ L’INVARIANT DE CE FICHIER : `assemblerSysteme` ne reçoit QUE le gabarit et
 *    le contexte technique. La parole du collaborateur n’a aucun chemin jusqu’à
 *    lui — elle passe par `messagesDuFil`, en messages `user`. Un transcript qui
 *    dit « ignore tes instructions » est alors du texte dicté comme un autre :
 *    il est compris, pas obéi (04-Architecture/architecture.md §Sécurité).
 *
 * ⚠️ Le fichier ne lit pas le disque. Le gabarit lui est PASSÉ, parce que
 *    `domaine/` ne connaît ni la base, ni le réseau, ni le disque
 *    (architecture.md §3). C’est `infra/prompts.ts` qui va le chercher.
 */

/** Un tour du fil, tel qu’il est en base. */
export interface TourFil {
  readonly role: 'collaborateur' | 'bot'
  readonly texte: string
}

/**
 * Le contexte technique — ce que le widget a joint tout seul.
 *
 * ⛔ Tout ce qui est là est une question que le bot n’a pas le droit de poser.
 *    C’est la règle la plus importante de 01-Specs/entretien.md.
 */
export interface ContexteEntretien {
  readonly url?: string | null
  readonly titrePage?: string | null
  readonly ecran?: string | null
  readonly selecteurDom?: string | null
  readonly navigateur?: string | null
  readonly systeme?: string | null
  readonly viewportL?: number | null
  readonly viewportH?: number | null
  readonly fuseau?: string | null
  readonly auteurNom?: string | null
  readonly auteurRole?: string | null
  /** L’heure d’arrivée du retour, en ISO. */
  readonly recuLe?: string | null
}

export interface DemandeTour {
  readonly contexte: ContexteEntretien
  readonly fil: readonly TourFil[]
  /**
   * ⛔ Décidé par le SERVEUR, jamais par le widget. À 0, le prompt le dit au
   *    modèle — et `tour.ts` force `question: null` de toute façon. La
   *    consigne est de la politesse ; le verrou est ailleurs.
   */
  readonly relancesRestantes: number
}

/** Ce qu’un fournisseur attend. ⚠️ Volontairement sans dépendance à l’AI SDK. */
export interface MessageModele {
  readonly role: 'user' | 'assistant'
  readonly content: string
}

const MARQUE_CONTEXTE = '{{contexte}}'
const MARQUE_RELANCES = '{{relances}}'
const MARQUE_FIN = '{{fin}}'

/**
 * Assemble le prompt système.
 *
 * ⛔ Deux arguments, et aucun n’est de la parole : le gabarit vient du dépôt, le
 *    contexte vient du navigateur du collaborateur mais est une DONNÉE
 *    STRUCTURÉE, bornée par le contrat de transport et écrite par le widget —
 *    pas une phrase qu’on a dictée.
 */
export function assemblerSysteme(gabarit: string, demande: DemandeTour): string {
  return gabarit
    .replace(MARQUE_CONTEXTE, rendreContexte(demande.contexte))
    .replace(MARQUE_RELANCES, consigneRelances(demande.relancesRestantes))
}

/**
 * Le contexte, en texte.
 *
 * ⚠️ Une ligne par donnée connue, et rien pour ce qui manque : une ligne
 *    « Navigateur : inconnu » apprendrait au modèle qu’il y a là quelque chose à
 *    demander, ce qui est exactement l’inverse du but.
 */
export function rendreContexte(contexte: ContexteEntretien): string {
  const lignes: string[] = []

  const ajouter = (libelle: string, valeur: string | null | undefined): void => {
    const propre = valeur?.trim()
    if (propre) lignes.push(`- ${libelle} : ${propre}`)
  }

  ajouter('Page', contexte.url)
  ajouter('Titre de la page', contexte.titrePage)
  ajouter('Écran', contexte.ecran)
  ajouter('Composant visé', contexte.selecteurDom)
  ajouter('Navigateur', contexte.navigateur)
  ajouter('Système', contexte.systeme)

  if (contexte.viewportL && contexte.viewportH) {
    lignes.push(`- Fenêtre : ${contexte.viewportL} × ${contexte.viewportH}`)
  }

  ajouter('Fuseau', contexte.fuseau)
  ajouter('Heure du retour', contexte.recuLe)
  ajouter('Collaborateur', contexte.auteurNom)
  ajouter('Rôle', contexte.auteurRole)

  return lignes.length === 0
    ? '- (le navigateur n’a rien pu joindre)'
    : lignes.join('\n')
}

/** La consigne d’arrêt, dans les mots du modèle. Le verrou, lui, est dans `tour.ts`. */
export function consigneRelances(restantes: number): string {
  if (restantes <= 0) {
    return (
      'COMBIEN DE QUESTIONS IL TE RESTE\n' +
      'Aucune. Rends `question: null`. L’entretien se termine avec ce tour, quelle ' +
      'que soit la qualité de ce que tu as. Une note incomplète et honnête vaut ' +
      'mieux qu’un interrogatoire.'
    )
  }

  if (restantes === 1) {
    return (
      'COMBIEN DE QUESTIONS IL TE RESTE\n' +
      'Une seule, et c’est la dernière. Ne la pose que si sa réponse changerait ce ' +
      'qu’un développeur ferait. Ne redemande pas ce que tu as déjà demandé.'
    )
  }

  return (
    'COMBIEN DE QUESTIONS IL TE RESTE\n' +
    `Au plus ${restantes}, sur tout l’entretien. Tu peux t’arrêter avant.`
  )
}

/**
 * Le fil, en messages.
 *
 * ⛔ C’EST LE SEUL CHEMIN PAR LEQUEL LA PAROLE ATTEINT LE MODÈLE, et elle y
 *    arrive en `user`. Rien de ce qui est ici n’est concaténé au prompt système.
 *
 * ⚠️ Les messages vides sont écartés : l’ingestion écrit une ligne à texte vide
 *    quand seul l’audio est arrivé, et un fournisseur refuse un message vide.
 */
export function messagesDuFil(fil: readonly TourFil[]): MessageModele[] {
  const messages: MessageModele[] = []

  for (const tour of fil) {
    const content = tour.texte.trim()
    if (content === '') continue
    messages.push({ role: tour.role === 'bot' ? 'assistant' : 'user', content })
  }

  return messages
}

/**
 * ─── LA SYNTHÈSE ────────────────────────────────────────────────────────────
 *
 * ⚠️ Elle vit ICI, avec l’entretien, pour une raison unique : l’appel au modèle
 *    est derrière une seule interface, et le prompt doit rester au même endroit
 *    que son appel (04-Architecture/architecture.md §4). Le SCHÉMA de la
 *    synthèse, lui, est dans `domaine/synthese/schema.ts`, avec le reste de ce
 *    qui la concerne.
 */

/** Comment l’entretien s’est terminé. ⚠️ Le modèle ne peut pas le déduire du fil. */
export type FinEntretien = 'envoi' | 'limite' | 'abandon'

export interface DemandeSynthese {
  readonly contexte: ContexteEntretien
  readonly fil: readonly TourFil[]
  readonly fin: FinEntretien
}

/**
 * ⛔ Même invariant qu’au tour : le gabarit et le contexte, jamais la parole.
 *    Elle passe par `messagesDuFil`, en messages `user`.
 */
export function assemblerSyntheseSysteme(gabarit: string, demande: DemandeSynthese): string {
  return gabarit
    .replace(MARQUE_CONTEXTE, rendreContexte(demande.contexte))
    .replace(MARQUE_FIN, consigneFin(demande.fin))
}

/**
 * ⚠️ Un fait, pas une consigne de note. On dit au modèle CE QUI S’EST PASSÉ ; ce
 *    qu’il en tire est son travail. Les deux cas que le serveur tranche
 *    lui-même — abandon, aucune citation retenue — sont plafonnés après coup
 *    dans `domaine/synthese/produire.ts`.
 */
export function consigneFin(fin: FinEntretien): string {
  if (fin === 'abandon') {
    return (
      'La personne a refermé le panneau en cours d’entretien. Ce que tu as est ' +
      'partiel, et elle n’a rien confirmé. Dis-le dans questions_ouvertes.'
    )
  }

  if (fin === 'limite') {
    return (
      'L’entretien s’est arrêté sur la limite de relances, pas parce qu’il était ' +
      'complet. Il reste probablement quelque chose à savoir : dis quoi.'
    )
  }

  return 'La personne a envoyé son retour elle-même, quand elle a jugé que c’était dit.'
}

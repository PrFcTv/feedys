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

/**
 * Ce qui, dans une ligne `collaborateur`, N’EST PAS de la parole.
 *
 * ⛔ `null` — l’absence de geste — veut dire « la personne l’a dit ». Tout le
 *    reste vient d’une manipulation d’interface : le texte de la ligne est alors
 *    fabriqué à partir de ce que le BOT avait écrit, et il ne peut pas devenir
 *    une citation ([BUGS_LOG](../../../../03-Bugs/BUGS_LOG.md) 016,
 *    [D-025](../../../../00-Projet/DECISIONS_LOG.md)).
 *
 * ⚠️ `reponse_axe` n’a pas encore de producteur : il arrive avec P-026. Il est
 *    déclaré ici comme il l’est dans l’énumération Postgres, et pour la même
 *    raison — `alter type … add value` ne permet pas d’employer la valeur dans
 *    la transaction qui l’ajoute.
 */
export type GesteMessage = 'correction' | 'reponse_axe'

/** Les gestes connus, pour relire ce que la base rend sans faire confiance. */
export const GESTES: readonly GesteMessage[] = ['correction', 'reponse_axe']

/** Un tour du fil, tel qu’il est en base. */
export interface TourFil {
  readonly role: 'collaborateur' | 'bot'
  readonly texte: string
  /**
   * ⛔ Absent ou `null` = de la parole. Renseigné = une manipulation
   *    d’interface, jamais citable (§`GesteMessage`).
   */
  readonly geste?: GesteMessage | null
  /**
   * L’axe répondu d’un clic, et sa valeur (P-026).
   *
   * ⚠️ Portés par le FIL et pas à côté : ce qui a été répondu s’est passé à un
   *    tour précis, et la synthèse doit pouvoir lire le DERNIER état — quelqu’un
   *    qui clique « ça bloque » puis « ça ralentit » a changé d’avis, et c’est
   *    le second qui compte.
   */
  readonly axe?: string | null
  readonly valeurAxe?: string | null
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
  /** La situation d’écran déclarée par l’hôte (data-feedys-contexte). */
  readonly situation?: string | null
  /** Le vocabulaire métier et glossaire du logiciel hôte. */
  readonly contexteMetier?: string | null
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
  /**
   * Ce que le navigateur a relevé avant l’ouverture (P-028, D-026).
   *
   * ⛔ ILS SONT LÀ POUR QUE LE BOT SE TAISE, PAS POUR QU’IL PARLE. Leur seul
   *    emploi légitime est de ne pas demander ce qu’on sait déjà — « est-ce que
   *    vous avez eu un message d’erreur ? » quand on a l’exception sous les
   *    yeux. Les citer, les commenter ou en tirer une cause serait un
   *    diagnostic, et le bot n’en pose aucun (01-Specs/entretien.md §règle 4).
   */
  readonly indices?: readonly IndiceEntretien[]
}

/** Un indice, tel que le prompt le voit. ⛔ Il n’y a pas de `message`. */
export interface IndiceEntretien {
  readonly genre: string
  readonly nom?: string | null
  readonly trame?: string | null
  readonly statut?: number | null
  readonly chemin?: string | null
  readonly methode?: string | null
  readonly ecartMs?: number | null
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
const MARQUE_METIER = '{{metier}}'
const MARQUE_INDICES = '{{indices}}'
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
  const metier = rendreMetier(demande.contexte)
  return gabarit
    .replace(MARQUE_CONTEXTE, rendreContexte(demande.contexte))
    .replace(MARQUE_METIER, metier)
    .replace(MARQUE_INDICES, rendreIndices(demande.contexte))
    .replace(MARQUE_RELANCES, consigneRelances(demande.relancesRestantes))
    .replace(/\n{3,}/g, '\n\n')
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

/**
 * Les indices techniques, en texte.
 *
 * ⚠️ SÉPARÉS DU CONTEXTE, et pas fondus dedans. Le contexte est ce que le bot
 *    sait de la SITUATION ; les indices sont ce que la machine a relevé, et ils
 *    appellent une consigne qui leur est propre — celle du gabarit, juste sous
 *    la marque. Les mêler ferait perdre cette consigne de vue.
 *
 * ⚠️ L’écart est rendu en clair parce que c’est l’information la plus utile de
 *    la ligne : « il y a 3 s » et « il y a 2 h » ne pèsent pas pareil, et le
 *    modèle doit pouvoir en tenir compte pour décider de ne PAS poser une
 *    question plutôt que d’en poser une.
 *
 * ⛔ Rend une chaîne vide quand il n’y a rien : une ligne « aucun indice »
 *    apprendrait au modèle qu’il y a là quelque chose à demander, ce qui est
 *    exactement l’inverse du but — même raisonnement que `rendreContexte`.
 */
export function rendreIndices(contexte: ContexteEntretien): string {
  const indices = contexte.indices ?? []
  if (indices.length === 0) return ''

  const lignes = indices.map((indice) => {
    const quand = indice.ecartMs === undefined || indice.ecartMs === null ? '' : ` (${depuis(indice.ecartMs)})`

    if (indice.genre === 'http') {
      const methode = indice.methode ? `${indice.methode} ` : ''
      return `- requête ${indice.statut ?? '?'} sur ${methode}${indice.chemin ?? '?'}${quand}`
    }

    return `- exception ${indice.nom ?? '?'}${indice.trame ? ` dans ${indice.trame}` : ''}${quand}`
  })

  return `CE QUE LE NAVIGATEUR A RELEVÉ AVANT L’OUVERTURE
${lignes.join('\n')}
${CONSIGNE}`
}

/**
 * ⛔ LA CONSIGNE EST COLLÉE AUX DONNÉES, DANS LA MÊME CHAÎNE, ET C’EST
 *    STRUCTUREL. Elle aurait pu vivre dans `prompts/systeme.md` comme le reste
 *    de la prose — mais alors quelqu’un pourrait un jour retoucher le gabarit
 *    et laisser les lignes techniques sans leur garde-fou, sans que rien ne
 *    l’avertisse. Ici, **on ne peut pas avoir les indices sans la règle** : le
 *    même `return` produit les deux, et `prompts.test.ts` le vérifie.
 *
 * ⚠️ Le précédent existe : `consigneRelances` fabrique déjà de la prose ici
 *    plutôt que dans le gabarit, pour la même raison — elle dépend de l’état.
 */
const CONSIGNE = `⛔ Ces lignes ne se citent pas, ne se commentent pas et ne se diagnostiquent pas.
Tu ne dis JAMAIS à la personne ce qui a été relevé : ni « j’ai vu une erreur », ni
« le serveur a répondu 500 », ni « c’est un problème de… ». Elles ne servent qu’à
UNE chose : ne pas demander ce qu’on sait déjà. Si elles rendent ta question
inutile, pose-en une autre, ou n’en pose aucune.`

/** ⚠️ Approximatif et assumé : la seconde exacte ne dit rien de plus. */
function depuis(ecartMs: number): string {
  const secondes = Math.round(ecartMs / 1000)
  if (secondes < 60) return `il y a ${secondes} s`

  const minutes = Math.round(secondes / 60)
  return minutes < 60 ? `il y a ${minutes} min` : `il y a ${Math.round(minutes / 60)} h`
}

/**
 * Le contexte métier du produit et la situation d’écran (P-02X).
 *
 * ⚠️ Si aucun contexte métier n’est défini, rend une chaîne vide pour que le
 *    prompt se replie proprement sur son comportement neutre actuel.
 */
export function rendreMetier(contexte: ContexteEntretien): string {
  const metier = contexte.contexteMetier?.trim()
  const situation = contexte.situation?.trim()

  const lignes: string[] = []
  if (metier) {
    lignes.push(`- Métier du logiciel : ${metier}`)
  }
  if (situation) {
    lignes.push(`- Situation immédiate de l’écran : ${situation}`)
  }

  if (lignes.length === 0) return ''

  return ['CONTEXTE MÉTIER ET SITUATION', ...lignes].join('\n')
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
  const metier = rendreMetier(demande.contexte)
  return gabarit
    .replace(MARQUE_CONTEXTE, rendreContexte(demande.contexte))
    .replace(MARQUE_METIER, metier)
    .replace(MARQUE_FIN, consigneFin(demande.fin))
    .replace(/\n{3,}/g, '\n\n')
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

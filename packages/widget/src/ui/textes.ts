/**
 * Tout ce que le widget dit, au même endroit.
 *
 * ⚠️ POURQUOI CE FICHIER EXISTE. Les textes étaient en dur dans le JSX, à
 *    l’endroit du rendu. Une phrase qu’on ne peut pas lire d’un coup d’œil à
 *    côté des autres est une phrase qu’on n’arbitre pas : c’est comme ça que
 *    « Répondez, ou corrigez la fiche au-dessus » a survécu à un état où il n’y
 *    a pas de fiche ([BUGS_LOG](../../../../03-Bugs/BUGS_LOG.md) 004).
 *
 * ⛔ LES QUATRE RÈGLES DE CE QUI S’ÉCRIT ICI, dans un état dégradé :
 *    1. ne pas s’excuser ;
 *    2. ne pas expliquer ce qui manque — le collaborateur n’a pas à savoir
 *       qu’un modèle est tombé, ce n’est pas son affaire ;
 *    3. ne rien promettre ;
 *    4. ne rien diagnostiquer.
 *    Ce qui reste : **inviter à continuer**.
 *
 * ⚠️ L’apostrophe s’écrit `’` (U+2019), jamais `'` (DESIGN.md).
 *
 * ⛔ Ce fichier ne contient aucune couleur, aucune classe, aucun style : des
 *    mots, et rien d’autre.
 */

/** Le lanceur, l’en-tête, l’accusé. */
export const TEXTES = {
  lanceur: 'Un retour',
  titre: 'Qu’est-ce qui se passe ?',
  fermer: 'Fermer',

  /** ⚠️ Affiché seulement quand il n’y a pas encore de carte à regarder. */
  attente: 'Un instant…',

  accuse: {
    titre: 'C’est parti.',
    detail: 'Merci — vous n’avez rien d’autre à faire.',
  },

  separateur: 'ou',

  boutons: {
    repondre: 'Répondre',
    envoyer: 'Envoyer',
    envoyerMaintenant: 'Envoyer maintenant',
    envoiEnCours: 'Envoi…',
  },

  ecoute: {
    attente: 'Allez-y, je vous écoute.',
    annulerPointeur: '← glisser pour annuler',
    annulerClavier: 'Échap pour annuler',
  },

  micro: {
    parler: 'Parler — maintenir pour dicter',
    terminer: 'Terminer la dictée',
    maintenir: 'maintenir pour parler',
    relacher: 'relâchez pour terminer',
    mainsLibres: 'j’écoute — cliquez pour terminer',
  },
} as const

/**
 * Ce qu’on dit quand l’onde ne viendra pas.
 *
 * ⚠️ Deux causes, deux phrases. `refuse` est une décision de la personne, et le
 *    dire évite qu’elle croie le produit cassé ; `indisponible` est une absence
 *    du navigateur, et ⛔ on ne la lui explique pas — on constate ce qu’elle
 *    voit, une onde qui ne bouge pas.
 *
 * ⛔ Dans les deux cas, la dictée CONTINUE : c’est ça, l’information utile.
 */
export const SANS_ONDE = {
  refuse: 'Le micro est refusé pour ce site. La dictée continue sans l’onde.',
  indisponible: 'La dictée continue, sans l’onde.',
} as const

/**
 * L’invite du champ de saisie.
 *
 * ⛔ ELLE DÉPEND DE CE QUI EST RÉELLEMENT À L’ÉCRAN, pas de la phase. C’est
 *    tout le défaut 004 : `phase === 'entretien'` restait vrai alors que la
 *    carte n’était jamais arrivée, et le champ invitait à corriger une fiche
 *    absente.
 *
 * ⚠️ Quatre situations produisent « en entretien, sans carte », et une seule
 *    est un échec : le premier tour qui charge encore, le tour qui a échoué, le
 *    tour rendu sans compréhension, et le tour dont la question conclut. La
 *    même invite doit tenir pour les quatre.
 */
export function inviteChamp(etat: {
  readonly enEntretien: boolean
  readonly aCarte: boolean
  readonly aQuestion: boolean
}): { readonly ariaLabel: string; readonly placeholder: string } {
  if (!etat.enEntretien) {
    return {
      ariaLabel: 'Votre retour',
      placeholder: 'Ce qui vous a bloqué, ou l’idée qui vient de vous venir.',
    }
  }

  if (etat.aCarte) {
    return { ariaLabel: 'Votre réponse', placeholder: 'Répondez, ou corrigez la fiche au-dessus.' }
  }

  // ⚠️ Une question sans carte : il y a bien quelque chose à quoi répondre,
  //    mais rien à corriger.
  if (etat.aQuestion) {
    return { ariaLabel: 'Votre réponse', placeholder: 'Répondez, ou ajoutez ce qui vous revient.' }
  }

  // ⛔ Ni carte ni question. On n’explique pas pourquoi : on invite à continuer.
  return { ariaLabel: 'Votre réponse', placeholder: 'Ajoutez ce qui vous revient.' }
}

/**
 * Ce qu’on dit quand un tour d’entretien n’aboutit pas.
 *
 * ⚠️ Le silence était le vrai défaut : on cliquait « Répondre », et il ne se
 *    passait RIEN à l’écran. Cette phrase dit la seule chose qui compte pour la
 *    personne — sa parole est arrivée — et invite à finir.
 *
 * ⛔ Elle ne dit pas que le bot est tombé. Le serveur, lui, le sait et le dit
 *    dans son propre message ; ce message ne remonte volontairement pas
 *    jusqu’ici (`entretien.ts`).
 */
export const TOUR_SANS_SUITE = 'C’est noté. Ajoutez ce que vous voulez, ou envoyez.'

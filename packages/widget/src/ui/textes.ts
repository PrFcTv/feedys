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
 *
 * ⚠️ `import type` seulement depuis `contrat` — il tire zod, et zod pèse 26 Ko
 *    gzip sur un budget de 60. Les VALEURS viennent de `transport`
 *    (`budget.test.ts`).
 */
import type { Axe, ValeurAxe } from '../contrat'

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

  notification: {
    action: 'J’ai vu',
    /** ⚠️ Le nom accessible du lanceur quand la pastille est là. Jamais affiché. */
    attente: 'une réponse vous attend',
  },
} as const

/**
 * Les réponses d’un clic — ce que portent les boutons sous la question.
 *
 * ⛔ ÉCRITS ICI, ET PAS DEMANDÉS AU MODÈLE. C’est le point de
 *    [D-025](../../../../00-Projet/DECISIONS_LOG.md) : le modèle déclare l’axe,
 *    le dépôt écrit les mots. Le laisser rédiger « Systématique » ferait entrer
 *    sa prose dans le fil comme si la personne l’avait dite —
 *    [BUGS_LOG](../../../../03-Bugs/BUGS_LOG.md) 016, refermé la veille.
 *
 * ⛔ CE QUI PART SUR LE FIL EST LA VALEUR, JAMAIS LE LIBELLÉ. Le serveur écrit
 *    ses propres mots de son côté ; ces deux listes n’ont aucune raison de
 *    coïncider, et rien ne les compare.
 *
 * ⚠️ Rédigés comme on RÉPOND, pas comme on étiquette : « Ça me ralentit » et non
 *    « Ralentit ». Un bouton qui nomme une catégorie fait remplir un formulaire ;
 *    un bouton qui dit une phrase fait répondre à quelqu’un.
 *
 * ⛔ Pas de bouton « Autre ». Il ferait du bloc un choix obligatoire, alors que
 *    le champ texte et le micro sont juste en dessous, au même niveau.
 */
export const PROPOSITIONS: Readonly<
  Record<Axe, readonly { readonly valeur: ValeurAxe; readonly libelle: string }[]>
> = {
  recurrence: [
    { valeur: 'premiere_fois', libelle: 'C’est la première fois' },
    { valeur: 'deja_vu', libelle: 'C’est déjà arrivé' },
    { valeur: 'systematique', libelle: 'À chaque fois' },
  ],
  ampleur: [
    { valeur: 'bloque', libelle: 'Ça me bloque' },
    { valeur: 'ralentit', libelle: 'Ça me ralentit' },
    { valeur: 'agace', libelle: 'Ça m’agace' },
  ],
}

/**
 * ⚠️ Le nom accessible du groupe. ⛔ Pas de `radiogroup` : ce n’est pas un choix
 *    obligatoire, et l’annoncer comme tel dirait à un lecteur d’écran qu’il faut
 *    trancher parmi trois options — exactement ce que le produit refuse.
 */
export const PROPOSITIONS_LIBELLE = 'Réponses rapides'

/** Titre sobre de notification d’un retour traité pour le collaborateur. */
export function titreNotification(titre?: string | null): string {
  const propre = titre?.trim()
  if (propre) {
    return `Votre retour sur « ${propre} » a été pris en compte.`
  }
  return 'Votre retour a été pris en compte.'
}

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
  // ⛔ CE QUI EST À L’ÉCRAN PASSE AVANT LA PHASE, et l’ordre de ces trois tests
  //    EST le contrat. Il ne l’était pas : `!enEntretien` était testé en
  //    premier, et `enEntretien` vaut `phase === 'entretien'` — donc `false` dès
  //    qu’on clique « Envoyer maintenant », alors que la carte est
  //    DÉLIBÉRÉMENT maintenue à l’écran le temps de la requête. Le champ
  //    repassait à l’invite d’accueil, et l’`aria-label` de « Votre réponse » à
  //    « Votre retour », sous une fiche toujours affichée — annoncé comme tel
  //    par un lecteur d’écran.
  if (etat.aCarte) {
    return { ariaLabel: 'Votre réponse', placeholder: 'Répondez, ou corrigez la fiche au-dessus.' }
  }

  // ⚠️ Une question sans carte : il y a bien quelque chose à quoi répondre,
  //    mais rien à corriger.
  if (etat.aQuestion) {
    return { ariaLabel: 'Votre réponse', placeholder: 'Répondez, ou ajoutez ce qui vous revient.' }
  }

  if (!etat.enEntretien) {
    return {
      ariaLabel: 'Votre retour',
      placeholder: 'Ce qui vous a bloqué, ou l’idée qui vient de vous venir.',
    }
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

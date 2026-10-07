/**
 * ⛔ LE SEUL POINT D’APPEL AU MODÈLE DU DÉPÔT.
 *
 * Ni les routes, ni les composants, ni `infra/` n’appellent un fournisseur.
 * Trois bénéfices, dont un décisif : les tests tournent avec un bouchon, le
 * prompt est au même endroit que son appel, et **on peut changer de modèle en
 * éditant un fichier** (04-Architecture/architecture.md §4).
 *
 * ⛔ L’INJECTION DE PROMPT EST TRAITÉE ICI, ET PAR CONSTRUCTION, PAS PAR
 *    FILTRAGE. Le prompt système est assemblé à partir du GABARIT et du
 *    CONTEXTE TECHNIQUE — deux choses que le serveur produit. La parole du
 *    collaborateur n’y entre jamais : elle voyage en messages `user`, et la
 *    sortie est contrainte par schéma. Au pire le modèle produit une mauvaise
 *    compréhension ; il ne peut pas changer de rôle
 *    (04-Architecture/architecture.md §Sécurité). Vérifié par
 *    `prompts.test.ts`.
 */
import { anthropic } from '@ai-sdk/anthropic'
import { APICallError, RetryError, generateObject } from 'ai'
import { z } from 'zod'

import type { Axe, Comprehension } from '../../../../packages/widget/src/contrat'
import { AXES } from '../../../../packages/widget/src/transport'

import type { Synthese } from '../synthese/schema'
import { SchemaSynthese } from '../synthese/schema'

import type { DemandeSynthese, DemandeTour, MessageModele } from './prompts'
import { assemblerSyntheseSysteme, assemblerSysteme, messagesDuFil } from './prompts'

export type { Comprehension }

/** Ce que le modèle rend à chaque tour (01-Specs/entretien.md §Le contrat technique). */
export interface TourEntretien {
  readonly comprehension: Comprehension
  /** `null` = le bot estime en savoir assez. */
  readonly question: string | null
  /**
   * L’axe fermé sur lequel sa question se répond d’un clic — ou `null`.
   *
   * ⛔ UN AXE, PAS DES LIBELLÉS. Le modèle ne rédige aucune proposition : le
   *    dépôt écrit les mots ([D-025]). Le laisser les écrire ferait entrer sa
   *    prose dans le fil en ligne `collaborateur`, et la note la citerait comme
   *    si la personne l’avait dite — le défaut que P-025 vient de fermer.
   */
  readonly axe: Axe | null
  /** ⛔ Journalisé, jamais affiché au collaborateur. */
  readonly motif: string
}

/**
 * ⚠️ Le schéma du modèle est DÉLIBÉRÉMENT plus large que celui du transport :
 *    aucune borne de longueur. Un titre de 210 caractères ferait échouer la
 *    génération entière et perdrait le tour, alors qu’une troncature côté
 *    serveur ne coûte rien. C’est `domaine/entretien/tour.ts` qui ramène la
 *    sortie dans les bornes du contrat, et `tour.test.ts` qui le prouve.
 *
 * ⛔ Il n’y a ni priorité, ni sévérité, ni score, et il n’y en aura pas
 *    (04-Architecture/conventions-db.md). `.strict()` le rend vérifiable : un
 *    champ de plus est refusé, pas ignoré.
 */
const SchemaTourModele = z
  .object({
    comprehension: z
      .object({
        type: z.enum(['bug', 'idee', 'question', 'gene']),
        titre: z.string(),
        resume: z.string(),
        ecran: z.string().nullish(),
        recurrence: z.enum(['premiere_fois', 'deja_vu', 'systematique']).nullish(),
      })
      .strict(),
    question: z.string().nullish(),
    /**
     * ⚠️ `nullish` et non requis : un modèle qui omet le champ ne doit pas faire
     *    échouer la génération entière et perdre le tour. L’absence vaut
     *    « aucun axe », qui est le cas ordinaire.
     */
    axe: z.enum(AXES).nullish(),
    motif: z.string(),
  })
  .strict()

/**
 * Ce que rend une synthèse, avec ce qu’elle a coûté.
 *
 * ⚠️ `modele` est rendu ici plutôt que lu sur l’interface : c’est ce qui a
 *    RÉELLEMENT produit cette note. Sans lui, une régression de qualité est
 *    inexplicable (04-Architecture/conventions-db.md §syntheses).
 *
 * ⚠️ Les jetons sont nullables : un fournisseur qui ne rapporte pas sa
 *    consommation ne doit pas faire échouer la synthèse.
 */
export interface ResultatSyntheseModele {
  readonly synthese: Synthese
  readonly modele: string
  readonly jetonsEntree: number | null
  readonly jetonsSortie: number | null
}

export interface Modele {
  /** L’identifiant exact du modèle. Sans lui, une régression est inexplicable. */
  readonly identifiant: string
  tour(demande: DemandeTour): Promise<TourEntretien>
  synthese(demande: DemandeSynthese): Promise<ResultatSyntheseModele>
}

export interface OptionsClaude {
  /** Le gabarit de `entretien/prompts/systeme.md`, lu par `infra/prompts.ts`. */
  readonly gabarit: string
  /** Le gabarit de `synthese/prompts/synthese.md`. */
  readonly gabaritSynthese: string
  /**
   * ⛔ OBLIGATOIRE, ET JAMAIS UN DÉFAUT IMPLICITE. L’identifiant du modèle est
   *    journalisé dans chaque synthèse : sans lui, une régression de qualité est
   *    inexplicable, et un défaut caché dans le code ferait mentir le journal le
   *    jour où on en change (04-Architecture/hebergement.md §Les variables).
   *    C’est `infra/composition.ts` qui exige `FEEDYS_MODELE`.
   */
  readonly identifiant: string
  /**
   * ⚠️ Le délai est court et c’est voulu : l’entretien est SYNCHRONE, quelqu’un
   *    regarde un panneau. Passé ce délai, la carte n’apparaît pas — et le
   *    retour, lui, est déjà en base (01-Specs/entretien.md §Modes de
   *    défaillance).
   */
  readonly delaiMs?: number
  readonly delaiSyntheseMs?: number
}

/**
 * ⚠️ Le délai est court et c’est voulu : l’entretien est SYNCHRONE, quelqu’un
 *    regarde un panneau s’ouvrir.
 */
const DELAI_PAR_DEFAUT = 20_000

/**
 * ⚠️ Plus long que le tour, et c’est assumé : la synthèse est produite APRÈS que
 *    le panneau s’est refermé. Personne ne l’attend devant un écran.
 */
const DELAI_SYNTHESE_PAR_DEFAUT = 60_000

export function modeleClaude(options: OptionsClaude): Modele {
  const identifiant = options.identifiant.trim()
  if (identifiant === '') throw new Error('L’identifiant du modèle est vide.')

  return {
    identifiant,

    async tour(demande: DemandeTour): Promise<TourEntretien> {
      const { object } = await generateObject({
        model: anthropic(identifiant),
        schema: SchemaTourModele,
        schemaName: 'tour_entretien',
        // ⛔ Le gabarit et le contexte, rien d’autre. Jamais la parole.
        system: assemblerSysteme(options.gabarit, demande),
        // ⛔ La parole, et elle seule, en messages `user` / `assistant`.
        messages: messagesPourLeFournisseur(demande.fil),
        abortSignal: AbortSignal.timeout(options.delaiMs ?? DELAI_PAR_DEFAUT),
        maxRetries: 1,
      })

      return {
        comprehension: {
          type: object.comprehension.type,
          titre: object.comprehension.titre,
          resume: object.comprehension.resume,
          ...(vide(object.comprehension.ecran) ? {} : { ecran: object.comprehension.ecran as string }),
          ...(object.comprehension.recurrence
            ? { recurrence: object.comprehension.recurrence }
            : {}),
        },
        question: vide(object.question) ? null : (object.question as string),
        axe: object.axe ?? null,
        motif: object.motif,
      }
    },

    /**
     * ⛔ `generateObject` avec LE schéma de la spec — celui-là même qui sert à
     *    relire ce qu’on a stocké. Une seule définition, donc rien à
     *    réconcilier ; et le JSON Schema qu’il produit dit au modèle ce qui est
     *    interdit, `additionalProperties: false` compris.
     *
     * ⚠️ Deux nouvelles tentatives, et pas une : la synthèse est le livrable du
     *    produit, et elle ne se rejoue pas toute seule. Perdre une note pour un
     *    titre de 82 caractères serait absurde.
     */
    async synthese(demande: DemandeSynthese): Promise<ResultatSyntheseModele> {
      const { object, usage, response } = await generateObject({
        model: anthropic(identifiant),
        schema: SchemaSynthese,
        schemaName: 'synthese',
        system: assemblerSyntheseSysteme(options.gabaritSynthese, demande),
        messages: messagesPourLeFournisseur(demande.fil),
        abortSignal: AbortSignal.timeout(options.delaiSyntheseMs ?? DELAI_SYNTHESE_PAR_DEFAUT),
        maxRetries: 2,
      })

      return {
        synthese: object,
        // ⚠️ Celui que le fournisseur dit avoir utilisé, pas celui qu’on a
        //    demandé : un alias peut pointer ailleurs qu’on ne croit.
        modele: response.modelId || identifiant,
        jetonsEntree: usage.inputTokens ?? null,
        jetonsSortie: usage.outputTokens ?? null,
      }
    },
  }
}

function vide(valeur: string | null | undefined): boolean {
  return valeur === null || valeur === undefined || valeur.trim() === ''
}

/**
 * Ce que le fournisseur exige d’une conversation, ou `null` si elle passe.
 *
 * ⛔ C’EST L’INCIDENT DE [BUGS_LOG](../../../../03-Bugs/BUGS_LOG.md) 021. Les
 *    modèles Claude récents refusent une conversation qui finit sur un message
 *    `assistant` — le « prefill » — par un 400. Un panneau refermé sur une
 *    relance donnait exactement ce fil, et la note était perdue huit fois de
 *    suite. Le bouchon acceptait tout : aucun test ne pouvait le voir.
 *
 * ⚠️ Les messages sont ceux de l’API, mot pour mot : c’est ce que le bouchon
 *    rend, et ce que l’exploitant lira dans le journal.
 *
 * ⛔ UNE SEULE DÉFINITION, POUR LE VRAI ET POUR LE BOUCHON. Le vrai modèle la
 *    vérifie AVANT d’appeler — un refus local ne coûte pas un aller-retour —, et
 *    le bouchon la vérifie à la place de l’API. Un chemin qui fabriquerait de
 *    nouveau un fil finissant sur `bot` rougit dans les tests au lieu de passer.
 */
export function exigencesDuFournisseur(messages: readonly MessageModele[]): string | null {
  if (messages.length === 0) return 'messages: at least one message is required'
  if (messages.some((message) => message.content.trim() === '')) {
    return 'messages: text content blocks must be non-empty'
  }
  if (messages[0]?.role !== 'user') return 'messages: first message must use the "user" role'
  if (messages[messages.length - 1]?.role !== 'user') {
    return 'This model does not support assistant message prefill. The conversation must end with a user message.'
  }
  return null
}

/**
 * La requête n’est pas partie : elle aurait été refusée telle quelle.
 *
 * ⚠️ Classée en `refus` par `classerEchec`, comme un 400 du fournisseur — c’est
 *    la même faute, attrapée un aller-retour plus tôt.
 */
export class RequeteInvalide extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RequeteInvalide'
  }
}

/** ⛔ Le seul chemin du fil vers le fournisseur, pour `tour()` comme pour `synthese()`. */
function messagesPourLeFournisseur(fil: DemandeTour['fil']): MessageModele[] {
  const messages = messagesDuFil(fil)
  const refus = exigencesDuFournisseur(messages)
  if (refus !== null) throw new RequeteInvalide(refus)
  return messages
}

/**
 * Pourquoi un appel au modèle a échoué — et ce que le filet doit en faire.
 *
 * - `indisponible` : le modèle n’a pas pu répondre MAINTENANT — 5xx, 529, 429,
 *   délai dépassé, réseau — ou le COMPTE l’en empêche — clé refusée (401),
 *   crédit épuisé (402), accès refusé (403), modèle inconnu (404). Les deux se
 *   règlent sans toucher au code, et la même requête passera ensuite : c’est le
 *   cas du filet ([D-030](../../../../00-Projet/DECISIONS_LOG.md)).
 * - `refus` : le fournisseur a refusé la requête POUR CE QU’ELLE EST — 400,
 *   413, 422. Elle sera refusée à l’identique dans cinq minutes comme dans
 *   vingt et une heures : seul un correctif de Feedys la fera passer
 *   ([D-032](../../../../00-Projet/DECISIONS_LOG.md)).
 *
 * ⚠️ LA CAUSE EST CE QUE L’EXPLOITANT LIRA. Statut, type d’erreur et message du
 *    fournisseur — qui décrivent la REQUÊTE, jamais son contenu. Bornée, parce
 *    qu’elle part dans une alerte Telegram.
 */
export type NatureEchec = 'refus' | 'indisponible'

export interface EchecModele {
  readonly nature: NatureEchec
  readonly cause: string
}

/** Les refus qui tiennent au COMPTE, pas à la requête : ils se règlent sans code. */
const REFUS_DE_COMPTE = new Set([401, 402, 403, 404])

/** ⚠️ Retentables par nature, quoi qu’en dise `isRetryable`. */
const PASSAGERS = new Set([408, 409, 429])

const CAUSE_MAX = 300

export function classerEchec(erreur: unknown): EchecModele {
  // ⚠️ Après des tentatives retentables, l’AI SDK enveloppe : c’est la DERNIÈRE
  //    erreur qui dit où on en est — un 529 suivi d’un 400 est un refus.
  const derniere = RetryError.isInstance(erreur) ? erreur.lastError : erreur

  if (derniere instanceof RequeteInvalide) {
    return { nature: 'refus', cause: borner(`requête refusée avant l’envoi — ${derniere.message}`) }
  }

  if (APICallError.isInstance(derniere)) {
    const statut = derniere.statusCode
    const cause = borner(
      `HTTP ${statut ?? '—'}${typeErreur(derniere.data)} — ${derniere.message}`,
    )

    const refus =
      statut !== undefined &&
      statut >= 400 &&
      statut < 500 &&
      !REFUS_DE_COMPTE.has(statut) &&
      !PASSAGERS.has(statut) &&
      !derniere.isRetryable

    return { nature: refus ? 'refus' : 'indisponible', cause }
  }

  // ⚠️ Délai dépassé, réseau, sortie hors schéma : rien ne dit que la même
  //    requête échouera encore. Le NOM, pas le message — celui d’une sortie hors
  //    schéma pourrait porter ce que le modèle a rédigé.
  const nom = derniere instanceof Error ? derniere.name : typeof derniere
  return { nature: 'indisponible', cause: borner(nom) }
}

function typeErreur(data: unknown): string {
  const type = (data as { error?: { type?: unknown } } | undefined)?.error?.type
  return typeof type === 'string' ? ` ${type}` : ''
}

function borner(texte: string): string {
  const net = texte.replace(/\s+/g, ' ').trim()
  return net.length > CAUSE_MAX ? `${net.slice(0, CAUSE_MAX - 1)}…` : net
}

/**
 * Ce que l’API rend quand elle refuse — pour que le bouchon échoue comme elle.
 *
 * ⚠️ Une vraie `APICallError`, construite comme le fait le fournisseur : c’est
 *    sur CETTE forme que `classerEchec` doit avoir raison, pas sur une imitation.
 */
export function refusDuFournisseur(statut: number, type: string, message: string): APICallError {
  return new APICallError({
    message,
    url: 'https://api.anthropic.com/v1/messages',
    requestBodyValues: {},
    statusCode: statut,
    responseBody: JSON.stringify({ type: 'error', error: { type, message } }),
    isRetryable: statut === 408 || statut === 409 || statut === 429 || statut >= 500,
    data: { type: 'error', error: { type, message } },
  })
}

/**
 * Le bouchon.
 *
 * ⚠️ Il vit ICI, à côté de l’implémentation réelle, et pas dans un dossier de
 *    tests : c’est ce qui rend visible qu’un bouchon divergeant de l’interface
 *    ne compile plus. Il sert aussi à `pnpm entretien:rejouer --sec`, où on veut
 *    exercer la boucle sans dépenser un jeton.
 */
export interface OptionsBouchon {
  /** Ce que le bouchon rend, tour par tour. Le dernier vaut pour les suivants. */
  readonly tours?: readonly TourEntretien[]
  /** Ce que le bouchon rend comme synthèse. */
  readonly synthese?: Synthese
  /** ⚠️ Le modèle muet : la carte n’apparaît pas, le retour part quand même. */
  readonly echoue?: boolean
  /** ⚠️ Muet sur la SEULE synthèse — le tour, lui, a marché. */
  readonly echoueSynthese?: boolean
  /**
   * ⚠️ La synthèse est REFUSÉE par le fournisseur — un 400 sur une requête
   *    qu’il ne prendra jamais, quelle que soit la conversation. Ce n’est pas
   *    une indisponibilité, et le filet ne doit pas la traiter comme telle.
   */
  readonly refuseSynthese?: boolean
  readonly identifiant?: string
  readonly jetonsEntree?: number | null
  readonly jetonsSortie?: number | null
}

export interface ModeleBouchon extends Modele {
  /** Ce que le bouchon a reçu — c’est là-dessus que porte le test d’injection. */
  readonly recues: DemandeTour[]
  readonly recuesSynthese: DemandeSynthese[]
}

const TOUR_PAR_DEFAUT: TourEntretien = {
  comprehension: {
    type: 'bug',
    titre: 'Le tri par date de la liste des dossiers se réinitialise au retour sur la page',
    resume:
      'La personne repose le tri par date à chaque retour sur la liste des dossiers. Le tri ne survit pas à la navigation.',
    ecran: 'Liste des dossiers',
  },
  question: 'C’est arrivé depuis un moment, ou c’est nouveau ?',
  // ⚠️ Le bouchon déclare l’axe : c’est la question fermée par excellence, et
  //    c’est aussi ce qui exerce la boucle des propositions sans dépenser un jeton.
  axe: 'recurrence',
  motif: 'La récurrence change ce qu’un développeur ferait : régression ou comportement d’origine.',
}

/**
 * ⚠️ Écrite à la main, et cohérente avec `TOUR_PAR_DEFAUT` : les citations sont
 *    des sous-chaînes exactes de la parole des jeux d’essai. ⛔ Jamais un vrai
 *    retour copié d’une base (CLAUDE.md §Secrets).
 */
const SYNTHESE_PAR_DEFAUT: Synthese = {
  type: 'bug',
  titre: 'Le tri par date de la liste des dossiers se réinitialise',
  resume:
    'Le tri par date ne survit pas à la navigation : la personne doit le reposer à chaque retour sur la liste des dossiers. Elle décrit un comportement présent depuis toujours.',
  attendu: 'le tri reste en place au retour',
  constate: 'le tri revient à l’ordre par défaut',
  recurrence: 'systematique',
  zone: 'Liste des dossiers',
  impact: 'ralentit',
  citations: ['il se remet à zéro'],
  confiance: 'moyenne',
  questions_ouvertes: ['Est-ce que ça touche aussi les autres listes ?'],
}

/**
 * ⛔ LE BOUCHON REFUSE CE QUE L’API REFUSE, et de la même façon : un 400
 *    `invalid_request_error`. Il acceptait n’importe quelle conversation, et
 *    c’est pour ça qu’aucun test n’a vu l’incident de BUGS_LOG 021.
 *
 * ⚠️ Il lit le fil par `messagesDuFil`, comme le vrai modèle : ce qu’il juge est
 *    ce qui serait parti.
 */
function commeLeFournisseur(fil: DemandeTour['fil']): APICallError | null {
  const refus = exigencesDuFournisseur(messagesDuFil(fil))
  return refus === null ? null : refusDuFournisseur(400, 'invalid_request_error', refus)
}

export function modeleBouchon(options: OptionsBouchon = {}): ModeleBouchon {
  const recues: DemandeTour[] = []
  const recuesSynthese: DemandeSynthese[] = []
  const tours = options.tours ?? [TOUR_PAR_DEFAUT]

  return {
    identifiant: options.identifiant ?? 'bouchon',
    recues,
    recuesSynthese,

    tour(demande: DemandeTour): Promise<TourEntretien> {
      recues.push(demande)

      if (options.echoue) {
        return Promise.reject(new Error('Le modèle ne répond pas.'))
      }

      const refus = commeLeFournisseur(demande.fil)
      if (refus !== null) return Promise.reject(refus)

      const rendu = tours[Math.min(recues.length - 1, tours.length - 1)]
      if (rendu === undefined) return Promise.reject(new Error('Bouchon sans tour à rendre.'))

      return Promise.resolve(rendu)
    },

    synthese(demande: DemandeSynthese): Promise<ResultatSyntheseModele> {
      recuesSynthese.push(demande)

      if (options.echoue === true || options.echoueSynthese === true) {
        return Promise.reject(new Error('Le modèle ne répond pas.'))
      }

      if (options.refuseSynthese === true) {
        return Promise.reject(
          refusDuFournisseur(400, 'invalid_request_error', 'Bouchon : la requête est refusée.'),
        )
      }

      const refus = commeLeFournisseur(demande.fil)
      if (refus !== null) return Promise.reject(refus)

      return Promise.resolve({
        synthese: options.synthese ?? SYNTHESE_PAR_DEFAUT,
        modele: options.identifiant ?? 'bouchon',
        jetonsEntree: options.jetonsEntree === undefined ? 1_200 : options.jetonsEntree,
        jetonsSortie: options.jetonsSortie === undefined ? 340 : options.jetonsSortie,
      })
    },
  }
}

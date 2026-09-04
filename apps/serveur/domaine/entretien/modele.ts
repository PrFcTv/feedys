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
import { generateObject } from 'ai'
import { z } from 'zod'

import type { Comprehension } from '../../../../packages/widget/src/contrat'

import type { DemandeTour } from './prompts'
import { assemblerSysteme, messagesDuFil } from './prompts'

export type { Comprehension }

/** Ce que le modèle rend à chaque tour (01-Specs/entretien.md §Le contrat technique). */
export interface TourEntretien {
  readonly comprehension: Comprehension
  /** `null` = le bot estime en savoir assez. */
  readonly question: string | null
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
    motif: z.string(),
  })
  .strict()

export interface Modele {
  /** L’identifiant exact du modèle. Sans lui, une régression est inexplicable. */
  readonly identifiant: string
  tour(demande: DemandeTour): Promise<TourEntretien>
}

export interface OptionsClaude {
  /** Le gabarit de `prompts/systeme.md`, lu par `infra/prompts.ts`. */
  readonly gabarit: string
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
}

/**
 * ⚠️ Le délai est court et c’est voulu : l’entretien est SYNCHRONE, quelqu’un
 *    regarde un panneau s’ouvrir.
 */
const DELAI_PAR_DEFAUT = 20_000

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
        messages: messagesDuFil(demande.fil),
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
        motif: object.motif,
      }
    },
  }
}

function vide(valeur: string | null | undefined): boolean {
  return valeur === null || valeur === undefined || valeur.trim() === ''
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
  /** ⚠️ Le modèle muet : la carte n’apparaît pas, le retour part quand même. */
  readonly echoue?: boolean
  readonly identifiant?: string
}

export interface ModeleBouchon extends Modele {
  /** Ce que le bouchon a reçu — c’est là-dessus que porte le test d’injection. */
  readonly recues: DemandeTour[]
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
  motif: 'La récurrence change ce qu’un développeur ferait : régression ou comportement d’origine.',
}

export function modeleBouchon(options: OptionsBouchon = {}): ModeleBouchon {
  const recues: DemandeTour[] = []
  const tours = options.tours ?? [TOUR_PAR_DEFAUT]

  return {
    identifiant: options.identifiant ?? 'bouchon',
    recues,

    tour(demande: DemandeTour): Promise<TourEntretien> {
      recues.push(demande)

      if (options.echoue) {
        return Promise.reject(new Error('Le modèle ne répond pas.'))
      }

      const rendu = tours[Math.min(recues.length - 1, tours.length - 1)]
      if (rendu === undefined) return Promise.reject(new Error('Bouchon sans tour à rendre.'))

      return Promise.resolve(rendu)
    },
  }
}

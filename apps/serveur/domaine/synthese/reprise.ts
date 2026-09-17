/**
 * Les reprises — ce qui redemande une note que le modèle n’a pas rendue.
 *
 * ⚠️ POURQUOI ELLES EXISTENT ([03-Bugs/BUGS_LOG.md] 019). Une synthèse en
 *    `modele_indisponible` s’arrêtait là : aucune notification, aucune passe
 *    suivante, et une ligne de console sur le VPS d’un client, que personne ne
 *    lit. Un plafond de workspace atteint, une clé révoquée, une panne du
 *    fournisseur — et toutes les notes de la période disparaissaient, sans que
 *    le développeur le sache ([D-029]).
 *
 * ⛔ CE MODULE NE SYNTHÉTISE PAS. Il choisit, il redemande par le CHEMIN
 *    ORDINAIRE — le port `synthetiser`, celui-là même que la fin d’entretien
 *    appelle, et qui notifie déjà —, et il dit quand il renonce. Un second
 *    chemin de note divergerait du premier le jour où l’un des deux bouge.
 *
 * ⛔ `rien_a_synthetiser` N’EST JAMAIS RETENTÉ. Un retour dicté sans transcript
 *    ne produira jamais de note : le redemander toutes les cinq minutes
 *    mangerait la passe pour rien.
 *
 * ⛔ Module pur : ni base, ni réseau (architecture.md §3). L’horloge du budget
 *    est injectée, comme celle du balayage.
 */
import type { MotifRefusSynthese } from './produire'

/**
 * Ce qu’a donné une demande de note.
 *
 * ⚠️ `ecrite` veut dire écrite ET passée au chemin de notification — pas
 *    « notifiée » : un canal en échec ne défait pas une note.
 */
export type IssueSynthese = 'ecrite' | MotifRefusSynthese

/** Pourquoi le filet a renoncé. ⛔ La liste est celle du CHECK de 0011. */
export type MotifRenoncement = 'plafond' | 'rien_a_synthetiser'

/**
 * Le nombre de reprises au-delà duquel le filet renonce.
 *
 * ⚠️ Huit, et c’est ce que l’espacement en fait qui compte : en doublant à
 *    partir de cinq minutes, la huitième tombe environ **vingt et une heures**
 *    après la fin de l’entretien. Une panne du fournisseur d’une journée est
 *    couverte ; une clé révoquée ne l’est pas, et c’est l’alerte
 *    `modele_en_echec` qui l’aura dit bien avant (hebergement.md §Ce qui doit
 *    être surveillé).
 */
export const PLAFOND_REPRISES = 8

/**
 * L’attente avant la PREMIÈRE reprise, comptée depuis la fin de l’entretien.
 *
 * ⛔ Elle doit dépasser la tentative ordinaire, sans quoi le filet redemanderait
 *    une note que la fin d’entretien est encore en train d’écrire. Celle-ci
 *    dure trois minutes au pire — 60 s × trois tentatives (`modele.ts`).
 *    `syntheses_retour_uniq` empêcherait la double note ; elle n’empêcherait
 *    pas le double appel.
 */
export const PREMIER_ESPACEMENT_MS = 5 * 60 * 1000

/**
 * L’attente avant la reprise suivante, sachant combien ont déjà eu lieu.
 *
 * ⚠️ Doublée à chaque fois : 5, 10, 20, 40, 80, 160, 320, 640 minutes. Une panne
 *    courte est rattrapée vite ; une panne longue ne fait pas appeler le modèle
 *    deux cents fois pour rien.
 */
export function espacementAvant(reprisesFaites: number): number {
  return PREMIER_ESPACEMENT_MS * 2 ** Math.max(0, reprisesFaites)
}

/**
 * Pour chaque nombre de reprises déjà faites, l’instant avant lequel la
 * précédente — ou la fin d’entretien — doit se trouver pour qu’on reprenne.
 *
 * ⛔ LE SQL NE RÉÉCRIT PAS LA RÈGLE. Il reçoit ce tableau et compare
 *    (`infra/base/depot-reprise.ts`), exactement comme le balayage reçoit
 *    `instantLimite`. `reprise.test.ts` prouve que les deux formes s’accordent.
 *
 * ⚠️ L’indice est le nombre de reprises déjà faites : `limites[0]` vaut pour un
 *    retour jamais repris. Le tableau a `plafond` cases — au-delà, on ne
 *    reprend plus.
 */
export function limitesDeReprise(maintenant: Date, plafond: number = PLAFOND_REPRISES): Date[] {
  return Array.from(
    { length: plafond },
    (_, faites) => new Date(maintenant.getTime() - espacementAvant(faites)),
  )
}

/** La règle, énoncée pour UN retour. */
export function repriseDue(
  reprisesFaites: number,
  depuis: Date,
  maintenant: Date,
  plafond: number = PLAFOND_REPRISES,
): boolean {
  if (reprisesFaites >= plafond) return false
  return depuis.getTime() < maintenant.getTime() - espacementAvant(reprisesFaites)
}

/** Un retour réservé par le filet — et combien de reprises il porte, celle-ci comprise. */
export interface RetourReserve {
  readonly retourId: string
  readonly reprises: number
}

export interface PortsReprise {
  /**
   * Choisit UN retour clos, sans note, dont la reprise est due, et compte la
   * reprise — d’une seule écriture.
   *
   * ⛔ C’EST LA RÉSERVATION, comme la clôture du balayage : deux conteneurs qui
   *    reprennent en même temps ne se partagent rien. Et c’est UN retour à la
   *    fois, parce qu’une reprise comptée doit être une reprise tentée — en
   *    réserver vingt d’un coup, puis manquer de temps, en brûlerait.
   */
  reserver(limites: readonly Date[], plafond: number): Promise<RetourReserve | null>

  /** Le chemin ordinaire — synthèse, écriture, notification. */
  synthetiser(retourId: string): Promise<IssueSynthese>

  /** ⛔ Terminal pour le filet ; un humain peut toujours refaire la note. */
  renoncer(retourId: string, motif: MotifRenoncement): Promise<void>

  /** ⛔ Jamais le contenu d’un retour : la parole ne va pas dans les journaux. */
  signaler?(quoi: string, erreur: unknown): void
}

export interface OptionsReprise {
  maintenant?: Date
  plafond?: number
  /** ⚠️ Le reste de la passe : la reprise partage le budget du balayage. */
  parPasse?: number
  budgetMs?: number
  horloge?: () => number
}

export interface BilanReprise {
  /** Retours repris par cette passe. */
  reprises: number
  /** Dont la note est désormais écrite. */
  ecrites: number
  /** Dont la note manque encore — une passe suivante y reviendra. */
  enAttente: number
  /** Auxquels le filet vient de renoncer, faute de modèle. ⚠️ C’est ce qui alerte. */
  impossibles: string[]
  /** Auxquels le filet vient de renoncer parce qu’il n’y a rien à synthétiser. */
  sansParole: number
}

/**
 * Une passe de reprises.
 *
 * ⚠️ EN SÉRIE, comme le balayage : chaque reprise appelle le modèle, et vingt
 *    appels simultanés depuis le processus qui sert les requêtes est ce qu’on
 *    évite.
 *
 * ⛔ UN ÉCHEC NE BLOQUE PAS LES SUIVANTS. Une exception — la base, l’écriture —
 *    vaut un échec du modèle : la reprise est comptée, la suivante viendra.
 */
export async function reprendre(
  ports: PortsReprise,
  options: OptionsReprise = {},
): Promise<BilanReprise> {
  const maintenant = options.maintenant ?? new Date()
  const plafond = options.plafond ?? PLAFOND_REPRISES
  const parPasse = options.parPasse ?? 20
  const budget = options.budgetMs ?? 3 * 60 * 1000
  const horloge = options.horloge ?? (() => Date.now())

  const debut = horloge()
  const limites = limitesDeReprise(maintenant, plafond)
  const bilan: BilanReprise = { reprises: 0, ecrites: 0, enAttente: 0, impossibles: [], sansParole: 0 }

  // ⛔ Le budget se regarde AVANT de réserver : on ne compte jamais une reprise
  //    qu’on n’a pas le temps de tenter.
  while (bilan.reprises < parPasse && horloge() - debut < budget) {
    const reserve = await ports.reserver(limites, plafond)
    if (reserve === null) break

    bilan.reprises += 1

    let issue: IssueSynthese | 'erreur'
    try {
      issue = await ports.synthetiser(reserve.retourId)
    } catch (erreur) {
      // ⚠️ L’identifiant est dans le message : un cuid n’est pas de la parole.
      ports.signaler?.(`reprise de la note · ${reserve.retourId}`, erreur)
      issue = 'erreur'
    }

    switch (issue) {
      case 'ecrite':
        bilan.ecrites += 1
        break

      // ⚠️ Une autre main l’a écrite entre-temps — la fin d’entretien, un humain.
      case 'deja_faite':
        break

      case 'rien_a_synthetiser':
        await ports.renoncer(reserve.retourId, 'rien_a_synthetiser')
        bilan.sansParole += 1
        break

      default:
        if (reserve.reprises >= plafond) {
          await ports.renoncer(reserve.retourId, 'plafond')
          bilan.impossibles.push(reserve.retourId)
        } else {
          bilan.enAttente += 1
        }
    }
  }

  return bilan
}

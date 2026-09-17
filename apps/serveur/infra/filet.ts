/**
 * Le filet, branché sur le temps.
 *
 * ⚠️ POURQUOI UN `setInterval` DANS LE PROCESSUS, ET PAS AUTRE CHOSE.
 *    [hebergement.md](../../../04-Architecture/hebergement.md) §Ce qui n’est pas
 *    là refuse une file, un worker et un cache ; §La forme interdit qu’un
 *    mécanisme dépende du planificateur d’un hébergeur. Il reste le processus
 *    qui sert déjà les requêtes — et c’est suffisant, parce qu’une passe est
 *    bornée et que son travail est de quelques lignes ([D-018]).
 *
 * ⚠️ UNE PASSE FAIT TROIS CHOSES, DANS CET ORDRE (P-030) :
 *    1. le balayage referme les entretiens muets, et demande leur note ;
 *    2. les reprises redemandent les notes que le modèle n’a pas rendues —
 *       dans le temps qui reste de la même passe ;
 *    3. la veille ouvre ou referme les incidents, et prévient par Telegram.
 *
 * ⛔ Ce module ne décide rien. Il appelle le domaine au rythme dit, et il avale
 *    ce qui remonte : une étape qui échoue n’empêche ni la suivante, ni la passe
 *    d’après.
 */
import type { PortsBalayage } from '../domaine/entretien/balayage'
import { BUDGET_PASSE_MS, PAR_PASSE, PAS_BALAYAGE_MS, balayer } from '../domaine/entretien/balayage'
import type { PortsReprise } from '../domaine/synthese/reprise'
import { reprendre } from '../domaine/synthese/reprise'
import type { PortsVeille } from '../domaine/veille/alertes'
import { veiller } from '../domaine/veille/alertes'

import { portsBalayage, portsReprise, portsVeille } from './composition'
import type { Journal } from './demarrage'
import { CONSOLE } from './demarrage'

let minuteur: NodeJS.Timeout | undefined

/**
 * ⚠️ Une passe à la fois, même si l’une déborde sur l’autre. Le verrou de la
 *    base rendrait le doublon inoffensif, mais deux passes qui se chevauchent
 *    doubleraient les appels au modèle — ce qui n’est pas inoffensif du tout.
 */
let enCours = false

export interface PortsFilet {
  readonly balayage: PortsBalayage
  /** ⚠️ Facultatif pour les tests du balayage seul. En production, toujours là. */
  readonly reprise?: PortsReprise
  readonly veille?: PortsVeille
}

export interface OptionsFilet {
  pasMs?: number
  journal?: Journal
  /** ⚠️ Injectable pour les tests — en production c’est toujours la composition. */
  ports?: () => PortsFilet
  /** ⚠️ L’horloge du budget de passe. */
  horloge?: () => number
}

function portsDeProduction(journal: Journal): PortsFilet {
  return {
    balayage: portsBalayage(),
    reprise: portsReprise(),
    veille: portsVeille((texte) => journal.alerte(`veille — ${texte.replace(/\n/g, ' · ')}`)),
  }
}

/**
 * Démarre le balayage périodique. ⚠️ Idempotent : deux appels ne font pas deux
 * minuteurs.
 *
 * ⛔ `unref()` : le filet ne doit jamais retenir un processus qui veut s’en
 *    aller. Un conteneur qu’on arrête s’arrête.
 */
export function demarrerFilet(options: OptionsFilet = {}): void {
  if (minuteur !== undefined) return

  const pasMs = options.pasMs ?? PAS_BALAYAGE_MS

  minuteur = setInterval(() => void passe(options), pasMs)
  minuteur.unref()
}

/** ⚠️ Pour les tests, et pour un arrêt propre. */
export function arreterFilet(): void {
  if (minuteur === undefined) return

  clearInterval(minuteur)
  minuteur = undefined
  enCours = false
}

export async function passe(options: OptionsFilet = {}): Promise<void> {
  const journal = options.journal ?? CONSOLE
  const horloge = options.horloge ?? (() => Date.now())

  // ⛔ Une passe déjà en cours : on ne démarre pas la suivante. Le verrou de la
  //    base rendrait le doublon inoffensif en base, PAS au modèle — deux passes
  //    qui se chevauchent doubleraient les appels.
  if (enCours) return
  enCours = true

  try {
    const ports = options.ports ? options.ports() : portsDeProduction(journal)
    const debut = horloge()

    // ── 1. le balayage ────────────────────────────────────────────────────────
    let clos = 0
    try {
      const bilan = await balayer(ports.balayage, { horloge })
      clos = bilan.clos

      // ⚠️ Silencieux quand il n’y a rien : un filet qui parle toutes les cinq
      //    minutes pour ne rien dire finit par ne plus être lu.
      if (bilan.clos > 0) {
        journal.info(
          `filet — ${bilan.clos} entretien(s) refermé(s) par silence, ` +
            `${bilan.synthetises} passé(s) en aval, ${bilan.echoues} en échec, ` +
            `${bilan.reportes} reporté(s).`,
        )
      }

      // ⚠️ Ce n’est plus une perte : les reprises y reviendront. C’est dit en
      //    information, plus en alerte — l’alerte, c’est le renoncement.
      if (bilan.reportes > 0 || bilan.echoues > 0) {
        journal.info(
          `filet — ${bilan.echoues + bilan.reportes} note(s) pas encore écrite(s) : ` +
            'les passes suivantes les redemanderont (04-Architecture/hebergement.md §Le filet).',
        )
      }
    } catch (erreur) {
      journal.erreur(`filet — le balayage a échoué : ${String(erreur)}`)
    }

    // ── 2. les reprises, dans le temps qui reste ────────────────────────────
    if (ports.reprise) {
      try {
        const bilan = await reprendre(ports.reprise, {
          horloge,
          parPasse: Math.max(0, PAR_PASSE - clos),
          budgetMs: Math.max(0, BUDGET_PASSE_MS - (horloge() - debut)),
        })

        if (bilan.reprises > 0) {
          journal.info(
            `filet — ${bilan.reprises} note(s) redemandée(s) : ${bilan.ecrites} écrite(s), ` +
              `${bilan.enAttente} encore en attente, ${bilan.impossibles.length} devenue(s) impossible(s), ` +
              `${bilan.sansParole} sans parole à synthétiser.`,
          )
        }

        // ⛔ LE RENONCEMENT, LUI, S’ALERTE. Les identifiants sont dans la ligne :
        //    un cuid n’est pas de la parole.
        if (bilan.impossibles.length > 0) {
          journal.alerte(
            `filet — ${bilan.impossibles.length} note(s) devenue(s) impossible(s) : ` +
              `${bilan.impossibles.join(', ')}. La parole est en base ; « Refaire la note » ` +
              'sur la fiche, une fois le modèle rétabli (04-Architecture/hebergement.md §Le filet).',
          )
        }
      } catch (erreur) {
        journal.erreur(`filet — les reprises ont échoué : ${String(erreur)}`)
      }
    }

    // ── 3. la veille ─────────────────────────────────────────────────────────
    if (ports.veille) {
      try {
        const bilan = await veiller(ports.veille)
        for (const { genre, erreur } of bilan.erreurs) {
          journal.erreur(`filet — la veille « ${genre} » a échoué : ${String(erreur)}`)
        }
      } catch (erreur) {
        journal.erreur(`filet — la veille a échoué : ${String(erreur)}`)
      }
    }
  } catch (erreur) {
    journal.erreur(`filet — la passe a échoué : ${String(erreur)}`)
  } finally {
    enCours = false
  }
}

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
 * ⛔ Ce module ne décide rien. Il appelle `balayer` au rythme dit, et il avale
 *    ce qui remonte : un balayage qui échoue ne doit pas empêcher le suivant.
 */
import type { PortsBalayage } from '../domaine/entretien/balayage'
import { PAS_BALAYAGE_MS, balayer } from '../domaine/entretien/balayage'

import { portsBalayage } from './composition'
import type { Journal } from './demarrage'
import { CONSOLE } from './demarrage'

let minuteur: NodeJS.Timeout | undefined

/**
 * ⚠️ Une passe à la fois, même si l’une déborde sur l’autre. Le verrou de la
 *    base rendrait le doublon inoffensif, mais deux passes qui se chevauchent
 *    doubleraient les appels au modèle — ce qui n’est pas inoffensif du tout.
 */
let enCours = false

export interface OptionsFilet {
  pasMs?: number
  journal?: Journal
  /** ⚠️ Injectable pour les tests — en production c’est toujours la composition. */
  ports?: () => PortsBalayage
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
  const ports = options.ports ?? portsBalayage

  // ⛔ Une passe déjà en cours : on ne démarre pas la suivante. Le verrou de la
  //    base rendrait le doublon inoffensif en base, PAS au modèle — deux passes
  //    qui se chevauchent doubleraient les appels.
  if (enCours) return
  enCours = true

  try {
    const bilan = await balayer(ports())

    // ⚠️ Silencieux quand il n’y a rien : un filet qui parle toutes les cinq
    //    minutes pour ne rien dire finit par ne plus être lu.
    if (bilan.clos > 0) {
      journal.info(
        `filet — ${bilan.clos} entretien(s) refermé(s) par silence, ` +
          `${bilan.synthetises} passé(s) en aval, ${bilan.echoues} en échec, ` +
          `${bilan.reportes} reporté(s).`,
      )
    }

    // ⛔ REPORTÉ VEUT DIRE « refermé, sans note, et plus aucune passe ne le
    //    reprendra » : `clore` ne regarde que les `en_cours`. Ça se rattrape à
    //    la main (04-Architecture/hebergement.md §Le filet), donc ça s’alerte.
    if (bilan.reportes > 0 || bilan.echoues > 0) {
      journal.alerte(
        `filet — ${bilan.echoues + bilan.reportes} entretien(s) refermé(s) sans note. ` +
          'La requête de rattrapage est dans 04-Architecture/hebergement.md §Le filet.',
      )
    }
  } catch (erreur) {
    journal.erreur(`filet — la passe a échoué : ${String(erreur)}`)
  } finally {
    enCours = false
  }
}

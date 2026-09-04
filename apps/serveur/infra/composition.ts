/**
 * Le câblage — l’endroit, et le seul, où les ports du domaine rencontrent leurs
 * implémentations.
 *
 * ⚠️ Les limiteurs de débit sont des singletons de module, et c’est délibéré :
 *    une fenêtre glissante recréée à chaque requête ne limite rien. Ils vivent
 *    donc aussi longtemps que le processus (domaine/retours/debit.ts).
 *
 * ⚠️ Tout le reste est construit à la demande : rien ne se connecte à l’import.
 */
import type { PortsIngestion } from '../domaine/retours/ingestion'
import { creerDebitIngestion } from '../domaine/retours/debit'

import { pool } from './base/connexion'
import { creerDepotRetours } from './base/depot-retours'
import { creerStockageFichiers } from './stockage/fichiers'

const debit = creerDebitIngestion()

/**
 * ⛔ Ce qui sort en console ne contient jamais le corps d’un retour : la parole
 *    de quelqu’un ne se retrouve pas dans les journaux d’un conteneur.
 */
function signaler(quoi: string, erreur: unknown): void {
  console.error(`Feedys · ${quoi} — échec.`, erreur)
}

export function portsIngestion(): PortsIngestion {
  return {
    depot: creerDepotRetours(pool()),
    stockage: creerStockageFichiers(),
    debitParCle: debit.cle,
    debitParIp: debit.ip,
    maintenant: () => Date.now(),
    signaler,
    // ⛔ `aval` reste vide jusqu’à P-007. La place est réservée pour que
    //    l’entretien s’y branche APRÈS la persistance, jamais avant.
  }
}

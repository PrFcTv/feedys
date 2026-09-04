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
import type { PortsTour } from '../domaine/entretien/tour'
import { creerDebitEntretien, creerDebitIngestion } from '../domaine/retours/debit'
import { modeleClaude } from '../domaine/entretien/modele'

import { pool } from './base/connexion'
import { creerDepotEntretien } from './base/depot-entretien'
import { creerDepotRetours } from './base/depot-retours'
import { lireGabaritSysteme } from './prompts'
import { creerStockageFichiers } from './stockage/fichiers'

const debit = creerDebitIngestion()
const debitEntretien = creerDebitEntretien()

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
    // ⛔ `aval` reste vide : l’entretien n’est pas déclenché par l’ingestion, il
    //    est demandé par le widget, tour par tour. La place reste réservée pour
    //    ce qui devrait suivre la persistance sans pouvoir la défaire.
  }
}

/**
 * L’identifiant du modèle.
 *
 * ⛔ EXIGÉ, JAMAIS UN DÉFAUT IMPLICITE. Il est journalisé dans chaque synthèse :
 *    un défaut caché dans le code ferait mentir le journal le jour où on en
 *    change, et une régression de qualité deviendrait inexplicable
 *    (04-Architecture/hebergement.md §Les variables).
 */
export function identifiantModele(): string {
  const identifiant = process.env['FEEDYS_MODELE']?.trim()

  if (!identifiant) {
    throw new Error(
      'FEEDYS_MODELE est absente. Elle vit dans .env.local sur le poste, et dans ' +
        'l’environnement du conteneur en production. Elle est explicite parce ' +
        'qu’elle est journalisée dans chaque synthèse.',
    )
  }

  return identifiant
}

/**
 * ⚠️ Le modèle est construit à chaque requête, et c’est sans coût : `anthropic()`
 *    ne fait que décrire un appel. Le gabarit, lui, est mémorisé par
 *    `infra/prompts.ts` — c’est la lecture disque qu’on ne veut pas refaire.
 */
export function portsTour(): PortsTour {
  return {
    depot: creerDepotEntretien(pool()),
    produits: creerDepotRetours(pool()),
    debitParCle: debitEntretien.cle,
    debitParIp: debitEntretien.ip,
    maintenant: () => Date.now(),
    modele: modeleClaude({ gabarit: lireGabaritSysteme(), identifiant: identifiantModele() }),
    signaler,
    // ⛔ `aval` reste vide jusqu’à P-008. La place est réservée pour que la
    //    synthèse s’y branche APRÈS la clôture, jamais avant.
  }
}

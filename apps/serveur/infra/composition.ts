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
import type { PortsBalayage } from '../domaine/entretien/balayage'
import type { PortsNotification } from '../domaine/notification/envoyer'
import { envoyerNote } from '../domaine/notification/envoyer'
import type { PortsIngestion } from '../domaine/retours/ingestion'
import type { PortsSynthese } from '../domaine/synthese/produire'
import type { PortsTour } from '../domaine/entretien/tour'
import { MAX_RELANCES } from '../domaine/entretien/tour'
import { creerDebitEntretien, creerDebitIngestion } from '../domaine/retours/debit'
import { etiquettesDe, produireSynthese } from '../domaine/synthese/produire'
import { modeleClaude } from '../domaine/entretien/modele'

import { pool } from './base/connexion'
import { creerDepotBalayage } from './base/depot-balayage'
import { creerDepotEntretien } from './base/depot-entretien'
import { creerDepotNotifications } from './base/depot-notifications'
import { creerDepotRetours } from './base/depot-retours'
import { creerDepotSyntheses } from './base/depot-syntheses'
import { creerSmtp } from './courriel/smtp'
import { lireGabaritSynthese, lireGabaritSysteme } from './prompts'
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
    modele: modeleDuServeur(),
    signaler,
    // ⛔ APRÈS la clôture, jamais avant, et son échec est avalé par
    //    `terminerEntretien` : une synthèse qui rate ne perd pas le retour, il
    //    est déjà en base et déjà clos.
    aval: (retourId) => synthetiser(retourId),
  }
}

/**
 * Les ports du filet.
 *
 * ⛔ `aval` est LE MÊME que celui de `portsTour` — la synthèse d’un entretien
 *    refermé par silence passe par le chemin ordinaire, pas par une seconde
 *    implémentation qui divergerait (domaine/entretien/balayage.ts).
 *
 * ⚠️ Ni clé, ni origine, ni débit : le balayage ne vient pas d’une requête.
 */
export function portsBalayage(): PortsBalayage {
  const depot = creerDepotBalayage(pool())

  return {
    clore: (avant, limite) => depot.clore(avant, limite),
    aval: (retourId) => synthetiser(retourId),
    signaler,
  }
}

function modeleDuServeur() {
  return modeleClaude({
    gabarit: lireGabaritSysteme(),
    gabaritSynthese: lireGabaritSynthese(),
    identifiant: identifiantModele(),
  })
}

export function portsSynthese(): PortsSynthese {
  return {
    depot: creerDepotSyntheses(pool()),
    modele: modeleDuServeur(),
    signaler,
  }
}

/**
 * Produit la synthèse d’un retour clos, et l’écrit.
 *
 * ⚠️ L’écriture est ici plutôt que dans le domaine parce que c’est un effet de
 *    bord : `produireSynthese` rend ce qu’il faut écrire, il n’écrit pas.
 */
export async function synthetiser(retourId: string): Promise<void> {
  const ports = portsSynthese()
  const resultat = await produireSynthese(retourId, ports, MAX_RELANCES)

  if (!resultat.ok) {
    // ⚠️ `deja_faite` et `rien_a_synthetiser` sont des issues normales, pas des
    //    pannes : une double fin d’entretien est une course ordinaire.
    if (resultat.motif === 'modele_indisponible' || resultat.motif === 'retour_inconnu') {
      signaler(`synthèse du retour — ${resultat.motif}`, new Error(resultat.motif))
    }
    return
  }

  await ports.depot.enregistrer(retourId, resultat.synthese, etiquettesDe(resultat.synthese.contenu))

  // ⛔ APRÈS l’écriture, jamais avant, et son échec est avalé : l’email est un
  //    confort, la note est déjà lisible au back-office et par MCP.
  await notifier(retourId)
}

/**
 * L’origine publique, pour composer le lien vers la fiche dans l’email.
 *
 * ⚠️ Sans elle on n’envoie pas de lien mort : on retombe sur une origine locale,
 *    qui se voit immédiatement dans le message.
 */
function urlPublique(): string {
  return process.env['FEEDYS_URL_PUBLIQUE']?.trim() || 'http://localhost:3000'
}

/**
 * ⚠️ Rend `undefined` quand l’email n’est pas configuré. Ce n’est pas une panne :
 *    un poste de développement sans relais SMTP doit tourner, et un retour sans
 *    notification reste un retour complet.
 */
export function portsNotification(): PortsNotification | undefined {
  const url = process.env['SMTP_URL']?.trim()
  const expediteur = process.env['FEEDYS_EMAIL_DE']?.trim()
  const destinataire = process.env['FEEDYS_EMAIL_A']?.trim()

  if (!url || !expediteur || !destinataire) return undefined

  return {
    depot: creerDepotNotifications(pool(), urlPublique()),
    smtp: creerSmtp({ url, expediteur }),
    destinataire,
    signaler,
  }
}

/**
 * Envoie la note. ⛔ N’interrompt jamais ce qui l’appelle.
 *
 * ⚠️ Un SMTP coupé laisse la notification en `echoue` et le retour en `envoye` :
 *    c’est le comportement attendu, pas une dégradation
 *    (04-Architecture/conventions-db.md §notifications).
 */
export async function notifier(retourId: string): Promise<void> {
  const ports = portsNotification()

  if (ports === undefined) {
    signaler(
      'envoi de la note — SMTP_URL, FEEDYS_EMAIL_DE ou FEEDYS_EMAIL_A est absente',
      new Error('email non configuré'),
    )
    return
  }

  try {
    await envoyerNote(retourId, ports)
  } catch (erreur) {
    signaler('envoi de la note par email', erreur)
  }
}

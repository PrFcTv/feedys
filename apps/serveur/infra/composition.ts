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
import type { PortsCollaborateur } from '../domaine/retours/collaborateur'
import type { PortsBalayage } from '../domaine/entretien/balayage'
import type { PortCanal } from '../domaine/notification/envoyer'
import { canalEmail, notifierParCanaux } from '../domaine/notification/envoyer'
import type { ReglagesTelegram } from '../domaine/notification/telegram'
import { canalTelegram, composerEssai, envoyerTelegram } from '../domaine/notification/telegram'
import type { PortsIngestion } from '../domaine/retours/ingestion'
import { synthetiserEtNotifier } from '../domaine/synthese/chaine'
import type { PortsSynthese } from '../domaine/synthese/produire'
import type { PortsRefaire } from '../domaine/synthese/refaire'
import type { IssueSynthese, PortsReprise } from '../domaine/synthese/reprise'
import type { PortsTour } from '../domaine/entretien/tour'
import { MAX_RELANCES } from '../domaine/entretien/tour'
import { creerDebitCollaborateur, creerDebitEntretien, creerDebitIngestion } from '../domaine/retours/debit'
import { modeleClaude } from '../domaine/entretien/modele'
import type { Installation, PortsVeille } from '../domaine/veille/alertes'
import { creerFenetreModele, mesurerModele } from '../domaine/veille/modele'

import { pool } from './base/connexion'
import { creerDepotBalayage } from './base/depot-balayage'
import { creerDepotCollaborateur } from './base/depot-collaborateur'
import { creerDepotEntretien } from './base/depot-entretien'
import { creerDepotNotifications } from './base/depot-notifications'
import { creerDepotReprise } from './base/depot-reprise'
import { creerDepotRetours } from './base/depot-retours'
import { creerDepotSyntheses } from './base/depot-syntheses'
import { creerDepotVeille } from './base/depot-veille'
import { creerSmtp } from './courriel/smtp'
import { lireGabaritSynthese, lireGabaritSysteme } from './prompts'
import { creerStockageFichiers } from './stockage/fichiers'

const debit = creerDebitIngestion()
const debitEntretien = creerDebitEntretien()

/**
 * ⚠️ Les appels au modèle de la dernière heure, réussis ou non — la mesure de
 *    l’alerte `modele_en_echec`. Singleton de module pour la même raison que les
 *    limiteurs : une fenêtre recréée à chaque requête ne mesurerait rien. Elle
 *    ne survit pas à un redémarrage, et c’est voulu (domaine/veille/modele.ts).
 */
const fenetreModele = creerFenetreModele()

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
 * ⚠️ Les limiteurs sont créés UNE fois au chargement du module, pas à chaque
 *    appel : des compteurs reconstruits à chaque requête ne compteraient rien.
 *    Même raison que `debit` et `debitEntretien` plus haut.
 */
const debitCollaborateur = creerDebitCollaborateur()

export function portsCollaborateur(): PortsCollaborateur {
  return {
    produits: creerDepotRetours(pool()),
    depot: creerDepotCollaborateur(pool()),
    debit: debitCollaborateur,
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
    //    est déjà en base et déjà clos — et le filet la redemandera.
    aval: async (retourId) => {
      await synthetiser(retourId)
    },
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
    aval: async (retourId) => {
      await synthetiser(retourId)
    },
    signaler,
  }
}

/**
 * Les ports des reprises.
 *
 * ⛔ `synthetiser` est LE MÊME que celui de la fin d’entretien — et il notifie
 *    déjà. Une note reprise part par le chemin ordinaire, pas par un second
 *    (domaine/synthese/reprise.ts).
 */
export function portsReprise(): PortsReprise {
  const depot = creerDepotReprise(pool())

  return {
    reserver: (limites, plafond) => depot.reserver(limites, plafond),
    synthetiser,
    renoncer: (retourId, motif) => depot.renoncer(retourId, motif),
    signaler,
  }
}

/**
 * ⚠️ Le modèle est MESURÉ : chaque appel, réussi ou non, entre dans la fenêtre
 *    de l’alerte `modele_en_echec`. Rien d’autre ne change pour l’appelant.
 */
function modeleDuServeur() {
  return mesurerModele(
    modeleClaude({
      gabarit: lireGabaritSysteme(),
      gabaritSynthese: lireGabaritSynthese(),
      identifiant: identifiantModele(),
    }),
    fenetreModele,
  )
}

export function portsSynthese(): PortsSynthese {
  return {
    depot: creerDepotSyntheses(pool()),
    modele: modeleDuServeur(),
    signaler,
  }
}

/**
 * Produit la synthèse d’un retour clos, l’écrit, et la notifie — par LE chemin
 * d’une note (domaine/synthese/chaine.ts).
 */
export function synthetiser(retourId: string): Promise<IssueSynthese> {
  return synthetiserEtNotifier(retourId, {
    synthese: portsSynthese(),
    notifier,
    maximumRelances: MAX_RELANCES,
  })
}

/**
 * Les ports du bouton « Refaire la note ».
 *
 * ⛔ `synthetiser`, et rien d’autre : le bouton ne touche ni aux reprises, ni au
 *    statut, ni au fil (01-Specs/back-office.md).
 */
export function portsRefaire(): PortsRefaire {
  const depot = creerDepotSyntheses(pool())

  return {
    statut: async (retourId) => (await depot.charger(retourId))?.statut ?? null,
    aSaNote: (retourId) => depot.dejaFaite(retourId),
    synthetiser,
  }
}

/**
 * L’origine publique, pour composer le lien vers la fiche.
 *
 * ⚠️ Sans elle on n’envoie pas de lien mort : on retombe sur une origine locale,
 *    qui se voit immédiatement dans le message.
 */
function urlPublique(): string {
  return process.env['FEEDYS_URL_PUBLIQUE']?.trim() || 'http://localhost:3000'
}

/**
 * Telegram, s’il est configuré.
 *
 * ⚠️ Les DEUX variables, ou rien : un jeton sans chat n’envoie nulle part, et le
 *    démarrage le dit (domaine/demarrage/controles.ts).
 */
export function reglagesTelegram(): ReglagesTelegram | undefined {
  const jeton = process.env['FEEDYS_TELEGRAM_JETON']?.trim()
  const chat = process.env['FEEDYS_TELEGRAM_CHAT']?.trim()

  return jeton && chat ? { jeton, chat } : undefined
}

/**
 * ⚠️ Le `fetch` natif, et l’attente réelle d’un 429 : c’est ce que les tests
 *    remplacent. ⛔ Aucune dépendance : rien d’autre n’est nécessaire.
 */
const PORTS_TELEGRAM = {
  fetch: (url: string, init: RequestInit) => fetch(url, init),
  attendre: (ms: number) => new Promise<void>((resoudre) => setTimeout(resoudre, ms)),
}

/**
 * Les canaux configurés — Telegram d’abord, l’email ensuite ([D-030]).
 *
 * ⚠️ Une liste vide n’est pas une panne : un poste de développement tourne sans,
 *    et un retour sans notification reste un retour complet.
 */
export function canauxConfigures(): PortCanal[] {
  const canaux: PortCanal[] = []

  const telegram = reglagesTelegram()
  if (telegram !== undefined) canaux.push(canalTelegram(telegram, PORTS_TELEGRAM))

  const url = process.env['SMTP_URL']?.trim()
  const expediteur = process.env['FEEDYS_EMAIL_DE']?.trim()
  const destinataire = process.env['FEEDYS_EMAIL_A']?.trim()
  if (url && expediteur && destinataire) {
    canaux.push(canalEmail(creerSmtp({ url, expediteur }), destinataire))
  }

  return canaux
}

/**
 * Envoie la note par chaque canal configuré. ⛔ N’interrompt jamais ce qui l’appelle.
 *
 * ⚠️ Un canal coupé laisse SA notification en `echoue` et n’empêche pas l’autre
 *    (04-Architecture/conventions-db.md §notifications).
 *
 * ⚠️ `pool()` est appelé DANS la fonction, pas au chargement : rien ne se
 *    connecte à l’import.
 */
export function notifier(retourId: string): Promise<void> {
  return notifierParCanaux(retourId, {
    depot: creerDepotNotifications(pool(), urlPublique()),
    canaux: canauxConfigures(),
    signaler,
  })
}

/** Qui parle, dans une alerte : les produits actifs et l’origine publique. */
async function installation(): Promise<Installation> {
  return {
    produits: await creerDepotVeille(pool()).produits(),
    origine: urlPublique(),
  }
}

export type IssueEssai = { readonly ok: true } | { readonly ok: false; readonly raison: string }

/**
 * Le message d’essai de la liste d’installation.
 *
 * ⛔ Il n’écrit rien en base, et il ne rend qu’une raison nettoyée : le jeton
 *    n’y est pas (domaine/notification/telegram.ts).
 */
export async function envoyerEssaiTelegram(): Promise<IssueEssai> {
  const reglages = reglagesTelegram()
  if (reglages === undefined) {
    return {
      ok: false,
      raison: 'Telegram n’est pas configuré : FEEDYS_TELEGRAM_JETON et FEEDYS_TELEGRAM_CHAT.',
    }
  }

  const qui = await installation()
  const nom = `${qui.produits.join(', ') || 'aucun produit'} · ${qui.origine}`

  try {
    await envoyerTelegram(composerEssai(nom), reglages, PORTS_TELEGRAM)
    return { ok: true }
  } catch (erreur) {
    return { ok: false, raison: erreur instanceof Error ? erreur.message : String(erreur) }
  }
}

/**
 * Les ports de la veille.
 *
 * ⛔ `prevenir` est Telegram, et lui seul : une alerte ne passe pas par ce
 *    qu’elle surveille — ni par le SMTP, ni par le modèle.
 */
export function portsVeille(journal: (texte: string) => void): PortsVeille {
  const depot = creerDepotVeille(pool())
  const telegram = reglagesTelegram()

  return {
    ouvertes: () => depot.ouvertes(),
    ouvrir: (genre) => depot.ouvrir(genre),
    fermer: (id) => depot.fermer(id),
    consigner: (id, erreur) => depot.consigner(id, erreur),
    derniereFermeture: (genre) => depot.derniereFermeture(genre),
    impossiblesDepuis: (instant) => depot.impossiblesDepuis(instant),
    noteEcriteDepuis: (instant) => depot.noteEcriteDepuis(instant),
    retours: () => depot.retours(),
    partVoix: (depuis) => depot.partVoix(depuis),
    etatModele: () => fenetreModele.etat(),
    installation,
    ...(telegram === undefined
      ? {}
      : { prevenir: (texte: string) => envoyerTelegram(texte, telegram, PORTS_TELEGRAM) }),
    journal,
  }
}

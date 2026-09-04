/**
 * L’envoi de la note par email.
 *
 * ⚠️ LA NOTIFICATION EST UN CONFORT, PAS LE CHEMIN. Le retour est en base depuis
 *    l’ingestion, clos depuis la fin d’entretien, et sa note est écrite avant
 *    qu’on tente quoi que ce soit ici. Un SMTP coupé laisse donc un retour
 *    `envoye` et une notification `echoue` — et rien n’est perdu
 *    (04-Architecture/conventions-db.md §notifications).
 *
 * ⚠️ L’ÉCHEC D’ENVOI EST UNE ISSUE, PAS UNE PANNE : il est rattrapé ici et
 *    écrit sur la ligne. Reste le cas où c’est la BASE qui tombe — il remonte,
 *    et c’est l’appelant (infra/composition.ts) qui l’avale, au même endroit et
 *    pour la même raison que l’échec d’une synthèse.
 *
 * ⛔ Module pur : ni base, ni réseau (architecture.md §3). Le SMTP entre par un
 *    port, la ligne de journal aussi.
 */
import type { MessageEmail, RetourANotifier } from './message'
import { composerMessage } from './message'

export interface PortDepotNotifications {
  /** ⚠️ Rend `null` si le retour n’a pas (ou pas encore) de synthèse : il n’y a rien à envoyer. */
  charger(retourId: string): Promise<RetourANotifier | null>
  /** Ouvre la ligne en `en_attente` et rend son id. ⚠️ Écrite AVANT la tentative. */
  ouvrir(retourId: string, destinataire: string): Promise<string>
  clore(notificationId: string, erreur: string | null): Promise<void>
  /** ⛔ Une seule notification par retour : une note ne se renvoie pas toute seule. */
  dejaEnvoyee(retourId: string): Promise<boolean>
}

export interface PortSmtp {
  envoyer(destinataire: string, message: MessageEmail): Promise<void>
}

export interface PortsNotification {
  readonly depot: PortDepotNotifications
  readonly smtp: PortSmtp
  /** `FEEDYS_EMAIL_A` — le développeur qui lit. */
  readonly destinataire: string
  /** ⛔ Jamais le contenu d’un retour : la parole ne va pas dans les journaux. */
  readonly signaler?: (quoi: string, erreur: unknown) => void
}

export type MotifRefusNotification = 'retour_inconnu' | 'deja_envoyee' | 'sans_destinataire'

export type ResultatNotification =
  | { readonly ok: true; readonly statut: 'envoye' }
  | { readonly ok: true; readonly statut: 'echoue'; readonly erreur: string }
  | { readonly ok: false; readonly motif: MotifRefusNotification }

/**
 * ⚠️ Le message d’erreur est TRONQUÉ avant d’aller en base : un serveur SMTP
 *    bavard peut rendre plusieurs kilooctets, et la colonne sert à diagnostiquer,
 *    pas à archiver.
 */
const LONGUEUR_ERREUR = 500

function raconter(erreur: unknown): string {
  const texte = erreur instanceof Error ? erreur.message : String(erreur)
  return texte.slice(0, LONGUEUR_ERREUR)
}

export async function envoyerNote(
  retourId: string,
  ports: PortsNotification,
): Promise<ResultatNotification> {
  if (!ports.destinataire.trim()) return { ok: false, motif: 'sans_destinataire' }

  const retour = await ports.depot.charger(retourId)
  if (retour === null) return { ok: false, motif: 'retour_inconnu' }

  if (await ports.depot.dejaEnvoyee(retourId)) return { ok: false, motif: 'deja_envoyee' }

  const notificationId = await ports.depot.ouvrir(retourId, ports.destinataire)

  try {
    await ports.smtp.envoyer(ports.destinataire, composerMessage(retour))
  } catch (erreur) {
    const message = raconter(erreur)
    // ⚠️ La ligne passe à `echoue`, et c’est tout ce qui se passe de mauvais :
    //    la note reste lisible au back-office et par MCP.
    await ports.depot.clore(notificationId, message)
    ports.signaler?.('envoi de la note par email', erreur)
    return { ok: true, statut: 'echoue', erreur: message }
  }

  await ports.depot.clore(notificationId, null)
  return { ok: true, statut: 'envoye' }
}

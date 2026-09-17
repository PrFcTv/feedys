/**
 * L’envoi d’une note, canal par canal — Telegram et l’email.
 *
 * ⚠️ LA NOTIFICATION EST UN CONFORT, PAS LE CHEMIN. Le retour est en base depuis
 *    l’ingestion, clos depuis la fin d’entretien, et sa note est écrite avant
 *    qu’on tente quoi que ce soit ici. Un canal coupé laisse donc un retour
 *    `envoye` et une notification `echoue` — et rien n’est perdu
 *    (04-Architecture/conventions-db.md §notifications).
 *
 * ⚠️ L’ÉCHEC D’ENVOI EST UNE ISSUE, PAS UNE PANNE : il est rattrapé ici et
 *    écrit sur la ligne. Reste le cas où c’est la BASE qui tombe — il remonte,
 *    et c’est l’appelant (infra/composition.ts) qui l’avale, au même endroit et
 *    pour la même raison que l’échec d’une synthèse.
 *
 * ⛔ UNE NOTIFICATION PAR RETOUR ET PAR CANAL. Quand les deux sont configurés,
 *    les deux partent, une fois chacun ([D-030]) — l’avis sur le téléphone, la
 *    note dans la boîte. L’index `notifications_retour_canal_uniq` le tient en
 *    base ; `dejaEnvoyee` n’est que le filtre du cas ordinaire.
 *
 * ⛔ Module pur : ni base, ni réseau (architecture.md §3). Chaque canal entre
 *    par un port, la ligne de journal aussi.
 */
import type { MessageEmail, RetourANotifier } from './message'
import { composerMessage } from './message'

/** ⛔ La liste est celle de l’enum `canal_notification`. */
export type CanalNotification = 'email' | 'telegram'

export interface PortDepotNotifications {
  /** ⚠️ Rend `null` si le retour n’a pas (ou pas encore) de synthèse : il n’y a rien à envoyer. */
  charger(retourId: string): Promise<RetourANotifier | null>
  /**
   * Ouvre la ligne en `en_attente` et rend son id. ⚠️ Écrite AVANT la tentative.
   *
   * ⚠️ `null` si la ligne existe déjà pour ce canal : c’est l’index unique qui a
   *    tranché une course, et elle vaut `deja_envoyee`.
   */
  ouvrir(retourId: string, destinataire: string, canal: CanalNotification): Promise<string | null>
  clore(notificationId: string, erreur: string | null): Promise<void>
  /** ⛔ Une seule notification par retour ET par canal : une note ne se renvoie pas toute seule. */
  dejaEnvoyee(retourId: string, canal: CanalNotification): Promise<boolean>
}

export interface PortSmtp {
  envoyer(destinataire: string, message: MessageEmail): Promise<void>
}

/**
 * Un canal : ce qui compose le message et l’envoie à UN destinataire.
 *
 * ⛔ `envoyer` ne lève qu’une erreur qu’on peut écrire en base et en journal.
 *    Pour Telegram, c’est une contrainte réelle : le jeton est dans l’URL
 *    (`telegram.ts`).
 */
export interface PortCanal {
  readonly canal: CanalNotification
  /** L’adresse, ou le chat. Écrit en base — ⛔ jamais un secret. */
  readonly destinataire: string
  envoyer(retour: RetourANotifier): Promise<void>
}

/** Les ports de l’email, tels qu’ils étaient avant qu’un second canal arrive. */
export interface PortsNotification {
  readonly depot: PortDepotNotifications
  readonly smtp: PortSmtp
  /** `FEEDYS_EMAIL_A` — le développeur qui lit. */
  readonly destinataire: string
  /** ⛔ Jamais le contenu d’un retour : la parole ne va pas dans les journaux. */
  readonly signaler?: (quoi: string, erreur: unknown) => void
}

export interface PortsCanal {
  readonly depot: PortDepotNotifications
  readonly canal: PortCanal
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

const LIBELLES_CANAL: Record<CanalNotification, string> = {
  email: 'email',
  telegram: 'Telegram',
}

function raconter(erreur: unknown): string {
  const texte = erreur instanceof Error ? erreur.message : String(erreur)
  return texte.slice(0, LONGUEUR_ERREUR)
}

/** Le canal email : la note entière, en texte brut (01-Specs/synthese.md §Le rendu par email). */
export function canalEmail(smtp: PortSmtp, destinataire: string): PortCanal {
  return {
    canal: 'email',
    destinataire,
    envoyer: (retour) => smtp.envoyer(destinataire, composerMessage(retour)),
  }
}

/** L’email, comme avant. ⚠️ Gardé tel quel : ses tests aussi. */
export async function envoyerNote(
  retourId: string,
  ports: PortsNotification,
): Promise<ResultatNotification> {
  return envoyerParCanal(retourId, {
    depot: ports.depot,
    canal: canalEmail(ports.smtp, ports.destinataire),
    ...(ports.signaler ? { signaler: ports.signaler } : {}),
  })
}

export async function envoyerParCanal(
  retourId: string,
  ports: PortsCanal,
): Promise<ResultatNotification> {
  const { canal } = ports
  if (!canal.destinataire.trim()) return { ok: false, motif: 'sans_destinataire' }

  const retour = await ports.depot.charger(retourId)
  if (retour === null) return { ok: false, motif: 'retour_inconnu' }

  if (await ports.depot.dejaEnvoyee(retourId, canal.canal)) {
    return { ok: false, motif: 'deja_envoyee' }
  }

  const notificationId = await ports.depot.ouvrir(retourId, canal.destinataire, canal.canal)
  if (notificationId === null) return { ok: false, motif: 'deja_envoyee' }

  try {
    await canal.envoyer(retour)
  } catch (erreur) {
    const message = raconter(erreur)
    // ⚠️ La ligne passe à `echoue`, et c’est tout ce qui se passe de mauvais :
    //    la note reste lisible au back-office et par MCP.
    await ports.depot.clore(notificationId, message)
    ports.signaler?.(`envoi de la note par ${LIBELLES_CANAL[canal.canal]}`, erreur)
    return { ok: true, statut: 'echoue', erreur: message }
  }

  await ports.depot.clore(notificationId, null)
  return { ok: true, statut: 'envoye' }
}

export interface PortsCanaux {
  readonly depot: PortDepotNotifications
  /** ⚠️ Dans l’ordre d’envoi : Telegram d’abord, l’email ensuite ([D-030]). */
  readonly canaux: readonly PortCanal[]
  readonly signaler?: (quoi: string, erreur: unknown) => void
}

/**
 * La note, par chaque canal configuré. ⛔ Ne lève jamais.
 *
 * ⚠️ Un canal coupé laisse SA notification en `echoue` et n’empêche pas l’autre.
 *    Ce qui remonterait d’un canal vient de la base — `envoyerParCanal` rattrape
 *    l’échec d’envoi lui-même.
 *
 * ⚠️ Aucun canal n’est pas une panne — un poste de développement tourne sans —,
 *    mais ça se dit : la note ne part pour personne.
 */
export async function notifierParCanaux(retourId: string, ports: PortsCanaux): Promise<void> {
  if (ports.canaux.length === 0) {
    ports.signaler?.(
      'envoi de la note — aucun canal configuré (FEEDYS_TELEGRAM_JETON et FEEDYS_TELEGRAM_CHAT, ' +
        'ou SMTP_URL, FEEDYS_EMAIL_DE et FEEDYS_EMAIL_A)',
      new Error('aucun canal de notification'),
    )
    return
  }

  for (const canal of ports.canaux) {
    try {
      await envoyerParCanal(retourId, {
        depot: ports.depot,
        canal,
        ...(ports.signaler ? { signaler: ports.signaler } : {}),
      })
    } catch (erreur) {
      ports.signaler?.(`envoi de la note par ${LIBELLES_CANAL[canal.canal]}`, erreur)
    }
  }
}

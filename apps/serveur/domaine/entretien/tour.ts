/**
 * La boucle d’entretien — au plus trois tours, et jamais un de plus.
 *
 * ⛔ L’INVARIANT : aucun mode de défaillance ne perd le retour. Modèle muet,
 *    transcript vide, réponse à côté, panneau refermé — dans les quatre cas la
 *    parole est déjà en base, écrite par l’ingestion avant tout appel au modèle
 *    (01-Specs/entretien.md §Modes de défaillance).
 *
 * ⛔ LA LIMITE DE DEUX RELANCES EST APPLIQUÉE ICI, CÔTÉ SERVEUR. Elle est
 *    comptée sur le FIL EN BASE — c’est-à-dire sur ce qui s’est réellement
 *    passé — et pas sur un compteur envoyé par le widget. Forger la requête ne
 *    donne donc pas une troisième relance : il faudrait forger le fil
 *    ([D-006](../../../../00-Projet/DECISIONS_LOG.md)).
 *
 * ⛔ Module pur : ni base, ni réseau, ni horloge. Tout ce qui a un effet de bord
 *    entre par un port (04-Architecture/architecture.md §3).
 */
import { BORNES, PREFIXE_CLE_PUBLIQUE } from '../../../../packages/widget/src/contrat'
import type { PortDebit } from '../retours/debit'
import type { PortDepotRetours } from '../retours/ingestion'
import { origineAutorisee } from '../retours/origine'

import type { Comprehension, Modele, TourEntretien } from './modele'
import type { ContexteEntretien, TourFil } from './prompts'

/**
 * ⛔ DEUX. Pas « deux par défaut », pas « deux, configurable » : une limite dure.
 *
 * Un modèle à qui on demande de continuer jusqu’à ce que ce soit clair ne
 * s’arrête jamais — il y a toujours une précision de plus à obtenir. Et un
 * entretien qui dure est un widget qu’on n’ouvre plus jamais ([D-006]).
 */
export const MAX_RELANCES = 2

/**
 * ⚠️ La seule relance admise quand on n’a rien compris. Elle est ÉCRITE ICI et
 *    pas demandée au modèle : on ne dépense pas un appel pour dire qu’on n’a
 *    rien entendu, et la phrase doit être la même à chaque fois.
 */
export const RELANCE_INAUDIBLE = 'Je n’ai pas bien saisi — vous pouvez redire ?'

const MOTIF_INAUDIBLE = 'Le transcript est vide ou trop court pour être compris.'

/** En dessous, il n’y a pas de quoi comprendre quoi que ce soit. */
const PAROLE_MINIMALE = 3

export interface MessageAEcrire {
  readonly ordre: number
  readonly role: 'collaborateur' | 'bot'
  readonly texte: string
  readonly transcriptBrut: string | null
  readonly motif: string | null
}

/** L’état d’un entretien, tel que la base le rend. */
export interface EntretienCharge {
  readonly statut: string
  readonly contexte: ContexteEntretien
  /** Le fil complet, dans l’ordre. */
  readonly fil: readonly TourFil[]
  /** ⚠️ `max(ordre) + 1`, et pas `fil.length` : un trou ne doit pas écraser une ligne. */
  readonly prochainOrdre: number
}

export interface PortDepotEntretien {
  /**
   * ⛔ Borné par le produit déduit de la clé, jamais par un paramètre client
   *    (04-Architecture/architecture.md §Sécurité).
   */
  charger(retourId: string, produitId: string): Promise<EntretienCharge | null>
  /** Écrit les lignes du fil, dans l’ordre, en une transaction. */
  ecrire(retourId: string, messages: readonly MessageAEcrire[]): Promise<void>
  /** Change le statut et pose `envoye_le`. */
  clore(retourId: string, statut: 'envoye' | 'abandonne'): Promise<void>
}

export interface PortsTour {
  readonly depot: PortDepotEntretien
  /** ⛔ La clé publique ne donne accès qu’au produit qu’elle ouvre, et à rien d’autre. */
  readonly produits: Pick<PortDepotRetours, 'produitParCle'>
  readonly modele: Modele
  /**
   * ⛔ Un tour APPELLE LE MODÈLE, donc il coûte. Sans limite, une clé publique
   *    trouvée dans un HTML devient une facture — c’est le seul endroit du
   *    produit où le bruit coûte de l’argent et pas seulement des lignes.
   */
  readonly debitParCle: PortDebit
  readonly debitParIp: PortDebit
  readonly maintenant: () => number
  /** ⛔ Jamais le contenu d’un retour : la parole ne va pas dans les journaux. */
  readonly signaler?: (quoi: string, erreur: unknown) => void
  /**
   * ⛔ CE QUI VIENT APRÈS LA FIN DE L’ENTRETIEN — la synthèse (P-008), puis
   *    l’email (P-009). Son échec est avalé : le retour est déjà clos en base.
   */
  readonly aval?: (retourId: string) => Promise<void>
}

/** ⚠️ Ce que TOUTE requête d’entretien porte : la clé, l’origine, l’IP. */
export interface AccesEntretien {
  readonly retourId: string
  readonly cle: string | null
  readonly origine: string | null
  readonly ip: string
}

export interface EntreeTour extends AccesEntretien {
  readonly texte?: string | undefined
  readonly transcriptBrut?: string | undefined
  readonly corrections?: string | undefined
}

export interface EntreeFin extends AccesEntretien {
  readonly raison: 'envoi' | 'abandon'
  readonly texte?: string | undefined
  readonly transcriptBrut?: string | undefined
  readonly corrections?: string | undefined
}

export type MotifRefusTour =
  | 'cle_absente'
  | 'produit_inconnu'
  | 'origine_refusee'
  | 'debit_depasse'
  | 'retour_inconnu'
  | 'entretien_clos'
  | 'modele_indisponible'

/** Ce qu’un tour rend au transport. ⚠️ `comprehension` peut être absente : voir §transcript vide. */
export interface TourRendu {
  readonly comprehension: Comprehension | null
  readonly question: string | null
  readonly motif: string
}

export type ResultatTour =
  | { readonly ok: true; readonly tour: TourRendu }
  | { readonly ok: false; readonly motif: MotifRefusTour; readonly message: string }

export type ResultatFin =
  | { readonly ok: true; readonly statut: 'envoye' | 'abandonne' }
  | { readonly ok: false; readonly motif: MotifRefusTour; readonly message: string }

const MESSAGES: Readonly<Record<MotifRefusTour, string>> = {
  cle_absente: 'Clé de produit absente ou mal formée.',
  produit_inconnu: 'Produit inconnu.',
  origine_refusee: 'Cette origine n’est pas celle du produit.',
  debit_depasse: 'Trop de tours d’un coup. Réessayez dans un instant.',
  retour_inconnu: 'Ce retour n’existe pas.',
  entretien_clos: 'Cet entretien est terminé.',
  modele_indisponible: 'Le bot n’est pas joignable. Votre retour est enregistré.',
}

function refus(motif: MotifRefusTour): { ok: false; motif: MotifRefusTour; message: string } {
  return { ok: false, motif, message: MESSAGES[motif] }
}

/**
 * Le produit qu’ouvre cette clé, ou un refus.
 *
 * ⛔ C’EST LE SEUL CHEMIN VERS UN `produit_id`. Il n’est jamais lu d’un paramètre
 *    de requête, jamais déduit du retour lui-même : un identifiant de retour
 *    deviné ne donne donc accès à rien chez un autre produit
 *    (04-Architecture/architecture.md §Sécurité).
 *
 * ⚠️ Le débit est prélevé AVANT la base, comme à l’ingestion : c’est elle qu’on
 *    protège, et le modèle avec.
 */
async function autoriser(
  entree: AccesEntretien,
  ports: PortsTour,
): Promise<{ ok: true; produitId: string } | { ok: false; motif: MotifRefusTour; message: string }> {
  const cle = entree.cle?.trim() ?? ''
  if (cle === '' || !cle.startsWith(PREFIXE_CLE_PUBLIQUE)) return refus('cle_absente')

  const maintenant = ports.maintenant()
  const sousLaLimite =
    ports.debitParCle.autoriser(cle, maintenant) && ports.debitParIp.autoriser(entree.ip, maintenant)

  if (!sousLaLimite) return refus('debit_depasse')

  const produit = await ports.produits.produitParCle(cle)
  // ⚠️ `produit_inconnu` couvre volontairement clé inexistante ET produit
  //    désactivé : les distinguer dirait à un curieux qu’une clé trouvée dans un
  //    HTML existe encore.
  if (produit === null || !produit.actif) return refus('produit_inconnu')

  if (!origineAutorisee(entree.origine, produit.domaine)) return refus('origine_refusee')

  return { ok: true, produitId: produit.id }
}

/** Le nombre de relances déjà posées : une ligne `bot` = une question posée. */
export function relancesPosees(fil: readonly TourFil[]): number {
  return fil.filter((tour) => tour.role === 'bot').length
}

/**
 * Joue un tour d’entretien.
 *
 * ⚠️ L’ordre des opérations n’est pas indifférent : ce que la personne vient de
 *    dire est ÉCRIT AVANT l’appel au modèle. Si le modèle expire, sa réponse est
 *    quand même dans le fil, et la synthèse la lira.
 */
export async function jouerTour(entree: EntreeTour, ports: PortsTour): Promise<ResultatTour> {
  const acces = await autoriser(entree, ports)
  if (!acces.ok) return acces

  const entretien = await ports.depot.charger(entree.retourId, acces.produitId)
  if (entretien === null) return refus('retour_inconnu')

  // ⛔ LA PAROLE S’ÉCRIT AVANT LA GARDE DE STATUT, ET C’EST L’ORDRE QUI COMPTE.
  //    `messages` est append-only et ne porte aucune contrainte de statut :
  //    écrire un tour sur un entretien clos est inoffensif. L’inverse ne l’est
  //    pas.
  //
  // ⚠️ POURQUOI ÇA A CHANGÉ. Tant que seul le widget refermait, cette branche
  //    n’était atteignable que par la course `POST /fin` × 2, où le champ est
  //    vide par construction. Depuis le filet (P-016), un panneau resté ouvert
  //    trente minutes est refermé SOUS LES PIEDS de quelqu’un qui est encore en
  //    train d’écrire. Refuser avant d’écrire jetait sa phrase — et le widget
  //    lui répondait « C’est noté ».
  const apportes = composerApports(entree, entretien.prochainOrdre)
  if (apportes.length > 0) await ports.depot.ecrire(entree.retourId, apportes)

  if (entretien.statut !== 'en_cours') {
    // ⚠️ La note est peut-être déjà partie — l’aval le sait et ne la refait pas
    //    (`deja_faite`). Si elle ne l’est pas, elle contiendra ces mots-là.
    if (apportes.length > 0) await rejouerAval(entree.retourId, ports)
    return refus('entretien_clos')
  }

  const fil: TourFil[] = [
    ...entretien.fil,
    ...apportes.map(({ role, texte }) => ({ role, texte })),
  ]
  const ordreLibre = entretien.prochainOrdre + apportes.length
  const posees = relancesPosees(fil)
  const restantes = Math.max(0, MAX_RELANCES - posees)

  // ⚠️ Rien d’intelligible : une SEULE relance, écrite ici, puis on envoie le
  //    brut. Une carte fabriquée sur du vide serait un mensonge — d’où
  //    `comprehension: null` plutôt qu’une compréhension inventée.
  if (!intelligible(fil)) {
    if (posees > 0) {
      return { ok: true, tour: { comprehension: null, question: null, motif: MOTIF_INAUDIBLE } }
    }

    await ports.depot.ecrire(entree.retourId, [
      { ordre: ordreLibre, role: 'bot', texte: RELANCE_INAUDIBLE, transcriptBrut: null, motif: MOTIF_INAUDIBLE },
    ])

    return {
      ok: true,
      tour: { comprehension: null, question: RELANCE_INAUDIBLE, motif: MOTIF_INAUDIBLE },
    }
  }

  let brut: TourEntretien
  try {
    brut = await ports.modele.tour({ contexte: entretien.contexte, fil, relancesRestantes: restantes })
  } catch (erreur) {
    // ⛔ Le modèle muet ne perd rien : la carte n’apparaît pas, le champ texte
    //    reste, « Envoyer » fonctionne, et le retour brut part quand même.
    ports.signaler?.('tour d’entretien', erreur)
    return refus('modele_indisponible')
  }

  const tour = borner(brut, restantes)

  // ⚠️ Une ligne `bot` n’est écrite QUE si le bot a posé une question. C’est ce
  //    qui rend le compte des relances exact et non interprétable : le fil dit
  //    ce qui a été demandé, la carte est rendue au widget et corrigée là.
  if (tour.question !== null) {
    await ports.depot.ecrire(entree.retourId, [
      { ordre: ordreLibre, role: 'bot', texte: tour.question, transcriptBrut: null, motif: tour.motif },
    ])
  }

  return { ok: true, tour }
}

/**
 * Termine l’entretien : envoi manuel, limite atteinte, ou panneau refermé.
 *
 * ⛔ `abandonne` n’est pas un échec. Le retour est conservé et envoyé en l’état :
 *    un retour partiel vaut mieux que rien (01-Specs/entretien.md).
 */
export async function terminerEntretien(entree: EntreeFin, ports: PortsTour): Promise<ResultatFin> {
  const acces = await autoriser(entree, ports)
  if (!acces.ok) return acces

  const entretien = await ports.depot.charger(entree.retourId, acces.produitId)
  if (entretien === null) return refus('retour_inconnu')

  const statut = entree.raison === 'abandon' ? 'abandonne' : 'envoye'

  // ⚠️ Déjà clos : on ne rejoue pas, et on ne se plaint pas non plus. Le widget
  //    peut envoyer un abandon en fermeture de page APRÈS un envoi manuel — la
  //    course est normale, et elle ne doit rien changer.
  if (entretien.statut !== 'en_cours') {
    if (entretien.statut !== 'abandonne' && entretien.statut !== 'envoye') {
      return refus('entretien_clos')
    }

    // ⛔ MÊME RAISON QU’AU-DESSUS, ET C’EST ICI QUE ÇA MENTAIT LE PLUS FORT :
    //    on rendait 200 sans rien écrire, et le widget affichait « C’est
    //    parti. » sur une phrase qui n’était allée nulle part.
    const tardifs = composerApports(entree, entretien.prochainOrdre)
    if (tardifs.length > 0) {
      await ports.depot.ecrire(entree.retourId, tardifs)
      await rejouerAval(entree.retourId, ports)
    }

    return { ok: true, statut: entretien.statut }
  }

  // ⚠️ Ce que la personne venait d’écrire part AVEC la fin. Elle a cliqué sur
  //    « Envoyer maintenant », pas sur « jeter ce que je viens de taper ».
  const apportes = composerApports(entree, entretien.prochainOrdre)
  if (apportes.length > 0) await ports.depot.ecrire(entree.retourId, apportes)

  // ⚠️ `CLORE` porte `where statut = 'en_cours'` : si le filet est passé une
  //    fraction de seconde plus tôt, il ne touche AUCUNE ligne, en silence.
  await ports.depot.clore(entree.retourId, statut)

  // ⛔ APRÈS la clôture, et sans pouvoir la défaire.
  //
  // ⚠️ CE QUI EMPÊCHE LA DOUBLE NOTE N’EST PAS UN VERROU, c’est
  //    `syntheses_retour_uniq` (0001_socle.sql). `dejaFaite` filtre le cas
  //    ordinaire ; deux synthèses réellement en vol passent toutes deux ce
  //    contrôle, et c’est la contrainte d’unicité qui refuse la seconde. On
  //    l’écrit ici parce que le croire garanti par la réservation du balayage
  //    serait faux — elle ne protège le filet que de lui-même.
  await rejouerAval(entree.retourId, ports)

  return { ok: true, statut }
}

/**
 * L’aval, joué sans jamais pouvoir faire échouer ce qui l’a déclenché.
 *
 * ⛔ Son échec ne remonte pas : le message est en base, et c’est lui qui compte.
 *    Une note qui manque se rattrape — la requête est dans
 *    04-Architecture/hebergement.md §Le filet ; une phrase perdue, non.
 *
 * ⚠️ `retourId` est dans le message, et ce n’est pas un détail : sans lui, les
 *    journaux disent qu’une note a manqué sans dire laquelle. Un cuid n’est pas
 *    de la parole — la règle « jamais le corps d’un retour » n’est pas en cause.
 */
async function rejouerAval(retourId: string, ports: PortsTour): Promise<void> {
  if (!ports.aval) return

  try {
    await ports.aval(retourId)
  } catch (erreur) {
    ports.signaler?.(`traitement en aval de la fin d’entretien · ${retourId}`, erreur)
  }
}

/**
 * Ce que la personne apporte à ce tour, en lignes de fil.
 *
 * ⚠️ La correction d’abord, la réponse ensuite : c’est l’ordre dans lequel ça se
 *    fait à l’écran, et le modèle doit lire les deux dans cet ordre-là.
 */
function composerApports(
  entree: { readonly texte?: string | undefined; readonly transcriptBrut?: string | undefined; readonly corrections?: string | undefined },
  depuis: number,
): MessageAEcrire[] {
  const lignes: MessageAEcrire[] = []

  const corrections = entree.corrections?.trim()
  if (corrections) {
    lignes.push({
      ordre: depuis + lignes.length,
      role: 'collaborateur',
      texte: `Correction · ${tronquer(corrections, BORNES.texte)}`,
      transcriptBrut: null,
      motif: null,
    })
  }

  const texte = entree.texte?.trim()
  if (texte) {
    const brut = entree.transcriptBrut?.trim()
    lignes.push({
      ordre: depuis + lignes.length,
      role: 'collaborateur',
      texte: tronquer(texte, BORNES.texte),
      transcriptBrut: brut ? tronquer(brut, BORNES.texte) : null,
      motif: null,
    })
  }

  return lignes
}

/** Y a-t-il quelque chose à comprendre dans ce que la personne a dit ? */
function intelligible(fil: readonly TourFil[]): boolean {
  const parole = fil
    .filter((tour) => tour.role === 'collaborateur')
    .map((tour) => tour.texte.trim())
    .join(' ')
    .trim()

  return parole.length >= PAROLE_MINIMALE
}

/**
 * Ramène la sortie du modèle dans les bornes du contrat — et applique le verrou.
 *
 * ⛔ C’EST ICI QUE LA TROISIÈME RELANCE DEVIENT IMPOSSIBLE. Le modèle a beau
 *    poser une question, si le fil en porte déjà deux, elle est jetée. Le prompt
 *    le lui demande poliment ; cette ligne ne le lui demande pas.
 */
export function borner(tour: TourEntretien, relancesRestantes: number): TourRendu {
  const { comprehension } = tour

  return {
    comprehension: {
      type: comprehension.type,
      titre: tronquer(comprehension.titre, BORNES.titre),
      resume: tronquer(comprehension.resume, BORNES.resume),
      ...(comprehension.ecran ? { ecran: tronquer(comprehension.ecran, BORNES.ecran) } : {}),
      ...(comprehension.recurrence ? { recurrence: comprehension.recurrence } : {}),
    },
    question:
      relancesRestantes <= 0 || tour.question === null || tour.question.trim() === ''
        ? null
        : tronquer(tour.question, BORNES.question),
    motif: tronquer(tour.motif, BORNES.motif),
  }
}

/** ⚠️ Une troncature, jamais un rejet : perdre un tour entier pour un caractère de trop serait absurde. */
function tronquer(valeur: string, maximum: number): string {
  const propre = valeur.trim()
  return propre.length <= maximum ? propre : propre.slice(0, maximum)
}

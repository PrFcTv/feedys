/**
 * Le retour au collaborateur — relève et accusé de réception.
 *
 * ⛔ CE N’EST PAS UN CHAT, CE N’EST PAS UN SYSTÈME DE SUPPORT. C’est une
 *    notification SOBRE ET À SENS UNIQUE : le collaborateur est informé que ce
 *    qu’il a dicté ou écrit a été pris en compte ou écarté par le développeur
 *    (01-Specs/retour-au-collaborateur.md).
 *
 * ⛔ L’INVARIANT DE LA RELÈVE : un collaborateur anonyme (sans identité signée
 *    ou avec un jeton expiré) ne reçoit aucun accusé, mais rien ne casse. La
 *    relève rend 200 avec une liste vide (P-020).
 *
 * ⛔ Seul le propriétaire du `ref` vérifié par l’hôte peut lire la réponse qui
 *    lui est adressée et en accuser réception.
 *
 * ⛔ Module pur : ni base, ni réseau, ni horloge. L’heure entre par paramètre
 *    (04-Architecture/architecture.md §3).
 */
import type { ReponseCollaborateur } from '../../../../packages/widget/src/contrat'
export type { ReponseCollaborateur }
import { verifierIdentite } from '../identite/jeton'
import type { PortDebit } from './debit'
import type { ProduitConnu } from './ingestion'
import { origineAutorisee } from './origine'

export type MotifRefusReleve =
  | 'cle_absente'
  | 'produit_inconnu'
  | 'origine_refusee'
  | 'debit_depasse'

/**
 * ⛔ Il n’y a PAS de motif « vous n’êtes pas l’auteur ». Un retour qui existe
 *    mais appartient à quelqu’un d’autre et un retour qui n’existe pas rendent le
 *    MÊME refus : sinon l’API devient un oracle où n’importe quel collaborateur
 *    du produit énumère les identifiants de ses collègues
 *    (01-Specs/retour-au-collaborateur.md §3).
 */
export type MotifRefusAccuse =
  | 'cle_absente'
  | 'produit_inconnu'
  | 'origine_refusee'
  | 'identite_invalide'
  | 'retour_inconnu'
  | 'debit_depasse'

export interface ReleveCollaborateurEntree {
  readonly cle: string | null
  readonly identite: string | null
  readonly origine: string | null
  readonly ip: string
  readonly maintenant: number
}

export interface AccuseCollaborateurEntree {
  readonly retourId: string
  readonly cle: string | null
  readonly identite: string | null
  readonly origine: string | null
  readonly ip: string
  readonly maintenant: number
}

export interface PortDepotCollaborateur {
  releverReponses(produitId: string, auteurRef: string): Promise<ReponseCollaborateur[]>
  trouverAuteurRef(retourId: string, produitId: string): Promise<string | null>
  accuserReception(retourId: string, lueLe: Date): Promise<boolean>
}

export interface PortProduitsCollaborateur {
  produitParCle(cle: string): Promise<ProduitConnu | null>
}

export interface PortsCollaborateur {
  readonly produits: PortProduitsCollaborateur
  readonly depot: PortDepotCollaborateur
  readonly debit: { readonly cle: PortDebit; readonly ip: PortDebit }
}

export type ResultatReleve =
  | { readonly ok: true; readonly retours: readonly ReponseCollaborateur[] }
  | { readonly ok: false; readonly motif: MotifRefusReleve; readonly message: string }

export type ResultatAccuse =
  | { readonly ok: true }
  | { readonly ok: false; readonly motif: MotifRefusAccuse; readonly message: string }


/**
 * ⚠️ Le compteur passe APRÈS la clé et l’origine, et AVANT le déchiffrement du
 *    secret du produit : c’est là que le travail commence à coûter.
 */
function debitDepasse(
  ports: PortsCollaborateur,
  cle: string,
  ip: string,
  maintenant: number,
): boolean {
  const parCle = ports.debit.cle.autoriser(cle, maintenant)
  const parIp = ports.debit.ip.autoriser(ip, maintenant)
  return !parCle || !parIp
}

/**
 * Relève les réponses destinées au collaborateur identifié.
 *
 * ⚠️ Si l’identité est absente ou invalide, rend `{ ok: true, retours: [] }` :
 *    un collaborateur anonyme ne reçoit pas d’accusé, mais le widget ne casse
 *    pas.
 */
export async function releverReponsesCollaborateur(
  entree: ReleveCollaborateurEntree,
  ports: PortsCollaborateur,
): Promise<ResultatReleve> {
  const cle = entree.cle?.trim() ?? ''
  if (cle === '') {
    return { ok: false, motif: 'cle_absente', message: 'La clé de produit est absente.' }
  }

  const produit = await ports.produits.produitParCle(cle)
  if (produit === null || !produit.actif) {
    return { ok: false, motif: 'produit_inconnu', message: 'Ce produit n’existe pas ou est inactif.' }
  }

  if (!origineAutorisee(entree.origine, produit.domaine)) {
    return { ok: false, motif: 'origine_refusee', message: 'Cette origine n’est pas autorisée pour ce produit.' }
  }

  if (debitDepasse(ports, cle, entree.ip, entree.maintenant)) {
    return { ok: false, motif: 'debit_depasse', message: 'Trop de relèves d’un coup. Réessayez dans un instant.' }
  }

  const verdict = verifierIdentite(entree.identite, produit.secret, entree.maintenant)
  if (!verdict.ok) {
    // ⛔ Échec doux : l’anonymat ne déclenche aucune erreur HTTP.
    return { ok: true, retours: [] }
  }

  const retours = await ports.depot.releverReponses(produit.id, verdict.identite.ref)
  return { ok: true, retours }
}

/**
 * Accuse réception d’une réponse pour un retour donné.
 *
 * ⛔ Vérification stricte : le retour doit exister, appartenir au produit, et
 *    son auteur_ref doit correspondre exactement au `ref` de l’identité signée.
 *
 * ⛔ Le retour d’autrui est INDISCERNABLE du retour inexistant — même motif,
 *    même message, même 404.
 */
export async function accuserReceptionCollaborateur(
  entree: AccuseCollaborateurEntree,
  ports: PortsCollaborateur,
): Promise<ResultatAccuse> {
  const cle = entree.cle?.trim() ?? ''
  if (cle === '') {
    return { ok: false, motif: 'cle_absente', message: 'La clé de produit est absente.' }
  }

  const produit = await ports.produits.produitParCle(cle)
  if (produit === null || !produit.actif) {
    return { ok: false, motif: 'produit_inconnu', message: 'Ce produit n’existe pas ou est inactif.' }
  }

  if (!origineAutorisee(entree.origine, produit.domaine)) {
    return { ok: false, motif: 'origine_refusee', message: 'Cette origine n’est pas autorisée pour ce produit.' }
  }

  if (debitDepasse(ports, cle, entree.ip, entree.maintenant)) {
    return { ok: false, motif: 'debit_depasse', message: 'Trop d’envois d’un coup. Réessayez dans un instant.' }
  }

  const verdict = verifierIdentite(entree.identite, produit.secret, entree.maintenant)
  if (!verdict.ok) {
    return { ok: false, motif: 'identite_invalide', message: 'L’identité signée est absente ou invalide.' }
  }

  const auteurRef = await ports.depot.trouverAuteurRef(entree.retourId, produit.id)
  if (auteurRef === null || auteurRef !== verdict.identite.ref) {
    return { ok: false, motif: 'retour_inconnu', message: 'Ce retour n’existe pas pour ce produit.' }
  }

  await ports.depot.accuserReception(entree.retourId, new Date(entree.maintenant))
  return { ok: true }
}

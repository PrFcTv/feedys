/**
 * L’ingestion d’un retour — le tuyau, avant tout modèle et avant tout widget.
 *
 * ⛔ L’INVARIANT DU PROJET : le retour est persisté AVANT tout appel en aval.
 *    L’entretien (P-007), la synthèse (P-008) et l’email (P-009) viennent après,
 *    et **aucune de leurs défaillances ne peut perdre la parole de quelqu’un**.
 *    Le port `aval` existe pour que ce soit visible dans la signature plutôt que
 *    dans un commentaire, et `ingestion.test.ts` le prouve en le faisant échouer.
 *
 * ⛔ Module pur : ni base, ni réseau, ni horloge, ni disque. Tout ce qui a un
 *    effet de bord entre par un port (04-Architecture/architecture.md §3).
 */
import type { CorpsRetour, Fichier } from '../../../../packages/widget/src/contrat'
import {
  BORNES,
  PREFIXE_CLE_PUBLIQUE,
  analyserCorpsRetour,
} from '../../../../packages/widget/src/contrat'

import type { AuteurAEnregistrer } from '../identite/jeton'
import { auteurDe, verifierIdentite } from '../identite/jeton'

import type { PortDebit } from './debit'
import { origineAutorisee } from './origine'

/** Ce que l’ingestion a besoin de savoir d’un produit. Rien de plus. */
export interface ProduitConnu {
  readonly id: string
  readonly domaine: string
  readonly actif: boolean
  /**
   * Le secret du produit, déchiffré par le dépôt.
   *
   * ⛔ Il ne sort JAMAIS d’ici : il ne part dans aucune réponse, aucun journal,
   *    aucune ligne de base. Il ne sert qu’à recalculer le HMAC du jeton
   *    d’identité (D-005, D-015). `null` quand le produit n’en a pas de forme
   *    utilisable — l’identité ne sera alors jamais vérifiée, et les retours
   *    arriveront quand même.
   */
  readonly secret: string | null
}

/** Le retour, prêt à écrire. Les trois lignes partent ensemble ou pas du tout. */
export interface RetourAEnregistrer {
  readonly produitId: string
  readonly source: 'voix' | 'texte'
  /** ⚠️ Toujours défini. Sans jeton valide, c’est `AUTEUR_INCONNU` (P-012). */
  readonly auteur: AuteurAEnregistrer
  readonly message: {
    readonly texte: string
    readonly transcriptBrut: string | null
    readonly audioChemin: string | null
  }
  readonly contexte: {
    readonly url: string
    readonly titrePage: string | null
    readonly ecran: string | null
    readonly selecteurDom: string | null
    readonly navigateur: string | null
    readonly systeme: string | null
    readonly viewportL: number | null
    readonly viewportH: number | null
    readonly captureChemin: string | null
    readonly fuseau: string | null
    readonly agentBrut: Record<string, unknown> | null
  }
}

export interface PortDepotRetours {
  /** `null` si la clé n’ouvre rien. ⛔ Jamais de recherche par autre chose. */
  produitParCle(cle: string): Promise<ProduitConnu | null>
  /** Écrit retour + message + contexte en UNE transaction, et rend l’id du retour. */
  enregistrer(retour: RetourAEnregistrer): Promise<string>
}

export interface PortStockage {
  /** Rend le chemin sous lequel le fichier a été rangé. */
  ecrire(genre: 'audio' | 'capture', fichier: Fichier): Promise<string>
}

export interface PortsIngestion {
  readonly depot: PortDepotRetours
  readonly stockage: PortStockage
  readonly debitParCle: PortDebit
  readonly debitParIp: PortDebit
  readonly maintenant: () => number
  /**
   * ⛔ CE QUI VIENT APRÈS LA PERSISTANCE, et rien d’autre. L’entretien s’y
   *    branchera en P-007. Son échec est avalé : il ne doit jamais faire échouer
   *    une ingestion réussie.
   */
  readonly aval?: (retourId: string) => Promise<void>
  /** Ce qu’on n’a pas pu faire, sans faire échouer le reste. ⛔ Jamais le corps du retour. */
  readonly signaler?: (quoi: string, erreur: unknown) => void
}

export interface EntreeIngestion {
  readonly cle: string | null
  /**
   * Le jeton d’identité signé par le serveur de l’hôte — l’en-tête
   * `x-feedys-identite`, tel qu’il est arrivé.
   *
   * ⛔ Absent, invalide, expiré ou forgé : le retour est ACCEPTÉ quand même,
   *    marqué `identite_verifiee = false`. On ne perd jamais une parole pour un
   *    problème d’identité (P-012).
   */
  readonly identite: string | null
  readonly origine: string | null
  readonly ip: string
  readonly octets: number
  readonly corpsBrut: string
}

/**
 * Les motifs de refus.
 *
 * ⚠️ `produit_inconnu` couvre volontairement DEUX cas — clé inexistante et
 *    produit désactivé. Les distinguer dans la réponse dirait à un curieux
 *    qu’une clé trouvée dans un HTML existe encore.
 */
export type MotifRefus =
  | 'cle_absente'
  | 'produit_inconnu'
  | 'origine_refusee'
  | 'corps_trop_gros'
  | 'corps_invalide'
  | 'debit_depasse'
  | 'stockage_indisponible'

export type ResultatIngestion =
  | { readonly ok: true; readonly retour: string }
  | { readonly ok: false; readonly motif: MotifRefus; readonly message: string }

/** Le corps dépasse-t-il la borne ? Sert aussi au refus anticipé sur `Content-Length`. */
export function corpsTropGros(octets: number): boolean {
  return octets > BORNES.corpsOctets
}

function refus(motif: MotifRefus, message: string): ResultatIngestion {
  return { ok: false, motif, message }
}

function ouNul(valeur: string | undefined): string | null {
  return valeur === undefined || valeur.trim() === '' ? null : valeur
}

export async function ingerer(
  entree: EntreeIngestion,
  ports: PortsIngestion,
): Promise<ResultatIngestion> {
  if (corpsTropGros(entree.octets)) {
    return refus('corps_trop_gros', 'Ce retour est trop lourd pour être envoyé.')
  }

  const cle = entree.cle?.trim() ?? ''
  if (cle === '' || !cle.startsWith(PREFIXE_CLE_PUBLIQUE)) {
    return refus('cle_absente', 'Clé de produit absente ou mal formée.')
  }

  // ⚠️ Avant la base, et pas après : c’est elle qu’on protège.
  const maintenant = ports.maintenant()
  const sousLaLimite =
    ports.debitParCle.autoriser(cle, maintenant) && ports.debitParIp.autoriser(entree.ip, maintenant)

  if (!sousLaLimite) {
    return refus('debit_depasse', 'Trop de retours d’un coup. Réessayez dans un instant.')
  }

  const analyse = analyserCorps(entree.corpsBrut)
  if (!analyse.ok) return refus('corps_invalide', analyse.message)
  const corps = analyse.valeur

  const produit = await ports.depot.produitParCle(cle)
  if (produit === null || !produit.actif) {
    return refus('produit_inconnu', 'Produit inconnu.')
  }

  if (!origineAutorisee(entree.origine, produit.domaine)) {
    return refus('origine_refusee', 'Cette origine n’est pas celle du produit.')
  }

  // ⛔ Aucun `refus` ne suit. Le verdict d’identité décore le retour, il ne
  //    l’arbitre pas : c’est la règle entière de P-012.
  const verdict = verifierIdentite(entree.identite, produit.secret, maintenant)
  if (!verdict.ok && verdict.motif !== 'absente') {
    ports.signaler?.(`identité non retenue — ${verdict.motif}`, new Error(verdict.motif))
  }

  // ⛔ L’audio EST la parole quand il n’y a pas de transcript. Un stockage muet
  //    la perdrait sans que personne ne le sache : on refuse bruyamment, et le
  //    widget peut réessayer.
  let audioChemin: string | null = null
  if (corps.audio) {
    try {
      audioChemin = await ports.stockage.ecrire('audio', corps.audio)
    } catch (erreur) {
      ports.signaler?.('stockage de l’audio', erreur)
      return refus(
        'stockage_indisponible',
        'Impossible de ranger l’audio. Réessayez dans un instant.',
      )
    }
  }

  // ⚠️ La capture, elle, est un confort. En échec-doux : un retour sans image
  //    vaut infiniment mieux qu’un retour perdu.
  let captureChemin: string | null = null
  if (corps.contexte.capture) {
    try {
      captureChemin = await ports.stockage.ecrire('capture', corps.contexte.capture)
    } catch (erreur) {
      ports.signaler?.('stockage de la capture', erreur)
    }
  }

  const retour = await ports.depot.enregistrer(
    composer(corps, produit.id, auteurDe(verdict), audioChemin, captureChemin),
  )

  // ⛔ APRÈS. Toujours après, et sans pouvoir défaire ce qui précède.
  if (ports.aval) {
    try {
      await ports.aval(retour)
    } catch (erreur) {
      ports.signaler?.('traitement en aval du retour', erreur)
    }
  }

  return { ok: true, retour }
}

function analyserCorps(brut: string): ReturnType<typeof analyserCorpsRetour> {
  let json: unknown
  try {
    json = JSON.parse(brut)
  } catch {
    return { ok: false, message: 'Le corps n’est pas du JSON.' }
  }
  return analyserCorpsRetour(json)
}

/**
 * La source : `voix` dès qu’il y a de l’audio, sinon ce que le widget déclare.
 *
 * ⚠️ Un transcript Web Speech est de la voix SANS fichier audio — le serveur ne
 *    peut pas le deviner, d’où la déclaration. Et c’est loin d’être décoratif :
 *    c’est la mesure du pari du produit (conventions-db.md §retours).
 */
function composer(
  corps: CorpsRetour,
  produitId: string,
  auteur: AuteurAEnregistrer,
  audioChemin: string | null,
  captureChemin: string | null,
): RetourAEnregistrer {
  const { contexte } = corps

  return {
    produitId,
    source: corps.audio ? 'voix' : (corps.source ?? 'texte'),
    auteur,
    message: {
      // ⚠️ Vide et non nul quand seul l’audio est arrivé : la transcription
      //    serveur viendra remplir la ligne, elle ne la créera pas.
      texte: corps.texte?.trim() ?? '',
      transcriptBrut: ouNul(corps.transcriptBrut),
      audioChemin,
    },
    contexte: {
      url: contexte.url,
      titrePage: ouNul(contexte.titrePage),
      ecran: ouNul(contexte.ecran),
      selecteurDom: ouNul(contexte.selecteurDom),
      navigateur: ouNul(contexte.navigateur),
      systeme: ouNul(contexte.systeme),
      viewportL: contexte.viewportL ?? null,
      viewportH: contexte.viewportH ?? null,
      captureChemin,
      fuseau: ouNul(contexte.fuseau),
      agentBrut: contexte.agentBrut ?? null,
    },
  }
}

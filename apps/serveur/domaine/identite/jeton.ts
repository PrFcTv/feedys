/**
 * L’identité signée — vérifier, jamais exiger.
 *
 * ⛔ L’INVARIANT DE CE MODULE : aucun verdict ne fait échouer une ingestion. Un
 *    jeton absent, expiré, forgé ou illisible donne `identite_verifiee = false`
 *    et un retour parfaitement accepté. On ne perd jamais une parole pour un
 *    problème d’identité (P-012, D-005).
 *
 * Le format, en une ligne :
 *
 *     <charge base64url>.<HMAC-SHA256(secret, charge base64url) base64url>
 *
 * ⚠️ Ce n’est délibérément PAS un JWT. Un JWT porte son algorithme dans sa
 *    propre en-tête, et toute la famille de failles « alg: none » / « HS256 vu
 *    comme RS256 » vient de là : le vérificateur lit dans le jeton comment le
 *    vérifier. Ici il n’y a rien à lire — un seul algorithme, écrit dans le
 *    code des deux côtés. Le coût pour l’hôte est de huit lignes de
 *    `node:crypto` (README §Attacher une identité), et il n’a aucune
 *    dépendance à installer.
 *
 * ⛔ Module pur : ni base, ni réseau, ni horloge, ni disque. L’heure entre par
 *    paramètre (04-Architecture/architecture.md §3).
 */
import { createHmac, timingSafeEqual } from 'node:crypto'

import type { Identite } from '../../../../packages/widget/src/contrat'
import { BORNES, analyserIdentite } from '../../../../packages/widget/src/contrat'

/**
 * Pourquoi une identité n’a pas été retenue.
 *
 * ⚠️ Ces motifs sont journalisables et **ne sortent jamais dans la réponse** :
 *    dire à qui poste que sa signature est fausse plutôt qu’expirée l’aide à
 *    forger. Le widget, lui, n’a rien à en faire — le retour est accepté.
 */
export type MotifIdentite =
  | 'absente'
  | 'produit_sans_secret'
  | 'jeton_trop_long'
  | 'jeton_malforme'
  | 'signature_invalide'
  | 'charge_invalide'
  | 'expiree'

export type Verdict =
  | { readonly ok: true; readonly identite: Identite }
  | { readonly ok: false; readonly motif: MotifIdentite }

/** Ce qui finit sur la ligne `retours`. ⚠️ Toujours défini, même sans jeton. */
export interface AuteurAEnregistrer {
  readonly ref: string | null
  readonly nom: string | null
  readonly role: string | null
  readonly verifiee: boolean
}

/** L’auteur inconnu — le cas le plus courant, et parfaitement normal. */
export const AUTEUR_INCONNU: AuteurAEnregistrer = {
  ref: null,
  nom: null,
  role: null,
  verifiee: false,
}

const SEPARATEUR = '.'

/**
 * Signe une charge. C’est l’implémentation de référence de ce que le serveur de
 * l’hôte fait chez lui — elle sert aux tests, et le README la reproduit à la
 * main pour montrer qu’elle ne demande rien de plus que `node:crypto`.
 *
 * ⛔ Elle ne tourne JAMAIS dans une requête d’ingestion : Feedys vérifie, il ne
 *    signe pas à la place de l’hôte.
 */
export function signerIdentite(charge: Identite, secret: string): string {
  const corps = enBase64url(JSON.stringify(charge))
  return `${corps}${SEPARATEUR}${empreinte(corps, secret)}`
}

/**
 * Vérifie un jeton, et rend ce qu’il porte.
 *
 * @param jeton     l’en-tête `x-feedys-identite`, tel qu’il est arrivé
 * @param secret    le secret du produit. `null` quand le produit n’en a pas de
 *                  forme utilisable — voir `infra/secret.ts`
 * @param maintenant l’heure, en millisecondes
 */
export function verifierIdentite(
  jeton: string | null | undefined,
  secret: string | null,
  maintenant: number,
): Verdict {
  const brut = jeton?.trim() ?? ''
  if (brut === '') return { ok: false, motif: 'absente' }
  if (brut.length > BORNES.jeton) return { ok: false, motif: 'jeton_trop_long' }
  if (secret === null || secret === '') return { ok: false, motif: 'produit_sans_secret' }

  const separation = brut.indexOf(SEPARATEUR)
  if (separation <= 0 || separation === brut.length - 1) {
    return { ok: false, motif: 'jeton_malforme' }
  }

  const corps = brut.slice(0, separation)
  const signature = brut.slice(separation + 1)

  // ⛔ La signature D’ABORD. Analyser la charge avant de l’avoir prouvée, c’est
  //    faire confiance à ce que n’importe qui a écrit dans un en-tête.
  if (!signatureConforme(signature, empreinte(corps, secret))) {
    return { ok: false, motif: 'signature_invalide' }
  }

  const analyse = analyserIdentite(depuisBase64url(corps))
  if (!analyse.ok) return { ok: false, motif: 'charge_invalide' }

  // ⚠️ `exp` est en secondes — la convention de tout le monde, et celle que le
  //    serveur de l’hôte écrira sans y penser.
  if (analyse.valeur.exp * 1_000 <= maintenant) {
    return { ok: false, motif: 'expiree' }
  }

  return { ok: true, identite: analyse.valeur }
}

/**
 * Le verdict, mis en forme pour la ligne `retours`.
 *
 * ⚠️ Un verdict négatif n’écrit RIEN, pas même le `ref` qu’un jeton forgé
 *    prétendait porter : une identité non vérifiée n’est pas une identité
 *    dégradée, c’est une absence d’identité.
 */
export function auteurDe(verdict: Verdict): AuteurAEnregistrer {
  if (!verdict.ok) return AUTEUR_INCONNU

  const { ref, nom, role } = verdict.identite

  return {
    ref,
    nom: nom?.trim() || null,
    role: role?.trim() || null,
    verifiee: true,
  }
}

function empreinte(corps: string, secret: string): string {
  return createHmac('sha256', secret).update(corps).digest('base64url')
}

/**
 * ⚠️ Comparaison à temps constant. Un `===` sur deux empreintes sort au premier
 *    octet qui diffère, et le temps de sortie dit combien d’octets étaient bons.
 *    `timingSafeEqual` exige des longueurs égales, d’où le garde : une longueur
 *    différente n’apprend rien qu’on ne sache déjà.
 */
function signatureConforme(recue: string, attendue: string): boolean {
  const a = Buffer.from(recue, 'utf8')
  const b = Buffer.from(attendue, 'utf8')
  return a.length === b.length && timingSafeEqual(a, b)
}

function enBase64url(valeur: string): string {
  return Buffer.from(valeur, 'utf8').toString('base64url')
}

/** ⚠️ Rend `undefined` sur du base64url illisible ou du JSON invalide. */
function depuisBase64url(valeur: string): unknown {
  try {
    return JSON.parse(Buffer.from(valeur, 'base64url').toString('utf8'))
  } catch {
    return undefined
  }
}

/**
 * Le secret d’un produit, haché.
 *
 * ⛔ Le secret en clair n’est JAMAIS stocké (conventions-db.md §produits). Il est
 *    imprimé une fois par `pnpm produit:creer`, et il n’existe plus nulle part
 *    ensuite que du côté du serveur de l’hôte.
 *
 * ⚠️ Deux formes coexistent, et ce n’est pas une redondance :
 *
 *    - `secret_hash` — argon2id. Une PREUVE : elle dit « c’est bien ce
 *      secret-là » et ne s’inverse pas.
 *    - `secret_chiffre` — AES-256-GCM. Une CLÉ : Feedys en a besoin pour
 *      recalculer le HMAC que l’hôte a produit. Un HMAC se vérifie avec la clé
 *      qui l’a signé, pas avec son empreinte (D-015).
 *
 *    La clé de chiffrement vit dans l’environnement, jamais en base : un dump
 *    volé ne permet pas de forger l’identité de qui que ce soit.
 *
 * ⚠️ `hash-wasm` et non `argon2` : argon2id en WebAssembly, sans compilation
 *    native. Le conteneur est une image Alpine (P-013) et une extension native
 *    y demanderait une chaîne de compilation complète pour trois appels par an.
 *    MIT — 04-Architecture/dependances.md.
 */
import { createDecipheriv, createCipheriv, randomBytes } from 'node:crypto'

import { argon2Verify, argon2id } from 'hash-wasm'

/**
 * Les paramètres d’OWASP pour argon2id (19 Mio, 2 passes, 1 fil).
 *
 * ⚠️ Ils sont ÉCRITS DANS L’EMPREINTE produite — `$argon2id$v=19$m=…,t=…,p=…` —
 *    donc les durcir plus tard ne casse pas les secrets déjà hachés : la
 *    vérification relit les paramètres de chaque empreinte.
 */
const PARAMETRES = {
  parallelism: 1,
  iterations: 2,
  memorySize: 19_456,
  hashLength: 32,
} as const

export async function hacherSecret(secret: string): Promise<string> {
  return argon2id({
    password: secret,
    salt: randomBytes(16),
    outputType: 'encoded',
    ...PARAMETRES,
  })
}

/**
 * ⚠️ Rend `false` plutôt que de lever, y compris sur une empreinte illisible :
 *    un secret_hash corrompu doit refuser, pas faire tomber la route.
 */
export async function secretValide(secret: string, empreinte: string): Promise<boolean> {
  try {
    return await argon2Verify({ password: secret, hash: empreinte })
  } catch {
    return false
  }
}


/**
 * ─── LE SECRET, CHIFFRÉ ─────────────────────────────────────────────────────
 */

/** `v1.<iv>.<étiquette>.<chiffré>`, tout en base64url. */
const VERSION = 'v1'
const OCTETS_IV = 12
const OCTETS_CLE = 32

/**
 * La clé de chiffrement, lue dans l’environnement.
 *
 * ⚠️ Elle rend `null` quand la variable est absente, plutôt que de lever : sans
 *    elle, l’identité signée ne fonctionne simplement pas, et un retour arrive
 *    en `identite_verifiee = false`. ⛔ Ce qu’elle ne fait jamais, c’est faire
 *    échouer une ingestion (P-012).
 *
 * ⛔ Elle rend `null` aussi sur une clé de mauvaise taille. AES-256 veut 32
 *    octets ; une clé de dix caractères tapée à la main donnerait une fausse
 *    impression de chiffrement.
 */
export function cleDeChiffrement(): Buffer | null {
  const brute = process.env['FEEDYS_CLE_CHIFFREMENT']?.trim()
  if (!brute) return null

  const clef = Buffer.from(brute, 'base64url')
  return clef.length === OCTETS_CLE ? clef : null
}

/** Une clé toute neuve, à coller dans FEEDYS_CLE_CHIFFREMENT. */
export function nouvelleCleDeChiffrement(): string {
  return randomBytes(OCTETS_CLE).toString('base64url')
}

export function chiffrer(valeur: string, clef: Buffer): string {
  const iv = randomBytes(OCTETS_IV)
  const chiffreur = createCipheriv('aes-256-gcm', clef, iv)
  const chiffre = Buffer.concat([chiffreur.update(valeur, 'utf8'), chiffreur.final()])

  return [
    VERSION,
    iv.toString('base64url'),
    chiffreur.getAuthTag().toString('base64url'),
    chiffre.toString('base64url'),
  ].join('.')
}

/**
 * ⚠️ Rend `null` sur tout ce qui ne se déchiffre pas — format inconnu, étiquette
 *    qui ne colle pas, clé changée. Un secret illisible doit refuser de vérifier
 *    une identité, pas faire tomber une route.
 */
export function dechiffrer(enveloppe: string | null, clef: Buffer | null): string | null {
  if (enveloppe === null || clef === null) return null

  const morceaux = enveloppe.split('.')
  const [version, iv, etiquette, chiffre] = morceaux

  if (morceaux.length !== 4 || version !== VERSION || !iv || !etiquette || !chiffre) return null

  try {
    const dechiffreur = createDecipheriv('aes-256-gcm', clef, Buffer.from(iv, 'base64url'))
    dechiffreur.setAuthTag(Buffer.from(etiquette, 'base64url'))

    return Buffer.concat([
      dechiffreur.update(Buffer.from(chiffre, 'base64url')),
      dechiffreur.final(),
    ]).toString('utf8')
  } catch {
    return null
  }
}

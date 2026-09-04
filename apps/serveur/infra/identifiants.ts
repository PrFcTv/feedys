/**
 * Les identifiants — ceux des lignes, et ceux d’un produit.
 *
 * ⚠️ Infra et non domaine : ils tirent de l’aléa, ce qui est un effet de bord.
 *    Le domaine ne fabrique jamais d’id ; c’est le dépôt qui les pose et les rend.
 */
import { randomBytes } from 'node:crypto'

import { createId } from '@paralleldrive/cuid2'

/** L’identifiant de toute ligne. Socle de chaque table (conventions-db.md). */
export function identifiant(): string {
  return createId()
}

/**
 * ⚠️ base64url et non hexadécimal : à entropie égale, c’est un tiers de
 *    caractères en moins dans une balise `<script>` qu’un humain recopie.
 */
function alea(octets: number): string {
  return randomBytes(octets).toString('base64url')
}

/**
 * La clé publique d’un produit — `fdy_pub_…`.
 *
 * ⚠️ Publique par nature : elle est dans le HTML de l’hôte, et le modèle de
 *    menace l’assume (architecture.md §Sécurité). Elle est quand même tirée au
 *    hasard : deviner une clé permettrait de poster du bruit chez quelqu’un.
 */
export function clePublique(): string {
  return `fdy_pub_${alea(18)}`
}

/**
 * Le secret d’un produit — `fdy_sec_…`.
 *
 * ⛔ Il ne traverse jamais le navigateur : il vit sur le serveur de l’hôte, qui
 *    s’en sert pour signer l’identité du collaborateur (D-005, P-012).
 */
export function secretProduit(): string {
  return `fdy_sec_${alea(32)}`
}

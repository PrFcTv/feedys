/**
 * Le secret d’un produit, haché.
 *
 * ⛔ Le secret en clair n’est JAMAIS stocké (conventions-db.md §produits). Il est
 *    imprimé une fois par `pnpm produit:creer`, et il n’existe plus nulle part
 *    ensuite que du côté du serveur de l’hôte.
 *
 * ⚠️ `hash-wasm` et non `argon2` : argon2id en WebAssembly, sans compilation
 *    native. Le conteneur est une image Alpine (P-013) et une extension native
 *    y demanderait une chaîne de compilation complète pour trois appels par an.
 *    MIT — 04-Architecture/dependances.md.
 */
import { randomBytes } from 'node:crypto'

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

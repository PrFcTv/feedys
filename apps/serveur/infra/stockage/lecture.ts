/**
 * La relecture d’une pièce jointe rangée par `fichiers.ts`.
 *
 * ⛔ LE CHEMIN NE VIENT JAMAIS DU CLIENT. Il est lu en base, et il est quand même
 *    revérifié ici : après résolution, il doit rester SOUS la racine de stockage.
 *    Une ligne de base corrompue ne doit pas pouvoir faire lire `/etc/passwd`.
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { racineStockage } from './fichiers'

const TYPES: Readonly<Record<string, string>> = {
  webp: 'image/webp',
  png: 'image/png',
  jpg: 'image/jpeg',
  webm: 'audio/webm',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
}

export interface PieceJointe {
  readonly octets: Buffer
  readonly type: string
}

export async function lirePieceJointe(
  relatif: string,
  racine = racineStockage(),
): Promise<PieceJointe | undefined> {
  const base = path.resolve(racine)
  const cible = path.resolve(base, relatif)

  // ⛔ Le garde-fou : hors de la racine, on ne lit rien.
  if (cible !== base && !cible.startsWith(base + path.sep)) return undefined

  const extension = path.extname(cible).slice(1).toLowerCase()
  const type = TYPES[extension]
  if (type === undefined) return undefined

  try {
    return { octets: await readFile(/*turbopackIgnore: true*/ cible), type }
  } catch {
    return undefined
  }
}

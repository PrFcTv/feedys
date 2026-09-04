/**
 * Le stockage des pièces jointes — l’audio et la capture.
 *
 * Un volume monté, pas un service : `FEEDYS_STOCKAGE` (04-Architecture/hebergement.md).
 * La base ne porte que le chemin ; les octets vivent sur le disque.
 *
 * ⛔ Le nom de fichier est un identifiant tiré au hasard. Jamais le titre de la
 *    page, jamais l’écran, jamais le nom de quelqu’un : le dossier est monté, et
 *    un nom de fichier se lit sans ouvrir le fichier.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type { Fichier } from '../../../../packages/widget/src/contrat'
import type { PortStockage } from '../../domaine/retours/ingestion'
import { identifiant } from '../identifiants'

/** ⛔ Liste close, alignée sur les types acceptés par le contrat. */
const EXTENSIONS: Readonly<Record<string, string>> = {
  'image/webp': 'webp',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
}

export const RACINE_PAR_DEFAUT = './.stockage'

export function racineStockage(): string {
  return process.env['FEEDYS_STOCKAGE'] ?? RACINE_PAR_DEFAUT
}

/**
 * ⚠️ Rangé par année et par mois. Un dossier plat finit par contenir des dizaines
 *    de milliers d’entrées, et le jour où il faut en purger une tranche, on ne
 *    veut pas avoir à lire la base pour savoir laquelle.
 */
function dossierDuJour(genre: string, quand: Date): string {
  const mois = String(quand.getUTCMonth() + 1).padStart(2, '0')
  return path.posix.join(genre, String(quand.getUTCFullYear()), mois)
}

export function creerStockageFichiers(racine = racineStockage()): PortStockage {
  return {
    async ecrire(genre: 'audio' | 'capture', fichier: Fichier): Promise<string> {
      const octets = Buffer.from(fichier.donnees, 'base64')

      if (octets.byteLength === 0) {
        throw new Error(`Le ${genre} est vide une fois décodé.`)
      }

      const extension = EXTENSIONS[fichier.type]
      if (extension === undefined) {
        throw new Error(`Type non stocké : ${fichier.type}.`)
      }

      const dossier = dossierDuJour(genre, new Date())
      const relatif = path.posix.join(dossier, `${identifiant()}.${extension}`)

      await mkdir(path.join(racine, dossier), { recursive: true })
      await writeFile(path.join(racine, relatif), octets)

      // ⚠️ Relatif à la racine, et en séparateurs POSIX : le chemin est écrit en
      //    base sur un poste Windows et relu dans un conteneur Linux.
      return relatif
    },
  }
}

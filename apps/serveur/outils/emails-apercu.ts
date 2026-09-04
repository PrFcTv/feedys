/**
 * `pnpm emails:apercu`
 *
 * Rend la note telle qu’elle partirait, dans un fichier local.
 *
 * ⛔ IL N’ENVOIE RIEN, ET NE LIT AUCUN SECRET. Ni `SMTP_URL`, ni `.env.local` :
 *    on doit pouvoir relire la mise en forme d’un email sur un poste qui n’a
 *    aucune configuration de messagerie, et sans risquer d’écrire à quelqu’un.
 *
 * ⚠️ Le sujet est une note FIGÉE et INVENTÉE (domaine/notification/exemple.ts) —
 *    le dépôt est public, et un vrai retour dicté contient des noms de personnes.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { EXEMPLE_NOTIFICATION } from '../domaine/notification/exemple'
import { composerMessage } from '../domaine/notification/message'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')

/** ⚠️ Ignoré par git : c’est un rendu, pas une source. */
const DOSSIER = path.join(RACINE, '.apercu-emails')

const message = composerMessage(EXEMPLE_NOTIFICATION)

const rendu = [
  `Sujet : ${message.sujet}`,
  `De    : feedys@exemple.fr`,
  `À     : developpeur@exemple.fr`,
  '',
  '─'.repeat(72),
  '',
  message.corps,
].join('\n')

mkdirSync(DOSSIER, { recursive: true })

const fichier = path.join(DOSSIER, 'note.txt')
writeFileSync(fichier, rendu, 'utf8')

console.log(`\n${rendu}`)
console.log('─'.repeat(72))
console.log(`\nÉcrit dans ${path.relative(RACINE, fichier)} — rien n’a été envoyé.\n`)

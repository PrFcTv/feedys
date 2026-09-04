/**
 * La lecture du prompt système, depuis le disque.
 *
 * ⚠️ POURQUOI UN FICHIER `.md` ET PAS UNE CHAÎNE DANS UN MODULE. Le prompt est
 *    la pièce qu’on met au point le plus souvent — `pnpm entretien:rejouer` sert
 *    à ça et à rien d’autre. Un `.md` se relit, se compare et se commente comme
 *    un document ; une chaîne de gabarit noyée dans du TypeScript se relit mal
 *    et finit par ne plus être relue. 01-Specs/entretien.md le désigne
 *    nommément : `apps/serveur/domaine/entretien/prompts/systeme.md`.
 *
 * ⚠️ Et pourquoi ce détour par `infra/` : `domaine/` ne connaît ni la base, ni le
 *    réseau, ni le disque (04-Architecture/architecture.md §3). Le gabarit est
 *    donc LU ici et PASSÉ à `modeleClaude`, ce qui rend l’assemblage du prompt
 *    testable sans toucher un fichier.
 *
 * ⚠️ `FEEDYS_PROMPTS` désigne un dossier contenant `systeme.md`. C’est ce que
 *    posera le conteneur (P-013), où il n’y a ni `apps/`, ni `packages/`.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { racineDepot } from './racine'

const NOM = 'systeme.md'
const RELATIF = path.join('apps', 'serveur', 'domaine', 'entretien', 'prompts', NOM)

/** ⚠️ Lu une fois. Un prompt qui change demande un redémarrage, comme le code. */
let gabarit: string | undefined

export function lireGabaritSysteme(): string {
  gabarit ??= readFileSync(/*turbopackIgnore: true*/ cheminSysteme(), 'utf8')
  return gabarit
}

export function cheminSysteme(): string {
  const dossier = process.env['FEEDYS_PROMPTS']?.trim()
  if (dossier) return path.join(/*turbopackIgnore: true*/ dossier, NOM)

  const racine = racineDepot()
  if (racine === undefined) {
    throw new Error(
      'Le prompt système est introuvable : ni FEEDYS_PROMPTS, ni racine de dépôt. ' +
        'En conteneur, FEEDYS_PROMPTS doit désigner le dossier qui contient systeme.md.',
    )
  }

  return path.join(/*turbopackIgnore: true*/ racine, RELATIF)
}

/** Oublie le gabarit lu. ⚠️ Pour les tests uniquement. */
export function oublierGabarit(): void {
  gabarit = undefined
}

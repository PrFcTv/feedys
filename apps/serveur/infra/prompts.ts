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

/**
 * ⚠️ Les deux prompts vivent chacun à côté de son appel — l’entretien dans
 *    `domaine/entretien/`, la synthèse dans `domaine/synthese/`. En conteneur,
 *    `FEEDYS_PROMPTS` désigne UN dossier qui contient les deux fichiers : la
 *    hiérarchie du dépôt n’y existe pas.
 */
const FICHIERS = {
  entretien: {
    nom: 'systeme.md',
    relatif: path.join('apps', 'serveur', 'domaine', 'entretien', 'prompts', 'systeme.md'),
  },
  synthese: {
    nom: 'synthese.md',
    relatif: path.join('apps', 'serveur', 'domaine', 'synthese', 'prompts', 'synthese.md'),
  },
} as const

export type NomPrompt = keyof typeof FICHIERS

/** ⚠️ Lus une fois. Un prompt qui change demande un redémarrage, comme le code. */
const gabarits = new Map<NomPrompt, string>()

function lire(nom: NomPrompt): string {
  const connu = gabarits.get(nom)
  if (connu !== undefined) return connu

  const gabarit = readFileSync(/*turbopackIgnore: true*/ cheminPrompt(nom), 'utf8')
  gabarits.set(nom, gabarit)
  return gabarit
}

export function lireGabaritSysteme(): string {
  return lire('entretien')
}

export function lireGabaritSynthese(): string {
  return lire('synthese')
}

export function cheminPrompt(nom: NomPrompt): string {
  const { nom: fichier, relatif } = FICHIERS[nom]

  const dossier = process.env['FEEDYS_PROMPTS']?.trim()
  if (dossier) return path.join(/*turbopackIgnore: true*/ dossier, fichier)

  const racine = racineDepot()
  if (racine === undefined) {
    throw new Error(
      `Le prompt « ${fichier} » est introuvable : ni FEEDYS_PROMPTS, ni racine de dépôt. ` +
        'En conteneur, FEEDYS_PROMPTS doit désigner le dossier qui les contient.',
    )
  }

  return path.join(/*turbopackIgnore: true*/ racine, relatif)
}

/** Oublie les gabarits lus. ⚠️ Pour les tests uniquement. */
export function oublierGabarit(): void {
  gabarits.clear()
}

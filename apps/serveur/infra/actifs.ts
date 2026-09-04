/**
 * Où sont, sur le disque, les deux fichiers que Feedys sert aux pages d’autrui.
 *
 * ⛔ `widget.js` n’est pas un paquet npm que l’hôte empaquette : c’est un
 *    fichier que NOUS servons, et c’est la frontière de licence qui l’exige
 *    (04-Architecture/licences.md).
 *
 * ⛔ `snapdom.js` non plus n’est pas dans le bundle du widget : 53 Ko gzip
 *    contre 60 Ko de budget total. Il est servi ici et chargé à la demande, à
 *    l’ouverture du panneau — et depuis l’origine FEEDYS, jamais depuis un CDN :
 *    imposer un tiers au logiciel de quelqu’un d’autre n’est pas à nous de le
 *    décider ([D-011] dans 00-Projet/DECISIONS_LOG.md).
 *
 * ⚠️ Les marqueurs `turbopackIgnore` ci-dessous ne sont pas du bruit : Turbopack
 *    essaie de résoudre les chemins de fichiers à la CONSTRUCTION, et avertit
 *    sur chacun de ceux qu’il ne peut pas prédire. Ici c’est voulu :
 *    l’emplacement du bundle dépend de `FEEDYS_ACTIFS` et du dossier de
 *    travail, tous deux connus au démarrage seulement. Le marqueur est
 *    l’échappatoire documentée, et il vaut mieux que quatre avertissements
 *    qu’on finit par apprendre à ignorer.
 */
import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

import { empreinte } from '../domaine/actifs/entetes'

import { racineDepot } from './racine'

export type NomActif = 'widget.js' | 'snapdom.js'

export interface Actif {
  readonly contenu: Buffer
  readonly etag: string
}

/**
 * ⚠️ Les chemins sont relatifs à la racine du dépôt, sauf `FEEDYS_ACTIFS`, qui
 *    désigne un dossier unique contenant les deux fichiers. C’est ce que pose le
 *    conteneur (P-013), où il n’y a ni `packages/`, ni `node_modules/`.
 */
const CANDIDATS: Readonly<Record<NomActif, readonly string[]>> = {
  'widget.js': ['packages/widget/dist/widget.js'],
  'snapdom.js': [
    'apps/serveur/node_modules/@zumer/snapdom/dist/snapdom.js',
    'node_modules/@zumer/snapdom/dist/snapdom.js',
  ],
}

/** Ce qu’on a déjà lu, et sous quelle version. */
const memoire = new Map<NomActif, { readonly cle: string; readonly actif: Actif }>()

/**
 * Rend le fichier, ou `undefined` s’il est absent.
 *
 * ⚠️ Absent n’est pas une exception : en développement, `widget.js` n’existe pas
 *    tant qu’on n’a pas construit. La route répond alors 503 avec une phrase qui
 *    dit quoi faire, plutôt qu’une trace de pile.
 */
export async function lireActif(nom: NomActif): Promise<Actif | undefined> {
  const chemin = cheminDe(nom)
  if (chemin === undefined) return undefined

  let cle: string
  try {
    const etat = await stat(/*turbopackIgnore: true*/ chemin)
    cle = `${etat.mtimeMs}:${etat.size}`
  } catch {
    return undefined
  }

  const connu = memoire.get(nom)
  if (connu?.cle === cle) return connu.actif

  const contenu = await readFile(/*turbopackIgnore: true*/ chemin)
  const actif: Actif = {
    contenu,
    etag: empreinte(createHash('sha256').update(contenu).digest('hex').slice(0, 16)),
  }

  memoire.set(nom, { cle, actif })
  return actif
}

function cheminDe(nom: NomActif): string | undefined {
  const dossier = process.env.FEEDYS_ACTIFS?.trim()
  if (dossier) {
    const direct = path.join(/*turbopackIgnore: true*/ dossier, nom)
    return existsSync(/*turbopackIgnore: true*/ direct) ? direct : undefined
  }

  const racine = racineDepot()
  if (racine === undefined) return undefined

  for (const relatif of CANDIDATS[nom]) {
    const complet = path.join(/*turbopackIgnore: true*/ racine, relatif)
    if (existsSync(/*turbopackIgnore: true*/ complet)) return complet
  }

  return undefined
}

/** Vide le cache mémoire. ⚠️ Pour les tests uniquement. */
export function oublierActifs(): void {
  memoire.clear()
}

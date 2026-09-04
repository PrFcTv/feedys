/**
 * ⛔ Le garde-fou de « aucun HEX en dur dans un composant »
 *    (04-Architecture/DESIGN.md §Ce qui vaut pour les deux).
 *
 * Une couleur écrite en clair dans un composant ne se voit pas : elle est juste
 * un peu fausse chez un hôte, un peu illisible en sombre, et personne ne relie
 * jamais les deux. Le widget s’injecte dans quatre logiciels aux chartes
 * différentes — c’est exactement le genre de dette qu’on ne rembourse pas.
 *
 * ⚠️ `tokens.ts` a évidemment le droit : c’est sa raison d’être.
 */
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { FEUILLE } from './styles'

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const HORS_BUNDLE = /\.test\.tsx?$/
const AUTORISE = path.join(SRC, 'ui', 'tokens.ts')

/** `#a1b2c3`, `#fff`, `#a1b2c3ff` — et rien d’autre. */
const HEX = /#[0-9a-fA-F]{3,8}\b/g
/** `rgb(`, `rgba(`, `hsl(`, `hsla(`, `color(`, `oklch(` — les autres notations. */
const FONCTION_COULEUR = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\s*\(/g

async function sources(dossier: string): Promise<string[]> {
  const entrees = await readdir(dossier, { withFileTypes: true })

  const trouvees = await Promise.all(
    entrees.map(async (entree) => {
      const complet = path.join(dossier, entree.name)
      if (entree.isDirectory()) return sources(complet)
      if (!entree.name.endsWith('.ts') && !entree.name.endsWith('.tsx')) return []
      if (HORS_BUNDLE.test(entree.name)) return []
      return [complet]
    }),
  )

  return trouvees.flat()
}

describe('⛔ aucune couleur en dur hors des tokens', () => {
  it('trouve bien des sources à examiner — sinon ce fichier ne prouve rien', async () => {
    expect((await sources(SRC)).length).toBeGreaterThan(5)
  })

  it('aucun module n’écrit une couleur en clair', async () => {
    const fautifs: string[] = []

    for (const fichier of await sources(SRC)) {
      if (fichier === AUTORISE) continue

      const code = await readFile(fichier, 'utf8')
      for (const motif of [HEX, FONCTION_COULEUR]) {
        for (const trouve of code.match(motif) ?? []) {
          fautifs.push(`${path.relative(SRC, fichier)} — ${trouve}`)
        }
      }
    }

    expect(
      fautifs,
      'Les couleurs vivent dans ui/tokens.ts. Un composant n’écrit que des var(--w-…).',
    ).toEqual([])
  })

  it('expose les trois surcharges de l’hôte, et rien de plus', () => {
    // ⛔ On n’expose pas une API de thème complète : un widget entièrement
    //    rhabillable est un widget qu’on rend illisible par accident.
    const exposees = [...FEUILLE.matchAll(/--feedys-[a-z-]+/g)].map(([nom]) => nom)

    expect([...new Set(exposees)].sort()).toEqual(['--feedys-accent', '--feedys-ancrage', '--feedys-rayon'])
  })

  // ⚠️ Le rouge d’enregistrement est un code universel, compris sans
  //    apprentissage. Laisser un hôte le repeindre en vert détruirait la seule
  //    convention sur laquelle le produit s’appuie gratuitement.
  it('ne rend PAS le signal d’enregistrement surchargeable', () => {
    expect(FEUILLE).toMatch(/--w-rec:\s*#/)
    expect(FEUILLE).not.toMatch(/--w-rec:\s*var\(/)
  })

  it('n’emmène aucune police web chez l’hôte', () => {
    expect(FEUILLE).not.toMatch(/@font-face|fonts\.googleapis|\.woff/)
    expect(FEUILLE).toMatch(/-apple-system/)
  })
})

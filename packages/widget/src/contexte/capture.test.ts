// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { RendreEnToile, Toile } from './capture'
import { capturer, oublierSnapdom } from './capture'

/** Une toile bouchon : elle rend une image dont on décide le poids. */
function toile(poids: (qualite: number) => number): Toile {
  return {
    width: 800,
    toDataURL: (type, qualite) => `data:${type};base64,${'A'.repeat(poids(qualite))}`,
  }
}

function cible(largeur = 800): Element {
  const element = document.createElement('div')
  element.getBoundingClientRect = () => ({ width: largeur, height: 600 }) as DOMRect
  return element
}

afterEach(() => {
  oublierSnapdom()
})

describe('capturer', () => {
  it('rend une image webp sans le préfixe data:', async () => {
    const rendre: RendreEnToile = async () => toile(() => 100)

    const capture = await capturer(cible(), { rendre })

    expect(capture).toEqual({ type: 'image/webp', donnees: 'A'.repeat(100) })
  })

  it('redescend en qualité jusqu’à tenir sous le plafond', async () => {
    const qualites: number[] = []
    const rendre: RendreEnToile = async () =>
      toile((q) => {
        qualites.push(q)
        return q > 0.6 ? 5_000 : 100
      })

    const capture = await capturer(cible(), { rendre, poidsMax: 1_000 })

    expect(capture?.donnees).toHaveLength(100)
    expect(qualites).toEqual([0.8, 0.65, 0.5])
  })

  it('⚠️ part sans image plutôt que de faire attendre, si rien ne tient', async () => {
    const rendre: RendreEnToile = async () => toile(() => 5_000)

    expect(await capturer(cible(), { rendre, poidsMax: 1_000 })).toBeUndefined()
  })

  it('demande un rétrécissement quand l’élément est plus large que la borne', async () => {
    const largeurs: (number | undefined)[] = []
    const rendre: RendreEnToile = async (_cible, largeur) => {
      largeurs.push(largeur)
      return toile(() => 10)
    }

    await capturer(cible(3_000), { rendre, largeurMax: 1_280 })

    expect(largeurs).toEqual([1_280])
  })

  it('⛔ ne grossit jamais une capture déjà étroite', async () => {
    const largeurs: (number | undefined)[] = []
    const rendre: RendreEnToile = async (_cible, largeur) => {
      largeurs.push(largeur)
      return toile(() => 10)
    }

    await capturer(cible(600), { rendre, largeurMax: 1_280 })

    expect(largeurs).toEqual([undefined])
  })
})

describe('⚠️ l’échec doux — la règle qui compte', () => {
  it('rend undefined quand le rendu lève', async () => {
    const rendre: RendreEnToile = async () => {
      throw new Error('canvas tainted par une image cross-origin')
    }

    await expect(capturer(cible(), { rendre })).resolves.toBeUndefined()
  })

  it('rend undefined quand le rendu n’en finit pas de rater', async () => {
    const rendre: RendreEnToile = async () => toile(() => 0)

    expect(await capturer(cible(), { rendre })).toBeUndefined()
  })

  it('rend undefined sans cible', async () => {
    expect(await capturer(null)).toBeUndefined()
    expect(await capturer(undefined)).toBeUndefined()
  })

  it('⛔ ne charge PAS snapdom tant que l’origine Feedys n’est pas connue', async () => {
    const ajout = vi.spyOn(document.head, 'appendChild')

    expect(await capturer(cible())).toBeUndefined()
    expect(ajout).not.toHaveBeenCalled()

    ajout.mockRestore()
  })
})

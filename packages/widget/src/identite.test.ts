import { describe, expect, it } from 'vitest'

import { identiteHote } from './identite'

describe('identiteHote', () => {
  it('lit le jeton posé par l’hôte', () => {
    expect(identiteHote({ feedys: { identite: 'charge.signature' } })).toBe('charge.signature')
  })

  it('taille les espaces d’un jeton recopié à la main', () => {
    expect(identiteHote({ feedys: { identite: '  charge.signature\n' } })).toBe('charge.signature')
  })

  it.each([
    ['sans window.feedys', {}],
    ['sans identite', { feedys: {} }],
    ['identite vide', { feedys: { identite: '   ' } }],
    ['identite qui n’est pas une chaîne', { feedys: { identite: 42 } }],
  ])('rend undefined %s — un retour anonyme est un retour valable', (_cas, global) => {
    expect(identiteHote(global)).toBeUndefined()
  })
})

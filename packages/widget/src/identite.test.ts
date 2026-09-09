import { describe, expect, it, vi } from 'vitest'

import { identiteHote } from './identite'

describe('identiteHote — la forme chaîne', () => {
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

/**
 * ⚠️ La forme fonction existe pour l’onglet qu’on laisse ouvert toute la
 *    journée : l’hôte n’a plus à repasser une chaîne à chaque rotation de son
 *    jeton, il rend celui qu’il a sous la main au moment de l’envoi.
 */
describe('identiteHote — la forme fonction', () => {
  it('appelle la fonction et prend ce qu’elle rend', () => {
    expect(identiteHote({ feedys: { identite: () => 'charge.signature' } })).toBe('charge.signature')
  })

  it('⛔ la RAPPELLE à chaque lecture — c’est tout l’intérêt', () => {
    let courant = 'premier.jeton'
    const global = { feedys: { identite: () => courant } }

    expect(identiteHote(global)).toBe('premier.jeton')
    courant = 'second.jeton'
    expect(identiteHote(global)).toBe('second.jeton')
  })

  it('taille les espaces comme pour une chaîne', () => {
    expect(identiteHote({ feedys: { identite: () => ' charge.signature ' } })).toBe('charge.signature')
  })

  it('⛔ l’appelle SYNCHRONEMENT — l’envoi n’attend jamais l’hôte', () => {
    // ⛔ Si quelqu’un ajoutait un `await` dans `identiteHote`, elle rendrait une
    //    promesse et ce test tomberait. C’est la seule chose qui le retiendra
    //    dans six mois : le chemin d’envoi ne doit RIEN attendre de l’hôte, une
    //    lenteur chez lui coûterait la parole de quelqu’un (P-012).
    const resultat: unknown = identiteHote({ feedys: { identite: () => 'charge.signature' } })

    expect(resultat).not.toBeInstanceOf(Promise)
    expect(resultat).toBe('charge.signature')
  })

  it('⛔ une fonction qui LÈVE vaut identité absente, et l’exception ne remonte pas', () => {
    const qui_leve = vi.fn(() => {
      throw new Error('la session de l’hôte est en vrac')
    })

    expect(() => identiteHote({ feedys: { identite: qui_leve } })).not.toThrow()
    expect(identiteHote({ feedys: { identite: qui_leve } })).toBeUndefined()
    expect(qui_leve).toHaveBeenCalled()
  })

  it.each([
    ['une promesse — ⛔ on ne l’attend pas', () => Promise.resolve('charge.signature')],
    ['un nombre', () => 42],
    ['null', () => null],
    ['undefined', () => undefined],
    ['une chaîne vide', () => '   '],
  ])('rend undefined quand la fonction rend %s', (_cas, identite) => {
    expect(identiteHote({ feedys: { identite } })).toBeUndefined()
  })
})

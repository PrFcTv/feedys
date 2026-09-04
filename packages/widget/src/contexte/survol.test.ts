// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'

import { suivreSurvol } from './survol'

function survoler(element: Element): void {
  element.dispatchEvent(new Event('pointerover', { bubbles: true }))
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('suivreSurvol', () => {
  it('retient le dernier élément passé sous le pointeur', () => {
    document.body.innerHTML = '<button id="a">a</button><button id="b">b</button>'
    const survol = suivreSurvol()

    survoler(document.querySelector('#a')!)
    expect(survol.dernier()).toBe(document.querySelector('#a'))

    survoler(document.querySelector('#b')!)
    expect(survol.dernier()).toBe(document.querySelector('#b'))

    survol.arreter()
  })

  it('⛔ ignore ce qui est dans le widget — la bulle Feedys ne dit rien à personne', () => {
    document.body.innerHTML = '<button id="a">a</button><div id="feedys"><button id="bulle"></button></div>'
    const hote = document.querySelector('#feedys')
    const survol = suivreSurvol({ exclure: hote })

    survoler(document.querySelector('#a')!)
    survoler(document.querySelector('#bulle')!)

    expect(survol.dernier()).toBe(document.querySelector('#a'))
    survol.arreter()
  })

  it('oublie un élément retiré du document depuis', () => {
    document.body.innerHTML = '<button id="a">a</button>'
    const survol = suivreSurvol()
    const bouton = document.querySelector('#a')!

    survoler(bouton)
    bouton.remove()

    expect(survol.dernier()).toBeNull()
    survol.arreter()
  })

  it('rend null tant que rien n’a été survolé', () => {
    const survol = suivreSurvol()
    expect(survol.dernier()).toBeNull()
    survol.arreter()
  })

  it('n’écoute plus rien après arreter()', () => {
    document.body.innerHTML = '<button id="a">a</button>'
    const survol = suivreSurvol()

    survol.arreter()
    survoler(document.querySelector('#a')!)

    expect(survol.dernier()).toBeNull()
  })

  it('⛔ ne garde aucun historique — une seule référence, écrasée', () => {
    document.body.innerHTML = '<button id="a">a</button><button id="b">b</button>'
    const survol = suivreSurvol()

    survoler(document.querySelector('#a')!)
    survoler(document.querySelector('#b')!)

    expect(Object.keys(survol).sort()).toEqual(['arreter', 'dernier'])
    survol.arreter()
  })
})

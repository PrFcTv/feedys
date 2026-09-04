// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'

import { construireSelecteur } from './selecteur'

function poser(html: string): Document {
  document.body.innerHTML = html
  return document
}

function cible(selecteur: string): Element {
  const element = document.querySelector(selecteur)
  if (!element) throw new Error(`Rien ne correspond à « ${selecteur} » dans le montage du test.`)
  return element
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('l’échelle de stratégies', () => {
  it('préfère data-testid à tout le reste', () => {
    poser('<button id="valider" class="btn" data-testid="valider-dossier">Valider</button>')

    expect(construireSelecteur(cible('button'))).toBe('[data-testid="valider-dossier"]')
  })

  it('prend l’id quand il n’y a pas de data-testid', () => {
    poser('<button id="valider" class="btn">Valider</button>')

    expect(construireSelecteur(cible('button'))).toBe('#valider')
  })

  it('⛔ refuse un id de useId — unique aujourd’hui, différent au prochain rendu', () => {
    poser('<div><input id=":r3:" name="montant" /></div>')

    expect(construireSelecteur(cible('input'))).toBe('input[name="montant"]')
  })

  it('prend name et type sur un champ', () => {
    poser('<form><input name="montant" type="number" /><input name="date" /></form>')

    expect(construireSelecteur(cible('[name="montant"]'))).toBe('input[name="montant"][type="number"]')
  })

  it('prend placeholder quand il n’y a ni id ni name', () => {
    poser('<input placeholder="Rechercher un dossier" />')

    expect(construireSelecteur(cible('input'))).toBe('input[placeholder="Rechercher un dossier"]')
  })

  it('prend aria-label sur un élément quelconque', () => {
    poser('<div><span aria-label="Fermer le panneau"></span></div>')

    expect(construireSelecteur(cible('span'))).toBe('span[aria-label="Fermer le panneau"]')
  })

  it('prend les classes stables', () => {
    poser('<div><p class="resume important">x</p><p>y</p></div>')

    expect(construireSelecteur(cible('.resume'))).toBe('p.resume.important')
  })

  it.each([
    ['un hash de CSS Modules', 'bouton_a1b2c3'],
    ['un préfixe d’outillage', '_valider'],
    ['un crochet Tailwind JIT', '[color:red]'],
  ])('⛔ refuse %s et redescend au chemin', (_cas, classe) => {
    poser(`<main><section><p class="${classe}">x</p></section></main>`)

    expect(construireSelecteur(cible('p'))).toBe('body > main > section > p')
  })
})

describe('le chemin, dernier recours', () => {
  it('construit un chemin nth-of-type', () => {
    poser('<main><ul><li>a</li><li>b</li><li>c</li></ul></main>')

    expect(construireSelecteur(cible('li:nth-of-type(2)'))).toBe(
      'body > main > ul > li:nth-of-type(2)',
    )
  })

  it('⚠️ nth-of-type et non nth-child — un div inséré ne décale pas les li', () => {
    poser('<main><ul><div>bandeau</div><li>a</li><li>b</li></ul></main>')

    expect(construireSelecteur(cible('li:nth-of-type(2)'))).toBe(
      'body > main > ul > li:nth-of-type(2)',
    )
  })

  it('s’ancre sur le premier id authentique rencontré en remontant', () => {
    // ⚠️ Le `<tbody>` est ajouté par l’analyseur HTML, pas par le test.
    poser('<main id="tableau"><table><tr><td>a</td><td>b</td></tr></table></main>')

    expect(construireSelecteur(cible('td:nth-of-type(2)'))).toBe('#tableau > table > tbody > tr > td:nth-of-type(2)')
  })

  it('n’utilise pas un sélecteur qui désigne deux éléments', () => {
    poser('<main><p class="ligne">a</p><p class="ligne">b</p></main>')

    expect(construireSelecteur(cible('p:nth-of-type(2)'))).toBe('body > main > p:nth-of-type(2)')
  })
})

describe('la robustesse', () => {
  it('rend undefined sans élément', () => {
    expect(construireSelecteur(null)).toBeUndefined()
    expect(construireSelecteur(undefined)).toBeUndefined()
  })

  it('échappe ce qui casserait un sélecteur', () => {
    poser('<div data-testid=\'valider "vite"\'>x</div>')

    const selecteur = construireSelecteur(cible('div'))
    expect(selecteur).toBeDefined()
    expect(() => document.querySelectorAll(selecteur ?? '')).not.toThrow()
  })

  it('⛔ ne joint aucun texte de la page', () => {
    poser('<main><p class="montant">IBAN FR76 3000 4000 0500 0001 2345 678</p></main>')

    expect(construireSelecteur(cible('p'))).not.toContain('IBAN')
  })
})

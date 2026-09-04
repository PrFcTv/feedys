import { describe, expect, it } from 'vitest'

import { hoteDe, origineAutorisee } from './origine'

describe('hoteDe', () => {
  it.each([
    ['victoria.exemple.fr', 'victoria.exemple.fr'],
    ['https://victoria.exemple.fr', 'victoria.exemple.fr'],
    ['https://victoria.exemple.fr/', 'victoria.exemple.fr'],
    ['  HTTPS://Victoria.Exemple.FR/dossiers  ', 'victoria.exemple.fr'],
    ['localhost:3001', 'localhost'],
  ])('lit « %s » comme « %s »', (domaine, attendu) => {
    expect(hoteDe(domaine)).toBe(attendu)
  })

  it.each(['', '   ', '://'])('refuse « %s »', (domaine) => {
    expect(hoteDe(domaine)).toBeNull()
  })
})

describe('origineAutorisee', () => {
  const domaine = 'victoria.exemple.fr'

  it('laisse passer une requête SANS Origin — ce n’est pas un navigateur', () => {
    expect(origineAutorisee(null, domaine)).toBe(true)
    expect(origineAutorisee(undefined, domaine)).toBe(true)
    expect(origineAutorisee('', domaine)).toBe(true)
  })

  it('refuse « null » — une iframe bac à sable ou un file://', () => {
    expect(origineAutorisee('null', domaine)).toBe(false)
  })

  it('accepte l’origine du produit, quel que soit le schéma ou le port', () => {
    expect(origineAutorisee('https://victoria.exemple.fr', domaine)).toBe(true)
    expect(origineAutorisee('http://victoria.exemple.fr:3000', domaine)).toBe(true)
    expect(origineAutorisee('HTTPS://VICTORIA.EXEMPLE.FR', domaine)).toBe(true)
  })

  it('⛔ ne connaît aucun joker de sous-domaine', () => {
    expect(origineAutorisee('https://mechant.victoria.exemple.fr', domaine)).toBe(false)
    expect(origineAutorisee('https://exemple.fr', domaine)).toBe(false)
    expect(origineAutorisee('https://victoria.exemple.fr.mechant.fr', domaine)).toBe(false)
  })

  it('refuse une origine illisible', () => {
    expect(origineAutorisee('pas une origine', domaine)).toBe(false)
  })

  it('refuse tout quand le produit n’a pas de domaine lisible', () => {
    expect(origineAutorisee('https://victoria.exemple.fr', '   ')).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'

import { BORNES } from '../transport'

import { deduireEcran } from './ecran'

describe('deduireEcran', () => {
  it.each([
    ['https://victoria.exemple.fr/', 'accueil'],
    ['https://victoria.exemple.fr', 'accueil'],
    ['https://victoria.exemple.fr/dossiers', 'dossiers'],
    ['https://victoria.exemple.fr/dossiers/', 'dossiers'],
    ['https://victoria.exemple.fr/dossiers/edition', 'dossiers › edition'],
  ])('lit « %s » comme « %s »', (url, attendu) => {
    expect(deduireEcran(url)).toBe(attendu)
  })

  it.each([
    ['un entier', 'https://victoria.exemple.fr/dossiers/4271/edition'],
    ['un cuid2', 'https://victoria.exemple.fr/dossiers/iwpdx9l5vqeq3ynzlf6f0m6l/edition'],
    ['un uuid', 'https://victoria.exemple.fr/dossiers/3f2504e0-4f89-41d3-9a0c-0305e82c3301/edition'],
    ['un ulid', 'https://victoria.exemple.fr/dossiers/01ARZ3NDEKTSV4RRFFQ69G5FAV/edition'],
    ['un hexa long', 'https://victoria.exemple.fr/dossiers/a1b2c3d4e5f6a7/edition'],
  ])('jette %s — deux dossiers sont le même écran', (_cas, url) => {
    expect(deduireEcran(url)).toBe('dossiers › edition')
  })

  it('ignore la requête et le fragment — l’URL entière est jointe par ailleurs', () => {
    expect(deduireEcran('https://victoria.exemple.fr/dossiers?tri=date#haut')).toBe('dossiers')
  })

  it('décode les segments encodés', () => {
    expect(deduireEcran('https://victoria.exemple.fr/mes%20dossiers')).toBe('mes dossiers')
  })

  it('s’arrête à trois niveaux — au-delà ce n’est plus un nom d’écran', () => {
    expect(deduireEcran('https://x.fr/a/b/c/d/e')).toBe('a › b › c')
  })

  it('respecte la borne du contrat', () => {
    const long = `https://x.fr/${'segment/'.repeat(60)}`
    expect((deduireEcran(long) ?? '').length).toBeLessThanOrEqual(BORNES.ecran)
  })

  it('rend undefined sur une URL illisible, plutôt qu’une chaîne vide', () => {
    expect(deduireEcran('pas une url')).toBeUndefined()
    expect(deduireEcran('')).toBeUndefined()
  })

  it('rend « accueil » quand le chemin n’est que des identifiants', () => {
    expect(deduireEcran('https://x.fr/4271')).toBe('accueil')
  })
})

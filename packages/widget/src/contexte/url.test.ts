import { describe, expect, it } from 'vitest'

import { BORNES } from '../transport'

import { nettoyerUrl } from './url'

describe('nettoyerUrl', () => {
  it('laisse une URL ordinaire intacte', () => {
    const url = 'https://victoria.exemple.fr/dossiers?tri=date&page=2'
    expect(nettoyerUrl(url)).toBe(url)
  })

  it.each([
    'token',
    'access_token',
    'refreshToken',
    'apiKey',
    'secret',
    'password',
    'authorization',
    'session_id',
    'sig',
    'jwt',
  ])('⛔ expurge « %s » — il finirait en base, puis dans un email', (parametre) => {
    const propre = nettoyerUrl(`https://victoria.exemple.fr/x?${parametre}=abcdef123456`)

    expect(propre).not.toContain('abcdef123456')
    expect(propre).toContain('expurg')
  })

  it('garde le nom du paramètre — savoir qu’il y en avait un aide à lire le retour', () => {
    expect(nettoyerUrl('https://x.fr/a?token=secret')).toContain('token=')
  })

  it('n’expurge que ce qu’il faut', () => {
    const propre = nettoyerUrl('https://x.fr/a?token=secret&tri=date')

    expect(propre).toContain('tri=date')
    expect(propre).not.toContain('secret')
  })

  it('expurge aussi dans le fragment — un routeur de hash y met sa requête', () => {
    const propre = nettoyerUrl('https://x.fr/#/dossiers?token=abcdef123456&tri=date')

    expect(propre).not.toContain('abcdef123456')
    expect(propre).toContain('tri=date')
  })

  it('garde un fragment ordinaire tel quel — c’est lui qui porte l’écran', () => {
    expect(nettoyerUrl('https://x.fr/#/dossiers/42')).toBe('https://x.fr/#/dossiers/42')
  })

  it('respecte la borne du contrat', () => {
    const long = `https://x.fr/?q=${'a'.repeat(5_000)}`
    expect(nettoyerUrl(long).length).toBeLessThanOrEqual(BORNES.url)
  })

  it('rend l’entrée telle quelle quand ce n’est pas une URL — échec doux', () => {
    expect(nettoyerUrl('pas une url')).toBe('pas une url')
    expect(nettoyerUrl('')).toBe('')
  })
})

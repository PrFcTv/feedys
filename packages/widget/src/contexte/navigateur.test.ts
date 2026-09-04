import { describe, expect, it } from 'vitest'

import { lireNavigateur, lireSysteme } from './navigateur'

/** Des chaînes d’agent réelles, réduites à ce qui compte pour la lecture. */
const AGENTS = {
  chrome:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0',
  opera:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 OPR/125.0.0.0',
  firefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0',
  safari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15',
  androidChrome:
    'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
  ipadSafari:
    'Mozilla/5.0 (iPad; CPU OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1',
  linuxFirefox: 'Mozilla/5.0 (X11; Linux x86_64; rv:145.0) Gecko/20100101 Firefox/145.0',
} as const

describe('lireNavigateur', () => {
  it.each([
    ['chrome', 'Chrome 141'],
    ['edge', 'Edge 141'],
    ['opera', 'Opera 125'],
    ['firefox', 'Firefox 145'],
    ['safari', 'Safari 18'],
  ] as const)('lit %s comme « %s »', (cle, attendu) => {
    expect(lireNavigateur(AGENTS[cle])).toBe(attendu)
  })

  it('⛔ Edge se déclare Chrome — l’ordre des tests n’est pas décoratif', () => {
    expect(lireNavigateur(AGENTS.edge)).not.toContain('Chrome')
  })

  it('⛔ Opera se déclare Chrome aussi', () => {
    expect(lireNavigateur(AGENTS.opera)).not.toContain('Chrome')
  })

  it('⛔ Chrome se déclare Safari', () => {
    expect(lireNavigateur(AGENTS.chrome)).not.toContain('Safari')
  })

  it('rend undefined sur un agent inconnu — plutôt que d’inventer', () => {
    expect(lireNavigateur('un robot de recette')).toBeUndefined()
    expect(lireNavigateur('')).toBeUndefined()
  })
})

describe('lireSysteme', () => {
  it.each([
    ['chrome', 'Windows'],
    ['safari', 'macOS'],
    ['linuxFirefox', 'Linux'],
    ['androidChrome', 'Android'],
    ['ipadSafari', 'iOS'],
  ] as const)('lit %s comme « %s »', (cle, attendu) => {
    expect(lireSysteme(AGENTS[cle])).toBe(attendu)
  })

  it('⛔ Android contient « Linux » — les mobiles passent avant', () => {
    expect(lireSysteme(AGENTS.androidChrome)).toBe('Android')
  })

  it('⛔ iPad contient « Mac OS X »', () => {
    expect(lireSysteme(AGENTS.ipadSafari)).toBe('iOS')
  })

  it('rend undefined sur un agent inconnu', () => {
    expect(lireSysteme('un robot de recette')).toBeUndefined()
  })
})

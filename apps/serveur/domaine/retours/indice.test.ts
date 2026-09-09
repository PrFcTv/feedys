/**
 * Le lien de corrélation — et les deux façons dont il refuse d’en composer un.
 *
 * ⚠️ Ces tests sont le décalque de `correctif.test.ts`, et c’est voulu : le
 *    motif est le même, délibérément réemployé (D-024, D-026).
 */
import { describe, expect, it } from 'vitest'

import { lienIndice } from './indice'

const GABARIT = 'https://outil.exemple.fr/recherche?q={{ref}}'

describe('lienIndice', () => {
  it('remplace la marque par la référence', () => {
    expect(lienIndice(GABARIT, 'a1b2c3d4')).toBe('https://outil.exemple.fr/recherche?q=a1b2c3d4')
  })

  it('remplace TOUTES les marques — certains outils la veulent deux fois', () => {
    expect(lienIndice('https://o.exemple.fr/{{ref}}/trace/{{ref}}', 'abc')).toBe(
      'https://o.exemple.fr/abc/trace/abc',
    )
  })

  /**
   * ⛔ La référence est opaque et vient du navigateur d’un hôte. Rien ne
   *    garantit qu’elle ne porte pas un `&` ou un `#` qui couperait l’URL en
   *    deux et enverrait le développeur ailleurs.
   */
  it('encode la référence', () => {
    expect(lienIndice(GABARIT, 'a&b#c d')).toBe(
      'https://outil.exemple.fr/recherche?q=a%26b%23c%20d',
    )
  })

  it('rend la référence telle quelle quand elle est déjà un permalien', () => {
    const permalien = 'https://sentry.io/organizations/org/issues/12345/'
    expect(lienIndice(null, permalien)).toBe(permalien)
    expect(lienIndice(GABARIT, permalien)).toBe(permalien)
  })

  it('rend null sans référence — il n’y a rien à pointer', () => {
    expect(lienIndice(GABARIT, null)).toBeNull()
    expect(lienIndice(GABARIT, '   ')).toBeNull()
  })

  it('rend null sans gabarit — la référence reste lisible, simplement pas cliquable', () => {
    expect(lienIndice(null, 'abc')).toBeNull()
    expect(lienIndice('   ', 'abc')).toBeNull()
  })

  /**
   * ⛔ UN GABARIT SANS MARQUE DONNERAIT UN LIEN QUI N’EST PAS NUL MAIS QUI
   *    N’EMMÈNE NULLE PART, et ce lien-là ment. Mieux vaut aucune ancre qu’une
   *    ancre qui ouvre une page vide : la seconde se soupçonne bien plus tard.
   */
  it('rend null quand le gabarit ne porte pas la marque', () => {
    expect(lienIndice('https://outil.exemple.fr/recherche', 'abc')).toBeNull()
  })

  /**
   * ⛔ Une `url_observabilite` posée à la main pourrait porter n’importe quoi.
   *    Un `javascript:` rendu cliquable dans le back-office serait une faille
   *    ouverte par confort d’affichage — la même que `lienCorrectif` refuse.
   */
  it('⛔ ne compose un lien que depuis https', () => {
    expect(lienIndice('javascript:alert(1)/{{ref}}', 'abc')).toBeNull()
    expect(lienIndice('http://outil.exemple.fr/{{ref}}', 'abc')).toBeNull()
    expect(lienIndice(null, 'javascript:alert(1)')).toBeNull()
    expect(lienIndice(null, 'http://outil.exemple.fr/x')).toBeNull()
  })
})

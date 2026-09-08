/**
 * ⛔ Ce qui est testé ici tient en une phrase : Feedys compose un lien, il ne
 *    va jamais voir s’il mène quelque part (D-024).
 */
import { describe, expect, it } from 'vitest'

import { lienCorrectif } from './correctif'

describe('lienCorrectif', () => {
  it('compose le lien d’un SHA à partir du dépôt du produit', () => {
    expect(lienCorrectif('https://github.com/exemple/depot', 'a1b2c3d4e5')).toBe(
      'https://github.com/exemple/depot/commit/a1b2c3d4e5',
    )
  })

  it('supporte une barre finale sur l’URL du dépôt', () => {
    expect(lienCorrectif('https://github.com/exemple/depot/', 'a1b2c3d')).toBe(
      'https://github.com/exemple/depot/commit/a1b2c3d',
    )
  })

  it('rend une URL fournie telle quelle — elle EST déjà le lien', () => {
    const pr = 'https://github.com/exemple/depot/pull/42'

    expect(lienCorrectif('https://github.com/exemple/depot', pr)).toBe(pr)
    // ⚠️ Et même sans dépôt déclaré : une URL se suffit à elle-même.
    expect(lienCorrectif(null, pr)).toBe(pr)
  })

  it('rend null quand il n’y a rien à lier', () => {
    expect(lienCorrectif('https://github.com/exemple/depot', null)).toBeNull()
    expect(lienCorrectif('https://github.com/exemple/depot', '   ')).toBeNull()
    // ⚠️ Un SHA sans dépôt déclaré ne mène nulle part : mieux vaut pas de lien
    //    qu’un lien faux. Le SHA, lui, reste affiché.
    expect(lienCorrectif(null, 'a1b2c3d')).toBeNull()
  })

  it('⛔ ne rend cliquable que du https — jamais un schéma exotique', () => {
    expect(lienCorrectif('javascript:alert(1)', 'a1b2c3d')).toBeNull()
    expect(lienCorrectif('http://github.com/exemple/depot', 'a1b2c3d')).toBeNull()
  })
})

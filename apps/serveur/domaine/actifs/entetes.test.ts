import { describe, expect, it } from 'vitest'

import { CACHE, dejaAJour, empreinte, entetesActif } from './entetes'

describe('les en-têtes de /widget.js', () => {
  /**
   * ⚠️ Cinq minutes, pas un an. Le widget est servi à quatre logiciels qui ne
   *    redéploient pas : c’est notre cache qui décide de la vitesse de
   *    propagation d’un correctif (04-Architecture/hebergement.md).
   */
  it('met cinq minutes de cache, et une journée de revalidation en arrière-plan', () => {
    expect(CACHE).toBe('public, max-age=300, stale-while-revalidate=86400')
  })

  it('ouvre le script à toutes les origines — c’est le seul endroit où on le fait', () => {
    const entetes = entetesActif(empreinte('a1b2c3'), 42)

    expect(entetes['access-control-allow-origin']).toBe('*')
    expect(entetes['content-type']).toBe('text/javascript; charset=utf-8')
    expect(entetes['content-length']).toBe('42')
    expect(entetes['x-content-type-options']).toBe('nosniff')
    // ⚠️ Sans CORP, un hôte qui active COEP bloque le script, et l’erreur ne
    //    ressemble à rien de reconnaissable.
    expect(entetes['cross-origin-resource-policy']).toBe('cross-origin')
  })

  it('met l’empreinte entre guillemets — un ETag nu est jeté par les caches', () => {
    expect(empreinte('a1b2c3')).toBe('"a1b2c3"')
    expect(entetesActif(empreinte('a1b2c3'), 1).etag).toBe('"a1b2c3"')
  })
})

describe('dejaAJour', () => {
  it('reconnaît l’empreinte, seule ou dans une liste', () => {
    expect(dejaAJour('"a1b2c3"', '"a1b2c3"')).toBe(true)
    expect(dejaAJour('"autre", "a1b2c3"', '"a1b2c3"')).toBe(true)
  })

  it('accepte la correspondance faible fabriquée par les proxys', () => {
    expect(dejaAJour('W/"a1b2c3"', '"a1b2c3"')).toBe(true)
  })

  it('accepte le joker', () => {
    expect(dejaAJour('*', '"a1b2c3"')).toBe(true)
  })

  it('refuse une autre version, et l’absence d’en-tête', () => {
    expect(dejaAJour('"autre"', '"a1b2c3"')).toBe(false)
    expect(dejaAJour(null, '"a1b2c3"')).toBe(false)
    expect(dejaAJour('', '"a1b2c3"')).toBe(false)
  })
})

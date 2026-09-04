import { describe, expect, it } from 'vitest'

import {
  CACHE,
  dejaAJour,
  empreinte,
  empreinteEncodee,
  encodageAccepte,
  entetesActif,
} from './entetes'

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

describe('la compression du script servi', () => {
  it.each([
    ['gzip, deflate, br', 'br'],
    ['gzip, deflate', 'gzip'],
    ['GZIP', 'gzip'],
    ['br;q=1.0, gzip;q=0.8, *;q=0.1', 'br'],
  ])('lit « %s » comme %s', (entete, attendu) => {
    expect(encodageAccepte(entete)).toBe(attendu)
  })

  it.each([null, undefined, '', 'identity', 'zstd'])(
    'sert en clair quand le client n’annonce rien d’utile (%s)',
    (entete) => {
      expect(encodageAccepte(entete)).toBeUndefined()
    },
  )

  /**
   * ⛔ Le budget du widget est en gzip, et P-014 le mesure sur le fichier SERVI.
   *    Sans `content-encoding`, `widget.js` part en clair — 76 Ko chez l’hôte
   *    contre 60 Ko de budget.
   */
  it('annonce l’encodage et fait varier la réponse dessus', () => {
    const entetes = entetesActif('"abc"', 26_657, 'gzip')

    expect(entetes['content-encoding']).toBe('gzip')
    expect(entetes['vary']).toBe('Accept-Encoding')
    expect(entetes['content-length']).toBe('26657')
  })

  it('n’annonce aucun encodage quand le fichier part en clair', () => {
    const entetes = entetesActif('"abc"', 76_655)

    expect(entetes).not.toHaveProperty('content-encoding')
    // ⚠️ Le `vary` reste : la réponse dépend de l’en-tête, même quand elle ne
    //    compresse pas cette fois-ci.
    expect(entetes['vary']).toBe('Accept-Encoding')
  })

  it('⛔ distingue les empreintes de deux représentations du même fichier', () => {
    expect(empreinteEncodee('"abc"', 'gzip')).toBe('"abc-gzip"')
    expect(empreinteEncodee('"abc"', 'br')).toBe('"abc-br"')
    expect(empreinteEncodee('"abc"', undefined)).toBe('"abc"')
  })

  it('garde des guillemets valides — un ETag sans guillemets est jeté en silence', () => {
    for (const encodage of ['gzip', 'br', undefined] as const) {
      expect(empreinteEncodee(empreinte('a1b2'), encodage)).toMatch(/^"[^"]+"$/)
    }
  })
})

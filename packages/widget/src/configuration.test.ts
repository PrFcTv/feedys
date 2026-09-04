// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'

import { lireConfiguration } from './configuration'

function balise(attributs: Record<string, string>): HTMLScriptElement {
  const script = document.createElement('script')
  for (const [nom, valeur] of Object.entries(attributs)) script.setAttribute(nom, valeur)
  return script
}

const VALIDE = { src: 'https://feedys.exemple.fr/widget.js', 'data-cle': 'fdy_pub_a1b2c3' }

describe('lireConfiguration', () => {
  it('lit la clé et déduit l’origine du src', () => {
    const lecture = lireConfiguration(balise(VALIDE))

    expect(lecture).toEqual({
      ok: true,
      configuration: { cle: 'fdy_pub_a1b2c3', origine: 'https://feedys.exemple.fr', position: 'bas-droite' },
    })
  })

  it('accepte un src relatif, en s’appuyant sur l’URL de la page', () => {
    const lecture = lireConfiguration(balise({ ...VALIDE, src: '/widget.js' }), 'https://victoria.exemple.fr/dossiers')

    expect(lecture.ok && lecture.configuration.origine).toBe('https://victoria.exemple.fr')
  })

  it('ancre le lanceur à gauche sur demande, à droite sinon', () => {
    const position = (demandee: string): string | undefined => {
      const lecture = lireConfiguration(balise({ ...VALIDE, 'data-position': demandee }))
      return lecture.ok ? lecture.configuration.position : undefined
    }

    expect(position('bas-gauche')).toBe('bas-gauche')
    // ⚠️ Une valeur inconnue retombe sur le défaut plutôt que de ne rien ancrer.
    expect(position('n’importe quoi')).toBe('bas-droite')
  })

  it('refuse une balise sans data-cle', () => {
    const lecture = lireConfiguration(balise({ src: VALIDE.src }))

    expect(lecture.ok).toBe(false)
    expect(!lecture.ok && lecture.refus).toBe('cle_absente')
  })

  // ⛔ Le cas le plus important du fichier : un secret produit collé dans le
  //    HTML de l’hôte est lisible par tout le monde. On refuse de démarrer
  //    plutôt que de le poster — il faut le révoquer, pas s’en servir.
  it('refuse de démarrer si data-cle porte un SECRET produit', () => {
    const lecture = lireConfiguration(balise({ ...VALIDE, 'data-cle': 'fdy_sec_a1b2c3' }))

    expect(lecture.ok).toBe(false)
    expect(!lecture.ok && lecture.refus).toBe('secret_en_clair')
    expect(!lecture.ok && lecture.message).toMatch(/révoquer/)
  })

  it('refuse une clé qui n’a pas la forme d’une clé publique', () => {
    const lecture = lireConfiguration(balise({ ...VALIDE, 'data-cle': 'a1b2c3' }))

    expect(!lecture.ok && lecture.refus).toBe('cle_invalide')
  })

  it('refuse un src absent — sans lui, on ne sait pas où poster', () => {
    const lecture = lireConfiguration(balise({ 'data-cle': VALIDE['data-cle'] }))

    expect(!lecture.ok && lecture.refus).toBe('origine_illisible')
  })

  it('refuse l’absence de balise plutôt que d’exploser', () => {
    expect(lireConfiguration(null).ok).toBe(false)
  })
})

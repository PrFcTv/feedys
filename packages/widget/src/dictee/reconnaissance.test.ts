import type SpeechToElement from 'speech-to-element'
import { describe, expect, it, vi } from 'vitest'

import { dicteeDisponible, dicter } from './reconnaissance'

type Options = Parameters<typeof SpeechToElement.startWebSpeech>[0]

function fauxMoteur(supporte = true) {
  let options: Options
  const stop = vi.fn()

  const moteur = {
    isWebSpeechSupported: () => supporte,
    startWebSpeech: (recues: Options) => {
      options = recues
    },
    stop,
  } as unknown as typeof SpeechToElement

  return {
    moteur,
    stop,
    /** Rejoue ce que Web Speech envoie : des morceaux, provisoires puis définitifs. */
    emettre: (texte: string, estFinal: boolean) => options?.onResult?.(texte, estFinal),
    langue: () => options?.language,
    provisoires: () => options?.displayInterimResults,
  }
}

describe('dicteeDisponible', () => {
  it('suit le navigateur', () => {
    expect(dicteeDisponible(fauxMoteur(true).moteur)).toBe(true)
    expect(dicteeDisponible(fauxMoteur(false).moteur)).toBe(false)
  })

  it('rend false plutôt que d’exploser — on ne s’excuse pas d’une absence', () => {
    const casse = {
      isWebSpeechSupported: () => {
        throw new Error('non')
      },
    } as unknown as typeof SpeechToElement

    expect(dicteeDisponible(casse)).toBe(false)
  })
})

describe('dicter', () => {
  it('demande le français, et les résultats provisoires', () => {
    const faux = fauxMoteur()
    dicter({ surTexte: () => undefined, moteur: faux.moteur })

    expect(faux.langue()).toBe('fr-FR')
    // ⚠️ Ce sont eux qui s’écrivent en direct sous l’onde : c’est la preuve que
    //    ça fonctionne.
    expect(faux.provisoires()).toBe(true)
  })

  it('sépare ce qui est arrêté de ce qui est en train d’être entendu', () => {
    const faux = fauxMoteur()
    const vus: Array<[string, string]> = []
    dicter({ surTexte: (definitif, provisoire) => vus.push([definitif, provisoire]), moteur: faux.moteur })

    faux.emettre('le tri par', false)
    faux.emettre('le tri par date', false)
    faux.emettre('le tri par date', true)

    expect(vus).toEqual([
      ['', 'le tri par'],
      ['', 'le tri par date'],
      ['le tri par date', ''],
    ])
  })

  /**
   * ⚠️ Web Speech ne met pas d’espace entre deux segments définitifs, et
   *    `speech-to-element` ne rend que le NOUVEAU morceau. Sans recollage, on
   *    obtient « le tri par datese remet à zéro ».
   */
  it('recolle deux segments définitifs avec une espace', () => {
    const faux = fauxMoteur()
    let definitif = ''
    dicter({ surTexte: (fini) => (definitif = fini), moteur: faux.moteur })

    faux.emettre('le tri par date', true)
    faux.emettre('se remet à zéro', true)

    expect(definitif).toBe('le tri par date se remet à zéro')
  })

  it('ignore un segment vide plutôt que d’ajouter une espace de plus', () => {
    const faux = fauxMoteur()
    let definitif = ''
    dicter({ surTexte: (fini) => (definitif = fini), moteur: faux.moteur })

    faux.emettre('le tri par date', true)
    faux.emettre('   ', true)

    expect(definitif).toBe('le tri par date')
  })

  it('arrête le moteur, et supporte qu’il soit déjà arrêté', () => {
    const faux = fauxMoteur()
    faux.stop.mockImplementation(() => {
      throw new Error('déjà arrêté')
    })

    const dictee = dicter({ surTexte: () => undefined, moteur: faux.moteur })

    expect(() => dictee.arreter()).not.toThrow()
    expect(faux.stop).toHaveBeenCalledOnce()
  })

  /**
   * ⛔ Aucun `element` n’est passé : avec un `element`, `speech-to-element` pose
   *    des écouteurs `mousedown`, `mouseup` et `keydown` sur le document de
   *    l’hôte. Le widget n’a pas le droit de capter ses raccourcis
   *    (01-Specs/widget.md §3).
   */
  it('⛔ ne donne aucun élément au moteur — sinon il écoute le document de l’hôte', () => {
    const faux = fauxMoteur()
    dicter({ surTexte: () => undefined, moteur: faux.moteur })

    expect(faux.langue()).toBeDefined()
    expect((faux as unknown as { element?: unknown }).element).toBeUndefined()
  })
})

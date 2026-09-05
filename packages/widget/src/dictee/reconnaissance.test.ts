import type SpeechToElement from 'speech-to-element'
import { describe, expect, it, vi } from 'vitest'

import { dicteeDisponible, dicter } from './reconnaissance'

type Options = Parameters<typeof SpeechToElement.startWebSpeech>[0]

function fauxMoteur(supporte = true) {
  let options: Options
  let demarrages = 0
  const stop = vi.fn()

  const moteur = {
    isWebSpeechSupported: () => supporte,
    startWebSpeech: (recues: Options) => {
      options = recues
      demarrages += 1
    },
    stop,
  } as unknown as typeof SpeechToElement

  return {
    moteur,
    stop,
    /** Rejoue ce que Web Speech envoie : des morceaux, provisoires puis définitifs. */
    emettre: (texte: string, estFinal: boolean) => options?.onResult?.(texte, estFinal),
    /** ⚠️ Chrome rend la main tout seul après un silence. C’est le cœur du sujet. */
    rendreLaMain: () => options?.onStop?.(),
    echouer: (message: string) => options?.onError?.(message),
    demarrages: () => demarrages,
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

/**
 * ⚠️ LE DÉFAUT QUI A COÛTÉ UNE DICTÉE ENTIÈRE (03-Bugs/BUGS_LOG.md 007).
 *
 * Chrome coupe `SpeechRecognition` de lui-même, `continuous` ou pas. L’en-tête
 * de `reconnaissance.ts` affirmait que `speech-to-element` recollait ça ; c’est
 * faux — son `onend` se contente de remettre un drapeau à zéro. Personne ne
 * relançait, et la personne parlait dans le vide.
 */
describe('quand Chrome rend la main tout seul', () => {
  it('relance le moteur — sinon la dictée meurt en plein milieu', () => {
    const faux = fauxMoteur()
    dicter({ surTexte: () => undefined, moteur: faux.moteur })

    expect(faux.demarrages()).toBe(1)

    faux.rendreLaMain()

    expect(faux.demarrages()).toBe(2)
  })

  it('ne perd pas ce qui précède : le recollage traverse la relance', () => {
    const faux = fauxMoteur()
    let definitif = ''
    dicter({ surTexte: (fini) => (definitif = fini), moteur: faux.moteur })

    faux.emettre('le tri par date', true)
    faux.rendreLaMain()
    faux.emettre('se remet à zéro', true)

    expect(definitif).toBe('le tri par date se remet à zéro')
  })

  it('⛔ ne relance PAS quand c’est nous qui avons arrêté', () => {
    const faux = fauxMoteur()
    const dictee = dicter({ surTexte: () => undefined, moteur: faux.moteur })

    dictee.arreter()
    faux.rendreLaMain()

    expect(faux.demarrages()).toBe(1)
  })

  it('prévient la coquille seulement quand il renonce pour de bon', () => {
    const faux = fauxMoteur()
    const fins: number[] = []
    dicter({ surTexte: () => undefined, surFin: () => fins.push(1), moteur: faux.moteur })

    // Une relance ordinaire n’est pas une fin : la personne parle toujours.
    faux.rendreLaMain()
    expect(fins).toHaveLength(0)
  })

  /**
   * ⛔ Un moteur mort qui rend la main aussitôt ne doit pas faire tourner une
   *    boucle de relances dans la page de l’hôte.
   */
  it('⛔ abandonne après quelques relances stériles, sans boucler', () => {
    const faux = fauxMoteur()
    const fins: number[] = []
    dicter({ surTexte: () => undefined, surFin: () => fins.push(1), moteur: faux.moteur })

    for (let tour = 0; tour < 20; tour += 1) faux.rendreLaMain()

    expect(faux.demarrages()).toBeLessThanOrEqual(4)
    expect(fins).toHaveLength(1)
  })

  it('un mot entendu remet le compteur de relances stériles à zéro', () => {
    const faux = fauxMoteur()
    dicter({ surTexte: () => undefined, moteur: faux.moteur })

    for (let tour = 0; tour < 3; tour += 1) faux.rendreLaMain()
    faux.emettre('on parle encore', true)
    faux.rendreLaMain()

    // La relance qui suit la parole est accordée : le moteur n’est pas mort.
    expect(faux.demarrages()).toBeGreaterThan(4)
  })
})

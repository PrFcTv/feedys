// @vitest-environment happy-dom
/**
 * Le parcours de dictée, de bout en bout, sans micro et sans Chrome.
 *
 * ⚠️ Il ne remplace PAS la recette humaine : « dicter en français produit un
 *    transcript correct dans Chrome » demande une voix et un micro. Ce fichier
 *    tient tout le reste — le geste, l’absence de Web Speech, l’annulation,
 *    l’absence d’envoi automatique, et `source`.
 */
import { act } from 'preact/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Configuration } from '../configuration'
import type { Contexte, CorpsRetour } from '../contrat'
import type { Dictee as Reconnaissance, OptionsDictee } from '../dictee/reconnaissance'
import type { Ouverture } from '../dictee/micro'
import type { Resultat } from '../envoi'
import { monter } from '../montage'

const CONFIGURATION: Configuration = {
  cle: 'fdy_pub_a1b2c3',
  origine: 'https://feedys.exemple.fr',
  position: 'bas-droite',
}

const CONTEXTE: Contexte = { url: 'https://victoria.exemple.fr/dossiers' }

const vraiAttachShadow = Element.prototype.attachShadow
let racines: ShadowRoot[] = []

beforeEach(() => {
  racines = []
  Element.prototype.attachShadow = function (init: ShadowRootInit): ShadowRoot {
    const racine = vraiAttachShadow.call(this, init)
    racines.push(racine)
    return racine
  }
})

afterEach(() => {
  Element.prototype.attachShadow = vraiAttachShadow
  document.body.innerHTML = ''
})

/** Le moteur de reconnaissance, piloté à la main. */
function fauxMoteur() {
  let surTexte: OptionsDictee['surTexte'] | undefined
  const arreter = vi.fn()

  return {
    arreter,
    dicter: (options: OptionsDictee): Reconnaissance => {
      surTexte = options.surTexte
      return { arreter }
    },
    dire: (definitif: string) => surTexte?.(definitif, ''),
    murmurer: (provisoire: string) => surTexte?.('', provisoire),
    demarre: () => surTexte !== undefined,
  }
}

/** Un micro qui rend toujours le même niveau. */
function fauxMicro(niveau = 0.2) {
  const arreter = vi.fn()
  return {
    arreter,
    ouvrir: async (): Promise<Ouverture> => ({
      ok: true,
      micro: { niveau: () => niveau, flux: {} as MediaStream, arreter },
    }),
  }
}

function installer({ dispo = true }: { dispo?: boolean } = {}) {
  const moteur = fauxMoteur()
  const micro = fauxMicro()
  const envois: CorpsRetour[] = []
  const envoyer = vi.fn(async (corps: CorpsRetour): Promise<Resultat> => {
    envois.push(corps)
    return { ok: true, retour: 'ret_1' }
  })

  let montage!: ReturnType<typeof monter>
  void act(() => {
    montage = monter(CONFIGURATION, {
      ports: {
        collecter: async () => CONTEXTE,
        envoyer,
        // ⚠️ L’entretien est bouchonné : ce fichier recette LA DICTÉE, et un
        //    port réel enverrait un `fetch` que personne n’attend.
        demanderTour: async () => ({ ok: false }),
        terminer: async () => true,
        dicteeDisponible: () => dispo,
        dictee: { dicter: moteur.dicter, ouvrirMicro: micro.ouvrir },
      },
    })
  })

  const racine = racines[0]
  if (!racine) throw new Error('aucune racine fantôme')

  return {
    montage,
    racine,
    moteur,
    micro,
    envoyer,
    envois,
    trouver: <T extends Element>(selecteur: string) => racine.querySelector<T>(selecteur),
  }
}

async function calmer(): Promise<void> {
  await act(async () => {
    for (let tour = 0; tour < 8; tour += 1) await Promise.resolve()
  })
}

async function ouvrir(racine: ShadowRoot): Promise<void> {
  await act(async () => {
    racine.querySelector<HTMLButtonElement>('.lanceur')!.click()
  })
  await calmer()
}

const boutonMicro = (racine: ShadowRoot) => racine.querySelector<HTMLButtonElement>('.micro__bouton')!
const champDe = (racine: ShadowRoot) => racine.querySelector<HTMLTextAreaElement>('.champ')

function pointeur(type: string, x = 0): PointerEvent {
  const evenement = new Event(type, { bubbles: true, cancelable: true }) as PointerEvent
  Object.defineProperties(evenement, {
    clientX: { value: x },
    pointerId: { value: 1 },
  })
  return evenement
}

async function appuyer(racine: ShadowRoot, x = 0): Promise<void> {
  const bouton = boutonMicro(racine)
  bouton.setPointerCapture = () => undefined
  await act(async () => {
    bouton.dispatchEvent(pointeur('pointerdown', x))
  })
  await calmer()
}

async function envoyerEvenement(racine: ShadowRoot, evenement: Event): Promise<void> {
  await act(async () => {
    boutonMicro(racine).dispatchEvent(evenement)
  })
  await calmer()
}

describe('⛔ sans Web Speech — Firefox, Safari', () => {
  it('le bloc micro DISPARAÎT, sans un mot', async () => {
    const { racine, trouver } = installer({ dispo: false })
    await ouvrir(racine)

    expect(trouver('.micro')).toBeNull()
    expect(trouver('.separateur')).toBeNull()
    // ⛔ Et surtout : rien qui mentionne ce qui manque.
    expect(trouver('.panneau')!.textContent).not.toMatch(/micro|dict|navigateur|Chrome|Firefox|support/i)
  })

  it('le champ texte prend toute la place, et fonctionne', async () => {
    const { racine, envois, trouver } = installer({ dispo: false })
    await ouvrir(racine)

    const champ = champDe(racine)!
    await act(async () => {
      champ.value = 'je préfère écrire'
      champ.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => {
      trouver<HTMLButtonElement>('.envoyer')!.click()
    })
    await calmer()

    expect(envois[0]).toMatchObject({ texte: 'je préfère écrire', source: 'texte' })
  })
})

describe('⛔ la parole d’abord, mais jamais la parole seulement', () => {
  it('le micro ET le champ texte sont sur le même écran', async () => {
    const { racine, trouver } = installer()
    await ouvrir(racine)

    expect(trouver('.micro')).not.toBeNull()
    // ⚠️ Le champ n’est pas derrière un lien : il est là, au même niveau.
    expect(champDe(racine)).not.toBeNull()
    expect(trouver('.separateur')!.textContent).toBe('ou')
  })
})

describe('le geste de la note vocale', () => {
  it('maintenir démarre l’écoute, relâcher rend le transcript au champ', async () => {
    const { racine, moteur, trouver } = installer()
    await ouvrir(racine)

    await appuyer(racine)
    expect(moteur.demarre()).toBe(true)
    expect(trouver('.ecoute')).not.toBeNull()

    await act(async () => {
      moteur.dire('le tri par date se remet à zéro')
    })
    // ⚠️ Un appui TENU : au-delà du seuil de clic, le relâchement termine.
    await new Promise((r) => setTimeout(r, 400))
    await envoyerEvenement(racine, pointeur('pointerup'))

    expect(trouver('.ecoute')).toBeNull()
    expect(champDe(racine)!.value).toBe('le tri par date se remet à zéro')
    expect(moteur.arreter).toHaveBeenCalled()
  })

  it('un clic simple bascule en mains libres, un second termine', async () => {
    const { racine, moteur, trouver } = installer()
    await ouvrir(racine)

    await appuyer(racine)
    await envoyerEvenement(racine, pointeur('pointerup'))

    // Toujours à l’écoute : c’est le mode mains libres.
    expect(trouver('.ecoute')).not.toBeNull()
    expect(trouver('.micro__legende')!.textContent).toContain('cliquez pour terminer')

    await act(async () => {
      moteur.dire('un retour un peu plus long')
    })
    await envoyerEvenement(racine, pointeur('pointerdown'))

    expect(trouver('.ecoute')).toBeNull()
    expect(champDe(racine)!.value).toBe('un retour un peu plus long')
  })

  it('⛔ glisser vers la gauche annule : rien n’est gardé', async () => {
    const { racine, moteur, trouver } = installer()
    await ouvrir(racine)

    await appuyer(racine, 200)
    await act(async () => {
      moteur.dire('ce que je ne veux surtout pas envoyer')
    })

    await envoyerEvenement(racine, pointeur('pointermove', 100))

    expect(trouver('.ecoute')).toBeNull()
    expect(champDe(racine)!.value).toBe('')
  })

  it('un tremblement de la main n’annule pas', async () => {
    const { racine, trouver } = installer()
    await ouvrir(racine)

    await appuyer(racine, 200)
    await envoyerEvenement(racine, pointeur('pointermove', 190))

    expect(trouver('.ecoute')).not.toBeNull()
  })

  it('⛔ Espace maintenu vaut l’appui — tout le parcours est faisable au clavier', async () => {
    const { racine, moteur, trouver } = installer()
    await ouvrir(racine)

    await envoyerEvenement(racine, new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }))
    expect(trouver('.ecoute')).not.toBeNull()
    expect(moteur.demarre()).toBe(true)

    await act(async () => {
      moteur.dire('dicté au clavier')
    })
    await new Promise((r) => setTimeout(r, 400))
    await envoyerEvenement(racine, new KeyboardEvent('keyup', { key: ' ', bubbles: true, cancelable: true }))

    expect(champDe(racine)!.value).toBe('dicté au clavier')
  })

  it('au clavier, c’est Échap qui annule — « glisser » n’y veut rien dire', async () => {
    const { racine, moteur, trouver } = installer()
    await ouvrir(racine)

    await envoyerEvenement(racine, new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }))
    await act(async () => {
      moteur.dire('à jeter')
    })
    await envoyerEvenement(racine, new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))

    expect(trouver('.ecoute')).toBeNull()
    expect(champDe(racine)!.value).toBe('')
    // ⚠️ Le panneau, lui, est resté ouvert : la première pression jette la
    //    dictée, la seconde ferme.
    expect(trouver('.panneau')).not.toBeNull()
  })
})

describe('l’écran « j’écoute »', () => {
  it('écrit le transcript en direct, annoncé poliment', async () => {
    const { racine, moteur, trouver } = installer()
    await ouvrir(racine)
    await appuyer(racine)

    await act(async () => {
      moteur.murmurer('le tri par')
    })

    const transcript = trouver('.ecoute__transcript')!
    expect(transcript.textContent).toContain('le tri par')
    // ⚠️ `polite` et non `assertive` : on ne coupe pas la parole de quelqu’un
    //    qui est en train de parler.
    expect(transcript.getAttribute('aria-live')).toBe('polite')
  })

  it('⛔ pas de bouton d’envoi pendant l’écoute — on relâche, on relit, on envoie', async () => {
    const { racine, moteur, envoyer, trouver } = installer()
    await ouvrir(racine)
    await appuyer(racine)

    await act(async () => {
      moteur.dire('quelque chose')
    })

    expect(trouver('.envoyer')).toBeNull()
    expect(envoyer).not.toHaveBeenCalled()
  })

  it('⚠️ « glisser pour annuler » n’apparaît qu’au premier son', async () => {
    const { racine, trouver } = installer()
    await ouvrir(racine)
    await appuyer(racine)

    // Rien n’a encore été entendu : la ligne est vide, pas absente.
    expect(trouver('.ecoute__annuler')!.textContent).toBe('')
  })

  it('⚠️ le compteur ne s’affiche pas avant trente secondes', async () => {
    const { racine, trouver } = installer()
    await ouvrir(racine)
    await appuyer(racine)

    expect(trouver('.ecoute__compteur')!.textContent).toBe('')
  })
})

describe('source et transcriptBrut', () => {
  it('un retour dicté part en « voix », avec son transcript brut', async () => {
    const { racine, moteur, envois, trouver } = installer()
    await ouvrir(racine)

    await appuyer(racine)
    await act(async () => {
      moteur.dire('le tri par date se remet à zéro')
    })
    await new Promise((r) => setTimeout(r, 400))
    await envoyerEvenement(racine, pointeur('pointerup'))

    await act(async () => {
      trouver<HTMLButtonElement>('.envoyer')!.click()
    })
    await calmer()

    expect(envois[0]).toMatchObject({
      texte: 'le tri par date se remet à zéro',
      transcriptBrut: 'le tri par date se remet à zéro',
      source: 'voix',
    })
  })

  /**
   * ⚠️ `source` décrit le CHEMIN EMPRUNTÉ, pas l’état final du texte : quelqu’un
   *    qui dicte puis corrige une faute a bien parlé.
   */
  it('reste « voix » après une correction au clavier, et garde le brut', async () => {
    const { racine, moteur, envois, trouver } = installer()
    await ouvrir(racine)

    await appuyer(racine)
    await act(async () => {
      moteur.dire('le tri par datte')
    })
    await new Promise((r) => setTimeout(r, 400))
    await envoyerEvenement(racine, pointeur('pointerup'))

    const champ = champDe(racine)!
    await act(async () => {
      champ.value = 'le tri par date'
      champ.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => {
      trouver<HTMLButtonElement>('.envoyer')!.click()
    })
    await calmer()

    expect(envois[0]).toMatchObject({
      texte: 'le tri par date',
      transcriptBrut: 'le tri par datte',
      source: 'voix',
    })
  })

  it('un retour écrit part en « texte », sans transcript brut', async () => {
    const { racine, envois, trouver } = installer()
    await ouvrir(racine)

    const champ = champDe(racine)!
    await act(async () => {
      champ.value = 'écrit à la main'
      champ.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => {
      trouver<HTMLButtonElement>('.envoyer')!.click()
    })
    await calmer()

    expect(envois[0]).toEqual({
      texte: 'écrit à la main',
      source: 'texte',
      contexte: CONTEXTE,
    })
  })
})

// @vitest-environment happy-dom
/**
 * La recette automatisable de la coquille.
 *
 * ⚠️ Elle ne remplace PAS `pnpm widget:demo` : ce qui se casse chez un hôte —
 *    les styles qui fuient, le z-index, une modale par-dessus — ne se voit que
 *    dans un vrai navigateur, dans une vraie page hostile. Ce fichier tient les
 *    invariants qu’une page ne montre pas : le shadow DOM fermé, l’absence
 *    d’appel réseau avant le clic, le piège à focus, le brouillon conservé.
 *
 * ⚠️ `attachShadow` est instrumenté — c’est la seule façon d’entrer dans une
 *    racine FERMÉE, et ça vérifie du même coup qu’elle l’est bien.
 */
import { act } from 'preact/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Configuration } from './configuration'
import type { Contexte, CorpsRetour } from './contrat'
import type { Resultat } from './envoi'
import { monter } from './montage'
import type { Ports } from './ui/Widget'

const CONFIGURATION: Configuration = {
  cle: 'fdy_pub_a1b2c3',
  origine: 'https://feedys.exemple.fr',
  position: 'bas-droite',
}

const CONTEXTE: Contexte = { url: 'https://victoria.exemple.fr/dossiers' }

const vraiAttachShadow = Element.prototype.attachShadow
let racines: ShadowRoot[] = []
let modes: string[] = []

beforeEach(() => {
  racines = []
  modes = []
  Element.prototype.attachShadow = function (init: ShadowRootInit): ShadowRoot {
    modes.push(init.mode)
    const racine = vraiAttachShadow.call(this, init)
    racines.push(racine)
    return racine
  }
})

afterEach(() => {
  Element.prototype.attachShadow = vraiAttachShadow
  document.body.innerHTML = ''
  vi.useRealTimers()
})

function installer(remplacements: Partial<Ports> = {}) {
  const collecter = vi.fn(async () => CONTEXTE)
  const envois: CorpsRetour[] = []
  const envoyer = vi.fn(async (corps: CorpsRetour): Promise<Resultat> => {
    envois.push(corps)
    return { ok: true, retour: 'ret_1' }
  })

  // ⚠️ Le montage passe par `act` : sans lui, les effets de Preact sont
  //    programmés par `requestAnimationFrame`, que `act` n’intercepte que
  //    pendant son propre appel. `brancher` ne serait alors jamais branché.
  let montage!: ReturnType<typeof monter>
  void act(() => {
    montage = monter(CONFIGURATION, { ports: { collecter, envoyer, ...remplacements } })
  })

  const racine = racines[0]
  if (!racine) throw new Error('aucune racine fantôme')

  return {
    montage,
    racine,
    collecter,
    envoyer,
    envois,
    hote: document.querySelector('feedys-widget') as HTMLElement,
    trouver: <T extends Element>(selecteur: string) => racine.querySelector<T>(selecteur),
  }
}

const lanceurDe = (racine: ShadowRoot) => racine.querySelector<HTMLButtonElement>('.lanceur')!
const champDe = (racine: ShadowRoot) => racine.querySelector<HTMLTextAreaElement>('.champ')!

/**
 * ⚠️ Un tour de manège pour laisser les promesses aboutir : `act` vide la file
 *    de rendu, mais l’envoi enchaîne deux `await` avant de poser son état.
 */
async function calmer(): Promise<void> {
  await act(async () => {
    for (let tour = 0; tour < 6; tour += 1) await Promise.resolve()
  })
}

async function ouvrir(racine: ShadowRoot): Promise<void> {
  await act(async () => {
    lanceurDe(racine).click()
  })
  await calmer()
}

async function cliquerEnvoyer(racine: ShadowRoot): Promise<void> {
  await act(async () => {
    racine.querySelector<HTMLButtonElement>('.envoyer')!.click()
  })
  await calmer()
}

async function ecrire(racine: ShadowRoot, texte: string): Promise<void> {
  const champ = champDe(racine)
  await act(async () => {
    champ.value = texte
    champ.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function touche(cible: Element, key: string, shiftKey = false): void {
  cible.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true }))
}

describe('monter — l’isolation', () => {
  it('pose un <feedys-widget> et un shadow DOM FERMÉ', () => {
    const { hote } = installer()

    expect(hote).not.toBeNull()
    expect(modes).toEqual(['closed'])
    // ⛔ Fermé : aucun script de l’hôte ne lit, ne style ni ne déplace nos nœuds.
    expect(hote.shadowRoot).toBeNull()
  })

  it('verrouille l’élément hôte en ligne et en !important', () => {
    const { hote } = installer()

    // ⚠️ Une feuille d’auteur `* { position: static !important }` — il en existe —
    //    décrocherait le widget de son ancrage sans cette précaution.
    expect(hote.style.getPropertyValue('position')).toBe('fixed')
    expect(hote.style.getPropertyPriority('position')).toBe('important')
    expect(hote.style.getPropertyPriority('transform')).toBe('important')
    expect(hote.style.getPropertyValue('transform')).toBe('none')
    expect(Number(hote.style.getPropertyValue('z-index'))).toBeGreaterThan(9999)
    // L’élément lui-même n’intercepte rien : il n’a pas de surface.
    expect(hote.style.getPropertyValue('pointer-events')).toBe('none')
  })

  it('emporte tout avec lui quand on le démonte', () => {
    const { montage } = installer()

    montage.demonter()

    expect(document.querySelector('feedys-widget')).toBeNull()
  })
})

describe('FERMÉ — le lanceur', () => {
  it('ne montre que le lanceur, avec son libellé', () => {
    const { racine, trouver } = installer()

    expect(trouver('.panneau')).toBeNull()
    expect(lanceurDe(racine).textContent).toContain('Un retour')
    expect(lanceurDe(racine).getAttribute('aria-expanded')).toBe('false')
  })

  // ⛔ « Le premier appel réseau a lieu quand on CLIQUE, pas au chargement »
  //    (01-Specs/widget.md §1). La capture, donc snapdom, est dans `collecter`.
  it('ne demande rien à personne avant le premier clic', () => {
    const { collecter, envoyer } = installer()

    expect(collecter).not.toHaveBeenCalled()
    expect(envoyer).not.toHaveBeenCalled()
  })

  it('ne s’ouvre pas tout seul', async () => {
    const { trouver } = installer()

    await act(async () => {})

    expect(trouver('.panneau')).toBeNull()
  })
})

describe('OUVERT — l’accueil', () => {
  it('ouvre au clic, collecte le contexte à cet instant, et pose le focus dans le champ', async () => {
    const { racine, collecter } = installer()

    await ouvrir(racine)

    expect(racine.querySelector('.panneau')).not.toBeNull()
    expect(collecter).toHaveBeenCalledTimes(1)
    expect(racine.activeElement).toBe(champDe(racine))
    expect(lanceurDe(racine).getAttribute('aria-expanded')).toBe('true')
  })

  it('est une boîte de dialogue modale correctement annoncée', async () => {
    const { racine, trouver } = installer()

    await ouvrir(racine)

    const panneau = trouver('.panneau')!
    expect(panneau.getAttribute('role')).toBe('dialog')
    expect(panneau.getAttribute('aria-modal')).toBe('true')
    expect(racine.querySelector(`#${panneau.getAttribute('aria-labelledby')}`)?.textContent).toContain(
      'Qu’est-ce qui se passe ?',
    )
  })

  it('Échap ferme et rend le focus au lanceur', async () => {
    const { racine } = installer()

    await ouvrir(racine)
    await act(async () => {
      touche(champDe(racine), 'Escape')
    })

    expect(racine.querySelector('.panneau')).toBeNull()
    expect(racine.activeElement).toBe(lanceurDe(racine))
  })

  it('piège le focus : Tab depuis le dernier revient au premier, et l’inverse', async () => {
    const { racine, trouver } = installer()

    await ouvrir(racine)
    await ecrire(racine, 'le tri par date se remet à zéro')

    const fermer = trouver<HTMLButtonElement>('.fermer')!
    const envoyer = trouver<HTMLButtonElement>('.envoyer')!

    envoyer.focus()
    await act(async () => {
      touche(envoyer, 'Tab')
    })
    expect(racine.activeElement).toBe(fermer)

    await act(async () => {
      touche(fermer, 'Tab', true)
    })
    expect(racine.activeElement).toBe(envoyer)
  })

  it('n’envoie rien tant que le champ est vide', async () => {
    const { racine, trouver } = installer()

    await ouvrir(racine)

    expect(trouver<HTMLButtonElement>('.envoyer')!.disabled).toBe(true)
  })
})

describe('ENVOYÉ — l’accusé', () => {
  it('envoie le texte avec son contexte, déclare source « texte », puis se ferme', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { racine, envois, trouver } = installer()

    await ouvrir(racine)
    await ecrire(racine, '  le tri par date se remet à zéro  ')
    await cliquerEnvoyer(racine)

    expect(envois).toEqual([
      {
        texte: 'le tri par date se remet à zéro',
        // ⚠️ Pas décoratif : c’est la mesure du pari du produit.
        source: 'texte',
        contexte: CONTEXTE,
      },
    ])

    // ⛔ Pas de numéro de suivi, pas de « vous serez notifié ».
    expect(trouver('.accuse')?.textContent).toContain('C’est parti.')
    expect(trouver('.accuse')?.textContent).not.toMatch(/ret_1|suivi|notifi/)

    await act(async () => {
      vi.advanceTimersByTime(2_000)
    })

    expect(trouver('.panneau')).toBeNull()
  })

  it('repart d’un champ vide au retour suivant', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { racine } = installer()

    await ouvrir(racine)
    await ecrire(racine, 'quelque chose')
    await cliquerEnvoyer(racine)
    await act(async () => {
      vi.advanceTimersByTime(2_000)
    })
    await ouvrir(racine)

    expect(champDe(racine).value).toBe('')
  })
})

describe('L’envoi qui rate', () => {
  it('garde le brouillon, le dit, et ne perd pas un mot', async () => {
    const { racine, trouver } = installer({
      envoyer: async (): Promise<Resultat> => ({
        ok: false,
        message: 'Pas de connexion. Votre retour part dès qu’elle revient.',
        reessayable: true,
      }),
    })

    await ouvrir(racine)
    await ecrire(racine, 'le tri par date se remet à zéro')
    await cliquerEnvoyer(racine)

    expect(champDe(racine).value).toBe('le tri par date se remet à zéro')
    expect(trouver('.avis')?.textContent).toContain('Pas de connexion')
    // L’avis est annoncé, pas seulement affiché.
    expect(trouver('.avis')?.getAttribute('role')).toBe('status')
  })

  // ⚠️ « Il conserve le brouillon en cours et le renvoie à la reconnexion, sans
  //    rien demander » (01-Specs/widget.md §Ce que le widget ne fait jamais).
  it('repart tout seul quand la connexion revient', async () => {
    let enLigne = false
    const envois: CorpsRetour[] = []
    const envoyer = vi.fn(async (corps: CorpsRetour): Promise<Resultat> => {
      envois.push(corps)
      return enLigne ? { ok: true, retour: 'ret_2' } : { ok: false, message: 'hors ligne', reessayable: true }
    })

    const { racine, trouver } = installer({ envoyer, enLigne: () => enLigne })

    await ouvrir(racine)
    await ecrire(racine, 'le tri par date se remet à zéro')
    await cliquerEnvoyer(racine)
    expect(envois).toHaveLength(1)

    enLigne = true
    await act(async () => {
      globalThis.dispatchEvent(new Event('online'))
    })
    await calmer()

    expect(envois).toHaveLength(2)
    expect(envois[1]?.texte).toBe('le tri par date se remet à zéro')
    // Le brouillon est parti : c’est l’accusé qui occupe le panneau, plus le champ.
    expect(trouver('.accuse')?.textContent).toContain('C’est parti.')
    expect(trouver('.champ')).toBeNull()
  })
})

describe('window.feedys', () => {
  it('rend de quoi ouvrir et fermer depuis l’hôte', async () => {
    const { montage, racine } = installer()

    await act(async () => {
      montage.commandes.ouvrir()
    })
    expect(racine.querySelector('.panneau')).not.toBeNull()

    await act(async () => {
      montage.commandes.fermer()
    })
    expect(racine.querySelector('.panneau')).toBeNull()
  })
})

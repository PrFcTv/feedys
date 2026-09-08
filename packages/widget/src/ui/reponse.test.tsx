// @vitest-environment happy-dom
/**
 * Les tests de restitution du retour au collaborateur (P-020).
 *
 * Vérifie :
 * - La pastille discrète sur le lanceur en présence de réponses non lues ;
 * - L’affichage de la carte de notification sobre à l’ouverture ;
 * - L’accusé de réception (« J’ai vu ») et la disparition de la carte ;
 * - L’absence stricte de tout champ de réponse ou de fil de discussion.
 */
import { act } from 'preact/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Configuration } from '../configuration'
import type { ReponseCollaborateur } from '../contrat'
import { monter } from '../montage'
import { FEUILLE } from './styles'

const CONFIGURATION: Configuration = {
  cle: 'fdy_pub_a1b2c3',
  origine: 'https://feedys.exemple.fr',
  position: 'bas-droite',
}

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

describe('Restitution du retour au collaborateur dans le widget', () => {
  it('affiche une pastille discrète sur le lanceur fermé si une réponse attend', async () => {
    const reponses: ReponseCollaborateur[] = [
      {
        id: 'ret_123',
        titre: 'Bouton de validation inactif',
        statut: 'traite',
        reponseTexte: 'Corrigé dans la version déployée ce matin.',
        reponseEnvoyeeLe: '2026-09-07T10:00:00.000Z',
      },
    ]

    let montage!: ReturnType<typeof monter>
    await act(async () => {
      montage = monter(CONFIGURATION, {
        ports: {
          releverReponses: async () => reponses,
          accuserReception: async () => true,
        },
      })
    })
    await calmer()

    const racine = racines[0]!
    const pastille = racine.querySelector('.lanceur__pastille')
    expect(pastille).not.toBeNull()

    montage.demonter()
  })

  it('n’affiche aucune pastille sur le lanceur si aucune réponse n’attend', async () => {
    let montage!: ReturnType<typeof monter>
    await act(async () => {
      montage = monter(CONFIGURATION, {
        ports: {
          releverReponses: async () => [],
          accuserReception: async () => true,
        },
      })
    })
    await calmer()

    const racine = racines[0]!
    const pastille = racine.querySelector('.lanceur__pastille')
    expect(pastille).toBeNull()

    montage.demonter()
  })

  it('affiche la carte de notification sobre avec titre et message à l’ouverture', async () => {
    const reponses: ReponseCollaborateur[] = [
      {
        id: 'ret_123',
        titre: 'Bouton de validation inactif',
        statut: 'traite',
        reponseTexte: 'Corrigé dans la version déployée ce matin.',
        reponseEnvoyeeLe: '2026-09-07T10:00:00.000Z',
      },
    ]

    let montage!: ReturnType<typeof monter>
    await act(async () => {
      montage = monter(CONFIGURATION, {
        ports: {
          releverReponses: async () => reponses,
          accuserReception: async () => true,
        },
      })
    })
    await calmer()

    const racine = racines[0]!
    await ouvrir(racine)

    const notification = racine.querySelector('.notification')
    expect(notification).not.toBeNull()

    const titre = notification?.querySelector('.notification__titre')
    expect(titre?.textContent).toBe('Votre retour sur « Bouton de validation inactif » a été pris en compte.')

    const texte = notification?.querySelector('.notification__texte')
    expect(texte?.textContent).toBe('Corrigé dans la version déployée ce matin.')

    const action = notification?.querySelector('.notification__action')
    expect(action?.textContent).toBe('J’ai vu')

    montage.demonter()
  })

  it('cliquer sur « J’ai vu » accuse réception et retire la notification', async () => {
    const accuserSpy = vi.fn(async () => true)
    const reponses: ReponseCollaborateur[] = [
      {
        id: 'ret_123',
        titre: 'Bouton de validation inactif',
        statut: 'traite',
        reponseTexte: 'Corrigé ce matin.',
        reponseEnvoyeeLe: '2026-09-07T10:00:00.000Z',
      },
    ]

    let montage!: ReturnType<typeof monter>
    await act(async () => {
      montage = monter(CONFIGURATION, {
        ports: {
          releverReponses: async () => reponses,
          accuserReception: accuserSpy,
        },
      })
    })
    await calmer()

    const racine = racines[0]!
    await ouvrir(racine)

    const action = racine.querySelector<HTMLButtonElement>('.notification__action')!
    expect(action).not.toBeNull()

    await act(async () => {
      action.click()
    })
    await calmer()

    expect(accuserSpy).toHaveBeenCalledWith('ret_123')
    expect(racine.querySelector('.notification')).toBeNull()

    montage.demonter()
  })

  it('la carte est strictement à sens unique (aucun champ de réponse)', async () => {
    const reponses: ReponseCollaborateur[] = [
      {
        id: 'ret_456',
        titre: null,
        statut: 'ecarte',
        reponseTexte: null,
        reponseEnvoyeeLe: '2026-09-07T10:00:00.000Z',
      },
    ]

    let montage!: ReturnType<typeof monter>
    await act(async () => {
      montage = monter(CONFIGURATION, {
        ports: {
          releverReponses: async () => reponses,
          accuserReception: async () => true,
        },
      })
    })
    await calmer()

    const racine = racines[0]!
    await ouvrir(racine)

    const notification = racine.querySelector('.notification')!
    expect(notification).not.toBeNull()

    // ⛔ Seul un bouton d’acquittement existe dans la carte.
    const boutons = notification.querySelectorAll('button')
    expect(boutons.length).toBe(1)
    expect(boutons[0]?.textContent).toBe('J’ai vu')

    // ⛔ Aucun champ texte ou textarea dans la notification.
    expect(notification.querySelectorAll('input, textarea').length).toBe(0)

    montage.demonter()
  })
})

/**
 * ⛔ Le défaut que ces trois assertions ferment, et pourquoi il est passif.
 *
 * La première version de P-020 déclarait `.notification__bouton` dans la
 * feuille et rendait `class="notification__action"` dans le JSX. Le bouton
 * « J’ai vu » partait donc AVEC LE STYLE PAR DÉFAUT DU NAVIGATEUR, dans le
 * shadow DOM de quelqu’un d’autre — et tous les tests passaient, parce qu’ils
 * interrogeaient la classe du JSX, jamais celle de la feuille.
 *
 * ⚠️ C’est la classe de défauts que `pnpm widget:demo` existe pour attraper
 *    (CLAUDE.md §Le widget ne se recette pas chez lui) — mais rien n’oblige à
 *    l’ouvrir. Ceci si.
 */
describe('⛔ les classes rendues sont celles que la feuille déclare', () => {
  for (const classe of ['notification', 'notification__titre', 'notification__texte', 'notification__action', 'lanceur__pastille']) {
    it(`.${classe} est stylée`, () => {
      expect(FEUILLE).toContain(`.${classe} {`)
    })
  }
})

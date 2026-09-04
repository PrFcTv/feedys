// @vitest-environment happy-dom
/**
 * La collecte, en entier.
 *
 * ⛔ Deux blocs de ce fichier sont des garde-fous de produit, pas des tests de
 *    confort : « la liste est close » et « rien n’est écrit nulle part ». Le
 *    dépôt est public, et ces deux promesses sont ce qui permet de le lire sans
 *    gêne (01-Specs/widget.md).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { analyserCorpsRetour } from '../contrat'

import type { RendreEnToile } from './capture'
import { collecter, lireContexte, oublierSnapdom } from './index'

const AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'

/** Une capture bouchon qui réussit. */
const CAPTURE_OK: RendreEnToile = async () => ({
  width: 800,
  toDataURL: (type: string) => `data:${type};base64,AAAA`,
})

/** Une capture bouchon qui échoue, comme sur un canvas « tainted ». */
const CAPTURE_KO: RendreEnToile = async () => {
  throw new Error('canvas tainted')
}

function fenetreFeinte(url = 'https://victoria.exemple.fr/dossiers/4271?tri=date'): Window {
  document.title = 'Dossiers — VictorIA'
  document.body.innerHTML = '<main><button data-testid="tri-date">Date</button></main>'

  return {
    location: { href: url },
    document,
    navigator: { userAgent: AGENT, language: 'fr-FR' },
    innerWidth: 1920,
    innerHeight: 1080,
    devicePixelRatio: 2,
  } as unknown as Window
}

afterEach(() => {
  oublierSnapdom()
  document.body.innerHTML = ''
})

describe('lireContexte', () => {
  it('lit tout ce que la liste close autorise, et le rend au format du contrat', () => {
    const fenetre = fenetreFeinte()
    const cible = document.querySelector('button')

    const contexte = lireContexte({ fenetre, cible })

    expect(contexte).toMatchObject({
      url: 'https://victoria.exemple.fr/dossiers/4271?tri=date',
      titrePage: 'Dossiers — VictorIA',
      ecran: 'dossiers',
      selecteurDom: '[data-testid="tri-date"]',
      navigateur: 'Chrome 141',
      systeme: 'Windows',
      viewportL: 1920,
      viewportH: 1080,
    })
    expect(contexte.horodatage).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(contexte.agentBrut).toEqual({ userAgent: AGENT, langue: 'fr-FR', densitePixels: 2 })
  })

  it('⛔ la liste est CLOSE — aucun champ hors de 01-Specs/widget.md', () => {
    const contexte = lireContexte({ fenetre: fenetreFeinte() })

    expect(Object.keys(contexte).sort()).toEqual(
      [
        'agentBrut',
        'ecran',
        'fuseau',
        'horodatage',
        'navigateur',
        'selecteurDom',
        'systeme',
        'titrePage',
        'url',
        'viewportH',
        'viewportL',
      ].sort(),
    )
  })

  it('expurge l’URL — un jeton de session n’a rien à faire dans un retour', () => {
    const fenetre = fenetreFeinte('https://victoria.exemple.fr/dossiers?token=abcdef123456')

    expect(lireContexte({ fenetre }).url).not.toContain('abcdef123456')
  })

  it('⚠️ échec doux, champ par champ : une lecture qui lève n’emporte pas le reste', () => {
    const cassee = {
      get location(): never {
        throw new Error('accès refusé')
      },
      document,
      navigator: { userAgent: AGENT },
      innerWidth: 1920,
      innerHeight: 1080,
    } as unknown as Window

    const contexte = lireContexte({ fenetre: cassee })

    expect(contexte.navigateur).toBe('Chrome 141')
    expect(contexte.url).toBe('')
  })

  it('ne rend jamais un champ vide plutôt qu’absent', () => {
    document.title = '   '
    const fenetre = fenetreFeinte()
    document.title = ''

    expect(lireContexte({ fenetre }).titrePage).toBeUndefined()
  })
})

describe('collecter', () => {
  it('joint la capture quand elle réussit', async () => {
    const contexte = await collecter({
      fenetre: fenetreFeinte(),
      capture: { rendre: CAPTURE_OK },
    })

    expect(contexte.capture).toEqual({ type: 'image/webp', donnees: 'AAAA' })
  })

  it('⛔ capture en échec → le contexte part quand même, sans image', async () => {
    const contexte = await collecter({
      fenetre: fenetreFeinte(),
      capture: { rendre: CAPTURE_KO },
    })

    expect(contexte.capture).toBeUndefined()
    expect(contexte.url).toContain('victoria.exemple.fr')
    expect(analyserCorpsRetour({ texte: 'x', contexte }).ok).toBe(true)
  })

  it('⛔ capture DÉSACTIVÉE → l’envoi fonctionne exactement pareil', async () => {
    const contexte = await collecter({ fenetre: fenetreFeinte(), capture: false })

    expect(contexte.capture).toBeUndefined()
    expect(analyserCorpsRetour({ texte: 'x', contexte }).ok).toBe(true)
  })

  it('ne rejette jamais — la coquille l’appelle sans try', async () => {
    await expect(
      collecter({ fenetre: undefined, capture: { rendre: CAPTURE_KO } }),
    ).resolves.toBeDefined()
  })

  it('produit toujours un contexte que le serveur accepte', async () => {
    const contexte = await collecter({
      fenetre: fenetreFeinte(),
      cible: document.querySelector('button'),
      capture: { rendre: CAPTURE_OK },
    })

    expect(analyserCorpsRetour({ texte: 'le tri se remet à zéro', contexte }).ok).toBe(true)
  })
})

describe('⛔ ce que la collecte n’écrit nulle part', () => {
  let ecritures: string[]

  beforeEach(() => {
    ecritures = []
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((cle) => {
      ecritures.push(String(cle))
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('n’écrit rien en localStorage ni en sessionStorage', async () => {
    await collecter({
      fenetre: fenetreFeinte(),
      cible: document.querySelector('button'),
      capture: { rendre: CAPTURE_OK },
    })

    expect(ecritures).toEqual([])
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
  })

  it('ne pose aucun cookie', async () => {
    await collecter({ fenetre: fenetreFeinte(), capture: false })

    expect(document.cookie).toBe('')
  })

  it('⛔ ne joint aucun texte de la page — ni celui visé, ni celui d’à côté', async () => {
    document.body.innerHTML =
      '<main><p class="montant">IBAN FR76 3000 4000 0500</p><button id="valider">Valider</button></main>'

    const contexte = await collecter({
      fenetre: fenetreFeinte(),
      cible: document.querySelector('#valider'),
      capture: false,
    })

    expect(JSON.stringify(contexte)).not.toContain('IBAN')
    expect(JSON.stringify(contexte)).not.toContain('Valider')
  })
})

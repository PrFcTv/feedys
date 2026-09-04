/**
 * L’entretien côté widget : le transport, et le rendu des corrections.
 *
 * ⛔ Ce qu’on prouve ici : le widget NE COMPTE RIEN. Il n’a ni compteur de
 *    relances, ni notion de limite — il lit `question`, et `null` veut dire que
 *    c’est fini. Le verrou est côté serveur (01-Specs/entretien.md §2).
 */
import { describe, expect, it, vi } from 'vitest'

import type { Comprehension } from './contrat'
import { demanderTour, rendreCorrections, terminer } from './entretien'
import { EN_TETE_CLE, cheminFin, cheminTour } from './transport'

const BASE = { origine: 'https://feedys.exemple.fr', cle: 'fdy_pub_a1b2c3', retour: 'ret_1' } as const

/** ⚠️ Écrite à la main. ⛔ Jamais un vrai retour copié d’une base (CLAUDE.md §Secrets). */
const CARTE: Comprehension = {
  type: 'bug',
  titre: 'Le tri par date se réinitialise au retour sur la page',
  resume: 'La personne repose le tri à chaque navigation.',
  ecran: 'Liste des dossiers',
}

function repondre(statut: number, corps: unknown): typeof globalThis.fetch {
  return vi.fn(async () =>
    new Response(JSON.stringify(corps), {
      status: statut,
      headers: { 'content-type': 'application/json' },
    }),
  ) as unknown as typeof globalThis.fetch
}

describe('demanderTour', () => {
  it('poste sur le chemin du tour, avec la clé, et sans cookie', async () => {
    const appels: [string, RequestInit | undefined][] = []
    const fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      appels.push([String(url), init])
      return new Response(JSON.stringify({ comprehension: CARTE, question: null, motif: 'assez' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as unknown as typeof globalThis.fetch

    await demanderTour({ ...BASE, fetch, corps: { texte: 'oui' } })

    const [url, init] = appels[0]!
    expect(url).toBe(`https://feedys.exemple.fr${cheminTour('ret_1')}`)
    expect((init?.headers as Record<string, string>)[EN_TETE_CLE]).toBe('fdy_pub_a1b2c3')
    // ⛔ Aucun cookie, aucun identifiant de visiteur.
    expect(init?.credentials).toBe('omit')
    expect(init?.body).toBe(JSON.stringify({ texte: 'oui' }))
  })

  it('rend la carte et la question telles quelles', async () => {
    const resultat = await demanderTour({
      ...BASE,
      fetch: repondre(200, { comprehension: CARTE, question: 'C’est nouveau ?', motif: 'la récurrence' }),
    })

    expect(resultat).toEqual({
      ok: true,
      tour: { comprehension: CARTE, question: 'C’est nouveau ?', motif: 'la récurrence' },
    })
  })

  it('accepte une carte absente — le transcript n’était pas intelligible', async () => {
    const resultat = await demanderTour({
      ...BASE,
      fetch: repondre(200, { comprehension: null, question: 'Vous pouvez redire ?', motif: 'vide' }),
    })

    expect(resultat).toEqual({
      ok: true,
      tour: { comprehension: null, question: 'Vous pouvez redire ?', motif: 'vide' },
    })
  })

  it.each([
    ['un modèle muet', 503, { motif: 'modele_indisponible', message: 'Le bot n’est pas joignable.' }],
    ['un entretien clos', 409, { motif: 'entretien_clos', message: 'Cet entretien est terminé.' }],
    ['un corps qui n’a pas la bonne forme', 200, { comprehension: { type: 'inconnu' }, question: null }],
  ])('⛔ %s ne casse rien : pas de carte, et rien à dire', async (_cas, statut, corps) => {
    const resultat = await demanderTour({ ...BASE, fetch: repondre(statut, corps) })

    expect(resultat).toEqual({ ok: false })
  })

  it('⛔ un réseau coupé non plus — le retour est déjà en base', async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    }) as unknown as typeof globalThis.fetch

    expect(await demanderTour({ ...BASE, fetch })).toEqual({ ok: false })
  })
})

describe('terminer', () => {
  it('poste la raison sur le chemin de fin', async () => {
    const appels: [string, RequestInit | undefined][] = []
    const fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      appels.push([String(url), init])
      return new Response(JSON.stringify({ statut: 'envoye' }), { status: 200 })
    }) as unknown as typeof globalThis.fetch

    expect(await terminer({ ...BASE, fetch, corps: { raison: 'envoi' } })).toBe(true)
    expect(appels[0]?.[0]).toBe(`https://feedys.exemple.fr${cheminFin('ret_1')}`)
  })

  /**
   * ⛔ Sans `keepalive`, le navigateur annule la requête au moment où la page se
   *    ferme — et l’abandon ne serait jamais enregistré. Le retour resterait
   *    `en_cours` pour toujours.
   */
  it('garde la requête en vie quand la page se ferme', async () => {
    const appels: RequestInit[] = []
    const fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      if (init) appels.push(init)
      return new Response(JSON.stringify({ statut: 'abandonne' }), { status: 200 })
    }) as unknown as typeof globalThis.fetch

    await terminer({ ...BASE, fetch, corps: { raison: 'abandon' }, garderEnVie: true })

    expect(appels[0]?.keepalive).toBe(true)
  })
})

describe('rendreCorrections', () => {
  it('ne rend rien quand rien n’a changé — une ligne vide polluerait le fil', () => {
    expect(rendreCorrections(CARTE, { ...CARTE })).toBe('')
  })

  it('nomme le champ et donne la nouvelle valeur, en clair', () => {
    expect(rendreCorrections(CARTE, { ...CARTE, ecran: 'Liste des mandats' })).toBe(
      'Écran — Liste des mandats',
    )
  })

  it('traduit les valeurs de code : personne ne dit « idee » ni « deja_vu »', () => {
    const corrige: Comprehension = { ...CARTE, type: 'idee', recurrence: 'deja_vu' }

    expect(rendreCorrections(CARTE, corrige)).toBe('Type — Une idée · Depuis — déjà vu')
  })

  it('dit qu’un champ a été vidé plutôt que de faire comme s’il n’avait pas bougé', () => {
    expect(rendreCorrections(CARTE, { ...CARTE, ecran: '' })).toBe('Écran — (vide)')
  })

  it('joint plusieurs corrections en une seule ligne', () => {
    const corrige: Comprehension = { ...CARTE, titre: 'Le tri saute', ecran: 'Mandats' }

    expect(rendreCorrections(CARTE, corrige)).toBe('Titre — Le tri saute · Écran — Mandats')
  })
})

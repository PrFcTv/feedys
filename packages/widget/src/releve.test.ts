import { describe, expect, it, vi } from 'vitest'

import { CHEMIN_COLLABORATEUR, EN_TETE_CLE, EN_TETE_IDENTITE, cheminAccuse } from './transport'
import { accuser, relever } from './releve'

describe('relever', () => {
  it('envoie un GET avec les bons en-têtes et extrait les retours', async () => {
    const retoursAttendus = [
      {
        id: 'ret_1',
        titre: 'Bug calcul',
        statut: 'traite',
        reponseTexte: 'Corrigé',
        reponseEnvoyeeLe: '2026-09-07T10:00:00Z',
      },
    ]

    const fauxFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ retours: retoursAttendus }),
    })

    const resultat = await relever({
      origine: 'https://feedys.exemple.fr',
      cle: 'fdy_pub_test',
      identite: 'jeton_signe_123',
      fetch: fauxFetch as unknown as typeof globalThis.fetch,
    })

    expect(fauxFetch).toHaveBeenCalledWith('https://feedys.exemple.fr' + CHEMIN_COLLABORATEUR, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      headers: {
        [EN_TETE_CLE]: 'fdy_pub_test',
        [EN_TETE_IDENTITE]: 'jeton_signe_123',
      },
    })
    expect(resultat).toEqual(retoursAttendus)
  })

  it('rend une liste vide en cas d’échec HTTP ou exception', async () => {
    const fauxFetchEchec = vi.fn().mockResolvedValue({ ok: false })
    const res1 = await relever({
      origine: 'https://feedys.exemple.fr',
      cle: 'fdy_pub_test',
      fetch: fauxFetchEchec as unknown as typeof globalThis.fetch,
    })
    expect(res1).toEqual([])

    const fauxFetchReseau = vi.fn().mockRejectedValue(new Error('Réseau coupé'))
    const res2 = await relever({
      origine: 'https://feedys.exemple.fr',
      cle: 'fdy_pub_test',
      fetch: fauxFetchReseau as unknown as typeof globalThis.fetch,
    })
    expect(res2).toEqual([])
  })
})

describe('accuser', () => {
  it('envoie un POST vers cheminAccuse avec les bons en-têtes', async () => {
    const fauxFetch = vi.fn().mockResolvedValue({ ok: true })

    const resultat = await accuser({
      origine: 'https://feedys.exemple.fr',
      cle: 'fdy_pub_test',
      retourId: 'ret_42',
      identite: 'jeton_signe_123',
      fetch: fauxFetch as unknown as typeof globalThis.fetch,
    })

    expect(fauxFetch).toHaveBeenCalledWith('https://feedys.exemple.fr' + cheminAccuse('ret_42'), {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      headers: {
        [EN_TETE_CLE]: 'fdy_pub_test',
        [EN_TETE_IDENTITE]: 'jeton_signe_123',
      },
    })
    expect(resultat).toBe(true)
  })

  it('rend false en cas d’erreur réseau', async () => {
    const fauxFetch = vi.fn().mockRejectedValue(new Error('Crash'))
    const resultat = await accuser({
      origine: 'https://feedys.exemple.fr',
      cle: 'fdy_pub_test',
      retourId: 'ret_42',
      fetch: fauxFetch as unknown as typeof globalThis.fetch,
    })
    expect(resultat).toBe(false)
  })
})

describe('⛔ la relève n’appelle pas dans le vide', () => {
  it('sans jeton d’identité, elle ne fait AUCUNE requête', async () => {
    const appels = vi.fn()

    const retours = await relever({
      origine: 'https://feedys.exemple.fr',
      cle: 'fdy_pub_a1b2c3',
      fetch: appels as unknown as typeof globalThis.fetch,
    })

    // ⚠️ Le serveur rend `[]` pour un anonyme : l’appel n’apprendrait rien et
    //    partirait pourtant à chaque chargement de page de l’hôte, visiteur de
    //    passage compris.
    expect(appels).not.toHaveBeenCalled()
    expect(retours).toEqual([])
  })

  it('sans jeton d’identité, l’accusé non plus — ce serait un 401 garanti', async () => {
    const appels = vi.fn()

    const ok = await accuser({
      origine: 'https://feedys.exemple.fr',
      cle: 'fdy_pub_a1b2c3',
      retourId: 'ret_1',
      fetch: appels as unknown as typeof globalThis.fetch,
    })

    expect(appels).not.toHaveBeenCalled()
    expect(ok).toBe(false)
  })
})

describe('⛔ ce qui revient du réseau est VÉRIFIÉ, pas recopié', () => {
  function fauxFetch(corps: unknown): typeof globalThis.fetch {
    return (async () =>
      new Response(JSON.stringify(corps), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })) as unknown as typeof globalThis.fetch
  }

  async function releverAvec(corps: unknown) {
    return relever({
      origine: 'https://feedys.exemple.fr',
      cle: 'fdy_pub_a1b2c3',
      identite: 'jeton.signe.par.hote',
      fetch: fauxFetch(corps),
    })
  }

  const VALIDE = {
    id: 'ret_1',
    titre: 'Bouton inactif',
    statut: 'traite',
    reponseTexte: 'Corrigé ce matin.',
    reponseEnvoyeeLe: '2026-09-07T08:30:00.000Z',
  }

  it('laisse passer une entrée conforme', async () => {
    expect(await releverAvec({ retours: [VALIDE] })).toEqual([VALIDE])
  })

  it('jette une entrée dont le titre n’est pas du texte', async () => {
    // ⚠️ Sans ce filtre, `titre.trim()` cassait au rendu — dans la page de
    //    quelqu’un d’autre, où rien ne dit d’où vient l’erreur.
    expect(await releverAvec({ retours: [{ ...VALIDE, titre: 42 }] })).toEqual([])
  })

  it('jette une entrée sans identifiant, et garde les autres', async () => {
    const sansId = { ...VALIDE, id: '' }

    expect(await releverAvec({ retours: [sansId, VALIDE] })).toEqual([VALIDE])
  })

  it('accepte un titre nul — un retour peut n’en avoir aucun', async () => {
    const anonyme = { ...VALIDE, titre: null, reponseTexte: null }

    expect(await releverAvec({ retours: [anonyme] })).toEqual([anonyme])
  })
})

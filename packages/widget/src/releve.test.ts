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

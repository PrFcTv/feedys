import { describe, expect, it, vi } from 'vitest'

import type { CorpsRetour } from './contrat'
import { envoyer } from './envoi'
import { EN_TETE_CLE } from './transport'

const CORPS: CorpsRetour = {
  texte: 'le tri par date se remet à zéro quand je reviens en arrière',
  source: 'texte',
  contexte: { url: 'https://victoria.exemple.fr/dossiers' },
}

function reponse(statut: number, corps: unknown): Response {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { 'content-type': 'application/json' },
  })
}

describe('envoyer', () => {
  it('poste le corps avec la clé, sans cookie, vers l’origine Feedys', async () => {
    const appel = vi.fn().mockResolvedValue(reponse(201, { retour: 'ret_abc' }))

    const resultat = await envoyer({
      origine: 'https://feedys.exemple.fr',
      cle: 'fdy_pub_a1b2c3',
      corps: CORPS,
      fetch: appel,
    })

    expect(resultat).toEqual({ ok: true, retour: 'ret_abc' })

    const [url, options] = appel.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://feedys.exemple.fr/api/retours')
    expect(options.method).toBe('POST')
    // ⛔ Aucun cookie, aucun identifiant de visiteur : la liste de ce que Feedys
    //    collecte est close (01-Specs/widget.md).
    expect(options.credentials).toBe('omit')
    expect((options.headers as Record<string, string>)[EN_TETE_CLE]).toBe('fdy_pub_a1b2c3')
    expect(JSON.parse(String(options.body))).toEqual(CORPS)
  })

  it('reprend le message du serveur — il est en français et ne dit rien de son intérieur', async () => {
    const appel = vi
      .fn()
      .mockResolvedValue(reponse(403, { motif: 'origine_refusee', message: 'Ce retour ne vient pas d’ici.' }))

    const resultat = await envoyer({ origine: 'https://feedys.exemple.fr', cle: 'fdy_pub_a', corps: CORPS, fetch: appel })

    expect(resultat).toEqual({ ok: false, message: 'Ce retour ne vient pas d’ici.', reessayable: false })
  })

  it('ne retente pas ce qui ne passera jamais, retente ce qui passera plus tard', async () => {
    const refus = async (statut: number) =>
      envoyer({
        origine: 'https://feedys.exemple.fr',
        cle: 'fdy_pub_a',
        corps: CORPS,
        fetch: vi.fn().mockResolvedValue(reponse(statut, { motif: 'x', message: 'non' })),
      })

    expect(await refus(400)).toMatchObject({ reessayable: false })
    expect(await refus(401)).toMatchObject({ reessayable: false })
    expect(await refus(413)).toMatchObject({ reessayable: false })
    expect(await refus(429)).toMatchObject({ reessayable: true })
    expect(await refus(503)).toMatchObject({ reessayable: true })
  })

  it('traite une coupure réseau comme réessayable, sans faire de bruit', async () => {
    const resultat = await envoyer({
      origine: 'https://feedys.exemple.fr',
      cle: 'fdy_pub_a',
      corps: CORPS,
      fetch: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
    })

    expect(resultat).toEqual({
      ok: false,
      message: 'Pas de connexion. Votre retour part dès qu’elle revient.',
      reessayable: true,
    })
  })

  it('ne prend pas un 201 sans identifiant pour un succès', async () => {
    const resultat = await envoyer({
      origine: 'https://feedys.exemple.fr',
      cle: 'fdy_pub_a',
      corps: CORPS,
      fetch: vi.fn().mockResolvedValue(reponse(201, {})),
    })

    expect(resultat.ok).toBe(false)
  })
})

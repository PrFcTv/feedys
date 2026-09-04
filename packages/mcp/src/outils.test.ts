/**
 * Les trois outils, contre un client bouchonné.
 *
 * ⚠️ Test pur : aucun réseau. `creerClient` reçoit son `fetch`, et c’est
 *    exactement pour ça qu’il le reçoit.
 *
 * ⛔ Ce qui compte ici : les outils sont TROIS, et le seul qui écrit n’écrit
 *    qu’un statut.
 */
import { describe, expect, it } from 'vitest'

import { creerClient, ErreurFeedys } from './client.js'
import { CHEMIN_MCP, STATUTS_MARQUABLES } from './contrat.js'

interface Appel {
  readonly url: string
  readonly methode: string
  readonly jeton: string | null
  readonly corps: string | undefined
}

function bouchon(reponse: unknown, statut = 200) {
  const appels: Appel[] = []

  const aller: typeof fetch = async (entree, options) => {
    appels.push({
      url: String(entree),
      methode: options?.method ?? 'GET',
      jeton: new Headers(options?.headers).get('authorization'),
      corps: typeof options?.body === 'string' ? options.body : undefined,
    })

    return new Response(JSON.stringify(reponse), {
      status: statut,
      headers: { 'content-type': 'application/json' },
    })
  }

  const client = creerClient({
    origine: 'https://feedys.exemple.fr/',
    jeton: 'jeton-de-test',
    aller,
  })

  return { client, appels }
}

describe('lister_retours', () => {
  it('appelle le chemin de liste, avec le jeton en Bearer', async () => {
    const { client, appels } = bouchon({ retours: [] })

    expect(await client.lister({})).toEqual({ retours: [] })
    // ⚠️ La barre finale de l’origine est retirée : sinon l’URL porte un `//`.
    expect(appels[0]?.url).toBe(`https://feedys.exemple.fr${CHEMIN_MCP}`)
    expect(appels[0]?.methode).toBe('GET')
    expect(appels[0]?.jeton).toBe('Bearer jeton-de-test')
  })

  it('porte les filtres en paramètres d’URL', async () => {
    const { client, appels } = bouchon({ retours: [] })

    await client.lister({ statut: 'envoye', type: 'bug', zone: 'Liste', limite: 5 })

    const url = new URL(appels[0]?.url ?? '')
    expect(url.searchParams.get('statut')).toBe('envoye')
    expect(url.searchParams.get('type')).toBe('bug')
    expect(url.searchParams.get('zone')).toBe('Liste')
    expect(url.searchParams.get('limite')).toBe('5')
  })
})

describe('lire_retour', () => {
  it('rend la synthèse ET le fil brut', async () => {
    const attendu = {
      id: 'ret_1',
      fil: [{ ordre: 0, role: 'collaborateur', texte: 'le tri se remet à zéro' }],
      synthese: { titre: 'Le tri se réinitialise' },
    }
    const { client, appels } = bouchon(attendu)

    expect(await client.lire('ret_1')).toMatchObject(attendu)
    expect(appels[0]?.url).toBe(`https://feedys.exemple.fr${CHEMIN_MCP}/ret_1`)
  })

  it('échappe l’identifiant dans le chemin', async () => {
    const { client, appels } = bouchon({})
    await client.lire('a/b?c')
    expect(appels[0]?.url).toBe(`https://feedys.exemple.fr${CHEMIN_MCP}/a%2Fb%3Fc`)
  })
})

describe('marquer_retour', () => {
  it('⛔ POSTe UN STATUT, et rien d’autre', async () => {
    const { client, appels } = bouchon({ id: 'ret_1', statut: 'traite' })

    await client.marquer('ret_1', { statut: 'traite' })

    expect(appels[0]?.methode).toBe('POST')
    expect(appels[0]?.url).toBe(`https://feedys.exemple.fr${CHEMIN_MCP}/ret_1/statut`)
    // ⛔ Le corps ne porte QUE le statut : pas de titre, pas de résumé, pas de fil.
    expect(JSON.parse(appels[0]?.corps ?? '{}')).toEqual({ statut: 'traite' })
  })

  it('⛔ ne connaît que lu, traite et ecarte', () => {
    expect([...STATUTS_MARQUABLES]).toEqual(['lu', 'traite', 'ecarte'])
  })
})

describe('les refus du serveur', () => {
  it('reprennent le message du serveur, avec son code', async () => {
    const { client } = bouchon({ erreur: 'jeton_refuse', message: 'Ce jeton ne convient pas.' }, 401)

    await expect(client.lister({})).rejects.toThrow(ErreurFeedys)
    await expect(client.lister({})).rejects.toThrow('Ce jeton ne convient pas.')
  })

  it('⛔ ne laissent jamais fuir le jeton', async () => {
    const { client } = bouchon({ message: 'refusé' }, 401)

    await expect(client.lire('ret_1')).rejects.toSatisfy(
      (erreur: unknown) => !String(erreur).includes('jeton-de-test'),
    )
  })
})

/**
 * Le point d’appel au modèle — ce qu’il envoie, et ce qu’il fait d’un échec.
 *
 * ⛔ CE FICHIER EXISTE À CAUSE DE [BUGS_LOG](../../../../03-Bugs/BUGS_LOG.md) 021.
 *    Un panneau refermé sur une relance donnait un fil qui finit sur `bot` ;
 *    envoyé tel quel, il finissait sur un message `assistant`, que l’API refuse
 *    en 400. Le bouchon acceptait tout, et le 400 était compté comme une panne :
 *    huit reprises muettes, puis une alerte qui accusait le fournisseur.
 *
 * Trois choses sont prouvées ici :
 *    1. la conversation qui PART finit sur la parole — vérifié sur le corps
 *       HTTP réel du fournisseur, pas sur une fonction intermédiaire ;
 *    2. un refus de la requête n’est pas une indisponibilité, et l’inverse ;
 *    3. le bouchon refuse ce que l’API refuse.
 *
 * ⛔ Hors ligne : `fetch` est bouchonné, et la clé est inventée.
 */
import { APICallError, RetryError } from 'ai'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { TourFil } from './prompts'
import {
  RequeteInvalide,
  classerEchec,
  exigencesDuFournisseur,
  modeleBouchon,
  modeleClaude,
  refusDuFournisseur,
} from './modele'

/** ⚠️ Écrits à la main. ⛔ Jamais un vrai retour copié d’une base (CLAUDE.md §Secrets). */
const PAROLE =
  'quand je valide le formulaire de mandat la page se recharge et je perds tout ce que j’avais saisi'
const RELANCE = 'C’est arrivé depuis un moment, ou c’est nouveau ?'

const FIL_SUR_UNE_RELANCE: TourFil[] = [
  { role: 'collaborateur', texte: PAROLE },
  { role: 'bot', texte: RELANCE },
]

const PREFILL =
  'This model does not support assistant message prefill. The conversation must end with a user message.'

describe('ce que le fournisseur exige', () => {
  it('une conversation qui finit sur la parole passe', () => {
    expect(exigencesDuFournisseur([{ role: 'user', content: PAROLE }])).toBeNull()
  })

  it('⛔ une conversation qui finit sur `assistant` est refusée — le « prefill »', () => {
    expect(
      exigencesDuFournisseur([
        { role: 'user', content: PAROLE },
        { role: 'assistant', content: RELANCE },
      ]),
    ).toBe(PREFILL)
  })

  it('⛔ une conversation vide, ou qui commence par `assistant`, est refusée', () => {
    expect(exigencesDuFournisseur([])).not.toBeNull()
    expect(
      exigencesDuFournisseur([
        { role: 'assistant', content: RELANCE },
        { role: 'user', content: PAROLE },
      ]),
    ).not.toBeNull()
  })
})

describe('⛔ la classification d’un échec', () => {
  const api = (statut: number, type: string): APICallError =>
    refusDuFournisseur(statut, type, `message du fournisseur pour ${statut}`)

  it.each([
    [400, 'invalid_request_error'],
    [413, 'request_too_large'],
    [422, 'invalid_request_error'],
  ])('%i : la requête est refusée pour ce qu’elle est — `refus`', (statut, type) => {
    const echec = classerEchec(api(statut, type))

    expect(echec.nature).toBe('refus')
    expect(echec.cause).toContain(`HTTP ${statut} ${type}`)
  })

  it('le 400 de l’incident : la cause dit exactement ce que l’API a dit', () => {
    const echec = classerEchec(refusDuFournisseur(400, 'invalid_request_error', PREFILL))

    expect(echec).toEqual({
      nature: 'refus',
      cause: `HTTP 400 invalid_request_error — ${PREFILL}`,
    })
  })

  it.each([
    [500, 'api_error'],
    [529, 'overloaded_error'],
    [429, 'rate_limit_error'],
    [408, 'timeout_error'],
  ])('%i : le modèle n’a pas pu répondre maintenant — `indisponible`', (statut, type) => {
    expect(classerEchec(api(statut, type)).nature).toBe('indisponible')
  })

  it.each([
    [401, 'authentication_error'],
    [402, 'billing_error'],
    [403, 'permission_error'],
    [404, 'not_found_error'],
  ])(
    '%i : le COMPTE l’en empêche, et ça se règle sans code — `indisponible`, le filet attend',
    (statut, type) => {
      expect(classerEchec(api(statut, type)).nature).toBe('indisponible')
    },
  )

  it('délai dépassé : `indisponible`', () => {
    const delai = new DOMException('The operation was aborted due to timeout', 'TimeoutError')

    expect(classerEchec(delai)).toEqual({ nature: 'indisponible', cause: 'TimeoutError' })
  })

  it('réseau coupé — une `APICallError` sans statut : `indisponible`', () => {
    const reseau = new APICallError({
      message: 'Cannot connect to API: fetch failed',
      url: 'https://api.anthropic.com/v1/messages',
      requestBodyValues: {},
      isRetryable: true,
    })

    expect(classerEchec(reseau).nature).toBe('indisponible')
  })

  it('⚠️ après des reprises de l’AI SDK, c’est la DERNIÈRE erreur qui décide', () => {
    const surcharges = new RetryError({
      message: 'Failed after 3 attempts',
      reason: 'maxRetriesExceeded',
      errors: [api(529, 'overloaded_error'), api(529, 'overloaded_error')],
    })
    const puisRefus = new RetryError({
      message: 'Failed after 2 attempts with non-retryable error',
      reason: 'errorNotRetryable',
      errors: [api(529, 'overloaded_error'), api(400, 'invalid_request_error')],
    })

    expect(classerEchec(surcharges).nature).toBe('indisponible')
    expect(classerEchec(puisRefus).nature).toBe('refus')
  })

  it('une requête refusée AVANT l’envoi est un refus, comme le 400 qu’elle évite', () => {
    expect(classerEchec(new RequeteInvalide(PREFILL)).nature).toBe('refus')
  })

  it('⛔ une erreur quelconque : son NOM, jamais son message — il pourrait porter la parole', () => {
    const echec = classerEchec(new TypeError(`sortie hors schéma : « ${PAROLE} »`))

    expect(echec).toEqual({ nature: 'indisponible', cause: 'TypeError' })
  })

  it('la cause est bornée : elle part dans une alerte Telegram', () => {
    const echec = classerEchec(refusDuFournisseur(400, 'invalid_request_error', 'x'.repeat(2_000)))

    expect(echec.cause.length).toBeLessThanOrEqual(300)
  })
})

describe('⛔ le bouchon refuse ce que l’API refuse', () => {
  it('un fil sans aucune parole : 400, classé `refus`', async () => {
    const modele = modeleBouchon()

    const erreur = await modele
      .tour({ contexte: {}, fil: [{ role: 'bot', texte: RELANCE }], relancesRestantes: 1 })
      .then(
        () => null,
        (raison: unknown) => raison,
      )

    expect(APICallError.isInstance(erreur)).toBe(true)
    expect(classerEchec(erreur).nature).toBe('refus')
  })

  it('un fil qui finit sur une relance passe — elle n’est pas envoyée', async () => {
    const modele = modeleBouchon()

    await expect(
      modele.synthese({ contexte: {}, fil: FIL_SUR_UNE_RELANCE, fin: 'abandon' }),
    ).resolves.toMatchObject({ modele: 'bouchon' })
  })

  it('`refuseSynthese` : un 400 que le filet ne doit pas prendre pour une panne', async () => {
    const erreur = await modeleBouchon({ refuseSynthese: true })
      .synthese({ contexte: {}, fil: FIL_SUR_UNE_RELANCE, fin: 'abandon' })
      .then(
        () => null,
        (raison: unknown) => raison,
      )

    expect(classerEchec(erreur).nature).toBe('refus')
  })
})

/**
 * ⛔ LE VRAI FOURNISSEUR, AVEC UN `fetch` BOUCHONNÉ.
 *
 * ⚠️ C’est le seul endroit où l’on voit ce qui PART réellement : le corps HTTP
 *    que `@ai-sdk/anthropic` construit. Une fonction intermédiaire juste ne
 *    prouve rien si l’appel ne passe pas par elle.
 */
describe('⛔ ce que le vrai modèle envoie, et ce qu’il fait d’une réponse d’erreur', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  function fournisseurQuiRepond(statut: number, type: string, message: string) {
    const corps: Array<{ messages: Array<{ role: string }>; system?: unknown }> = []

    vi.stubEnv('ANTHROPIC_API_KEY', 'cle-inventee-pour-les-tests')
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: unknown, init?: { body?: unknown }) => {
        corps.push(JSON.parse(String(init?.body)) as (typeof corps)[number])
        return Promise.resolve(
          new Response(JSON.stringify({ type: 'error', error: { type, message } }), {
            status: statut,
            headers: { 'content-type': 'application/json' },
          }),
        )
      }),
    )

    return corps
  }

  const modele = () =>
    modeleClaude({
      identifiant: 'claude-sonnet-5',
      gabarit: 'Gabarit du tour.\n{{relances}}',
      gabaritSynthese: 'Gabarit de la note.\n{{fin}}',
    })

  it('la synthèse d’un panneau refermé sur une relance part en finissant sur la parole', async () => {
    const corps = fournisseurQuiRepond(400, 'invalid_request_error', 'refus de test')

    const erreur = await modele()
      .synthese({ contexte: {}, fil: FIL_SUR_UNE_RELANCE, fin: 'abandon' })
      .then(
        () => null,
        (raison: unknown) => raison,
      )

    expect(corps).toHaveLength(1)
    const messages = corps[0]?.messages ?? []
    expect(messages.map((message) => message.role)).toEqual(['user'])
    expect(JSON.stringify(messages)).not.toContain(RELANCE)
    // ⚠️ Le fait est dit au prompt système — sans le texte de la question.
    expect(JSON.stringify(corps[0]?.system)).toContain('sans réponse')
    expect(JSON.stringify(corps[0]?.system)).not.toContain(RELANCE)

    // ⛔ Et le 400 réel du fournisseur est classé comme tel, une seule fois :
    //    l’AI SDK ne retente pas une erreur non retentable.
    expect(classerEchec(erreur)).toEqual({
      nature: 'refus',
      cause: 'HTTP 400 invalid_request_error — refus de test',
    })
  })

  it('le tour aussi : un corps vide après une question part en finissant sur la parole', async () => {
    const corps = fournisseurQuiRepond(400, 'invalid_request_error', 'refus de test')

    await modele()
      .tour({ contexte: {}, fil: FIL_SUR_UNE_RELANCE, relancesRestantes: 1 })
      .catch(() => undefined)

    expect(corps[0]?.messages.map((message) => message.role)).toEqual(['user'])
  })

  it('un 401 réel — la clé — reste une indisponibilité : le filet attendra qu’on la corrige', async () => {
    fournisseurQuiRepond(401, 'authentication_error', 'invalid x-api-key')

    const erreur = await modele()
      .synthese({ contexte: {}, fil: FIL_SUR_UNE_RELANCE, fin: 'abandon' })
      .then(
        () => null,
        (raison: unknown) => raison,
      )

    expect(classerEchec(erreur).nature).toBe('indisponible')
  })

  it('⛔ un fil sans parole n’appelle pas le fournisseur du tout', async () => {
    const corps = fournisseurQuiRepond(400, 'invalid_request_error', 'ne doit pas être appelé')

    const erreur = await modele()
      .synthese({ contexte: {}, fil: [{ role: 'bot', texte: RELANCE }], fin: 'abandon' })
      .then(
        () => null,
        (raison: unknown) => raison,
      )

    expect(corps).toHaveLength(0)
    expect(erreur).toBeInstanceOf(RequeteInvalide)
  })
})

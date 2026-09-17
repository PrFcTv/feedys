/**
 * Telegram, sans réseau.
 *
 * ⛔ `pnpm test` reste hors ligne : `fetch` est un bouchon, partout. Aucun appel
 *    réel à api.telegram.org — la relecture du lot 7 a trouvé un parcours qui
 *    appelait api.anthropic.com pour de vrai, et on ne refait pas cette faute.
 *
 * ⛔ Le jeton de ce fichier est INVENTÉ, et sans valeur nulle part. Il a la forme
 *    d’un jeton — c’est ce que le nettoyage doit reconnaître.
 */
import { describe, expect, it, vi } from 'vitest'

import { envoyerParCanal } from './envoyer'
import type { PortDepotNotifications } from './envoyer'
import { EXEMPLE_NOTIFICATION } from './exemple'
import type { RetourANotifier } from './message'
import type { PortsTelegram, Recuperer } from './telegram'
import {
  ErreurTelegram,
  LONGUEUR_MAX,
  canalTelegram,
  composerAvis,
  composerEssai,
  envoyerTelegram,
  nettoyer,
  tronquer,
} from './telegram'

const JETON = '000000123:jeton-invente-pour-les-tests-sans-valeur'
const REGLAGES = { jeton: JETON, chat: '-1000000000042' }

type Appel = { url: string; corps: Record<string, unknown> }

/** Un `fetch` qui rend, dans l’ordre, les réponses qu’on lui donne. */
function reseau(...reponses: Array<{ status: number; corps: unknown } | Error>) {
  const appels: Appel[] = []

  const fetch: Recuperer = async (url, init) => {
    appels.push({ url, corps: JSON.parse(init.body) as Record<string, unknown> })
    const suivante = reponses.shift() ?? { status: 200, corps: { ok: true } }
    if (suivante instanceof Error) throw suivante
    return { status: suivante.status, json: async () => suivante.corps }
  }

  const attendre = vi.fn(async () => undefined)
  const ports: PortsTelegram = { fetch, attendre }

  return { appels, attendre, ports }
}

const OK = { status: 200, corps: { ok: true, result: { message_id: 1 } } }

/** Tout ce qui, dans une note, vient de la parole ou désigne quelqu’un. */
function sensibles(retour: RetourANotifier): string[] {
  const { synthese, contexte } = retour
  return [
    synthese.titre,
    synthese.resume,
    synthese.zone,
    synthese.attendu ?? '',
    synthese.constate ?? '',
    ...synthese.citations,
    ...synthese.questions_ouvertes,
    contexte.auteurNom ?? '',
    contexte.auteurRole ?? '',
    contexte.url ?? '',
  ].filter((texte) => texte !== '')
}

describe('l’avis d’une note — un pointeur', () => {
  it('porte le produit, le type, la date du collaborateur, et le lien vers la fiche', () => {
    const avis = composerAvis(EXEMPLE_NOTIFICATION)

    expect(avis).toBe(
      [
        'Feedys · Pistache',
        'Nouveau retour · bug',
        '4 sept. 2026 à 09:14',
        'https://feedys.exemple.fr/bo/r/ret_exemple0000000000000',
      ].join('\n'),
    )
  })

  it('⛔ ne porte RIEN de la parole, ni de la personne, ni de la page où elle était', () => {
    const avis = composerAvis(EXEMPLE_NOTIFICATION)

    for (const texte of sensibles(EXEMPLE_NOTIFICATION)) {
      expect(avis, texte).not.toContain(texte)
    }
  })

  it('⛔ un transcript hostile n’atteint jamais le message — et rien n’est interprété', async () => {
    const hostile = 'le bouton <b>Valider</b> & le champ _*[montant] ne marchent pas 🙃'
    const retour: RetourANotifier = {
      ...EXEMPLE_NOTIFICATION,
      // ⚠️ Le nom du produit, lui, part — il est choisi par le développeur. On
      //    y met les mêmes caractères pour vérifier qu’ils arrivent tels quels.
      produitNom: 'Pistache <b>&</b> _*[🙃',
      synthese: {
        ...EXEMPLE_NOTIFICATION.synthese,
        titre: hostile,
        resume: hostile,
        citations: [hostile],
      },
    }
    const r = reseau(OK)

    await canalTelegram(REGLAGES, r.ports).envoyer(retour)

    const corps = r.appels[0]?.corps
    expect(corps).toBeDefined()
    expect(corps).not.toHaveProperty('parse_mode')
    expect(String(corps?.['text'])).not.toContain('Valider')
    expect(String(corps?.['text'])).toContain('Pistache <b>&</b> _*[🙃')
  })

  it('le type est dit dans les mots du produit', () => {
    const avis = composerAvis({
      ...EXEMPLE_NOTIFICATION,
      synthese: { ...EXEMPLE_NOTIFICATION.synthese, type: 'gene' },
    })

    expect(avis).toContain('Nouveau retour · gêne')
  })
})

describe('la longueur', () => {
  it(`⛔ tient dans ${LONGUEUR_MAX} caractères, et le lien reste`, () => {
    const retour = { ...EXEMPLE_NOTIFICATION, produitNom: 'x'.repeat(5000) }
    const avis = composerAvis(retour)

    expect(avis.length).toBeLessThanOrEqual(LONGUEUR_MAX)
    expect(avis.endsWith('https://feedys.exemple.fr/bo/r/ret_exemple0000000000000')).toBe(true)
    expect(avis).toContain('…')
  })

  it('⚠️ ne coupe pas un émoji en deux', () => {
    const corps = `${'a'.repeat(9)}🙃🙃`
    const coupe = tronquer(corps, 'L', 13)

    // 13 − (1 + 2) = 10 places : « a×9 » puis la moitié d’un émoji, retirée.
    expect(coupe).toBe(`${'a'.repeat(9)}…\nL`)
  })

  it('ne touche à rien de ce qui tient déjà', () => {
    expect(tronquer('court', 'lien')).toBe('court\nlien')
  })
})

describe('l’envoi', () => {
  it('appelle sendMessage, et rien d’autre — ⛔ sens unique', async () => {
    const r = reseau(OK)

    await envoyerTelegram('bonjour', REGLAGES, r.ports)

    expect(r.appels).toHaveLength(1)
    expect(r.appels[0]?.url).toBe(`https://api.telegram.org/bot${JETON}/sendMessage`)
    expect(r.appels[0]?.corps).toEqual({
      chat_id: '-1000000000042',
      text: 'bonjour',
      link_preview_options: { is_disabled: true },
    })
  })

  it('⚠️ désactive l’aperçu de lien — les robots de Telegram n’ont rien à faire au back-office', async () => {
    const r = reseau(OK)

    await canalTelegram(REGLAGES, r.ports).envoyer(EXEMPLE_NOTIFICATION)

    expect(r.appels[0]?.corps['link_preview_options']).toEqual({ is_disabled: true })
  })

  it('⚠️ 429 : respecte `retry_after`, puis réussit', async () => {
    const r = reseau({ status: 429, corps: { ok: false, parameters: { retry_after: 3 } } }, OK)

    await envoyerTelegram('bonjour', REGLAGES, r.ports)

    expect(r.attendre).toHaveBeenCalledWith(3000)
    expect(r.appels).toHaveLength(2)
  })

  it('⛔ 429 répété : abandonne après deux attentes, sans boucle', async () => {
    const limite = { status: 429, corps: { ok: false, parameters: { retry_after: 1 } } }
    const r = reseau(limite, limite, limite, limite)

    await expect(envoyerTelegram('bonjour', REGLAGES, r.ports)).rejects.toThrow(/429/)
    expect(r.appels).toHaveLength(3)
  })

  it('⛔ 429 avec une attente trop longue : n’attend pas, échoue en le disant', async () => {
    const r = reseau({ status: 429, corps: { ok: false, parameters: { retry_after: 600 } } })

    await expect(envoyerTelegram('bonjour', REGLAGES, r.ports)).rejects.toThrow(/600 s/)
    expect(r.attendre).not.toHaveBeenCalled()
  })

  it('⛔ 403 : échec immédiat, avec une raison lisible', async () => {
    const r = reseau({
      status: 403,
      corps: { ok: false, description: 'Forbidden: bot was kicked from the group chat' },
    })

    const erreur = await envoyerTelegram('bonjour', REGLAGES, r.ports).catch((e: unknown) => e)

    expect(erreur).toBeInstanceOf(ErreurTelegram)
    expect((erreur as ErreurTelegram).message).toContain('bloqué, ou retiré du groupe')
    expect((erreur as ErreurTelegram).statut).toBe(403)
    expect(r.appels).toHaveLength(1)
  })

  it('⛔ 400 « chat not found » : échec immédiat, qui pointe la bonne variable', async () => {
    const r = reseau({ status: 400, corps: { ok: false, description: 'Bad Request: chat not found' } })

    await expect(envoyerTelegram('bonjour', REGLAGES, r.ports)).rejects.toThrow(
      /FEEDYS_TELEGRAM_CHAT.*chat not found/,
    )
    expect(r.appels).toHaveLength(1)
  })

  it('⛔ jamais l’attente infinie : l’appel porte un délai', async () => {
    let signal: AbortSignal | undefined
    const ports: PortsTelegram = {
      fetch: async (_url, init) => {
        signal = init.signal
        return { status: 200, json: async () => ({ ok: true }) }
      },
      attendre: async () => undefined,
    }

    await envoyerTelegram('bonjour', REGLAGES, ports)

    expect(signal).toBeInstanceOf(AbortSignal)
  })

  it('dit le délai dépassé en clair', async () => {
    const r = reseau(new DOMException('The operation was aborted due to timeout', 'TimeoutError'))

    await expect(
      envoyerTelegram('bonjour', REGLAGES, { ...r.ports, delaiMs: 10_000 }),
    ).rejects.toThrow('Telegram n’a pas répondu en 10 s')
  })
})

describe('⛔ le jeton ne sort jamais', () => {
  it('nettoie le jeton littéral, sa forme encodée, et toute forme de jeton', () => {
    const texte = [
      `https://api.telegram.org/bot${JETON}/sendMessage`,
      encodeURIComponent(JETON),
      'un autre : 987654321:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    ].join(' | ')

    const propre = nettoyer(texte, JETON)

    expect(propre).not.toContain(JETON)
    expect(propre).not.toContain(encodeURIComponent(JETON))
    expect(propre).not.toContain('AAAAAAAAAAAAAAAAAAAA')
    expect(propre).toContain('bot‹jeton›/sendMessage')
  })

  it('⛔ une erreur réseau qui recopie l’URL ne laisse passer le jeton NULLE PART', async () => {
    const fuite = new TypeError(`fetch failed: https://api.telegram.org/bot${JETON}/sendMessage`, {
      cause: new Error(`connect ECONNREFUSED — POST https://api.telegram.org/bot${JETON}/sendMessage`),
    })
    const r = reseau(fuite)
    const signaler = vi.fn()
    const closes: Array<string | null> = []
    const depot: PortDepotNotifications = {
      charger: async () => EXEMPLE_NOTIFICATION,
      dejaEnvoyee: async () => false,
      ouvrir: async () => 'notif_1',
      clore: async (_id, erreur) => {
        closes.push(erreur)
      },
    }

    const resultat = await envoyerParCanal('ret_1', {
      depot,
      canal: canalTelegram(REGLAGES, r.ports),
      signaler,
    })

    expect(resultat).toMatchObject({ ok: true, statut: 'echoue' })

    // Ce qui va en base.
    expect(closes).toHaveLength(1)
    expect(closes[0]).not.toContain(JETON)
    expect(closes[0]).toContain('Telegram injoignable')

    // Ce qui va au journal — le message, la pile, et la cause.
    expect(signaler).toHaveBeenCalledOnce()
    const [quoi, erreur] = signaler.mock.calls[0] as [string, Error]
    const tout = [quoi, String(erreur), erreur.stack ?? '', String(erreur.cause ?? '')].join('\n')
    expect(tout).not.toContain(JETON)
    expect(erreur.cause).toBeUndefined()
  })

  it('⛔ une description de Telegram qui citerait un jeton est nettoyée aussi', async () => {
    const r = reseau({ status: 401, corps: { ok: false, description: `Unauthorized ${JETON}` } })

    const erreur = await envoyerTelegram('bonjour', REGLAGES, r.ports).catch((e: unknown) => e)

    expect(String((erreur as Error).message)).not.toContain(JETON)
    expect(String((erreur as Error).message)).toContain('FEEDYS_TELEGRAM_JETON')
  })
})

describe('le message d’essai', () => {
  it('dit quelle installation l’envoie, et rien d’autre', () => {
    expect(composerEssai('Pistache · https://feedys.exemple.fr')).toMatch(
      /^Feedys · Pistache · https:\/\/feedys\.exemple\.fr\nMessage d’essai\./,
    )
  })
})

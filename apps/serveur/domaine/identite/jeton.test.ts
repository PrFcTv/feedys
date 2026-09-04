import { describe, expect, it } from 'vitest'

import { AUTEUR_INCONNU, auteurDe, signerIdentite, verifierIdentite } from './jeton'

/** ⛔ Inventé. Le dépôt est public : aucun secret réel, jamais. */
const SECRET = 'fdy_sec_secret-de-test-invente-de-toutes-pieces'
const MAINTENANT = Date.UTC(2026, 8, 4, 10, 0, 0)
const DANS_UNE_HEURE = Math.floor(MAINTENANT / 1_000) + 3_600

const CHARGE = {
  ref: 'u-4218',
  nom: 'Camille Dupont',
  role: 'gestionnaire',
  exp: DANS_UNE_HEURE,
} as const

describe('verifierIdentite — une signature valide', () => {
  it('rend la charge telle qu’elle a été signée', () => {
    const verdict = verifierIdentite(signerIdentite(CHARGE, SECRET), SECRET, MAINTENANT)

    expect(verdict).toEqual({ ok: true, identite: CHARGE })
  })

  it('accepte une charge minimale — ref et exp suffisent', () => {
    const charge = { ref: 'u-1', exp: DANS_UNE_HEURE }
    const verdict = verifierIdentite(signerIdentite(charge, SECRET), SECRET, MAINTENANT)

    expect(verdict).toEqual({ ok: true, identite: charge })
  })

  it('tolère les espaces autour du jeton — un en-tête recopié à la main', () => {
    const jeton = `  ${signerIdentite(CHARGE, SECRET)}  `

    expect(verifierIdentite(jeton, SECRET, MAINTENANT).ok).toBe(true)
  })
})

describe('verifierIdentite — une signature expirée', () => {
  it('refuse un jeton dont l’expiration est passée', () => {
    const charge = { ...CHARGE, exp: Math.floor(MAINTENANT / 1_000) - 1 }

    expect(verifierIdentite(signerIdentite(charge, SECRET), SECRET, MAINTENANT)).toEqual({
      ok: false,
      motif: 'expiree',
    })
  })

  it('refuse à la seconde exacte — l’expiration n’est pas un intervalle ouvert', () => {
    const charge = { ...CHARGE, exp: MAINTENANT / 1_000 }

    expect(verifierIdentite(signerIdentite(charge, SECRET), SECRET, MAINTENANT)).toEqual({
      ok: false,
      motif: 'expiree',
    })
  })

  it('⛔ n’accepte pas un jeton SANS expiration', () => {
    const jeton = signerIdentite({ ref: 'u-1' } as never, SECRET)

    expect(verifierIdentite(jeton, SECRET, MAINTENANT)).toEqual({
      ok: false,
      motif: 'charge_invalide',
    })
  })
})

describe('verifierIdentite — une signature forgée', () => {
  it('refuse un jeton signé avec un autre secret', () => {
    const jeton = signerIdentite(CHARGE, 'fdy_sec_un-autre-secret-invente')

    expect(verifierIdentite(jeton, SECRET, MAINTENANT)).toEqual({
      ok: false,
      motif: 'signature_invalide',
    })
  })

  it('⛔ refuse une charge réécrite sous une signature valide', () => {
    const [, signature] = signerIdentite(CHARGE, SECRET).split('.')
    const menteuse = Buffer.from(
      JSON.stringify({ ...CHARGE, role: 'administrateur' }),
      'utf8',
    ).toString('base64url')

    expect(verifierIdentite(`${menteuse}.${signature ?? ''}`, SECRET, MAINTENANT)).toEqual({
      ok: false,
      motif: 'signature_invalide',
    })
  })

  it('refuse une signature tronquée', () => {
    const jeton = signerIdentite(CHARGE, SECRET)

    expect(verifierIdentite(jeton.slice(0, -1), SECRET, MAINTENANT)).toEqual({
      ok: false,
      motif: 'signature_invalide',
    })
  })

  it.each([
    ['sans séparateur', 'pas-un-jeton'],
    ['charge vide', '.signature'],
    ['signature vide', 'charge.'],
  ])('refuse un jeton %s', (_cas, jeton) => {
    expect(verifierIdentite(jeton, SECRET, MAINTENANT)).toEqual({
      ok: false,
      motif: 'jeton_malforme',
    })
  })

  it('refuse une charge qui n’est pas du JSON, sans lever', () => {
    const corps = Buffer.from('pas du json', 'utf8').toString('base64url')
    const jeton = `${corps}.${signerIdentite(CHARGE, SECRET).split('.')[1] ?? ''}`

    expect(verifierIdentite(jeton, SECRET, MAINTENANT).ok).toBe(false)
  })

  it('⛔ refuse un champ inconnu glissé dans la charge', () => {
    const jeton = signerIdentite({ ...CHARGE, admin: true } as never, SECRET)

    expect(verifierIdentite(jeton, SECRET, MAINTENANT)).toEqual({
      ok: false,
      motif: 'charge_invalide',
    })
  })

  it('refuse un jeton absurdement long sans calculer d’empreinte', () => {
    const jeton = `${'a'.repeat(5_000)}.b`

    expect(verifierIdentite(jeton, SECRET, MAINTENANT)).toEqual({
      ok: false,
      motif: 'jeton_trop_long',
    })
  })
})

describe('verifierIdentite — une signature absente', () => {
  it.each([null, undefined, '', '   '])('rend « absente » pour %s', (jeton) => {
    expect(verifierIdentite(jeton, SECRET, MAINTENANT)).toEqual({ ok: false, motif: 'absente' })
  })

  it('rend « produit_sans_secret » quand le produit n’a pas de secret utilisable', () => {
    expect(verifierIdentite(signerIdentite(CHARGE, SECRET), null, MAINTENANT)).toEqual({
      ok: false,
      motif: 'produit_sans_secret',
    })
  })
})

describe('auteurDe', () => {
  it('rend l’auteur d’un verdict favorable', () => {
    const verdict = verifierIdentite(signerIdentite(CHARGE, SECRET), SECRET, MAINTENANT)

    expect(auteurDe(verdict)).toEqual({
      ref: 'u-4218',
      nom: 'Camille Dupont',
      role: 'gestionnaire',
      verifiee: true,
    })
  })

  it('⛔ n’écrit RIEN d’un jeton forgé — pas même le ref qu’il prétendait porter', () => {
    const jeton = signerIdentite(CHARGE, 'fdy_sec_un-autre-secret-invente')

    expect(auteurDe(verifierIdentite(jeton, SECRET, MAINTENANT))).toEqual(AUTEUR_INCONNU)
  })

  it('ne garde pas un nom vide', () => {
    const charge = { ref: 'u-1', nom: '   ', role: '', exp: DANS_UNE_HEURE }
    const verdict = verifierIdentite(signerIdentite(charge, SECRET), SECRET, MAINTENANT)

    expect(auteurDe(verdict)).toEqual({ ref: 'u-1', nom: null, role: null, verifiee: true })
  })
})

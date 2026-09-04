import { describe, expect, it } from 'vitest'

import { chiffrer, dechiffrer, nouvelleCleDeChiffrement } from './secret'

const CLEF = Buffer.from(nouvelleCleDeChiffrement(), 'base64url')
/** ⛔ Inventé. Le dépôt est public. */
const SECRET = 'fdy_sec_secret-de-test-invente-de-toutes-pieces'

describe('chiffrer / dechiffrer', () => {
  it('rend le secret d’origine', () => {
    expect(dechiffrer(chiffrer(SECRET, CLEF), CLEF)).toBe(SECRET)
  })

  it('⛔ ne laisse pas le secret lisible dans l’enveloppe', () => {
    expect(chiffrer(SECRET, CLEF)).not.toContain(SECRET)
  })

  it('produit une enveloppe différente à chaque appel — l’IV est neuf', () => {
    expect(chiffrer(SECRET, CLEF)).not.toBe(chiffrer(SECRET, CLEF))
  })

  it('refuse une enveloppe chiffrée sous une autre clé, sans lever', () => {
    const autre = Buffer.from(nouvelleCleDeChiffrement(), 'base64url')

    expect(dechiffrer(chiffrer(SECRET, CLEF), autre)).toBeNull()
  })

  it('refuse une enveloppe modifiée — GCM authentifie', () => {
    const enveloppe = chiffrer(SECRET, CLEF)
    const abimee = `${enveloppe.slice(0, -2)}${enveloppe.endsWith('a') ? 'bb' : 'aa'}`

    expect(dechiffrer(abimee, CLEF)).toBeNull()
  })

  it.each([null, '', 'pas-une-enveloppe', 'v2.a.b.c', 'v1.a.b'])(
    'refuse « %s » sans lever',
    (enveloppe) => {
      expect(dechiffrer(enveloppe, CLEF)).toBeNull()
    },
  )

  it('rend null sans clé — l’identité ne marche pas, rien ne tombe', () => {
    expect(dechiffrer(chiffrer(SECRET, CLEF), null)).toBeNull()
  })
})

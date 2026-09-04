import { describe, expect, it } from 'vitest'

import { Limiteur, creerDebitIngestion } from './debit'

const T0 = 1_757_000_000_000

describe('Limiteur', () => {
  it('laisse passer jusqu’au maximum, puis refuse', () => {
    const limiteur = new Limiteur(3, 60_000)

    expect(limiteur.autoriser('a', T0)).toBe(true)
    expect(limiteur.autoriser('a', T0 + 1)).toBe(true)
    expect(limiteur.autoriser('a', T0 + 2)).toBe(true)
    expect(limiteur.autoriser('a', T0 + 3)).toBe(false)
  })

  it('rouvre quand la fenêtre a glissé', () => {
    const limiteur = new Limiteur(1, 60_000)

    expect(limiteur.autoriser('a', T0)).toBe(true)
    expect(limiteur.autoriser('a', T0 + 59_999)).toBe(false)
    expect(limiteur.autoriser('a', T0 + 60_001)).toBe(true)
  })

  it('⚠️ un refus ne consomme pas de crédit — sinon un client qui insiste ne rouvrirait jamais', () => {
    const limiteur = new Limiteur(1, 60_000)

    limiteur.autoriser('a', T0)
    for (let i = 1; i <= 20; i += 1) limiteur.autoriser('a', T0 + i)

    expect(limiteur.autoriser('a', T0 + 60_001)).toBe(true)
  })

  it('compte chaque clé séparément', () => {
    const limiteur = new Limiteur(1, 60_000)

    expect(limiteur.autoriser('a', T0)).toBe(true)
    expect(limiteur.autoriser('b', T0)).toBe(true)
    expect(limiteur.autoriser('a', T0)).toBe(false)
  })

  it('balaie les clés expirées plutôt que de grossir sans fin', () => {
    const limiteur = new Limiteur(5, 1_000, 4)

    for (let i = 0; i < 50; i += 1) limiteur.autoriser(`cle_${i}`, T0 + i)

    // Après le balayage, une clé ancienne repart d’un compteur vierge.
    expect(limiteur.autoriser('cle_0', T0 + 100_000)).toBe(true)
  })
})

describe('creerDebitIngestion', () => {
  it('rend deux compteurs indépendants — la clé et l’IP n’attrapent pas la même chose', () => {
    const debit = creerDebitIngestion()

    expect(debit.cle.autoriser('fdy_pub_x', T0)).toBe(true)
    expect(debit.ip.autoriser('fdy_pub_x', T0)).toBe(true)
    expect(debit.cle).not.toBe(debit.ip)
  })
})

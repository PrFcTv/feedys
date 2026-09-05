/**
 * Le filet, sans base et sans réseau.
 *
 * ⚠️ Ce qui se prouve ici : la décision « ce retour est-il muet ? », et le fait
 *    qu’un aval qui échoue ne bloque pas les suivants. Le reste — la réservation
 *    entre deux conteneurs — demande un vrai Postgres et vit dans
 *    `balayage.integration.test.ts`.
 */
import { describe, expect, it, vi } from 'vitest'

import type { PortsBalayage } from './balayage'
import {
  PAR_PASSE,
  PAS_BALAYAGE_MS,
  SILENCE_AVANT_CLOTURE_MS,
  balayer,
  estMuet,
  instantLimite,
} from './balayage'

const MAINTENANT = new Date('2026-09-05T12:00:00.000Z')

function ilYA(ms: number): Date {
  return new Date(MAINTENANT.getTime() - ms)
}

const MINUTE = 60 * 1000

describe('la décision « ce retour est-il muet ? »', () => {
  it('dit non tant que le silence est plus court que N', () => {
    expect(estMuet(ilYA(29 * MINUTE), MAINTENANT)).toBe(false)
  })

  it('dit oui passé N', () => {
    expect(estMuet(ilYA(31 * MINUTE), MAINTENANT)).toBe(true)
  })

  it('⛔ ne coupe pas quelqu’un qui vient de parler', () => {
    expect(estMuet(MAINTENANT, MAINTENANT)).toBe(false)
    expect(estMuet(ilYA(8 * 1000), MAINTENANT)).toBe(false)
  })

  it('⚠️ à N exactement, le retour n’est PAS muet — la borne est stricte', () => {
    expect(estMuet(ilYA(SILENCE_AVANT_CLOTURE_MS), MAINTENANT)).toBe(false)
    expect(estMuet(ilYA(SILENCE_AVANT_CLOTURE_MS + 1), MAINTENANT)).toBe(true)
  })

  it('accepte un seuil explicite, pour les tests et pour le jour où N bougera', () => {
    expect(estMuet(ilYA(2 * MINUTE), MAINTENANT, MINUTE)).toBe(true)
    expect(estMuet(ilYA(2 * MINUTE), MAINTENANT, 10 * MINUTE)).toBe(false)
  })
})

describe('la règle et sa forme SQL disent la même chose', () => {
  /**
   * ⚠️ Le SQL ne réécrit pas la règle : il compare le dernier signe de vie à
   *    `instantLimite`. Ce test est ce qui interdit aux deux formes de diverger.
   */
  it.each([0, 1, 29, 30, 31, 120])('à %i minutes de silence', (minutes) => {
    const dernierSigne = ilYA(minutes * MINUTE)
    const parLeSql = dernierSigne.getTime() < instantLimite(MAINTENANT).getTime()

    expect(estMuet(dernierSigne, MAINTENANT)).toBe(parLeSql)
  })
})

describe('les valeurs de réglage', () => {
  it('N vaut trente minutes — D-018', () => {
    expect(SILENCE_AVANT_CLOTURE_MS).toBe(30 * 60 * 1000)
  })

  it('⚠️ le pas est plus court que N : un retour muet ne peut pas être oublié', () => {
    expect(PAS_BALAYAGE_MS).toBeLessThan(SILENCE_AVANT_CLOTURE_MS)
  })

  it('⛔ une passe est bornée', () => {
    expect(PAR_PASSE).toBeGreaterThan(0)
    expect(Number.isFinite(PAR_PASSE)).toBe(true)
  })
})

function portsBouchon(overrides: Partial<PortsBalayage> = {}): PortsBalayage {
  return {
    clore: vi.fn(async () => []),
    aval: vi.fn(async () => undefined),
    signaler: vi.fn(),
    ...overrides,
  }
}

describe('une passe de balayage', () => {
  it('demande la clôture avant l’instant limite, et pas avant autre chose', async () => {
    const clore = vi.fn(async () => [])
    const ports = portsBouchon({ clore })

    await balayer(ports, { maintenant: MAINTENANT })

    expect(clore).toHaveBeenCalledWith(instantLimite(MAINTENANT), PAR_PASSE)
  })

  it('passe chaque retour refermé au chemin ordinaire', async () => {
    const aval = vi.fn(async () => undefined)
    const ports = portsBouchon({ clore: async () => ['r1', 'r2'], aval })

    const bilan = await balayer(ports, { maintenant: MAINTENANT })

    expect(aval).toHaveBeenCalledTimes(2)
    expect(aval).toHaveBeenNthCalledWith(1, 'r1')
    expect(aval).toHaveBeenNthCalledWith(2, 'r2')
    expect(bilan).toEqual({ clos: 2, synthetises: 2, echoues: 0 })
  })

  it('⛔ un aval qui échoue ne bloque pas les suivants', async () => {
    const aval = vi.fn(async (id: string) => {
      if (id === 'r2') throw new Error('modèle indisponible')
    })
    const signaler = vi.fn()
    const ports = portsBouchon({ clore: async () => ['r1', 'r2', 'r3'], aval, signaler })

    const bilan = await balayer(ports, { maintenant: MAINTENANT })

    expect(aval).toHaveBeenCalledTimes(3)
    expect(bilan).toEqual({ clos: 3, synthetises: 2, echoues: 1 })
    expect(signaler).toHaveBeenCalledOnce()
  })

  it('⛔ ne remonte jamais l’erreur : le balayage suivant doit avoir lieu', async () => {
    const ports = portsBouchon({
      clore: async () => ['r1'],
      aval: async () => {
        throw new Error('SMTP coupé')
      },
    })

    await expect(balayer(ports, { maintenant: MAINTENANT })).resolves.toEqual({
      clos: 1,
      synthetises: 0,
      echoues: 1,
    })
  })

  it('⚠️ l’aval est joué en série — vingt appels au modèle d’un coup, jamais', async () => {
    const enCours: number[] = []
    let simultanes = 0

    const ports = portsBouchon({
      clore: async () => ['r1', 'r2', 'r3'],
      aval: async () => {
        simultanes += 1
        enCours.push(simultanes)
        await Promise.resolve()
        simultanes -= 1
      },
    })

    await balayer(ports, { maintenant: MAINTENANT })

    expect(Math.max(...enCours)).toBe(1)
  })

  it('ne fait rien, et ne se plaint pas, quand rien n’est muet', async () => {
    const aval = vi.fn(async () => undefined)
    const signaler = vi.fn()
    const ports = portsBouchon({ aval, signaler })

    const bilan = await balayer(ports, { maintenant: MAINTENANT })

    expect(bilan).toEqual({ clos: 0, synthetises: 0, echoues: 0 })
    expect(aval).not.toHaveBeenCalled()
    expect(signaler).not.toHaveBeenCalled()
  })
})

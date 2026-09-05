/**
 * Le filet branché sur le temps, sans base et sans minuteur réel.
 *
 * ⚠️ CE QU’ON PROUVE ICI ET NULLE PART AILLEURS : qu’une passe ne démarre pas
 *    pendant qu’une autre tourne. Le verrou de la base rendrait le doublon
 *    inoffensif EN BASE — il ne l’est pas du tout côté modèle, où deux passes
 *    qui se chevauchent doubleraient les appels.
 *
 * ⛔ Ce fichier existe parce que l’affirmation vivait dans un commentaire et
 *    dans rien d’autre. C’est exactement ce qui a laissé passer le défaut 008.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { PortsBalayage } from '../domaine/entretien/balayage'

import { arreterFilet, demarrerFilet, passe } from './filet'

const JOURNAL = { info: vi.fn(), alerte: vi.fn(), erreur: vi.fn() }

function portsQui(clore: PortsBalayage['clore'], aval: PortsBalayage['aval'] = async () => undefined) {
  return () => ({ clore, aval, signaler: () => undefined })
}

afterEach(() => {
  arreterFilet()
  vi.clearAllMocks()
  vi.useRealTimers()
})

describe('une passe à la fois', () => {
  it('⛔ ne démarre pas une passe pendant qu’une autre tourne', async () => {
    let entrees = 0
    let relacher: (() => void) | undefined
    const bloquee = new Promise<void>((resoudre) => {
      relacher = resoudre
    })

    const ports = portsQui(async () => {
      entrees += 1
      await bloquee
      return []
    })

    const premiere = passe({ ports, journal: JOURNAL })
    await Promise.resolve()

    // La seconde tombe pendant que la première est encore dans `clore`.
    await passe({ ports, journal: JOURNAL })
    expect(entrees).toBe(1)

    relacher?.()
    await premiere

    // Une fois la première finie, le passage est de nouveau libre.
    await passe({ ports, journal: JOURNAL })
    expect(entrees).toBe(2)
  })

  it('⚠️ rouvre le passage même quand la passe a échoué', async () => {
    const ports = portsQui(async () => {
      throw new Error('Postgres injoignable')
    })

    await passe({ ports, journal: JOURNAL })
    await passe({ ports, journal: JOURNAL })

    expect(JOURNAL.erreur).toHaveBeenCalledTimes(2)
  })
})

describe('ce que le filet dit', () => {
  it('⛔ se tait quand il n’a rien refermé', async () => {
    await passe({ ports: portsQui(async () => []), journal: JOURNAL })

    expect(JOURNAL.info).not.toHaveBeenCalled()
    expect(JOURNAL.erreur).not.toHaveBeenCalled()
  })

  it('dit ce qu’il a fait quand il a fait quelque chose', async () => {
    await passe({ ports: portsQui(async () => ['r1', 'r2']), journal: JOURNAL })

    expect(JOURNAL.info).toHaveBeenCalledOnce()
    expect(JOURNAL.info.mock.calls[0]?.[0]).toContain('2 entretien(s)')
  })

  it('⛔ ne laisse jamais une panne remonter — le balayage suivant doit avoir lieu', async () => {
    const ports = portsQui(async () => {
      throw new Error('Postgres injoignable')
    })

    await expect(passe({ ports, journal: JOURNAL })).resolves.toBeUndefined()
    expect(JOURNAL.erreur).toHaveBeenCalledOnce()
  })
})

describe('le minuteur', () => {
  it('⚠️ est idempotent — deux démarrages ne font pas deux minuteurs', async () => {
    vi.useFakeTimers()
    const clore = vi.fn(async () => [])

    demarrerFilet({ pasMs: 1000, ports: portsQui(clore), journal: JOURNAL })
    demarrerFilet({ pasMs: 1000, ports: portsQui(clore), journal: JOURNAL })

    await vi.advanceTimersByTimeAsync(1000)

    expect(clore).toHaveBeenCalledOnce()
  })

  it('balaie au rythme dit', async () => {
    vi.useFakeTimers()
    const clore = vi.fn(async () => [])

    demarrerFilet({ pasMs: 1000, ports: portsQui(clore), journal: JOURNAL })

    await vi.advanceTimersByTimeAsync(3000)

    expect(clore).toHaveBeenCalledTimes(3)
  })

  it('⛔ s’arrête vraiment', async () => {
    vi.useFakeTimers()
    const clore = vi.fn(async () => [])

    demarrerFilet({ pasMs: 1000, ports: portsQui(clore), journal: JOURNAL })
    await vi.advanceTimersByTimeAsync(1000)
    arreterFilet()
    await vi.advanceTimersByTimeAsync(5000)

    expect(clore).toHaveBeenCalledOnce()
  })
})

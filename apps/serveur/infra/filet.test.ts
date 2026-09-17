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
import type { PortsReprise } from '../domaine/synthese/reprise'

import type { PortsFilet } from './filet'
import { arreterFilet, demarrerFilet, passe } from './filet'

const JOURNAL = { info: vi.fn(), alerte: vi.fn(), erreur: vi.fn() }

function portsQui(
  clore: PortsBalayage['clore'],
  aval: PortsBalayage['aval'] = async () => undefined,
): () => PortsFilet {
  return () => ({ balayage: { clore, aval, signaler: () => undefined } })
}

/** Une file de retours à reprendre, et un modèle qui répond ce qu’on lui dit. */
function reprisesDe(
  file: Array<{ retourId: string; reprises: number }>,
  synthetiser: PortsReprise['synthetiser'],
): PortsReprise & { renonces: string[] } {
  const renonces: string[] = []
  return {
    renonces,
    reserver: async () => file.shift() ?? null,
    synthetiser,
    renoncer: async (retourId, motif) => {
      renonces.push(`${retourId}:${motif}`)
    },
  }
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

  it('⚠️ une note pas encore écrite n’est plus une alerte — les reprises y reviendront', async () => {
    const ports = portsQui(
      async () => ['r1'],
      async () => {
        throw new Error('modèle muet')
      },
    )

    await passe({ ports, journal: JOURNAL })

    expect(JOURNAL.alerte).not.toHaveBeenCalled()
    expect(JOURNAL.info.mock.calls.map((appel) => appel[0]).join('\n')).toContain('redemanderont')
  })
})

describe('les reprises, dans la même passe', () => {
  it('reprend ce que le balayage a laissé, et dit ce qu’elle a fait', async () => {
    const reprise = reprisesDe([{ retourId: 'r9', reprises: 1 }], async () => 'ecrite')

    await passe({
      ports: () => ({ balayage: portsQui(async () => [])().balayage, reprise }),
      journal: JOURNAL,
    })

    expect(JOURNAL.info.mock.calls[0]?.[0]).toContain('1 note(s) redemandée(s) : 1 écrite(s)')
    expect(JOURNAL.alerte).not.toHaveBeenCalled()
  })

  it('⛔ un renoncement s’alerte, et nomme ses retours', async () => {
    const reprise = reprisesDe([{ retourId: 'r_plafond', reprises: 8 }], async () => 'modele_indisponible')

    await passe({
      ports: () => ({ balayage: portsQui(async () => [])().balayage, reprise }),
      journal: JOURNAL,
    })

    expect(reprise.renonces).toEqual(['r_plafond:plafond'])
    expect(JOURNAL.alerte).toHaveBeenCalledOnce()
    expect(JOURNAL.alerte.mock.calls[0]?.[0]).toContain('r_plafond')
  })

  it('⚠️ a lieu même quand le balayage a échoué', async () => {
    const reprise = reprisesDe([{ retourId: 'r1', reprises: 1 }], async () => 'ecrite')

    await passe({
      ports: () => ({
        balayage: portsQui(async () => {
          throw new Error('Postgres injoignable')
        })().balayage,
        reprise,
      }),
      journal: JOURNAL,
    })

    expect(JOURNAL.erreur).toHaveBeenCalledOnce()
    expect(JOURNAL.info.mock.calls[0]?.[0]).toContain('1 écrite(s)')
  })

  it('⛔ partage le budget de la passe : le temps que le balayage a pris est perdu pour elle', async () => {
    let temps = 0
    const synthetiser = vi.fn(async () => 'ecrite' as const)
    const reprise = reprisesDe([{ retourId: 'r1', reprises: 1 }], synthetiser)

    await passe({
      horloge: () => temps,
      ports: () => ({
        balayage: {
          clore: async () => {
            // Le balayage mange les trois minutes à lui seul.
            temps += 3 * 60 * 1000
            return []
          },
          aval: async () => undefined,
        },
        reprise,
      }),
      journal: JOURNAL,
    })

    expect(synthetiser).not.toHaveBeenCalled()
  })

  it('⛔ deux passes qui se chevauchent n’appellent pas deux fois le modèle', async () => {
    let relacher: (() => void) | undefined
    const bloquee = new Promise<void>((resoudre) => {
      relacher = resoudre
    })
    const synthetiser = vi.fn(async () => {
      await bloquee
      return 'ecrite' as const
    })
    // ⚠️ La même file pour les deux passes : si la seconde entrait, elle
    //    trouverait encore un retour à reprendre.
    const file = [
      { retourId: 'r1', reprises: 1 },
      { retourId: 'r2', reprises: 1 },
    ]
    const reprise = reprisesDe(file, synthetiser)
    const ports = () => ({ balayage: portsQui(async () => [])().balayage, reprise })

    const premiere = passe({ ports, journal: JOURNAL })
    await vi.waitFor(() => expect(synthetiser).toHaveBeenCalledOnce())

    await passe({ ports, journal: JOURNAL })
    expect(synthetiser).toHaveBeenCalledOnce()

    relacher?.()
    await premiere
    expect(synthetiser).toHaveBeenCalledTimes(2)
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

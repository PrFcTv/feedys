/**
 * Les reprises, sans base — la règle d’espacement, le plafond, et ce qu’on fait
 * de chaque issue.
 *
 * ⚠️ Ce que ce fichier ne peut pas prouver — la réservation entre deux passes, la
 *    requête qui voit les retours refermés par le widget — est dans
 *    `reprise.integration.test.ts`, contre un vrai Postgres.
 */
import { describe, expect, it, vi } from 'vitest'

import type { IssueSynthese, PortsReprise, RetourReserve } from './reprise'
import {
  PLAFOND_REPRISES,
  PREMIER_ESPACEMENT_MS,
  espacementAvant,
  limitesDeReprise,
  repriseDue,
  reprendre,
} from './reprise'

const MINUTE = 60 * 1000
const MAINTENANT = new Date('2026-09-17T10:00:00.000Z')

function bouchon(
  file: RetourReserve[],
  issues: Record<string, IssueSynthese | Error>,
): PortsReprise & { renonces: Array<[string, string]>; appels: string[] } {
  const renonces: Array<[string, string]> = []
  const appels: string[] = []

  return {
    renonces,
    appels,
    reserver: async () => file.shift() ?? null,
    synthetiser: async (retourId) => {
      appels.push(retourId)
      const issue = issues[retourId] ?? 'ecrite'
      if (issue instanceof Error) throw issue
      return issue
    },
    renoncer: async (retourId, motif) => {
      renonces.push([retourId, motif])
    },
    signaler: () => undefined,
  }
}

describe('l’espacement', () => {
  it('attend plus longtemps que la tentative ordinaire — trois minutes au pire', () => {
    expect(PREMIER_ESPACEMENT_MS).toBeGreaterThan(3 * MINUTE)
    expect(espacementAvant(0)).toBe(PREMIER_ESPACEMENT_MS)
  })

  it('double à chaque reprise', () => {
    expect([0, 1, 2, 3].map(espacementAvant)).toEqual([5, 10, 20, 40].map((m) => m * MINUTE))
  })

  it('⚠️ couvre environ une journée avant de renoncer', () => {
    const total = Array.from({ length: PLAFOND_REPRISES }, (_, n) => espacementAvant(n)).reduce(
      (a, b) => a + b,
    )
    expect(total).toBeGreaterThan(18 * 60 * MINUTE)
    expect(total).toBeLessThan(26 * 60 * MINUTE)
  })

  /**
   * ⛔ LES DEUX FORMES DE LA RÈGLE S’ACCORDENT. Le SQL compare aux instants de
   *    `limitesDeReprise` ; `repriseDue` énonce la règle pour un retour. Si l’une
   *    bouge sans l’autre, ce test rougit.
   */
  it('⛔ `limitesDeReprise` et `repriseDue` disent la même chose', () => {
    const limites = limitesDeReprise(MAINTENANT)

    for (let faites = 0; faites < PLAFOND_REPRISES; faites += 1) {
      const limite = limites[faites] as Date
      const juste = new Date(limite.getTime() - 1)
      const pile = new Date(limite.getTime())

      expect(repriseDue(faites, juste, MAINTENANT)).toBe(true)
      expect(repriseDue(faites, pile, MAINTENANT)).toBe(false)
    }
  })

  it('⛔ ne reprend plus au plafond', () => {
    expect(repriseDue(PLAFOND_REPRISES, new Date(0), MAINTENANT)).toBe(false)
    expect(limitesDeReprise(MAINTENANT)).toHaveLength(PLAFOND_REPRISES)
  })
})

describe('reprendre', () => {
  it('redemande les notes, et compte celles qui sont écrites', async () => {
    const ports = bouchon(
      [
        { retourId: 'r1', reprises: 1 },
        { retourId: 'r2', reprises: 3 },
      ],
      {},
    )

    const bilan = await reprendre(ports, { maintenant: MAINTENANT })

    expect(ports.appels).toEqual(['r1', 'r2'])
    expect(bilan).toMatchObject({ reprises: 2, ecrites: 2, enAttente: 0, impossibles: [] })
    expect(ports.renonces).toEqual([])
  })

  it('⚠️ un modèle encore muet laisse la note en attente — sans renoncer', async () => {
    const ports = bouchon([{ retourId: 'r1', reprises: 2 }], { r1: 'modele_indisponible' })

    const bilan = await reprendre(ports, { maintenant: MAINTENANT })

    expect(bilan.enAttente).toBe(1)
    expect(ports.renonces).toEqual([])
  })

  it('⛔ au plafond, renonce — et c’est ce qui alertera', async () => {
    const ports = bouchon([{ retourId: 'r1', reprises: PLAFOND_REPRISES }], {
      r1: 'modele_indisponible',
    })

    const bilan = await reprendre(ports, { maintenant: MAINTENANT })

    expect(bilan.impossibles).toEqual(['r1'])
    expect(ports.renonces).toEqual([['r1', 'plafond']])
  })

  it('⛔ une exception vaut un échec du modèle, et ne bloque pas les suivants', async () => {
    const ports = bouchon(
      [
        { retourId: 'r1', reprises: PLAFOND_REPRISES },
        { retourId: 'r2', reprises: 1 },
      ],
      { r1: new Error('Postgres injoignable') },
    )

    const bilan = await reprendre(ports, { maintenant: MAINTENANT })

    expect(ports.appels).toEqual(['r1', 'r2'])
    expect(bilan.impossibles).toEqual(['r1'])
    expect(bilan.ecrites).toBe(1)
  })

  it('⛔ `rien_a_synthetiser` est abandonné tout de suite, sans attendre le plafond', async () => {
    const ports = bouchon([{ retourId: 'r_audio', reprises: 1 }], { r_audio: 'rien_a_synthetiser' })

    const bilan = await reprendre(ports, { maintenant: MAINTENANT })

    expect(ports.renonces).toEqual([['r_audio', 'rien_a_synthetiser']])
    expect(bilan).toMatchObject({ sansParole: 1, impossibles: [], enAttente: 0 })
  })

  it('une note écrite entre-temps par une autre main ne compte pour rien', async () => {
    const ports = bouchon([{ retourId: 'r1', reprises: PLAFOND_REPRISES }], { r1: 'deja_faite' })

    const bilan = await reprendre(ports, { maintenant: MAINTENANT })

    expect(ports.renonces).toEqual([])
    expect(bilan).toMatchObject({ ecrites: 0, enAttente: 0, impossibles: [] })
  })

  it('⛔ s’arrête au nombre de la passe', async () => {
    const file = Array.from({ length: 30 }, (_, n) => ({ retourId: `r${n}`, reprises: 1 }))
    const ports = bouchon(file, {})

    const bilan = await reprendre(ports, { maintenant: MAINTENANT, parPasse: 20 })

    expect(bilan.reprises).toBe(20)
    expect(file).toHaveLength(10)
  })

  it('⛔ ne réserve RIEN au-delà du budget — une reprise comptée est une reprise tentée', async () => {
    let temps = 0
    const reserver = vi.fn(async () => ({ retourId: 'r', reprises: 1 }))
    const ports: PortsReprise = {
      reserver,
      synthetiser: async () => {
        temps += 2 * MINUTE
        return 'modele_indisponible'
      },
      renoncer: async () => undefined,
    }

    const bilan = await reprendre(ports, {
      maintenant: MAINTENANT,
      budgetMs: 3 * MINUTE,
      horloge: () => temps,
    })

    // 0 → réserve, 2 min → réserve, 4 min → s’arrête AVANT de réserver.
    expect(reserver).toHaveBeenCalledTimes(2)
    expect(bilan.reprises).toBe(2)
  })

  it('ne réserve rien du tout quand le budget est déjà mangé', async () => {
    const reserver = vi.fn(async () => null)

    await reprendre(
      { reserver, synthetiser: async () => 'ecrite', renoncer: async () => undefined },
      { budgetMs: 0 },
    )

    expect(reserver).not.toHaveBeenCalled()
  })
})

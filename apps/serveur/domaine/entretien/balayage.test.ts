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
  BUDGET_PASSE_MS,
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

/*
 * ⛔ CE QUI NE SE PROUVE PAS ICI, ET QUI A FAILLI PASSER POUR PROUVÉ.
 *
 * ⚠️ Il y avait à cet endroit un test intitulé « la règle et sa forme SQL disent
 *    la même chose ». Il comparait `estMuet(…)` à
 *    `dernierSigne < instantLimite(…)` — c’est-à-dire AU CORPS LITTÉRAL de
 *    `estMuet`. Il ne touchait aucun SQL et ne joignait aucun Postgres : passer
 *    `REFERMER` de `< $1` à `<= $1` ne l’aurait pas fait rougir une seule fois.
 *
 * ⛔ L’accord des deux formes ne se prouve QUE contre la vraie requête. Il l’est
 *    dans `balayage.integration.test.ts` §« la borne, contre le vrai SQL », aux
 *    bornes N−1 ms, N exactement, et N+1 ms.
 */

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
    expect(bilan).toEqual({ clos: 2, synthetises: 2, echoues: 0, reportes: 0 })
  })

  it('⛔ un aval qui échoue ne bloque pas les suivants', async () => {
    const aval = vi.fn(async (id: string) => {
      if (id === 'r2') throw new Error('modèle indisponible')
    })
    const signaler = vi.fn()
    const ports = portsBouchon({ clore: async () => ['r1', 'r2', 'r3'], aval, signaler })

    const bilan = await balayer(ports, { maintenant: MAINTENANT })

    expect(aval).toHaveBeenCalledTimes(3)
    expect(bilan).toEqual({ clos: 3, synthetises: 2, echoues: 1, reportes: 0 })
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
      reportes: 0,
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

    expect(bilan).toEqual({ clos: 0, synthetises: 0, echoues: 0, reportes: 0 })
    expect(aval).not.toHaveBeenCalled()
    expect(signaler).not.toHaveBeenCalled()
  })
})

/**
 * ⛔ CE QUE `PAR_PASSE` NE BORNE PAS.
 *
 * ⚠️ Vingt retours ne font pas une passe courte : `Modele.synthese` porte
 *    `AbortSignal.timeout(60 s)` ET `maxRetries: 2`, soit trois minutes de pire
 *    cas POUR UN SEUL retour. Vingt lents faisaient une passe d’une heure — et
 *    pendant cette heure, le verrou `enCours` d’`infra/filet.ts` faisait sauter
 *    les onze ticks suivants. La borne en nombre ne dit rien du temps.
 */
describe('le budget de passe', () => {
  it('⚠️ est plus court que le pas — une passe ne mange jamais la suivante', () => {
    expect(BUDGET_PASSE_MS).toBeLessThan(PAS_BALAYAGE_MS)
  })

  it('⛔ n’entame plus d’aval au-delà du budget, et compte les reportés', async () => {
    const vus: string[] = []
    let horloge = 0

    const ports = portsBouchon({
      clore: async () => ['r1', 'r2', 'r3', 'r4'],
      aval: async (retourId) => {
        vus.push(retourId)
        // Chaque aval coûte une minute de plus que le budget n’en contient.
        horloge += 2 * MINUTE
      },
    })

    const bilan = await balayer(ports, {
      maintenant: MAINTENANT,
      budgetMs: 3 * MINUTE,
      horloge: () => horloge,
    })

    // ⚠️ Deux avals : le premier à t=0, le second à t=2 min. À t=4 min le budget
    //    est dépassé, et les deux derniers sont REPORTÉS sans être entamés.
    expect(vus).toEqual(['r1', 'r2'])
    expect(bilan).toEqual({ clos: 4, synthetises: 2, echoues: 0, reportes: 2 })
  })

  it('⛔ n’INTERROMPT jamais un aval en cours — une synthèse coupée coûte le jeton sans écrire la note', async () => {
    let horloge = 0
    const ports = portsBouchon({
      clore: async () => ['r1'],
      aval: async () => {
        horloge += 60 * MINUTE
      },
    })

    const bilan = await balayer(ports, {
      maintenant: MAINTENANT,
      budgetMs: 1,
      horloge: () => horloge,
    })

    expect(bilan).toEqual({ clos: 1, synthetises: 1, echoues: 0, reportes: 0 })
  })

  it('⚠️ dit dans les journaux que des notes manquent, pour qu’on puisse les rattraper', async () => {
    const signaler = vi.fn()
    let horloge = 0

    const ports = portsBouchon({
      clore: async () => ['r1', 'r2'],
      aval: async () => {
        horloge += 10 * MINUTE
      },
      signaler,
    })

    await balayer(ports, { maintenant: MAINTENANT, budgetMs: 1000, horloge: () => horloge })

    expect(signaler).toHaveBeenCalledTimes(1)
    expect(signaler.mock.calls[0]?.[0]).toContain('1 entretien(s) refermé(s) sans note')
  })
})

describe('ce que les journaux disent d’un aval en échec', () => {
  /**
   * ⛔ LE RETOUR EST TERMINAL. Il est déjà `abandonne`, et `clore` ne regarde
   *    que les `en_cours` : aucune passe ne le reprendra. Sans son identifiant,
   *    le journal dit qu’une note a manqué sans dire laquelle — et
   *    `bilan.echoues` ne donne qu’un compte.
   */
  it('⛔ nomme le retour dont la note a manqué', async () => {
    const signaler = vi.fn()
    const ports = portsBouchon({
      clore: async () => ['ret_muet_42'],
      aval: async () => {
        throw new Error('modèle indisponible')
      },
      signaler,
    })

    await balayer(ports, { maintenant: MAINTENANT })

    expect(signaler).toHaveBeenCalledTimes(1)
    expect(signaler.mock.calls[0]?.[0]).toContain('ret_muet_42')
  })

  /** ⛔ Et jamais la parole : un cuid suffit, le corps du retour ne sort pas. */
  it('⛔ ne dit que l’identifiant — jamais ce que la personne a dit', async () => {
    const signaler = vi.fn()
    const ports = portsBouchon({
      clore: async () => ['ret_muet_42'],
      aval: async () => {
        throw new Error('modèle indisponible')
      },
      signaler,
    })

    await balayer(ports, { maintenant: MAINTENANT })

    const quoi = String(signaler.mock.calls[0]?.[0])
    expect(quoi).toMatch(/^balayage — aval de ret_muet_42 \(refermé par silence\)$/)
  })
})

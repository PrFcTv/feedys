/**
 * L’envoi — et surtout ce qui se passe quand il rate.
 *
 * ⚠️ L’acceptation de P-009 tient en une phrase : SMTP coupé → le retour reste
 *    `envoye`, la notification passe à `echoue`. Rien n’est perdu.
 */
import { describe, expect, it, vi } from 'vitest'

import { canalEmail, envoyerNote, envoyerParCanal, notifierParCanaux } from './envoyer'
import type {
  CanalNotification,
  PortCanal,
  PortDepotNotifications,
  PortsNotification,
} from './envoyer'
import { EXEMPLE_NOTIFICATION } from './exemple'

function bouchon(surcharges: Partial<PortsNotification> = {}): {
  ports: PortsNotification
  closes: Array<{ id: string; erreur: string | null }>
  envoyes: number
} {
  const closes: Array<{ id: string; erreur: string | null }> = []
  let envoyes = 0

  const ports: PortsNotification = {
    destinataire: 'developpeur@exemple.fr',
    depot: {
      charger: async () => EXEMPLE_NOTIFICATION,
      dejaEnvoyee: async () => false,
      ouvrir: async () => 'notif_1',
      clore: async (id, erreur) => {
        closes.push({ id, erreur })
      },
    },
    smtp: {
      envoyer: async () => {
        envoyes += 1
      },
    },
    ...surcharges,
  }

  return {
    ports,
    closes,
    get envoyes() {
      return envoyes
    },
  }
}

describe('envoyerNote', () => {
  it('envoie et clôt la ligne sans erreur', async () => {
    const b = bouchon()
    const resultat = await envoyerNote('ret_1', b.ports)

    expect(resultat).toEqual({ ok: true, statut: 'envoye' })
    expect(b.closes).toEqual([{ id: 'notif_1', erreur: null }])
  })

  it('⚠️ SMTP coupé : la ligne passe à `echoue`, et rien ne lève', async () => {
    const signaler = vi.fn()
    const b = bouchon({
      smtp: {
        envoyer: async () => {
          throw new Error('ECONNREFUSED 127.0.0.1:587')
        },
      },
      signaler,
    })

    const resultat = await envoyerNote('ret_1', b.ports)

    expect(resultat.ok).toBe(true)
    expect(resultat).toMatchObject({ statut: 'echoue' })
    expect(b.closes[0]?.erreur).toContain('ECONNREFUSED')
    expect(signaler).toHaveBeenCalledOnce()
  })

  it('ouvre la ligne AVANT de tenter l’envoi', async () => {
    const ordre: string[] = []
    const b = bouchon()
    const ports: PortsNotification = {
      ...b.ports,
      depot: {
        ...b.ports.depot,
        ouvrir: async () => {
          ordre.push('ouvrir')
          return 'notif_1'
        },
      },
      smtp: {
        envoyer: async () => {
          ordre.push('envoyer')
        },
      },
    }

    await envoyerNote('ret_1', ports)
    expect(ordre).toEqual(['ouvrir', 'envoyer'])
  })

  it('refuse un retour inconnu, sans ouvrir de ligne', async () => {
    const ouvrir = vi.fn()
    const b = bouchon()
    const resultat = await envoyerNote('ret_1', {
      ...b.ports,
      depot: { ...b.ports.depot, charger: async () => null, ouvrir },
    })

    expect(resultat).toEqual({ ok: false, motif: 'retour_inconnu' })
    expect(ouvrir).not.toHaveBeenCalled()
  })

  it('⛔ ne renvoie pas une note déjà notifiée', async () => {
    const b = bouchon()
    const resultat = await envoyerNote('ret_1', {
      ...b.ports,
      depot: { ...b.ports.depot, dejaEnvoyee: async () => true },
    })

    expect(resultat).toEqual({ ok: false, motif: 'deja_envoyee' })
    expect(b.envoyes).toBe(0)
  })

  it('refuse sans destinataire', async () => {
    const b = bouchon({ destinataire: '  ' })
    expect(await envoyerNote('ret_1', b.ports)).toEqual({ ok: false, motif: 'sans_destinataire' })
  })

  it('tronque un message d’erreur bavard', async () => {
    const b = bouchon({
      smtp: {
        envoyer: async () => {
          throw new Error('x'.repeat(5_000))
        },
      },
    })

    await envoyerNote('ret_1', b.ports)
    expect(b.closes[0]?.erreur?.length).toBe(500)
  })
})

describe('les canaux — Telegram et l’email, une fois chacun', () => {
  function depotParCanal() {
    const ouvertes: Array<{ retour: string; canal: CanalNotification }> = []
    const depot: PortDepotNotifications = {
      charger: async () => EXEMPLE_NOTIFICATION,
      dejaEnvoyee: async (retourId, canal) =>
        ouvertes.some((ligne) => ligne.retour === retourId && ligne.canal === canal),
      ouvrir: async (retourId, _destinataire, canal) => {
        ouvertes.push({ retour: retourId, canal })
        return `notif_${canal}`
      },
      clore: async () => undefined,
    }
    return { depot, ouvertes }
  }

  function canal(nom: CanalNotification, envoyer: PortCanal['envoyer'] = async () => undefined): PortCanal {
    return { canal: nom, destinataire: nom === 'email' ? 'dev@exemple.fr' : '-1000000000042', envoyer }
  }

  it('⚠️ les deux partent quand les deux sont configurés — chacun sa ligne', async () => {
    const { depot, ouvertes } = depotParCanal()
    const telegram = vi.fn(async () => undefined)
    const email = vi.fn(async () => undefined)

    await notifierParCanaux('ret_1', {
      depot,
      canaux: [canal('telegram', telegram), canal('email', email)],
    })

    expect(telegram).toHaveBeenCalledOnce()
    expect(email).toHaveBeenCalledOnce()
    expect(ouvertes.map((ligne) => ligne.canal)).toEqual(['telegram', 'email'])
  })

  it('⛔ un canal coupé n’empêche pas l’autre', async () => {
    const { depot } = depotParCanal()
    const email = vi.fn(async () => undefined)

    await notifierParCanaux('ret_1', {
      depot,
      canaux: [
        canal('telegram', async () => {
          throw new Error('Telegram injoignable')
        }),
        canal('email', email),
      ],
      signaler: () => undefined,
    })

    expect(email).toHaveBeenCalledOnce()
  })

  it('⛔ une base qui tombe sur un canal n’empêche pas l’autre, et ne remonte pas', async () => {
    const { depot } = depotParCanal()
    const email = vi.fn(async () => undefined)
    const signaler = vi.fn()
    let premier = true

    await expect(
      notifierParCanaux('ret_1', {
        depot: {
          ...depot,
          ouvrir: async (retourId, destinataire, nom) => {
            if (premier) {
              premier = false
              throw new Error('Postgres injoignable')
            }
            return depot.ouvrir(retourId, destinataire, nom)
          },
        },
        canaux: [canal('telegram'), canal('email', email)],
        signaler,
      }),
    ).resolves.toBeUndefined()

    expect(email).toHaveBeenCalledOnce()
    expect(signaler.mock.calls[0]?.[0]).toContain('Telegram')
  })

  it('⛔ « déjà envoyée » se juge PAR CANAL', async () => {
    const { depot } = depotParCanal()
    await notifierParCanaux('ret_1', { depot, canaux: [canal('email')] })

    const telegram = vi.fn(async () => undefined)
    const email = vi.fn(async () => undefined)
    await notifierParCanaux('ret_1', { depot, canaux: [canal('telegram', telegram), canal('email', email)] })

    expect(telegram).toHaveBeenCalledOnce()
    expect(email).not.toHaveBeenCalled()
  })

  it('⛔ une ligne que l’index refuse vaut « déjà envoyée » — et rien ne part', async () => {
    const envoyer = vi.fn(async () => undefined)

    const resultat = await envoyerParCanal('ret_1', {
      depot: {
        charger: async () => EXEMPLE_NOTIFICATION,
        dejaEnvoyee: async () => false,
        ouvrir: async () => null,
        clore: async () => undefined,
      },
      canal: canal('telegram', envoyer),
    })

    expect(resultat).toEqual({ ok: false, motif: 'deja_envoyee' })
    expect(envoyer).not.toHaveBeenCalled()
  })

  it('⚠️ aucun canal : rien ne part, et ça se dit', async () => {
    const { depot } = depotParCanal()
    const signaler = vi.fn()

    await notifierParCanaux('ret_1', { depot, canaux: [], signaler })

    expect(signaler).toHaveBeenCalledOnce()
    expect(signaler.mock.calls[0]?.[0]).toContain('aucun canal configuré')
  })

  it('l’email garde la note entière — c’est le canal qui la porte', async () => {
    const envoyer = vi.fn(async () => undefined)

    await canalEmail({ envoyer }, 'dev@exemple.fr').envoyer(EXEMPLE_NOTIFICATION)

    expect(envoyer).toHaveBeenCalledWith('dev@exemple.fr', expect.objectContaining({
      corps: expect.stringContaining('dès que je reviens en arrière il se remet à zéro'),
    }))
  })
})

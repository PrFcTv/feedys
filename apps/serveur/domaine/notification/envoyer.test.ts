/**
 * L’envoi — et surtout ce qui se passe quand il rate.
 *
 * ⚠️ L’acceptation de P-009 tient en une phrase : SMTP coupé → le retour reste
 *    `envoye`, la notification passe à `echoue`. Rien n’est perdu.
 */
import { describe, expect, it, vi } from 'vitest'

import { envoyerNote } from './envoyer'
import type { PortsNotification } from './envoyer'
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

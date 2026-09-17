/**
 * « Refaire la note » — ce qu’il refuse, et ce qu’il dit.
 */
import { describe, expect, it, vi } from 'vitest'

import type { PortsRefaire } from './refaire'
import { refaireLaNote } from './refaire'

function ports(surcharges: Partial<PortsRefaire> = {}): PortsRefaire {
  return {
    statut: async () => 'envoye',
    aSaNote: async () => false,
    synthetiser: vi.fn(async () => 'ecrite' as const),
    ...surcharges,
  }
}

describe('refaireLaNote', () => {
  it('demande la note d’un retour qui n’en a pas', async () => {
    const p = ports()

    expect(await refaireLaNote('r1', p)).toEqual({ ok: true })
    expect(p.synthetiser).toHaveBeenCalledWith('r1')
  })

  it('⛔ refuse un retour qui a déjà sa note — AVANT tout appel au modèle', async () => {
    const p = ports({ aSaNote: async () => true })

    expect(await refaireLaNote('r1', p)).toEqual({ ok: false, motif: 'deja_faite' })
    expect(p.synthetiser).not.toHaveBeenCalled()
  })

  it('refuse un retour inconnu', async () => {
    const p = ports({ statut: async () => null })

    expect(await refaireLaNote('r_fantome', p)).toEqual({ ok: false, motif: 'retour_inconnu' })
    expect(p.synthetiser).not.toHaveBeenCalled()
  })

  it('⛔ refuse un entretien en cours — sa vraie note viendra à la fin', async () => {
    const p = ports({ statut: async () => 'en_cours' })

    expect(await refaireLaNote('r1', p)).toEqual({ ok: false, motif: 'en_cours' })
    expect(p.synthetiser).not.toHaveBeenCalled()
  })

  it('refait la note d’un retour déjà lu ou écarté — c’est une décision humaine', async () => {
    const p = ports({ statut: async () => 'ecarte' })

    expect(await refaireLaNote('r1', p)).toEqual({ ok: true })
  })

  it('dit quand le modèle ne répond toujours pas', async () => {
    const p = ports({ synthetiser: async () => 'modele_indisponible' })

    expect(await refaireLaNote('r1', p)).toEqual({ ok: false, motif: 'modele_indisponible' })
  })

  it('dit quand il n’y a rien à synthétiser', async () => {
    const p = ports({ synthetiser: async () => 'rien_a_synthetiser' })

    expect(await refaireLaNote('r1', p)).toEqual({ ok: false, motif: 'rien_a_synthetiser' })
  })

  it('⚠️ une note écrite entre-temps par le filet vaut refus, pas succès', async () => {
    const p = ports({ synthetiser: async () => 'deja_faite' })

    expect(await refaireLaNote('r1', p)).toEqual({ ok: false, motif: 'deja_faite' })
  })
})

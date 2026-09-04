import { describe, expect, it, vi } from 'vitest'

import { ouvrirMicro, rms } from './micro'

describe('rms', () => {
  /**
   * ⚠️ Le piège de `getByteTimeDomainData` : le silence vaut 128, pas 0.
   *    L’oublier donne une onde qui bat à fond en permanence — une onde fausse
   *    d’un autre genre, et le fichier existe pour ça.
   */
  it('rend 0 sur un silence — qui vaut 128, pas 0', () => {
    expect(rms(new Uint8Array(64).fill(128))).toBe(0)
  })

  it('monte avec l’amplitude', () => {
    const faible = rms(new Uint8Array(64).fill(140))
    const fort = rms(new Uint8Array(64).fill(200))

    expect(faible).toBeGreaterThan(0)
    expect(fort).toBeGreaterThan(faible)
  })

  it('ne dépend pas du signe — un creux vaut une crête', () => {
    expect(rms(new Uint8Array(64).fill(78))).toBeCloseTo(rms(new Uint8Array(64).fill(178)), 6)
  })

  it('rend 0 sur rien', () => {
    expect(rms(new Uint8Array(0))).toBe(0)
  })
})

function fauxContexte() {
  const analyseur = {
    fftSize: 0,
    getByteTimeDomainData: (cible: Uint8Array) => cible.fill(160),
  }
  const source = { connect: vi.fn(), disconnect: vi.fn() }
  const ferme = vi.fn().mockResolvedValue(undefined)

  // ⚠️ `new Contexte()` : une fonction fléchée n’est pas constructible.
  const Contexte = function () {
    return { createMediaStreamSource: () => source, createAnalyser: () => analyseur, close: ferme }
  } as unknown as typeof AudioContext

  return { Contexte, source, ferme }
}

function fauxFlux() {
  const piste = { stop: vi.fn() }
  return { flux: { getTracks: () => [piste] } as unknown as MediaStream, piste }
}

describe('ouvrirMicro', () => {
  it('ouvre le flux, branche l’analyseur, et lit un niveau réel', async () => {
    const { flux } = fauxFlux()
    const { Contexte, source } = fauxContexte()
    const getUserMedia = vi.fn().mockResolvedValue(flux)

    const ouverture = await ouvrirMicro({
      media: { getUserMedia } as unknown as MediaDevices,
      ContexteAudio: Contexte,
    })

    expect(ouverture.ok).toBe(true)
    expect(source.connect).toHaveBeenCalledOnce()
    expect(ouverture.ok && ouverture.micro.niveau()).toBeGreaterThan(0)
    // ⛔ Rien n’est branché sur la sortie : personne ne doit s’entendre.
    expect(source.connect).not.toHaveBeenCalledWith(expect.objectContaining({ destination: expect.anything() }))
  })

  /**
   * ⚠️ Sinon la pastille d’enregistrement du navigateur reste allumée après la
   *    fermeture du panneau. C’est ce que la personne voit, et c’est ce qui la
   *    fait désinstaller.
   */
  it('rend tout au navigateur : pistes arrêtées ET contexte fermé', async () => {
    const { flux, piste } = fauxFlux()
    const { Contexte, source, ferme } = fauxContexte()

    const ouverture = await ouvrirMicro({
      media: { getUserMedia: vi.fn().mockResolvedValue(flux) } as unknown as MediaDevices,
      ContexteAudio: Contexte,
    })

    if (!ouverture.ok) throw new Error('le micro devait s’ouvrir')
    ouverture.micro.arreter()

    expect(piste.stop).toHaveBeenCalledOnce()
    expect(source.disconnect).toHaveBeenCalledOnce()
    expect(ferme).toHaveBeenCalledOnce()
  })

  it('rend un refus quand la permission est refusée — sans exploser', async () => {
    const { Contexte } = fauxContexte()

    const ouverture = await ouvrirMicro({
      media: { getUserMedia: vi.fn().mockRejectedValue(new Error('NotAllowedError')) } as unknown as MediaDevices,
      ContexteAudio: Contexte,
    })

    expect(ouverture).toEqual({ ok: false, refus: 'refuse' })
  })

  it('rend « indisponible » là où il n’y a ni getUserMedia ni Web Audio', async () => {
    expect(await ouvrirMicro({ media: {} as MediaDevices })).toEqual({ ok: false, refus: 'indisponible' })
  })
})

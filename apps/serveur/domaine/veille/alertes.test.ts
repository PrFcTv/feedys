/**
 * La veille, sans base — une alerte par incident, jamais de parole, et Telegram
 * seul.
 *
 * ⚠️ La réservation entre deux conteneurs — l’index partiel — est éprouvée
 *    contre un vrai Postgres, dans `depot-veille.integration.test.ts`.
 */
import { describe, expect, it, vi } from 'vitest'

import type { EtatModele } from './modele'
import type { GenreAlerte, IncidentOuvert, NotesImpossibles, PortsVeille } from './alertes'
import {
  MINIMUM_RETOURS_VOIX,
  OUVERTURES,
  SILENCE_MAX_MS,
  TELEGRAM_ABSENT,
  fermeture,
  veiller,
  verdictAucunRetour,
  verdictVoix,
} from './alertes'

const MAINTENANT = new Date('2026-09-17T10:00:00.000Z')
const INSTALLATION = { produits: ['Pistache'], origine: 'https://feedys.exemple.fr' }
const SAIN: EtatModele = { etat: 'sain', appels: 5, echecs: 0 }
const EN_ECHEC: EtatModele = { etat: 'en_echec', appels: 4, echecs: 4 }

/** Une base d’incidents en mémoire, et des faits qu’on règle à la main. */
function monde(faits: {
  modele?: EtatModele
  impossibles?: NotesImpossibles
  noteEcrite?: boolean
  dernierRetourLe?: Date | null
  poseLe?: Date | null
  voix?: { voix: number; total: number }
  prevenir?: PortsVeille['prevenir'] | null
}) {
  const incidents: Array<IncidentOuvert & { genre: GenreAlerte; closeLe: Date | null; erreur?: string | null }> = []
  const envoyes: string[] = []
  const journal: string[] = []
  let n = 0

  const prevenir =
    faits.prevenir === null
      ? undefined
      : (faits.prevenir ??
        (async (texte: string) => {
          envoyes.push(texte)
        }))

  const ports: PortsVeille = {
    ouvertes: async () =>
      new Map(incidents.filter((i) => i.closeLe === null).map((i) => [i.genre, i] as const)),
    ouvrir: async (genre) => {
      if (incidents.some((i) => i.genre === genre && i.closeLe === null)) return null
      n += 1
      incidents.push({ id: `a${n}`, genre, ouverteLe: MAINTENANT, envoyeeLe: null, closeLe: null })
      return `a${n}`
    },
    fermer: async (id) => {
      const incident = incidents.find((i) => i.id === id && i.closeLe === null)
      if (!incident) return false
      incident.closeLe = MAINTENANT
      return true
    },
    consigner: async (id, erreur) => {
      const incident = incidents.find((i) => i.id === id)
      if (incident) incident.erreur = erreur
    },
    derniereFermeture: async () => null,
    impossiblesDepuis: async () => faits.impossibles ?? { ids: [], total: 0 },
    noteEcriteDepuis: async () => faits.noteEcrite ?? false,
    retours: async () => ({
      dernierLe: faits.dernierRetourLe === undefined ? MAINTENANT : faits.dernierRetourLe,
      poseLe: faits.poseLe === undefined ? MAINTENANT : faits.poseLe,
    }),
    partVoix: async () => faits.voix ?? { voix: 0, total: 0 },
    etatModele: () => faits.modele ?? { etat: 'inconnu', appels: 0, echecs: 0 },
    installation: async () => INSTALLATION,
    ...(prevenir === undefined ? {} : { prevenir }),
    journal: (texte) => journal.push(texte),
  }

  return { ports, incidents, envoyes, journal, faits }
}

describe('⛔ une alerte par incident, pas une par passe', () => {
  it('une note devenue impossible fait partir UNE alerte — la passe suivante se tait', async () => {
    const m = monde({ impossibles: { ids: ['r_1'], total: 1 } })

    await veiller(m.ports, MAINTENANT)
    await veiller(m.ports, MAINTENANT)
    await veiller(m.ports, MAINTENANT)

    expect(m.envoyes).toHaveLength(1)
    expect(m.envoyes[0]).toContain('1 note(s) devenue(s) impossible(s)')
    expect(m.envoyes[0]).toContain('https://feedys.exemple.fr/bo/r/r_1')
  })

  it('le modèle en échec ouvre, rétabli ferme — deux messages en tout, sur dix passes', async () => {
    const m = monde({ modele: EN_ECHEC })

    for (let passe = 0; passe < 5; passe += 1) await veiller(m.ports, MAINTENANT)
    m.faits.modele = SAIN
    for (let passe = 0; passe < 5; passe += 1) await veiller(m.ports, MAINTENANT)

    expect(m.envoyes).toHaveLength(2)
    expect(m.envoyes[0]).toContain('Le modèle échoue : 4 appel(s) sur 4')
    expect(m.envoyes[1]).toContain('Le modèle répond de nouveau.')
  })

  it('⚠️ « inconnu » ne touche à rien — un redémarrage n’ouvre ni ne ferme', async () => {
    const m = monde({ modele: EN_ECHEC })
    await veiller(m.ports, MAINTENANT)

    m.faits.modele = { etat: 'inconnu', appels: 0, echecs: 0 }
    await veiller(m.ports, MAINTENANT)

    expect(m.envoyes).toHaveLength(1)
    expect(m.incidents[0]?.closeLe).toBeNull()
  })

  it('⛔ un second conteneur qui arrive après ne prévient pas', async () => {
    const m = monde({ modele: EN_ECHEC })
    const ouvrir = vi.fn(async () => null)

    await veiller({ ...m.ports, ouvrir }, MAINTENANT)

    expect(ouvrir).toHaveBeenCalled()
    expect(m.envoyes).toEqual([])
  })

  it('les notes impossibles se referment quand une note est de nouveau écrite — et disent ce qui reste à refaire', async () => {
    const m = monde({ impossibles: { ids: ['r_1'], total: 1 } })
    await veiller(m.ports, MAINTENANT)

    m.faits.noteEcrite = true
    m.faits.impossibles = { ids: ['r_2', 'r_3'], total: 2 }
    await veiller(m.ports, MAINTENANT)

    expect(m.envoyes).toHaveLength(2)
    expect(m.envoyes[1]).toContain('Le modèle rédige de nouveau des notes.')
    expect(m.envoyes[1]).toContain('2 autre(s) note(s)')
    expect(m.envoyes[1]).toContain('/bo/r/r_3')
  })
})

describe('⛔ Telegram, et lui seul', () => {
  it('sans Telegram, l’alerte reste en console, et l’incident le consigne', async () => {
    const m = monde({ modele: EN_ECHEC, prevenir: null })

    await veiller(m.ports, MAINTENANT)

    expect(m.journal).toHaveLength(1)
    expect(m.journal[0]).toContain('Le modèle échoue')
    expect(m.incidents[0]?.erreur).toBe(TELEGRAM_ABSENT)
  })

  it('Telegram en échec : l’erreur est consignée, et la passe suivante ne réessaie pas', async () => {
    const prevenir = vi.fn(async () => {
      throw new Error('le bot ne peut pas écrire dans ce chat (403)')
    })
    const m = monde({ modele: EN_ECHEC, prevenir })

    await veiller(m.ports, MAINTENANT)
    await veiller(m.ports, MAINTENANT)

    expect(prevenir).toHaveBeenCalledOnce()
    expect(m.incidents[0]?.erreur).toContain('403')
  })

  it('la console voit toujours la même chose que Telegram', async () => {
    const m = monde({ modele: EN_ECHEC })

    await veiller(m.ports, MAINTENANT)

    expect(m.journal).toEqual(m.envoyes)
  })

  it('⛔ un genre qui échoue n’empêche pas les autres', async () => {
    const m = monde({ modele: EN_ECHEC })

    const bilan = await veiller(
      {
        ...m.ports,
        impossiblesDepuis: async () => {
          throw new Error('Postgres injoignable')
        },
      },
      MAINTENANT,
    )

    expect(bilan.erreurs.map((e) => e.genre)).toEqual(['notes_impossibles'])
    expect(bilan.ouverts).toEqual(['modele_en_echec'])
  })
})

describe('⛔ une alerte ne contient ni parole ni nom', () => {
  /**
   * ⚠️ La veille ne reçoit, par construction, que des nombres, des dates et des
   *    identifiants — `PortsVeille` n’a aucune méthode qui rende un texte de
   *    retour. Ce test vérifie l’autre moitié : que chaque message n’est fait que
   *    de ce qu’on lui a donné, et de nos propres phrases.
   */
  it('chaque message est fait de l’installation, de nombres, et d’identifiants', () => {
    const messages = [
      OUVERTURES.notes_impossibles(INSTALLATION, { ids: ['ret_aaa', 'ret_bbb'], total: 2 }),
      OUVERTURES.modele_en_echec(INSTALLATION, EN_ECHEC),
      OUVERTURES.aucun_retour(INSTALLATION, new Date('2026-09-01T08:00:00.000Z')),
      OUVERTURES.voix_minoritaire(INSTALLATION, 3, 12),
      ...(['notes_impossibles', 'modele_en_echec', 'aucun_retour', 'voix_minoritaire'] as const).map(
        (genre) => fermeture(genre, INSTALLATION),
      ),
    ]

    for (const message of messages) {
      expect(message.split('\n')[0]).toMatch(/^(⚠️|✅) Feedys · Pistache · feedys\.exemple\.fr$/)
    }

    expect(messages[3]).toContain('3 sur 12 en trente jours (25 %)')
    expect(messages[2]).toContain('le dernier date du 2026-09-01')
  })

  it('une longue liste de retours s’arrête à dix, et le compte reste juste', () => {
    const ids = Array.from({ length: 11 }, (_, n) => `ret_${n}`)
    const message = OUVERTURES.notes_impossibles(INSTALLATION, { ids, total: 37 })

    expect(message).toContain('37 note(s)')
    expect(message).toContain('/bo/r/ret_9')
    expect(message).not.toContain('/bo/r/ret_10')
    expect(message).toContain('… et 27 autre(s)')
    expect(message.endsWith('→ https://feedys.exemple.fr/bo')).toBe(true)
  })
})

describe('les seuils d’usage', () => {
  it('⛔ plus aucun retour depuis sept jours : incident', () => {
    const vieux = new Date(MAINTENANT.getTime() - SILENCE_MAX_MS - 1)
    expect(verdictAucunRetour(vieux, vieux, MAINTENANT)).toBe(true)
    expect(verdictAucunRetour(MAINTENANT, vieux, MAINTENANT)).toBe(false)
  })

  it('⚠️ un produit qui n’a jamais rien reçu est jugé sur sa pose', () => {
    const recent = new Date(MAINTENANT.getTime() - 1000)
    const vieux = new Date(MAINTENANT.getTime() - SILENCE_MAX_MS - 1)

    expect(verdictAucunRetour(null, recent, MAINTENANT)).toBe(false)
    expect(verdictAucunRetour(null, vieux, MAINTENANT)).toBe(true)
  })

  it('sans produit actif, il n’y a rien à attendre', () => {
    expect(verdictAucunRetour(null, null, MAINTENANT)).toBeNull()
  })

  it('un retour qui arrive referme l’incident', async () => {
    const vieux = new Date(MAINTENANT.getTime() - SILENCE_MAX_MS - 1)
    const m = monde({ dernierRetourLe: vieux, poseLe: vieux })
    await veiller(m.ports, MAINTENANT)

    m.faits.dernierRetourLe = MAINTENANT
    await veiller(m.ports, MAINTENANT)

    expect(m.envoyes).toHaveLength(2)
    expect(m.envoyes[1]).toContain('Un retour est de nouveau arrivé.')
  })

  it('la part de voix sous 40 % : incident — ⚠️ pas en dessous de dix retours', () => {
    expect(verdictVoix(3, 12)).toBe(true)
    expect(verdictVoix(1, MINIMUM_RETOURS_VOIX - 1)).toBeNull()
    expect(verdictVoix(6, 12)).toBe(false)
  })

  it('⚠️ hystérésis : entre 40 et 45 %, on ne tranche pas', () => {
    expect(verdictVoix(42, 100)).toBeNull()
    expect(verdictVoix(40, 100)).toBeNull()
    expect(verdictVoix(45, 100)).toBe(false)
  })
})

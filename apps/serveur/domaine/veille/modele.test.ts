/**
 * La mesure des échecs du modèle — quand elle parle, et quand elle se tait.
 */
import { describe, expect, it } from 'vitest'

import type { DemandeSynthese, DemandeTour } from '../entretien/prompts'
import type { Modele } from '../entretien/modele'

import type { AppelModele } from './modele'
import {
  FENETRE_MODELE_MS,
  MINIMUM_APPELS,
  creerFenetreModele,
  etatModele,
  mesurerModele,
} from './modele'

const T = 1_000_000

function appels(...resultats: boolean[]): AppelModele[] {
  return resultats.map((ok, n) => ({ instant: T + n, ok }))
}

describe('etatModele', () => {
  it('ne sait rien sans appel', () => {
    expect(etatModele([], T).etat).toBe('inconnu')
  })

  it('⛔ la panne franche n’attend pas vingt appels : trois échecs, aucune réussite', () => {
    expect(etatModele(appels(false, false, false), T + 10).etat).toBe('en_echec')
  })

  it('deux échecs seuls ne suffisent pas', () => {
    expect(etatModele(appels(false, false), T + 10).etat).toBe('inconnu')
  })

  it('⚠️ un seul échec sur trois appels n’est pas « 33 % »', () => {
    expect(etatModele(appels(true, false, true), T + 10).etat).not.toBe('en_echec')
  })

  it('au-delà de 5 % sur vingt appels : en échec', () => {
    // Dix-huit réussites, puis deux échecs : 10 %.
    const liste = appels(...Array.from({ length: MINIMUM_APPELS }, (_, n) => n < 18))
    expect(etatModele(liste, T + 100).etat).toBe('en_echec')
  })

  it('⚠️ hystérésis : entre 2 et 5 %, on ne tranche pas', () => {
    // 1 échec sur 40 = 2,5 %, suivi de réussites.
    const liste = appels(false, ...Array.from({ length: 39 }, () => true))
    expect(etatModele(liste, T + 100).etat).toBe('inconnu')
  })

  it('rétabli : les derniers appels ont réussi, et le taux est bas', () => {
    const liste = appels(false, ...Array.from({ length: 59 }, () => true))
    expect(etatModele(liste, T + 100).etat).toBe('sain')
  })

  it('rétabli aussi avec peu d’appels, si les derniers ont réussi', () => {
    expect(etatModele(appels(false, false, true, true, true, true, true), T + 10).etat).toBe('sain')
  })

  it('⛔ un échec récent empêche de se dire rétabli', () => {
    expect(etatModele(appels(true, true, true, true, false), T + 10).etat).toBe('inconnu')
  })

  it('oublie ce qui a plus d’une heure', () => {
    const vieux = appels(false, false, false)
    expect(etatModele(vieux, T + FENETRE_MODELE_MS + 10).etat).toBe('inconnu')
  })
})

describe('mesurerModele', () => {
  const DEMANDE_TOUR = {} as DemandeTour
  const DEMANDE_SYNTHESE = {} as DemandeSynthese

  function modele(echoue: boolean): Modele {
    return {
      identifiant: 'modele-de-test',
      tour: async () => {
        if (echoue) throw new Error('529 overloaded')
        return { comprehension: { type: 'bug', titre: 't', resume: 'r' }, question: null, axe: null, motif: 'm' }
      },
      synthese: async () => {
        throw new Error('529 overloaded')
      },
    }
  }

  it('note les réussites et les échecs, sans rien changer pour l’appelant', async () => {
    let temps = T
    const fenetre = creerFenetreModele(() => temps)
    const mesure = mesurerModele(modele(false), fenetre)

    await expect(mesure.tour(DEMANDE_TOUR)).resolves.toMatchObject({ question: null })
    temps += 1
    await expect(mesure.synthese(DEMANDE_SYNTHESE)).rejects.toThrow('529 overloaded')

    expect(fenetre.etat()).toMatchObject({ appels: 2, echecs: 1 })
    expect(mesure.identifiant).toBe('modele-de-test')
  })

  it('⛔ l’erreur est relancée telle quelle', async () => {
    const mesure = mesurerModele(modele(true), creerFenetreModele(() => T))
    const erreur = await mesure.tour(DEMANDE_TOUR).catch((e: unknown) => e)

    expect((erreur as Error).message).toBe('529 overloaded')
  })

  it('ne grossit pas sans fin', () => {
    const fenetre = creerFenetreModele(() => T)
    for (let n = 0; n < 5000; n += 1) fenetre.noter(true)

    expect(fenetre.etat().appels).toBe(1000)
  })
})

/**
 * Le rendu de la note, sur une synthèse FIGÉE.
 *
 * ⚠️ Le sujet du test est écrit à la main (exemple.ts) : le dépôt est public, et
 *    aucune fixture ne sort d’une base qui tourne.
 */
import { describe, expect, it } from 'vitest'

import { EXEMPLE_NOTIFICATION } from './exemple'
import type { RetourANotifier } from './message'
import { composerMessage, corpsDe, dateLisible, lienFiche, sujetDe } from './message'

describe('le sujet', () => {
  it('porte le produit puis le titre', () => {
    expect(sujetDe(EXEMPLE_NOTIFICATION)).toBe(
      '[Feedys · Pistache] Le tri par date de la liste des dossiers se réinitialise',
    )
  })
})

describe('le lien vers la fiche', () => {
  it('vise /bo/r/:id', () => {
    expect(lienFiche('https://feedys.exemple.fr', 'abc')).toBe('https://feedys.exemple.fr/bo/r/abc')
  })

  it('tolère une barre finale', () => {
    expect(lienFiche('https://feedys.exemple.fr/', 'abc')).toBe(
      'https://feedys.exemple.fr/bo/r/abc',
    )
  })
})

describe('la date', () => {
  it('est rendue dans le fuseau du collaborateur', () => {
    // 07:14 UTC = 09:14 à Paris en septembre. ⚠️ C’est l’heure qu’il était POUR
    //    LA PERSONNE qui compte, pas celle du serveur.
    expect(dateLisible('2026-09-04T07:14:00.000Z', 'Europe/Paris')).toContain('09:14')
    expect(dateLisible('2026-09-04T07:14:00.000Z', 'Europe/Paris')).toContain('2026')
  })

  it('retombe sur UTC sans fuseau, et ne lève pas sur un fuseau illisible', () => {
    expect(dateLisible('2026-09-04T07:14:00.000Z', null)).toContain('07:14')
    expect(dateLisible('2026-09-04T07:14:00.000Z', 'Pas/UnFuseau')).not.toBeNull()
  })

  it('rend null sur une date absente ou illisible', () => {
    expect(dateLisible(null)).toBeNull()
    expect(dateLisible('pas une date')).toBeNull()
  })
})

describe('le corps', () => {
  const corps = corpsDe(EXEMPLE_NOTIFICATION)

  it('ouvre sur ce que c’est — type, impact, confiance', () => {
    expect(corps.split('\n')[0]).toBe('BUG · ralentit · confiance moyenne')
    expect(corps.split('\n')[1]).toBe('Liste des dossiers')
  })

  it('respecte l’ordre imposé : ce que c’est, ce qu’elle a dit, ce qui manque, le contexte', () => {
    const dit = corps.indexOf('CE QU’ELLE A DIT')
    const manque = corps.indexOf('CE QU’ON NE SAIT PAS')
    const contexte = corps.indexOf('CONTEXTE')

    expect(corps.indexOf('Liste des dossiers')).toBeLessThan(dit)
    expect(dit).toBeLessThan(manque)
    expect(manque).toBeLessThan(contexte)
  })

  it('cite mot pour mot, sans rien retoucher', () => {
    for (const citation of EXEMPLE_NOTIFICATION.synthese.citations) {
      expect(corps).toContain(`« ${citation} »`)
    }
  })

  it('porte le lien vers la fiche, en dernier', () => {
    expect(corps.trimEnd().endsWith('/bo/r/ret_exemple0000000000000')).toBe(true)
  })

  it('⛔ ne contient aucune balise HTML', () => {
    expect(corps).not.toMatch(/<[a-z/!][^>]*>/i)
  })

  it('rend la note figée, telle quelle', () => {
    expect(corps).toMatchInlineSnapshot(`
      "BUG · ralentit · confiance moyenne
      Liste des dossiers

      Le tri par date se réinitialise au retour sur la page. La personne doit le reposer à chaque navigation. Comportement présent depuis toujours d’après elle.

        Attendu    le tri reste en place au retour
        Constaté   le tri revient à l’ordre par défaut
        Récurrence systématique

      CE QU’ELLE A DIT
        « dès que je reviens en arrière il se remet à zéro »
        « faut que je le refasse à chaque fois c’est pénible »

      CE QU’ON NE SAIT PAS
        · Est-ce que ça touche aussi les autres listes ?

      CONTEXTE
        Camille Martin (gestionnaire) · 4 sept. 2026 à 09:14
        /dossiers?tri=date · Chrome 141 · 1512 × 982
        → ouvrir la fiche : https://feedys.exemple.fr/bo/r/ret_exemple0000000000000
      "
    `)
  })
})

describe('les rubriques vides', () => {
  /** ⚠️ Une liste de questions vide est un SIGNAL : on n’écrit pas « rien à signaler ». */
  const sansQuestions: RetourANotifier = {
    ...EXEMPLE_NOTIFICATION,
    synthese: {
      ...EXEMPLE_NOTIFICATION.synthese,
      type: 'idee',
      attendu: null,
      constate: null,
      recurrence: null,
      besoin: 'gagner du temps le matin',
      questions_ouvertes: [],
    },
  }

  it('n’écrit pas la rubrique quand il n’y a rien à y mettre', () => {
    const corps = corpsDe(sansQuestions)
    expect(corps).not.toContain('CE QU’ON NE SAIT PAS')
    expect(corps).not.toContain('Attendu')
    expect(corps).toContain('  Besoin     gagner du temps le matin')
    expect(corps).toContain('IDEE · ralentit')
  })

  it('tient sans contexte technique du tout', () => {
    const corps = corpsDe({ ...sansQuestions, contexte: {} })
    expect(corps).toContain('CONTEXTE')
    expect(corps).toContain('→ ouvrir la fiche :')
  })
})

describe('composerMessage', () => {
  it('rend les deux, et rien d’autre', () => {
    expect(Object.keys(composerMessage(EXEMPLE_NOTIFICATION)).sort()).toEqual(['corps', 'sujet'])
  })
})

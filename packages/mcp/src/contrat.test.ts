/**
 * Le contrat de `marquer_retour` — ce qu’il accepte, et surtout ce qu’il refuse.
 *
 * ⛔ Ce qui se joue ici n’est pas de la validation, c’est une promesse : un
 *    retour marqué « traité » porte une trace vérifiable, ou il n’est pas
 *    marqué « traité » (01-Specs/tracabilite-du-correctif.md).
 *
 * ⚠️ Test pur : ni réseau, ni base. Le contrat est du côté MIT, et il se teste
 *    tout seul.
 */
import { describe, expect, it } from 'vitest'

import { Correctif, FORME_CORRECTIF_REF, refusDuMarquage, RequeteStatut } from './contrat.js'

describe('FORME_CORRECTIF_REF', () => {
  it('accepte un SHA de 7 à 40 caractères hexadécimaux', () => {
    expect(FORME_CORRECTIF_REF.test('a1b2c3d')).toBe(true)
    expect(FORME_CORRECTIF_REF.test('0'.repeat(40))).toBe(true)
  })

  it('accepte une URL https — une PR EST une référence', () => {
    expect(FORME_CORRECTIF_REF.test('https://github.com/exemple/depot/pull/42')).toBe(true)
  })

  it('⛔ refuse ce qui n’est ni un SHA ni une URL', () => {
    // ⛔ Le défaut que cette forme ferme : un agent qui écrit « corrigé » dans
    //    le champ prévu pour le commit, et une traçabilité qui ne trace plus.
    expect(FORME_CORRECTIF_REF.test('corrige')).toBe(false)
    expect(FORME_CORRECTIF_REF.test('a1b2c3')).toBe(false)
    expect(FORME_CORRECTIF_REF.test('A1B2C3D')).toBe(false)
    expect(FORME_CORRECTIF_REF.test('http://github.com/exemple/depot')).toBe(false)
    expect(FORME_CORRECTIF_REF.test('a1b2c3d e5f6a7b')).toBe(false)
  })
})

describe('Correctif', () => {
  it('⛔ refuse un correctif vide — une case cochée n’est pas une trace', () => {
    expect(Correctif.safeParse({}).success).toBe(false)
    expect(Correctif.safeParse({ note: '  ' }).success).toBe(false)
  })

  it('⛔ est strict : un champ inconnu est refusé, pas ignoré', () => {
    expect(Correctif.safeParse({ ref: 'a1b2c3d', auteur: 'moi' }).success).toBe(false)
  })
})

describe('refusDuMarquage', () => {
  it('exige un correctif pour « traite »', () => {
    expect(refusDuMarquage({ statut: 'traite' })).toContain('correctif')
    expect(refusDuMarquage({ statut: 'traite', correctif: { ref: 'a1b2c3d' } })).toBeNull()
    expect(refusDuMarquage({ statut: 'traite', correctif: { note: 'configuration' } })).toBeNull()
  })

  it('⛔ traite un correctif blanc comme absent', () => {
    expect(refusDuMarquage({ statut: 'traite', correctif: { note: '   ' } })).toContain('correctif')
  })

  it('n’exige rien pour « ecarte » — il n’y avait rien à corriger', () => {
    expect(refusDuMarquage({ statut: 'ecarte' })).toBeNull()
    expect(refusDuMarquage({ statut: 'ecarte', reponse: 'Pas prévu pour l’instant.' })).toBeNull()
  })

  it('⛔ refuse mot et correctif avec « lu », qui ne notifie personne', () => {
    expect(refusDuMarquage({ statut: 'lu', reponse: 'c’est corrigé' })).toContain('lu')
    expect(refusDuMarquage({ statut: 'lu', correctif: { ref: 'a1b2c3d' } })).toContain('lu')
    expect(refusDuMarquage({ statut: 'lu' })).toBeNull()
  })
})

describe('RequeteStatut', () => {
  it('⛔ refuse « traite » sans correctif', () => {
    expect(RequeteStatut.safeParse({ statut: 'traite' }).success).toBe(false)
  })

  it('accepte « traite » avec son correctif et son mot', () => {
    const lue = RequeteStatut.safeParse({
      statut: 'traite',
      reponse: 'Le tri garde son ordre maintenant.',
      correctif: { ref: 'a1b2c3d4', note: 'reset du tri corrigé dans useTableState' },
    })

    expect(lue.success).toBe(true)
  })

  it('⛔ reste strict : rien qui touche à la parole n’entre par ici', () => {
    for (const corps of [
      { statut: 'traite', texte: 'j’ai rien dit de tel' },
      { statut: 'lu', resume: 'un résumé de mon cru' },
      { statut: 'traite', correctif: { ref: 'pas-un-sha' } },
    ]) {
      expect(RequeteStatut.safeParse(corps).success).toBe(false)
    }
  })
})

import { describe, expect, it } from 'vitest'

import type { MotifRefusRefaire } from '../synthese/refaire'

import { LIBELLES_SANS_NOTE, REFUS_REFAIRE, etatSansNote } from './sans-note'

describe('etatSansNote', () => {
  it('le renoncement faute de modèle se dit — c’est un geste à faire', () => {
    expect(etatSansNote({ reprises: 8, impossibleMotif: 'plafond' })).toBe('impossible')
  })

  it('l’absence de parole se dit — il n’y aura jamais de note', () => {
    expect(etatSansNote({ reprises: 1, impossibleMotif: 'rien_a_synthetiser' })).toBe('sans_parole')
  })

  it('une reprise en cours se dit — le filet s’en occupe', () => {
    expect(etatSansNote({ reprises: 2, impossibleMotif: null })).toBe('en_reprise')
  })

  it('sinon, rien de plus que l’absence', () => {
    expect(etatSansNote({ reprises: null, impossibleMotif: null })).toBe('absente')
  })

  it('chaque état a son libellé, lisible à la place du titre', () => {
    for (const libelle of Object.values(LIBELLES_SANS_NOTE)) {
      expect(libelle.startsWith('sans note — ')).toBe(true)
    }
  })

  it('chaque refus du bouton a sa phrase', () => {
    const motifs: MotifRefusRefaire[] = [
      'retour_inconnu',
      'en_cours',
      'deja_faite',
      'rien_a_synthetiser',
      'modele_indisponible',
    ]
    for (const motif of motifs) expect(REFUS_REFAIRE[motif]).toBeTruthy()
  })
})

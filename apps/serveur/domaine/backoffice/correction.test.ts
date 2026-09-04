/**
 * ⛔ LE POINT D’ACCEPTATION DE P-010 : une tentative de modifier la parole est
 *    REFUSÉE côté serveur, pas ignorée en silence.
 */
import { describe, expect, it } from 'vitest'

import {
  auditEtiquettes,
  auditStatut,
  lireChangementEtiquettes,
  lireChangementStatut,
  STATUTS_A_LA_MAIN,
} from './correction'

describe('le changement de statut', () => {
  it('accepte les trois statuts qu’une personne pose', () => {
    for (const statut of STATUTS_A_LA_MAIN) {
      expect(lireChangementStatut({ statut })).toEqual({ ok: true, valeur: { statut } })
    }
  })

  it('⛔ refuse les statuts que le SERVEUR écrit — réécrire l’histoire du retour', () => {
    for (const statut of ['en_cours', 'abandonne', 'envoye']) {
      expect(lireChangementStatut({ statut })).toEqual({ ok: false, motif: 'valeur_refusee' })
    }
  })

  it('⛔ refuse un champ qu’il ne connaît pas, même à côté d’un statut valide', () => {
    expect(lireChangementStatut({ statut: 'lu', texte: 'j’ai rien dit de tel' })).toEqual({
      ok: false,
      motif: 'champ_inconnu',
    })
  })
})

describe('⛔ la parole ne se réécrit pas', () => {
  /** ⚠️ Ce que quelqu’un tenterait s’il forgeait un formulaire à la main. */
  const TENTATIVES = [
    { texte: 'une phrase que je préfère' },
    { resume: 'un résumé de mon cru' },
    { citations: ['une citation inventée'] },
    { transcript_brut: 'autre chose' },
    { message_id: 'msg_1', texte: 'corrigé' },
    { type: 'bug', zone: 'Liste', resume: 'et tant qu’à faire' },
  ]

  it('refuse toutes ces tentatives, sur les deux formulaires', () => {
    for (const tentative of TENTATIVES) {
      expect(lireChangementStatut(tentative).ok).toBe(false)
      expect(lireChangementEtiquettes(tentative).ok).toBe(false)
    }
  })

  it('les nomme « champ_inconnu » — le signe d’un formulaire forgé', () => {
    expect(lireChangementEtiquettes({ type: 'bug', zone: 'Liste', resume: 'x' })).toEqual({
      ok: false,
      motif: 'champ_inconnu',
    })
  })
})

describe('la correction des étiquettes', () => {
  it('accepte type et zone, zone vide comprise', () => {
    expect(lireChangementEtiquettes({ type: 'idee', zone: '' })).toEqual({
      ok: true,
      valeur: { type: 'idee', zone: '' },
    })
  })

  it('refuse un type hors de la liste', () => {
    expect(lireChangementEtiquettes({ type: 'anomalie', zone: 'Liste' })).toEqual({
      ok: false,
      motif: 'valeur_refusee',
    })
  })

  it('refuse une zone démesurée', () => {
    expect(lireChangementEtiquettes({ type: 'bug', zone: 'x'.repeat(201) }).ok).toBe(false)
  })
})

describe('les lignes d’audit', () => {
  it('portent l’avant ET l’après — sans l’avant, la ligne ne dit rien', () => {
    expect(auditStatut('envoye', 'traite')).toEqual({
      action: 'statut',
      detail: { avant: 'envoye', apres: 'traite' },
    })

    expect(auditEtiquettes({ type: null, zone: null }, { type: 'bug', zone: 'Liste' })).toEqual({
      action: 'etiquettes',
      detail: { avant: { type: null, zone: null }, apres: { type: 'bug', zone: 'Liste' } },
    })
  })
})

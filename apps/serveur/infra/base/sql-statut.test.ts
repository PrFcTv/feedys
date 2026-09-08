/**
 * ⛔ Ce qui est testé ici n’est pas du SQL, c’est une PROMESSE faite au
 *    collaborateur : ce qu’il a déjà lu ne revient pas, ce qu’on lui a dit ne
 *    s’efface pas tout seul (01-Specs/retour-au-collaborateur.md).
 *
 * ⚠️ Le défaut que ces tests ferment : la première écriture de P-020 posait
 *    `reponse_envoyee_le = now()` et `reponse_lue_le = null` à CHAQUE passage à
 *    `traite`. Reposer le statut renotifiait quelqu’un qui avait déjà cliqué
 *    « J’ai vu », et marquer depuis le MCP sans message effaçait le message.
 */
import { describe, expect, it } from 'vitest'

import {
  POSER_STATUT_AVEC_MOT,
  POSER_STATUT_SANS_MOT,
  POSER_STATUT_SEUL,
  ecritureStatut,
  notifieLeCollaborateur,
} from './sql-statut'

describe('notifieLeCollaborateur', () => {
  it('« traité » et « écarté » s’adressent au collaborateur, « lu » reste interne', () => {
    expect(notifieLeCollaborateur('traite')).toBe(true)
    expect(notifieLeCollaborateur('ecarte')).toBe(true)
    expect(notifieLeCollaborateur('lu')).toBe(false)
  })
})

describe('ecritureStatut', () => {
  it('« lu » ne touche à aucune colonne de réponse', () => {
    const ecriture = ecritureStatut('lu', undefined)

    expect(ecriture.sql).toBe(POSER_STATUT_SEUL)
    expect(ecriture.parametres).toEqual(['lu'])
    expect(ecriture.mot).toBeNull()
  })

  it('⛔ marquer « traité » SANS mot n’écrit pas dans reponse_texte', () => {
    const ecriture = ecritureStatut('traite', undefined)

    expect(ecriture.sql).toBe(POSER_STATUT_SANS_MOT)
    expect(ecriture.sql).not.toContain('reponse_texte')
    expect(ecriture.parametres).toEqual(['traite'])
  })

  it('⛔ …et ne rouvre pas un accusé déjà donné', () => {
    // `coalesce` garde l’horodatage existant ; `reponse_lue_le` n’est pas cité.
    expect(POSER_STATUT_SANS_MOT).toContain('coalesce(reponse_envoyee_le, now())')
    expect(POSER_STATUT_SANS_MOT).not.toContain('reponse_lue_le')
  })

  it('un mot fourni part avec le statut, débarrassé de ses blancs', () => {
    const ecriture = ecritureStatut('ecarte', '  Ce n’est pas un défaut.  ')

    expect(ecriture.sql).toBe(POSER_STATUT_AVEC_MOT)
    expect(ecriture.parametres).toEqual(['ecarte', 'Ce n’est pas un défaut.'])
    expect(ecriture.mot).toBe('Ce n’est pas un défaut.')
  })

  it('un mot vide fourni explicitement efface — et c’est le SEUL chemin qui efface', () => {
    const ecriture = ecritureStatut('traite', '   ')

    expect(ecriture.parametres).toEqual(['traite', null])
  })

  it('⛔ le même mot ne redéclenche rien : la notification est conditionnée', () => {
    // `is distinct from` et non `<>` : `<>` rend null dès qu’un côté l’est, et
    // le cas « rien avant, un mot maintenant » retomberait dans le `else`.
    expect(POSER_STATUT_AVEC_MOT).toContain('$3 is distinct from reponse_texte')
    expect(POSER_STATUT_AVEC_MOT).not.toContain('$3 <> reponse_texte')

    // Les DEUX colonnes sont sous condition : aucune n’est écrasée sèchement.
    expect(POSER_STATUT_AVEC_MOT).not.toContain('reponse_envoyee_le = now()')
    expect(POSER_STATUT_AVEC_MOT).not.toContain('reponse_lue_le = null,')
  })
})

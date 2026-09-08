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
  POSER_CORRECTIF,
  POSER_STATUT_AVEC_MOT,
  POSER_STATUT_SANS_MOT,
  POSER_STATUT_SEUL,
  ecritureCorrectif,
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

/**
 * ⛔ La promesse testée ici : le correctif REMPLACE, il ne s’empile pas — c’est
 *    ce qui garde `marquer_retour` idempotent. Et il ne s’efface jamais tout
 *    seul, exactement comme le mot au collaborateur juste au-dessus
 *    (01-Specs/tracabilite-du-correctif.md).
 */
describe('ecritureCorrectif', () => {
  it('⛔ ne touche à rien quand l’appelant n’a pas fourni de correctif', () => {
    // ⛔ Le défaut évité : reclasser une étiquette six semaines plus tard
    //    effacerait le commit qui avait réparé le bug.
    expect(ecritureCorrectif(undefined)).toBeNull()
  })

  it('⛔ ne touche à rien pour un correctif vide ou blanc', () => {
    expect(ecritureCorrectif({})).toBeNull()
    expect(ecritureCorrectif({ ref: '  ', note: '  ' })).toBeNull()
  })

  it('écrit la référence et la note, débarrassées de leurs blancs', () => {
    const ecriture = ecritureCorrectif({ ref: ' a1b2c3d ', note: '  useTableState  ' })

    expect(ecriture?.sql).toBe(POSER_CORRECTIF)
    expect(ecriture?.parametres).toEqual(['a1b2c3d', 'useTableState'])
    expect(ecriture?.ref).toBe('a1b2c3d')
    expect(ecriture?.note).toBe('useTableState')
  })

  it('accepte une note seule — tout correctif n’est pas un commit', () => {
    expect(ecritureCorrectif({ note: 'configuration du proxy' })?.parametres).toEqual([
      null,
      'configuration du proxy',
    ])
  })

  it('⛔ l’horodatage ne bouge que si le correctif change réellement', () => {
    // Sans le `case`, remarquer « traité » une seconde fois ferait croire à une
    // seconde correction — le même piège que `reponse_envoyee_le` avait tendu.
    expect(POSER_CORRECTIF).toContain('$2 is distinct from correctif_ref')
    expect(POSER_CORRECTIF).toContain('$3 is distinct from correctif_note')
    expect(POSER_CORRECTIF).not.toContain('correctif_le = now(),')
  })

  it('⛔ n’écrit que les colonnes du correctif — jamais le statut ni la parole', () => {
    expect(POSER_CORRECTIF).not.toContain('statut')
    expect(POSER_CORRECTIF).not.toContain('reponse_')
    expect(POSER_CORRECTIF).not.toContain('messages')
  })
})

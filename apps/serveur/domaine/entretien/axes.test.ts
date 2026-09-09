/**
 * ⛔ LE GARDE-FOU QUI COMPTE : les valeurs d’axe et celles de la synthèse ne
 *    peuvent pas diverger.
 *
 * Une réponse d’un clic FIXE `impact` ou `recurrence` dans la note
 * ([D-025](../../../../00-Projet/DECISIONS_LOG.md)). Si `VALEURS_AXE` gagnait
 * une valeur que `SchemaSynthese` refuse, la note deviendrait invalide au
 * moment de l’écriture — c’est-à-dire APRÈS la clôture, dans un chemin dont
 * l’échec est avalé. On perdrait la note en silence.
 *
 * ⚠️ Les deux définitions vivent de part et d’autre de la frontière de licence
 *    et ne peuvent donc pas être une seule constante. C’est ce fichier qui
 *    remplace l’unicité par une vérification.
 */
import { describe, expect, it } from 'vitest'

import { AXES, VALEURS_AXE } from '../../../../packages/widget/src/transport'
import { SchemaSynthese } from '../synthese/schema'

import { ligneDeFil, reponseValide, valeursDe } from './axes'

/** Une synthèse valide minimale, pour éprouver un champ à la fois. */
const NOTE = {
  type: 'bug',
  titre: 'Le tri par date se réinitialise',
  resume: 'Le tri ne survit pas à la navigation.',
  zone: 'Liste des dossiers',
  impact: 'ralentit',
  citations: ['il se remet à zéro'],
  confiance: 'moyenne',
  questions_ouvertes: [],
} as const

describe('⛔ les valeurs d’axe sont celles que la synthèse sait ranger', () => {
  it.each(VALEURS_AXE.recurrence)('`recurrence: %s` est acceptée par la note', (valeur) => {
    expect(SchemaSynthese.safeParse({ ...NOTE, recurrence: valeur }).success).toBe(true)
  })

  it.each(VALEURS_AXE.ampleur)('`impact: %s` est accepté par la note', (valeur) => {
    expect(SchemaSynthese.safeParse({ ...NOTE, impact: valeur }).success).toBe(true)
  })

  it('⚠️ `indetermine` n’est PAS proposable — c’est l’aveu du modèle, pas une réponse', () => {
    expect(VALEURS_AXE.ampleur).not.toContain('indetermine')
    // ⚠️ Mais la note, elle, doit toujours pouvoir le dire.
    expect(SchemaSynthese.safeParse({ ...NOTE, impact: 'indetermine' }).success).toBe(true)
  })

  it('⛔ deux axes, et pas un de plus (D-025)', () => {
    expect([...AXES]).toEqual(['recurrence', 'ampleur'])
  })

  it('⛔ aucune valeur « autre » : le champ texte et le micro sont l’autre', () => {
    for (const axe of AXES) {
      expect(valeursDe(axe)).not.toContain('autre')
    }
  })
})

describe('la ligne de fil', () => {
  it('est écrite par le SERVEUR, dans ses mots — jamais par le modèle', () => {
    expect(ligneDeFil('recurrence', 'systematique')).toBe('Réponse · Récurrence — à chaque fois')
    expect(ligneDeFil('ampleur', 'ralentit')).toBe('Réponse · Ampleur — ça ralentit')
  })

  it('⚠️ chaque valeur a un libellé — un « undefined » dans le fil se verrait tard', () => {
    for (const axe of AXES) {
      for (const valeur of valeursDe(axe)) {
        expect(ligneDeFil(axe, valeur)).not.toContain('undefined')
      }
    }
  })
})

describe('⛔ une valeur qui n’est pas de son axe est refusée', () => {
  it.each([
    ['la valeur d’un autre axe', 'recurrence', 'bloque'],
    ['une valeur inventée', 'ampleur', 'enorme'],
    ['un axe inconnu', 'gravite', 'haute'],
    ['l’aveu du modèle', 'ampleur', 'indetermine'],
  ])('%s', (_cas, axe, valeur) => {
    expect(reponseValide(axe, valeur)).toBe(false)
  })

  it('accepte ce qui va ensemble', () => {
    expect(reponseValide('recurrence', 'systematique')).toBe(true)
    expect(reponseValide('ampleur', 'agace')).toBe(true)
  })

  it('⚠️ l’un sans l’autre n’est pas une réponse', () => {
    expect(reponseValide('recurrence', undefined)).toBe(false)
    expect(reponseValide(undefined, 'systematique')).toBe(false)
  })
})

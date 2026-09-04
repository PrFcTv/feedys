/**
 * La décision de migration, sans base de données.
 *
 * `planifier` est pure : c’est ce qui permet de tester les trois divergences
 * sans Postgres, et donc de les tester vraiment. L’application réelle est
 * couverte par migrations.integration.test.ts.
 */
import { describe, expect, it } from 'vitest'

import { DivergenceError, type MigrationFichier, empreinte, planifier } from './migrations'

function fichier(nom: string, sql: string): MigrationFichier {
  return { nom, sql, sha256: empreinte(sql) }
}

const SOCLE = fichier('0001_socle.sql', 'create table produits ();')
const SUITE = fichier('0002_suite.sql', 'create table autre ();')

function applique(f: MigrationFichier) {
  return { nom: f.nom, sha256: f.sha256 }
}

describe('empreinte', () => {
  it('est stable', () => {
    expect(empreinte('select 1;')).toBe(empreinte('select 1;'))
  })

  it('change pour un octet de différence — un commitaire compte autant qu’une colonne', () => {
    expect(empreinte('-- socle\nselect 1;')).not.toBe(empreinte('-- socle\nselect 1; '))
  })
})

describe('planifier', () => {
  it('applique tout sur une base vierge, dans l’ordre des noms', () => {
    expect(planifier([SOCLE, SUITE], [])).toEqual([SOCLE, SUITE])
  })

  it('ne réapplique rien quand tout est déjà là', () => {
    expect(planifier([SOCLE, SUITE], [applique(SOCLE), applique(SUITE)])).toEqual([])
  })

  it('n’applique que ce qui manque', () => {
    expect(planifier([SOCLE, SUITE], [applique(SOCLE)])).toEqual([SUITE])
  })

  describe('refuse de continuer quand la base et le dépôt ont divergé', () => {
    it('parce qu’une migration appliquée a changé d’un octet', () => {
      const retouche = fichier('0001_socle.sql', 'create table produits (); -- oups')

      expect(() => planifier([retouche], [applique(SOCLE)])).toThrow(DivergenceError)
      expect(() => planifier([retouche], [applique(SOCLE)])).toThrow(
        /0001_socle\.sql.*a changé depuis son application/s,
      )
    })

    it('parce qu’une migration appliquée a disparu du dépôt', () => {
      expect(() => planifier([SUITE], [applique(SOCLE), applique(SUITE)])).toThrow(
        /0001_socle\.sql.*absente du dépôt/s,
      )
    })

    it('parce qu’une migration neuve s’intercale AVANT une migration déjà appliquée', () => {
      const intercalee = fichier('0001a_entre_deux.sql', 'select 1;')

      expect(() => planifier([SOCLE, intercalee, SUITE], [applique(SOCLE), applique(SUITE)])).toThrow(
        /0001a_entre_deux\.sql.*L’ordre du dépôt et celui de la base/s,
      )
    })
  })

  it('le message de divergence dit quoi faire — une migration de plus', () => {
    const retouche = fichier('0001_socle.sql', 'create table produits (); -- oups')

    expect(() => planifier([retouche], [applique(SOCLE)])).toThrow(
      /pour changer quelque chose, une migration de plus/,
    )
  })
})

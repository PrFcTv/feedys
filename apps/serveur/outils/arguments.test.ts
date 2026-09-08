import { describe, expect, it } from 'vitest'

import { USAGE_FORGE, USAGE_PRODUIT, lireArgumentsProduit } from './arguments'

describe('lireArgumentsProduit', () => {
  it('lit --nom et --domaine', () => {
    expect(lireArgumentsProduit(['--nom', 'VictorIA', '--domaine', 'victoria.exemple.fr'])).toEqual({
      nom: 'VictorIA',
      domaine: 'victoria.exemple.fr',
    })
  })

  it('⚠️ avale le « -- » que pnpm transmet tel quel — c’est la forme documentée', () => {
    expect(
      lireArgumentsProduit(['--', '--nom', 'VictorIA', '--domaine', 'victoria.exemple.fr']),
    ).toEqual({ nom: 'VictorIA', domaine: 'victoria.exemple.fr' })
  })

  it('accepte la forme --nom=…', () => {
    expect(lireArgumentsProduit(['--nom=VictorIA', '--domaine=victoria.exemple.fr'])).toEqual({
      nom: 'VictorIA',
      domaine: 'victoria.exemple.fr',
    })
  })

  it('rogne les espaces', () => {
    expect(lireArgumentsProduit(['--nom', '  VictorIA  ', '--domaine', ' x.fr '])).toEqual({
      nom: 'VictorIA',
      domaine: 'x.fr',
    })
  })

  it('lit l’option optionnelle --forge', () => {
    expect(
      lireArgumentsProduit([
        '--nom',
        'VictorIA',
        '--domaine',
        'victoria.exemple.fr',
        '--forge',
        ' https://github.com/exemple/victoria ',
      ]),
    ).toEqual({
      nom: 'VictorIA',
      domaine: 'victoria.exemple.fr',
      forge: 'https://github.com/exemple/victoria',
    })
  })

  it('⛔ refuse une forge qui n’est pas en https — le lien ne se composerait jamais', () => {
    // ⛔ On le dit maintenant : accepté puis inutilisable, le défaut se
    //    chercherait dans l’affichage de la fiche, pas ici.
    expect(() =>
      lireArgumentsProduit([
        '--nom',
        'VictorIA',
        '--domaine',
        'victoria.exemple.fr',
        '--forge',
        'github.com/exemple/victoria',
      ]),
    ).toThrow(USAGE_FORGE)
  })

  it('lit l’option optionnelle --metier', () => {
    expect(
      lireArgumentsProduit([
        '--nom',
        'VictorIA',
        '--domaine',
        'victoria.exemple.fr',
        '--metier',
        'Logiciel sinistres',
      ]),
    ).toEqual({
      nom: 'VictorIA',
      domaine: 'victoria.exemple.fr',
      metier: 'Logiciel sinistres',
    })
  })

  it('rogne les espaces de --metier et ignore s’il est vide', () => {
    expect(
      lireArgumentsProduit([
        '--nom',
        'VictorIA',
        '--domaine',
        'victoria.exemple.fr',
        '--metier',
        '  Quittance et bordereau  ',
      ]),
    ).toEqual({
      nom: 'VictorIA',
      domaine: 'victoria.exemple.fr',
      metier: 'Quittance et bordereau',
    })

    expect(
      lireArgumentsProduit([
        '--nom',
        'VictorIA',
        '--domaine',
        'victoria.exemple.fr',
        '--metier',
        '   ',
      ]),
    ).toEqual({
      nom: 'VictorIA',
      domaine: 'victoria.exemple.fr',
    })
  })

  it.each([
    [[]],
    [['--nom', 'VictorIA']],
    [['--domaine', 'victoria.exemple.fr']],
    [['--nom', '   ', '--domaine', 'x.fr']],
  ])('rappelle l’usage quand il manque quelque chose : %j', (argv) => {
    expect(() => lireArgumentsProduit(argv)).toThrow(USAGE_PRODUIT)
  })
})

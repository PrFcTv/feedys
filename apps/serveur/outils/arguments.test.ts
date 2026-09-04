import { describe, expect, it } from 'vitest'

import { USAGE_PRODUIT, lireArgumentsProduit } from './arguments'

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

  it.each([
    [[]],
    [['--nom', 'VictorIA']],
    [['--domaine', 'victoria.exemple.fr']],
    [['--nom', '   ', '--domaine', 'x.fr']],
  ])('rappelle l’usage quand il manque quelque chose : %j', (argv) => {
    expect(() => lireArgumentsProduit(argv)).toThrow(USAGE_PRODUIT)
  })
})

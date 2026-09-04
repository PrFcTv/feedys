/**
 * ⛔ LE TEST DE SOUS-CHAÎNE EXACTE.
 *
 * C’est l’acceptation de P-008 : une citation de la synthèse doit être une
 * sous-chaîne **exacte** du message d’origine. Ni syntaxe corrigée, ni
 * hésitation retirée, ni faute de transcription réparée.
 *
 * ⚠️ Ce fichier ne teste pas un modèle, il teste `verbatim.ts` — et c’est le
 *    point : la propriété tient par construction, parce que ce qu’on garde est
 *    DÉCOUPÉ dans le texte d’origine, pas recopié depuis la sortie du modèle.
 */
import { describe, expect, it } from 'vitest'

import { extraireVerbatim, verifierCitations } from './verbatim'

/** ⚠️ Écrit à la main. ⛔ Jamais un vrai retour copié d’une base (CLAUDE.md §Secrets). */
const PAROLE =
  'alors euh le tri par date là sur la liste des dossiers dès que je reviens en arrière ' +
  'il se remet à zéro et faut que je le refasse à chaque fois c’est pénible'

describe('extraireVerbatim', () => {
  it('rend une sous-chaîne EXACTE quand la citation est déjà exacte', () => {
    const rendu = extraireVerbatim('il se remet à zéro', PAROLE)

    expect(rendu).toBe('il se remet à zéro')
    expect(PAROLE.includes(rendu as string)).toBe(true)
  })

  it('⛔ garde les hésitations : « euh » n’est pas du bruit, c’est de la parole', () => {
    const rendu = extraireVerbatim('alors euh le tri par date', PAROLE)

    expect(rendu).toBe('alors euh le tri par date')
  })

  /**
   * ⚠️ La tolérance porte sur la RECHERCHE, jamais sur le résultat. Un modèle
   *    recopie fidèlement mais re-ponctue les blancs et met une majuscule au
   *    premier mot ; refuser sur ce motif jetterait la quasi-totalité des
   *    citations d’un transcript dicté.
   */
  it.each([
    ['une majuscule ajoutée', 'Il se remet à zéro'],
    ['des espaces multipliés', 'il se   remet   à zéro'],
    ['un retour à la ligne', 'il se remet\nà zéro'],
  ])('retrouve malgré %s — et rend quand même le texte D’ORIGINE', (_cas, citation) => {
    const rendu = extraireVerbatim(citation, PAROLE)

    expect(rendu).toBe('il se remet à zéro')
    expect(PAROLE.includes(rendu as string)).toBe(true)
  })

  it('⛔ REFUSE une reformulation, même fidèle au sens', () => {
    expect(extraireVerbatim('le tri se réinitialise au retour', PAROLE)).toBeUndefined()
  })

  it('⛔ refuse une citation dont la syntaxe a été « corrigée »', () => {
    // Le modèle a réparé « faut que » en « il faut que ». Ce n’est plus ce qu’elle a dit.
    expect(extraireVerbatim('il faut que je le refasse à chaque fois', PAROLE)).toBeUndefined()
  })

  it('refuse le vide', () => {
    expect(extraireVerbatim('   ', PAROLE)).toBeUndefined()
    expect(extraireVerbatim('quelque chose', '')).toBeUndefined()
  })
})

describe('verifierCitations', () => {
  const paroles = [PAROLE, 'non ça a toujours fait ça je crois']

  it('cherche dans TOUS les messages de la personne, pas seulement le premier', () => {
    const { gardees, jetees } = verifierCitations(['ça a toujours fait ça'], paroles)

    expect(gardees).toEqual(['ça a toujours fait ça'])
    expect(jetees).toEqual([])
  })

  it('⛔ jette ce qu’elle n’a pas dit, et garde le reste — une note vaut mieux sans', () => {
    const { gardees, jetees } = verifierCitations(
      ['c’est pénible', 'la fonctionnalité est défectueuse'],
      paroles,
    )

    expect(gardees).toEqual(['c’est pénible'])
    expect(jetees).toEqual(['la fonctionnalité est défectueuse'])
  })

  it('écarte les doublons : le modèle cite parfois deux fois le même passage', () => {
    const { gardees } = verifierCitations(['c’est pénible', 'C’est pénible'], paroles)

    expect(gardees).toEqual(['c’est pénible'])
  })

  it('conserve l’ordre du modèle — c’est lui qui a choisi ce qui vient d’abord', () => {
    const { gardees } = verifierCitations(['c’est pénible', 'il se remet à zéro'], paroles)

    expect(gardees).toEqual(['c’est pénible', 'il se remet à zéro'])
  })

  it('⛔ LA PROPRIÉTÉ : tout ce qui sort est une sous-chaîne exacte d’un message', () => {
    const { gardees } = verifierCitations(
      ['Il se remet à zéro', 'c’est   pénible', 'inventé de toutes pièces', 'ça a toujours fait ça'],
      paroles,
    )

    expect(gardees).toHaveLength(3)
    for (const citation of gardees) {
      expect(paroles.some((parole) => parole.includes(citation))).toBe(true)
    }
  })
})

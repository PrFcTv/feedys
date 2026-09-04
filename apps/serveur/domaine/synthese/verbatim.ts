/**
 * ⛔ LA GARANTIE VERBATIM.
 *
 * Une citation de la synthèse doit être une **sous-chaîne exacte** de ce que la
 * personne a dit. Ni syntaxe corrigée, ni hésitation retirée, ni faute de
 * transcription réparée : la citation est une **pièce**, pas une phrase
 * (01-Specs/synthese.md §citations).
 *
 * ⚠️ ET ON NE FAIT PAS CONFIANCE AU MODÈLE POUR ÇA. Le prompt le lui demande ;
 *    ce module le rend vrai. Chaque citation est REMPLACÉE par la tranche exacte
 *    du message d’origine, et celles qu’on ne retrouve pas sont jetées. La
 *    propriété tient donc par construction, pas par docilité — et le test qui
 *    la vérifie ne teste pas un modèle, il teste ce fichier.
 *
 * ⚠️ Pourquoi la recherche tolère les espaces et la casse, alors que le résultat
 *    est exact. Un modèle recopie fidèlement mais re-ponctue les blancs et met
 *    une majuscule au premier mot ; refuser sur ce motif jetterait la quasi-
 *    totalité des citations d’un transcript dicté, et on perdrait le champ qui
 *    fait la valeur de la note. La tolérance porte sur la RECHERCHE ; ce qu’on
 *    garde est toujours découpé dans le texte d’origine.
 *
 * ⛔ Module pur.
 */

/**
 * Ce qu’on considère comme un blanc, y compris les insécables d’un copier-coller.
 *
 * ⚠️ Sans le drapeau `g`, et c’est délibéré : `.test()` sur une expression
 *    globale avance `lastIndex` et rend le résultat dépendant de l’appel
 *    précédent. Un piège classique, et ici il produirait des citations fausses
 *    une fois sur deux.
 */
const BLANC = /\s/u

interface Aplati {
  /** Le texte, blancs normalisés et casse repliée. */
  readonly plat: string
  /** Pour chaque caractère de `plat`, sa position dans le texte d’origine. */
  readonly positions: readonly number[]
}

/**
 * Aplati un texte en gardant la trace de chaque caractère.
 *
 * ⚠️ C’est `positions` qui permet de rendre une tranche du texte D’ORIGINE plutôt
 *    qu’une reconstruction — sans quoi on renverrait la version aplatie, et la
 *    citation ne serait plus verbatim.
 */
function aplatir(texte: string): Aplati {
  const caracteres: string[] = []
  const positions: number[] = []
  let dansUnBlanc = false

  for (let index = 0; index < texte.length; index += 1) {
    const caractere = texte[index] as string

    if (BLANC.test(caractere)) {
      if (dansUnBlanc || caracteres.length === 0) continue
      dansUnBlanc = true
      caracteres.push(' ')
      positions.push(index)
      continue
    }

    dansUnBlanc = false
    caracteres.push(caractere.toLowerCase())
    positions.push(index)
  }

  // Un blanc final n’appartient à aucune citation.
  while (caracteres[caracteres.length - 1] === ' ') {
    caracteres.pop()
    positions.pop()
  }

  return { plat: caracteres.join(''), positions }
}

/**
 * Retrouve `citation` dans `source` et rend la tranche EXACTE de `source`.
 *
 * `undefined` quand elle ne s’y trouve pas — auquel cas elle est jetée : mieux
 * vaut une note sans citation qu’une citation inventée.
 */
export function extraireVerbatim(citation: string, source: string): string | undefined {
  const cherchee = aplatir(citation)
  if (cherchee.plat === '') return undefined

  const dans = aplatir(source)
  const debut = dans.plat.indexOf(cherchee.plat)
  if (debut === -1) return undefined

  const premier = dans.positions[debut]
  const dernier = dans.positions[debut + cherchee.plat.length - 1]
  if (premier === undefined || dernier === undefined) return undefined

  return source.slice(premier, dernier + 1)
}

/**
 * Ramène les citations du modèle à ce que la personne a réellement dit.
 *
 * ⚠️ L’ordre est conservé, et les doublons sont écartés : le modèle cite parfois
 *    deux fois le même passage sous deux découpes.
 */
export function verifierCitations(
  citations: readonly string[],
  paroles: readonly string[],
): { readonly gardees: string[]; readonly jetees: string[] } {
  const gardees: string[] = []
  const jetees: string[] = []

  for (const citation of citations) {
    const trouvee = paroles
      .map((parole) => extraireVerbatim(citation, parole))
      .find((tranche) => tranche !== undefined)

    if (trouvee === undefined) {
      jetees.push(citation)
      continue
    }

    if (!gardees.includes(trouvee)) gardees.push(trouvee)
  }

  return { gardees, jetees }
}

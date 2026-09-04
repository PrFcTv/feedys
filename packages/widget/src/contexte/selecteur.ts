/**
 * Le sélecteur DOM de l’élément visé.
 *
 * ⛔ Ce qu’on joint est un CHEMIN, pas du contenu. Ni le texte de l’élément, ni
 *    celui de ses voisins, ni sa valeur : la liste de 01-Specs/widget.md est
 *    close, et « le composant visé » y désigne un sélecteur. Le développeur a
 *    déjà la capture pour voir ce qu’il y avait dedans.
 *
 * L’échelle de stratégies est empruntée à `@fasterfixes/core` (MIT) — voir
 * ATTRIBUTIONS.md. ⛔ Ce qui n’est PAS repris : `nearbyText` (du texte de la
 * page), le chemin de composant React et le fichier source (une fibre React
 * lue au travers du DOM). Trois choses hors de la liste close.
 */
import { BORNES } from '../transport'

/** Ce qu’on cherche à obtenir : un sélecteur qui désigne UN élément et un seul. */
function unique(racine: ParentNode, selecteur: string): boolean {
  try {
    return racine.querySelectorAll(selecteur).length === 1
  } catch {
    return false
  }
}

/**
 * Un IDENTIFIANT — ce qui suit un `#` ou un `.`.
 *
 * ⚠️ `CSS.escape` manque encore dans quelques environnements de test et dans les
 *    très vieux navigateurs. Le repli n’essaie pas d’être complet : il échappe
 *    ce qui casse un sélecteur.
 */
function echapper(valeur: string): string {
  const css = (globalThis as { CSS?: { escape?: (v: string) => string } }).CSS
  if (typeof css?.escape === 'function') return css.escape(valeur)
  return valeur.replace(/[^\w-]/g, (c) => `\\${c}`)
}

/**
 * Une VALEUR entre guillemets — ce qui suit un `=` dans `[attr="…"]`.
 *
 * ⛔ Pas `CSS.escape` ici : il échappe pour un identifiant, et rendrait
 *    `[aria-label="Fermer\ le\ panneau"]`. C’est valide, et c’est illisible pour
 *    l’humain qui lira le retour. Dans une chaîne, seuls le guillemet et la
 *    barre oblique inverse ont besoin d’être échappés.
 */
function echapperChaine(valeur: string): string {
  return valeur.replace(/["\\]/g, (c) => `\\${c}`)
}

/**
 * Une classe fabriquée par l’outillage — hash de CSS Modules, crochets de
 * Tailwind en JIT, préfixe d’émotion.
 *
 * ⚠️ Elle est unique aujourd’hui et différente au prochain build : un sélecteur
 *    qui s’appuie dessus ne retrouvera rien la semaine prochaine.
 */
function classeFabriquee(classe: string): boolean {
  if (classe.startsWith('_')) return true
  if (/[_-][a-z0-9]{5,}$/i.test(classe)) return true
  if (classe.startsWith('[') || classe.includes(':[')) return true
  return false
}

/** Un `id` produit par `useId` de React contient un « : ». Unique, mais pas stable. */
function idFabrique(id: string): boolean {
  return id.includes(':')
}

const CHAMPS = /^(input|textarea|select)$/i

/**
 * Le chemin `nth-of-type`, le dernier recours.
 *
 * ⚠️ `nth-of-type` et non `nth-child` : insérer un `<div>` au milieu d’une liste
 *    de `<li>` décale tous les `nth-child` et n’en décale aucun `nth-of-type`.
 */
function cheminNthOfType(element: Element, racine: ParentNode): string {
  const parties: string[] = []
  let courant: Element | null = element

  while (courant && courant !== racine && courant.tagName !== 'HTML') {
    const balise = courant.tagName.toLowerCase()

    if (courant.id && !idFabrique(courant.id)) {
      parties.unshift(`#${echapper(courant.id)}`)
      break
    }

    const parent: Element | null = courant.parentElement
    let partie = balise

    if (parent) {
      const memeBalise = [...parent.children].filter((e) => e.tagName === courant?.tagName)
      if (memeBalise.length > 1) partie += `:nth-of-type(${memeBalise.indexOf(courant) + 1})`
    }

    parties.unshift(partie)
    courant = parent
  }

  return parties.join(' > ')
}

/**
 * Le sélecteur le plus stable qui désigne cet élément et lui seul.
 *
 * L’échelle, du plus stable au moins stable :
 * `data-testid` → `id` authentique → `name` → `placeholder` → `aria-label`
 * → classes non fabriquées → chemin `nth-of-type`.
 *
 * ⚠️ Rend `undefined` plutôt qu’une chaîne vide quand il n’y a rien à dire : la
 *    colonne est nullable et la collecte est en échec-doux.
 */
export function construireSelecteur(
  element: Element | null | undefined,
  racine: ParentNode = element?.ownerDocument ?? globalThis.document,
): string | undefined {
  if (!element || !racine) return undefined

  try {
    const balise = element.tagName.toLowerCase()
    const candidats: (string | undefined)[] = []

    const testId = element.getAttribute('data-testid')
    if (testId) candidats.push(`[data-testid="${echapperChaine(testId)}"]`)

    if (element.id && !idFabrique(element.id)) candidats.push(`#${echapper(element.id)}`)

    const nom = element.getAttribute('name')
    if (nom && CHAMPS.test(balise)) {
      const type = element.getAttribute('type')
      candidats.push(`${balise}[name="${echapperChaine(nom)}"]${type ? `[type="${echapperChaine(type)}"]` : ''}`)
    }

    const invite = element.getAttribute('placeholder')
    if (invite && /^(input|textarea)$/i.test(balise)) {
      candidats.push(`${balise}[placeholder="${echapperChaine(invite)}"]`)
    }

    const etiquette = element.getAttribute('aria-label')
    if (etiquette) candidats.push(`${balise}[aria-label="${echapperChaine(etiquette)}"]`)

    const classes = [...element.classList].filter((c) => !classeFabriquee(c))
    if (classes.length > 0) {
      candidats.push(`${balise}${classes.map((c) => `.${echapper(c)}`).join('')}`)
    }

    const retenu = candidats.find((c) => c !== undefined && unique(racine, c))
    const selecteur = retenu ?? cheminNthOfType(element, racine)

    return selecteur === '' ? undefined : selecteur.slice(0, BORNES.selecteurDom)
  } catch {
    // ⚠️ Échec doux, comme tout le reste de la collecte : un sélecteur qu’on
    //    n’a pas su construire n’empêche jamais un retour de partir.
    return undefined
  }
}

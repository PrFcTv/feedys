/**
 * Le montage : un élément `<feedys-widget>` chez l’hôte, un shadow DOM FERMÉ
 * dedans, et Preact à l’intérieur.
 *
 * ⛔ Le shadow DOM est fermé (01-Specs/widget.md §2). Ce n’est pas de la
 *    dissimulation : c’est la garantie qu’aucun script de l’hôte ne viendra
 *    lire, styler ou déplacer nos nœuds par accident — et donc qu’un widget
 *    cassé chez un hôte le sera chez tous, reproductible, plutôt que chez un
 *    seul, inexplicable.
 *
 * ⚠️ LES STYLES DE L’ÉLÉMENT HÔTE SONT POSÉS EN LIGNE, EN `!important`. Le
 *    shadow DOM protège l’intérieur, jamais l’élément lui-même : un
 *    `* { position: static !important }` de l’hôte — il en existe — le
 *    décrocherait de son ancrage. Une déclaration en ligne `!important` est la
 *    seule qui gagne contre une feuille d’auteur `!important`. C’est exactement
 *    ce que `pnpm widget:demo` met à l’épreuve.
 */
import { render } from 'preact'

import type { Configuration } from './configuration'
import { collecter, definirOrigineFeedys, suivreSurvol } from './contexte'
import { envoyer } from './envoi'
import { identiteHote } from './identite'
import { demanderTour, terminer } from './entretien'
import { FEUILLE } from './ui/styles'
import type { Commandes, Ports } from './ui/Widget'
import { Widget } from './ui/Widget'

/** Le nom de l’élément. ⚠️ C’est aussi le sélecteur de surcharge des tokens. */
const BALISE = 'feedys-widget'

/**
 * ⚠️ La valeur maximale d’un `z-index`. La modale de l’hôte est à 9999 dans la
 *    page de démonstration, et à bien pire ailleurs.
 */
const AU_DESSUS = '2147483647'

/**
 * Ce que l’élément hôte doit être, quoi qu’en dise la feuille de l’hôte.
 *
 * ⚠️ `transform`, `filter` et `contain` sont dans la liste parce qu’ils créent
 *    un bloc conteneur : posés sur nous par un `*`, ils feraient de notre
 *    `position: fixed` un positionnement relatif à l’élément — et le widget
 *    partirait avec le défilement de la page.
 */
const STYLES_HOTE: ReadonlyArray<readonly [string, string]> = [
  ['position', 'fixed'],
  ['bottom', '0'],
  ['top', 'auto'],
  ['width', '0'],
  ['height', '0'],
  ['margin', '0'],
  ['padding', '0'],
  ['border', '0'],
  ['z-index', AU_DESSUS],
  ['display', 'block'],
  ['float', 'none'],
  ['overflow', 'visible'],
  ['opacity', '1'],
  ['visibility', 'visible'],
  ['transform', 'none'],
  ['filter', 'none'],
  ['contain', 'none'],
  ['clip-path', 'none'],
  ['transition', 'none'],
  ['animation', 'none'],
  // ⚠️ L’élément lui-même ne doit rien intercepter : il n’a pas de surface. Ce
  //    sont le lanceur et le panneau qui reprennent `pointer-events: auto`.
  ['pointer-events', 'none'],
]

export interface Montage {
  readonly commandes: Commandes
  demonter(): void
}

export interface OptionsMontage {
  /** Le document de l’hôte. Injectable pour les tests. */
  readonly document?: Document
  /** Remplace les ports réels. ⚠️ Pour la recette et les tests uniquement. */
  readonly ports?: Partial<Ports>
}

export function monter(configuration: Configuration, options: OptionsMontage = {}): Montage {
  const doc = options.document ?? globalThis.document

  // ⛔ D-011 : snapdom est chargé depuis l’origine FEEDYS, jamais depuis un CDN.
  //    Sans cet appel, la capture ne se déclenche jamais — silencieusement.
  definirOrigineFeedys(configuration.origine)

  const hote = doc.createElement(BALISE)
  hote.setAttribute('data-position', configuration.position)
  for (const [propriete, valeur] of STYLES_HOTE) {
    hote.style.setProperty(propriete, valeur, 'important')
  }
  hote.style.setProperty(configuration.position === 'bas-gauche' ? 'left' : 'right', '0', 'important')
  hote.style.setProperty(configuration.position === 'bas-gauche' ? 'right' : 'left', 'auto', 'important')

  const racine = hote.attachShadow({ mode: 'closed' })

  const feuille = doc.createElement('style')
  feuille.textContent = FEUILLE
  racine.appendChild(feuille)

  // ⚠️ `racine` n’est pas décoratif : c’est LUI qui porte le reset et les
  //    tokens. Posés sur `:host`, ils perdraient contre les règles de l’hôte —
  //    voir l’en-tête de `ui/tokens.ts`.
  const conteneur = doc.createElement('div')
  conteneur.className = 'racine'
  racine.appendChild(conteneur)

  // ⛔ Le survol de l’hôte, pour savoir de QUOI on parle. Rien de ce qui est
  //    dans le widget ne compte : un retour dont le composant visé serait la
  //    bulle Feedys ne dit rien à personne.
  const survol = suivreSurvol({ document: doc, exclure: hote })

  let commandes: Commandes = { ouvrir: () => {}, fermer: () => {} }

  const ports: Ports = {
    collecter: () => collecter({ cible: survol.dernier() }),
    envoyer: (corps) =>
      envoyer({
        origine: configuration.origine,
        cle: configuration.cle,
        // ⚠️ Relu à chaque envoi : l’hôte peut avoir rafraîchi son jeton depuis
        //    le chargement de la page (identite.ts).
        identite: identiteHote(),
        corps,
      }),
    demanderTour: (retour, corps) =>
      demanderTour({ origine: configuration.origine, cle: configuration.cle, retour, corps }),
    terminer: (retour, corps, garderEnVie) =>
      terminer({
        origine: configuration.origine,
        cle: configuration.cle,
        retour,
        corps,
        ...(garderEnVie === undefined ? {} : { garderEnVie }),
      }),
    brancher: (recues) => {
      commandes = recues
    },
    ...options.ports,
  }

  render(<Widget {...ports} />, conteneur)

  poser(doc, hote)

  return {
    commandes: {
      ouvrir: () => commandes.ouvrir(),
      fermer: () => commandes.fermer(),
    },
    demonter: () => {
      survol.arreter()
      render(null, conteneur)
      hote.remove()
    },
  }
}

/**
 * ⚠️ Avec `defer`, `document.body` existe déjà. Avec `async` posé à la main dans
 *    un `<head>`, non — et le widget ne doit pas se contenter d’échouer parce
 *    que l’intégrateur a écrit `async`.
 */
function poser(doc: Document, hote: Element): void {
  if (doc.body) {
    doc.body.appendChild(hote)
    return
  }

  doc.addEventListener('DOMContentLoaded', () => doc.body.appendChild(hote), { once: true })
}

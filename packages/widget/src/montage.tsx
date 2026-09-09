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
import { accuser, relever } from './releve'
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

  poserLaFeuille(doc, racine)

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
    releverReponses: () =>
      relever({
        origine: configuration.origine,
        cle: configuration.cle,
        identite: identiteHote(),
      }),
    accuserReception: (retourId: string) =>
      accuser({
        origine: configuration.origine,
        cle: configuration.cle,
        identite: identiteHote(),
        retourId,
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
 * La feuille du widget, posée dans la racine fantôme.
 *
 * ⛔ PAS DE `<style>` TANT QU’UN CHEMIN MEILLEUR EXISTE. Un `<style>`, même
 *    enfermé dans un shadow DOM, est du **style en ligne** pour le navigateur :
 *    il tombe sous `style-src`, et sans `'unsafe-inline'` il est refusé.
 *    Mesuré le 2026-09-09 sous `default-src 'self'` (05-Prompts/APRES-MVP.md
 *    §P-027) : le lanceur devient un bouton système **gris et carré**, 59 px de
 *    haut, et la console de l’hôte porte un « Applying inline style violates… »
 *    en rouge. Le widget fonctionne, mais il a l’air cassé, et c’est nous.
 *
 * ⛔ ET EXIGER `style-src 'unsafe-inline'` SERAIT NOTRE PROPRE DOCTRINE
 *    RETOURNÉE. [D-011] refuse déjà de charger snapdom depuis un CDN parce que
 *    « lui imposer un tiers au moment de l’exécution, **et la règle CSP qui va
 *    avec**, n’est pas à nous de le décider ». Faire relâcher `style-src` à un
 *    logiciel métier pour notre feuille est la même faute.
 *
 * ⚠️ Une feuille **construite** (`new CSSStyleSheet()` + `replaceSync`) n’est
 *    pas du style en ligne : elle ne passe par aucune directive CSP. C’est tout
 *    ce que change cette fonction — le CONTENU de la feuille est le même.
 */
function poserLaFeuille(doc: Document, racine: ShadowRoot): void {
  if (adopter(doc, racine)) return

  // ⛔ LE REPLI N’EST PAS FACULTATIF : `CSSStyleSheet` constructible manque sur
  //    Safari < 16.4 et Firefox < 101. [D-003] exige Chrome ou Edge pour la
  //    DICTÉE, jamais pour le reste — ailleurs, le champ texte doit rester
  //    impeccable. Sur ces navigateurs-là, un `<style>` et un CSP strict ne
  //    peuvent pas être vrais en même temps ; le style l’emporte, parce qu’un
  //    widget nu se voit et qu’un CSP relâché ne se voit pas.
  const balise = doc.createElement('style')
  balise.textContent = FEUILLE
  racine.appendChild(balise)
}

/**
 * ⛔ LE REPLI NE DOIT PAS DEVENIR LE CHEMIN ORDINAIRE SANS QUE RIEN NE LE DISE.
 *    C’est pour ça que rien ici n’est un `try` posé autour de tout : chaque
 *    étape est **vérifiée positivement**. Une implémentation partielle — un
 *    `replaceSync` qui n’analyse rien, un `adoptedStyleSheets` en lecture seule
 *    qui avale l’affectation — ferait sinon retomber le widget sur le `<style>`
 *    pour toujours, en production comme en test, sans un mot.
 *
 * ⚠️ Et le chemin réellement pris se **lit dans la racine** : une feuille
 *    adoptée et aucun `<style>`, ou l’inverse. Aucun drapeau, aucune version,
 *    aucune négociation — le widget essaie le bon chemin, se replie, et se
 *    tait. La preuve du chemin construit est portée par
 *    `tests/e2e/widget-csp.spec.ts`, dans un vrai Chromium sous CSP strict :
 *    happy-dom sait construire une feuille, donc `montage.test.tsx` la
 *    vérifierait sans jamais prouver qu’un navigateur l’accepte.
 */
function adopter(doc: Document, racine: ShadowRoot): boolean {
  // ⚠️ Une feuille construite appartient au DOCUMENT qui l’a construite :
  //    adoptée dans la racine d’un autre document, elle lève. `monter()`
  //    accepte un document injecté — on prend donc le constructeur de CELUI-là,
  //    jamais celui du global ambiant.
  const Feuille = doc.defaultView?.CSSStyleSheet

  if (typeof Feuille !== 'function') return false

  try {
    const feuille = new Feuille()

    if (typeof feuille.replaceSync !== 'function') return false
    feuille.replaceSync(FEUILLE)
    // ⛔ La preuve que la feuille a été ANALYSÉE, et pas seulement acceptée.
    if (feuille.cssRules.length === 0) return false

    racine.adoptedStyleSheets = [feuille]
    // ⛔ Et la preuve qu’elle a été ADOPTÉE : le tableau peut être absent, gelé,
    //    ou simplement ignorer ce qu’on lui donne.
    return racine.adoptedStyleSheets?.[0] === feuille
  } catch {
    // ⚠️ Aucune ligne en console : le widget n’écrit jamais dans celle de son
    //    hôte (01-Specs/widget.md §L’intégration). C’est le DOM qui dit tout.
    return false
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

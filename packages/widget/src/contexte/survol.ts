/**
 * L’élément survolé à l’ouverture.
 *
 * Le geste réel est : « je bute sur ce bouton, j’ouvre la bulle ». Au moment du
 * clic, le pointeur est sur le lanceur — pas sur ce dont on veut parler. Il faut
 * donc se souvenir de ce qui était sous le pointeur JUSTE avant.
 *
 * ⛔ On ne garde qu’UNE référence d’élément, écrasée à chaque mouvement. Pas
 *    d’historique, pas de trace, pas de coordonnées enregistrées : rien qui
 *    ressemblerait à un suivi. La référence meurt avec l’onglet.
 *
 * ⚠️ `pointerover` et non `pointermove` : il ne se déclenche qu’au changement
 *    d’élément, pas à chaque pixel parcouru. Le widget est un invité et ne doit
 *    pas peser sur le défilement de l’hôte (01-Specs/widget.md §1).
 */

export interface Survol {
  /** Le dernier élément de l’hôte passé sous le pointeur, ou `null`. */
  dernier(): Element | null
  /** Retire l’écouteur. À appeler quand le widget se démonte. */
  arreter(): void
}

export interface OptionsSurvol {
  /** Le document de l’hôte. */
  readonly document?: Document
  /**
   * L’élément hôte du widget. ⛔ Tout ce qui est dedans est ignoré : un retour
   * dont le composant visé serait la bulle Feedys ne dit rien à personne.
   */
  readonly exclure?: Element | null
}

export function suivreSurvol(options: OptionsSurvol = {}): Survol {
  const doc = options.document ?? globalThis.document
  let vu: Element | null = null

  const noter = (evenement: Event): void => {
    const cible = evenement.target
    if (!(cible instanceof Element)) return
    if (options.exclure && (cible === options.exclure || options.exclure.contains(cible))) return
    vu = cible
  }

  // ⚠️ `passive` : l’écouteur ne peut pas annuler l’événement, et le navigateur
  //    n’a donc pas à l’attendre avant de faire défiler la page de l’hôte.
  doc.addEventListener('pointerover', noter, { passive: true, capture: true })

  return {
    dernier: () => (vu?.isConnected === false ? null : vu),
    arreter: () => doc.removeEventListener('pointerover', noter, { capture: true }),
  }
}

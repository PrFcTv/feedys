/**
 * Le piège à focus du panneau.
 *
 * Le panneau est une boîte de dialogue modale, et une modale dont on sort au
 * `Tab` n’en est pas une : on se retrouve à naviguer dans le logiciel de l’hôte
 * avec, par-dessus, un panneau qu’on ne peut plus atteindre.
 *
 * ⛔ L’écouteur est posé sur le PANNEAU, jamais sur le document de l’hôte, et il
 *    n’existe que panneau ouvert : « il ne capte aucun raccourci clavier de
 *    l’hôte tant qu’il est fermé » (01-Specs/widget.md §3).
 */

/**
 * ⚠️ `[tabindex="-1"]` est exclu : c’est la marque de ce qu’on focalise par
 *    programme, pas au clavier.
 */
const FOCALISABLES = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

export interface OptionsPiege {
  /** Ce que fait `Échap`. Le panneau se ferme et le focus revient au lanceur. */
  readonly surEchap: () => void
}

/** Pose le piège. Rend la fonction qui le retire. */
export function piegerFocus(panneau: HTMLElement, options: OptionsPiege): () => void {
  const surTouche = (evenement: KeyboardEvent): void => {
    if (evenement.key === 'Escape') {
      evenement.preventDefault()
      // ⚠️ On arrête la propagation : `Échap` appartient au panneau tant qu’il
      //    est ouvert, et l’hôte n’a pas à fermer sa propre modale par ricochet.
      evenement.stopPropagation()
      options.surEchap()
      return
    }

    if (evenement.key !== 'Tab') return

    const focalisables = lister(panneau)
    if (focalisables.length === 0) return

    const premier = focalisables[0]
    const dernier = focalisables[focalisables.length - 1]
    if (!premier || !dernier) return

    const actif = actifDans(panneau)

    if (evenement.shiftKey && actif === premier) {
      evenement.preventDefault()
      dernier.focus()
    } else if (!evenement.shiftKey && actif === dernier) {
      evenement.preventDefault()
      premier.focus()
    }
  }

  panneau.addEventListener('keydown', surTouche)
  return () => panneau.removeEventListener('keydown', surTouche)
}

function lister(panneau: HTMLElement): HTMLElement[] {
  return Array.from(panneau.querySelectorAll<HTMLElement>(FOCALISABLES)).filter(
    (element) => !element.hasAttribute('disabled') && !element.hasAttribute('hidden'),
  )
}

/**
 * L’élément focalisé DANS le shadow DOM.
 *
 * ⚠️ `document.activeElement` s’arrête à l’hôte du shadow : il rend
 *    `<feedys-widget>`, jamais le bouton qui est dedans. Il faut redescendre par
 *    la racine — et elle est fermée, donc on passe par `getRootNode()`.
 */
function actifDans(panneau: HTMLElement): Element | null {
  const racine = panneau.getRootNode()
  return racine instanceof ShadowRoot || racine instanceof Document ? racine.activeElement : null
}

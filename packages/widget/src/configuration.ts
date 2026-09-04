/**
 * Ce que la balise `<script>` de l’hôte dit au widget.
 *
 * ```html
 * <script src="https://feedys.exemple.fr/widget.js" data-cle="fdy_pub_…" defer></script>
 * ```
 *
 * Deux choses en sortent, et le widget ne peut rien faire sans elles :
 *
 * 1. **la clé publique du produit**, qui part dans l’en-tête de chaque envoi ;
 * 2. **l’origine Feedys**, déduite du `src`. C’est elle qui dit où poster, et
 *    d’où charger snapdom ([D-011]) — jamais depuis un CDN : imposer un tiers au
 *    logiciel de quelqu’un d’autre n’est pas à nous de le décider.
 *
 * ⛔ Rien n’est codé en dur. Le même `widget.js` sert quatre logiciels, et une
 *    origine en dur ferait de chaque déploiement une reconstruction.
 */
import { PREFIXE_CLE_PUBLIQUE, PREFIXE_SECRET } from './transport'

/** Où s’ancre le lanceur. Bas-droite par défaut (01-Specs/widget.md). */
export type Position = 'bas-droite' | 'bas-gauche'

export interface Configuration {
  /** La clé publique du produit. Publique par nature : elle est dans le HTML. */
  readonly cle: string
  /** L’origine Feedys, sans slash final. */
  readonly origine: string
  readonly position: Position
}

/**
 * Le motif d’un refus de démarrage. ⚠️ Destiné à l’intégrateur, pas au
 * collaborateur : le widget ne monte pas, et personne d’autre ne le remarque.
 */
export type Refus = 'script_introuvable' | 'cle_absente' | 'secret_en_clair' | 'cle_invalide' | 'origine_illisible'

export type Lecture =
  | { readonly ok: true; readonly configuration: Configuration }
  | { readonly ok: false; readonly refus: Refus; readonly message: string }

export function lireConfiguration(script: HTMLScriptElement | null | undefined, base?: string): Lecture {
  if (!script) {
    return {
      ok: false,
      refus: 'script_introuvable',
      message: 'Feedys : impossible de retrouver sa propre balise <script>.',
    }
  }

  const cle = script.dataset.cle?.trim() ?? ''

  if (cle === '') {
    return {
      ok: false,
      refus: 'cle_absente',
      message: 'Feedys : la balise <script> n’a pas d’attribut data-cle.',
    }
  }

  // ⛔ Un secret produit collé dans le HTML de l’hôte est lisible par tout le
  //    monde. On refuse de démarrer plutôt que de le poster : il faut le
  //    révoquer, pas s’en servir.
  if (cle.startsWith(PREFIXE_SECRET)) {
    return {
      ok: false,
      refus: 'secret_en_clair',
      message: 'Feedys : data-cle porte un SECRET produit, pas une clé publique. À révoquer.',
    }
  }

  if (!cle.startsWith(PREFIXE_CLE_PUBLIQUE)) {
    return {
      ok: false,
      refus: 'cle_invalide',
      message: `Feedys : data-cle devrait commencer par ${PREFIXE_CLE_PUBLIQUE}.`,
    }
  }

  const origine = origineDe(script.getAttribute('src'), base)

  if (origine === undefined) {
    return {
      ok: false,
      refus: 'origine_illisible',
      message: 'Feedys : le src de la balise <script> ne donne pas d’origine exploitable.',
    }
  }

  return {
    ok: true,
    configuration: { cle, origine, position: positionDe(script.dataset.position) },
  }
}

/**
 * ⚠️ `src` peut être relatif — un hôte qui sert Feedys derrière son propre
 *    domaine écrit `/widget.js`. `base` lève l’ambiguïté ; c’est l’URL de la
 *    page, injectable pour les tests.
 */
function origineDe(src: string | null, base: string | undefined): string | undefined {
  if (src === null || src.trim() === '') return undefined

  try {
    const origine = new URL(src, base ?? globalThis.location?.href).origin
    return origine === 'null' ? undefined : origine
  } catch {
    return undefined
  }
}

function positionDe(valeur: string | undefined): Position {
  return valeur?.trim() === 'bas-gauche' ? 'bas-gauche' : 'bas-droite'
}

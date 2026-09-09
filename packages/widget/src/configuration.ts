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
  /**
   * Le relevé des indices techniques (D-026). **Actif par défaut.**
   *
   * ⛔ ACTIF PAR DÉFAUT, ET C’EST UN ARBITRAGE, PAS UNE FACILITÉ. En option
   *    d’adhésion, personne ne l’activerait et la fonctionnalité serait morte
   *    née. Ce qui rend le défaut acceptable est ailleurs : le panneau **dit**
   *    ce qu’il joint et laisse le décocher, et le collecteur ne relève ni
   *    message d’exception, ni requête, ni corps de réponse.
   *
   * ⚠️ `data-indices="non"` le coupe entièrement, sans rien changer d’autre au
   *    parcours. Un hôte n’a pas à nous redéployer pour refuser.
   */
  readonly indices: boolean
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
    configuration: {
      cle,
      origine,
      position: positionDe(script.dataset.position),
      indices: indicesDe(script.dataset.indices),
    },
  }
}

/**
 * ⚠️ Seul `non` coupe, et l’absence d’attribut vaut `true`. Un attribut mal
 *    orthographié — `data-indices="off"`, `data-indice="non"` — laisse donc le
 *    relevé actif. C’est délibéré : le contraire ferait qu’une faute de frappe
 *    désactive silencieusement une fonctionnalité que la fiche montre.
 */
function indicesDe(valeur: string | undefined): boolean {
  return valeur?.trim().toLowerCase() !== 'non'
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

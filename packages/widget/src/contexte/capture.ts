/**
 * La capture d’écran, prise à l’ouverture du panneau.
 *
 * ⛔ snapdom n’est PAS empaqueté dans `widget.js`. Mesuré le 2026-09-04 :
 *    52 Ko gzip à lui seul, contre un budget total de 60 Ko (01-Specs/widget.md
 *    §4). Il est SERVI par le conteneur Feedys et chargé à la demande, à
 *    l’ouverture du panneau — c’est-à-dire jamais au chargement de la page de
 *    l’hôte. Voir [D-011] dans 00-Projet/DECISIONS_LOG.md.
 *
 * ⛔ Et il est chargé depuis l’origine FEEDYS, jamais depuis un CDN : le widget
 *    s’exécute dans le logiciel de quelqu’un d’autre, et lui imposer un tiers
 *    au moment de l’exécution — plus la règle CSP qui va avec — n’est pas à
 *    nous de le décider.
 *
 * ⚠️ Tout est en échec doux. Une capture qui rate n’empêche jamais l’envoi :
 *    c’est la seule règle qui compte ici.
 */
import type { FichierCapture } from '../contrat'

/** Le peu qu’on demande à une toile. Un `HTMLCanvasElement` le satisfait. */
export interface Toile {
  readonly width: number
  toDataURL(type: string, qualite: number): string
}

/**
 * Le port : transformer un élément en toile.
 *
 * ⚠️ `largeur` vaut `undefined` quand l’élément est déjà assez étroit. On ne
 *    grossit JAMAIS une capture : agrandir n’ajoute aucun détail et multiplie
 *    le poids par le carré du facteur.
 */
export type RendreEnToile = (cible: Element, largeur: number | undefined) => Promise<Toile>

export interface OptionsCapture {
  /** Au-delà, on redimensionne. Une capture n’est pas une preuve légale. */
  readonly largeurMax?: number
  /** Le plafond, en octets une fois encodé en base64. */
  readonly poidsMax?: number
  /** Comment obtenir la toile. Par défaut : snapdom, chargé à la demande. */
  readonly rendre?: RendreEnToile
}

const LARGEUR_MAX = 1_280

/**
 * ⚠️ 300 Ko en base64, soit ~225 Ko d’image. Le corps entier est borné à 4 Mio
 *    par le contrat, mais un retour doit partir vite depuis un poste de bureau :
 *    la capture n’a pas à consommer le budget de l’audio.
 */
const POIDS_MAX = 300_000

/** ⛔ webp uniquement : deux à trois fois plus léger que png à lisibilité égale. */
const TYPE = 'image/webp' as const

/**
 * On redescend jusqu’à 0,4. En dessous, une capture d’interface devient
 * illisible, et une image illisible ne vaut pas mieux que pas d’image.
 */
const QUALITES = [0.8, 0.65, 0.5, 0.4] as const

const PREFIXE = /^data:[^;]+;base64,/

export async function capturer(
  cible: Element | null | undefined,
  options: OptionsCapture = {},
): Promise<FichierCapture | undefined> {
  if (!cible) return undefined

  try {
    const rendre = options.rendre ?? (await snapdomOuRien())
    if (!rendre) return undefined

    const toile = await rendre(cible, aRetrecir(cible, options.largeurMax ?? LARGEUR_MAX))
    const poidsMax = options.poidsMax ?? POIDS_MAX

    for (const qualite of QUALITES) {
      const donnees = toile.toDataURL(TYPE, qualite).replace(PREFIXE, '')
      if (donnees !== '' && donnees.length <= poidsMax) return { type: TYPE, donnees }
    }

    // ⚠️ Trop lourde même au plus bas : on part sans image plutôt que de faire
    //    attendre quelqu’un qui a fini de parler.
    return undefined
  } catch {
    return undefined
  }
}

/** La largeur à demander, ou `undefined` si l’élément tient déjà dans la borne. */
function aRetrecir(cible: Element, largeurMax: number): number | undefined {
  const largeur = cible.getBoundingClientRect?.().width ?? 0
  return largeur > largeurMax ? largeurMax : undefined
}

// ─────────────────────────────────────────────────────────────────────────────
// Le chargement de snapdom, à la demande
// ─────────────────────────────────────────────────────────────────────────────

/** La part de l’API de snapdom qu’on utilise. Rien d’autre n’est touché. */
interface Snapdom {
  toCanvas(cible: Element, options: { width?: number; fast: boolean }): Promise<Toile>
}

/** ⚠️ Renseignée par P-005, qui sait d’où le widget a été servi. */
let origineFeedys: string | undefined

/**
 * Dit d’où charger snapdom. Appelé une fois au montage, avec l’origine du
 * `<script src>` qui a chargé le widget.
 */
export function definirOrigineFeedys(origine: string): void {
  origineFeedys = origine
}

let promesse: Promise<RendreEnToile | undefined> | undefined

/** Une seule tentative de chargement par page, réussie ou non. */
function snapdomOuRien(): Promise<RendreEnToile | undefined> {
  promesse ??= charger().catch(() => undefined)
  return promesse
}

async function charger(): Promise<RendreEnToile | undefined> {
  if (origineFeedys === undefined || typeof document === 'undefined') return undefined

  const global = globalThis as { snapdom?: Snapdom }

  if (!global.snapdom) {
    await new Promise<void>((resoudre, rejeter) => {
      const balise = document.createElement('script')
      balise.src = `${origineFeedys}/snapdom.js`
      balise.async = true
      balise.addEventListener('load', () => resoudre(), { once: true })
      balise.addEventListener('error', () => rejeter(new Error('snapdom')), { once: true })
      document.head.appendChild(balise)
    })
  }

  const snapdom = global.snapdom
  if (!snapdom) return undefined

  // `fast` saute les temporisations internes : le collaborateur attend.
  return (cible, largeur) =>
    snapdom.toCanvas(cible, largeur === undefined ? { fast: true } : { width: largeur, fast: true })
}

/** Remet le chargeur à zéro. ⚠️ Pour les tests uniquement. */
export function oublierSnapdom(): void {
  promesse = undefined
  origineFeedys = undefined
}

/**
 * L’onde.
 *
 * ⛔ ELLE EST CALCULÉE DEPUIS LE MICRO, À CHAQUE IMAGE. Une animation en boucle
 *    est un échec de cette tâche, pas une approximation acceptable : ça se
 *    repère en une seconde, et ça discrédite tout le reste de l’interface — si
 *    ça ment ici, pourquoi croire que le retour part vraiment ?
 *    (04-Architecture/references-visuelles.md §Les défauts qu’on refuse.)
 *
 * ⚠️ `prefers-reduced-motion` NE LA SUPPRIME PAS. Elle est de l’information —
 *    la preuve qu’on écoute — pas de la décoration (DESIGN.md §Le mouvement).
 *
 * ⚠️ Canvas et non SVG : quarante-huit barres redessinées soixante fois par
 *    seconde font quarante-huit mises à jour de nœuds par image chez l’hôte.
 *    Le widget est un invité.
 */
import { useEffect, useRef } from 'preact/hooks'

export interface ProprietesOnde {
  /** Le niveau instantané, de 0 à 1. Lu à chaque image. */
  readonly niveau: () => number
  /** Nombre de barres. */
  readonly barres?: number
}

const BARRES = 48
const HAUTEUR = 44
/** ⚠️ La voix ordinaire tourne autour de 0,05–0,25 en RMS. Sans gain, l’onde reste plate. */
const GAIN = 3.6

export function Onde({ niveau, barres = BARRES }: ProprietesOnde) {
  const toile = useRef<HTMLCanvasElement | null>(null)
  const niveaux = useRef<number[]>([])
  const lire = useRef(niveau)
  lire.current = niveau

  useEffect(() => {
    const element = toile.current
    const dessin = element?.getContext('2d')
    if (!element || !dessin) return

    // ⛔ Pas de couleur en dur : on lit le token, comme partout ailleurs.
    const couleur = getComputedStyle(element).getPropertyValue('--w-rec').trim() || 'currentColor'
    const densite = Math.min(globalThis.devicePixelRatio || 1, 2)

    niveaux.current = Array.from({ length: barres }, () => 0)

    let image = 0

    const peindre = (): void => {
      const largeur = element.clientWidth
      if (largeur > 0) {
        const hauteur = HAUTEUR
        if (element.width !== Math.round(largeur * densite)) {
          element.width = Math.round(largeur * densite)
          element.height = Math.round(hauteur * densite)
        }

        niveaux.current.push(Math.min(1, lire.current() * GAIN))
        niveaux.current.shift()

        dessin.setTransform(densite, 0, 0, densite, 0, 0)
        dessin.clearRect(0, 0, largeur, hauteur)
        dessin.fillStyle = couleur

        const pas = largeur / barres
        const epaisseur = Math.max(2, pas * 0.5)
        const milieu = hauteur / 2

        for (let i = 0; i < barres; i += 1) {
          const valeur = niveaux.current[i] ?? 0
          // ⚠️ Deux pixels au minimum : une onde qui disparaît complètement au
          //    silence ressemble à un widget cassé. Elle s’APLATIT, elle ne
          //    s’efface pas.
          const demi = Math.max(1, (valeur * hauteur) / 2)
          dessin.beginPath()
          dessin.roundRect(i * pas + (pas - epaisseur) / 2, milieu - demi, epaisseur, demi * 2, epaisseur / 2)
          dessin.fill()
        }
      }

      image = requestAnimationFrame(peindre)
    }

    image = requestAnimationFrame(peindre)
    return () => cancelAnimationFrame(image)
  }, [barres])

  return (
    <canvas
      class="onde"
      ref={toile}
      height={HAUTEUR}
      aria-hidden="true"
      // ⚠️ Le transcript en dessous porte l’information pour qui n’y voit rien.
    />
  )
}

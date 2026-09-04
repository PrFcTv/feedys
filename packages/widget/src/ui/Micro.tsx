/**
 * Le geste de la note vocale.
 *
 * ⚠️ CE GESTE N’EST PAS INVENTÉ ICI. Maintenir pour parler, relâcher pour
 *    terminer, glisser vers la gauche pour annuler : c’est WhatsApp et Telegram,
 *    et c’est une DÉCISION, pas une inspiration (DESIGN.md §L’écran qui fait le
 *    produit). Tout le monde le connaît sans l’avoir appris ; le réinventer
 *    serait une faute pure.
 *
 * ⚠️ Le clic simple bascule en mains libres, pour les retours longs. On en sort
 *    par un second clic, ou par deux secondes de silence.
 *
 * ⛔ `Espace` maintenu vaut l’appui. Tout le parcours est faisable au clavier,
 *    dictée comprise (01-Specs/widget.md §Accessibilité). Et au clavier,
 *    « glisser » ne veut rien dire : c’est `Échap` qui annule, et c’est ce que
 *    l’écran affiche.
 */
import { useRef, useState } from 'preact/hooks'

import type { Ecoute, Origine } from './useDictee'

export interface ProprietesMicro {
  readonly ecoute: Ecoute | null
  readonly demarrer: (origine: Origine) => void
  readonly passerEnMainsLibres: () => void
  readonly terminer: () => void
  readonly annuler: () => void
}

/** En deçà, c’est un clic ; au-delà, c’est un appui maintenu. */
const CLIC_MS = 350

/** Le glissement qui annule. ⚠️ Assez pour ne pas partir sur un tremblement. */
const SEUIL_ANNULE = 80

/** En deçà, le doigt n’a pas bougé : un clic reste un clic. */
const IMMOBILE = 12

export function Micro({ ecoute, demarrer, passerEnMainsLibres, terminer, annuler }: ProprietesMicro) {
  const [glissement, setGlissement] = useState(0)
  const geste = useRef<{ depuis: number; x: number } | null>(null)

  const finDuGeste = (glisse: number): void => {
    const en_cours = geste.current
    geste.current = null
    setGlissement(0)
    if (!en_cours) return

    // ⚠️ Un appui bref est un CLIC : on reste à l’écoute, mains libres. Un appui
    //    tenu est un appui : on relâche, on a fini.
    if (Date.now() - en_cours.depuis < CLIC_MS && glisse < IMMOBILE) {
      passerEnMainsLibres()
      return
    }

    terminer()
  }

  const abandonner = (): void => {
    geste.current = null
    setGlissement(0)
    annuler()
  }

  return (
    <div class="micro">
      <button
        class="micro__bouton"
        type="button"
        aria-pressed={ecoute !== null}
        aria-label={ecoute === null ? 'Parler — maintenir pour dicter' : 'Terminer la dictée'}
        style={{ '--w-glisse': `${glissement}px` }}
        onPointerDown={(evenement) => {
          // Un clic pendant les mains libres termine. C’est la sortie annoncée.
          if (ecoute?.mode === 'mains-libres') {
            terminer()
            return
          }
          if (ecoute !== null) return

          evenement.currentTarget.setPointerCapture(evenement.pointerId)
          geste.current = { depuis: Date.now(), x: evenement.clientX }
          demarrer('pointeur')
        }}
        onPointerMove={(evenement) => {
          const en_cours = geste.current
          if (!en_cours) return

          const glisse = Math.max(0, en_cours.x - evenement.clientX)
          setGlissement(Math.min(glisse, SEUIL_ANNULE))
          if (glisse >= SEUIL_ANNULE) abandonner()
        }}
        onPointerUp={() => finDuGeste(glissement)}
        onPointerCancel={abandonner}
        onKeyDown={(evenement) => {
          if (evenement.key === 'Escape' && ecoute !== null) {
            // ⚠️ `Échap` annule la dictée AVANT de fermer le panneau. Deux
            //    pressions pour sortir : la première jette, la seconde ferme.
            evenement.preventDefault()
            evenement.stopPropagation()
            abandonner()
            return
          }

          if (evenement.key !== ' ' && evenement.key !== 'Enter') return
          // ⛔ Sans ceci, le navigateur synthétise un `click` par-dessus le geste.
          evenement.preventDefault()
          if (evenement.repeat) return

          if (ecoute?.mode === 'mains-libres') {
            terminer()
            return
          }
          if (ecoute !== null) return

          geste.current = { depuis: Date.now(), x: 0 }
          demarrer('clavier')
        }}
        onKeyUp={(evenement) => {
          if (evenement.key !== ' ' && evenement.key !== 'Enter') return
          evenement.preventDefault()
          finDuGeste(0)
        }}
        onClick={(evenement) => {
          // ⚠️ `detail === 0` : le clic ne vient pas d’un pointeur — c’est une
          //    technologie d’assistance qui active le bouton. Elle n’a ni appui
          //    maintenu ni glissement : pour elle, c’est une bascule.
          if (evenement.detail !== 0 || geste.current !== null) return

          if (ecoute !== null) {
            terminer()
            return
          }

          demarrer('clavier')
          passerEnMainsLibres()
        }}
      >
        <IconeMicro enEcoute={ecoute !== null} />
      </button>

      <p class="micro__legende">{legende(ecoute)}</p>
    </div>
  )
}

function legende(ecoute: Ecoute | null): string {
  if (ecoute === null) return 'maintenir pour parler'
  if (ecoute.mode === 'mains-libres') return 'j’écoute — cliquez pour terminer'
  return 'relâchez pour terminer'
}

/** ⛔ Pas d’emoji comme marqueur d’état (references-visuelles.md). */
function IconeMicro({ enEcoute }: { readonly enEcoute: boolean }) {
  if (enEcoute) {
    return (
      <svg class="icone" width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" focusable="false">
        <circle cx="11" cy="11" r="5.5" fill="currentColor" />
      </svg>
    )
  }

  return (
    <svg class="icone" width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" focusable="false">
      <path
        d="M11 3.2a2.6 2.6 0 0 1 2.6 2.6v4.6a2.6 2.6 0 0 1-5.2 0V5.8A2.6 2.6 0 0 1 11 3.2Z"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
      />
      <path
        d="M5.8 10.1a5.2 5.2 0 0 0 10.4 0M11 15.3v3.5"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
      />
    </svg>
  )
}

/**
 * La reconnaissance vocale — Web Speech, via `speech-to-element`.
 *
 * ⚠️ Chrome ou Edge, et c’est un choix assumé ([D-003]). Firefox ne l’implémente
 *    pas et le chantier est fermé chez Mozilla ; Safari est irrégulier. Sur un
 *    navigateur sans dictée, le widget NE SE CASSE PAS ET NE S’EXCUSE PAS : le
 *    bloc micro disparaît, le champ texte prend la place, et rien ne mentionne
 *    ce qui manque.
 *
 * ⚠️ On prend le MOTEUR de `speech-to-element`, pas son composant : aucun
 *    `element` ne lui est passé. C’est délibéré — avec un `element`, la
 *    bibliothèque pose des écouteurs `mousedown`, `mouseup` et `keydown` sur le
 *    DOCUMENT DE L’HÔTE, et le widget n’a pas le droit de capter ses raccourcis
 *    (01-Specs/widget.md §3). Sans `element`, elle se contente d’appeler
 *    `onResult`, ce qui est tout ce dont on a besoin.
 *
 * ⚠️ Ce qu’elle nous apporte vraiment, et qui justifie la dépendance : Chrome
 *    coupe `SpeechRecognition` tout seul après un silence, et il faut le
 *    relancer sans perdre ce qui précède. C’est ce recollage qui est éprouvé.
 */
import SpeechToElement from 'speech-to-element'

/** ⚠️ Le français, explicitement. Le défaut est la langue du navigateur. */
const LANGUE = 'fr-FR'

export interface Dictee {
  /** Coupe la reconnaissance. Le transcript déjà reçu reste acquis. */
  arreter(): void
}

export interface OptionsDictee {
  /**
   * Appelé à chaque révision du transcript.
   *
   * @param definitif ce que le moteur a arrêté — c’est lui qui part en base
   *   comme `transcriptBrut`
   * @param provisoire ce qu’il est en train d’entendre, appelé à changer
   */
  readonly surTexte: (definitif: string, provisoire: string) => void
  /** Le moteur a rendu la main de lui-même. */
  readonly surFin?: () => void
  /** ⚠️ Silencieux côté interface : on ne s’excuse pas d’une absence. */
  readonly surErreur?: (message: string) => void
  /** Injectable pour les tests. */
  readonly moteur?: typeof SpeechToElement
}

/**
 * La dictée est-elle possible ici ?
 *
 * ⛔ Appelée AVANT de dessiner quoi que ce soit : c’est elle qui décide si le
 *    bloc micro existe. Il n’y a pas de version dégradée du micro, il y a un
 *    micro ou rien.
 */
export function dicteeDisponible(moteur: typeof SpeechToElement = SpeechToElement): boolean {
  try {
    return moteur.isWebSpeechSupported()
  } catch {
    return false
  }
}

export function dicter(options: OptionsDictee): Dictee {
  const moteur = options.moteur ?? SpeechToElement

  let definitif = ''

  moteur.startWebSpeech({
    language: LANGUE,
    // ⚠️ Les résultats provisoires sont le cœur de l’écran : c’est ce qui
    //    s’écrit en direct sous l’onde, et ce qui prouve que ça marche.
    displayInterimResults: true,
    onResult: (texte, estFinal) => {
      if (estFinal) {
        definitif = recoller(definitif, texte)
        options.surTexte(definitif, '')
        return
      }

      options.surTexte(definitif, texte)
    },
    onStop: () => options.surFin?.(),
    onError: (message) => options.surErreur?.(message),
  })

  return {
    arreter: () => {
      try {
        moteur.stop()
      } catch {
        // Déjà arrêté, ou jamais démarré. Il n’y a rien à réparer.
      }
    },
  }
}

/**
 * ⚠️ Web Speech ne met pas d’espace entre deux segments définitifs, et
 *    `speech-to-element` ne rend que le NOUVEAU morceau. Sans ce recollage, on
 *    obtient « le tri par datese remet à zéro ».
 */
function recoller(acquis: string, nouveau: string): string {
  const morceau = nouveau.trim()
  if (morceau === '') return acquis
  if (acquis === '') return morceau

  return `${acquis} ${morceau}`
}

/**
 * Le microphone, et l’`AnalyserNode` qui rend l’onde HONNÊTE.
 *
 * ⛔ L’onde est calculée ICI, depuis la Web Audio API, jamais animée en boucle.
 *    Une onde fausse se repère en une seconde, et elle discrédite tout le reste
 *    de l’interface : si ça ment ici, pourquoi croire que le retour part
 *    vraiment ? (04-Architecture/references-visuelles.md §Les défauts qu’on
 *    refuse.)
 *
 * ⚠️ Le flux est ouvert au moment du geste, jamais avant. Un widget qui allume
 *    le micro au chargement de la page de l’hôte est un widget qu’on désinstalle.
 *
 * ⚠️ Et il est refermé complètement à la fin — pistes arrêtées ET contexte
 *    audio fermé. Sinon la pastille d’enregistrement du navigateur reste
 *    allumée, et c’est ce que la personne voit.
 */

/** Ce qu’on lit du micro, une fois ouvert. */
export interface Micro {
  /**
   * Le niveau sonore instantané, en RMS de 0 à 1.
   *
   * ⚠️ RMS et non crête : la crête saute sur un claquement de clavier, le RMS
   *    suit la voix.
   */
  niveau(): number
  /** Le flux, pour qui voudrait l’enregistrer. ⚠️ Personne, à ce stade. */
  readonly flux: MediaStream
  arreter(): void
}

export interface OptionsMicro {
  /** Injectable pour les tests. */
  readonly media?: MediaDevices
  /** Injectable pour les tests. */
  readonly ContexteAudio?: typeof AudioContext
}

/**
 * ⚠️ 1024 points : assez fin pour que l’onde suive une syllabe, assez court
 *    pour ne rien coûter à la page de l’hôte.
 */
const POINTS = 1024

export type RefusMicro = 'indisponible' | 'refuse'

export type Ouverture = { readonly ok: true; readonly micro: Micro } | { readonly ok: false; readonly refus: RefusMicro }

export async function ouvrirMicro(options: OptionsMicro = {}): Promise<Ouverture> {
  const media = options.media ?? globalThis.navigator?.mediaDevices
  const Contexte = options.ContexteAudio ?? globalThis.AudioContext

  if (!media?.getUserMedia || !Contexte) return { ok: false, refus: 'indisponible' }

  let flux: MediaStream
  try {
    flux = await media.getUserMedia({
      audio: {
        // ⚠️ On garde les traitements du navigateur : le collaborateur est dans
        //    un bureau, pas dans un studio. Ils aident la reconnaissance autant
        //    que l’onde.
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    })
  } catch {
    // ⚠️ Refus de permission, micro occupé, pas de micro du tout : trois causes,
    //    une seule conduite. Le champ texte est là, il n’y a rien à dramatiser.
    return { ok: false, refus: 'refuse' }
  }

  const contexte = new Contexte()
  const source = contexte.createMediaStreamSource(flux)
  const analyseur = contexte.createAnalyser()
  analyseur.fftSize = POINTS
  source.connect(analyseur)

  // ⛔ On ne connecte RIEN à `contexte.destination` : le collaborateur ne doit
  //    pas s’entendre dans ses propres haut-parleurs.

  const echantillons = new Uint8Array(analyseur.fftSize)

  return {
    ok: true,
    micro: {
      flux,
      niveau: () => {
        analyseur.getByteTimeDomainData(echantillons)
        return rms(echantillons)
      },
      arreter: () => {
        for (const piste of flux.getTracks()) piste.stop()
        source.disconnect()
        void contexte.close().catch(() => undefined)
      },
    },
  }
}

/**
 * Le RMS d’un signal centré sur 128.
 *
 * ⚠️ `getByteTimeDomainData` rend des octets où le silence vaut 128, pas 0.
 *    L’oublier donne une onde qui bat à fond en permanence — une onde fausse
 *    d’un autre genre.
 */
export function rms(echantillons: Uint8Array | readonly number[]): number {
  if (echantillons.length === 0) return 0

  let somme = 0
  for (let i = 0; i < echantillons.length; i += 1) {
    const ecart = ((echantillons[i] ?? 128) - 128) / 128
    somme += ecart * ecart
  }

  return Math.sqrt(somme / echantillons.length)
}

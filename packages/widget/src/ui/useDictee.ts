/**
 * L’orchestration de l’écoute : le micro, la reconnaissance, le guet de silence
 * et le compteur, derrière une seule poignée.
 *
 * ⛔ AUCUN ENVOI AUTOMATIQUE D’ICI. On relâche, on relit, on envoie
 *    (01-Specs/widget.md §En écoute). Ce module rend le transcript à la
 *    coquille et s’arrête là.
 *
 * ⚠️ Les trois ports — micro, reconnaissance, guet — sont injectables. C’est ce
 *    qui rend l’écran recettable sans micro et sans Chrome.
 */
import { useCallback, useEffect, useRef, useState } from 'preact/hooks'

import type { Dictee as Reconnaissance, OptionsDictee } from '../dictee/reconnaissance'
import { dicter } from '../dictee/reconnaissance'
import type { Guet, OptionsGuet } from '../dictee/silence'
import { guetterSilence } from '../dictee/silence'
import type { Micro, Ouverture } from '../dictee/micro'
import { ouvrirMicro } from '../dictee/micro'

/** Maintenu, ou mains libres. Le second s’obtient par un clic simple. */
export type ModeEcoute = 'appui' | 'mains-libres'

/**
 * ⚠️ D’où vient le geste. Au clavier, « glisser vers la gauche » n’a pas de
 *    sens : c’est `Échap` qui annule, et c’est ce qu’il faut écrire à l’écran.
 */
export type Origine = 'pointeur' | 'clavier'

export interface PortsDictee {
  readonly ouvrirMicro?: typeof ouvrirMicro
  readonly dicter?: (options: OptionsDictee) => Reconnaissance
  readonly guetterSilence?: (options?: OptionsGuet) => Guet
  /** Injectable pour les tests : `performance.now` par défaut. */
  readonly maintenant?: () => number
}

export interface Ecoute {
  readonly mode: ModeEcoute
  readonly origine: Origine
}

export interface PoigneeDictee {
  readonly ecoute: Ecoute | null
  /** Le transcript arrêté par le moteur. C’est lui qui part en `transcriptBrut`. */
  readonly definitif: string
  /** Ce que le moteur est en train d’entendre. Change à chaque syllabe. */
  readonly provisoire: string
  /** ⚠️ « Glisser pour annuler » n’apparaît qu’au premier son. À vide, c’est du bruit. */
  readonly duSon: boolean
  /** Secondes écoulées. ⚠️ Le compteur ne s’affiche qu’au-delà de trente. */
  readonly secondes: number
  /** Le micro a-t-il été refusé ? Sert à ne pas rester sur un écran mort. */
  readonly refuse: boolean
  /** Le niveau instantané, pour l’onde. Rend 0 hors écoute. */
  niveau(): number
  demarrer(origine: Origine): void
  passerEnMainsLibres(): void
  /** Termine et rend le transcript à la coquille. */
  terminer(): void
  /** ⛔ Jette tout. Rien n’est rendu, rien n’est envoyé. */
  annuler(): void
}

export interface OptionsUseDictee extends PortsDictee {
  /** Reçoit le transcript à la fin. ⛔ Jamais appelé sur une annulation. */
  readonly surTranscript: (transcript: string) => void
}

const SANS_SON = () => 0

export function useDictee(options: OptionsUseDictee): PoigneeDictee {
  const [ecoute, setEcoute] = useState<Ecoute | null>(null)
  const [definitif, setDefinitif] = useState('')
  const [provisoire, setProvisoire] = useState('')
  const [duSon, setDuSon] = useState(false)
  const [secondes, setSecondes] = useState(0)
  const [refuse, setRefuse] = useState(false)

  const micro = useRef<Micro | null>(null)
  const reconnaissance = useRef<Reconnaissance | null>(null)
  const guet = useRef<Guet | null>(null)
  const lireNiveau = useRef<() => number>(SANS_SON)
  const acquis = useRef('')
  /** ⚠️ Une écoute annulée ne doit pas être ressuscitée par un micro qui s’ouvre en retard. */
  const generation = useRef(0)

  const options_ = useRef(options)
  options_.current = options

  const fermer = useCallback(() => {
    generation.current += 1
    reconnaissance.current?.arreter()
    reconnaissance.current = null
    micro.current?.arreter()
    micro.current = null
    guet.current = null
    lireNiveau.current = SANS_SON
    setEcoute(null)
    setProvisoire('')
    setDuSon(false)
    setSecondes(0)
  }, [])

  const terminer = useCallback(() => {
    const transcript = acquis.current.trim()
    fermer()
    setDefinitif('')
    acquis.current = ''
    if (transcript !== '') options_.current.surTranscript(transcript)
  }, [fermer])

  const annuler = useCallback(() => {
    // ⛔ Rien n’est rendu. C’est tout l’intérêt du geste.
    fermer()
    setDefinitif('')
    acquis.current = ''
  }, [fermer])

  const demarrer = useCallback(
    (origine: Origine) => {
      const mien = (generation.current += 1)

      setEcoute({ mode: 'appui', origine })
      setRefuse(false)
      setDefinitif('')
      setProvisoire('')
      acquis.current = ''
      guet.current = (options_.current.guetterSilence ?? guetterSilence)()

      // ⚠️ La reconnaissance démarre TOUT DE SUITE, sans attendre le micro : elle
      //    ouvre sa propre capture, et le premier mot est le plus précieux.
      reconnaissance.current = (options_.current.dicter ?? dicter)({
        surTexte: (fini, encours) => {
          acquis.current = fini
          setDefinitif(fini)
          setProvisoire(encours)
        },
        surFin: () => undefined,
        surErreur: () => undefined,
      })

      void (options_.current.ouvrirMicro ?? ouvrirMicro)().then((ouverture: Ouverture) => {
        // L’écoute a pu être annulée pendant que la permission s’affichait.
        if (mien !== generation.current) {
          if (ouverture.ok) ouverture.micro.arreter()
          return
        }

        if (!ouverture.ok) {
          // ⚠️ Sans micro, pas d’onde et pas d’arrêt sur silence — mais la
          //    reconnaissance, elle, a sa propre capture et continue.
          setRefuse(ouverture.refus === 'refuse')
          return
        }

        micro.current = ouverture.micro
        lireNiveau.current = () => ouverture.micro.niveau()
      })
    },
    [],
  )

  const passerEnMainsLibres = useCallback(() => {
    setEcoute((actuelle) => (actuelle === null ? null : { ...actuelle, mode: 'mains-libres' }))
  }, [])

  // ── Le guet de silence, et « du son a été entendu » ────────────────────────
  useEffect(() => {
    if (ecoute === null) return

    const horloge = options_.current.maintenant ?? (() => performance.now())
    let image = 0

    const tour = (): void => {
      const niveau = lireNiveau.current()
      const vigie = guet.current

      if (vigie) {
        const finDuSilence = vigie.observer(niveau, horloge())
        if (vigie.aEntenduDuSon()) setDuSon(true)
        // ⛔ Le silence n’arrête QUE le mode mains libres. Sous le doigt, c’est
        //    le doigt qui décide.
        if (finDuSilence && ecoute.mode === 'mains-libres') {
          terminer()
          return
        }
      }

      image = requestAnimationFrame(tour)
    }

    image = requestAnimationFrame(tour)
    return () => cancelAnimationFrame(image)
  }, [ecoute, terminer])

  // ── Le compteur ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (ecoute === null) return

    const debut = Date.now()
    const battement = setInterval(() => setSecondes(Math.floor((Date.now() - debut) / 1000)), 1_000)
    return () => clearInterval(battement)
  }, [ecoute])

  // ⚠️ Le démontage ferme le micro. Sans ça, la pastille d’enregistrement du
  //    navigateur reste allumée après la fermeture du panneau.
  useEffect(() => fermer, [fermer])

  return {
    ecoute,
    definitif,
    provisoire,
    duSon,
    secondes,
    refuse,
    niveau: () => lireNiveau.current(),
    demarrer,
    passerEnMainsLibres,
    terminer,
    annuler,
  }
}

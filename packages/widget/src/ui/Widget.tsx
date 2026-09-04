/**
 * La coquille : FERMÉ, OUVERT, EN ÉCOUTE, ENVOYÉ.
 *
 * ⛔ LE MICRO EST PROPOSÉ, JAMAIS IMPOSÉ. Le champ texte est au MÊME niveau de
 *    visibilité, atteignable au clavier, sur le même écran — pas derrière un
 *    lien. Quelqu’un en open space, quelqu’un d’enroué, quelqu’un qui préfère
 *    écrire : trois cas ordinaires, pas des cas limites (CLAUDE.md §La parole
 *    d’abord, mais jamais la parole seulement).
 *
 * ⛔ Et sur un navigateur sans Web Speech, le bloc micro DISPARAÎT sans un mot.
 *    On ne s’excuse pas d’une absence ([D-003]).
 *
 * ⚠️ Le composant ne connaît ni le réseau ni snapdom : il reçoit ses ports, et
 *    c’est ce qui le rend recettable sans serveur et sans micro.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks'

import type { Contexte, CorpsRetour } from '../contrat'
import { dicteeDisponible } from '../dictee/reconnaissance'
import type { Resultat } from '../envoi'

import { Ecoute } from './Ecoute'
import { piegerFocus } from './focus'
import { Micro } from './Micro'
import type { PortsDictee } from './useDictee'
import { useDictee } from './useDictee'

export interface Commandes {
  ouvrir(): void
  fermer(): void
}

export interface Ports {
  /**
   * Le contexte, pris à l’OUVERTURE du panneau — jamais au chargement de la
   * page de l’hôte : c’est là que snapdom est chargé (D-011) et que l’URL est
   * encore celle où la personne a buté.
   */
  readonly collecter: () => Promise<Contexte>
  readonly envoyer: (corps: CorpsRetour) => Promise<Resultat>
  /** Reçoit de quoi piloter le widget depuis `window.feedys`. */
  readonly brancher?: (commandes: Commandes) => void
  /** Injectable pour les tests. Par défaut : `navigator.onLine`. */
  readonly enLigne?: () => boolean
  /**
   * ⛔ La dictée est-elle possible ? Décidé UNE fois, au montage : c’est ce qui
   *    fait exister — ou non — le bloc micro. Il n’y a pas de version dégradée
   *    du micro, il y a un micro ou rien.
   */
  readonly dicteeDisponible?: () => boolean
  /** Les ports de l’écoute. Injectables pour la recette sans micro. */
  readonly dictee?: PortsDictee
}

/** L’accusé reste deux secondes. Assez pour être lu, trop peu pour gêner. */
const DUREE_ACCUSE = 2_000

type Phase = 'repos' | 'envoi' | 'envoye'

/**
 * ⚠️ `source` mesure le pari du produit : la part de retours dictés
 *    (04-Architecture/hebergement.md §Ce qui doit être surveillé). Elle vaut
 *    `voix` dès qu’un mot est venu du micro, même corrigé au clavier ensuite —
 *    c’est le CHEMIN EMPRUNTÉ qu’elle décrit, pas l’état final du texte.
 */
type Source = 'voix' | 'texte'

export function Widget(ports: Ports) {
  const [ouvert, setOuvert] = useState(false)
  /** ⚠️ Le brouillon vit ICI, en mémoire. ⛔ Ni localStorage, ni cookie. */
  const [texte, setTexte] = useState('')
  const [phase, setPhase] = useState<Phase>('repos')
  const [avis, setAvis] = useState('')
  const [source, setSource] = useState<Source>('texte')
  /** Le transcript AVANT correction à la main. On garde les hésitations : elles portent du sens. */
  const [transcriptBrut, setTranscriptBrut] = useState('')

  const lanceur = useRef<HTMLButtonElement | null>(null)
  const panneau = useRef<HTMLDivElement | null>(null)
  const champ = useRef<HTMLTextAreaElement | null>(null)
  const contexte = useRef<Promise<Contexte> | null>(null)
  /** Un envoi qui attend le retour du réseau. */
  const enAttente = useRef(false)
  /** ⚠️ Le focus ne revient au lanceur que si c’est NOUS qui avons fermé. */
  const rendreLeFocus = useRef(false)

  const ouvrir = useCallback(() => {
    setOuvert((deja) => {
      // ⚠️ La collecte démarre au premier mot du geste, pas au rendu : l’URL
      //    d’une application à routeur peut changer sous nos pieds.
      if (!deja) contexte.current = ports.collecter()
      return true
    })
  }, [ports])

  const fermer = useCallback(() => {
    rendreLeFocus.current = true
    setOuvert(false)
    setAvis('')
  }, [])

  /**
   * ⛔ La disponibilité est décidée UNE fois. Elle ne peut pas changer en cours
   *    de session, et la recalculer à chaque rendu ferait clignoter le bloc.
   */
  const micro = useMemo(() => (ports.dicteeDisponible ?? dicteeDisponible)(), [ports])

  const dictee = useDictee({
    ...ports.dictee,
    // ⛔ AUCUN ENVOI AUTOMATIQUE. Le transcript rejoint le champ texte, et c’est
    //    la personne qui relit et qui envoie (01-Specs/widget.md §En écoute).
    surTranscript: (transcript) => {
      setSource('voix')
      setTranscriptBrut((deja) => joindre(deja, transcript))
      setTexte((deja) => joindre(deja, transcript))
      champ.current?.focus()
    },
  })

  useEffect(() => {
    ports.brancher?.({ ouvrir, fermer })
  }, [ports, ouvrir, fermer])

  const expedier = useCallback(async () => {
    const contenu = texte.trim()
    if (contenu === '') return

    setPhase('envoi')
    setAvis('')

    const resultat = await ports.envoyer({
      texte: contenu,
      // ⚠️ Pas décoratif : c’est la mesure du pari du produit
      //    (04-Architecture/hebergement.md §Ce qui doit être surveillé).
      source,
      // ⚠️ Ce que le moteur a entendu, avant toute correction. On garde les
      //    hésitations : elles portent du sens (conventions-db.md).
      ...(transcriptBrut === '' ? {} : { transcriptBrut }),
      contexte: (await contexte.current) ?? (await ports.collecter()),
    })

    if (resultat.ok) {
      enAttente.current = false
      setTexte('')
      setTranscriptBrut('')
      setSource('texte')
      setPhase('envoye')
      return
    }

    setPhase('repos')
    setAvis(resultat.message)
    // ⚠️ On garde le brouillon et on repart tout seul à la reconnexion, sans
    //    rien demander (01-Specs/widget.md §Ce que le widget ne fait jamais).
    enAttente.current = resultat.reessayable && !(ports.enLigne ?? parDefautEnLigne)()
  }, [ports, texte, source, transcriptBrut])

  // ── L’accusé, puis la fermeture ────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'envoye') return

    const minuterie = setTimeout(() => {
      setPhase('repos')
      rendreLeFocus.current = true
      setOuvert(false)
    }, DUREE_ACCUSE)

    return () => clearTimeout(minuterie)
  }, [phase])

  // ── La reprise à la reconnexion ────────────────────────────────────────────
  const dernierExpedier = useRef(expedier)
  dernierExpedier.current = expedier

  useEffect(() => {
    const reprendre = (): void => {
      if (!enAttente.current) return
      enAttente.current = false
      void dernierExpedier.current()
    }

    globalThis.addEventListener?.('online', reprendre)
    return () => globalThis.removeEventListener?.('online', reprendre)
  }, [])

  // ── Le focus : dans le champ à l’ouverture, sur le lanceur à la fermeture ──
  useLayoutEffect(() => {
    if (ouvert) {
      // ⚠️ Pas pendant l’écoute : le focus est sur le micro, et le lui prendre
      //    couperait le geste au clavier (`Espace` maintenu).
      if (dictee.ecoute === null) champ.current?.focus()
      return
    }

    if (rendreLeFocus.current) {
      rendreLeFocus.current = false
      lanceur.current?.focus()
    }
  }, [ouvert, phase, dictee.ecoute])

  // ── Le piège à focus, seulement panneau ouvert ─────────────────────────────
  useEffect(() => {
    const boite = panneau.current
    if (!ouvert || !boite) return
    return piegerFocus(boite, { surEchap: fermer })
  }, [ouvert, phase, fermer, dictee.ecoute])

  const vide = texte.trim() === ''

  return (
    <>
      {ouvert && (
        <div class="panneau" ref={panneau} role="dialog" aria-modal="true" aria-labelledby="w-titre">
          <div class="entete">
            <h2 class="titre" id="w-titre">
              Qu’est-ce qui se passe ?
            </h2>
            <button class="fermer" type="button" onClick={fermer} aria-label="Fermer">
              <Croix />
            </button>
          </div>

          {phase === 'envoye' ? (
            <div class="accuse" role="status">
              <strong>C’est parti.</strong>
              <p>Merci — vous n’avez rien d’autre à faire.</p>
            </div>
          ) : (
            <>
              <div class="corps">
                {dictee.ecoute !== null && <Ecoute dictee={dictee} />}

                {/*
                  ⛔ Le bloc micro n’existe pas du tout sans Web Speech : il ne
                     se grise pas, il ne s’excuse pas, il DISPARAÎT, et le champ
                     texte prend la place ([D-003]).

                  ⚠️ Il est rendu au MÊME endroit de l’arbre dans les deux états.
                     Preact réutilise donc le même nœud, et la capture de
                     pointeur survit au passage en écoute — sans quoi le
                     relâchement du doigt se perdrait.
                */}
                {micro && (
                  <Micro
                    ecoute={dictee.ecoute}
                    demarrer={dictee.demarrer}
                    passerEnMainsLibres={dictee.passerEnMainsLibres}
                    terminer={dictee.terminer}
                    annuler={dictee.annuler}
                  />
                )}

                {dictee.ecoute === null && (
                  <>
                    {/* ⚠️ « ou », pas « ou bien écrire à la place » : les deux
                          chemins sont au même niveau, et l’un ne contourne pas
                          l’autre (01-Specs/widget.md §Ouvert). */}
                    {micro && (
                      <p class="separateur" aria-hidden="true">
                        <span>ou</span>
                      </p>
                    )}
                    <textarea
                      class="champ"
                      ref={champ}
                      value={texte}
                      disabled={phase === 'envoi'}
                      aria-label="Votre retour"
                      placeholder="Ce qui vous a bloqué, ou l’idée qui vient de vous venir."
                      onInput={(evenement) => {
                        setTexte(evenement.currentTarget.value)
                      }}
                    />
                  </>
                )}

                <div class="avis" role="status">
                  {avis}
                </div>
              </div>

              {/* ⛔ Pas de bouton d’envoi pendant l’écoute : « on relâche, on
                     relit, on envoie ». Aucun envoi automatique depuis cet
                     état (01-Specs/widget.md §En écoute). */}
              {dictee.ecoute === null && (
                <div class="pied">
                  <button
                    class="envoyer"
                    type="button"
                    disabled={vide || phase === 'envoi'}
                    onClick={() => void expedier()}
                  >
                    {phase === 'envoi' ? 'Envoi…' : 'Envoyer'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <button
        class="lanceur"
        type="button"
        ref={lanceur}
        aria-expanded={ouvert}
        aria-haspopup="dialog"
        onClick={() => (ouvert ? fermer() : ouvrir())}
      >
        {ouvert ? <Croix /> : <Bulle />}
        <span class="lanceur__libelle">{ouvert ? 'Fermer' : 'Un retour'}</span>
      </button>
    </>
  )
}

/** ⚠️ On dicte souvent en deux fois : le second transcript s’ajoute au premier. */
function joindre(deja: string, ajout: string): string {
  const propre = ajout.trim()
  if (propre === '') return deja
  return deja.trim() === '' ? propre : `${deja.trimEnd()} ${propre}`
}

function parDefautEnLigne(): boolean {
  return globalThis.navigator?.onLine !== false
}

/** ⛔ Pas d’emoji comme marqueur d’état (references-visuelles.md). */
function Bulle() {
  return (
    <svg class="icone" width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path
        d="M10 2.5c-4.14 0-7.5 2.9-7.5 6.5 0 2 1.04 3.79 2.67 4.98v3.02l3.1-1.72c.55.1 1.13.16 1.73.16 4.14 0 7.5-2.9 7.5-6.44S14.14 2.5 10 2.5Z"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linejoin="round"
      />
    </svg>
  )
}

function Croix() {
  return (
    <svg class="icone" width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M5.5 5.5l9 9m0-9l-9 9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
    </svg>
  )
}

/**
 * La coquille : FERMÉ, OUVERT, EN ÉCOUTE, EN ENTRETIEN, ENVOYÉ.
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
 * ⛔ « ENVOYER MAINTENANT » EST VISIBLE À CHAQUE TOUR, SANS EXCEPTION, ET
 *    JAMAIS DÉSACTIVÉ PENDANT L’ENTRETIEN. On ne piège personne dans un
 *    entretien (01-Specs/entretien.md §règle 5).
 *
 * ⚠️ Le composant ne connaît ni le réseau ni snapdom : il reçoit ses ports, et
 *    c’est ce qui le rend recettable sans serveur et sans micro.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks'

import type { Comprehension, Contexte, CorpsFin, CorpsRetour, CorpsTour, TourRendu } from '../contrat'
import { dicteeDisponible } from '../dictee/reconnaissance'
import type { Resultat } from '../envoi'
import type { ResultatTour } from '../entretien'
import { rendreCorrections } from '../entretien'

import { Carte } from './Carte'
import { Ecoute } from './Ecoute'
import { piegerFocus } from './focus'
import { Micro } from './Micro'
import { TEXTES, TOUR_SANS_SUITE, inviteChamp } from './textes'
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
  /**
   * Un tour d’entretien. ⛔ Le widget ne compte rien : il demande, il lit
   * `question`, et `null` veut dire que c’est fini. La limite de deux relances
   * est appliquée par le serveur (01-Specs/entretien.md §2).
   */
  readonly demanderTour: (retour: string, corps: CorpsTour) => Promise<ResultatTour>
  /**
   * La fin de l’entretien. ⚠️ `garderEnVie` sert le panneau qu’on referme en
   * quittant la page : sans lui, le navigateur annule la requête et l’abandon
   * ne serait jamais enregistré.
   */
  readonly terminer: (retour: string, corps: CorpsFin, garderEnVie?: boolean) => Promise<boolean>
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

type Phase = 'repos' | 'envoi' | 'entretien' | 'envoye'

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

  /** L’identifiant du retour, une fois la parole en base. */
  const [retour, setRetour] = useState<string | null>(null)
  const [tour, setTour] = useState<TourRendu | null>(null)
  /** La carte telle qu’elle est à l’écran — corrections comprises. */
  const [carte, setCarte] = useState<Comprehension | null>(null)
  /** ⚠️ Ce que le bot avait compris. C’est la RÉFÉRENCE du diff, pas un doublon. */
  const [carteOrigine, setCarteOrigine] = useState<Comprehension | null>(null)
  const [attente, setAttente] = useState(false)

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

  /** Ce que la personne a corrigé sur la carte, ou rien. */
  const corrections =
    carte && carteOrigine ? rendreCorrections(carteOrigine, carte) : ''

  /** Ce qu’elle vient de dire ou d’écrire, prêt à partir. */
  const apport = useCallback((): { texte?: string; transcriptBrut?: string } => {
    const contenu = texte.trim()
    if (contenu === '') return {}
    return { texte: contenu, ...(transcriptBrut === '' ? {} : { transcriptBrut }) }
  }, [texte, transcriptBrut])

  const oublierApport = useCallback(() => {
    setTexte('')
    setTranscriptBrut('')
    setSource('texte')
  }, [])

  /**
   * ⛔ La fin. Elle est appelée par « Envoyer maintenant », par la fermeture du
   *    panneau, et par `question: null` — trois chemins, un seul appel, et le
   *    serveur décide du statut.
   */
  const conclure = useCallback(
    async (raison: 'envoi' | 'abandon', garderEnVie = false): Promise<void> => {
      const identifiant = retour
      if (identifiant === null) return

      const corps: CorpsFin = {
        raison,
        ...apport(),
        ...(corrections === '' ? {} : { corrections }),
      }

      // ⚠️ On sort de l’entretien AVANT d’attendre le réseau : la personne a
      //    cliqué, elle ne doit pas voir un panneau figé. `retour` remis à null
      //    interdit du même coup un second envoi pendant celui-ci.
      oublierApport()
      setRetour(null)
      setTour(null)

      if (raison === 'envoi') {
        // ⚠️ La carte reste à l’écran, figée, pendant l’envoi : « carte mise à
        //    jour, puis envoi » (01-Specs/entretien.md §Deux échanges). Elle
        //    part avec l’accusé.
        setPhase('envoi')
      } else {
        // Le panneau est déjà refermé. On remet tout à zéro pour la prochaine
        // ouverture : rouvrir sur la carte d’un entretien clos n’aurait aucun
        // sens, et les boutons ne pointeraient plus sur rien.
        setPhase('repos')
        setCarte(null)
        setCarteOrigine(null)
      }

      await ports.terminer(identifiant, corps, garderEnVie)

      // ⛔ Même si la fin échoue, on ne dit rien et on n’insiste pas : le retour
      //    est en base depuis le premier tour. C’est son statut qui est
      //    approximatif, pas la parole (01-Specs/entretien.md).
      if (raison === 'envoi') setPhase('envoye')
    },
    [apport, corrections, oublierApport, ports, retour],
  )

  const fermer = useCallback(() => {
    rendreLeFocus.current = true
    setOuvert(false)
    setAvis('')
    // ⛔ Le panneau refermé en cours d’entretien N’EST PAS UNE PERTE : le retour
    //    est conservé et envoyé en l’état, marqué `abandonne`.
    if (phase === 'entretien') void conclure('abandon')
  }, [conclure, phase])

  /** Demande un tour et pose la carte. ⚠️ Un échec n’affiche pas de carte. */
  const jouer = useCallback(
    async (identifiant: string, corps: CorpsTour): Promise<void> => {
      setAttente(true)
      setAvis('')
      const resultat = await ports.demanderTour(identifiant, corps)
      setAttente(false)

      if (!resultat.ok) {
        // ⛔ La carte n’apparaît pas, le champ texte reste, « Envoyer » marche.
        //
        // ⚠️ Mais l’écran ne reste plus MUET : on cliquait « Répondre » et il
        //    ne se passait rien du tout. La phrase dit la seule chose qui
        //    compte pour la personne — sa parole est arrivée — et ⛔ ne dit
        //    pas pourquoi le bot n’a pas répondu (textes.ts).
        setTour(null)
        setAvis(TOUR_SANS_SUITE)
        return
      }

      setTour(resultat.tour)
      setCarte(resultat.tour.comprehension)
      setCarteOrigine(resultat.tour.comprehension)
    },
    [ports],
  )

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
      oublierApport()
      // ⛔ La parole est en base. Tout ce qui suit peut échouer sans rien perdre.
      setRetour(resultat.retour)
      setPhase('entretien')
      void jouer(resultat.retour, {})
      return
    }

    setPhase('repos')
    setAvis(resultat.message)
    // ⚠️ On garde le brouillon et on repart tout seul à la reconnexion, sans
    //    rien demander (01-Specs/widget.md §Ce que le widget ne fait jamais).
    enAttente.current = resultat.reessayable && !(ports.enLigne ?? parDefautEnLigne)()
  }, [jouer, oublierApport, ports, texte, source, transcriptBrut])

  /** Répondre à la question du bot — ou simplement lui envoyer une correction. */
  const repondre = useCallback(() => {
    const identifiant = retour
    if (identifiant === null) return

    const corps: CorpsTour = {
      ...apport(),
      ...(corrections === '' ? {} : { corrections }),
    }

    oublierApport()
    setCarteOrigine(carte)
    void jouer(identifiant, corps)
  }, [apport, carte, corrections, jouer, oublierApport, retour])

  useEffect(() => {
    ports.brancher?.({ ouvrir, fermer })
  }, [ports, ouvrir, fermer])

  // ── Plus rien à demander : on envoie, sans retenir personne ────────────────
  useEffect(() => {
    if (phase !== 'entretien' || attente || tour === null || tour.question !== null) return
    void conclure('envoi')
  }, [phase, attente, tour, conclure])

  // ── L’accusé, puis la fermeture ────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'envoye') return

    const minuterie = setTimeout(() => {
      setPhase('repos')
      setCarte(null)
      setCarteOrigine(null)
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

  // ── L’onglet qu’on quitte pendant un entretien ─────────────────────────────
  //    ⛔ Le retour est conservé et envoyé en l’état. `pagehide` et pas
  //       `beforeunload` : c’est le seul que les navigateurs mobiles déclenchent.
  const dernierConclure = useRef(conclure)
  dernierConclure.current = conclure

  useEffect(() => {
    if (phase !== 'entretien') return

    const quitter = (): void => {
      void dernierConclure.current('abandon', true)
    }

    globalThis.addEventListener?.('pagehide', quitter)
    return () => globalThis.removeEventListener?.('pagehide', quitter)
  }, [phase])

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
  const enEntretien = phase === 'entretien'
  const rienAEnvoyer = vide && corrections === ''

  // ⚠️ Une question vide n’est pas une question. Le serveur normalise déjà,
  //    mais le widget rendait un `<p>` vide si jamais elle passait.
  const question = tour?.question != null && tour.question.trim() !== '' ? tour.question : null

  // ⛔ C’EST ICI QUE LE DÉFAUT 004 SE FERME : l’invite regarde la CARTE et la
  //    QUESTION, pas la seule phase (packages/widget/src/ui/textes.ts).
  const invite = inviteChamp({ enEntretien, aCarte: carte !== null, aQuestion: question !== null })

  return (
    <>
      {ouvert && (
        <div class="panneau" ref={panneau} role="dialog" aria-modal="true" aria-labelledby="w-titre">
          <div class="entete">
            <h2 class="titre" id="w-titre">
              {TEXTES.titre}
            </h2>
            <button class="fermer" type="button" onClick={fermer} aria-label={TEXTES.fermer}>
              <Croix />
            </button>
          </div>

          {phase === 'envoye' ? (
            <div class="accuse" role="status">
              <strong>{TEXTES.accuse.titre}</strong>
              <p>{TEXTES.accuse.detail}</p>
            </div>
          ) : (
            <>
              <div class="corps">
                {/* ⛔ La carte d’abord, la question DESSOUS — jamais dedans
                       (01-Specs/widget.md §En entretien). */}
                {carte !== null && (
                  <Carte valeurs={carte} surCorrection={setCarte} fige={phase === 'envoi'} />
                )}

                {attente && carte === null && (
                  <p class="attente" role="status">
                    {TEXTES.attente}
                  </p>
                )}

                {question !== null && (
                  <p class="question" role="status">
                    {question}
                  </p>
                )}

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
                        <span>{TEXTES.separateur}</span>
                      </p>
                    )}
                    <textarea
                      class="champ"
                      ref={champ}
                      value={texte}
                      disabled={phase === 'envoi'}
                      aria-label={invite.ariaLabel}
                      placeholder={invite.placeholder}
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
                  {enEntretien && (
                    <button
                      class="repondre"
                      type="button"
                      disabled={rienAEnvoyer || attente}
                      onClick={repondre}
                    >
                      {TEXTES.boutons.repondre}
                    </button>
                  )}

                  {/* ⛔ Pendant l’entretien, il n’est JAMAIS désactivé. On ne
                         retient personne (01-Specs/entretien.md §règle 5). */}
                  <button
                    class="envoyer"
                    type="button"
                    disabled={enEntretien ? false : vide || phase === 'envoi'}
                    onClick={() => (enEntretien ? void conclure('envoi') : void expedier())}
                  >
                    {phase === 'envoi'
                      ? TEXTES.boutons.envoiEnCours
                      : enEntretien
                        ? TEXTES.boutons.envoyerMaintenant
                        : TEXTES.boutons.envoyer}
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
        <span class="lanceur__libelle">{ouvert ? TEXTES.fermer : TEXTES.lanceur}</span>
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

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

import type { Axe, Comprehension, Contexte, CorpsFin, CorpsRetour, CorpsTour, IndiceContexte, ReponseCollaborateur, TourRendu, ValeurAxe } from '../contrat'
import { dicteeDisponible } from '../dictee/reconnaissance'
import type { Resultat } from '../envoi'
import type { ResultatTour } from '../entretien'
import { rendreCorrections } from '../entretien'

import { Carte } from './Carte'
import { Ecoute } from './Ecoute'
import { piegerFocus } from './focus'
import { Indices } from './Indices'
import { Micro } from './Micro'
import { Propositions } from './Propositions'
import { TEXTES, TOUR_SANS_SUITE, inviteChamp, titreNotification } from './textes'
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
  /** Relève des réponses aux retours traités pour le collaborateur. */
  readonly releverReponses?: () => Promise<readonly ReponseCollaborateur[]>
  /** Accuse réception d’une réponse consultée par le collaborateur. */
  readonly accuserReception?: (retourId: string) => Promise<boolean>
}

/**
 * ⛔ Trois cartes au plus, et les suivantes attendent leur tour.
 *
 * ⚠️ Le geste qui rend ce plafond nécessaire est banal : un développeur qui
 *    solde dix vieux retours d’un coup. Sans lui, dix cartes s’empilent en
 *    tête du panneau et poussent le micro hors de l’écran — le widget cesse
 *    de servir à parler, qui est sa seule raison d’exister.
 *
 * ⛔ Et surtout PAS de « et 7 autres » : compter est exactement ce que D-021
 *    s’interdit. Les autres arrivent au fur et à mesure des « J’ai vu », sans
 *    jamais annoncer combien il en reste.
 */
const CARTES_AU_PLUS = 3

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

/**
 * Le contexte, privé de ses indices quand la case a été décochée.
 *
 * ⛔ ON RETIRE LE CHAMP, ON NE L’ENVOIE PAS VIDE. Un `indices: []` se lirait en
 *    base comme « le navigateur n’a rien relevé », alors que la vérité est
 *    « quelqu’un a refusé de le joindre ». Les deux ne se confondent pas, et la
 *    seconde ne nous regarde pas : décocher doit tout effacer, y compris la
 *    trace d’avoir décoché (D-026).
 */
function sansIndicesSiRefuses(contexte: Contexte, joints: boolean): Contexte {
  if (joints) return contexte
  const { indices: _refuses, ...reste } = contexte
  return reste
}

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
  /** Les réponses non lues pour ce collaborateur (P-020). */
  const [reponses, setReponses] = useState<readonly ReponseCollaborateur[]>([])

  /**
   * Ce que le navigateur a relevé, tel qu’il sera joint (D-026).
   *
   * ⚠️ En état et pas seulement dans la promesse de contexte : il faut le
   *    MONTRER, et on ne rend pas une promesse.
   */
  const [indices, setIndices] = useState<readonly IndiceContexte[]>([])
  /** ⛔ Décoché, rien ne part. Le défaut est « joint », et il est montré. */
  const [indicesJoints, setIndicesJoints] = useState(true)
  /** ⚠️ Replié par défaut : trois lignes techniques ne sont pas le sujet. */
  const [indicesDeplies, setIndicesDeplies] = useState(false)

  const lanceur = useRef<HTMLButtonElement | null>(null)
  const panneau = useRef<HTMLDivElement | null>(null)
  const champ = useRef<HTMLTextAreaElement | null>(null)
  const contexte = useRef<Promise<Contexte> | null>(null)
  /** Un envoi qui attend le retour du réseau. */
  const enAttente = useRef(false)
  /** ⚠️ Le focus ne revient au lanceur que si c’est NOUS qui avons fermé. */
  const rendreLeFocus = useRef(false)

  /**
   * ⛔ Ce que le collaborateur a déjà écarté d’un « J’ai vu », pour cette page.
   *
   * ⚠️ Sans lui, la carte REVIENT : l’accusé retire la carte tout de suite,
   *    mais une relève encore en vol — celle de l’ouverture du panneau — se
   *    résout après coup avec la liste d’AVANT le clic et la remet. Le serveur,
   *    lui, a raison au tour suivant ; c’est l’instant d’après qui ment.
   */
  const acquittes = useRef(new Set<string>())

  const verifierReponses = useCallback(async () => {
    if (!ports.releverReponses) return
    try {
      const liste = await ports.releverReponses()
      setReponses(liste.filter((r) => !acquittes.current.has(r.id)))
    } catch {
      // ⚠️ Échec silencieux : une panne réseau ne doit jamais gêner le collaborateur.
    }
  }, [ports])

  useEffect(() => {
    void verifierReponses()
  }, [verifierReponses])

  const acquitter = useCallback(
    async (id: string): Promise<void> => {
      acquittes.current.add(id)
      setReponses((deja) => deja.filter((r) => r.id !== id))
      if (ports.accuserReception) {
        await ports.accuserReception(id)
      }
    },
    [ports],
  )

  const ouvrir = useCallback(() => {
    // ⚠️ Ceinture et bretelles : un panneau qu’on ouvre n’a rien à dire encore.
    //    Aucun chemin connu ne laisse d’avis ici, et c’est précisément le genre
    //    d’affirmation qui a cessé d’être vraie une fois.
    setAvis('')
    setOuvert((deja) => {
      // ⚠️ La collecte démarre au premier mot du geste, pas au rendu : l’URL
      //    d’une application à routeur peut changer sous nos pieds.
      if (!deja) {
        const pris = ports.collecter()
        contexte.current = pris
        // ⚠️ En échec doux, comme la collecte elle-même : un contexte qui rate
        //    laisse la liste vide, le bloc ne s’affiche pas, et l’envoi part.
        void pris.then((collecte) => setIndices(collecte.indices ?? [])).catch(() => setIndices([]))
        void verifierReponses()
      }
      return true
    })
  }, [ports, verifierReponses])

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

  /**
   * ⛔ LA GÉNÉRATION DE L’ÉCRAN. Un tour part, la personne referme le panneau,
   *    le tour revient : il posait alors sa carte et sa question SUR L’ÉCRAN
   *    D’ACCUEIL, et son avis d’échec par-dessus. `useDictee` avait ce garde-fou
   *    depuis toujours ; le composant ne l’avait pas.
   *
   * ⚠️ Elle avance à chaque fin d’entretien. Tout ce qui revient d’un `await`
   *    avec une génération périmée n’écrit plus rien.
   */
  const generation = useRef(0)

  /** Ce que la personne a corrigé sur la carte, ou rien. */
  const corrections =
    carte && carteOrigine ? rendreCorrections(carteOrigine, carte) : ''

  /**
   * ⚠️ Une question vide n’est pas une question. Dérivée ICI, une seule fois :
   *    l’affichage la neutralisait déjà, mais l’effet de conclusion regardait la
   *    valeur BRUTE — une question blanche laissait donc l’entretien ouvert
   *    indéfiniment, carte à l’écran, sans plus rien à quoi répondre.
   */
  const question = tour?.question != null && tour.question.trim() !== '' ? tour.question : null

  /**
   * ⚠️ Dérivé comme `question`, et au même endroit : une question blanche ne
   *    doit pas laisser trois boutons orphelins à l’écran, répondant à une
   *    question que personne ne voit ([BUGS_LOG] 012 pour la même famille).
   */
  const axe = question === null ? null : (tour?.axe ?? null)

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

      // ⛔ L’écran change de génération : un tour encore en vol ne posera plus
      //    ni carte, ni question, ni avis sur ce qui vient après.
      generation.current += 1
      // ⚠️ Et plus rien n’est attendu. Sans ça, un tour en vol laisserait
      //    « Un instant… » collé sur le panneau suivant, faute de pouvoir le
      //    remettre à zéro lui-même une fois périmé.
      setAttente(false)

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
      const mienne = generation.current
      setAttente(true)
      setAvis('')
      const resultat = await ports.demanderTour(identifiant, corps)

      // ⛔ L’ÉCRAN A BOUGÉ PENDANT L’APPEL : on n’écrit plus rien. `conclure` a
      //    déjà remis l’attente à zéro — le faire ici écraserait celle d’un tour
      //    plus récent.
      if (generation.current !== mienne) return

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
      contexte: sansIndicesSiRefuses(
        (await contexte.current) ?? (await ports.collecter()),
        indicesJoints,
      ),
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
  }, [jouer, oublierApport, ports, texte, source, transcriptBrut, indicesJoints])

  /** Répondre à la question du bot — ou simplement lui envoyer une correction. */
  /**
   * ⚠️ `reponse` est le seul paramètre : le reste du tour — ce qui a été tapé,
   *    ce qui a été corrigé sur la carte — part TOUJOURS avec, qu’on ait cliqué
   *    « Répondre » ou une proposition. Quelqu’un qui a commencé à écrire puis
   *    clique sur un bouton n’a pas voulu jeter sa phrase.
   */
  const repondre = useCallback(
    (reponse?: { readonly axe: Axe; readonly valeurAxe: ValeurAxe }) => {
      const identifiant = retour
      if (identifiant === null) return

      const corps: CorpsTour = {
        ...apport(),
        ...(corrections === '' ? {} : { corrections }),
        ...(reponse ?? {}),
      }

      oublierApport()
      setCarteOrigine(carte)
      void jouer(identifiant, corps)
    },
    [apport, carte, corrections, jouer, oublierApport, retour],
  )

  useEffect(() => {
    ports.brancher?.({ ouvrir, fermer })
  }, [ports, ouvrir, fermer])

  // ── Plus rien à demander : on envoie, sans retenir personne ────────────────
  // ⚠️ `question` et non `tour.question` : une question BLANCHE n’était rendue
  //    nulle part à l’écran, et ne concluait rien non plus. L’entretien restait
  //    ouvert pour toujours, carte affichée, invitant à répondre à rien.
  useEffect(() => {
    if (phase !== 'entretien' || attente || tour === null || question !== null) return
    void conclure('envoi')
  }, [phase, attente, tour, question, conclure])

  // ── L’accusé, puis la fermeture ────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'envoye') return

    const minuterie = setTimeout(() => {
      setPhase('repos')
      setCarte(null)
      setCarteOrigine(null)
      // ⛔ L’AVIS AUSSI. Ce chemin referme le panneau SANS passer par `fermer`,
      //    qui était le seul endroit à le nettoyer : un « C’est noté. » resté
      //    d’un tour en échec réapparaissait sous le champ vierge à la
      //    réouverture suivante, sous une invite d’accueil qui n’en parle pas.
      setAvis('')
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
                {/* ⛔ Notifications de retour au collaborateur (P-020) : à sens unique */}
                {phase === 'repos' &&
                  reponses.slice(0, CARTES_AU_PLUS).map((rep) => (
                    <div key={rep.id} class="notification" role="status">
                      <div class="notification__titre">{titreNotification(rep.titre)}</div>
                      {rep.reponseTexte && <p class="notification__texte">{rep.reponseTexte}</p>}
                      <button
                        class="notification__action"
                        type="button"
                        onClick={() => void acquitter(rep.id)}
                      >
                        {TEXTES.notification.action}
                      </button>
                    </div>
                  ))}

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

                {/*
                  ⛔ SOUS la question, AU-DESSUS du micro : les propositions sont
                     un raccourci vers la réponse, pas un remplacement de la
                     parole. Le micro et le champ texte restent en dessous, au
                     même niveau de visibilité (D-025).

                  ⛔ Absentes pendant l’écoute, comme le pied de panneau : « on
                     relâche, on relit, on envoie ». Un bouton qui envoie
                     pendant qu’on parle couperait le geste.

                  ⚠️ `axe` n’est jamais non nul sans question — le verrou est
                     côté serveur, dans borner(). Le test ici est une ceinture,
                     pas la bretelle.
                */}
                {axe !== null && question !== null && dictee.ecoute === null && (
                  <Propositions
                    axe={axe}
                    fige={attente || phase === 'envoi'}
                    surReponse={(axeChoisi, valeurAxe) => {
                      repondre({ axe: axeChoisi, valeurAxe })
                    }}
                  />
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

                {/*
                  ⛔ MONTRÉ AVANT L’ENVOI, ET SEULEMENT AVANT. Passé l’envoi, la
                     parole ET son contexte sont en base : une case à cocher
                     laisserait croire qu’on peut encore retirer ce qui est
                     parti. On ne ment pas sur ce qu’on a déjà (D-026).

                  ⚠️ Ici, en bas, et pas en tête du panneau : le panneau s’ouvre
                     sur « Qu’est-ce qui se passe ? » et sur le micro. Trois
                     lignes techniques posées au-dessus prendraient la place de
                     l’invitation à parler, qui est le geste du produit.
                */}
                {dictee.ecoute === null && (phase === 'repos' || phase === 'envoi') && (
                  <Indices
                    indices={indices}
                    joints={indicesJoints}
                    surBascule={setIndicesJoints}
                    deplie={indicesDeplies}
                    surDeplier={setIndicesDeplies}
                    fige={phase === 'envoi'}
                  />
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
                      // ⚠️ Enveloppé : `onClick` passerait l’événement, et
                      //    `repondre` le prendrait pour une réponse d’axe.
                      onClick={() => {
                        repondre()
                      }}
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
        {...(!ouvert && reponses.length > 0
          ? // ⚠️ La pastille est un pixel : elle ne dit rien à un lecteur d’écran.
            //    Sans ce nom, l’information n’existe QUE pour ceux qui voient.
            { 'aria-label': `${TEXTES.lanceur} — ${TEXTES.notification.attente}` }
          : {})}
        onClick={() => (ouvert ? fermer() : ouvrir())}
      >
        {ouvert ? <Croix /> : <Bulle />}
        {!ouvert && reponses.length > 0 && <span class="lanceur__pastille" aria-hidden="true" />}
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

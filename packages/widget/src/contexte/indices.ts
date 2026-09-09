/**
 * Les indices techniques — ce que le navigateur a relevé avant qu’on ouvre.
 *
 * ⛔ CE MODULE RENVERSE LA RÈGLE D’OCCUPATION N°1 (01-Specs/widget.md §Les
 *    règles d’occupation), qui dit « aucun travail avant l’interaction ». Un
 *    collecteur qui n’écoute qu’à partir du clic n’a rien à raconter : c’est
 *    tout son objet d’avoir écouté avant. Le renversement est assumé, borné et
 *    argumenté dans [D-026](../../../../00-Projet/DECISIONS_LOG.md).
 *
 *    Ce qu’il coûte réellement : deux `addEventListener` passifs et un
 *    `PerformanceObserver`. ⛔ Aucune requête réseau, aucun `setInterval`,
 *    aucune écriture, aucun travail au fil de l’eau — les gestionnaires ne font
 *    que pousser dans un tableau borné à trois entrées.
 *
 * ⛔ TROIS CHOSES QU’IL NE FAIT PAS, ET QUI SONT LA RAISON POUR LAQUELLE IL EST
 *    ACCEPTABLE CHEZ QUELQU’UN D’AUTRE :
 *
 *    1. **Il n’assigne pas `window.onerror`.** Beaucoup d’applications métier
 *       posent le leur ; l’assigner l’écraserait sans un mot. On écoute en
 *       `addEventListener`, qui est additif.
 *    2. **Il n’enveloppe ni `fetch` ni `XMLHttpRequest`.** Envelopper le `fetch`
 *       de son hôte quand on est un invité, c’est entrer dans sa chaîne de
 *       wrappers — Sentry, Datadog et Apollo en posent déjà —, fausser ses
 *       traces et devenir le suspect n°1 de son prochain bug. On lit
 *       `PerformanceObserver`, qui n’altère rien.
 *    3. **Il ne lit pas la console.** `console.error` n’est pas une exception,
 *       et une application métier en écrit des dizaines par jour.
 *
 * ⛔ ET IL NE JOINT JAMAIS LE MESSAGE D’UNE EXCEPTION. `error.message` est du
 *    texte libre écrit par le code de l’hôte : « Le dossier de M. Dupont
 *    (n° 4417) est verrouillé par Marie Lefèvre » est une phrase qu’un logiciel
 *    métier lève tous les jours. Elle finirait en base, dans un email, puis dans
 *    une note lue par un agent de code — dans un dépôt public. On garde ce qui
 *    est STRUCTUREL et stable : le nom de l’exception et sa première trame.
 *
 *    ⚠️ Et il y a un second motif, moins visible : le commentaire de
 *    `apps/serveur/domaine/entretien/prompts.ts` justifie l’absence de risque
 *    d’injection par le fait que le contexte est « une DONNÉE STRUCTURÉE […]
 *    pas une phrase qu’on a dictée ». Un message d’exception peut contenir de
 *    la saisie utilisateur ; le joindre invaliderait par écrit un argument de
 *    sécurité déjà consigné. `nom` + `trame` le laisse intact.
 *
 * ⚠️ TOUT EST EN ÉCHEC DOUX, comme le reste de la collecte. Un navigateur sans
 *    `PerformanceObserver`, un `entryTypes` refusé, un gestionnaire qui lève :
 *    on rend une liste vide et le retour part exactement pareil.
 */
import { BORNES, GENRES_INDICE, INDICES_MAX } from '../transport'

import { estIdentifiant } from './ecran'

/**
 * Un indice, tel qu’il traverse la frontière.
 *
 * ⚠️ La forme canonique vit dans `contrat.ts` (`SchemaIndice`) ; celle-ci est sa
 *    jumelle sans zod, pour la même raison que `BORNES` n’est pas dans
 *    `contrat.ts` — voir l’en-tête de `transport.ts`. `contrat.test.ts` refuse
 *    qu’elles divergent.
 */
export interface Indice {
  readonly genre: (typeof GENRES_INDICE)[number]
  /** ⛔ `js` uniquement : le NOM de l’exception, jamais son message. */
  readonly nom?: string
  /** ⛔ `js` uniquement : la première trame, normalisée. */
  readonly trame?: string
  /** `http` uniquement : le statut de la réponse. */
  readonly statut?: number
  /** `http` uniquement : le chemin, segments identifiants remplacés. */
  readonly chemin?: string
  /** `http` uniquement, et seulement POUSSÉ : `PerformanceObserver` l’ignore. */
  readonly methode?: string
  /** L’identifiant de corrélation vers l’outil de l’hôte. ⛔ Jamais lu ici. */
  readonly reference?: string
  /** Depuis combien de temps, à l’instant de l’ouverture. ⚠️ Posé à la lecture. */
  readonly ecartMs?: number
}

/** Un indice en attente : on garde l’instant, l’écart se calcule à la lecture. */
interface IndiceDate {
  readonly indice: Indice
  readonly a: number
  /** ⚠️ L’écran d’où il vient — voir `derniers()`. */
  readonly ecran: string
}

/** Ce que l’hôte a le droit de pousser lui-même. Tout y est facultatif. */
export interface IndicePousse {
  readonly genre?: string
  readonly nom?: string
  readonly trame?: string
  readonly statut?: number
  readonly chemin?: string
  readonly methode?: string
  readonly reference?: string
}

export interface OptionsIndices {
  /** La fenêtre de l’hôte. Injectable pour les tests. */
  readonly fenetre?: Window
  /**
   * L’origine Feedys.
   *
   * ⛔ Sans elle, le premier indice affiché serait Feedys accusant Feedys :
   *    `snapdom` écrit déjà dans la console de l’hôte
   *    ([T-005](../../../../00-Projet/TICKETS_DIFFERES.md)), et une exception
   *    levée dans notre propre bundle n’apprend rien à personne sur le logiciel
   *    métier. Tout ce qui vient de chez nous est jeté.
   */
  readonly origineFeedys?: string
  /** L’horloge. Injectable pour les tests. */
  readonly maintenant?: () => number
}

export interface Indices {
  /** Les indices retenus, datés à cet instant. ⛔ Ne lève jamais. */
  derniers(): readonly Indice[]
  /** Ce que l’hôte pousse lui-même. ⛔ Ne lève jamais, même sur n’importe quoi. */
  poser(brut: unknown): void
  /** Détache tout. ⚠️ Appelé au démontage — un widget démonté n’écoute plus. */
  arreter(): void
}

/** ⚠️ Un `PerformanceObserver` ne sert à rien en dessous. */
const PREMIER_STATUT_FAUTIF = 400

/** Ce qui remplace un segment identifiant dans un chemin. */
const SEGMENT_ANONYME = ':id'

/** Les méthodes HTTP qu’un hôte peut déclarer. ⛔ Le reste est jeté. */
const METHODES = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])

const VIDE: readonly Indice[] = []

function borner(valeur: unknown, borne: number): string | undefined {
  if (typeof valeur !== 'string') return undefined
  const propre = valeur.trim()
  return propre === '' ? undefined : propre.slice(0, borne)
}

/** ⚠️ Chaque lecture est isolée : une exception n’emporte pas la collecte. */
function doux<T>(lire: () => T): T | undefined {
  try {
    return lire()
  } catch {
    return undefined
  }
}

/**
 * Le chemin d’une URL, sans requête, segments identifiants remplacés.
 *
 * ⛔ SANS CETTE NORMALISATION, LE CHEMIN EST DE LA DONNÉE MÉTIER.
 *    `/api/dossiers/4417/valider` porte un numéro de dossier ;
 *    `/api/clients/jean.dupont@exemple.fr/relances` porte une adresse. Ce qu’on
 *    veut est l’ADRESSE de l’appel — `/api/dossiers/:id/valider` —, jamais son
 *    argument.
 *
 * ⚠️ La liste de ce qui est un identifiant est celle de `ecran.ts`, importée et
 *    pas recopiée : deux listes divergeraient au premier ajout.
 *
 * ⛔ Et la requête est retirée ENTIÈREMENT, pas expurgée. `url.ts` expurge parce
 *    que l’URL de la page est ce qu’on regarde ; ici on n’a besoin que du
 *    chemin, et ce qu’on ne garde pas ne peut pas fuir.
 */
export function normaliserChemin(brut: string, origineHote?: string): string | undefined {
  if (typeof brut !== 'string' || brut.trim() === '') return undefined

  // ⚠️ UNE BASE DE SECOURS, ET ELLE N’EST PAS DÉCORATIVE. `new URL('/api/…')`
  //    LÈVE sans base : un chemin relatif — c’est-à-dire tout ce qu’un hôte
  //    pousse à la main — retombait alors sur la valeur brute, numéro de
  //    dossier compris. Exactement la fuite que cette fonction existe pour
  //    fermer. Seul `pathname` est lu, donc cette origine ne ressort jamais.
  const chemin = doux(() => new URL(brut, origineHote ?? 'https://indice.invalid').pathname)
  if (chemin === undefined || chemin === '') return undefined

  const segments = chemin
    .split('/')
    .map((segment) => (estIdentifiant(decoder(segment)) ? SEGMENT_ANONYME : segment))

  return segments.join('/').slice(0, BORNES.indiceChemin)
}

function decoder(segment: string): string {
  return doux(() => decodeURIComponent(segment)) ?? segment
}

/**
 * La première trame d’une pile, réduite à `fonction (fichier:ligne:colonne)`.
 *
 * ⚠️ La PREMIÈRE seulement. Une pile entière porte les trames du cadre de
 *    travail de l’hôte, elle pèse des kilo-octets, et elle n’apprend rien de
 *    plus que la première ligne à qui a le dépôt sous la main.
 *
 * ⛔ Elle ne rend JAMAIS la ligne de message. La pile de Chrome commence par
 *    `TypeError: le dossier de M. Dupont est verrouillé` — on la saute, c’est
 *    exactement ce qu’on refuse de joindre.
 */
export function premiereTrame(pile: unknown): string | undefined {
  if (typeof pile !== 'string') return undefined

  for (const ligne of pile.split('\n')) {
    const propre = ligne.trim()
    // ⛔ Seules les lignes `at …` sont des trames. Ce qui précède est le
    //    message, et il ne sort pas d’ici.
    if (!propre.startsWith('at ')) continue
    return propre.slice(3).trim().slice(0, BORNES.indiceTrame)
  }

  return undefined
}

/** L’indice vient-il de chez nous ? ⚠️ Voir `OptionsIndices.origineFeedys`. */
function deChezNous(valeur: string | undefined, origineFeedys: string | undefined): boolean {
  if (valeur === undefined || origineFeedys === undefined || origineFeedys === '') return false
  return valeur.includes(origineFeedys)
}

/**
 * Met le collecteur en écoute.
 *
 * ⚠️ Rend un `Indices` inerte plutôt que de lever quand la fenêtre manque ou
 *    refuse : l’appelant n’a jamais à protéger son appel.
 */
export function suivreIndices(options: OptionsIndices = {}): Indices {
  const fenetre = options.fenetre ?? globalThis.window
  const maintenant = options.maintenant ?? (() => Date.now())
  const { origineFeedys } = options

  /** ⚠️ Borné à `INDICES_MAX` en permanence : rien ne grossit avec le temps. */
  const retenus: IndiceDate[] = []

  const retenir = (indice: Indice): void => {
    retenus.push({ indice, a: maintenant(), ecran: ecranCourant() })
    // ⛔ On garde les DERNIERS : le plus récent est le plus probable.
    if (retenus.length > INDICES_MAX) retenus.shift()
  }

  /**
   * ⚠️ Le chemin de l’URL courante, pas l’écran déduit : on ne compare que
   *    l’égalité, et `deduireEcran` réduit deux écrans distincts au même nom.
   */
  const ecranCourant = (): string => doux(() => fenetre.location.pathname) ?? ''

  const surErreur = (evenement: Event): void => {
    doux(() => {
      const { error, filename } = evenement as ErrorEvent
      const nom = borner((error as Error | undefined)?.name, BORNES.indiceNom) ?? 'Error'
      const trame = premiereTrame((error as Error | undefined)?.stack)

      // ⛔ Nos propres erreurs ne sont pas des indices sur le logiciel de l’hôte.
      if (deChezNous(trame, origineFeedys) || deChezNous(filename, origineFeedys)) return

      retenir({ genre: 'js', nom, ...(trame === undefined ? {} : { trame }) })
    })
  }

  const surRejet = (evenement: Event): void => {
    doux(() => {
      const raison = (evenement as PromiseRejectionEvent).reason as Error | undefined
      const nom = borner(raison?.name, BORNES.indiceNom) ?? 'UnhandledRejection'
      const trame = premiereTrame(raison?.stack)

      if (deChezNous(trame, origineFeedys)) return

      retenir({ genre: 'js', nom, ...(trame === undefined ? {} : { trame }) })
    })
  }

  doux(() => {
    // ⛔ `addEventListener`, pas `window.onerror =` : additif, il n’écrase pas
    //    le gestionnaire que l’hôte a peut-être déjà posé.
    // ⚠️ `capture` pour voir passer aussi ce qu’un gestionnaire de l’hôte
    //    arrêterait, et `passive` pour ne jamais retarder la page.
    fenetre.addEventListener('error', surErreur, { capture: true, passive: true })
    fenetre.addEventListener('unhandledrejection', surRejet, { capture: true, passive: true })
  })

  const observateur = observerLesRequetes(fenetre, origineFeedys, retenir)

  return {
    derniers(): readonly Indice[] {
      return (
        doux(() => {
          const ici = ecranCourant()
          const instant = maintenant()

          return (
            retenus
              // ⛔ BORNÉ PAR L’ÉCRAN, PAS PAR UNE DURÉE. Un poste de bureau garde
              //    un onglet ouvert huit heures : un seuil de soixante secondes
              //    jetterait l’erreur de quelqu’un qui a hésité trois minutes
              //    avant d’ouvrir la bulle, et ne garderait que le bruit
              //    provoqué par l’ouverture. Ce qui s’est passé sur un AUTRE
              //    écran, en revanche, ne parle pas de celui-ci (D-026).
              .filter((garde) => garde.ecran === ici)
              .map((garde) => ({ ...garde.indice, ecartMs: ecart(instant - garde.a) }))
          )
        }) ?? VIDE
      )
    },

    poser(brut: unknown): void {
      doux(() => {
        const indice = lireIndicePousse(brut)
        if (indice) retenir(indice)
      })
    },

    arreter(): void {
      doux(() => {
        fenetre.removeEventListener('error', surErreur, { capture: true })
        fenetre.removeEventListener('unhandledrejection', surRejet, { capture: true })
      })
      doux(() => observateur?.disconnect())
      retenus.length = 0
    },
  }
}

/** ⚠️ Borné et entier : la base attend un `int`, pas un flottant de perf. */
function ecart(brut: number): number {
  const arrondi = Math.round(brut)
  if (!Number.isFinite(arrondi) || arrondi < 0) return 0
  return Math.min(arrondi, BORNES.indiceEcartMs)
}

/**
 * L’écoute des requêtes de l’hôte, SANS toucher à `fetch`.
 *
 * ⛔ `PerformanceResourceTiming.responseStatus` n’existe que sur Chromium — et
 *    c’est très exactement l’univers de Feedys, que [D-003] a déjà restreint à
 *    Chrome et Edge pour la dictée. La contrainte qui rend la parole possible
 *    rend ce collecteur propre : ailleurs, `responseStatus` vaut `undefined`,
 *    aucun indice `http` n’est retenu, et rien ne se casse.
 *
 * ⚠️ La méthode HTTP N’EST PAS disponible par ce chemin. Un indice passif n’a
 *    donc pas de `methode` ; seul un indice poussé par l’hôte en porte une.
 *    C’est une limite honnête, pas un oubli.
 */
function observerLesRequetes(
  fenetre: Window | undefined,
  origineFeedys: string | undefined,
  retenir: (indice: Indice) => void,
): PerformanceObserver | undefined {
  return doux(() => {
    // ⚠️ `PerformanceObserver` vit sur `globalThis`, pas sur l’interface
    //    `Window` de TypeScript. On le lit par un port étroit plutôt que
    //    d’élargir le type de la fenêtre injectée dans les tests.
    const { PerformanceObserver: Observateur } = (fenetre ?? {}) as {
      PerformanceObserver?: typeof PerformanceObserver
    }
    if (typeof Observateur !== 'function') return undefined

    const observateur = new Observateur((liste: PerformanceObserverEntryList) => {
      doux(() => {
        for (const entree of liste.getEntries()) {
          const ressource = entree as PerformanceResourceTiming
          const statut = ressource.responseStatus

          if (typeof statut !== 'number' || statut < PREMIER_STATUT_FAUTIF) continue
          // ⛔ Nos propres appels — l’ingestion, l’entretien, snapdom — ne sont
          //    pas des indices sur le logiciel de l’hôte.
          if (deChezNous(ressource.name, origineFeedys)) continue

          const chemin = normaliserChemin(ressource.name)
          if (chemin === undefined) continue

          retenir({ genre: 'http', statut, chemin })
        }
      })
    })

    // ⚠️ `buffered` récupère ce qui est arrivé AVANT nous. Le script est en
    //    `defer` : sans lui, tout ce qui a échoué pendant le démarrage de
    //    l’hôte serait perdu, et c’est précisément le moment où ça échoue.
    observateur.observe({ type: 'resource', buffered: true })
    return observateur
  })
}

/**
 * Relit ce que l’hôte a poussé, sans rien croire.
 *
 * ⛔ TOUT EST RELU ET BORNÉ. C’est du code de quelqu’un d’autre qui appelle : un
 *    objet mal formé, un genre inventé, une pile entière de 40 Ko dans `trame`
 *    ou un `statut` valant `"500"` ne doivent produire ni exception, ni champ
 *    hors contrat — le serveur refuserait le retour ENTIER, et on perdrait une
 *    parole pour une erreur d’intégration.
 *
 * ⚠️ Le message, lui, n’a même pas de champ où atterrir : un hôte qui voudrait
 *    le pousser n’en a pas la possibilité, et c’est délibéré.
 */
export function lireIndicePousse(brut: unknown): Indice | undefined {
  if (typeof brut !== 'object' || brut === null) return undefined

  const donne = brut as IndicePousse
  const genre = GENRES_INDICE.find((connu) => connu === donne.genre)
  const reference = borner(donne.reference, BORNES.indiceReference)

  if (genre === 'http') {
    const statut = Number(donne.statut)
    const chemin = borner(donne.chemin, BORNES.indiceChemin)
    if (!Number.isInteger(statut) || statut < 100 || statut > 599 || chemin === undefined) {
      return undefined
    }

    const methode = borner(donne.methode, BORNES.indiceMethode)?.toUpperCase()

    return {
      genre,
      statut,
      chemin: normaliserChemin(chemin) ?? chemin,
      ...(methode !== undefined && METHODES.has(methode) ? { methode } : {}),
      ...(reference === undefined ? {} : { reference }),
    }
  }

  if (genre === 'js') {
    const nom = borner(donne.nom, BORNES.indiceNom)
    if (nom === undefined) return undefined

    // ⚠️ Une trame poussée passe par le même tamis qu’une trame relevée : un
    //    hôte qui donne sa pile entière n’en verra sortir que la première ligne.
    const trame = premiereTrame(donne.trame) ?? borner(donne.trame, BORNES.indiceTrame)

    return {
      genre,
      nom,
      ...(trame === undefined ? {} : { trame }),
      ...(reference === undefined ? {} : { reference }),
    }
  }

  return undefined
}

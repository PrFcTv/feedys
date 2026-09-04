/**
 * L’entretien, côté widget : demander un tour, et terminer.
 *
 * ⛔ LE WIDGET NE COMPTE RIEN. Il ne sait pas combien de relances restent, il ne
 *    décide pas quand ça s’arrête, il ne pourrait pas obtenir une troisième
 *    question en forgeant une requête. Il demande, et il lit `question`. La
 *    limite est côté serveur, sur le fil en base (01-Specs/entretien.md §2).
 *
 * ⚠️ `contrat.ts` n’est importé qu’en `import type` : il tire zod, et zod pèse
 *    26 Ko gzip sur un budget de 60. `budget.test.ts` empêche la rechute.
 */
import type { Comprehension, CorpsFin, CorpsTour, TourRendu } from './contrat'
import { EN_TETE_CLE, cheminFin, cheminTour } from './transport'

export type ResultatTour =
  | { readonly ok: true; readonly tour: TourRendu }
  /**
   * ⚠️ Un tour qui échoue n’est PAS un envoi qui échoue. Le retour est déjà en
   *    base — écrit avant tout appel au modèle. D’où l’absence de `reessayable` :
   *    il n’y a rien à réessayer, et rien à dire à la personne. La carte
   *    n’apparaît pas, le champ texte reste, « Envoyer » fonctionne.
   */
  | { readonly ok: false }

export interface RequeteEntretien {
  /** L’origine Feedys, déduite du `<script src>`. */
  readonly origine: string
  readonly cle: string
  readonly retour: string
  /** Injectable pour les tests. */
  readonly fetch?: typeof globalThis.fetch
}

/**
 * Demande un tour d’entretien.
 *
 * ⛔ Aucun cookie, aucun identifiant de visiteur : `credentials: 'omit'`, comme
 *    à l’envoi (01-Specs/widget.md §Ce que le widget joint tout seul).
 */
export async function demanderTour(
  requete: RequeteEntretien & { readonly corps?: CorpsTour },
): Promise<ResultatTour> {
  const reponse = await poster(requete, cheminTour(requete.retour), requete.corps ?? {})
  if (reponse === undefined || reponse.status !== 200) return { ok: false }

  const corps = await lireJson(reponse)
  if (corps === undefined) return { ok: false }

  const tour = interpreter(corps)
  return tour === undefined ? { ok: false } : { ok: true, tour }
}

/**
 * Termine l’entretien.
 *
 * ⚠️ `garderEnVie` sert le seul cas où ça compte : le panneau qu’on referme en
 *    quittant la page. Sans lui, le navigateur annule la requête et l’abandon ne
 *    serait jamais enregistré — le retour resterait `en_cours` pour toujours.
 */
export async function terminer(
  requete: RequeteEntretien & { readonly corps: CorpsFin; readonly garderEnVie?: boolean },
): Promise<boolean> {
  const reponse = await poster(
    requete,
    cheminFin(requete.retour),
    requete.corps,
    requete.garderEnVie === true,
  )

  return reponse !== undefined && reponse.status === 200
}

async function poster(
  requete: RequeteEntretien,
  chemin: string,
  corps: unknown,
  garderEnVie = false,
): Promise<Response | undefined> {
  const appeler = requete.fetch ?? globalThis.fetch

  try {
    return await appeler(`${requete.origine}${chemin}`, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      keepalive: garderEnVie,
      headers: { 'content-type': 'application/json', [EN_TETE_CLE]: requete.cle },
      body: JSON.stringify(corps),
    })
  } catch {
    return undefined
  }
}

async function lireJson(reponse: Response): Promise<Record<string, unknown> | undefined> {
  try {
    const valeur: unknown = await reponse.json()
    return typeof valeur === 'object' && valeur !== null ? (valeur as Record<string, unknown>) : undefined
  } catch {
    return undefined
  }
}

/** ⚠️ Le serveur valide ; le widget se contente de ne pas afficher n’importe quoi. */
function interpreter(corps: Record<string, unknown>): TourRendu | undefined {
  const question = corps['question']
  if (question !== null && typeof question !== 'string') return undefined

  const brute = corps['comprehension']
  const comprehension =
    brute === null || brute === undefined ? null : interpreterComprehension(brute)

  if (comprehension === undefined) return undefined

  return {
    comprehension,
    question,
    motif: typeof corps['motif'] === 'string' ? corps['motif'] : '',
  }
}

const TYPES = ['bug', 'idee', 'question', 'gene'] as const
const RECURRENCES = ['premiere_fois', 'deja_vu', 'systematique'] as const

function interpreterComprehension(valeur: unknown): Comprehension | null | undefined {
  if (typeof valeur !== 'object' || valeur === null) return undefined

  const brute = valeur as Record<string, unknown>
  const type = TYPES.find((connu) => connu === brute['type'])
  const titre = brute['titre']
  const resume = brute['resume']

  if (type === undefined || typeof titre !== 'string' || typeof resume !== 'string') return undefined

  const ecran = brute['ecran']
  const recurrence = RECURRENCES.find((connue) => connue === brute['recurrence'])

  return {
    type,
    titre,
    resume,
    ...(typeof ecran === 'string' && ecran !== '' ? { ecran } : {}),
    ...(recurrence ? { recurrence } : {}),
  }
}

/** Ce qu’on montre à la place d’une valeur de code. */
export const LIBELLES_TYPE: Readonly<Record<Comprehension['type'], string>> = {
  bug: 'Un problème',
  idee: 'Une idée',
  question: 'Une question',
  gene: 'Une gêne',
}

export const LIBELLES_RECURRENCE: Readonly<
  Record<NonNullable<Comprehension['recurrence']>, string>
> = {
  premiere_fois: 'première fois',
  deja_vu: 'déjà vu',
  systematique: 'à chaque fois',
}

const LIBELLES_CHAMP: Readonly<Record<keyof Comprehension, string>> = {
  type: 'Type',
  titre: 'Titre',
  resume: 'Résumé',
  ecran: 'Écran',
  recurrence: 'Depuis',
}

/**
 * Ce que la personne a corrigé sur la carte, en une phrase.
 *
 * ⛔ Rendu ICI plutôt que déduit côté serveur, et c’est la raison d’être de la
 *    carte : « non, c’est l’écran d’à côté » plutôt qu’un deuxième paragraphe
 *    dicté. Le fil reçoit alors ce qui s’est réellement passé — la personne qui
 *    reprend le bot — au lieu d’un diff reconstitué.
 *
 * ⚠️ Rien à corriger rend une chaîne vide, et le widget n’envoie alors rien du
 *    tout : une ligne « Correction · » sans correction polluerait le fil.
 */
export function rendreCorrections(origine: Comprehension, courant: Comprehension): string {
  const champs: (keyof Comprehension)[] = ['type', 'titre', 'resume', 'ecran', 'recurrence']

  return champs
    .filter((champ) => (origine[champ] ?? '') !== (courant[champ] ?? ''))
    .map((champ) => `${LIBELLES_CHAMP[champ]} — ${lisible(champ, courant[champ])}`)
    .join(' · ')
}

function lisible(champ: keyof Comprehension, valeur: string | undefined): string {
  if (valeur === undefined || valeur === '') return '(vide)'
  if (champ === 'type') return LIBELLES_TYPE[valeur as Comprehension['type']] ?? valeur
  if (champ === 'recurrence') {
    return LIBELLES_RECURRENCE[valeur as NonNullable<Comprehension['recurrence']>] ?? valeur
  }
  return valeur
}

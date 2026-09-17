/**
 * Le widget `1.0.0` — ce qu’il ENVOIE, et ce qu’il LIT. Figé.
 *
 * ⚠️ POURQUOI CE FICHIER EXISTE ([T-012], P-030). Un widget et le serveur qui le
 *    sert peuvent avoir une version d’écart : `widget.js` est gardé un jour en
 *    `stale-while-revalidate`, et un onglet de logiciel métier reste ouvert
 *    toute la journée. Le serveur d’aujourd’hui doit donc accepter ce qu’envoie
 *    le widget d’hier, et le widget d’hier doit savoir lire ce que rend le
 *    serveur d’aujourd’hui.
 *
 * ⛔ ÉCRIT À LA MAIN, À PARTIR DU TAG `1.0.0`, ET FIGÉ. Il ne se modifie pas quand
 *    le widget change — c’est tout son intérêt : il est la mémoire de ce qu’une
 *    version PUBLIÉE fait chez un client. Une nouvelle version publiée ajoute un
 *    fichier à côté, elle ne réécrit pas celui-ci.
 *
 * ⚠️ Les lecteurs ci-dessous sont RECOPIÉS de `packages/widget/src` au tag
 *    `1.0.0` (`envoi.ts`, `entretien.ts`, `releve.ts`), et c’est délibéré :
 *    importer le code du widget d’aujourd’hui testerait le widget d’aujourd’hui.
 *
 * ⛔ AUCUN RETOUR RÉEL. Tout est inventé, `exemple.fr`.
 */

export const VERSION = '1.0.0'

// ─────────────────────────────────────────────────────────────────────────────
// Ce que 1.0.0 envoie
// ─────────────────────────────────────────────────────────────────────────────

/** Le contexte le plus complet que `lireContexte` + `collecter` produisent en 1.0.0. */
const CONTEXTE_COMPLET = {
  url: 'https://pistache.exemple.fr/bordereaux/:id',
  titrePage: 'Bordereaux — Pistache',
  ecran: 'bordereaux',
  situation: 'Saisie d’un bordereau de règlement',
  selecteurDom: 'main form button.valider',
  navigateur: 'Chrome 152',
  systeme: 'Windows 11',
  viewportL: 1512,
  viewportH: 982,
  fuseau: 'Europe/Paris',
  horodatage: '2026-09-10T07:14:00.000Z',
  agentBrut: { userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/152.0', langue: 'fr-FR', densitePixels: 2 },
  capture: { type: 'image/webp', donnees: 'UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAQAcJaQAA3AA/v3AgAA=' },
  indices: [
    { genre: 'http', statut: 500, chemin: '/api/bordereaux/:id/valider', ecartMs: 3200 },
    { genre: 'js', nom: 'TypeError', trame: 'valider (bordereaux.js:88:12)', ecartMs: 4100 },
    { genre: 'http', statut: 502, chemin: '/api/bordereaux', methode: 'POST', reference: 'req_0001', ecartMs: 60000 },
  ],
}

/** Le contexte le plus pauvre : une page qui ne laisse rien lire, et pas de capture. */
const CONTEXTE_MINIMAL = { url: 'https://pistache.exemple.fr/' }

export const CORPS_ENVOYES = {
  /** `POST /api/retours` — ce que `Widget.tsx` compose en 1.0.0. */
  retour: {
    dicte: {
      texte: 'quand je valide le bordereau la page revient en haut',
      source: 'voix',
      transcriptBrut: 'euh quand je valide le bordereau la page revient en haut',
      contexte: CONTEXTE_COMPLET,
    },
    ecrit: {
      texte: 'le bouton suivant ne fait rien',
      source: 'texte',
      contexte: CONTEXTE_MINIMAL,
    },
  },

  /** `POST /api/retours/:id/tour` — le premier tour est vide. */
  tour: {
    premier: {},
    reponse: {
      texte: 'à chaque fois depuis lundi',
      source: 'voix',
      transcriptBrut: 'ben à chaque fois depuis lundi',
    },
    clic: { axe: 'recurrence', valeurAxe: 'systematique' },
    correction: { corrections: 'Correction · Écran — Saisie des bordereaux' },
  },

  /** `POST /api/retours/:id/fin`. */
  fin: {
    envoi: {
      raison: 'envoi',
      texte: 'et ça me fait perdre ma ligne',
      corrections: 'Correction · Type — gêne',
    },
    abandon: { raison: 'abandon' },
  },
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Ce que 1.0.0 lit — recopié, pas importé
// ─────────────────────────────────────────────────────────────────────────────

function objet(valeur: unknown): Record<string, unknown> | undefined {
  return typeof valeur === 'object' && valeur !== null ? (valeur as Record<string, unknown>) : undefined
}

/** `envoi.ts` 1.0.0, sur un 201 : l’identifiant, ou rien. */
export function lireRetourCree(corps: unknown): string | null {
  const lu = objet(corps)
  const retour = typeof lu?.['retour'] === 'string' ? lu['retour'] : ''
  return retour === '' ? null : retour
}

/** `envoi.ts` 1.0.0, sur un refus : le message du serveur, s’il y en a un. */
export function lireMessageErreur(corps: unknown): string | null {
  const lu = objet(corps)
  return typeof lu?.['message'] === 'string' && lu['message'] !== '' ? lu['message'] : null
}

const TYPES = ['bug', 'idee', 'question', 'gene']
const AXES = ['recurrence', 'ampleur']

/**
 * `entretien.ts` 1.0.0 — `interpreter` et `interpreterComprehension`.
 *
 * ⚠️ `undefined` veut dire « le widget 1.0.0 jette cette réponse » : la carte
 *    n’apparaît pas, et il affiche le mode dégradé.
 */
export function lireTour(corps: unknown):
  | { comprehension: { type: string; titre: string; resume: string } | null; question: string | null; axe: string | null }
  | undefined {
  const lu = objet(corps)
  if (lu === undefined) return undefined

  const question = lu['question']
  if (question !== null && typeof question !== 'string') return undefined

  const brute = lu['comprehension']
  let comprehension: { type: string; titre: string; resume: string } | null = null

  if (brute !== null && brute !== undefined) {
    const c = objet(brute)
    if (c === undefined) return undefined
    const type = TYPES.find((connu) => connu === c['type'])
    if (type === undefined || typeof c['titre'] !== 'string' || typeof c['resume'] !== 'string') {
      return undefined
    }
    // ⚠️ `recurrence` et `ecran` sont facultatifs en 1.0.0 : lus s’ils sont là.
    comprehension = { type, titre: c['titre'], resume: c['resume'] }
  }

  return {
    comprehension,
    question,
    axe: AXES.find((connu) => connu === lu['axe']) ?? null,
  }
}

/** `entretien.ts` 1.0.0, `terminer` : seul le statut HTTP compte — le corps n’est pas lu. */
export const FIN_LUE = 'statut 200 seulement'

/**
 * `releve.ts` 1.0.0 — `relever` puis `reponseValide`.
 *
 * ⚠️ Une entrée qu’il ne reconnaît pas est JETÉE : la pastille ne s’allume pas.
 */
export function lireReponses(corps: unknown): Array<{ id: string; statut: string; reponseEnvoyeeLe: string }> {
  const lu = objet(corps)
  if (!Array.isArray(lu?.['retours'])) return []

  const valides: Array<{ id: string; statut: string; reponseEnvoyeeLe: string }> = []
  for (const brut of lu['retours'] as unknown[]) {
    const ligne = objet(brut)
    if (ligne === undefined) continue

    const titre = ligne['titre']
    const reponseTexte = ligne['reponseTexte']
    if (typeof ligne['id'] !== 'string' || ligne['id'] === '') continue
    if (typeof ligne['statut'] !== 'string' || ligne['statut'] === '') continue
    if (typeof ligne['reponseEnvoyeeLe'] !== 'string' || ligne['reponseEnvoyeeLe'] === '') continue
    if (titre !== null && typeof titre !== 'string') continue
    if (reponseTexte !== null && typeof reponseTexte !== 'string') continue

    valides.push({ id: ligne['id'], statut: ligne['statut'], reponseEnvoyeeLe: ligne['reponseEnvoyeeLe'] })
  }
  return valides
}

/** `releve.ts` 1.0.0, `accuser` : seul `reponse.ok` compte — le corps n’est pas lu. */
export const ACCUSE_LU = 'statut 2xx seulement'

/**
 * La relève et l’accusé de réception des réponses développeur.
 *
 * ⛔ `contrat.ts` n’est importé qu’en `import type` : il tire zod, et zod pèse
 *    26 Ko gzip sur un budget de 60 (01-Specs/widget.md §4). La validation qui
 *    suit est donc écrite à la main, et c’est le prix du budget.
 *
 * ⛔ Pas de cookies, pas d’identifiants de session : `credentials: 'omit'`.
 */
import type { ReponseCollaborateur } from './contrat'
import { BORNES, CHEMIN_COLLABORATEUR, EN_TETE_CLE, EN_TETE_IDENTITE, cheminAccuse } from './transport'

export interface RequeteReleve {
  readonly origine: string
  readonly cle: string
  readonly identite?: string | undefined
  readonly fetch?: typeof globalThis.fetch
}

export interface RequeteAccuse {
  readonly origine: string
  readonly cle: string
  readonly retourId: string
  readonly identite?: string | undefined
  readonly fetch?: typeof globalThis.fetch
}

function texteOuNul(valeur: unknown, borne: number): string | null | undefined {
  if (valeur === null) return null
  if (typeof valeur !== 'string') return undefined
  return valeur.length > borne ? valeur.slice(0, borne) : valeur
}

/**
 * ⚠️ Une entrée qu’on ne reconnaît pas est JETÉE, pas rendue telle quelle.
 *    Sans ce filtre, un `titre` numérique ou une entrée sans `id` traversait le
 *    transport et cassait au rendu — c’est-à-dire dans la page de quelqu’un
 *    d’autre, où rien ne dit d’où vient l’erreur.
 */
function reponseValide(brut: unknown): ReponseCollaborateur | null {
  if (typeof brut !== 'object' || brut === null) return null

  const ligne = brut as Record<string, unknown>
  const titre = texteOuNul(ligne['titre'], BORNES.titre)
  const reponseTexte = texteOuNul(ligne['reponseTexte'], BORNES.reponseTexte)

  if (typeof ligne['id'] !== 'string' || ligne['id'] === '') return null
  if (typeof ligne['statut'] !== 'string' || ligne['statut'] === '') return null
  if (typeof ligne['reponseEnvoyeeLe'] !== 'string' || ligne['reponseEnvoyeeLe'] === '') return null
  if (titre === undefined || reponseTexte === undefined) return null

  return {
    id: ligne['id'],
    titre,
    statut: ligne['statut'],
    reponseTexte,
    reponseEnvoyeeLe: ligne['reponseEnvoyeeLe'],
  }
}

export async function relever(requete: RequeteReleve): Promise<ReponseCollaborateur[]> {
  // ⛔ Sans jeton d’identité, le serveur rend `[]` par construction : l’appel
  //    n’apprendrait rien et partirait pourtant à CHAQUE chargement de page de
  //    l’hôte, visiteur anonyme compris. On ne le fait pas.
  if (requete.identite === undefined) return []

  const appeler = requete.fetch ?? globalThis.fetch

  try {
    const reponse = await appeler(`${requete.origine}${CHEMIN_COLLABORATEUR}`, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      headers: {
        [EN_TETE_CLE]: requete.cle,
        [EN_TETE_IDENTITE]: requete.identite,
      },
    })

    if (!reponse.ok) return []

    const corps = (await reponse.json()) as { retours?: unknown }
    if (!Array.isArray(corps?.retours)) return []

    const valides: ReponseCollaborateur[] = []
    for (const brut of corps.retours) {
      const ligne = reponseValide(brut)
      if (ligne !== null) valides.push(ligne)
    }
    return valides
  } catch {
    return []
  }
}

export async function accuser(requete: RequeteAccuse): Promise<boolean> {
  // ⛔ Même raison : un accusé sans identité est un 401 garanti.
  if (requete.identite === undefined) return false

  const appeler = requete.fetch ?? globalThis.fetch

  try {
    const reponse = await appeler(`${requete.origine}${cheminAccuse(requete.retourId)}`, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      headers: {
        [EN_TETE_CLE]: requete.cle,
        [EN_TETE_IDENTITE]: requete.identite,
      },
    })

    return reponse.ok
  } catch {
    return false
  }
}

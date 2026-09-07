/**
 * La relève et l’accusé de réception des réponses développeur.
 *
 * ⛔ `contrat.ts` n’est importé qu’en `import type` : il tire zod, et zod pèse
 *    26 Ko gzip sur un budget de 60 (01-Specs/widget.md §4).
 *
 * ⛔ Pas de cookies, pas d’identifiants de session : `credentials: 'omit'`.
 */
import type { ReponseCollaborateur } from './contrat'
import {
  CHEMIN_COLLABORATEUR,
  EN_TETE_CLE,
  EN_TETE_IDENTITE,
  cheminAccuse,
} from './transport'

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

export async function relever(requete: RequeteReleve): Promise<ReponseCollaborateur[]> {
  const appeler = requete.fetch ?? globalThis.fetch

  try {
    const reponse = await appeler(`${requete.origine}${CHEMIN_COLLABORATEUR}`, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      headers: {
        [EN_TETE_CLE]: requete.cle,
        ...(requete.identite ? { [EN_TETE_IDENTITE]: requete.identite } : {}),
      },
    })

    if (!reponse.ok) return []

    const corps = (await reponse.json()) as { retours?: unknown }
    if (corps && Array.isArray(corps.retours)) {
      return corps.retours as ReponseCollaborateur[]
    }
    return []
  } catch {
    return []
  }
}

export async function accuser(requete: RequeteAccuse): Promise<boolean> {
  const appeler = requete.fetch ?? globalThis.fetch

  try {
    const reponse = await appeler(`${requete.origine}${cheminAccuse(requete.retourId)}`, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      headers: {
        [EN_TETE_CLE]: requete.cle,
        ...(requete.identite ? { [EN_TETE_IDENTITE]: requete.identite } : {}),
      },
    })

    return reponse.ok
  } catch {
    return false
  }
}

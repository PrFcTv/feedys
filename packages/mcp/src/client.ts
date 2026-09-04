/**
 * L’accès HTTP au serveur Feedys.
 *
 * ⛔ Ce paquet est MIT et n’importe RIEN de `apps/serveur` (AGPL) — pas un type,
 *    pas une constante. Il parle au serveur en HTTP, ce qui fait de lui un
 *    programme distinct et non une œuvre dérivée (04-Architecture/licences.md).
 *    Le lint le vérifie, et `tests/frontiere-licence.test.ts` vérifie le lint.
 *
 * ⚠️ Aucun SQL ici, et aucune règle métier : le serveur décide, ce module
 *    transporte. C’est aussi ce qui garantit qu’un agent ne peut rien faire de
 *    plus que ce que l’API autorise.
 *
 * ⛔ Le jeton ne sort jamais dans un message d’erreur.
 */
import type { ReponseListe, ReponseRetour, RequeteListe, RequeteStatut } from './contrat.js'
import { CHEMIN_MCP, cheminRetour, cheminStatut } from './contrat.js'

export interface Reglages {
  /** L’origine du serveur Feedys, par ex. `https://feedys.exemple.fr`. */
  readonly origine: string
  readonly jeton: string
  /** ⚠️ Injectable pour les tests : aucun réseau n’est ouvert dans `pnpm test`. */
  readonly aller?: typeof fetch
}

export class ErreurFeedys extends Error {
  constructor(
    message: string,
    readonly statut: number,
  ) {
    super(message)
    this.name = 'ErreurFeedys'
  }
}

/**
 * ⚠️ Le message d’erreur reprend celui du serveur quand il y en a un : c’est lui
 *    qui sait pourquoi il a refusé, et l’agent le lira.
 */
async function raconter(reponse: Response): Promise<never> {
  let message = `Le serveur Feedys a répondu ${reponse.status}.`

  try {
    const corps: unknown = await reponse.json()
    if (corps !== null && typeof corps === 'object' && 'message' in corps) {
      message = String((corps as { message: unknown }).message)
    }
  } catch {
    // Un corps illisible ne doit pas masquer le code de statut.
  }

  throw new ErreurFeedys(message, reponse.status)
}

export function creerClient(reglages: Reglages) {
  const aller = reglages.aller ?? fetch
  const base = reglages.origine.replace(/\/+$/, '')

  async function appeler<T>(chemin: string, options: RequestInit = {}): Promise<T> {
    const reponse = await aller(`${base}${chemin}`, {
      ...options,
      headers: {
        // ⛔ Le seul endroit où le jeton apparaît.
        authorization: `Bearer ${reglages.jeton}`,
        ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
        ...options.headers,
      },
    })

    if (!reponse.ok) await raconter(reponse)
    return (await reponse.json()) as T
  }

  return {
    async lister(requete: RequeteListe): Promise<ReponseListe> {
      const params = new URLSearchParams()
      for (const [nom, valeur] of Object.entries(requete)) {
        if (valeur !== undefined) params.set(nom, String(valeur))
      }

      const requeteUrl = params.toString()
      return appeler<ReponseListe>(CHEMIN_MCP + (requeteUrl === '' ? '' : `?${requeteUrl}`))
    },

    async lire(id: string): Promise<ReponseRetour> {
      return appeler<ReponseRetour>(cheminRetour(id))
    },

    /** ⛔ La seule écriture. Le statut, et rien d’autre. */
    async marquer(id: string, changement: RequeteStatut): Promise<{ id: string; statut: string }> {
      return appeler(cheminStatut(id), {
        method: 'POST',
        body: JSON.stringify(changement),
      })
    },
  }
}

export type ClientFeedys = ReturnType<typeof creerClient>

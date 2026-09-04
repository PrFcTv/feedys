/**
 * L’envoi d’un retour — `POST /api/retours`.
 *
 * ⚠️ `contrat.ts` n’est importé qu’en `import type` : il tire zod, et zod pèse
 *    26 Ko gzip sur un budget de 60 (01-Specs/widget.md §4). C’est le serveur
 *    qui valide, et c’est lui qui paie zod. `budget.test.ts` empêche la rechute.
 *
 * ⛔ Aucun cookie, aucun identifiant de visiteur : `credentials: 'omit'`. La
 *    liste de ce que Feedys collecte est close, et elle doit pouvoir être lue
 *    par n’importe qui sans gêne (01-Specs/widget.md).
 */
import type { CorpsRetour } from './contrat'
import { CHEMIN_RETOURS, EN_TETE_CLE } from './transport'

export type Resultat =
  | { readonly ok: true; readonly retour: string }
  /**
   * `reessayable` distingue ce qui passera plus tard — le réseau, un serveur
   * fatigué, un débit dépassé — de ce qui ne passera jamais : une clé fausse,
   * un corps refusé. Le premier cas garde le brouillon et retente ; le second
   * ne sert qu’à ne pas mentir à quelqu’un qui attend.
   */
  | { readonly ok: false; readonly message: string; readonly reessayable: boolean }

export interface Requete {
  /** L’origine Feedys, déduite du `<script src>`. */
  readonly origine: string
  readonly cle: string
  readonly corps: CorpsRetour
  /** Injectable pour les tests. */
  readonly fetch?: typeof globalThis.fetch
}

const GENERIQUE = 'L’envoi n’a pas abouti. Réessayez dans un instant.'
const HORS_LIGNE = 'Pas de connexion. Votre retour part dès qu’elle revient.'

export async function envoyer(requete: Requete): Promise<Resultat> {
  const appeler = requete.fetch ?? globalThis.fetch

  let reponse: Response
  try {
    reponse = await appeler(`${requete.origine}${CHEMIN_RETOURS}`, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      headers: {
        'content-type': 'application/json',
        [EN_TETE_CLE]: requete.cle,
      },
      body: JSON.stringify(requete.corps),
    })
  } catch {
    // ⚠️ `fetch` ne rejette que sur le réseau : coupure, DNS, CORS. Tout le
    //    reste arrive avec un statut.
    return { ok: false, message: HORS_LIGNE, reessayable: true }
  }

  if (reponse.status === 201) {
    const corps = await lireJson(reponse)
    const retour = typeof corps?.retour === 'string' ? corps.retour : ''
    return retour === '' ? { ok: false, message: GENERIQUE, reessayable: true } : { ok: true, retour }
  }

  const corps = await lireJson(reponse)

  return {
    ok: false,
    // ⚠️ Le serveur écrit en français et ne dit rien de son intérieur
    //    (01-Specs/ingestion.md) : son message est meilleur que le nôtre quand
    //    il y en a un.
    message: typeof corps?.message === 'string' && corps.message !== '' ? corps.message : GENERIQUE,
    reessayable: reponse.status === 429 || reponse.status >= 500,
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

/**
 * `GET /api/mcp/retours` — `lister_retours`.
 *
 * ⛔ Du routage, et rien d’autre : le jeton est vérifié, la requête est analysée
 *    par le contrat, le dépôt répond (architecture.md §2).
 */
import { RequeteListe } from '../../../../../../packages/mcp/src/contrat'
import { pool } from '../../../../infra/base/connexion'
import { creerDepotMcp } from '../../../../infra/base/depot-mcp'
import { jsonMcp, refus, verifierJeton } from '../_jeton'

export const dynamic = 'force-dynamic'

export async function GET(requete: Request): Promise<Response> {
  const verdict = verifierJeton(requete)
  if (!verdict.ok) return refus(verdict.motif)

  const params = new URL(requete.url).searchParams
  const limite = params.get('limite')

  // ⚠️ Les paramètres absents sont RETIRÉS avant l’analyse : le schéma est
  //    `.strict()`, et `{statut: undefined}` n’est pas `{}` pour lui.
  const brut = Object.fromEntries(
    Object.entries({
      statut: params.get('statut') ?? undefined,
      type: params.get('type') ?? undefined,
      zone: params.get('zone') ?? undefined,
      depuis: params.get('depuis') ?? undefined,
      limite: limite === null ? undefined : Number(limite),
    }).filter(([, valeur]) => valeur !== undefined),
  )

  const lue = RequeteListe.safeParse(brut)
  if (!lue.success) return refus('requete_refusee')

  return jsonMcp(await creerDepotMcp(pool()).lister(lue.data))
}

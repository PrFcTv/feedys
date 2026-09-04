/**
 * `GET /api/mcp/retours/:id` — `lire_retour`.
 *
 * ⚠️ Rend la synthèse **et le fil brut**. Quand un agent creuse réellement un
 *    problème, la parole d’origine contient souvent ce que le résumé a perdu
 *    (01-Specs/synthese.md §Le rendu MCP).
 */
import { pool } from '../../../../../infra/base/connexion'
import { creerDepotMcp } from '../../../../../infra/base/depot-mcp'
import { jsonMcp, refus, verifierJeton } from '../../_jeton'

export const dynamic = 'force-dynamic'

export async function GET(
  requete: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const verdict = verifierJeton(requete)
  if (!verdict.ok) return refus(verdict.motif)

  const { id } = await params
  const retour = await creerDepotMcp(pool()).lire(id)

  return retour === null ? refus('retour_inconnu') : jsonMcp(retour)
}

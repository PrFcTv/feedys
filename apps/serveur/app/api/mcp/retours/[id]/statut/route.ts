/**
 * `POST /api/mcp/retours/:id/statut` — `marquer_retour`.
 *
 * ⛔ **LA SEULE ÉCRITURE DU MCP.** Le statut, vers `lu`, `traite` ou `ecarte`, et
 *    rien d’autre. Le schéma est `.strict()` : un corps qui porte `texte`,
 *    `resume` ou `titre` est REFUSÉ, pas ignoré.
 */
import { RequeteStatut } from '../../../../../../../../packages/mcp/src/contrat'
import { pool } from '../../../../../../infra/base/connexion'
import { creerDepotMcp } from '../../../../../../infra/base/depot-mcp'
import { corpsJson } from '../../../../retours/_reponses'
import { jsonMcp, refus, verifierJeton } from '../../../_jeton'

export const dynamic = 'force-dynamic'

export async function POST(
  requete: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const verdict = verifierJeton(requete)
  if (!verdict.ok) return refus(verdict.motif)

  const lue = RequeteStatut.safeParse(await corpsJson(requete))
  if (!lue.success) return refus('requete_refusee')

  const { id } = await params
  const trouve = await creerDepotMcp(pool()).marquer(id, lue.data)

  return trouve ? jsonMcp({ id, statut: lue.data.statut }) : refus('retour_inconnu')
}

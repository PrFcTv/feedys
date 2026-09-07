/**
 * `GET /api/retours/collaborateur` — la relève des retours traités.
 *
 * ⛔ Du routage, et rien d’autre : lire la requête, appeler le domaine, rendre.
 *    La logique et l'autorisation sont dans `domaine/retours/collaborateur.ts`.
 */
import { EN_TETE_CLE, EN_TETE_IDENTITE } from '../../../../../../packages/widget/src/contrat'
import type { MotifRefusReleve } from '../../../../domaine/retours/collaborateur'
import { releverReponsesCollaborateur } from '../../../../domaine/retours/collaborateur'
import { portsCollaborateur } from '../../../../infra/composition'
import { json, preflight } from '../_reponses'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STATUT: Readonly<Record<MotifRefusReleve, number>> = {
  cle_absente: 401,
  produit_inconnu: 404,
  origine_refusee: 403,
}

export function OPTIONS(requete: Request): Response {
  return preflight(requete)
}

export async function GET(requete: Request): Promise<Response> {
  const origine = requete.headers.get('origin')

  const resultat = await releverReponsesCollaborateur(
    {
      cle: requete.headers.get(EN_TETE_CLE),
      identite: requete.headers.get(EN_TETE_IDENTITE),
      origine,
      maintenant: Date.now(),
    },
    portsCollaborateur(),
  )

  if (!resultat.ok) {
    return json({ motif: resultat.motif, message: resultat.message }, STATUT[resultat.motif], origine)
  }

  return json({ retours: resultat.retours }, 200, origine)
}

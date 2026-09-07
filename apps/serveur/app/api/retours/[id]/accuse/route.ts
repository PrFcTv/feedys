/**
 * `POST /api/retours/:id/accuse` — l’accusé de réception du collaborateur.
 *
 * ⛔ Du routage, et rien d’autre.
 *    La logique et l'autorisation sont dans `domaine/retours/collaborateur.ts`.
 */
import { EN_TETE_CLE, EN_TETE_IDENTITE } from '../../../../../../../packages/widget/src/contrat'
import type { MotifRefusAccuse } from '../../../../../domaine/retours/collaborateur'
import { accuserReceptionCollaborateur } from '../../../../../domaine/retours/collaborateur'
import { portsCollaborateur } from '../../../../../infra/composition'
import { json, preflight } from '../../_reponses'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STATUT: Readonly<Record<MotifRefusAccuse, number>> = {
  cle_absente: 401,
  produit_inconnu: 404,
  origine_refusee: 403,
  identite_invalide: 401,
  retour_inconnu: 404,
  auteur_refuse: 403,
}

export function OPTIONS(requete: Request): Response {
  return preflight(requete)
}

export async function POST(
  requete: Request,
  contexte: { params: Promise<{ id: string }> },
): Promise<Response> {
  const origine = requete.headers.get('origin')
  const { id } = await contexte.params

  const resultat = await accuserReceptionCollaborateur(
    {
      retourId: id,
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

  return json({ ok: true }, 200, origine)
}

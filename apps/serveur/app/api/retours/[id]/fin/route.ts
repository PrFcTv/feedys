/**
 * `POST /api/retours/:id/fin` — l’entretien se termine.
 *
 * Trois chemins y mènent, et le domaine ne les distingue qu’en deux statuts :
 * l’envoi manuel et la limite de relances donnent `envoye`, le panneau refermé
 * donne `abandonne` (01-Specs/entretien.md §La machine à états).
 *
 * ⛔ `abandonne` n’est pas un échec : le retour est conservé et envoyé en
 *    l’état. Un retour partiel vaut mieux que rien.
 */
import { EN_TETE_CLE, analyserCorpsFin } from '../../../../../../../packages/widget/src/contrat'
import type { MotifRefusTour } from '../../../../../domaine/entretien/tour'
import { terminerEntretien } from '../../../../../domaine/entretien/tour'
import { portsTour } from '../../../../../infra/composition'
import { corpsJson, ipDe, json, preflight } from '../../_reponses'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STATUT: Readonly<Record<MotifRefusTour, number>> = {
  cle_absente: 401,
  produit_inconnu: 404,
  origine_refusee: 403,
  debit_depasse: 429,
  retour_inconnu: 404,
  entretien_clos: 409,
  modele_indisponible: 503,
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

  const brut = await corpsJson(requete)
  if (brut === undefined) {
    return json({ motif: 'corps_invalide', message: 'Le corps n’est pas du JSON.' }, 400, origine)
  }

  const analyse = analyserCorpsFin(brut)
  if (!analyse.ok) {
    return json({ motif: 'corps_invalide', message: analyse.message }, 400, origine)
  }

  const resultat = await terminerEntretien(
    {
      retourId: id,
      cle: requete.headers.get(EN_TETE_CLE),
      origine,
      ip: ipDe(requete),
      ...analyse.valeur,
    },
    portsTour(),
  )

  if (!resultat.ok) {
    return json({ motif: resultat.motif, message: resultat.message }, STATUT[resultat.motif], origine)
  }

  return json({ statut: resultat.statut }, 200, origine)
}

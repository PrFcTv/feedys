/**
 * `POST /api/retours/:id/tour` — un tour d’entretien.
 *
 * ⛔ Du routage, et rien d’autre : lire la requête, appeler le domaine, rendre.
 *    La boucle, la limite de deux relances et les modes de défaillance sont dans
 *    `domaine/entretien/tour.ts` (04-Architecture/architecture.md §2).
 *
 * ⛔ La route ne compte rien et ne décide rien. Forger un corps ne donne pas une
 *    troisième relance : le compte se fait sur le fil en base, de l’autre côté.
 */
import { EN_TETE_CLE, analyserCorpsTour } from '../../../../../../../packages/widget/src/contrat'
import type { MotifRefusTour } from '../../../../../domaine/entretien/tour'
import { jouerTour } from '../../../../../domaine/entretien/tour'
import { portsTour } from '../../../../../infra/composition'
import { corpsJson, ipDe, json, preflight } from '../../_reponses'

/** ⚠️ `pg` et un appel réseau sortant : la route ne tourne pas sur l’edge. */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STATUT: Readonly<Record<MotifRefusTour, number>> = {
  cle_absente: 401,
  produit_inconnu: 404,
  origine_refusee: 403,
  debit_depasse: 429,
  retour_inconnu: 404,
  entretien_clos: 409,
  // ⚠️ 503 et pas 500 : c’est temporaire, et le widget doit pouvoir le
  //    distinguer d’un refus définitif. La carte n’apparaît pas, le champ texte
  //    reste, « Envoyer » fonctionne — et le retour est déjà en base.
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

  const analyse = analyserCorpsTour(brut)
  if (!analyse.ok) {
    return json({ motif: 'corps_invalide', message: analyse.message }, 400, origine)
  }

  const resultat = await jouerTour(
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

  return json(resultat.tour, 200, origine)
}

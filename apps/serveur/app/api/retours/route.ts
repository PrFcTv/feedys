/**
 * `POST /api/retours` — l’entrée d’un retour.
 *
 * ⛔ Du routage, et rien d’autre : lire la requête, appeler le domaine, rendre.
 *    La décision est dans `domaine/retours/ingestion.ts` (architecture.md §2).
 */
import { EN_TETE_CLE, EN_TETE_IDENTITE } from '../../../../../packages/widget/src/contrat'
import type { MotifRefus } from '../../../domaine/retours/ingestion'
import { corpsTropGros, ingerer } from '../../../domaine/retours/ingestion'
import { portsIngestion } from '../../../infra/composition'

import { ipDe, json, preflight } from './_reponses'

/** ⚠️ `pg` et le système de fichiers : la route ne tourne pas sur l’edge. */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STATUT: Readonly<Record<MotifRefus, number>> = {
  cle_absente: 401,
  produit_inconnu: 404,
  origine_refusee: 403,
  corps_trop_gros: 413,
  corps_invalide: 400,
  debit_depasse: 429,
  stockage_indisponible: 503,
}

export function OPTIONS(requete: Request): Response {
  return preflight(requete)
}

export async function POST(requete: Request): Promise<Response> {
  const origine = requete.headers.get('origin')

  // ⚠️ Refus anticipé : on ne met pas en mémoire quatre gigaoctets pour découvrir
  //    ensuite qu’ils dépassent la borne.
  const annonce = Number(requete.headers.get('content-length'))
  if (Number.isFinite(annonce) && corpsTropGros(annonce)) {
    return json(
      { motif: 'corps_trop_gros', message: 'Ce retour est trop lourd pour être envoyé.' },
      STATUT.corps_trop_gros,
      origine,
    )
  }

  const corpsBrut = await requete.text()

  const resultat = await ingerer(
    {
      cle: requete.headers.get(EN_TETE_CLE),
      // ⛔ Un jeton absent ou faux ne refuse rien : il laisse le retour arriver
      //    en `identite_verifiee = false` (P-012).
      identite: requete.headers.get(EN_TETE_IDENTITE),
      origine,
      ip: ipDe(requete),
      octets: Buffer.byteLength(corpsBrut, 'utf8'),
      corpsBrut,
    },
    portsIngestion(),
  )

  if (!resultat.ok) {
    return json({ motif: resultat.motif, message: resultat.message }, STATUT[resultat.motif], origine)
  }

  return json({ retour: resultat.retour }, 201, origine)
}

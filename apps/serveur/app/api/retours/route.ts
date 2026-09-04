/**
 * `POST /api/retours` — l’entrée d’un retour.
 *
 * ⛔ Du routage, et rien d’autre : lire la requête, appeler le domaine, rendre.
 *    La décision est dans `domaine/retours/ingestion.ts` (architecture.md §2).
 */
import { EN_TETE_CLE } from '../../../../../packages/widget/src/contrat'
import type { MotifRefus } from '../../../domaine/retours/ingestion'
import { corpsTropGros, ingerer } from '../../../domaine/retours/ingestion'
import { portsIngestion } from '../../../infra/composition'

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

/**
 * ⚠️ Le préflight ne porte PAS la clé — `Access-Control-Request-Headers` ne
 *    donne que des noms d’en-têtes. Il n’y a donc rien à autoriser à ce
 *    moment-là, et rien à divulguer non plus : l’origine est renvoyée telle
 *    quelle, et c’est le POST qui l’accepte ou la refuse contre le domaine du
 *    produit (domaine/retours/origine.ts).
 */
function enTetesCors(origine: string | null): Record<string, string> {
  return {
    'access-control-allow-origin': origine ?? '*',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': `content-type, ${EN_TETE_CLE}`,
    'access-control-max-age': '86400',
    vary: 'Origin',
  }
}

function json(corps: unknown, statut: number, origine: string | null): Response {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { 'content-type': 'application/json; charset=utf-8', ...enTetesCors(origine) },
  })
}

/**
 * L’IP telle que le proxy la rapporte.
 *
 * ⚠️ Elle sert UNIQUEMENT à limiter le débit. Elle n’est ni stockée, ni
 *    journalisée, ni attachée au retour : le dépôt est public et la liste de ce
 *    qu’on garde est close (01-Specs/widget.md).
 */
function ipDe(requete: Request): string {
  const transmise = requete.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return transmise || requete.headers.get('x-real-ip') || 'inconnue'
}

export function OPTIONS(requete: Request): Response {
  return new Response(null, { status: 204, headers: enTetesCors(requete.headers.get('origin')) })
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

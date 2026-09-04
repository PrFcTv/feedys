/**
 * Ce que les trois routes de retours partagent : CORS, JSON, et l’IP.
 *
 * ⛔ Du routage, et rien d’autre. Aucune décision métier ne descend ici — les
 *    décisions sont dans `domaine/` (04-Architecture/architecture.md §2).
 *
 * ⚠️ Un fichier `_préfixé` dans `app/` n’est pas une route : c’est la convention
 *    Next pour un module privé.
 */
import { EN_TETE_CLE } from '../../../../../packages/widget/src/contrat'

/**
 * ⚠️ Le préflight ne porte PAS la clé — `Access-Control-Request-Headers` ne
 *    donne que des noms d’en-têtes. Il n’y a donc rien à autoriser à ce
 *    moment-là, et rien à divulguer non plus : l’origine est renvoyée telle
 *    quelle, et c’est le POST qui l’accepte ou la refuse contre le domaine du
 *    produit (domaine/retours/origine.ts).
 */
export function enTetesCors(origine: string | null): Record<string, string> {
  return {
    'access-control-allow-origin': origine ?? '*',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': `content-type, ${EN_TETE_CLE}`,
    'access-control-max-age': '86400',
    vary: 'Origin',
  }
}

export function json(corps: unknown, statut: number, origine: string | null): Response {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { 'content-type': 'application/json; charset=utf-8', ...enTetesCors(origine) },
  })
}

export function preflight(requete: Request): Response {
  return new Response(null, { status: 204, headers: enTetesCors(requete.headers.get('origin')) })
}

/**
 * L’IP telle que le proxy la rapporte.
 *
 * ⚠️ Elle sert UNIQUEMENT à limiter le débit. Elle n’est ni stockée, ni
 *    journalisée, ni attachée au retour : le dépôt est public et la liste de ce
 *    qu’on garde est close (01-Specs/widget.md).
 */
export function ipDe(requete: Request): string {
  const transmise = requete.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return transmise || requete.headers.get('x-real-ip') || 'inconnue'
}

/** Le corps, lu et analysé. `undefined` quand il n’y en a pas — un tour peut être vide. */
export async function corpsJson(requete: Request): Promise<unknown> {
  const brut = await requete.text()
  if (brut.trim() === '') return {}

  try {
    return JSON.parse(brut)
  } catch {
    return undefined
  }
}

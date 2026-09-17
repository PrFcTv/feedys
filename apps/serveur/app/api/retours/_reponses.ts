/**
 * Ce que les trois routes de retours partagent : CORS, JSON, et l’IP.
 *
 * ⛔ Du routage, et rien d’autre. Aucune décision métier ne descend ici — les
 *    décisions sont dans `domaine/` (04-Architecture/architecture.md §2).
 *
 * ⚠️ Un fichier `_préfixé` dans `app/` n’est pas une route : c’est la convention
 *    Next pour un module privé.
 */
import type {
  Erreur,
  FinRendue,
  ReponseCollaborateur,
  RetourCree,
} from '../../../../../packages/widget/src/contrat'
import { EN_TETE_CLE, EN_TETE_IDENTITE } from '../../../../../packages/widget/src/contrat'

/**
 * Les enveloppes de réponse — ce que le widget LIT.
 *
 * ⛔ UN CHAMP DE RÉPONSE NE SE RENOMME NI NE DISPARAÎT. Le widget lit ses réponses
 *    à la main, sans zod : un renommage casserait en silence tous les onglets
 *    ouverts avec le widget de la veille (règle des versions, `contrat.ts` ;
 *    [T-012], P-030). Les enveloppes sont nommées ici pour que
 *    `tests/versions/` puisse les relire avec ce que lit chaque widget publié —
 *    et que ce test rougisse le jour où l’une d’elles change.
 *
 * ⚠️ Le TOUR n’a pas d’enveloppe : sa réponse est `TourRendu`, rendu tel quel par
 *    le domaine (`domaine/entretien/tour.ts`).
 */
export const enveloppes = {
  retourCree: (retour: string): RetourCree => ({ retour }),
  erreur: (motif: string, message: string): Erreur => ({ motif, message }),
  finRendue: (statut: FinRendue['statut']): FinRendue => ({ statut }),
  reponses: (retours: readonly ReponseCollaborateur[]): { readonly retours: readonly ReponseCollaborateur[] } => ({
    retours,
  }),
  accuse: (): { readonly ok: true } => ({ ok: true }),
}

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
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': `content-type, ${EN_TETE_CLE}, ${EN_TETE_IDENTITE}`,
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

/**
 * Comme `json`, mais pour ce qui dépend de QUI demande.
 *
 * ⛔ La relève d’un collaborateur est découpée sur `x-feedys-identite`, pas sur
 *    l’URL. Un proxy d’entreprise — et Feedys vit derrière des proxys
 *    d’entreprise — ne voit qu’un GET sans cookie sur une URL fixe : sans
 *    consigne, il a le droit de servir la réponse d’Alice à Bob.
 *
 * ⚠️ `vary` liste les en-têtes qui changent la réponse ; `no-store` dit de ne
 *    rien garder du tout. Les deux, parce que le premier seul se fait ignorer.
 */
export function jsonPrive(corps: unknown, statut: number, origine: string | null): Response {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store, private',
      ...enTetesCors(origine),
      vary: `Origin, ${EN_TETE_IDENTITE}, ${EN_TETE_CLE}`,
    },
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

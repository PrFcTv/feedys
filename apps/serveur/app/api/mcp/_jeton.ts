/**
 * L’authentification du serveur MCP — un jeton, porté en `Authorization: Bearer`.
 *
 * ⛔ Un seul jeton, `FEEDYS_MCP_JETON`, pour un seul lecteur. Pas de comptes,
 *    pas de portées, pas de rotation automatique : ce serait plus de code, plus
 *    de surface, et zéro utilisateur de plus (même raison qu’au back-office).
 *
 * ⛔ La comparaison est `timingSafeEqual`, jamais `===`.
 *
 * ⚠️ Absence de jeton configuré → l’API MCP répond 503 et ne sert RIEN. Un
 *    serveur qui laisserait passer parce qu’il n’a pas de secret serait pire
 *    qu’un serveur fermé.
 */
import { timingSafeEqual } from 'node:crypto'

import type { Motif } from '../../../../../packages/mcp/src/contrat'

export type Verdict = { readonly ok: true } | { readonly ok: false; readonly motif: Motif }

function egaux(a: string, b: string): boolean {
  const gauche = Buffer.from(a, 'utf8')
  const droite = Buffer.from(b, 'utf8')

  if (gauche.length !== droite.length) return false
  return timingSafeEqual(gauche, droite)
}

export function verifierJeton(requete: Request): Verdict {
  const attendu = process.env['FEEDYS_MCP_JETON']?.trim()
  if (!attendu) return { ok: false, motif: 'mcp_non_configure' }

  const entete = requete.headers.get('authorization')?.trim()
  if (!entete) return { ok: false, motif: 'jeton_absent' }

  const presente = entete.toLowerCase().startsWith('bearer ') ? entete.slice(7).trim() : entete

  return egaux(presente, attendu) ? { ok: true } : { ok: false, motif: 'jeton_refuse' }
}

const STATUTS_HTTP: Record<Motif, number> = {
  jeton_absent: 401,
  jeton_refuse: 401,
  requete_refusee: 400,
  retour_inconnu: 404,
  mcp_non_configure: 503,
}

const MESSAGES: Record<Motif, string> = {
  jeton_absent: 'Aucun jeton. Posez « Authorization: Bearer <FEEDYS_MCP_JETON> ».',
  jeton_refuse: 'Ce jeton ne convient pas.',
  requete_refusee: 'La requête n’est pas dans la forme attendue.',
  retour_inconnu: 'Ce retour n’existe pas.',
  mcp_non_configure:
    'FEEDYS_MCP_JETON est absente du serveur : l’accès MCP est fermé tant qu’elle n’est pas posée.',
}

/** ⛔ Aucun en-tête CORS : le MCP n’est pas appelé depuis un navigateur. */
export function refus(motif: Motif): Response {
  return jsonMcp({ erreur: motif, message: MESSAGES[motif] }, STATUTS_HTTP[motif])
}

export function jsonMcp(corps: unknown, statut = 200): Response {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // ⚠️ Une réponse MCP porte de la parole : elle ne se met pas en cache.
      'cache-control': 'no-store',
    },
  })
}

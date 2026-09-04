/**
 * `GET /bo/r/:id/capture` — la capture d’écran jointe au retour.
 *
 * ⛔ LE CLIENT NE DONNE PAS DE CHEMIN, il donne l’id du retour. Le chemin est lu
 *    en base, et `lirePieceJointe` refuse de toute façon tout ce qui sort de la
 *    racine de stockage.
 *
 * ⛔ Derrière la session : une capture d’écran d’un logiciel métier montre des
 *    dossiers réels, des noms de personnes, parfois des montants. Elle ne se sert
 *    pas en clair sur une URL devinable.
 *
 * ⚠️ `no-store` : ce n’est pas un actif public, et un cache intermédiaire n’a
 *    rien à faire avec.
 */
import { sessionOuverte } from '../../../../../../infra/backoffice/garde'
import { pool } from '../../../../../../infra/base/connexion'
import { lirePieceJointe } from '../../../../../../infra/stockage/lecture'

const CHEMIN = `
  select c.capture_chemin
    from contextes c
   where c.retour_id = $1
   limit 1
`

export async function GET(
  _requete: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!(await sessionOuverte())) return new Response(null, { status: 404 })

  const { id } = await params
  const { rows } = await pool().query(CHEMIN, [id])
  const relatif = rows[0]?.['capture_chemin']

  if (typeof relatif !== 'string' || relatif.trim() === '') {
    return new Response(null, { status: 404 })
  }

  const piece = await lirePieceJointe(relatif)
  if (piece === undefined) return new Response(null, { status: 404 })

  return new Response(new Uint8Array(piece.octets), {
    status: 200,
    headers: { 'content-type': piece.type, 'cache-control': 'no-store' },
  })
}

/**
 * `GET /widget.js` — le bout embarqué, servi à des pages qui ne nous
 * appartiennent pas.
 *
 * ⛔ C’est la SEULE intégration supportée : une balise `<script src>`, jamais un
 *    paquet npm empaqueté par le bundler de l’hôte. Deux processus qui
 *    dialoguent en HTTP ne forment pas un seul programme ; du code empaqueté
 *    dans le même bundle, si — 04-Architecture/licences.md.
 */
import { servirActif } from '../_actifs/servir'

/** ⚠️ Lecture de fichiers : la route ne tourne pas sur l’edge. */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function GET(requete: Request): Promise<Response> {
  return servirActif('widget.js', requete)
}

export function HEAD(requete: Request): Promise<Response> {
  return servirActif('widget.js', requete)
}

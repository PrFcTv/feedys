/**
 * `GET /snapdom.js` — la capture d’écran, servie à côté du widget.
 *
 * ⛔ Elle n’est PAS empaquetée dans `widget.js` : 53 Ko gzip contre un budget
 *    total de 60. Elle est chargée à la demande, à l’ouverture du panneau, donc
 *    jamais au chargement de la page de l’hôte ([D-011]).
 *
 * ⛔ Et depuis l’origine Feedys, jamais depuis un CDN : le widget s’exécute dans
 *    le logiciel de quelqu’un d’autre, et lui imposer un tiers au moment de
 *    l’exécution — plus la règle CSP qui va avec — n’est pas à nous de le
 *    décider.
 */
import { servirActif } from '../_actifs/servir'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function GET(requete: Request): Promise<Response> {
  return servirActif('snapdom.js', requete)
}

export function HEAD(requete: Request): Promise<Response> {
  return servirActif('snapdom.js', requete)
}

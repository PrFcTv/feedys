/**
 * Les en-têtes des deux fichiers que Feedys sert à des pages qui ne lui
 * appartiennent pas : `/widget.js` et `/snapdom.js`.
 *
 * ⛔ Fonction pure. Elle ne connaît ni requête, ni disque, ni Next.
 *
 * Source de vérité : 04-Architecture/hebergement.md §Le service du widget.
 */

/**
 * ⚠️ CINQ MINUTES DE CACHE, PAS UN AN. Le widget est servi à quatre logiciels
 *    qui ne redéploient pas : c’est NOTRE cache qui décide de la vitesse de
 *    propagation d’un correctif. Un cache long avec empreinte dans l’URL
 *    obligerait chaque hôte à changer sa balise — exactement ce qu’on a cherché
 *    à éviter.
 *
 * `stale-while-revalidate` d’un jour : un hôte dont la page s’ouvre pendant que
 * Feedys redémarre reçoit l’ancien widget plutôt que rien.
 */
export const CACHE = 'public, max-age=300, stale-while-revalidate=86400'

export const TYPE_JS = 'text/javascript; charset=utf-8'

/**
 * L’empreinte d’un contenu servi, telle qu’elle voyage en `ETag`.
 *
 * ⚠️ Guillemets obligatoires : un `ETag` sans guillemets est invalide, et les
 *    caches intermédiaires le jettent en silence.
 */
export function empreinte(hexadecimal: string): string {
  return `"${hexadecimal}"`
}

export function entetesActif(etag: string, octets: number): Record<string, string> {
  return {
    'content-type': TYPE_JS,
    'content-length': String(octets),
    'cache-control': CACHE,
    etag,
    // ⚠️ Sur le SCRIPT seulement. Les routes d’API, elles, vérifient l’origine
    //    contre le `domaine` du produit déduit de la clé
    //    (domaine/retours/origine.ts).
    'access-control-allow-origin': '*',
    // ⚠️ Un hôte qui active COEP bloquerait un script tiers sans cet en-tête, et
    //    l’erreur ne ressemblerait à rien de reconnaissable.
    'cross-origin-resource-policy': 'cross-origin',
    'x-content-type-options': 'nosniff',
  }
}

/**
 * Le client a-t-il déjà cette version ?
 *
 * ⚠️ `If-None-Match` peut porter plusieurs valeurs, et un préfixe `W/` pour une
 *    correspondance faible. On compare sans le préfixe : nos empreintes sont
 *    fortes, mais les proxys en fabriquent des faibles.
 */
export function dejaAJour(siAucuneCorrespondance: string | null | undefined, etag: string): boolean {
  if (!siAucuneCorrespondance) return false
  if (siAucuneCorrespondance.trim() === '*') return true

  return siAucuneCorrespondance
    .split(',')
    .map((valeur) => valeur.trim().replace(/^W\//, ''))
    .includes(etag)
}

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

/**
 * L’encodage servi. `undefined` : le fichier part tel quel.
 *
 * ⛔ CE N’EST PAS UNE OPTIMISATION. Le budget du widget est de 60 Ko **gzip**
 *    (01-Specs/widget.md §4) et l’acceptation de P-014 le mesure **sur le
 *    fichier servi, pas sur le build local**. Servi en clair, `widget.js` pèse
 *    76 Ko chez l’hôte : le budget serait tenu dans un test et faux en
 *    production, ce qui est la pire des deux situations.
 */
export type Encodage = 'br' | 'gzip'

/**
 * Ce que le client accepte, dans notre ordre de préférence.
 *
 * ⚠️ Brotli d’abord — il gagne encore ~15 % sur gzip pour du JavaScript, et il
 *    est compris par tout ce qui exécute le widget (D-003 : Chrome ou Edge).
 *
 * ⚠️ Analyse volontairement grossière : on cherche un jeton, on ne lit ni les
 *    facteurs de qualité, ni `identity;q=0`. Un client qui refuserait vraiment
 *    gzip reçoit le fichier en clair, ce qui marche.
 */
export function encodageAccepte(entete: string | null | undefined): Encodage | undefined {
  if (!entete) return undefined

  const jetons = entete
    .toLowerCase()
    .split(',')
    .map((valeur) => valeur.split(';')[0]?.trim() ?? '')

  if (jetons.includes('br')) return 'br'
  if (jetons.includes('gzip')) return 'gzip'
  return undefined
}

/**
 * ⚠️ L’empreinte porte l’encodage. Deux représentations d’un même fichier ne
 *    sont pas le même octet : un cache intermédiaire qui les confondrait
 *    servirait du brotli à qui n’en veut pas.
 */
export function empreinteEncodee(etag: string, encodage: Encodage | undefined): string {
  return encodage === undefined ? etag : `${etag.slice(0, -1)}-${encodage}"`
}

export function entetesActif(
  etag: string,
  octets: number,
  encodage?: Encodage,
): Record<string, string> {
  return {
    'content-type': TYPE_JS,
    'content-length': String(octets),
    'cache-control': CACHE,
    etag,
    ...(encodage === undefined ? {} : { 'content-encoding': encodage }),
    // ⛔ Sans lui, un cache partagé sert le brotli à un client qui ne l’accepte
    //    pas, et l’hôte reçoit du binaire à la place d’un script.
    vary: 'Accept-Encoding',
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

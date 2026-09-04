/**
 * L’URL de la page, expurgée.
 *
 * ⚠️ Ceci ne collecte pas plus, ça collecte MOINS. Une URL de logiciel métier
 *    porte parfois un jeton de session ou un identifiant de connexion dans sa
 *    requête ; ce jeton finirait en base, dans un email, et dans une note lue
 *    par un agent de code. La liste de 01-Specs/widget.md dit « URL », pas
 *    « URL et ce qu’elle transporte ».
 *
 * La liste des paramètres sensibles est empruntée à `@fasterfixes/core` (MIT) —
 * voir ATTRIBUTIONS.md.
 */
import { BORNES } from '../transport'

const MASQUE = '[expurgé]'

/** ⛔ Comparés en minuscules et sans séparateurs : `access_token` = `accesstoken`. */
const SENSIBLES: ReadonlySet<string> = new Set([
  'token',
  'accesstoken',
  'refreshtoken',
  'idtoken',
  'key',
  'apikey',
  'secret',
  'clientsecret',
  'password',
  'passwd',
  'pwd',
  'auth',
  'authorization',
  'bearer',
  'session',
  'sessionid',
  'sid',
  'signature',
  'sig',
  'code',
  'jwt',
])

function sensible(nom: string): boolean {
  return SENSIBLES.has(nom.toLowerCase().replace(/[-_.\s]/g, ''))
}

/**
 * ⚠️ Le fragment (`#…`) est conservé tel quel : dans une application à routeur
 *    de hash, c’est lui qui porte l’écran. Il n’est pas envoyé au serveur de
 *    l’hôte par le navigateur, mais il l’est ici — d’où l’expurgation qui s’y
 *    applique aussi, dès qu’il ressemble à une requête.
 */
export function nettoyerUrl(brut: string): string {
  try {
    const url = new URL(brut)

    for (const nom of [...url.searchParams.keys()]) {
      if (sensible(nom)) url.searchParams.set(nom, MASQUE)
    }

    if (url.hash.includes('=')) url.hash = expurgerFragment(url.hash)

    return url.toString().slice(0, BORNES.url)
  } catch {
    return brut.slice(0, BORNES.url)
  }
}

function expurgerFragment(hash: string): string {
  const separateur = hash.indexOf('?')
  const chemin = separateur >= 0 ? hash.slice(0, separateur) : hash
  const requete = separateur >= 0 ? hash.slice(separateur + 1) : hash.slice(1)

  const parametres = new URLSearchParams(requete)
  let touche = false

  for (const nom of [...parametres.keys()]) {
    if (sensible(nom)) {
      parametres.set(nom, MASQUE)
      touche = true
    }
  }

  if (!touche) return hash

  return separateur >= 0 ? `${chemin}?${parametres.toString()}` : `#${parametres.toString()}`
}

/**
 * L’accès au back-office — une personne, un mot de passe, une session.
 *
 * ⛔ PAS DE RÔLES, PAS D’INSCRIPTION, PAS DE MOT DE PASSE OUBLIÉ. Le lecteur est
 *    une seule personne, qui vient deux fois par jour. Un système de comptes
 *    serait plus de code, plus de surface d’attaque, et zéro utilisateur de plus.
 *
 * ⚠️ Le jeton est un HMAC d’une date d’expiration, et le secret en est DÉRIVÉ du
 *    mot de passe : changer le mot de passe invalide toutes les sessions
 *    ouvertes, sans qu’on ait à tenir une liste de sessions ni une seconde
 *    variable d’environnement.
 *
 * ⛔ Aucune comparaison de secret n’est faite avec `===` : `timingSafeEqual`
 *    partout, sur des tampons de même longueur.
 *
 * ⛔ Et rien de tout ceci ne s’écrit dans un journal. Le dépôt est public et les
 *    journaux d’un conteneur se lisent.
 */
import { createHmac, createHash, timingSafeEqual } from 'node:crypto'

/** ⚠️ `__Host-` : lié à l’origine exacte, sans domaine ni chemin partageable. */
export const NOM_COOKIE = 'feedys_bo'

/** Une semaine. ⚠️ Deux visites par jour : une session courte serait une gêne pure. */
export const DUREE_SESSION = 7 * 24 * 3_600_000

export function motDePasseConfigure(): string | undefined {
  return process.env['FEEDYS_BO_MOT_DE_PASSE']?.trim() || undefined
}

/**
 * ⚠️ Le secret de signature est dérivé du mot de passe, pas égal à lui : le
 *    cookie ne porte donc rien qui ressemble au secret, même haché.
 */
function secret(motDePasse: string): Buffer {
  return createHash('sha256').update(`feedys-bo|${motDePasse}`).digest()
}

function egaux(a: string, b: string): boolean {
  const gauche = Buffer.from(a, 'utf8')
  const droite = Buffer.from(b, 'utf8')

  // ⚠️ `timingSafeEqual` LÈVE sur des longueurs différentes : on compare d’abord,
  //    ce qui ne fuite que la longueur — pas le contenu.
  if (gauche.length !== droite.length) return false
  return timingSafeEqual(gauche, droite)
}

export function motDePasseValide(saisi: string): boolean {
  const attendu = motDePasseConfigure()
  if (attendu === undefined) return false
  return egaux(saisi, attendu)
}

function signature(expireA: number, motDePasse: string): string {
  return createHmac('sha256', secret(motDePasse)).update(String(expireA)).digest('base64url')
}

/** Le jeton de session : `<expiration>.<hmac>`. ⚠️ Rien d’autre n’y est. */
export function creerJeton(maintenant: number): string | undefined {
  const motDePasse = motDePasseConfigure()
  if (motDePasse === undefined) return undefined

  const expireA = maintenant + DUREE_SESSION
  return `${expireA}.${signature(expireA, motDePasse)}`
}

/**
 * ⚠️ L’ordre compte : on vérifie la signature AVANT l’expiration. Vérifier
 *    l’expiration d’abord rendrait l’échec plus rapide sur un jeton périmé que
 *    sur un jeton forgé, ce qui est une différence observable.
 */
export function jetonValide(jeton: string | undefined, maintenant: number): boolean {
  const motDePasse = motDePasseConfigure()
  if (motDePasse === undefined || jeton === undefined) return false

  const separateur = jeton.indexOf('.')
  if (separateur <= 0) return false

  const brut = jeton.slice(0, separateur)
  const signe = jeton.slice(separateur + 1)

  const expireA = Number(brut)
  if (!Number.isSafeInteger(expireA)) return false

  if (!egaux(signe, signature(expireA, motDePasse))) return false

  return expireA > maintenant
}

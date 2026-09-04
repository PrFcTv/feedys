/**
 * La garde du back-office — lire, ouvrir et fermer la session.
 *
 * ⚠️ Le cookie est `HttpOnly` et `SameSite=Lax` : le jeton n’est jamais lisible
 *    en JavaScript, et il ne part pas sur une requête déclenchée par un autre
 *    site. `Secure` suit l’origine publique — un poste en `http://localhost`
 *    doit pouvoir se connecter, une production en `https://` ne doit pas
 *    laisser le jeton voyager en clair.
 *
 * ⛔ `exigerSession()` est appelée dans la disposition ET dans chaque action de
 *    serveur. Une garde posée seulement sur l’affichage protège l’écran, pas
 *    l’écriture — et c’est l’écriture qui compte.
 */
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { creerJeton, jetonValide, NOM_COOKIE, DUREE_SESSION } from './session'

function surHttps(): boolean {
  return (process.env['FEEDYS_URL_PUBLIQUE'] ?? '').startsWith('https://')
}

export async function sessionOuverte(): Promise<boolean> {
  const jeton = (await cookies()).get(NOM_COOKIE)?.value
  return jetonValide(jeton, Date.now())
}

/** ⛔ Renvoie vers la connexion plutôt que de rendre une page vide. */
export async function exigerSession(): Promise<void> {
  if (!(await sessionOuverte())) redirect('/connexion')
}

export async function ouvrirSession(): Promise<boolean> {
  const jeton = creerJeton(Date.now())
  if (jeton === undefined) return false

  ;(await cookies()).set(NOM_COOKIE, jeton, {
    httpOnly: true,
    sameSite: 'lax',
    secure: surHttps(),
    path: '/',
    maxAge: Math.floor(DUREE_SESSION / 1_000),
  })

  return true
}

export async function fermerSession(): Promise<void> {
  ;(await cookies()).delete(NOM_COOKIE)
}

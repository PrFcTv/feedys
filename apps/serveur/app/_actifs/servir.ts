/**
 * La composition des deux routes d’actifs. ⛔ Du routage, et rien d’autre :
 * la politique de cache est dans `domaine/actifs/entetes.ts`, la localisation
 * des fichiers dans `infra/actifs.ts`.
 *
 * ⚠️ Le dossier commence par `_` : Next ignore les dossiers privés, ce fichier
 *    n’est donc pas une route.
 */
import { dejaAJour, entetesActif } from '../../domaine/actifs/entetes'
import type { NomActif } from '../../infra/actifs'
import { lireActif } from '../../infra/actifs'

/**
 * ⚠️ Le message d’absence s’adresse à quelqu’un qui développe : en production,
 *    le démarrage du conteneur refuse de servir sans widget
 *    (04-Architecture/hebergement.md §Le démarrage, étape 5).
 */
const ABSENT: Readonly<Record<NomActif, string>> = {
  'widget.js': '// Feedys : widget.js est absent. Construisez-le : pnpm build\n',
  'snapdom.js': '// Feedys : snapdom.js est introuvable. Installez les dépendances : pnpm install\n',
}

export async function servirActif(nom: NomActif, requete: Request): Promise<Response> {
  const actif = await lireActif(nom)

  if (actif === undefined) {
    return new Response(ABSENT[nom], {
      status: 503,
      headers: { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' },
    })
  }

  const entetes = entetesActif(actif.etag, actif.contenu.byteLength)

  if (dejaAJour(requete.headers.get('if-none-match'), actif.etag)) {
    // ⚠️ Un 304 ne porte pas de corps, donc pas de `content-length`.
    const { 'content-length': _ignore, ...sansLongueur } = entetes
    return new Response(null, { status: 304, headers: sansLongueur })
  }

  if (requete.method === 'HEAD') {
    return new Response(null, { status: 200, headers: entetes })
  }

  return new Response(new Uint8Array(actif.contenu), { status: 200, headers: entetes })
}

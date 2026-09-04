/**
 * La composition des deux routes d’actifs. ⛔ Du routage, et rien d’autre :
 * la politique de cache est dans `domaine/actifs/entetes.ts`, la localisation
 * des fichiers dans `infra/actifs.ts`.
 *
 * ⚠️ Le dossier commence par `_` : Next ignore les dossiers privés, ce fichier
 *    n’est donc pas une route.
 */
import {
  dejaAJour,
  empreinteEncodee,
  encodageAccepte,
  entetesActif,
} from '../../domaine/actifs/entetes'
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

  // ⛔ Compressé dès que le client l’accepte. Le budget du widget est en gzip,
  //    et l’acceptation de P-014 le mesure sur le fichier SERVI.
  const encodage = encodageAccepte(requete.headers.get('accept-encoding'))
  const corps = encodage === undefined ? actif.contenu : actif.compresse[encodage]
  const etag = empreinteEncodee(actif.etag, encodage)

  const entetes = entetesActif(etag, corps.byteLength, encodage)

  if (dejaAJour(requete.headers.get('if-none-match'), etag)) {
    // ⚠️ Un 304 ne porte pas de corps, donc pas de `content-length`.
    const { 'content-length': _ignore, ...sansLongueur } = entetes
    return new Response(null, { status: 304, headers: sansLongueur })
  }

  if (requete.method === 'HEAD') {
    return new Response(null, { status: 200, headers: entetes })
  }

  return new Response(new Uint8Array(corps), { status: 200, headers: entetes })
}

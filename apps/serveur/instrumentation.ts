/**
 * Ce qui tourne une fois, au démarrage du serveur, avant qu’il ne réponde.
 *
 * ⚠️ POURQUOI ICI ET PAS DANS UN SCRIPT D’ENTRÉE. Next construit un serveur
 *    autonome (`output: 'standalone'`) : dans l’image il n’y a ni `tsx`, ni
 *    `pnpm`, ni la hiérarchie du dépôt. `register()` est le point que Next
 *    appelle lui-même au bootstrap, et il a accès au code de l’application — pas
 *    besoin d’un second empaquetage juste pour appliquer des migrations
 *    (04-Architecture/hebergement.md §Le démarrage).
 *
 * ⛔ En production, un échec de contrôle tue le processus. Un serveur à moitié
 *    démarré qui répond 500 à tout est pire qu’un conteneur qui redémarre en
 *    boucle sous les yeux de l’exploitant.
 *
 * ⚠️ Sur un poste, RIEN de tout cela ne bloque : `pnpm dev` doit démarrer sans
 *    Postgres, sans clé de modèle et sans widget construit. Les contrôles y sont
 *    des avertissements, et c’est ce que l’étape 5 de hebergement.md appelle
 *    « un garde-fou de production, pas un test ».
 *
 * ⚠️ C’est aussi d’ici que part LE FILET — le balayage qui referme les entretiens
 *    que le widget n’a pas refermés (D-018). ⛔ Seulement si le démarrage s’est
 *    bien passé : un poste sans Postgres n’a rien à balayer, et un filet qui
 *    échouerait toutes les cinq minutes dans la console de `pnpm dev` finirait
 *    par masquer ce qu’elle doit montrer.
 */
export async function register(): Promise<void> {
  // ⚠️ Next appelle `register()` aussi pour le runtime edge, où ni `pg` ni le
  //    système de fichiers n’existent.
  if (process.env['NEXT_RUNTIME'] !== 'nodejs') return

  const { demarrerOuMourir, verifierDemarrage } = await import('./infra/demarrage')
  const { demarrerFilet } = await import('./infra/filet')

  if (process.env['NODE_ENV'] !== 'production') {
    const resultat = await verifierDemarrage()
    if (!resultat.ok) {
      console.warn(`Feedys ⚠️  [${resultat.etape}] ${resultat.message}`)
      return
    }

    demarrerFilet()
    return
  }

  await demarrerOuMourir()
  demarrerFilet()
}

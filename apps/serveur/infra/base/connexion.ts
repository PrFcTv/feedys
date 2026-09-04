/**
 * La connexion à Postgres, pour le serveur qui sert.
 *
 * ⚠️ Un pool ici, un `Client` dans le runner de migrations, et ce n’est pas une
 *    incohérence : le verrou d’avis des migrations est lié à la session, un pool
 *    le poserait sur une connexion pour le relâcher sur une autre.
 *
 * ⚠️ Paresseux : rien ne se connecte à l’import. Un module d’infra qui ouvre une
 *    socket au chargement rend le build Next dépendant d’une base joignable.
 *
 * ⛔ Le dépôt est public. Rien de DATABASE_URL n’est affiché, jamais — ni en
 *    succès, ni dans un message d’erreur.
 */
import { Pool } from 'pg'

let bassin: Pool | undefined

export function pool(): Pool {
  if (bassin === undefined) {
    const url = process.env['DATABASE_URL']

    if (!url) {
      throw new Error(
        'DATABASE_URL est absente. Elle vit dans .env.local sur le poste, ' +
          'et dans l’environnement du conteneur en production.',
      )
    }

    bassin = new Pool({ connectionString: url })
  }

  return bassin
}

/** Ferme le pool. Sert aux tests d’intégration ; la production ne ferme jamais. */
export async function fermerPool(): Promise<void> {
  const ouvert = bassin
  bassin = undefined
  if (ouvert) await ouvert.end()
}

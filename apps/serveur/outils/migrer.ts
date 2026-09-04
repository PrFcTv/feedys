/**
 * `pnpm db:migrate` — applique les migrations en attente.
 *
 * Le même chemin sert au démarrage du conteneur, avant que le serveur n’écoute :
 * un échec ici empêche de servir (04-Architecture/hebergement.md §Le démarrage).
 *
 * ⛔ Le dépôt est public. Rien de `DATABASE_URL` n’est affiché, jamais — ni en
 *    succès, ni dans un message d’erreur.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { Client } from 'pg'

import { DivergenceError, appliquerMigrations } from '../infra/base/migrations'

/** Résolus depuis le module, pas depuis le cwd : le conteneur ne démarre pas à la racine. */
const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const DOSSIER_MIGRATIONS = path.join(RACINE, 'db', 'migrations')

try {
  process.loadEnvFile(path.join(RACINE, '.env.local'))
} catch {
  // Pas de .env.local ici — les variables viennent de l’environnement.
}

async function principal(): Promise<void> {
  const url = process.env['DATABASE_URL']

  if (!url) {
    throw new Error(
      'DATABASE_URL est absente. Elle vit dans .env.local sur le poste, ' +
        'et dans l’environnement du conteneur en production.',
    )
  }

  const client = new Client({ connectionString: url })
  await client.connect()

  try {
    const { appliquees, deja } = await appliquerMigrations(client, DOSSIER_MIGRATIONS)

    if (appliquees.length === 0) {
      console.log(`Rien à appliquer — ${deja.length} migration(s) déjà en base.`)
      return
    }

    for (const nom of appliquees) {
      console.log(`Appliquée · ${nom}`)
    }
    console.log(`${appliquees.length} migration(s) appliquée(s).`)
  } finally {
    await client.end()
  }
}

principal().catch((erreur: unknown) => {
  process.exitCode = 1

  if (erreur instanceof DivergenceError) {
    console.error(`\n⛔ ${erreur.message}\n`)
    return
  }

  console.error(erreur)
})

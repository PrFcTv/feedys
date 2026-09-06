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

import { indiceDeRole } from '../domaine/demarrage/controles'
import { DivergenceError, appliquerMigrations } from '../infra/base/migrations'
import { nomDeLUrlDesMigrations, urlDesMigrations } from '../infra/base/url-migrations'

/** Résolus depuis le module, pas depuis le cwd : le conteneur ne démarre pas à la racine. */
const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const DOSSIER_MIGRATIONS = path.join(RACINE, 'db', 'migrations')

try {
  process.loadEnvFile(path.join(RACINE, '.env.local'))
} catch {
  // Pas de .env.local ici — les variables viennent de l’environnement.
}

async function principal(): Promise<void> {
  // ⛔ `DATABASE_URL_MIGRATIONS` D’ABORD, avec repli sur `DATABASE_URL`.
  //
  // ⚠️ Cet outil lisait `DATABASE_URL` en dur, et la séparation des rôles
  //    n’avait été câblée qu’au démarrage du conteneur. Or c’est LE chemin
  //    documenté partout — docker-compose, README, message d’erreur des tests —
  //    et celui qu’emprunte qui veut éprouver la séparation sur son poste : il
  //    migrait donc avec le rôle de SERVICE, qui ne peut pas migrer du tout.
  const url = urlDesMigrations()

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

  // ⚠️ L’indice de rôle est le même qu’au démarrage, et pour la même erreur :
  //    « permission denied for schema public » est exact et parfaitement
  //    inutile. Il dit désormais avec QUELLE variable on a essayé.
  console.error(erreur)
  const indice = indiceDeRole(erreur)
  if (indice !== '') {
    console.error(`${indice}
     (URL utilisée ici : ${nomDeLUrlDesMigrations()})`)
  }
})

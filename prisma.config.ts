import { defineConfig } from 'prisma/config'

/**
 * Prisma 7 ne charge plus `.env` tout seul, et `datasource.url` a quitté le
 * schéma pour venir ici.
 *
 * ⛔ Aucune valeur en dur : le dépôt est public. La chaîne de connexion vient de
 *    l’environnement, et sur le poste de `.env.local`, ignoré par git.
 */
try {
  process.loadEnvFile('.env.local')
} catch {
  // Pas de .env.local ici — les variables viennent de l’environnement.
}

export default defineConfig({
  schema: 'prisma/schema.prisma',

  // Optionnel : seules l’introspection et les commandes de migration en ont
  // besoin, et ⛔ `prisma migrate` n’est jamais utilisé (conventions-db.md).
  datasource: {
    url: process.env['DATABASE_URL'],
  },
})

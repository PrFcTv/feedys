/**
 * L’URL avec laquelle on MIGRE.
 *
 * ⚠️ DEUX RÔLES, DEUX MOMENTS ([D-019](../../../../00-Projet/DECISIONS_LOG.md)).
 *    Migrer crée des tables : ça demande le propriétaire. Servir n’en demande
 *    pas, et ne DOIT pas l’avoir — un propriétaire contourne tous les GRANT
 *    ([D-009]). `DATABASE_URL_MIGRATIONS` porte le premier rôle, `DATABASE_URL`
 *    le second.
 *
 * ⛔ Elle est FACULTATIVE, et son repli est `DATABASE_URL` : un poste et la CI
 *    n’ont qu’un rôle, et `pnpm dev` doit démarrer sans rien configurer
 *    ([D-016]). C’est le déploiement qui les sépare, pas le dépôt.
 *
 * ⚠️ CE MODULE EXISTE PARCE QUE LA SÉPARATION N’AVAIT ÉTÉ CÂBLÉE QU’AU
 *    DÉMARRAGE. `pnpm db:migrate` — le chemin documenté partout, et celui
 *    qu’emprunte qui veut éprouver la séparation sur son poste — lisait
 *    `DATABASE_URL` en dur : il migrait donc avec le rôle de SERVICE, et
 *    échouait sur « permission denied for schema public ». Une règle appliquée à
 *    un seul de ses deux appelants n’est pas une règle.
 */
export function urlDesMigrations(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const migrations = env['DATABASE_URL_MIGRATIONS']?.trim()
  return migrations !== undefined && migrations !== '' ? migrations : env['DATABASE_URL']
}

/**
 * ⛔ Le nom de la variable réellement utilisée — jamais sa valeur, qui porte un
 *    mot de passe. Sert à dire quelle URL a échoué quand les deux portent encore
 *    le même rôle, cas d’un déploiement à moitié fait.
 */
export function nomDeLUrlDesMigrations(env: NodeJS.ProcessEnv = process.env): string {
  const migrations = env['DATABASE_URL_MIGRATIONS']?.trim()
  return migrations !== undefined && migrations !== '' ? 'DATABASE_URL_MIGRATIONS' : 'DATABASE_URL'
}

/**
 * ⛔ Le délai d’ouverture d’une connexion de démarrage.
 *
 * ⚠️ Le défaut de `pg` est ZÉRO, c’est-à-dire aucun délai. Un Postgres qui
 *    accepte la socket sans jamais finir l’authentification — bascule de
 *    réplique, pool intermédiaire saturé — figeait `verifierDemarrage`
 *    indéfiniment : le serveur n’écoutait jamais, et l’exploitant ne lisait plus
 *    une seule ligne après « migration ». Un échec franc est toujours meilleur
 *    qu’une attente muette.
 */
export const DELAI_CONNEXION_MS = 10_000

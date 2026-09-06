/**
 * Le démarrage — les six étapes de 04-Architecture/hebergement.md, exécutées.
 *
 *   1. les variables obligatoires sont présentes et non vides
 *   2. la base répond
 *   3. les migrations en attente sont appliquées, en transaction
 *   4. le sha256 de chaque migration déjà appliquée colle au registre
 *   5. le widget est présent et sous son budget
 *   6. le serveur écoute
 *
 * ⛔ Un échec à n’importe quelle étape empêche de servir. Ici, « empêcher »
 *    veut dire `process.exit(1)` : un serveur à moitié démarré qui répond 500 à
 *    tout est pire qu’un conteneur qui redémarre en boucle sous les yeux de
 *    l’exploitant.
 *
 * ⚠️ Les étapes 3 et 4 sont celles de `infra/base/migrations.ts`, qui pose un
 *    verrou d’avis : deux conteneurs qui démarrent ensemble n’appliquent pas la
 *    même migration deux fois.
 */
import path from 'node:path'
import { gzipSync } from 'node:zlib'

import { Client } from 'pg'

import {
  enKo,
  indiceDeRole,
  messageRole,
  messageVariablesManquantes,
  messageWidget,
  variablesManquantes,
  verdictRole,
  verdictWidget,
} from '../domaine/demarrage/controles'

import { lireActif } from './actifs'
import { DivergenceError, appliquerMigrations } from './base/migrations'
import {
  DELAI_CONNEXION_MS,
  nomDeLUrlDesMigrations,
  urlDesMigrations,
} from './base/url-migrations'
import { racineDepot } from './racine'

export interface Journal {
  info(message: string): void
  alerte(message: string): void
  erreur(message: string): void
}

/** ⚠️ `console`, mais nommé : le démarrage est la seule chose qui parle en clair. */
export const CONSOLE: Journal = {
  info: (m) => void console.log(`Feedys · ${m}`),
  alerte: (m) => void console.warn(`Feedys ⚠️  ${m}`),
  erreur: (m) => void console.error(`Feedys ⛔ ${m}`),
}

export type ResultatDemarrage =
  | { readonly ok: true }
  | { readonly ok: false; readonly etape: Etape; readonly message: string }

export type Etape = 'variables' | 'base' | 'migrations' | 'widget'

/**
 * Le dossier des migrations.
 *
 * ⚠️ `FEEDYS_MIGRATIONS` d’abord : dans le conteneur il n’y a pas de racine de
 *    dépôt à remonter — `pnpm-workspace.yaml` n’y existe pas.
 */
export function dossierMigrations(): string | undefined {
  const declare = process.env['FEEDYS_MIGRATIONS']?.trim()
  if (declare) return declare

  const racine = racineDepot()
  return racine === undefined ? undefined : path.join(racine, 'db', 'migrations')
}

export async function verifierDemarrage(journal: Journal = CONSOLE): Promise<ResultatDemarrage> {
  // ── 1. les variables ───────────────────────────────────────────────────────
  const manquantes = variablesManquantes(process.env)

  for (const { nom, consequence } of manquantes.recommandees) {
    journal.alerte(`${nom} est absente — ${consequence}.`)
  }

  if (manquantes.obligatoires.length > 0) {
    return {
      ok: false,
      etape: 'variables',
      message: messageVariablesManquantes(manquantes.obligatoires),
    }
  }

  // ── 2, 3 et 4. la base, puis les migrations ────────────────────────────────
  const dossier = dossierMigrations()
  if (dossier === undefined) {
    return {
      ok: false,
      etape: 'migrations',
      message:
        'Feedys ne peut pas démarrer — le dossier des migrations est introuvable. ' +
        'En conteneur, FEEDYS_MIGRATIONS le désigne.',
    }
  }

  // ⚠️ Une connexion à soi, pas le pool de l’application : le verrou d’avis est
  //    lié à la session, et un pool le poserait sur une connexion pour le
  //    relâcher sur une autre.
  //
  // ⚠️ L’URL est celle des MIGRATIONS, avec son repli sur `DATABASE_URL` — le
  //    pourquoi vit dans `base/url-migrations.ts`, qui sert aussi à
  //    `pnpm db:migrate`.
  const client = new Client({
    connectionString: urlDesMigrations(),
    connectionTimeoutMillis: DELAI_CONNEXION_MS,
  })

  try {
    await client.connect()
  } catch (erreur) {
    // ⛔ Rien de l’URL n’est affiché — elle porte un mot de passe. ⚠️ Son NOM,
    //    lui, est ce qui manquait : quand les deux variables portent encore le
    //    même rôle — un déploiement à moitié fait — « la base ne répond pas »
    //    envoyait vérifier DATABASE_URL et le conteneur Postgres, qui allaient
    //    tous les deux très bien.
    return {
      ok: false,
      etape: 'base',
      message:
        `Feedys ne peut pas démarrer — la base ne répond pas sur ${nomDeLUrlDesMigrations()}.\n` +
        `  ${erreur instanceof Error ? erreur.message : String(erreur)}`,
    }
  }

  try {
    const { appliquees, deja } = await appliquerMigrations(client, dossier)

    for (const nom of appliquees) journal.info(`migration appliquée · ${nom}`)
    journal.info(`base à jour — ${appliquees.length + deja.length} migration(s).`)
  } catch (erreur) {
    return {
      ok: false,
      etape: 'migrations',
      message:
        erreur instanceof DivergenceError
          ? `Feedys ne peut pas démarrer — ${erreur.message}`
          : `Feedys ne peut pas démarrer — les migrations ont échoué.\n  ${
              erreur instanceof Error ? erreur.message : String(erreur)
            }${indiceDeRole(erreur)}`,
    }
  } finally {
    // ⚠️ `.catch` : un `end()` qui jette ici écraserait le verdict `{ok:false}`
    //    qu’on vient de composer, et `demarrerOuMourir` mourrait sans message.
    await client.end().catch(() => undefined)
  }

  // ── 4bis. la connexion de SERVICE ────────────────────────────────────────
  const service = await verifierLeService(journal)
  if (!service.ok) return service

  // ── 5. le widget ───────────────────────────────────────────────────────────
  const verdict = verdictWidget(await poidsWidgetGzip())
  const refus = messageWidget(verdict)

  if (refus !== undefined || !verdict.ok) {
    return { ok: false, etape: 'widget', message: refus ?? 'widget.js indisponible.' }
  }

  journal.info(`widget.js — ${enKo(verdict.octets)} gzip, sous le budget.`)

  return { ok: true }
}

/**
 * La question que le démarrage pose à Postgres sur lui-même.
 *
 * ⚠️ `pg_has_role(current_user, relowner, 'member')` pour la POSSESSION, et non
 *    `pg_get_userbyid(relowner) = current_user` : un rôle MEMBRE du propriétaire
 *    peut faire `set role` vers lui, et contourne donc les GRANT tout autant.
 *
 * ⛔ MAIS `'usage'` POUR L’APPARTENANCE AU GROUPE, et la nuance est tout
 *    l’intérêt du contrôle. `'member'` répond `true` à un rôle `NOINHERIT`, qui
 *    ne peut pourtant RIEN lire sans un `set role` à chaque connexion : le
 *    démarrage annonçait « Les GRANT s’appliquent » sur un rôle à qui Postgres
 *    refuse un simple `select`. C’est la faute que hebergement.md désigne
 *    nommément (« ⚠️ `inherit` explicite »), et le contrôle censé l’attraper
 *    passait à côté.
 *
 * ⚠️ `relkind in ('r', 'p')` : une table partitionnée est un `'p'`. Aucune
 *    aujourd’hui — et une table possédée par le rôle de service ne doit pas
 *    échapper au compte le jour où il y en aura une.
 *
 * ⛔ EXPORTÉE POUR ÊTRE ÉPROUVÉE. `roles.integration.test.ts` la joue contre un
 *    vrai rôle NOINHERIT. La recopier là-bas aurait fait un test qui reste vert
 *    quand la requête de production change — c’est précisément le défaut qu’une
 *    relecture a trouvé ailleurs dans ce dépôt.
 */
export const ETAT_ROLE = `
  select
    current_user::text as role,
    coalesce((select rolsuper from pg_roles where rolname = current_user), false) as superutilisateur,
    pg_has_role(current_user, 'feedys_app', 'usage') as herite,
    count(*) filter (where pg_has_role(current_user, c.relowner, 'member')) as possedees,
    count(*) as tables
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p')
`

/**
 * La connexion de SERVICE — celle avec laquelle on servira.
 *
 * ⛔ ELLE EST OUVERTE POUR DE BON, ET SON ÉCHEC REFUSE LE DÉMARRAGE. C’est le
 *    trou que P-018 avait creusé sans le voir : l’étape 2 testait `DATABASE_URL`
 *    jusque-là ; depuis la séparation, elle teste `DATABASE_URL_MIGRATIONS`, et
 *    plus rien ne regardait la première. Un `catch` avalait tout — y compris
 *    « password authentication failed » — en une alerte d’apparence bénigne.
 *
 * ⚠️ Le conteneur démarrait alors VERT, écoutait, et le pool échouait sur CHAQUE
 *    requête. `/sante` rend 503, le `HEALTHCHECK` passe unhealthy — et
 *    `restart: unless-stopped` ne redémarre PAS un conteneur unhealthy : il
 *    reste debout à ne rien servir. C’est exactement le « serveur à moitié
 *    démarré » qu’instrumentation.ts déclare pire qu’un redémarrage en boucle.
 *
 * ⛔ Ce qui, lui, NE REFUSE JAMAIS, c’est le verdict sur le rôle : un poste est
 *    légitimement en rôle unique, et la CI aussi. La connexion est une panne ;
 *    le verdict est une information. Les confondre était la faute.
 */
async function verifierLeService(journal: Journal): Promise<ResultatDemarrage> {
  const client = new Client({
    connectionString: process.env['DATABASE_URL'],
    connectionTimeoutMillis: DELAI_CONNEXION_MS,
  })

  try {
    await client.connect()
  } catch (erreur) {
    // ⛔ Jamais l’URL — elle porte un mot de passe. Son nom suffit à chercher.
    return {
      ok: false,
      etape: 'base',
      message: [
        'Feedys ne peut pas démarrer — la base ne répond pas sur DATABASE_URL.',
        `  ${erreur instanceof Error ? erreur.message : String(erreur)}`,
        '  ⚠️ Les migrations, elles, sont passées : c’est bien la connexion de SERVICE',
        '     qui est en cause (04-Architecture/hebergement.md §Le rôle de connexion).',
      ].join('\n'),
    }
  }

  try {
    // ⚠️ Un délai court sur la requête aussi : un contrôle purement informatif
    //    n’a pas à pouvoir bloquer un démarrage.
    await client.query("set statement_timeout = '5s'")
    const { rows } = await client.query(ETAT_ROLE)
    const ligne = rows[0]

    if (ligne !== undefined) {
      const verdict = verdictRole({
        role: String(ligne['role']),
        superutilisateur: ligne['superutilisateur'] === true,
        heriteDuGroupe: ligne['herite'] === true,
        tablesPossedees: Number(ligne['possedees']),
        tables: Number(ligne['tables']),
      })

      if (verdict.separe) journal.info(messageRole(verdict))
      else journal.alerte(messageRole(verdict))
    }
  } catch {
    journal.alerte('rôle de connexion · impossible de le vérifier. Le démarrage continue.')
  } finally {
    await client.end().catch(() => undefined)
  }

  return { ok: true }
}

/**
 * Le poids de `widget.js` **tel qu’il sera servi**.
 *
 * ⚠️ Compressé ici, et pas lu depuis un rapport de construction : ce qu’un hôte
 *    télécharge est un flux gzip, et c’est ce nombre-là que le budget vise
 *    (acceptation de P-014).
 */
async function poidsWidgetGzip(): Promise<number | undefined> {
  const actif = await lireActif('widget.js')
  if (actif === undefined) return undefined

  return gzipSync(actif.contenu).byteLength
}

/**
 * Le démarrage, avec sa conséquence.
 *
 * ⚠️ Séparé de `verifierDemarrage` pour que les tests puissent lire un verdict
 *    sans tuer le processus qui les exécute.
 */
export async function demarrerOuMourir(journal: Journal = CONSOLE): Promise<void> {
  const resultat = await verifierDemarrage(journal)

  if (resultat.ok) {
    journal.info('prêt.')
    return
  }

  journal.erreur(`[${resultat.etape}] ${resultat.message}`)
  process.exit(1)
}

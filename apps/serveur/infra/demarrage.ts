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
  messageRole,
  messageVariablesManquantes,
  messageWidget,
  variablesManquantes,
  verdictRole,
  verdictWidget,
} from '../domaine/demarrage/controles'

import { lireActif } from './actifs'
import { DivergenceError, appliquerMigrations } from './base/migrations'
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
  // ⚠️ DEUX RÔLES, DEUX MOMENTS. Migrer crée des tables : ça demande le
  //    propriétaire. Servir n’en demande pas, et ne DOIT pas l’avoir — un
  //    propriétaire contourne tous les GRANT ([D-009]). `DATABASE_URL_MIGRATIONS`
  //    porte donc le premier rôle, `DATABASE_URL` le second.
  //
  // ⛔ Elle est FACULTATIVE, et son repli est `DATABASE_URL` : un poste et la CI
  //    n’ont qu’un rôle, et `pnpm dev` doit démarrer sans rien configurer
  //    ([D-016]). C’est le déploiement qui les sépare, pas le dépôt.
  const client = new Client({ connectionString: urlDesMigrations() })

  try {
    await client.connect()
  } catch (erreur) {
    // ⛔ Rien de DATABASE_URL n’est affiché — elle porte un mot de passe.
    return {
      ok: false,
      etape: 'base',
      message:
        'Feedys ne peut pas démarrer — la base ne répond pas.\n' +
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
    await client.end()
  }

  // ── 4bis. le rôle de service ──────────────────────────────────────────
  //
  // ⛔ IL NE REFUSE JAMAIS. Un poste est légitimement en rôle unique, et la CI
  //    aussi. Il DIT, dans les journaux, si le garde-fou de D-009 mord vraiment.
  //
  // ⚠️ Sur la connexion de SERVICE, jamais sur celle des migrations : celle-ci
  //    est propriétaire par construction, et répondrait toujours « oui ».
  await annoncerLeRole(journal)

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
 * ⚠️ L’erreur qu’on VA voir si quelqu’un sépare les rôles à moitié.
 *
 *    Un rôle de service ne peut pas migrer, même sur une base déjà à jour : le
 *    runner commence par un `create table if not exists`, et Postgres vérifie le
 *    privilège `CREATE` sur le schéma AVANT de regarder si la table existe.
 *
 * ⛔ Sans cet indice, le message serait « permission denied for schema public »
 *    et rien d’autre — exact, et parfaitement inutile à trois heures du matin.
 */
function indiceDeRole(erreur: unknown): string {
  const texte = erreur instanceof Error ? erreur.message : String(erreur)
  if (!/permission denied/i.test(texte)) return ''

  return [
    '',
    '  ⚠️ Ce rôle n’a pas le droit de migrer. Migrer crée des tables : c’est le',
    '     propriétaire qui le fait, et DATABASE_URL_MIGRATIONS le désigne',
    '     (04-Architecture/hebergement.md §Le rôle de connexion).',
  ].join('\n')
}

/**
 * L’URL avec laquelle on MIGRE.
 *
 * ⚠️ Le repli sur `DATABASE_URL` est ce qui garde un poste jouable sans rien
 *    configurer. ⛔ En production, les deux doivent différer — c’est tout
 *    l’objet de [T-004].
 */
function urlDesMigrations(): string | undefined {
  const migrations = process.env['DATABASE_URL_MIGRATIONS']?.trim()
  return migrations !== undefined && migrations !== '' ? migrations : process.env['DATABASE_URL']
}

/**
 * La question que le démarrage pose à Postgres sur lui-même.
 *
 * ⚠️ `pg_has_role(current_user, relowner, 'member')` et non
 *    `pg_get_userbyid(relowner) = current_user` : un rôle MEMBRE du propriétaire
 *    peut faire `set role` vers lui, et contourne donc les GRANT tout autant.
 */
const ETAT_ROLE = `
  select
    current_user::text as role,
    coalesce((select rolsuper from pg_roles where rolname = current_user), false) as superutilisateur,
    pg_has_role(current_user, 'feedys_app', 'member') as membre,
    count(*) filter (where pg_has_role(current_user, c.relowner, 'member')) as possedees,
    count(*) as tables
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
`

/**
 * ⛔ N’échoue jamais. Si la question elle-même ne peut pas être posée, on le dit
 *    et on continue : un contrôle d’information qui empêcherait de servir serait
 *    un refus déguisé.
 */
async function annoncerLeRole(journal: Journal): Promise<void> {
  const client = new Client({ connectionString: process.env['DATABASE_URL'] })

  try {
    await client.connect()
    const { rows } = await client.query(ETAT_ROLE)
    const ligne = rows[0]

    if (ligne === undefined) return

    const verdict = verdictRole({
      role: String(ligne['role']),
      superutilisateur: ligne['superutilisateur'] === true,
      membreDuGroupe: ligne['membre'] === true,
      tablesPossedees: Number(ligne['possedees']),
      tables: Number(ligne['tables']),
    })

    if (verdict.separe) journal.info(messageRole(verdict))
    else journal.alerte(messageRole(verdict))
  } catch {
    journal.alerte('rôle de connexion · impossible de le vérifier. Le démarrage continue.')
  } finally {
    await client.end().catch(() => undefined)
  }
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

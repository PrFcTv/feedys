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
  messageVariablesManquantes,
  messageWidget,
  variablesManquantes,
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
const CONSOLE: Journal = {
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
  const client = new Client({ connectionString: process.env['DATABASE_URL'] })

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
            }`,
    }
  } finally {
    await client.end()
  }

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

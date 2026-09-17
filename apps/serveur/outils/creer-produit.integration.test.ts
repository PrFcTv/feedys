/**
 * L’outil de création de produit, **tel qu’il tourne dans l’image** : empaqueté,
 * lancé par `node`, depuis un dossier sans `node_modules`.
 *
 * ⛔ CE QUE CE TEST EMPÊCHE DE REVENIR. L’image ne porte ni `pnpm`, ni `tsx`, ni
 *    le dépôt : `pnpm produit:creer` n’existait donc pas chez un client, et
 *    sans produit il n’y a ni clé, ni widget (03-Bugs/BUGS_LOG.md 020). La
 *    liste d’installation l’écrivait pourtant comme si de rien n’était.
 *
 * ⚠️ Le dossier temporaire est HORS du dépôt exprès : un bundle qui résoudrait
 *    encore `pg` ou `hash-wasm` depuis un `node_modules` voisin passerait ici et
 *    casserait dans le conteneur. `hash-wasm` en particulier charge son
 *    WebAssembly à l’exécution — c’est la vérification du secret qui le prouve.
 */
import { execFile } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

import { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { urlBaseDessai } from '../../../tests/base-dessai'
import { appliquerMigrations } from '../infra/base/migrations'
import { dechiffrer, nouvelleCleDeChiffrement, secretValide } from '../infra/secret'

import { empaqueterOutils } from './empaqueter'

const lancer = promisify(execFile)

const ICI = path.dirname(fileURLToPath(import.meta.url))
const DOSSIER_MIGRATIONS = path.resolve(ICI, '../../../db/migrations')

const ADMIN = urlBaseDessai()
const NOM_BASE = `feedys_essai_outil_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

/** ⛔ Inventée pour ce test, jamais réutilisée : le dépôt est public. */
const CLE = nouvelleCleDeChiffrement()

let dossier: string
let outil: string
let base: Client

function urlAvecBase(url: string, nom: string): string {
  const u = new URL(url)
  u.pathname = `/${nom}`
  return u.toString()
}

/**
 * ⚠️ Un environnement FERMÉ : pas celui du test, qui porte le `.env.local` du
 *    poste et sa `DATABASE_URL`. Seul `PATH` passe, pour trouver `node` ; et
 *    `NODE_ENV` vaut ce qu’il vaut dans l’image.
 */
async function creerProduit(
  args: string[],
  env: Record<string, string>,
): Promise<{ code: number; sortie: string; erreurs: string }> {
  try {
    const { stdout, stderr } = await lancer(process.execPath, [outil, ...args], {
      cwd: dossier,
      env: { PATH: process.env['PATH'] ?? '', NODE_ENV: 'production', ...env },
    })
    return { code: 0, sortie: stdout, erreurs: stderr }
  } catch (erreur) {
    const e = erreur as { code?: number; stdout?: string; stderr?: string }
    return { code: e.code ?? -1, sortie: e.stdout ?? '', erreurs: e.stderr ?? '' }
  }
}

beforeAll(async () => {
  dossier = await mkdtemp(path.join(tmpdir(), 'feedys-outil-'))
  const [fichier] = await empaqueterOutils(dossier)
  if (fichier === undefined) throw new Error('Aucun outil empaqueté.')
  outil = fichier

  const admin = new Client({ connectionString: ADMIN })
  await admin.connect()
  await admin.query(`create database "${NOM_BASE}"`)
  await admin.end()

  base = new Client({ connectionString: urlAvecBase(ADMIN, NOM_BASE) })
  await base.connect()
  await appliquerMigrations(base, DOSSIER_MIGRATIONS)
}, 60_000)

afterAll(async () => {
  await base?.end().catch(() => undefined)

  const menage = new Client({ connectionString: ADMIN })
  await menage.connect()
  try {
    await menage.query(`drop database if exists "${NOM_BASE}" with (force)`)
  } finally {
    await menage.end()
  }

  if (dossier) await rm(dossier, { recursive: true, force: true })
})

describe('outils/creer-produit.mjs — l’outil tel que l’image le porte', () => {
  it('crée le produit, imprime la balise, et le secret se vérifie', async () => {
    const { code, sortie, erreurs } = await creerProduit(
      ['--nom', 'Pistache', '--domaine', 'app.exemple.fr', '--metier', 'Gestion locative'],
      {
        DATABASE_URL: urlAvecBase(ADMIN, NOM_BASE),
        FEEDYS_CLE_CHIFFREMENT: CLE,
        FEEDYS_URL_PUBLIQUE: 'https://feedys.exemple.fr',
      },
    )

    expect(erreurs).toBe('')
    expect(code).toBe(0)

    const cle = /Clé publique\s+(\S+)/.exec(sortie)?.[1]
    const secret = /Secret\s+(\S+)/.exec(sortie)?.[1]
    expect(cle).toMatch(/^fdy_pub_/)
    expect(secret).toBeDefined()

    // ⚠️ L’origine vient de l’environnement du conteneur : c’est la ligne que
    //    l’intégrateur recopie telle quelle chez l’hôte.
    expect(sortie).toContain(
      `<script src="https://feedys.exemple.fr/widget.js" data-cle="${cle}" defer></script>`,
    )

    const { rows } = await base.query<{
      nom: string
      domaine: string
      contexte_metier: string | null
      secret_hash: string
      secret_chiffre: string | null
    }>(
      `select nom, domaine, contexte_metier, secret_hash, secret_chiffre
         from produits where cle_publique = $1`,
      [cle],
    )
    expect(rows).toHaveLength(1)
    const [produit] = rows
    expect(produit).toMatchObject({
      nom: 'Pistache',
      domaine: 'app.exemple.fr',
      contexte_metier: 'Gestion locative',
    })

    // ⛔ Les deux formes du secret [D-015], écrites par le BUNDLE : l’empreinte
    //    argon2id (hash-wasm) se vérifie, et l’enveloppe se déchiffre avec la
    //    clé de l’installation.
    expect(await secretValide(secret ?? '', produit?.secret_hash ?? '')).toBe(true)
    expect(dechiffrer(produit?.secret_chiffre ?? null, Buffer.from(CLE, 'base64url'))).toBe(
      secret,
    )
  })

  it('sans arguments, refuse en donnant les deux formes de la commande', async () => {
    const { code, erreurs } = await creerProduit([], {})

    expect(code).toBe(1)
    expect(erreurs).toContain('pnpm produit:creer')
    expect(erreurs).toContain('node outils/creer-produit.mjs')
  })

  it('sans clé de chiffrement, refuse et n’écrit rien', async () => {
    const avant = await base.query('select count(*)::int as n from produits')

    const { code, erreurs } = await creerProduit(['--nom', 'Noisette', '--domaine', 'n.exemple.fr'], {
      DATABASE_URL: urlAvecBase(ADMIN, NOM_BASE),
    })

    expect(code).toBe(1)
    expect(erreurs).toContain('FEEDYS_CLE_CHIFFREMENT')
    const apres = await base.query('select count(*)::int as n from produits')
    expect(apres.rows[0]).toEqual(avant.rows[0])
  })
})

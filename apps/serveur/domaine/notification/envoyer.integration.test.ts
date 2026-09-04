/**
 * L’envoi de la note contre un VRAI Postgres.
 *
 * ⚠️ Ce que le test unitaire ne peut pas prouver et qui compte ici : la ligne de
 *    `notifications` est bien écrite, son statut suit l’issue de l’envoi, et
 *    ⛔ **un SMTP coupé laisse le retour `envoye`**.
 *
 * ⛔ Le SMTP est bouchonné. Ce qu’on vérifie, c’est le câblage et le SQL.
 *
 * Il faut un Postgres joignable : `docker compose up -d postgres`, et
 * DATABASE_URL renseignée (.env.local sur le poste, service `postgres` en CI).
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { Client, Pool } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { creerDepotNotifications } from '../../infra/base/depot-notifications'
import { appliquerMigrations } from '../../infra/base/migrations'
import { identifiant } from '../../infra/identifiants'
import type { Synthese } from '../synthese/schema'

import type { PortSmtp, PortsNotification } from './envoyer'
import { envoyerNote } from './envoyer'
import type { MessageEmail } from './message'

const ICI = path.dirname(fileURLToPath(import.meta.url))
const RACINE = path.resolve(ICI, '../../../..')
const DOSSIER_MIGRATIONS = path.join(RACINE, 'db', 'migrations')

const ADMIN = process.env['DATABASE_URL'] ?? 'postgresql://feedys:feedys@localhost:5432/feedys'

const DOMAINE = 'pistache.exemple.fr'
const DESTINATAIRE = 'developpeur@exemple.fr'
const URL_PUBLIQUE = 'https://feedys.exemple.fr'

/** ⛔ Écrite à la main. Jamais un vrai retour copié d’une base (CLAUDE.md §Secrets). */
const SYNTHESE: Synthese = {
  type: 'bug',
  titre: 'Le tri par date de la liste des dossiers se réinitialise',
  resume: 'Le tri ne survit pas à la navigation. La personne le repose à chaque retour.',
  attendu: 'le tri reste en place au retour',
  constate: 'le tri revient à l’ordre par défaut',
  recurrence: 'systematique',
  zone: 'Liste des dossiers',
  impact: 'ralentit',
  citations: ['il se remet à zéro'],
  confiance: 'moyenne',
  questions_ouvertes: ['Est-ce que ça touche aussi les autres listes ?'],
}

let nomBase: string
let client: Client
let bassin: Pool
let retourId: string

function smtpQuiMarche(recus: MessageEmail[]): PortSmtp {
  return {
    envoyer: async (_destinataire, message) => {
      recus.push(message)
    },
  }
}

const SMTP_COUPE: PortSmtp = {
  envoyer: async () => {
    throw new Error('ECONNREFUSED 127.0.0.1:587')
  },
}

function ports(smtp: PortSmtp): PortsNotification {
  return {
    depot: creerDepotNotifications(bassin, URL_PUBLIQUE),
    smtp,
    destinataire: DESTINATAIRE,
  }
}

async function ligneNotification() {
  const { rows } = await client.query('select * from notifications where retour_id = $1', [
    retourId,
  ])
  return rows[0]
}

async function statutDuRetour(): Promise<string> {
  const { rows } = await client.query('select statut from retours where id = $1', [retourId])
  return String(rows[0]?.['statut'])
}

beforeAll(async () => {
  nomBase = `feedys_essai_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

  const admin = new Client({ connectionString: ADMIN })
  await admin.connect()
  await admin.query(`create database "${nomBase}"`)
  await admin.end()

  const url = new URL(ADMIN)
  url.pathname = `/${nomBase}`

  client = new Client({ connectionString: url.toString() })
  await client.connect()
  await appliquerMigrations(client, DOSSIER_MIGRATIONS)

  bassin = new Pool({ connectionString: url.toString() })

  await client.query(
    `insert into produits (id, nom, domaine, cle_publique, secret_hash)
     values ('prod_1', 'Pistache', $1, 'fdy_pub_essai_email', 'argon2-bidon')`,
    [DOMAINE],
  )
}, 60_000)

afterAll(async () => {
  await bassin?.end()
  await client?.end()

  const menage = new Client({ connectionString: ADMIN })
  await menage.connect()
  await menage.query(`drop database if exists "${nomBase}" with (force)`)
  await menage.end()
}, 60_000)

beforeEach(async () => {
  retourId = identifiant()

  // ⚠️ Le retour est déjà clos et déjà noté : c’est l’état dans lequel l’envoi
  //    est appelé en production, APRÈS l’écriture de la synthèse.
  await client.query(
    `insert into retours (id, produit_id, source, statut, auteur_nom, auteur_role, envoye_le)
     values ($1, 'prod_1', 'voix', 'envoye', 'Camille Martin', 'gestionnaire', now())`,
    [retourId],
  )
  await client.query(
    `insert into contextes (id, retour_id, url, navigateur, viewport_l, viewport_h, fuseau)
     values ($1, $2, '/dossiers?tri=date', 'Chrome 141', 1512, 982, 'Europe/Paris')`,
    [identifiant(), retourId],
  )
  await client.query(
    `insert into syntheses (id, retour_id, contenu, modele, confiance)
     values ($1, $2, $3::jsonb, 'bouchon', 'moyenne'::confiance_synthese)`,
    [identifiant(), retourId, JSON.stringify(SYNTHESE)],
  )
})

describe('quand l’envoi réussit', () => {
  it('écrit une ligne `envoye`, datée, avec le destinataire', async () => {
    const recus: MessageEmail[] = []
    const resultat = await envoyerNote(retourId, ports(smtpQuiMarche(recus)))

    expect(resultat).toEqual({ ok: true, statut: 'envoye' })

    const ligne = await ligneNotification()
    expect(ligne?.['statut']).toBe('envoye')
    expect(ligne?.['canal']).toBe('email')
    expect(ligne?.['destinataire']).toBe(DESTINATAIRE)
    expect(ligne?.['erreur']).toBeNull()
    expect(ligne?.['envoye_le']).toBeInstanceOf(Date)
  })

  it('compose le message depuis la base — produit, synthèse, contexte, lien', async () => {
    const recus: MessageEmail[] = []
    await envoyerNote(retourId, ports(smtpQuiMarche(recus)))

    const message = recus[0]
    expect(message?.sujet).toBe(`[Feedys · Pistache] ${SYNTHESE.titre}`)
    expect(message?.corps).toContain('BUG · ralentit · confiance moyenne')
    expect(message?.corps).toContain('« il se remet à zéro »')
    expect(message?.corps).toContain('Camille Martin (gestionnaire)')
    expect(message?.corps).toContain('Chrome 141 · 1512 × 982')
    expect(message?.corps).toContain(`${URL_PUBLIQUE}/bo/r/${retourId}`)
  })

  it('⛔ ne renvoie pas la note une seconde fois', async () => {
    const recus: MessageEmail[] = []
    await envoyerNote(retourId, ports(smtpQuiMarche(recus)))
    const second = await envoyerNote(retourId, ports(smtpQuiMarche(recus)))

    expect(second).toEqual({ ok: false, motif: 'deja_envoyee' })
    expect(recus).toHaveLength(1)
  })
})

describe('⛔ quand le SMTP est coupé', () => {
  it('la notification est `echoue` — et le retour reste `envoye`', async () => {
    const resultat = await envoyerNote(retourId, ports(SMTP_COUPE))

    expect(resultat.ok).toBe(true)
    expect(resultat).toMatchObject({ statut: 'echoue' })

    const ligne = await ligneNotification()
    expect(ligne?.['statut']).toBe('echoue')
    expect(String(ligne?.['erreur'])).toContain('ECONNREFUSED')
    // ⚠️ Pas de date d’envoi sur un échec : elle mentirait au premier coup d’œil.
    expect(ligne?.['envoye_le']).toBeNull()

    // ⛔ L’invariant du produit : la parole ne se perd pas pour un relais mort.
    expect(await statutDuRetour()).toBe('envoye')
  })
})

describe('quand il n’y a rien à envoyer', () => {
  it('un retour sans synthèse n’ouvre aucune ligne', async () => {
    const sansNote = identifiant()
    await client.query(
      `insert into retours (id, produit_id, source, statut)
       values ($1, 'prod_1', 'texte', 'envoye')`,
      [sansNote],
    )

    expect(await envoyerNote(sansNote, ports(SMTP_COUPE))).toEqual({
      ok: false,
      motif: 'retour_inconnu',
    })

    const { rows } = await client.query('select 1 from notifications where retour_id = $1', [
      sansNote,
    ])
    expect(rows).toHaveLength(0)
  })
})

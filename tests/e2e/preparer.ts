/**
 * La base des parcours — créée, migrée et semée avant le premier test.
 *
 * ⛔ TOUT CE QUI EST SEMÉ ICI EST INVENTÉ. Le dépôt est public : aucun nom de
 *    client, aucun domaine réel, et ⛔ **aucun retour réel copié d’une base qui
 *    tourne** — un vrai retour dicté contient des noms de personnes
 *    (CLAUDE.md §Ce qui ne doit jamais entrer dans ce dépôt).
 *
 * ⚠️ La base est DÉTRUITE puis recréée à chaque exécution : un parcours doit
 *    partir d’un état connu, sinon son deuxième passage teste autre chose.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { Client } from 'pg'

import { appliquerMigrations } from '../../apps/serveur/infra/base/migrations'
import { identifiant } from '../../apps/serveur/infra/identifiants'
import type { Synthese } from '../../apps/serveur/domaine/synthese/schema'
import { ADMIN_E2E, BASE_E2E, CLE_DEMO_E2E, urlBaseE2E } from '../../playwright.config'

const ICI = path.dirname(fileURLToPath(import.meta.url))
const DOSSIER_MIGRATIONS = path.resolve(ICI, '../../db/migrations')

/** ⚠️ Repris tel quel par le parcours : il cherche ce titre à l’écran. */
export const TITRE_BUG = 'Le tri par date de la liste des dossiers se réinitialise'
export const TITRE_IDEE = 'Pouvoir exporter la liste filtrée en tableur'
export const PAROLE_BUG =
  'dès que je reviens en arrière le tri il se remet à zéro et faut que je le refasse'

const BUG: Synthese = {
  type: 'bug',
  titre: TITRE_BUG,
  resume: 'Le tri par date se réinitialise au retour sur la page.',
  attendu: 'le tri reste en place au retour',
  constate: 'le tri revient à l’ordre par défaut',
  recurrence: 'systematique',
  zone: 'Liste des dossiers',
  impact: 'ralentit',
  citations: ['le tri il se remet à zéro'],
  confiance: 'moyenne',
  questions_ouvertes: ['Est-ce que ça touche aussi les autres listes ?'],
}

const IDEE: Synthese = {
  type: 'idee',
  titre: TITRE_IDEE,
  resume: 'La personne recopie à la main ce qu’elle voit à l’écran pour le transmettre.',
  besoin: 'transmettre une sélection sans la retaper',
  zone: 'Facturation',
  impact: 'agace',
  citations: ['je recopie tout à la main'],
  confiance: 'haute',
  questions_ouvertes: [],
}

async function semer(client: Client): Promise<void> {
  await client.query(
    `insert into produits (id, nom, domaine, cle_publique, secret_hash)
     values ('prod_e2e', 'Pistache', 'pistache.exemple.fr', 'fdy_pub_e2e', 'argon2-bidon')`,
  )

  // ⚠️ Le produit de la fausse application hôte. `domaine = 'localhost'` parce
  //    qu’elle est servie sur `localhost:4321` et que `origineAutorisee` ignore
  //    le port — seul le nom d’hôte compte (domaine/retours/origine.ts).
  await client.query(
    `insert into produits (id, nom, domaine, cle_publique, secret_hash)
     values ('prod_demo', 'Pistache Demo', 'localhost', $1, 'argon2-bidon')`,
    [CLE_DEMO_E2E],
  )

  const bugId = 'ret_e2e_bug'
  const ideeId = 'ret_e2e_idee'

  await client.query(
    `insert into retours (id, produit_id, source, statut, type, titre, zone,
                          auteur_nom, auteur_role, identite_verifiee, envoye_le)
     values ($1, 'prod_e2e', 'voix', 'envoye', 'bug', $2, 'Liste des dossiers',
             'Camille Martin', 'gestionnaire', true, now())`,
    [bugId, BUG.titre],
  )

  await client.query(
    `insert into messages (id, retour_id, ordre, role, texte) values
       ($1, $2, 0, 'collaborateur', $3),
       ($4, $2, 1, 'bot', 'Est-ce que ça se produit sur toutes les listes ?'),
       ($5, $2, 2, 'collaborateur', 'celle des dossiers en tout cas, les autres je sais pas')`,
    [identifiant(), bugId, PAROLE_BUG, identifiant(), identifiant()],
  )

  await client.query(
    `insert into contextes (id, retour_id, url, titre_page, ecran, navigateur,
                            systeme, viewport_l, viewport_h, fuseau)
     values ($1, $2, 'https://pistache.exemple.fr/dossiers?tri=date', 'Dossiers',
             'dossiers', 'Chrome 141', 'macOS 15', 1512, 982, 'Europe/Paris')`,
    [identifiant(), bugId],
  )

  await client.query(
    `insert into syntheses (id, retour_id, contenu, modele, confiance)
     values ($1, $2, $3::jsonb, 'bouchon-e2e', 'moyenne'::confiance_synthese)`,
    [identifiant(), bugId, JSON.stringify(BUG)],
  )

  await client.query(
    `insert into retours (id, produit_id, source, statut, type, titre, zone,
                          auteur_nom, identite_verifiee, envoye_le)
     values ($1, 'prod_e2e', 'texte', 'lu', 'idee', $2, 'Facturation',
             'Alex Bernard', false, now())`,
    [ideeId, IDEE.titre],
  )

  await client.query(
    `insert into messages (id, retour_id, ordre, role, texte)
     values ($1, $2, 0, 'collaborateur', 'je recopie tout à la main dans un tableur')`,
    [identifiant(), ideeId],
  )

  await client.query(
    `insert into syntheses (id, retour_id, contenu, modele, confiance)
     values ($1, $2, $3::jsonb, 'bouchon-e2e', 'haute'::confiance_synthese)`,
    [identifiant(), ideeId, JSON.stringify(IDEE)],
  )
}

export default async function preparer(): Promise<void> {
  const admin = new Client({ connectionString: ADMIN_E2E })
  await admin.connect()

  try {
    await admin.query(`drop database if exists "${BASE_E2E}" with (force)`)
    await admin.query(`create database "${BASE_E2E}"`)
  } finally {
    await admin.end()
  }

  const client = new Client({ connectionString: urlBaseE2E() })
  await client.connect()

  try {
    await appliquerMigrations(client, DOSSIER_MIGRATIONS)
    await semer(client)
  } finally {
    await client.end()
  }
}

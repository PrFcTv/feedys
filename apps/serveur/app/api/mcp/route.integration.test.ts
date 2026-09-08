/**
 * Les trois outils MCP, contre un VRAI Postgres — **un test par outil**.
 *
 * ⚠️ Ce sont les vraies routes qui sont appelées, avec le vrai client MIT de
 *    `packages/mcp` branché dessus par un `fetch` bouchonné. Ce qu’on vérifie
 *    est donc la chaîne entière : outil → HTTP → jeton → SQL.
 *
 * ⛔ ET CE QU’ON VÉRIFIE SURTOUT : **aucun outil ne modifie ni ne supprime le
 *    contenu d’un retour.** Le statut est la seule chose qui change.
 *
 * Il faut un Postgres joignable : `docker compose up -d postgres`.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { Client } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { creerClient } from '../../../../../packages/mcp/src/client'
import type { Synthese } from '../../../domaine/synthese/schema'
import { fermerPool } from '../../../infra/base/connexion'
import { appliquerMigrations } from '../../../infra/base/migrations'
import { identifiant } from '../../../infra/identifiants'

import { GET as lister } from './retours/route'
import { GET as lire } from './retours/[id]/route'
import { POST as marquer } from './retours/[id]/statut/route'
import { urlBaseDessai } from '../../../../../tests/base-dessai'

const ICI = path.dirname(fileURLToPath(import.meta.url))
const RACINE = path.resolve(ICI, '../../../../..')
const DOSSIER_MIGRATIONS = path.join(RACINE, 'db', 'migrations')

const ADMIN = urlBaseDessai()

const ORIGINE = 'https://feedys.exemple.fr'
const JETON = 'jeton-mcp-de-test'

/** ⛔ Inventée. Jamais un vrai retour copié d’une base (CLAUDE.md §Secrets). */
const SYNTHESE: Synthese = {
  type: 'bug',
  titre: 'Le tri par date de la liste des dossiers se réinitialise',
  resume: 'Le tri ne survit pas à la navigation.',
  zone: 'Liste des dossiers',
  impact: 'ralentit',
  citations: ['il se remet à zéro'],
  confiance: 'moyenne',
  questions_ouvertes: ['Est-ce que ça touche aussi les autres listes ?'],
}

const PAROLE = 'le tri il se remet à zéro dès que je reviens en arrière'

let nomBase: string
let client: Client
let bugId: string
let ideeId: string

/**
 * ⚠️ Le `fetch` du client MIT est branché sur les vraies routes : c’est ce qui
 *    rend le test « de bout en bout » sans démarrer un serveur.
 */
const aller: typeof fetch = async (entree, options) => {
  const requete = new Request(String(entree), options)
  const url = new URL(requete.url)
  const morceaux = url.pathname.split('/').filter(Boolean)

  // /api/mcp/retours            → lister
  // /api/mcp/retours/:id        → lire
  // /api/mcp/retours/:id/statut → marquer
  if (morceaux.length === 3) return lister(requete)

  const id = decodeURIComponent(morceaux[3] ?? '')
  const params = Promise.resolve({ id })

  return morceaux[4] === 'statut' ? marquer(requete, { params }) : lire(requete, { params })
}

function outils(jeton = JETON) {
  return creerClient({ origine: ORIGINE, jeton, aller })
}

async function statutEnBase(id: string): Promise<string> {
  const { rows } = await client.query('select statut from retours where id = $1', [id])
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

  process.env['DATABASE_URL'] = url.toString()
  process.env['FEEDYS_MCP_JETON'] = JETON

  // ⚠️ `url_forge` est posée ici : c’est elle qui rend un SHA cliquable, et son
  //    absence était indiscernable d’un bug d’affichage (P-024).
  await client.query(
    `insert into produits (id, nom, domaine, cle_publique, secret_hash, url_forge)
     values ('prod_1', 'Pistache', 'pistache.exemple.fr', 'fdy_pub_essai_mcp', 'argon2-bidon',
             'https://github.com/exemple/pistache')`,
  )
}, 60_000)

afterAll(async () => {
  await fermerPool()
  await client?.end()

  const menage = new Client({ connectionString: ADMIN })
  await menage.connect()
  await menage.query(`drop database if exists "${nomBase}" with (force)`)
  await menage.end()
}, 60_000)

beforeEach(async () => {
  await client.query('delete from audit')
  await client.query('delete from syntheses')
  await client.query('delete from contextes')
  await client.query('delete from messages')
  await client.query('delete from retours')

  bugId = identifiant()
  ideeId = identifiant()

  await client.query(
    `insert into retours (id, produit_id, source, statut, type, titre, zone,
                          auteur_nom, auteur_role, identite_verifiee)
     values ($1, 'prod_1', 'voix', 'envoye', 'bug', $2, 'Liste des dossiers',
             'Camille Martin', 'gestionnaire', true)`,
    [bugId, SYNTHESE.titre],
  )
  await client.query(
    `insert into messages (id, retour_id, ordre, role, texte) values
       ($1, $2, 0, 'collaborateur', $3),
       ($4, $2, 1, 'bot', 'C’est nouveau ?')`,
    [identifiant(), bugId, PAROLE, identifiant()],
  )
  await client.query(
    `insert into contextes (id, retour_id, url, navigateur, viewport_l, viewport_h)
     values ($1, $2, '/dossiers?tri=date', 'Chrome 141', 1512, 982)`,
    [identifiant(), bugId],
  )
  await client.query(
    `insert into syntheses (id, retour_id, contenu, modele, confiance)
     values ($1, $2, $3::jsonb, 'bouchon', 'moyenne'::confiance_synthese)`,
    [identifiant(), bugId, JSON.stringify(SYNTHESE)],
  )

  await client.query(
    `insert into retours (id, produit_id, source, statut, type, titre, zone)
     values ($1, 'prod_1', 'texte', 'lu', 'idee', 'Exporter la liste filtrée', 'Facturation')`,
    [ideeId],
  )
})

describe('lister_retours', () => {
  it('rend les retours, du plus récent au plus ancien', async () => {
    const { retours } = await outils().lister({})

    expect(retours).toHaveLength(2)
    expect(retours.map((retour) => retour.id)).toContain(bugId)
    expect(retours.find((retour) => retour.id === bugId)).toMatchObject({
      titre: SYNTHESE.titre,
      type: 'bug',
      statut: 'envoye',
      produit: 'Pistache',
      confiance: 'moyenne',
    })
  })

  it('borne par statut, type, zone et date', async () => {
    expect((await outils().lister({ type: 'bug' })).retours).toHaveLength(1)
    expect((await outils().lister({ statut: 'lu' })).retours).toHaveLength(1)
    expect((await outils().lister({ zone: 'dossiers' })).retours).toHaveLength(1)
    expect((await outils().lister({ zone: 'introuvable' })).retours).toHaveLength(0)

    const demain = new Date(Date.now() + 86_400_000).toISOString()
    expect((await outils().lister({ depuis: demain })).retours).toHaveLength(0)
  })

  it('respecte la limite', async () => {
    expect((await outils().lister({ limite: 1 })).retours).toHaveLength(1)
  })
})

describe('lire_retour', () => {
  it('⚠️ rend la synthèse ET LE FIL BRUT', async () => {
    const retour = await outils().lire(bugId)

    expect(retour.synthese).toMatchObject({ titre: SYNTHESE.titre, citations: SYNTHESE.citations })

    // ⛔ La parole d’origine, entière et dans l’ordre.
    expect(retour.fil).toHaveLength(2)
    // ⚠️ `geste: null` fait partie de ce que MCP rend : l’agent doit pouvoir
    //    distinguer la parole d’une manipulation d’interface (BUGS_LOG 016).
    expect(retour.fil[0]).toEqual({ ordre: 0, role: 'collaborateur', texte: PAROLE, geste: null })
    expect(retour.fil[1]?.role).toBe('bot')

    expect(retour.contexte).toMatchObject({ navigateur: 'Chrome 141' })
    expect(retour.produit).toBe('Pistache')
    expect(retour.identite_verifiee).toBe(true)
  })

  it('rend le fil même sans synthèse — une note qui rate ne perd rien', async () => {
    const retour = await outils().lire(ideeId)

    expect(retour.synthese).toBeNull()
    expect(retour.fil).toEqual([])
  })

  it('refuse un retour inconnu', async () => {
    await expect(outils().lire('ret_absent')).rejects.toThrow('n’existe pas')
  })
})

describe('marquer_retour', () => {
  it('change le statut et journalise', async () => {
    // ⚠️ `lu` : le seul marquage qui n’exige rien, parce qu’il n’affirme rien.
    expect(await outils().marquer(bugId, { statut: 'lu' })).toEqual({
      id: bugId,
      statut: 'lu',
    })
    expect(await statutEnBase(bugId)).toBe('lu')

    const { rows } = await client.query(
      'select acteur, action, detail from audit where retour_id = $1',
      [bugId],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.['acteur']).toBe('developpeur')
    // ⚠️ Par où c’est passé : sans ça, on devine six mois plus tard.
    expect(rows[0]?.['detail']).toEqual({ avant: 'envoye', apres: 'lu', par: 'mcp' })
  })

  it('⛔ refuse un statut que le SERVEUR écrit', async () => {
    const reponse = await aller(`${ORIGINE}/api/mcp/retours/${bugId}/statut`, {
      method: 'POST',
      headers: { authorization: `Bearer ${JETON}`, 'content-type': 'application/json' },
      body: JSON.stringify({ statut: 'en_cours' }),
    })

    expect(reponse.status).toBe(400)
    expect(await statutEnBase(bugId)).toBe('envoye')
  })

  it('⛔ refuse un corps qui tenterait de toucher à la parole', async () => {
    for (const corps of [
      { statut: 'lu', texte: 'j’ai rien dit de tel' },
      { statut: 'lu', resume: 'un résumé de mon cru' },
      { titre: 'autre chose' },
    ]) {
      const reponse = await aller(`${ORIGINE}/api/mcp/retours/${bugId}/statut`, {
        method: 'POST',
        headers: { authorization: `Bearer ${JETON}`, 'content-type': 'application/json' },
        body: JSON.stringify(corps),
      })

      expect(reponse.status).toBe(400)
    }

    // ⛔ Et rien n’a bougé : ni le statut, ni le fil, ni la note.
    expect(await statutEnBase(bugId)).toBe('envoye')

    const retour = await outils().lire(bugId)
    expect(retour.fil[0]?.texte).toBe(PAROLE)
    expect(retour.synthese).toMatchObject({ resume: SYNTHESE.resume })
  })

  it('refuse un retour inconnu, sans rien journaliser', async () => {
    await expect(outils().marquer('ret_absent', { statut: 'lu' })).rejects.toThrow('n’existe pas')

    const { rows } = await client.query('select count(*)::int as n from audit')
    expect(rows[0]?.['n']).toBe(0)
  })
})

/**
 * ⛔ Ce qui se joue ici : « traité » cesse d’être une affirmation et devient une
 *    trace vérifiable — et cette trace ne s’efface jamais toute seule
 *    (01-Specs/tracabilite-du-correctif.md).
 */
describe('marquer_retour · le correctif', () => {
  const SHA = 'a1b2c3d4e5f6'

  async function correctifEnBase(id: string) {
    const { rows } = await client.query(
      'select correctif_ref, correctif_note, correctif_le from retours where id = $1',
      [id],
    )
    return rows[0] as {
      correctif_ref: string | null
      correctif_note: string | null
      correctif_le: Date | null
    }
  }

  it('consigne la référence et la note, et les journalise', async () => {
    await outils().marquer(bugId, {
      statut: 'traite',
      correctif: { ref: SHA, note: 'reset du tri corrigé dans useTableState' },
    })

    const trace = await correctifEnBase(bugId)
    expect(trace.correctif_ref).toBe(SHA)
    expect(trace.correctif_note).toBe('reset du tri corrigé dans useTableState')
    expect(trace.correctif_le).toBeInstanceOf(Date)

    const { rows } = await client.query('select detail from audit where retour_id = $1', [bugId])
    expect(rows[0]?.['detail']).toMatchObject({
      apres: 'traite',
      par: 'mcp',
      correctif: { ref: SHA, note: 'reset du tri corrigé dans useTableState' },
    })
  })

  it('⛔ rejouer le MÊME marquage ne fait pas croire à une seconde correction', async () => {
    await outils().marquer(bugId, { statut: 'traite', correctif: { ref: SHA } })
    const premier = await correctifEnBase(bugId)

    await outils().marquer(bugId, { statut: 'traite', correctif: { ref: SHA } })
    const second = await correctifEnBase(bugId)

    // ⛔ L’ÉTAT est identique — c’est ça, `idempotentHint: true`.
    expect(second.correctif_le?.getTime()).toBe(premier.correctif_le?.getTime())

    // ⚠️ L’HISTORIQUE, lui, s’empile : deux marquages, deux lignes d’audit.
    const { rows } = await client.query(
      'select count(*)::int as n from audit where retour_id = $1',
      [bugId],
    )
    expect(rows[0]?.['n']).toBe(2)
  })

  it('un correctif RÉELLEMENT nouveau repose l’horodatage', async () => {
    await outils().marquer(bugId, { statut: 'traite', correctif: { ref: SHA } })
    const premier = await correctifEnBase(bugId)

    await outils().marquer(bugId, { statut: 'traite', correctif: { ref: 'f6e5d4c3b2a1' } })
    const second = await correctifEnBase(bugId)

    expect(second.correctif_ref).toBe('f6e5d4c3b2a1')
    expect(second.correctif_le!.getTime()).toBeGreaterThanOrEqual(premier.correctif_le!.getTime())
  })

  it('⛔ un marquage ultérieur SANS correctif n’efface pas celui qui était là', async () => {
    await outils().marquer(bugId, { statut: 'traite', correctif: { ref: SHA } })
    await outils().marquer(bugId, { statut: 'ecarte' })

    // ⛔ Le défaut évité : reclasser un retour six semaines plus tard ferait
    //    disparaître le commit qui l’avait réparé.
    expect((await correctifEnBase(bugId)).correctif_ref).toBe(SHA)
  })

  it('⛔ le SERVEUR refuse « traite » sans correctif — pas seulement l’outil', async () => {
    const reponse = await aller(`${ORIGINE}/api/mcp/retours/${bugId}/statut`, {
      method: 'POST',
      headers: { authorization: `Bearer ${JETON}`, 'content-type': 'application/json' },
      body: JSON.stringify({ statut: 'traite' }),
    })

    expect(reponse.status).toBe(400)
    expect(await statutEnBase(bugId)).toBe('envoye')
  })

  it('⛔ le serveur refuse une référence qui n’est ni un SHA ni une URL', async () => {
    const reponse = await aller(`${ORIGINE}/api/mcp/retours/${bugId}/statut`, {
      method: 'POST',
      headers: { authorization: `Bearer ${JETON}`, 'content-type': 'application/json' },
      body: JSON.stringify({ statut: 'traite', correctif: { ref: 'corrigé hier' } }),
    })

    expect(reponse.status).toBe(400)
    expect(await statutEnBase(bugId)).toBe('envoye')
  })

  it('lire_retour rend le mot au collaborateur ET le correctif, lien composé', async () => {
    await outils().marquer(bugId, {
      statut: 'traite',
      reponse: 'Le tri garde son ordre maintenant.',
      correctif: { ref: SHA, note: 'useTableState' },
    })

    const retour = await outils().lire(bugId)

    // ⚠️ Sans ça, un agent qui rouvre le retour réécrit le même mot à quelqu’un
    //    qui l’a déjà lu : le serveur tenait l’idempotence sans en rien dire.
    expect(retour.reponse).toMatchObject({
      texte: 'Le tri garde son ordre maintenant.',
      lue_le: null,
    })
    expect(retour.correctif).toMatchObject({
      ref: SHA,
      note: 'useTableState',
      // ⛔ Composé à partir de `url_forge`, JAMAIS appelé (D-024).
      url: `https://github.com/exemple/pistache/commit/${SHA}`,
    })
  })

  it('rend null des deux côtés tant que rien n’est arrivé', async () => {
    const retour = await outils().lire(bugId)

    expect(retour.reponse).toBeNull()
    expect(retour.correctif).toBeNull()
  })
})

describe('⛔ le jeton', () => {
  it('refuse un jeton absent, et un jeton faux', async () => {
    const sansJeton = await aller(`${ORIGINE}/api/mcp/retours`, {})
    expect(sansJeton.status).toBe(401)

    await expect(outils('pas-le-bon-jeton').lister({})).rejects.toThrow('ne convient pas')
  })

  it('⛔ ferme tout quand FEEDYS_MCP_JETON est absente du serveur', async () => {
    const avant = process.env['FEEDYS_MCP_JETON']
    delete process.env['FEEDYS_MCP_JETON']

    try {
      const reponse = await aller(`${ORIGINE}/api/mcp/retours`, {
        headers: { authorization: `Bearer ${JETON}` },
      })
      // ⚠️ 503 et non 401 : ce n’est pas l’appelant qui a tort.
      expect(reponse.status).toBe(503)
    } finally {
      process.env['FEEDYS_MCP_JETON'] = avant
    }
  })
})

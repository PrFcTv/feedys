/**
 * Tests unitaires purs de la relève et de l’accusé de réception collaborateur.
 *
 * ⛔ Purement en mémoire : ni Postgres, ni réseau, ni horloge système.
 */
import { describe, expect, it, vi } from 'vitest'

import { signerIdentite } from '../identite/jeton'
import type {
  PortDepotCollaborateur,
  PortProduitsCollaborateur,
  PortsCollaborateur,
  ReponseCollaborateur,
} from './collaborateur'
import {
  accuserReceptionCollaborateur,
  releverReponsesCollaborateur,
} from './collaborateur'

const MAINTENANT = 1_700_000_000_000
const SECRET = 'sec_secret_produit_pour_les_tests_123'

const PRODUIT_VALIDE = {
  id: 'prd_1',
  domaine: 'https://app.exemple.fr',
  actif: true,
  secret: SECRET,
  contexteMetier: null,
}

function creerBouchon(options: {
  reponses?: readonly ReponseCollaborateur[]
  auteurRef?: string | null
  produit?: typeof PRODUIT_VALIDE | null
} = {}): PortsCollaborateur {
  const depot: PortDepotCollaborateur = {
    releverReponses: vi.fn().mockResolvedValue(options.reponses ?? []),
    trouverAuteurRef: vi.fn().mockResolvedValue(options.auteurRef !== undefined ? options.auteurRef : 'usr_42'),
    accuserReception: vi.fn().mockResolvedValue(true),
  }

  const produits: PortProduitsCollaborateur = {
    produitParCle: vi.fn().mockResolvedValue(options.produit !== undefined ? options.produit : PRODUIT_VALIDE),
  }

  return { produits, depot }
}

function jetonValide(ref = 'usr_42', expSecondes = Math.floor(MAINTENANT / 1_000) + 3_600): string {
  return signerIdentite({ ref, nom: 'Alice', role: 'Comptable', exp: expSecondes }, SECRET)
}

describe('releverReponsesCollaborateur', () => {
  it('refuse si la clé publique est absente', async () => {
    const ports = creerBouchon()
    const resultat = await releverReponsesCollaborateur(
      { cle: null, identite: null, origine: 'https://app.exemple.fr', maintenant: MAINTENANT },
      ports,
    )

    expect(resultat).toEqual({
      ok: false,
      motif: 'cle_absente',
      message: 'La clé de produit est absente.',
    })
  })

  it('refuse si le produit est inconnu ou inactif', async () => {
    const ports = creerBouchon({ produit: null })
    const resultat = await releverReponsesCollaborateur(
      { cle: 'fdy_pub_inconnue', identite: null, origine: 'https://app.exemple.fr', maintenant: MAINTENANT },
      ports,
    )

    expect(resultat.ok).toBe(false)
    if (!resultat.ok) expect(resultat.motif).toBe('produit_inconnu')
  })

  it('refuse si l’origine n’est pas autorisée', async () => {
    const ports = creerBouchon()
    const resultat = await releverReponsesCollaborateur(
      { cle: 'fdy_pub_test', identite: null, origine: 'https://pirate.exemple.com', maintenant: MAINTENANT },
      ports,
    )

    expect(resultat.ok).toBe(false)
    if (!resultat.ok) expect(resultat.motif).toBe('origine_refusee')
  })

  it('⛔ rend une liste vide (ok: true) si l’identité est absente — un anonyme ne casse rien', async () => {
    const ports = creerBouchon({
      reponses: [
        {
          id: 'ret_1',
          titre: 'Bug',
          statut: 'traite',
          reponseTexte: 'Corrigé',
          reponseEnvoyeeLe: '2026-09-07T10:00:00.000Z',
        },
      ],
    })
    const resultat = await releverReponsesCollaborateur(
      { cle: 'fdy_pub_test', identite: null, origine: 'https://app.exemple.fr', maintenant: MAINTENANT },
      ports,
    )

    expect(resultat).toEqual({ ok: true, retours: [] })
    expect(ports.depot.releverReponses).not.toHaveBeenCalled()
  })

  it('⛔ rend une liste vide si l’identité est expirée ou la signature fausse', async () => {
    const ports = creerBouchon()
    const jetonExpire = jetonValide('usr_42', Math.floor(MAINTENANT / 1_000) - 60)
    const resultatExpire = await releverReponsesCollaborateur(
      { cle: 'fdy_pub_test', identite: jetonExpire, origine: 'https://app.exemple.fr', maintenant: MAINTENANT },
      ports,
    )

    expect(resultatExpire).toEqual({ ok: true, retours: [] })

    const jetonFaux = `${jetonValide('usr_42')}_altere`
    const resultatFaux = await releverReponsesCollaborateur(
      { cle: 'fdy_pub_test', identite: jetonFaux, origine: 'https://app.exemple.fr', maintenant: MAINTENANT },
      ports,
    )

    expect(resultatFaux).toEqual({ ok: true, retours: [] })
  })

  it('relève les réponses destinées au collaborateur quand l’identité est valide', async () => {
    const reponsesAttendues = [
      {
        id: 'ret_1',
        titre: 'Problème de tri',
        statut: 'traite',
        reponseTexte: 'Corrigé en version 2.1',
        reponseEnvoyeeLe: '2026-09-07T10:00:00.000Z',
      },
    ]
    const ports = creerBouchon({ reponses: reponsesAttendues })
    const resultat = await releverReponsesCollaborateur(
      { cle: 'fdy_pub_test', identite: jetonValide('usr_42'), origine: 'https://app.exemple.fr', maintenant: MAINTENANT },
      ports,
    )

    expect(resultat).toEqual({ ok: true, retours: reponsesAttendues })
    expect(ports.depot.releverReponses).toHaveBeenCalledWith('prd_1', 'usr_42')
  })
})

describe('accuserReceptionCollaborateur', () => {
  it('refuse si l’identité est absente ou invalide', async () => {
    const ports = creerBouchon()
    const resultat = await accuserReceptionCollaborateur(
      { retourId: 'ret_1', cle: 'fdy_pub_test', identite: null, origine: 'https://app.exemple.fr', maintenant: MAINTENANT },
      ports,
    )

    expect(resultat).toEqual({
      ok: false,
      motif: 'identite_invalide',
      message: 'L’identité signée est absente ou invalide.',
    })
  })

  it('refuse si le retour n’existe pas pour ce produit', async () => {
    const ports = creerBouchon({ auteurRef: null })
    const resultat = await accuserReceptionCollaborateur(
      {
        retourId: 'ret_inconnu',
        cle: 'fdy_pub_test',
        identite: jetonValide('usr_42'),
        origine: 'https://app.exemple.fr',
        maintenant: MAINTENANT,
      },
      ports,
    )

    expect(resultat).toEqual({
      ok: false,
      motif: 'retour_inconnu',
      message: 'Ce retour n’existe pas pour ce produit.',
    })
  })

  it('⛔ refuse si l’auteur du retour n’est pas le titulaire de l’identité signée', async () => {
    const ports = creerBouchon({ auteurRef: 'usr_victime' })
    const resultat = await accuserReceptionCollaborateur(
      {
        retourId: 'ret_1',
        cle: 'fdy_pub_test',
        identite: jetonValide('usr_imposteur'),
        origine: 'https://app.exemple.fr',
        maintenant: MAINTENANT,
      },
      ports,
    )

    expect(resultat).toEqual({
      ok: false,
      motif: 'auteur_refuse',
      message: 'Vous n’êtes pas l’auteur de ce retour.',
    })
    expect(ports.depot.accuserReception).not.toHaveBeenCalled()
  })

  it('accuse réception quand l’identité correspond au retour', async () => {
    const ports = creerBouchon({ auteurRef: 'usr_42' })
    const resultat = await accuserReceptionCollaborateur(
      {
        retourId: 'ret_1',
        cle: 'fdy_pub_test',
        identite: jetonValide('usr_42'),
        origine: 'https://app.exemple.fr',
        maintenant: MAINTENANT,
      },
      ports,
    )

    expect(resultat).toEqual({ ok: true })
    expect(ports.depot.accuserReception).toHaveBeenCalledWith('ret_1', new Date(MAINTENANT))
  })

  it('est idempotent : accuser deux fois ne provoque pas de rupture', async () => {
    const ports = creerBouchon({ auteurRef: 'usr_42' })
    const params = {
      retourId: 'ret_1',
      cle: 'fdy_pub_test',
      identite: jetonValide('usr_42'),
      origine: 'https://app.exemple.fr',
      maintenant: MAINTENANT,
    }

    const r1 = await accuserReceptionCollaborateur(params, ports)
    const r2 = await accuserReceptionCollaborateur(params, ports)

    expect(r1).toEqual({ ok: true })
    expect(r2).toEqual({ ok: true })
    expect(ports.depot.accuserReception).toHaveBeenCalledTimes(2)
  })
})

/**
 * ⛔ La règle des versions, tenue — le widget `1.0.0` contre le serveur d’aujourd’hui.
 *
 * ⚠️ POURQUOI ([T-012], P-030). `widget.js` est gardé un jour en
 *    `stale-while-revalidate`, et un onglet de logiciel métier reste ouvert
 *    toute la journée : après une mise à jour du serveur, le widget d’hier
 *    continue d’envoyer et de lire. Deux sens, deux moitiés de ce fichier :
 *    - ce qu’envoie `1.0.0` est ACCEPTÉ, et RIEN n’en est retiré en silence ;
 *    - ce que le serveur rend aujourd’hui est LU par `1.0.0`.
 *
 * ⛔ Les corps et les lecteurs de `1.0.0` sont écrits à la main et figés
 *    (`tests/versions/widget-1.0.0.ts`). Les réponses, elles, viennent du code
 *    de production : les enveloppes des routes, `jouerTour`, le dépôt de relève.
 *    Un renommage de champ fait rougir ce fichier ; c’est son travail.
 *
 * ⛔ Hors ligne, sans base : le modèle et le bassin sont des bouchons.
 */
import { describe, expect, it } from 'vitest'

import {
  analyserCorpsFin,
  analyserCorpsRetour,
  analyserCorpsTour,
} from '../../../../../packages/widget/src/contrat'
import {
  CORPS_ENVOYES,
  lireMessageErreur,
  lireReponses,
  lireRetourCree,
  lireTour,
} from '../../../../../tests/versions/widget-1.0.0'
import { modeleBouchon } from '../../../domaine/entretien/modele'
import type { PortsTour } from '../../../domaine/entretien/tour'
import { jouerTour } from '../../../domaine/entretien/tour'
import type { Bassin } from '../../../infra/base/depot-retours'
import { creerDepotCollaborateur } from '../../../infra/base/depot-collaborateur'

import { enveloppes } from './_reponses'

/** Ce que le transport fait subir à un corps : JSON aller-retour. */
function transporte(valeur: unknown): unknown {
  return JSON.parse(JSON.stringify(valeur))
}

describe('⛔ ce qu’envoie le widget 1.0.0 est accepté — et rien n’en est retiré', () => {
  it.each(Object.entries(CORPS_ENVOYES.retour))('POST /api/retours — %s', (_cas, corps) => {
    const analyse = analyserCorpsRetour(transporte(corps))

    expect(analyse.ok, analyse.ok ? '' : analyse.message).toBe(true)
    // ⚠️ Accepté ne suffit pas : depuis P-030, un champ inconnu est RETIRÉ. Un
    //    champ de 1.0.0 renommé côté serveur disparaîtrait donc sans un mot.
    expect(analyse.ok && analyse.valeur).toEqual(corps)
  })

  it.each(Object.entries(CORPS_ENVOYES.tour))('POST /api/retours/:id/tour — %s', (_cas, corps) => {
    const analyse = analyserCorpsTour(transporte(corps))

    expect(analyse.ok, analyse.ok ? '' : analyse.message).toBe(true)
    expect(analyse.ok && analyse.valeur).toEqual(corps)
  })

  it.each(Object.entries(CORPS_ENVOYES.fin))('POST /api/retours/:id/fin — %s', (_cas, corps) => {
    const analyse = analyserCorpsFin(transporte(corps))

    expect(analyse.ok, analyse.ok ? '' : analyse.message).toBe(true)
    expect(analyse.ok && analyse.valeur).toEqual(corps)
  })
})

describe('⛔ ce que le serveur rend aujourd’hui est lu par le widget 1.0.0', () => {
  it('201 — l’identifiant du retour', () => {
    expect(lireRetourCree(transporte(enveloppes.retourCree('ret_compat')))).toBe('ret_compat')
  })

  it('un refus — le message, que 1.0.0 affiche tel quel', () => {
    const corps = transporte(enveloppes.erreur('debit_depasse', 'Trop de retours d’un coup.'))
    expect(lireMessageErreur(corps)).toBe('Trop de retours d’un coup.')
  })

  it('un tour — la carte, la question, et l’axe', async () => {
    const ports: PortsTour = {
      depot: {
        charger: async () => ({
          statut: 'en_cours',
          contexte: { url: 'https://pistache.exemple.fr/bordereaux' },
          fil: [{ role: 'collaborateur', texte: 'la page revient en haut quand je valide' }],
          prochainOrdre: 1,
        }),
        ecrire: async () => undefined,
        clore: async () => undefined,
      },
      produits: {
        produitParCle: async () => ({
          id: 'prod_1',
          domaine: 'pistache.exemple.fr',
          actif: true,
          secret: null,
          contexteMetier: null,
        }),
      },
      modele: modeleBouchon({
        tours: [
          {
            comprehension: {
              type: 'bug',
              titre: 'La validation du bordereau renvoie en haut de page',
              resume: 'Après validation, la page remonte.',
              // ⚠️ Pas de `recurrence` : la carte la connaîtrait déjà, et le
              //    serveur retirerait l’axe — on ne demande pas ce qu’on sait.
            },
            question: 'Est-ce que ça arrive à chaque validation ?',
            axe: 'recurrence',
            motif: 'La récurrence change ce qu’un développeur ferait.',
          },
        ],
      }),
      debitParCle: { autoriser: () => true },
      debitParIp: { autoriser: () => true },
      maintenant: () => 0,
    }

    const resultat = await jouerTour({ retourId: 'ret_1', cle: 'fdy_pub_compat', origine: null, ip: '10.0.0.1' }, ports)
    expect(resultat.ok).toBe(true)
    if (!resultat.ok) return

    const lu = lireTour(transporte(resultat.tour))

    expect(lu).toEqual({
      comprehension: {
        type: 'bug',
        titre: 'La validation du bordereau renvoie en haut de page',
        resume: 'Après validation, la page remonte.',
      },
      question: 'Est-ce que ça arrive à chaque validation ?',
      axe: 'recurrence',
    })
  })

  it('la relève des réponses — chaque entrée est gardée, pas jetée', async () => {
    // ⚠️ Le vrai dépôt, sur un bassin qui rend deux lignes : c’est SA
    //    transformation qui produit ce que la route renvoie.
    const bassin: Bassin = {
      connect: async () =>
        ({
          query: async () => ({
            rows: [
              {
                id: 'ret_a',
                titre: 'Le tri se réinitialise',
                statut: 'traite',
                reponse_texte: 'Corrigé dans la version de ce matin',
                reponse_envoyee_le: new Date('2026-09-15T08:00:00.000Z'),
              },
              {
                id: 'ret_b',
                titre: null,
                statut: 'ecarte',
                reponse_texte: null,
                reponse_envoyee_le: new Date('2026-09-16T08:00:00.000Z'),
              },
            ],
          }),
          release: () => undefined,
        }) as unknown as Awaited<ReturnType<Bassin['connect']>>,
    }

    const retours = await creerDepotCollaborateur(bassin).releverReponses('prod_1', 'u-1')
    const lu = lireReponses(transporte(enveloppes.reponses(retours)))

    expect(lu.map((ligne) => ligne.id)).toEqual(['ret_a', 'ret_b'])
    expect(lu[0]).toEqual({ id: 'ret_a', statut: 'traite', reponseEnvoyeeLe: '2026-09-15T08:00:00.000Z' })
  })

  it('la fin et l’accusé — 1.0.0 ne lit que le statut, et les enveloppes restent des objets', () => {
    expect(transporte(enveloppes.finRendue('envoye'))).toEqual({ statut: 'envoye' })
    expect(transporte(enveloppes.accuse())).toEqual({ ok: true })
  })
})

describe('l’autre sens — un widget plus récent qu’un serveur revenu en arrière', () => {
  it('⚠️ un champ d’enveloppe inconnu est retiré, et le retour passe', () => {
    const analyse = analyserCorpsRetour({
      ...CORPS_ENVOYES.retour.ecrit,
      champNouveau: 'demain',
      contexte: { ...CORPS_ENVOYES.retour.ecrit.contexte, autreChampNouveau: 1 },
    })

    expect(analyse.ok).toBe(true)
  })

  it('⛔ un indice qui gagne un champ refuse le corps — c’est le widget qui renvoie la parole sans indices', () => {
    const analyse = analyserCorpsRetour({
      ...CORPS_ENVOYES.retour.ecrit,
      contexte: {
        ...CORPS_ENVOYES.retour.ecrit.contexte,
        indices: [{ genre: 'js', nom: 'TypeError', colonne: 12 }],
      },
    })

    expect(analyse.ok).toBe(false)
  })
})

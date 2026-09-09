/**
 * Le contrat de transport.
 *
 * ⛔ Le bloc « la liste est close » n’est pas décoratif : c’est lui qui rougit le
 *    jour où quelqu’un ajoutera un champ au contexte sans passer par
 *    01-Specs/widget.md. Le dépôt est public, la liste doit pouvoir être lue par
 *    n’importe qui sans gêne.
 */
import { describe, expect, it } from 'vitest'

import { BORNES, analyserCorpsRetour, analyserCorpsTour } from './contrat'

const CONTEXTE = { url: 'https://victoria.exemple.fr/dossiers' }

describe('analyserCorpsRetour', () => {
  it('accepte du texte seul', () => {
    const resultat = analyserCorpsRetour({ texte: 'le tri se remet à zéro', contexte: CONTEXTE })

    expect(resultat.ok).toBe(true)
  })

  it('accepte de l’audio seul — ⛔ le serveur ne suppose jamais une transcription côté client', () => {
    const resultat = analyserCorpsRetour({
      audio: { type: 'audio/webm', donnees: 'AAAA' },
      contexte: CONTEXTE,
    })

    expect(resultat.ok).toBe(true)
  })

  it('accepte les deux ensemble', () => {
    const resultat = analyserCorpsRetour({
      texte: 'le tri se remet à zéro',
      audio: { type: 'audio/webm', donnees: 'AAAA' },
      contexte: CONTEXTE,
    })

    expect(resultat.ok).toBe(true)
  })

  it.each([
    ['ni texte ni audio', { contexte: CONTEXTE }],
    ['un texte qui n’est que des espaces', { texte: '   ', contexte: CONTEXTE }],
    ['pas de contexte', { texte: 'ça casse' }],
    ['pas d’URL', { texte: 'ça casse', contexte: {} }],
    ['un type d’audio hors liste', { audio: { type: 'audio/aiff', donnees: 'A' }, contexte: CONTEXTE }],
    [
      'une capture hors liste',
      { texte: 'x', contexte: { ...CONTEXTE, capture: { type: 'image/gif', donnees: 'A' } } },
    ],
  ])('refuse %s', (_cas, corps) => {
    expect(analyserCorpsRetour(corps).ok).toBe(false)
  })

  it('⛔ refuse un champ de contexte qui n’est pas dans la liste close', () => {
    const resultat = analyserCorpsRetour({
      texte: 'x',
      contexte: { ...CONTEXTE, presse_papier: 'IBAN FR76…' },
    })

    expect(resultat.ok).toBe(false)
  })

  it('⛔ refuse un champ de corps qui n’est pas dans la liste close', () => {
    const resultat = analyserCorpsRetour({
      texte: 'x',
      cookies: 'session=…',
      contexte: CONTEXTE,
    })

    expect(resultat.ok).toBe(false)
  })

  it('refuse un texte au-delà de la borne', () => {
    const resultat = analyserCorpsRetour({
      texte: 'a'.repeat(BORNES.texte + 1),
      contexte: CONTEXTE,
    })

    expect(resultat.ok).toBe(false)
  })

  it('rend un message qui désigne le champ fautif, en français', () => {
    const resultat = analyserCorpsRetour({ texte: 'x', contexte: { url: '' } })

    expect(resultat.ok).toBe(false)
    if (!resultat.ok) expect(resultat.message).toContain('contexte.url')
  })

  it('accepte le contexte complet et le rend tel quel', () => {
    const contexte = {
      url: 'https://victoria.exemple.fr/dossiers?tri=date',
      titrePage: 'Dossiers',
      ecran: 'dossiers',
      situation: 'Validation de quittance',
      selecteurDom: 'table.dossiers th:nth-child(3)',
      navigateur: 'Chrome 141',
      systeme: 'Windows 11',
      viewportL: 1920,
      viewportH: 1080,
      fuseau: 'Europe/Paris',
      horodatage: '2026-09-04T11:32:00.000Z',
      agentBrut: { langue: 'fr-FR' },
      capture: { type: 'image/webp' as const, donnees: 'AAAA' },
    }

    const resultat = analyserCorpsRetour({ texte: 'x', source: 'voix', contexte })

    expect(resultat.ok).toBe(true)
    if (resultat.ok) expect(resultat.valeur.contexte).toEqual(contexte)
  })

  it('refuse une situation qui dépasse la borne de 120 caractères', () => {
    const resultat = analyserCorpsRetour({
      texte: 'x',
      contexte: { ...CONTEXTE, situation: 'a'.repeat(BORNES.situation + 1) },
    })

    expect(resultat.ok).toBe(false)
  })
})

describe('⛔ analyserCorpsTour — l’axe et sa valeur vont ensemble (D-025)', () => {
  it('accepte une paire cohérente', () => {
    expect(analyserCorpsTour({ axe: 'recurrence', valeurAxe: 'systematique' }).ok).toBe(true)
  })

  it('accepte un tour sans axe — le cas ordinaire', () => {
    expect(analyserCorpsTour({ texte: 'et c’est tous les jours' }).ok).toBe(true)
  })

  it.each([
    ['un axe sans valeur', { axe: 'recurrence' }],
    ['une valeur sans axe', { valeurAxe: 'systematique' }],
    ['la valeur d’un autre axe', { axe: 'recurrence', valeurAxe: 'bloque' }],
    ['une valeur inventée', { axe: 'ampleur', valeurAxe: 'catastrophique' }],
    // ⚠️ `indetermine` est l’aveu du modèle dans la note, jamais une réponse
    //    que quelqu’un donne : il n’est pas proposable, donc pas recevable.
    ['l’aveu du modèle', { axe: 'ampleur', valeurAxe: 'indetermine' }],
    ['un axe inconnu', { axe: 'gravite', valeurAxe: 'haute' }],
  ])('refuse %s', (_cas, corps) => {
    expect(analyserCorpsTour(corps).ok).toBe(false)
  })

  it('⛔ refuse un libellé à la place d’une valeur — ce qui voyage est la valeur', () => {
    expect(analyserCorpsTour({ axe: 'recurrence', valeurAxe: 'À chaque fois' }).ok).toBe(false)
  })
})

/**
 * ⛔ LE CONTRAT EST CE QUI BORNE RÉELLEMENT, PARCE QUE C’EST LE SERVEUR QUI
 *    L’APPLIQUE. Le widget en garde trois de son côté par politesse ; un widget
 *    forgé, lui, ne passe que par ici — même raisonnement que la limite de deux
 *    relances, qui n’est pas confiée au navigateur (D-006, D-026).
 */
describe('les indices techniques (P-028)', () => {
  const avec = (indices: unknown) =>
    analyserCorpsRetour({ texte: 'le tri se remet à zéro', contexte: { ...CONTEXTE, indices } })

  it('accepte un relevé complet', () => {
    const resultat = avec([
      { genre: 'http', statut: 500, chemin: '/api/dossiers/:id/valider', methode: 'POST', ecartMs: 3_000 },
      { genre: 'js', nom: 'TypeError', trame: 'valider (app.js:12:34)', reference: 'a1b2c3' },
    ])

    expect(resultat.ok).toBe(true)
  })

  it('accepte l’absence — la collecte est en échec-doux, et l’hôte peut refuser', () => {
    expect(avec(undefined).ok).toBe(true)
    expect(avec([]).ok).toBe(true)
  })

  it('⛔ refuse au-delà de trois : un retour n’est pas un déversoir de journal', () => {
    const un = { genre: 'js', nom: 'TypeError' }

    expect(avec([un, un, un]).ok).toBe(true)
    expect(avec([un, un, un, un]).ok).toBe(false)
  })

  /**
   * ⛔ LE TEST QUI TIENT D-026. `error.message` est du texte libre écrit par le
   *    code de l’hôte ; il porte des noms de personnes et de dossiers, et le
   *    dépôt est public. `.strict()` fait que le champ n’est pas ignoré : il
   *    fait REFUSER le retour entier, en 400. La règle n’est pas une intention.
   */
  it('⛔ refuse tout champ `message` — il n’y a pas de place pour un message', () => {
    const resultat = avec([
      { genre: 'js', nom: 'TypeError', message: 'Le dossier de M. Dupont est verrouillé' },
    ])

    expect(resultat.ok).toBe(false)
  })

  it('⛔ refuse un genre inventé', () => {
    expect(avec([{ genre: 'console', nom: 'X' }]).ok).toBe(false)
  })

  it('⛔ refuse un js sans nom, et un http sans statut ou sans chemin', () => {
    expect(avec([{ genre: 'js' }]).ok).toBe(false)
    expect(avec([{ genre: 'js', trame: 'f (a.js:1:1)' }]).ok).toBe(false)
    expect(avec([{ genre: 'http', statut: 500 }]).ok).toBe(false)
    expect(avec([{ genre: 'http', chemin: '/api' }]).ok).toBe(false)
  })

  it('⛔ refuse un statut hors de la plage HTTP', () => {
    expect(avec([{ genre: 'http', statut: 99, chemin: '/api' }]).ok).toBe(false)
    expect(avec([{ genre: 'http', statut: 600, chemin: '/api' }]).ok).toBe(false)
  })

  it('⛔ refuse ce qui dépasse les bornes', () => {
    expect(avec([{ genre: 'js', nom: 'X'.repeat(BORNES.indiceNom + 1) }]).ok).toBe(false)
    expect(
      avec([{ genre: 'js', nom: 'X', trame: 'y'.repeat(BORNES.indiceTrame + 1) }]).ok,
    ).toBe(false)
    expect(
      avec([{ genre: 'js', nom: 'X', reference: 'r'.repeat(BORNES.indiceReference + 1) }]).ok,
    ).toBe(false)
    expect(
      avec([{ genre: 'js', nom: 'X', ecartMs: BORNES.indiceEcartMs + 1 }]).ok,
    ).toBe(false)
  })

  it('⛔ refuse un écart négatif ou fractionnaire', () => {
    expect(avec([{ genre: 'js', nom: 'X', ecartMs: -1 }]).ok).toBe(false)
    expect(avec([{ genre: 'js', nom: 'X', ecartMs: 1.5 }]).ok).toBe(false)
  })
})

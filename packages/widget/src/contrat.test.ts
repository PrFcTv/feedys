/**
 * Le contrat de transport.
 *
 * ⛔ Le bloc « la liste est close » n’est pas décoratif : c’est lui qui rougit le
 *    jour où quelqu’un ajoutera un champ au contexte sans passer par
 *    01-Specs/widget.md. Le dépôt est public, la liste doit pouvoir être lue par
 *    n’importe qui sans gêne.
 */
import { describe, expect, it } from 'vitest'

import { BORNES, analyserCorpsRetour } from './contrat'

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
})

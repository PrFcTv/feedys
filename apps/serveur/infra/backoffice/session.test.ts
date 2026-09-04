/**
 * La session du back-office — un mot de passe, un jeton signé.
 *
 * ⚠️ Test pur : il pose la variable d’environnement lui-même, sans base ni
 *    réseau. ⛔ Le mot de passe est INVENTÉ, comme tout ce qui entre dans ce
 *    dépôt public.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { creerJeton, DUREE_SESSION, jetonValide, motDePasseValide } from './session'

const MOT_DE_PASSE = 'ceci-est-un-mot-de-passe-de-test'
const MAINTENANT = Date.parse('2026-09-04T12:00:00.000Z')

let avant: string | undefined

beforeEach(() => {
  avant = process.env['FEEDYS_BO_MOT_DE_PASSE']
  process.env['FEEDYS_BO_MOT_DE_PASSE'] = MOT_DE_PASSE
})

afterEach(() => {
  if (avant === undefined) delete process.env['FEEDYS_BO_MOT_DE_PASSE']
  else process.env['FEEDYS_BO_MOT_DE_PASSE'] = avant
})

describe('le mot de passe', () => {
  it('accepte le bon, refuse les autres', () => {
    expect(motDePasseValide(MOT_DE_PASSE)).toBe(true)
    expect(motDePasseValide('autre chose')).toBe(false)
    expect(motDePasseValide('')).toBe(false)
    // ⚠️ Un préfixe correct ne passe pas : la comparaison est de longueur fixe.
    expect(motDePasseValide(MOT_DE_PASSE.slice(0, -1))).toBe(false)
  })

  it('⛔ refuse tout quand le back-office n’est pas configuré', () => {
    delete process.env['FEEDYS_BO_MOT_DE_PASSE']
    expect(motDePasseValide('')).toBe(false)
    expect(motDePasseValide(MOT_DE_PASSE)).toBe(false)
    expect(creerJeton(MAINTENANT)).toBeUndefined()
  })
})

describe('le jeton', () => {
  it('se vérifie lui-même', () => {
    const jeton = creerJeton(MAINTENANT)
    expect(jeton).toBeDefined()
    expect(jetonValide(jeton, MAINTENANT)).toBe(true)
  })

  it('expire', () => {
    const jeton = creerJeton(MAINTENANT)
    expect(jetonValide(jeton, MAINTENANT + DUREE_SESSION - 1)).toBe(true)
    expect(jetonValide(jeton, MAINTENANT + DUREE_SESSION + 1)).toBe(false)
  })

  it('⛔ ne se laisse pas repousser : la date est signée avec le reste', () => {
    const jeton = creerJeton(MAINTENANT) ?? ''
    const repousse = `${MAINTENANT + 10 * DUREE_SESSION}.${jeton.split('.')[1]}`
    expect(jetonValide(repousse, MAINTENANT)).toBe(false)
  })

  it('refuse ce qui n’est pas un jeton', () => {
    expect(jetonValide(undefined, MAINTENANT)).toBe(false)
    expect(jetonValide('', MAINTENANT)).toBe(false)
    expect(jetonValide('.abc', MAINTENANT)).toBe(false)
    expect(jetonValide('pasunnombre.abc', MAINTENANT)).toBe(false)
    expect(jetonValide('1799999999999', MAINTENANT)).toBe(false)
  })

  it('⚠️ changer le mot de passe invalide les sessions ouvertes', () => {
    const jeton = creerJeton(MAINTENANT)
    process.env['FEEDYS_BO_MOT_DE_PASSE'] = 'un-autre-mot-de-passe-de-test'
    expect(jetonValide(jeton, MAINTENANT)).toBe(false)
  })
})

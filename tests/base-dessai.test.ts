/**
 * ⚠️ Le garde-fou du garde-fou. Ce fichier existe pour qu’on ne réintroduise
 *    jamais le repli vers `localhost:5432` (03-Bugs/BUGS_LOG.md 006).
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { urlBaseDessai } from './base-dessai'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

describe('urlBaseDessai', () => {
  const avant = process.env['DATABASE_URL']

  beforeEach(() => {
    delete process.env['DATABASE_URL']
  })

  afterEach(() => {
    if (avant === undefined) delete process.env['DATABASE_URL']
    else process.env['DATABASE_URL'] = avant
  })

  it('rend l’URL quand elle est là', () => {
    process.env['DATABASE_URL'] = 'postgresql://feedys:feedys@localhost:5434/feedys'
    expect(urlBaseDessai()).toBe('postgresql://feedys:feedys@localhost:5434/feedys')
  })

  it('⛔ échoue plutôt que de deviner un hôte', () => {
    expect(() => urlBaseDessai()).toThrow(/DATABASE_URL est absente/)
  })

  it('⛔ une variable vide ne vaut pas une variable', () => {
    process.env['DATABASE_URL'] = '   '
    expect(() => urlBaseDessai()).toThrow(/DATABASE_URL est absente/)
  })

  it('le message dit quoi faire, et prévient sur le port', () => {
    let message = ''
    try {
      urlBaseDessai()
    } catch (erreur) {
      message = erreur instanceof Error ? erreur.message : String(erreur)
    }

    expect(message).toContain('.env.local')
    expect(message).toContain('FEEDYS_PORT_PG')
  })
})

/**
 * ⛔ Le vrai garde-fou : plus AUCUN fichier de test ne porte le repli.
 *
 * ⚠️ Il regarde le texte des fichiers, et c’est voulu : le défaut n’était pas
 *    une valeur fausse, c’était une ligne recopiée huit fois.
 */
describe('⛔ aucun repli vers un Postgres deviné', () => {
  const FICHIERS = [
    'apps/serveur/app/api/mcp/route.integration.test.ts',
    'apps/serveur/app/api/retours/route.integration.test.ts',
    'apps/serveur/domaine/entretien/tour.integration.test.ts',
    'apps/serveur/domaine/notification/envoyer.integration.test.ts',
    'apps/serveur/domaine/synthese/produire.integration.test.ts',
    'apps/serveur/infra/base/depot-bo.integration.test.ts',
    'apps/serveur/domaine/entretien/balayage.integration.test.ts',
    'apps/serveur/infra/base/migrations.integration.test.ts',
    'apps/serveur/infra/base/roles.integration.test.ts',
    'playwright.config.ts',
  ]

  it.each(FICHIERS)('%s ne devine aucune base', (relatif) => {
    const source = readFileSync(path.join(RACINE, relatif), 'utf8')

    expect(source).not.toMatch(/DATABASE_URL'?\]?\s*\?\?/)
    expect(source).not.toContain('localhost:5432')
  })
})

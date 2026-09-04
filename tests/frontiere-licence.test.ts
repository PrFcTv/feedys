/**
 * ⛔ La preuve que la frontière de licence est tenue par le lint.
 *
 * « C’est l’invariant le plus fragile du projet : il ne casse jamais bruyamment.
 *   Rien n’avertit, aucun test ne rougit, et on peut vivre des mois du mauvais
 *   côté sans le savoir. » — 04-Architecture/licences.md
 *
 * Ce fichier est le « rien n’avertit » en moins. Il ne relit pas la configuration :
 * il fait tourner ESLint sur du code fautif et vérifie qu’il rougit, puis sur du
 * code légitime et vérifie qu’il se tait.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { ESLint, type Linter } from 'eslint'
import { beforeAll, describe, expect, it } from 'vitest'

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

let eslint: ESLint

beforeAll(() => {
  eslint = new ESLint({ cwd: racine })
})

/** Fait tourner ESLint sur du code qui n’a pas besoin d’exister sur le disque. */
async function frontiere(code: string, chemin: string): Promise<Linter.LintMessage[]> {
  const [resultat] = await eslint.lintText(code, {
    filePath: path.join(racine, chemin),
    warnIgnored: false,
  })
  return (resultat?.messages ?? []).filter((m) => m.ruleId === 'no-restricted-imports')
}

const FORMES_AGPL = [
  '../../../apps/serveur/domaine/retours',
  '../../../../apps/serveur/domaine/entretien/modele',
  'apps/serveur/domaine/retours',
  '@feedys/serveur',
  '@feedys/serveur/domaine/retours',
]

describe('la frontière AGPL / MIT', () => {
  describe.each(['packages/widget/src/fautif.ts', 'packages/mcp/src/fautif.ts'])(
    '%s',
    (chemin) => {
      it.each(FORMES_AGPL)('refuse d’importer « %s »', async (source) => {
        const messages = await frontiere(`import { x } from '${source}'\nexport const y = x\n`, chemin)

        expect(messages).toHaveLength(1)
        expect(messages[0]?.severity).toBe(2)
        expect(messages[0]?.message).toContain('Frontière de licence')
        expect(messages[0]?.message).toContain('04-Architecture/licences.md')
      })

      it('refuse aussi un import de TYPE — un type traverse la frontière comme le reste', async () => {
        const messages = await frontiere(
          `import type { Retour } from '../../../apps/serveur/domaine/retours'\nexport type R = Retour\n`,
          chemin,
        )

        expect(messages).toHaveLength(1)
        expect(messages[0]?.message).toContain('04-Architecture/licences.md')
      })

      it('laisse passer une dépendance ordinaire', async () => {
        const messages = await frontiere(`import { h } from 'preact'\nexport const x = h\n`, chemin)

        expect(messages).toEqual([])
      })
    },
  )

  it('laisse apps/serveur importer le contrat du widget — c’est le sens légitime', async () => {
    const messages = await frontiere(
      `import type { Contrat } from '../../../packages/widget/src/contrat'\nexport type C = Contrat\n`,
      'apps/serveur/domaine/exemple.ts',
    )

    expect(messages).toEqual([])
  })

  it('ne s’applique pas à la racine, qui est AGPL comme le serveur', async () => {
    const messages = await frontiere(
      `import { x } from './apps/serveur/domaine/retours'\nexport const y = x\n`,
      'outil.ts',
    )

    expect(messages).toEqual([])
  })
})

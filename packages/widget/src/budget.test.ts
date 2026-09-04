/**
 * ⛔ Le garde-fou du budget de 60 Ko gzip.
 *
 * Il ne casse jamais bruyamment : personne ne remarque qu’un bundle a triplé,
 * et on peut vivre des mois du mauvais côté. Ce fichier est le « rien
 * n’avertit » en moins, comme `tests/frontiere-licence.test.ts` l’est pour la
 * frontière de licence.
 *
 * Ce qu’il vérifie : **aucun module du widget n’importe une VALEUR depuis
 * `contrat.ts`**. `contrat.ts` importe zod ; une seule valeur importée de lui
 * fait entrer zod entier dans `widget.js`. Constaté le 2026-09-04 en écrivant
 * P-004 : `import { BORNES } from '../contrat'` a fait passer le bundle de
 * 0,1 Ko à 26 Ko gzip, pour trois nombres.
 *
 * Les valeurs vivent donc dans `transport.ts`, qui ne dépend de rien.
 * `contrat.ts` n’est atteignable qu’en `import type`, effacé à la compilation.
 */
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const SRC = path.dirname(fileURLToPath(import.meta.url))

/** ⚠️ Les tests ne sont pas empaquetés : la règle ne les concerne pas. */
const HORS_BUNDLE = /\.test\.tsx?$/

/** `contrat.ts` a évidemment le droit d’importer zod : c’est son travail. */
const CONTRAT = 'contrat.ts'

/** `import … from '…/contrat'` — mais pas `import type … from '…/contrat'`. */
const IMPORT_VALEUR_CONTRAT = /^\s*import\s+(?!type\s)[^;]*?from\s+['"][^'"]*\/contrat['"]/gm

/** N’importe quel import de zod, de type ou non. */
const IMPORT_ZOD = /^\s*import\s[^;]*?from\s+['"]zod['"]/gm

async function sources(dossier: string): Promise<string[]> {
  const entrees = await readdir(dossier, { withFileTypes: true })

  const trouvees = await Promise.all(
    entrees.map(async (entree) => {
      const complet = path.join(dossier, entree.name)
      if (entree.isDirectory()) return sources(complet)
      if (!entree.name.endsWith('.ts') && !entree.name.endsWith('.tsx')) return []
      if (HORS_BUNDLE.test(entree.name)) return []
      return [complet]
    }),
  )

  return trouvees.flat()
}

describe('⛔ zod n’entre pas dans widget.js', () => {
  it('trouve bien des sources à examiner — sinon ce fichier ne prouve rien', async () => {
    expect((await sources(SRC)).length).toBeGreaterThan(5)
  })

  it('aucun module du widget n’importe une valeur depuis contrat.ts', async () => {
    const fautifs: string[] = []

    for (const fichier of await sources(SRC)) {
      if (path.basename(fichier) === CONTRAT) continue

      const code = await readFile(fichier, 'utf8')
      for (const ligne of code.match(IMPORT_VALEUR_CONTRAT) ?? []) {
        fautifs.push(`${path.relative(SRC, fichier)} — ${ligne.trim()}`)
      }
    }

    expect(
      fautifs,
      'Importer une VALEUR depuis contrat.ts fait entrer zod dans widget.js. ' +
        'Les constantes sont dans transport.ts ; contrat.ts ne s’importe qu’en « import type ».',
    ).toEqual([])
  })

  it('seul contrat.ts importe zod', async () => {
    const avecZod: string[] = []

    for (const fichier of await sources(SRC)) {
      const code = await readFile(fichier, 'utf8')
      if (IMPORT_ZOD.test(code)) avecZod.push(path.relative(SRC, fichier))
      IMPORT_ZOD.lastIndex = 0
    }

    expect(avecZod).toEqual([CONTRAT])
  })

  it('transport.ts ne dépend de rien — c’est toute sa raison d’être', async () => {
    const code = await readFile(path.join(SRC, 'transport.ts'), 'utf8')

    expect(code).not.toMatch(/^\s*import\s/m)
  })
})

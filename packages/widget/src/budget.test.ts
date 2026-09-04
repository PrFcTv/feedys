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
import { gzipSync } from 'node:zlib'

import { build } from 'vite'
import { describe, expect, it } from 'vitest'

const SRC = path.dirname(fileURLToPath(import.meta.url))

/** ⚠️ Les tests ne sont pas empaquetés : la règle ne les concerne pas. */
const HORS_BUNDLE = /\.test\.tsx?$/

/** `contrat.ts` a évidemment le droit d’importer zod : c’est son travail. */
const CONTRAT = 'contrat.ts'

/**
 * `import … from '…/contrat'` — mais pas `import type … from '…/contrat'`.
 *
 * ⚠️ La classe est tempérée : elle refuse de franchir un `from` ou un `import`.
 *    Le dépôt n’écrit pas de point-virgule, et un `[^;]*?` sautait donc d’une
 *    ligne d’import à la suivante — il accusait `import type … from
 *    '../contrat'` précédé d’un import quelconque. Constaté en écrivant P-005.
 */
const ENTRE_IMPORT_ET_FROM = String.raw`(?:(?!\bfrom\b|\bimport\b)[\s\S])*?`

const IMPORT_VALEUR_CONTRAT = new RegExp(
  String.raw`^\s*import\s+(?!type\s)${ENTRE_IMPORT_ET_FROM}from\s+['"][^'"]*/contrat['"]`,
  'gm',
)

/** N’importe quel import de zod, de type ou non. */
const IMPORT_ZOD = new RegExp(String.raw`^\s*import\s${ENTRE_IMPORT_ET_FROM}from\s+['"]zod['"]`, 'gm')

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

/**
 * ⛔ LE BUDGET LUI-MÊME : 60 Ko gzip pour `widget.js` (01-Specs/widget.md §4).
 *
 * Il est vérifié sur le bundle RÉEL, construit ici, et non sur `dist/` — qui est
 * ignoré par git et peut dater de trois semaines. Un budget vérifié sur un
 * artefact périmé ne vérifie rien.
 *
 * ⚠️ Un dépassement se tranche explicitement, jamais par glissement : c’est ce
 *    qui a sorti snapdom du bundle ([D-011]) plutôt que de relever le chiffre.
 */
describe('⛔ le bundle', () => {
  it(
    'tient sous 60 Ko gzip',
    async () => {
      const { code } = await construire()
      const gzip = gzipSync(Buffer.from(code, 'utf8')).byteLength

      expect(gzip, `widget.js pèse ${(gzip / 1024).toFixed(1)} Ko gzip`).toBeLessThanOrEqual(BUDGET)
    },
    60_000,
  )

  /**
   * ⛔ Rollup ne crée la variable globale d’un paquet IIFE que s’il y a des
   *    exports — et elle s’appellerait `feedys`, c’est-à-dire précisément
   *    l’objet où l’hôte a posé son jeton d’identité (D-005). Un `export`
   *    ajouté à `index.ts` l’écraserait sans un mot.
   */
  it(
    'ne déclare aucune globale : c’est le widget qui complète window.feedys',
    async () => {
      const { code } = await construire()

      expect(code).not.toMatch(/^\s*(?:var|let|const)\s+feedys\s*=/m)
      expect(code).toMatch(/feedys\s*=\s*\{\s*\.\.\./)
    },
    60_000,
  )

  it('n’expose aucun export depuis index.ts — c’est la cause, pas le symptôme', async () => {
    const code = await readFile(path.join(SRC, 'index.ts'), 'utf8')

    expect(code).not.toMatch(/^\s*export\s/m)
  })
})

/** 60 Ko gzip, en octets. */
const BUDGET = 60 * 1024

let construction: Promise<{ code: string }> | undefined

/**
 * Le peu qu’on lit d’une construction Vite.
 *
 * ⚠️ On ne prend pas les types de `rollup` : il n’est pas une dépendance
 *    déclarée du paquet, et l’emprunter au graphe de quelqu’un d’autre est
 *    précisément ce qui casse un jour sans prévenir.
 */
interface Morceau {
  readonly type: string
  readonly fileName: string
  readonly code?: string
}

/** ⚠️ Une seule construction pour tout le fichier : elle coûte quelques secondes. */
function construire(): Promise<{ code: string }> {
  construction ??= (async () => {
    const sortie = (await build({
      root: path.resolve(SRC, '..'),
      logLevel: 'silent',
      build: { write: false },
    })) as unknown as { readonly output: readonly Morceau[] } | readonly { readonly output: readonly Morceau[] }[]

    const paquets = Array.isArray(sortie) ? sortie : [sortie as { readonly output: readonly Morceau[] }]
    for (const paquet of paquets) {
      for (const morceau of paquet.output) {
        if (morceau.type === 'chunk' && morceau.fileName === 'widget.js' && morceau.code !== undefined) {
          return { code: morceau.code }
        }
      }
    }

    throw new Error('widget.js est absent de la construction')
  })()

  return construction
}

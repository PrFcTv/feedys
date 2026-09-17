/**
 * `pnpm outils:empaqueter` — les outils d’exploitation, en UN fichier chacun.
 *
 * ⛔ L’IMAGE N’A NI `pnpm`, NI `tsx`, NI LE DÉPÔT (hebergement.md §Construire et
 *    déployer). Un outil écrit en TypeScript et lancé par `pnpm` n’existe donc
 *    pas chez un client : `pnpm produit:creer` y était impossible, alors que
 *    sans produit il n’y a pas de clé, et sans clé pas de widget
 *    (03-Bugs/BUGS_LOG.md 020).
 *
 * D’où ce paquetage : chaque outil embarqué devient un `.mjs` AUTONOME — ses
 * dépendances (`pg`, `hash-wasm`, `cuid2`) sont dedans — que le conteneur lance
 * avec le `node` qu’il a déjà :
 *
 *   docker exec feedys node outils/creer-produit.mjs --nom … --domaine …
 *   kamal accessory exec feedys --reuse "node outils/creer-produit.mjs …"
 *
 * ⚠️ Autonome, et pas « résolu contre le `node_modules` du serveur autonome » :
 *    celui-là ne contient que ce que Next a tracé, et il changerait sous nos
 *    pieds au premier refactor du serveur. Le test d’intégration lance le
 *    fichier depuis un dossier SANS `node_modules` pour le prouver.
 *
 * ⛔ Un seul outil embarqué, exprès. `db:migrate` est inutile — le démarrage
 *    migre —, et `entretien:rejouer` est un outil de mise au point du prompt,
 *    qui n’a rien à faire sur le serveur d’un client.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { build } from 'esbuild'

const ICI = path.dirname(fileURLToPath(import.meta.url))

export const OUTILS_EMBARQUES = ['creer-produit'] as const

/** Là où `Dockerfile` vient les chercher. */
export const SORTIE_PAR_DEFAUT = path.join(ICI, 'dist')

/**
 * ⚠️ `pg` est un module CommonJS qui fait `require('events')`. Dans un bundle
 *    ESM, l’aide d’esbuild lève « Dynamic require is not supported » — sauf si
 *    un `require` existe déjà dans la portée, ce que cette en-tête fournit.
 *
 * ⚠️ ESM et non CommonJS : `creer-produit.ts` lit `import.meta.url`, qu’un
 *    bundle CommonJS remplace par un objet vide.
 */
const EN_TETE = [
  'import { createRequire as __feedysCreateRequire } from "node:module";',
  'const require = __feedysCreateRequire(import.meta.url);',
].join(' ')

export async function empaqueterOutils(sortie = SORTIE_PAR_DEFAUT): Promise<string[]> {
  await build({
    entryPoints: Object.fromEntries(
      OUTILS_EMBARQUES.map((nom) => [nom, path.join(ICI, `${nom}.ts`)]),
    ),
    outdir: sortie,
    outExtension: { '.js': '.mjs' },
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node24',
    banner: { js: EN_TETE },
    // ⚠️ `pg` ne le charge que si on lui demande le pilote natif, ce que
    //    personne ne fait. Externe, l’appel reste paresseux et n’échoue jamais.
    external: ['pg-native'],
    // ⛔ Les mentions de licence des dépendances embarquées restent dans le
    //    fichier : c’est la condition de MIT, pas une politesse.
    legalComments: 'eof',
    logLevel: 'warning',
  })

  return OUTILS_EMBARQUES.map((nom) => path.join(sortie, `${nom}.mjs`))
}

const lanceDirectement =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (lanceDirectement) {
  empaqueterOutils()
    .then((fichiers) => {
      for (const fichier of fichiers) console.log(`✅ ${path.relative(process.cwd(), fichier)}`)
    })
    .catch((erreur: unknown) => {
      process.exitCode = 1
      console.error(erreur instanceof Error ? `\n⛔ ${erreur.message}\n` : erreur)
    })
}

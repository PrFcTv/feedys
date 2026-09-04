import js from '@eslint/js'
import tseslint from 'typescript-eslint'

/**
 * ⛔ La frontière de licence.
 *
 * La racine et `apps/serveur` sont AGPL-3.0 ; `packages/widget` et `packages/mcp`
 * sont MIT. Recopier trois lignes d’AGPL dans un paquet MIT rend ce paquet AGPL,
 * et personne ne le remarque avant que quelqu’un l’intègre quelque part.
 *
 * Le sens de la dépendance est inversé par rapport à l’intuition : c’est
 * `apps/serveur` qui importe `packages/widget/src/contrat.ts`, jamais l’inverse.
 *
 * Source de vérité : 04-Architecture/licences.md
 */
export const MESSAGE_FRONTIERE_LICENCE =
  'Frontière de licence : un paquet MIT ne peut pas importer de code AGPL. ' +
  'Voir 04-Architecture/licences.md.'

/** Les formes sous lesquelles du code AGPL peut se présenter à un import. */
export const IMPORTS_AGPL = [
  '**/apps/serveur',
  '**/apps/serveur/**',
  '@feedys/serveur',
  '@feedys/serveur/**',
]

/** Les paquets sous licence MIT, à qui la frontière s’applique. */
export const PAQUETS_MIT = ['packages/widget/**', 'packages/mcp/**']

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/coverage/**',
      'prisma/genere/**',
      '**/playwright-report/**',
      '**/test-results/**',
      '**/next-env.d.ts',
    ],
  },

  js.configs.recommended,
  tseslint.configs.recommended,

  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  // ⛔ La frontière de licence. Ne pas assouplir sans lire 04-Architecture/licences.md.
  {
    files: PAQUETS_MIT,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [{ group: IMPORTS_AGPL, message: MESSAGE_FRONTIERE_LICENCE }],
        },
      ],
    },
  },
)

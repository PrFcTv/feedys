/**
 * Ce qu’on vérifie avant d’écouter — la partie qui se décide sans rien toucher.
 *
 * L’ordre et le sens sont dans 04-Architecture/hebergement.md §Le démarrage :
 * variables, base, migrations, empreintes, widget, puis écoute. ⛔ Un échec à
 * n’importe quelle étape empêche de servir.
 *
 * ⛔ Module pur : ni base, ni réseau, ni disque. Il prend un environnement et
 *    des nombres, il rend des verdicts. L’exécution vit dans
 *    `infra/demarrage.ts` (04-Architecture/architecture.md §3).
 */

/**
 * Les variables sans lesquelles Feedys ne peut pas faire son travail.
 *
 * ⛔ Absente ou vide : le conteneur refuse de démarrer. C’est délibérément plus
 *    dur qu’un avertissement — une variable oubliée se remarque au démarrage ou
 *    ne se remarque pas du tout, et alors elle se remarque chez les hôtes.
 */
export const VARIABLES_OBLIGATOIRES = [
  'DATABASE_URL',
  'FEEDYS_URL_PUBLIQUE',
  'ANTHROPIC_API_KEY',
  'FEEDYS_MODELE',
  'FEEDYS_BO_MOT_DE_PASSE',
  'FEEDYS_CLE_CHIFFREMENT',
  'FEEDYS_STOCKAGE',
  'FEEDYS_PROMPTS',
  'FEEDYS_ACTIFS',
] as const

/**
 * Celles dont l’absence dégrade quelque chose de nommé, sans rien casser.
 *
 * ⚠️ Elles n’empêchent PAS de servir, et c’est un choix : un retour qui arrive
 *    sans email est un retour reçu — il est lisible au back-office et par MCP
 *    (01-Specs/ingestion.md §L’invariant). Refuser de démarrer pour ça perdrait
 *    de la parole au nom d’un confort.
 */
export const VARIABLES_RECOMMANDEES: ReadonlyArray<{
  readonly nom: string
  readonly consequence: string
}> = [
  { nom: 'SMTP_URL', consequence: 'la note ne part par email pour personne' },
  { nom: 'FEEDYS_EMAIL_DE', consequence: 'la note ne part par email pour personne' },
  { nom: 'FEEDYS_EMAIL_A', consequence: 'la note ne part par email pour personne' },
  { nom: 'FEEDYS_MCP_JETON', consequence: 'l’API MCP répond 503 et ne sert rien' },
  { nom: 'FEEDYS_VERSION', consequence: 'le pied de back-office affiche « dev »' },
]

/**
 * Le budget du widget — 60 Ko gzip (01-Specs/widget.md §4).
 *
 * ⚠️ Le même nombre est tenu par `packages/widget/src/budget.test.ts`, et ce
 *    n’est pas une redite à supprimer : celui-là garde la construction, celui-ci
 *    garde le déploiement. Un widget obèse ne se remarque pas côté serveur — il
 *    se remarque chez les quatre hôtes, en même temps
 *    (04-Architecture/hebergement.md §Le démarrage, étape 5).
 */
export const BUDGET_WIDGET_OCTETS = 60 * 1024

export type Manque = { readonly nom: string; readonly consequence?: string }

export interface VerdictVariables {
  /** ⛔ Chacune empêche de servir. */
  readonly obligatoires: readonly string[]
  /** ⚠️ Chacune dégrade quelque chose, sans empêcher de servir. */
  readonly recommandees: readonly Manque[]
}

/** ⚠️ Une variable présente mais vide compte comme absente. C’est le cas courant. */
export function variablesManquantes(env: Record<string, string | undefined>): VerdictVariables {
  const vide = (nom: string): boolean => (env[nom]?.trim() ?? '') === ''

  return {
    obligatoires: VARIABLES_OBLIGATOIRES.filter(vide),
    recommandees: VARIABLES_RECOMMANDEES.filter(({ nom }) => vide(nom)),
  }
}

/**
 * Le verdict sur le widget servi.
 *
 * ⛔ `octets` est le poids du fichier **tel qu’il sera servi**, compressé — pas
 *    celui d’un build local. C’est la formulation exacte de l’acceptation de
 *    P-014, et c’est ce qu’un hôte télécharge.
 */
export type VerdictWidget =
  | { readonly ok: true; readonly octets: number }
  | { readonly ok: false; readonly motif: 'absent' }
  | { readonly ok: false; readonly motif: 'hors_budget'; readonly octets: number }

export function verdictWidget(octets: number | undefined): VerdictWidget {
  if (octets === undefined) return { ok: false, motif: 'absent' }
  if (octets > BUDGET_WIDGET_OCTETS) return { ok: false, motif: 'hors_budget', octets }
  return { ok: true, octets }
}

/** En kilo-octets, avec une décimale — la forme qu’on lit dans les journaux. */
export function enKo(octets: number): string {
  return `${(octets / 1024).toFixed(1)} Ko`
}

/**
 * Le message d’un refus de démarrage.
 *
 * ⛔ Il ne contient JAMAIS la valeur d’une variable — seulement son nom. Le
 *    dépôt est public, les journaux d’un conteneur ne le sont pas moins.
 */
export function messageVariablesManquantes(manquantes: readonly string[]): string {
  return (
    `Feedys ne peut pas démarrer — ${manquantes.length} variable(s) obligatoire(s) absente(s) : ` +
    `${manquantes.join(', ')}.\n` +
    'Elles vivent dans l’environnement du conteneur (04-Architecture/hebergement.md §Les variables).'
  )
}

export function messageWidget(verdict: VerdictWidget): string | undefined {
  if (verdict.ok) return undefined

  if (verdict.motif === 'absent') {
    return (
      'Feedys ne peut pas démarrer — widget.js est absent du dossier FEEDYS_ACTIFS.\n' +
      'Les quatre logiciels hôtes chargeraient une balise <script> qui ne rend rien.'
    )
  }

  return (
    `Feedys ne peut pas démarrer — widget.js pèse ${enKo(verdict.octets)} gzip, ` +
    `au-dessus du budget de ${enKo(BUDGET_WIDGET_OCTETS)} (01-Specs/widget.md §4).\n` +
    'Un dépassement se décide, il ne se glisse pas dans un déploiement.'
  )
}

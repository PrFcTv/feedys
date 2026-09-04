/**
 * Le lien vers la source et la version déployée.
 *
 * ⚠️ **C’est l’article 13 de l’AGPL**, pas une politesse : quiconque interagit
 *    avec Feedys à travers un réseau a droit à la source *de la version qui
 *    tourne*. Un lien vers le dépôt sans la version ne suffit pas — c’est
 *    justement pour ça que la version est affichée à côté.
 *
 * ⚠️ `FEEDYS_VERSION` est posée à la construction de l’image (P-013). Sur un
 *    poste elle est absente, et « dev » est la réponse honnête.
 */
export const DEPOT = 'https://github.com/PrFcTv/feedys'

export function versionDeployee(): string {
  return process.env['FEEDYS_VERSION']?.trim() || 'dev'
}

/** ⚠️ Le lien pointe la VERSION, pas la branche, quand on sait laquelle tourne. */
export function lienSource(): string {
  const version = versionDeployee()
  return version === 'dev' ? DEPOT : `${DEPOT}/tree/${version}`
}

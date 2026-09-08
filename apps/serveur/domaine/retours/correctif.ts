/**
 * Le lien vers le correctif — un SHA nu n’est cliquable nulle part.
 *
 * ⛔ Module pur : ni base, ni réseau (architecture.md §3). Et c’est plus qu’une
 *    convention ici : **Feedys n’appelle JAMAIS la forge.** Il compose une URL
 *    et s’arrête là. Aller demander à GitHub si ce commit existe ferait entrer
 *    dans le serveur un jeton de forge, une dépendance réseau et un périmètre
 *    qui n’est pas le sien ([D-024](../../../../00-Projet/DECISIONS_LOG.md)).
 *
 * ⚠️ Conséquence assumée : un SHA inventé produit un lien mort. La forme est
 *    vérifiée par le contrat, le fond est cru sur parole, et le lien mort est
 *    le signal — il se voit en un clic, ce qui vaut mieux qu’une vérification
 *    silencieuse qu’on aurait cessé de lire.
 */

/**
 * ⚠️ `/commit/<sha>` est la forme de GitHub, GitLab et Gitea. Bitbucket dit
 *    `/commits/`, et c’est pour lui — entre autres — que `ref` accepte AUSSI
 *    une URL complète : elle passe alors telle quelle, sans être composée.
 */
const CHEMIN_COMMIT = 'commit'

function propre(valeur: string | null | undefined): string | null {
  const net = valeur?.trim()
  return net === undefined || net === '' ? null : net
}

/**
 * L’URL cliquable d’un correctif, ou `null` quand il n’y en a pas.
 *
 * ⛔ Rien d’autre que `https://` ne devient un lien : une `url_forge` posée à la
 *    main pourrait porter n’importe quoi, et un `javascript:` rendu cliquable
 *    dans le back-office serait une faille ouverte par confort d’affichage.
 */
export function lienCorrectif(urlForge: string | null, ref: string | null): string | null {
  const reference = propre(ref)
  if (reference === null) return null

  // Une URL fournie telle quelle est déjà le lien : on ne la recompose pas.
  if (reference.startsWith('https://')) return reference

  const forge = propre(urlForge)
  if (forge === null || !forge.startsWith('https://')) return null

  return `${forge.replace(/\/+$/, '')}/${CHEMIN_COMMIT}/${reference}`
}

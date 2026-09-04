/**
 * Le jeton d’identité, tel que l’hôte le pose.
 *
 * ```html
 * <script>window.feedys = { identite: "<jeton signé par votre serveur>" }</script>
 * ```
 *
 * ⛔ Le widget ne fabrique, ne signe et ne vérifie RIEN. Il lit une chaîne et la
 *    recopie dans un en-tête. Signer côté navigateur demanderait le secret du
 *    produit dans la page, ce qui reviendrait à ne rien signer du tout (D-005).
 *
 * ⚠️ Il ne s’inquiète pas non plus de l’absence du jeton : un retour anonyme est
 *    un retour valable, et il part exactement pareil (P-012).
 *
 * ⚠️ `window.feedys` est partagé — l’hôte y pose son jeton AVANT que le script
 *    ne s’exécute, le widget y ajoute ensuite `version`, `ouvrir()` et
 *    `fermer()`. On lit, on n’écrase pas (01-Specs/widget.md §2).
 */
interface Global {
  feedys?: { identite?: unknown }
}

/**
 * ⚠️ Lu à CHAQUE envoi, jamais mémorisé au chargement : une application métier
 *    qui rafraîchit la session de quelqu’un remplace son jeton en cours de
 *    route, et un jeton capturé au démarrage serait périmé une heure plus tard.
 */
export function identiteHote(global: Global = globalThis as Global): string | undefined {
  const jeton = global.feedys?.identite

  if (typeof jeton !== 'string') return undefined

  const propre = jeton.trim()
  return propre === '' ? undefined : propre
}

/**
 * Le jeton d’identité, tel que l’hôte le pose.
 *
 * ```html
 * <script>window.feedys = { identite: "<jeton signé par votre serveur>" }</script>
 * ```
 *
 * ⚠️ **Ou une fonction, et c’est la forme recommandée** dès qu’une page peut
 *    rester ouverte longtemps — c’est-à-dire le cas ordinaire d’un logiciel
 *    métier, où un onglet vit une journée :
 *
 * ```html
 * <script>window.feedys = { identite: () => monJetonCourant }</script>
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
 *
 * ⛔ ET LA FONCTION EST APPELÉE SYNCHRONEMENT, SANS `await`, JAMAIS. Ce n’est
 *    pas un oubli, et personne ne doit « corriger » ça dans six mois : le chemin
 *    d’envoi attendrait alors du code de l’hôte. Une de ses lenteurs, un de ses
 *    blocages, et c’est la parole de quelqu’un qui se perd — or **on ne perd
 *    jamais une parole pour un problème d’identité** (P-012). Un hôte qui doit
 *    rafraîchir son jeton le fait de son côté, à son rythme, et pose le résultat
 *    ici ; il ne fait pas patienter l’envoi le temps d’un aller-retour.
 *
 * ⛔ ET RIEN DE CE QUE FAIT L’HÔTE NE REMONTE. Une fonction qui lève, qui rend
 *    une promesse, un nombre, `null`, ou une chaîne vide : identité **absente**,
 *    et l’envoi part. Un bug chez l’hôte ne casse pas l’envoi — c’est la même
 *    règle qu’au-dessus, écrite une deuxième fois parce que c’est le seul
 *    endroit où on la tient.
 */
export function identiteHote(global: Global = globalThis as Global): string | undefined {
  return nettoyer(lire(global.feedys?.identite))
}

function lire(pose: unknown): unknown {
  if (typeof pose !== 'function') return pose

  try {
    return (pose as () => unknown)()
  } catch {
    // ⚠️ Muet, et volontairement : le widget n’écrit jamais dans la console de
    //    son hôte (01-Specs/widget.md §L’intégration). Le retour part sans
    //    auteur, ce qui est un retour valable.
    return undefined
  }
}

function nettoyer(jeton: unknown): string | undefined {
  if (typeof jeton !== 'string') return undefined

  const propre = jeton.trim()
  return propre === '' ? undefined : propre
}

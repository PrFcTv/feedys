/**
 * Le navigateur et le système, lus dans la chaîne d’agent.
 *
 * ⚠️ Ce sont deux étiquettes lisibles, pas une empreinte. La chaîne brute part
 *    telle quelle dans `agentBrut` pour qui a besoin du détail — c’est
 *    précisément à ça que sert ce champ (04-Architecture/conventions-db.md).
 *
 * ⛔ Aucune bibliothèque : un analyseur d’agent complet pèse plus que le service
 *    rendu, et le budget du widget est de 60 Ko gzip (01-Specs/widget.md §4).
 *
 * L’ordre des tests est emprunté à `@fasterfixes/core` (MIT) — voir
 * ATTRIBUTIONS.md. Il n’est pas arbitraire : Edge se déclare Chrome, Chrome se
 * déclare Safari, et Safari se déclare tout le monde.
 */

interface Forme {
  readonly nom: string
  /** Ce qui doit être présent pour reconnaître le navigateur. */
  readonly marque: RegExp
  /** Ce qui, présent, disqualifie la reconnaissance. */
  readonly sauf?: RegExp
  /** Où lire la version. */
  readonly version: RegExp
}

/** ⛔ L’ordre compte, et il ne se réordonne pas alphabétiquement. */
const NAVIGATEURS: readonly Forme[] = [
  { nom: 'Firefox', marque: /Firefox\//, version: /Firefox\/(\d+)/ },
  { nom: 'Edge', marque: /Edg\//, version: /Edg\/(\d+)/ },
  { nom: 'Opera', marque: /OPR\/|Opera\//, version: /(?:OPR|Opera)\/(\d+)/ },
  { nom: 'Chrome', marque: /Chrome\//, sauf: /Edg\/|OPR\//, version: /Chrome\/(\d+)/ },
  { nom: 'Safari', marque: /Safari\//, sauf: /Chrome\/|Chromium\//, version: /Version\/(\d+)/ },
]

/**
 * ⚠️ Les systèmes mobiles passent AVANT les systèmes de bureau : la chaîne
 *    d’Android contient « Linux », et celle d’iPad contient « Mac OS X ».
 */
const SYSTEMES: readonly { readonly nom: string; readonly marque: RegExp }[] = [
  { nom: 'Android', marque: /Android/ },
  { nom: 'iOS', marque: /iPhone|iPad|iPod/ },
  { nom: 'Windows', marque: /Windows/ },
  { nom: 'macOS', marque: /Mac OS X|Macintosh/ },
  { nom: 'Linux', marque: /Linux|X11/ },
]

/** « Chrome 141 », ou le nom seul si la version est illisible. */
export function lireNavigateur(agent: string): string | undefined {
  for (const forme of NAVIGATEURS) {
    if (!forme.marque.test(agent)) continue
    if (forme.sauf?.test(agent)) continue

    const version = forme.version.exec(agent)?.[1]
    return version ? `${forme.nom} ${version}` : forme.nom
  }

  return undefined
}

/** « Windows », « macOS », « Linux », « Android », « iOS ». */
export function lireSysteme(agent: string): string | undefined {
  return SYSTEMES.find((s) => s.marque.test(agent))?.nom
}

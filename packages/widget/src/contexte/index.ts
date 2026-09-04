/**
 * Ce que le widget joint tout seul.
 *
 * ⛔ LA LISTE EST CLOSE : 01-Specs/widget.md §Ce que le widget joint tout seul.
 *    URL, titre de page, écran déduit, sélecteur de l’élément visé, navigateur,
 *    système, taille de fenêtre, fuseau, horodatage, capture. **Rien d’autre.**
 *
 *    Le dépôt est public : cette liste doit pouvoir être lue par n’importe qui
 *    sans gêne. Un champ de plus ici est une décision de produit, pas un détail
 *    d’implémentation — et le contrat (`contrat.ts`) refuse tout champ inconnu,
 *    donc le serveur rejetterait l’ajout avant même qu’on en discute.
 *
 * ⛔ CE QU’ON NE FAIT PAS, et qui existe pourtant chez les voisins :
 *      · aucun cookie, lu ou écrit ;
 *      · aucune écriture persistante — pas de `localStorage`, pas de
 *        `sessionStorage`, pas d’IndexedDB. Le brouillon en cours vivra en
 *        mémoire, dans la coquille (P-005) ;
 *      · aucun identifiant de visiteur, donc aucun suivi entre les sessions ;
 *      · aucun pixel, aucune balise, aucun appel à un tiers ;
 *      · aucun texte de la page, ni celui de l’élément visé ni celui de ses
 *        voisins ;
 *      · aucune trace de console ni de réseau.
 *
 * ⚠️ TOUT EST EN ÉCHEC DOUX. Chaque morceau qui rate vaut `undefined`, et le
 *    retour part quand même. Seule l’URL est obligatoire, et si elle manquait
 *    il n’y aurait plus de page.
 */
import type { Contexte } from '../contrat'
import { BORNES } from '../transport'

import { capturer, type OptionsCapture } from './capture'
import { deduireEcran } from './ecran'
import { lireNavigateur, lireSysteme } from './navigateur'
import { construireSelecteur } from './selecteur'
import { nettoyerUrl } from './url'

export { capturer, definirOrigineFeedys, oublierSnapdom } from './capture'
export type { OptionsCapture, RendreEnToile, Toile } from './capture'
export { deduireEcran } from './ecran'
export { lireNavigateur, lireSysteme } from './navigateur'
export { construireSelecteur } from './selecteur'
export { nettoyerUrl } from './url'
export { suivreSurvol } from './survol'
export type { OptionsSurvol, Survol } from './survol'

export interface OptionsCollecte {
  /** L’élément survolé à l’ouverture. Voir `survol.ts`. */
  readonly cible?: Element | null
  /** La fenêtre de l’hôte. Injectable pour les tests. */
  readonly fenetre?: Window
  /**
   * ⛔ `false` désactive la capture. Le reste de la collecte ne change pas, et
   *    l’envoi fonctionne exactement pareil.
   */
  readonly capture?: false | OptionsCapture
  /** Ce qu’on photographie. Par défaut, la racine du document de l’hôte. */
  readonly cadre?: Element | null
}

function raccourcir(valeur: string | undefined, borne: number): string | undefined {
  const propre = valeur?.trim()
  return propre === undefined || propre === '' ? undefined : propre.slice(0, borne)
}

/** ⚠️ Chaque lecture est isolée : une exception n’emporte pas la collecte entière. */
function doux<T>(lire: () => T): T | undefined {
  try {
    return lire()
  } catch {
    return undefined
  }
}

/**
 * La partie synchrone : tout sauf la capture.
 *
 * ⚠️ Elle est séparée parce qu’elle doit être prise à l’INSTANT de l’ouverture.
 *    La capture, elle, prend quelques centaines de millisecondes, pendant
 *    lesquelles l’URL peut déjà avoir changé sous une application à routeur.
 */
export function lireContexte(options: OptionsCollecte = {}): Contexte {
  const fenetre = options.fenetre ?? globalThis.window
  const doc = fenetre?.document
  const agent = doux(() => fenetre.navigator.userAgent) ?? ''

  return {
    url: nettoyerUrl(doux(() => fenetre.location.href) ?? ''),
    titrePage: raccourcir(doux(() => doc?.title), BORNES.titrePage),
    ecran: doux(() => deduireEcran(fenetre.location.href)),
    selecteurDom: doux(() => construireSelecteur(options.cible, doc)),
    navigateur: raccourcir(lireNavigateur(agent), BORNES.navigateur),
    systeme: raccourcir(lireSysteme(agent), BORNES.systeme),
    viewportL: entier(doux(() => fenetre.innerWidth)),
    viewportH: entier(doux(() => fenetre.innerHeight)),
    fuseau: raccourcir(
      doux(() => Intl.DateTimeFormat().resolvedOptions().timeZone),
      BORNES.fuseau,
    ),
    // ⚠️ Indicatif : `cree_le` fait foi côté serveur. Une horloge de poste peut
    //    être fausse de plusieurs heures, et personne ne s’en aperçoit.
    horodatage: doux(() => new Date().toISOString()),
    agentBrut: agentBrut(fenetre, agent),
  }
}

/**
 * La collecte complète, capture comprise.
 *
 * ⛔ Elle ne rejette jamais. C’est la garantie qui permet à la coquille de
 *    l’appeler sans `try` : `await collecter(...)` rend toujours un contexte
 *    valide au regard du contrat.
 */
export async function collecter(options: OptionsCollecte = {}): Promise<Contexte> {
  const contexte = lireContexte(options)

  if (options.capture === false) return contexte

  const fenetre = options.fenetre ?? globalThis.window
  const cadre = options.cadre ?? doux(() => fenetre.document.documentElement)
  const capture = await capturer(cadre, options.capture ?? {})

  return capture ? { ...contexte, capture } : contexte
}

function entier(valeur: number | undefined): number | undefined {
  if (valeur === undefined || !Number.isFinite(valeur)) return undefined
  const arrondi = Math.round(valeur)
  return arrondi >= 0 && arrondi <= BORNES.viewport ? arrondi : undefined
}

/**
 * Le contexte navigateur brut — le seul champ légitimement non structuré
 * (04-Architecture/conventions-db.md).
 *
 * ⛔ Trois valeurs, toutes issues de `navigator` et de `window`, toutes déjà
 *    couvertes par la ligne « Navigateur, système, taille de fenêtre » de la
 *    liste close. La chaîne d’agent y est en entier parce que
 *    `lireNavigateur` la résume, et qu’un résumé perd ce dont on aura besoin le
 *    jour d’un bug qui ne se produit que sur une version.
 */
function agentBrut(fenetre: Window | undefined, agent: string): Record<string, unknown> | undefined {
  if (agent === '') return undefined

  return {
    userAgent: agent,
    langue: doux(() => fenetre?.navigator.language) ?? null,
    densitePixels: doux(() => fenetre?.devicePixelRatio) ?? null,
  }
}

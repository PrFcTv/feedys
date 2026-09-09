/**
 * Le point d’entrée du widget.
 *
 * ⛔ Ce paquet est MIT et n’importe rien de `apps/serveur`, qui est AGPL. Pas un
 *    type, pas une constante, pas un utilitaire. Le contrat partagé vit ici,
 *    dans `contrat.ts`, et c’est le serveur qui l’importe — jamais l’inverse.
 *    04-Architecture/licences.md.
 *
 * ⛔ Il ne publie pas de paquet npm : il produit `widget.js`, servi par le
 *    serveur, et chargé par une balise `<script src>` chez l’hôte. C’est la
 *    seule intégration supportée, et la raison est juridique.
 *
 * ⛔ CE MODULE N’EXPORTE RIEN, ET C’EST STRUCTUREL. Rollup ne crée la variable
 *    globale d’un paquet IIFE que s’il y a des exports — et cette variable
 *    s’appellerait `feedys`, c’est-à-dire précisément l’objet où l’hôte a posé
 *    son jeton d’identité (`window.feedys = { identite }`, D-005). Un `export`
 *    ajouté ici l’écraserait sans un mot. `montage.test.ts` le vérifie.
 */
import { lireConfiguration } from './configuration'
import { monter } from './montage'

const VERSION = '0.0.0'

/**
 * ⚠️ `window.feedys` est la SEULE globale du widget (01-Specs/widget.md §2), et
 *    elle est partagée : l’hôte y pose son jeton d’identité avant nous. On
 *    complète, on n’écrase pas.
 */
interface Global {
  feedys?: Record<string, unknown>
}

const lecture = lireConfiguration(document.currentScript as HTMLScriptElement | null)

if (lecture.ok) {
  const montage = monter(lecture.configuration)
  const global = globalThis as Global

  // ⚠️ LA FILE D’ATTENTE SE VIDE AVANT TOUT LE RESTE. Le script est en `defer` :
  //    il s’exécute APRÈS l’analyse du document, c’est-à-dire après le
  //    démarrage de l’hôte — précisément le moment où une application métier
  //    casse. Un hôte qui veut nous parler de ce moment-là n’a que ce chemin :
  //
  //      ;(window.feedys = window.feedys || {}).indices ||= []
  //      window.feedys.indices.push({ genre: 'js', nom: 'TypeError' })
  //
  //    ⛔ Rien n’est cru sur parole : chaque entrée repasse par le même tamis
  //       que le reste (`lireIndicePousse`), et une entrée mal formée est jetée
  //       sans un mot plutôt que de faire refuser le retour entier.
  const enAttente = global.feedys?.['indices']
  if (Array.isArray(enAttente)) {
    for (const brut of enAttente) montage.poserIndice(brut)
  }

  global.feedys = {
    ...global.feedys,
    version: VERSION,
    ouvrir: () => montage.commandes.ouvrir(),
    fermer: () => montage.commandes.fermer(),
    indice: (brut: unknown) => montage.poserIndice(brut),
    /**
     * ⚠️ La file reste APPELABLE après le chargement, et c’est ce qui la rend
     *    utilisable : l’hôte écrit `window.feedys.indices.push(…)` une fois pour
     *    toutes, sans avoir à savoir si le widget est déjà là. Le tableau est
     *    remplacé par un objet qui pousse directement — motif `dataLayer`.
     */
    indices: {
      push: (...entrees: unknown[]) => {
        for (const brut of entrees) montage.poserIndice(brut)
      },
    },
  }
} else {
  // ⚠️ Le seul message que le widget écrira jamais dans la console de l’hôte, et
  //    il s’adresse à l’intégrateur : sans lui, une balise mal recopiée ne
  //    produit rien du tout, et personne ne sait pourquoi.
  console.warn(lecture.message)
}

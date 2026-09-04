/**
 * Une note figée, écrite à la main, qui sert de sujet au test de rendu et à
 * `pnpm emails:apercu`.
 *
 * ⛔ ELLE EST INVENTÉE, DE BOUT EN BOUT. Le dépôt est public, et un vrai retour
 *    dicté contient des noms de personnes, parfois d’immeubles ou de dossiers.
 *    ⛔ On ne copie JAMAIS un jeu d’essai depuis une base qui tourne
 *    (CLAUDE.md §Ce qui ne doit jamais entrer dans ce dépôt).
 *
 * ⚠️ Le produit, le domaine et l’auteur sont fictifs : `exemple.fr`.
 */
import type { RetourANotifier } from './message'

export const EXEMPLE_NOTIFICATION: RetourANotifier = {
  retourId: 'ret_exemple0000000000000',
  produitNom: 'Pistache',
  urlPublique: 'https://feedys.exemple.fr',
  synthese: {
    type: 'bug',
    titre: 'Le tri par date de la liste des dossiers se réinitialise',
    resume:
      'Le tri par date se réinitialise au retour sur la page. La personne doit le reposer à ' +
      'chaque navigation. Comportement présent depuis toujours d’après elle.',
    attendu: 'le tri reste en place au retour',
    constate: 'le tri revient à l’ordre par défaut',
    recurrence: 'systematique',
    zone: 'Liste des dossiers',
    impact: 'ralentit',
    citations: [
      'dès que je reviens en arrière il se remet à zéro',
      'faut que je le refasse à chaque fois c’est pénible',
    ],
    confiance: 'moyenne',
    questions_ouvertes: ['Est-ce que ça touche aussi les autres listes ?'],
  },
  contexte: {
    url: '/dossiers?tri=date',
    navigateur: 'Chrome 141',
    viewportL: 1512,
    viewportH: 982,
    fuseau: 'Europe/Paris',
    auteurNom: 'Camille Martin',
    auteurRole: 'gestionnaire',
    recuLe: '2026-09-04T07:14:00.000Z',
  },
}

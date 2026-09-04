/**
 * Le point d’entrée du widget.
 *
 * ⛔ Ce paquet est MIT et n’importe rien de `apps/serveur`, qui est AGPL. Pas un
 *    type, pas une constante, pas un utilitaire. Le contrat partagé vivra ici,
 *    dans `contrat.ts`, et c’est le serveur qui l’importera — jamais l’inverse.
 *    04-Architecture/licences.md.
 *
 * ⛔ Il ne publie pas de paquet npm : il produit `widget.js`, servi par le
 *    serveur, et chargé par une balise `<script src>` chez l’hôte. C’est la
 *    seule intégration supportée, et la raison est juridique.
 *
 * Le montage en shadow DOM arrive en P-005 — 01-Specs/widget.md.
 */
export const VERSION = '0.0.0'

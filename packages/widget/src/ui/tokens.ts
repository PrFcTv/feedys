/**
 * Les tokens du widget — LA SEULE PLACE OÙ UNE COULEUR S’ÉCRIT EN CLAIR.
 *
 * ⛔ Aucun autre module n’a le droit d’écrire un HEX : 04-Architecture/DESIGN.md
 *    §Ce qui vaut pour les deux. `tokens.test.ts` relit les sources et rougit à
 *    la première rechute — sans quoi la règle serait respectée trois semaines.
 *
 * ⚠️ Un seul accent, surchargeable par l’hôte ; le rouge d’enregistrement ne
 *    l’est PAS. Le rouge est un code universel compris sans apprentissage, et
 *    laisser un hôte le repeindre en vert détruirait la seule convention sur
 *    laquelle le produit s’appuie gratuitement (DESIGN.md §Les tokens).
 *
 * ⛔ Et rien d’autre n’est exposé. Un widget entièrement rhabillable est un
 *    widget qu’on rend illisible par accident, et dont on ne peut plus prédire
 *    l’accessibilité.
 */

/**
 * Ce que l’hôte peut poser, n’importe où dans sa page :
 *
 * ```css
 * feedys-widget { --feedys-accent: #00558C; --feedys-rayon: 8px; --feedys-ancrage: 24px }
 * ```
 *
 * ⚠️ Les propriétés personnalisées traversent la frontière du shadow DOM par
 *    héritage — y compris fermé. C’est le seul canal de personnalisation, et
 *    c’est délibérément un canal étroit.
 */
export const TOKENS = `
/*
 * ⛔ LE RESET EST SUR .racine, DANS LA RACINE FANTÔME — ET SURTOUT PAS SUR :host.
 *
 * Le shadow DOM empêche les sélecteurs de l’hôte d’atteindre nos nœuds, mais pas
 * les propriétés HÉRITÉES — police, couleur, casse, interlignage — de traverser
 * la frontière depuis l’élément '<feedys-widget>' lui-même. Et cet élément
 * appartient à l’arbre de l’hôte : un '* { text-transform: uppercase !important }'
 * l’atteint, et une règle :host NE PEUT PAS s’y opposer — la cascade donne la
 * priorité à l’arbre extérieur sur :host. Constaté le 2026-09-04 en écrivant
 * P-005, dans 'pnpm widget:demo' : le titre du panneau sortait en majuscules
 * magenta, en Comic Sans, avec l’interlignage de l’hôte.
 *
 * Posé ici, sur un élément QUI EST DANS la racine fantôme, plus rien de l’hôte
 * ne peut le contredire — et 'all' couvre toutes les propriétés héritées, y
 * compris celles qu’on n’a pas pensé à lister.
 *
 * ⚠️ 'all' ne touche pas aux propriétés personnalisées : les surcharges posées
 *    par l’hôte sur 'feedys-widget' traversent et survivent. C’est ce qui rend
 *    '--feedys-accent' possible.
 * ⚠️ 'all' ne touche pas non plus à 'direction' ni 'unicode-bidi' — d’où la
 *    déclaration explicite plus bas.
 */
.racine {
  all: initial;
  direction: ltr;

  /* — surfaces — achromatiques, très légèrement froides — */
  --w-fond:        #FFFFFF;
  --w-fond-2:      #F5F6F8;
  --w-bord:        #E2E5EA;
  --w-encre:       #14181D;
  --w-encre-2:     #4A535E;
  --w-encre-3:     #7C8794;   /* le plus clair admis sur --w-fond : AA à 14px */

  /* — l’unique accent, surchargeable — */
  --w-accent:      var(--feedys-accent, #2C3E64);
  --w-accent-encre:#FFFFFF;

  /* — le signal d’enregistrement : NON surchargeable — */
  --w-rec:         #C8342B;
  --w-rec-halo:    rgba(200, 52, 43, .14);

  /* — géométrie — */
  --w-rayon:       var(--feedys-rayon, 10px);
  --w-rayon-s:     6px;
  --w-ancrage:     var(--feedys-ancrage, 24px);
  --w-ombre:       0 1px 2px rgba(20,24,29,.06), 0 12px 32px -12px rgba(20,24,29,.28);

  /* — rythme : une seule échelle, multiples de 4 — */
  --w-1: 4px;  --w-2: 8px;  --w-3: 12px;
  --w-4: 16px; --w-6: 24px; --w-8: 32px;

  /* ⛔ Pile système, aucune police web : charger une police depuis la page
     d’autrui, c’est ajouter une requête bloquante et un tiers à un logiciel qui
     n’a rien demandé (DESIGN.md §Aucune police web). */
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
               "Helvetica Neue", Arial, sans-serif;
  font-size: 14px;
  line-height: 1.45;
  color: var(--w-encre);
  -webkit-font-smoothing: antialiased;

  display: block;
}

@media (prefers-color-scheme: dark) {
  .racine { --w-fond: #171B20; --w-fond-2: #1F242B; --w-bord: #2C333C;
          --w-encre: #EAEDF1; --w-encre-2: #B3BCC7; --w-encre-3: #808B98; }
}
`

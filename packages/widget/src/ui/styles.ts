/**
 * La feuille de style du widget, servie dans le shadow DOM.
 *
 * ⛔ AUCUN HEX ICI. Les couleurs vivent dans `tokens.ts`, et rien d’autre ne
 *    doit en écrire une — 04-Architecture/DESIGN.md. `tokens.test.ts` le vérifie.
 *
 * ⚠️ Le lanceur et le panneau se DÉCALQUENT sur Intercom Messenger
 *    (04-Architecture/references-visuelles.md) : dimensions, ancrage, transition
 *    d’ouverture, le lanceur qui devient une croix. Ce qu’on lui laisse : la
 *    bulle d’accueil automatique, les avatars, le badge de non-lus. Feedys ne
 *    réclame jamais l’attention.
 */
import { TOKENS } from './tokens'

/**
 * ⚠️ Le mouvement est court et jamais décoratif (DESIGN.md §Le mouvement) :
 *    180 ms pour dire d’où vient le panneau, 200 ms pour conclure un envoi.
 *    Rien d’autre ne bouge — pas de rebond, pas de `spring`, pas d’entrée en
 *    cascade.
 */
const REGLES = `
*, *::before, *::after { box-sizing: border-box }

button, textarea {
  font: inherit;
  color: inherit;
  margin: 0;
}

:focus-visible {
  outline: 2px solid var(--w-accent);
  outline-offset: 2px;
}

/* ── FERMÉ — le lanceur ─────────────────────────────────────────────────────
   ⛔ Il ne pulse pas, ne rebondit pas, n’affiche pas de badge. Au survol, il
      s’élargit et révèle son libellé. Rien ne réclame l’attention. */

.lanceur {
  position: absolute;
  bottom: var(--w-ancrage);
  right: var(--w-ancrage);
  left: auto;
  display: inline-flex;
  align-items: center;
  gap: var(--w-2);
  height: 48px;
  padding: 0 var(--w-4);
  border: 0;
  border-radius: 999px;
  background: var(--w-accent);
  color: var(--w-accent-encre);
  box-shadow: var(--w-ombre);
  cursor: pointer;
  pointer-events: auto;
  white-space: nowrap;
  transition: transform 180ms cubic-bezier(.32,.72,0,1);
}

.lanceur:hover { transform: translateY(-1px) }
.lanceur:active { transform: translateY(0) }

.lanceur__libelle {
  display: inline-block;
  overflow: hidden;
  max-width: 0;
  font-size: 14px;
  font-weight: 600;
  opacity: 0;
  transition: max-width 180ms cubic-bezier(.32,.72,0,1), opacity 180ms ease;
}

.lanceur:hover .lanceur__libelle,
.lanceur:focus-visible .lanceur__libelle,
.lanceur[aria-expanded="true"] .lanceur__libelle {
  max-width: 9rem;
  opacity: 1;
}

.icone { display: block; flex: none }

/* ── OUVERT — le panneau ──────────────────────────────────────────────────── */

.panneau {
  position: absolute;
  bottom: calc(var(--w-ancrage) + 48px + var(--w-2));
  right: var(--w-ancrage);
  left: auto;
  display: flex;
  flex-direction: column;
  width: 360px;
  max-width: calc(100vw - 2 * var(--w-ancrage));
  max-height: min(560px, calc(100vh - 2 * var(--w-ancrage) - 56px));
  border: 1px solid var(--w-bord);
  border-radius: var(--w-rayon);
  background: var(--w-fond);
  box-shadow: var(--w-ombre);
  pointer-events: auto;
  overflow: hidden;
  transform-origin: bottom right;
  animation: w-ouvrir 180ms cubic-bezier(.32,.72,0,1);
}

@keyframes w-ouvrir {
  from { opacity: 0; transform: translateY(8px) scale(.98) }
  to   { opacity: 1; transform: none }
}

.entete {
  display: flex;
  align-items: flex-start;
  gap: var(--w-2);
  padding: var(--w-4) var(--w-4) var(--w-2);
}

.titre {
  flex: 1;
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -.01em;
}

.fermer {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: var(--w-rayon-s);
  background: transparent;
  color: var(--w-encre-2);
  cursor: pointer;
}

.fermer:hover { background: var(--w-fond-2); color: var(--w-encre) }

.corps {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 var(--w-4) var(--w-4);
}

/* ⚠️ Le champ texte est au même niveau de visibilité que le micro (P-006), pas
      caché derrière un lien : quelqu’un en open space doit pouvoir écrire sans
      avoir l’impression de contourner le produit (01-Specs/widget.md). */
.champ {
  display: block;
  width: 100%;
  min-height: 104px;
  padding: var(--w-3);
  border: 1px solid var(--w-bord);
  border-radius: var(--w-rayon-s);
  background: var(--w-fond);
  font-size: 14px;
  resize: vertical;
}

.champ::placeholder { color: var(--w-encre-3) }

.avis {
  margin-top: var(--w-3);
  padding: var(--w-2) var(--w-3);
  border: 1px solid var(--w-bord);
  border-radius: var(--w-rayon-s);
  background: var(--w-fond-2);
  color: var(--w-encre-2);
  font-size: 13px;
}

.avis:empty { display: none }

.pied {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--w-2);
  padding: var(--w-3) var(--w-4);
  border-top: 1px solid var(--w-bord);
  background: var(--w-fond);
}

.envoyer {
  padding: var(--w-2) var(--w-4);
  border: 0;
  border-radius: var(--w-rayon-s);
  background: var(--w-accent);
  color: var(--w-accent-encre);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.envoyer[disabled] { opacity: .45; cursor: default }

/* ⚠️ Répondre est SECONDAIRE : « Envoyer maintenant » ne doit jamais avoir
      l’air de l’issue de secours. On ne retient personne (01-Specs/entretien.md
      §règle 5). */
.repondre {
  margin-right: auto;
  padding: var(--w-2) var(--w-3);
  border: 1px solid var(--w-bord);
  border-radius: var(--w-rayon-s);
  background: var(--w-fond);
  color: var(--w-encre-2);
  font-size: 14px;
  cursor: pointer;
}

.repondre[disabled] { opacity: .45; cursor: default }

/* ── LE MICRO — le geste proposé, jamais imposé ─────────────────────────────
   ⛔ Sans Web Speech, ce bloc n’est pas rendu du tout : il ne se grise pas et
      ne s’excuse pas. On ne mentionne jamais ce qui manque ([D-003]). */

.micro {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--w-2);
  padding: var(--w-4) 0 var(--w-2);
}

.micro__bouton {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  padding: 0;
  border: 1px solid var(--w-bord);
  border-radius: 999px;
  background: var(--w-fond-2);
  color: var(--w-encre-2);
  cursor: pointer;
  touch-action: none;
  transform: translateX(calc(var(--w-glisse, 0px) * -1));
}

.micro__bouton:hover { border-color: var(--w-encre-3); color: var(--w-encre) }

/* ⚠️ Le rouge d’enregistrement ne se surcharge pas : c’est la seule convention
      sur laquelle le produit s’appuie gratuitement (DESIGN.md §Les tokens). */
.micro__bouton[aria-pressed='true'] {
  border-color: transparent;
  background: var(--w-rec);
  color: var(--w-accent-encre);
  /* ⚠️ Le halo RESPIRE, il ne clignote pas. Le clignotement dit l’urgence ; on
        veut dire l’attention (DESIGN.md, exigence 3). */
  animation: w-respirer 1.6s ease-in-out infinite;
}

@keyframes w-respirer {
  0%, 100% { box-shadow: 0 0 0 0 var(--w-rec-halo) }
  50%      { box-shadow: 0 0 0 14px var(--w-rec-halo) }
}

.micro__legende {
  margin: 0;
  color: var(--w-encre-3);
  font-size: 13px;
  text-align: center;
}

/* ⚠️ « ou », et rien de plus. Le champ texte n’est pas un contournement du
      micro : les deux chemins sont au même niveau de visibilité. */
.separateur {
  display: flex;
  align-items: center;
  gap: var(--w-3);
  margin: var(--w-2) 0 var(--w-3);
  color: var(--w-encre-3);
  font-size: 13px;
}

.separateur::before,
.separateur::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--w-bord);
}

/* ── EN ÉCOUTE — le seul écran à dessiner vraiment ──────────────────────────*/

.ecoute { padding-top: var(--w-2) }

/* ⛔ L’onde est calculée depuis l’AnalyserNode, à chaque image. Rien ici ne
      l’anime : une onde animée en boucle se repère en une seconde. */
.onde {
  display: block;
  width: 100%;
  height: 44px;
}

.ecoute__transcript {
  margin: var(--w-3) 0 0;
  min-height: 3.6em;
  max-height: 8em;
  overflow-y: auto;
  color: var(--w-encre);
  font-size: 14px;
}

.ecoute__attente { color: var(--w-encre-3) }

.ecoute__avis {
  margin: var(--w-2) 0 0;
  color: var(--w-encre-2);
  font-size: 13px;
}

.ecoute__indices {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--w-3);
  margin: var(--w-2) 0 0;
  min-height: 1.2em;
  color: var(--w-encre-3);
  font-size: 13px;
}

/* ⚠️ Le compteur informe, il ne presse pas : pas de couleur, pas de gras. */
.ecoute__compteur { font-variant-numeric: tabular-nums }

/* ── EN ENTRETIEN — la carte de compréhension ───────────────────────────────
   ⛔ Ce n’est PAS un message de chat : c’est une fiche dont chaque champ se
      corrige sur place. Fond --w-fond-2, bord --w-bord, PAS d’ombre — elle est
      posée DANS le fil, pas au-dessus (DESIGN.md §La carte de compréhension).
   ⛔ Et elle n’a pas de bouton « valider » : on corrige, ça part avec le tour
      suivant. Un bouton de validation ferait croire à un formulaire. */

.carte {
  margin-top: var(--w-3);
  padding: var(--w-3);
  border: 1px solid var(--w-bord);
  border-radius: var(--w-rayon-s);
  background: var(--w-fond-2);
  /* ⚠️ 140 ms, fondu + 4 px : dire qu’une chose nouvelle est là, rien de plus
        (DESIGN.md §Le mouvement). */
  animation: w-carte 140ms ease;
}

@keyframes w-carte {
  from { opacity: 0; transform: translateY(4px) }
  to   { opacity: 1; transform: none }
}

.carte__entete {
  margin: 0 0 var(--w-2);
  color: var(--w-encre-3);
  font-size: 13px;
}

.carte__champ {
  display: block;
  margin-top: var(--w-2);
  border-radius: var(--w-rayon-s);
}

.carte__libelle {
  display: block;
  color: var(--w-encre-3);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: .06em;
}

/* ⚠️ Un contrôle natif qui RESSEMBLE à du texte tant qu’on ne le touche pas.
      Au survol, un fond subtil et un liseré : l’affordance doit se découvrir
      sans mode d’emploi. Pas de crayon en icône — le curseur texte le dit
      déjà, et une icône de plus dans 360 px se paie cher. */
.carte__valeur {
  display: block;
  width: 100%;
  margin-top: 2px;
  padding: var(--w-1) var(--w-2);
  border: 1px solid transparent;
  border-radius: var(--w-rayon-s);
  background: transparent;
  color: var(--w-encre);
  font: inherit;
  font-size: 14px;
  resize: none;
  overflow: hidden;
}

.carte__titre { font-weight: 600 }

.carte__valeur:hover:not([disabled]) {
  border-color: var(--w-bord);
  background: var(--w-fond);
}

.carte__valeur:focus {
  border-color: var(--w-bord);
  background: var(--w-fond);
  outline: 2px solid var(--w-accent);
  outline-offset: 1px;
  overflow: auto;
}

.carte__valeur[disabled] { color: var(--w-encre-2); opacity: 1 }

/* ⚠️ La flèche du select est rendue par le navigateur ; on ne la remplace pas.
      Un select maison, c’est le clavier et le lecteur d’écran à refaire. */
.carte__choix { appearance: auto; padding-left: var(--w-1) }

/* ⚠️ La question du bot est SOUS la carte, jamais dedans (01-Specs/widget.md
      §En entretien). Et 16 px : c’est la seule chose à lire à ce moment-là. */
.question {
  margin: var(--w-4) 0 var(--w-2);
  font-size: 16px;
  line-height: 1.4;
}

/* ⚠️ Le bot qui lit : une ligne, pas un squelette animé. On attend une seconde,
      pas un chargement de page. */
.attente {
  margin: var(--w-3) 0 0;
  color: var(--w-encre-3);
  font-size: 13px;
}

/* ── ENVOYÉ — l’accusé ──────────────────────────────────────────────────────
   ⛔ Pas de numéro de suivi, pas de « vous serez notifié », pas de lien vers un
      statut. On ne promet rien qu’on ne tiendra pas (01-Specs/widget.md). */

.accuse {
  padding: var(--w-8) var(--w-4);
  animation: w-conclure 200ms ease;
}

.accuse strong { display: block; font-size: 16px; font-weight: 600 }
.accuse p { margin: var(--w-1) 0 0; color: var(--w-encre-2) }

@keyframes w-conclure {
  from { opacity: 0 }
  to   { opacity: 1 }
}

/* ── Ancrage à gauche, sur configuration de l’hôte ─────────────────────────── */

:host([data-position="bas-gauche"]) .lanceur,
:host([data-position="bas-gauche"]) .panneau {
  right: auto;
  left: var(--w-ancrage);
}

:host([data-position="bas-gauche"]) .panneau { transform-origin: bottom left }

/* ── ⛔ prefers-reduced-motion ─────────────────────────────────────────────── */

/* ⛔ prefers-reduced-motion supprime tout SAUF l’onde — qui est de
      l’information, pas de la décoration, et qui est donc conservée
      (DESIGN.md §Le mouvement). */
@media (prefers-reduced-motion: reduce) {
  .lanceur, .lanceur__libelle, .panneau, .accuse, .carte, .micro__bouton {
    transition: none !important;
    animation: none !important;
  }

  /* Le halo ne respire plus : l’état d’enregistrement reste dit par la couleur
     ET par la légende, jamais par la couleur seule. */
  .micro__bouton[aria-pressed='true'] { box-shadow: 0 0 0 6px var(--w-rec-halo) }
}
`

/** La feuille complète : les tokens, puis les règles. */
export const FEUILLE = `${TOKENS}${REGLES}`

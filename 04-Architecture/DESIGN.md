# Direction artistique

Deux interfaces, deux régimes opposés. **Le widget est un invité chez quatre hôtes différents** :
il doit être neutre, léger, et rhabillable. **Le back-office est chez lui** : une seule personne,
deux visites par jour, il peut avoir un caractère.

---

# 1. Le widget

## Le principe : neutre par défaut, rhabillable par l’hôte

Le widget s’injecte dans VictorIA (bleu Serenity), le portail CGP, VIXIS et OrelSign. Il ne peut
ressembler à aucun d’eux, et il ne doit jurer avec aucun.

⛔ **Pas de couleur de marque Feedys dans l’interface.** Le widget n’a pas à se faire remarquer :
il n’est pas un produit qu’on vend au collaborateur, c’est un outil qu’on lui prête.

La stratégie qui en découle : **achromatique par défaut**, une seule couleur d’accent que l’hôte
surcharge, et une seule couleur de signal — celle de l’enregistrement — qui ne se surcharge pas.

```css
/* l’hôte peut poser ceci n’importe où dans sa page */
feedys-widget {
  --feedys-accent: #00558C;      /* VictorIA reprend son bleu */
  --feedys-rayon: 8px;
  --feedys-ancrage: 24px;
}
```

⛔ **Tout le reste est verrouillé.** On n’expose pas une API de thème complète : un widget
entièrement rhabillable est un widget qu’on rend illisible par accident, et dont on ne peut plus
prédire l’accessibilité.

## Les tokens

```css
:host {
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
  --w-ombre:       0 1px 2px rgba(20,24,29,.06), 0 12px 32px -12px rgba(20,24,29,.28);

  /* — rythme : une seule échelle, multiples de 4 — */
  --w-1: 4px;  --w-2: 8px;  --w-3: 12px;
  --w-4: 16px; --w-6: 24px; --w-8: 32px;
}

@media (prefers-color-scheme: dark) {
  :host { --w-fond: #171B20; --w-fond-2: #1F242B; --w-bord: #2C333C;
          --w-encre: #EAEDF1; --w-encre-2: #B3BCC7; --w-encre-3: #808B98; }
}
```

⚠️ **`--w-rec` ne se surcharge pas, et c’est délibéré.** Le rouge d’enregistrement est un code
universel, compris sans apprentissage. Laisser un hôte le repeindre en vert détruirait la seule
convention sur laquelle le produit s’appuie gratuitement.

## ⛔ Aucune police web

Le widget utilise **la pile système**, point.

```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
             "Helvetica Neue", Arial, sans-serif;
```

Trois raisons, et la première suffit : charger une police depuis la page d’autrui, c’est ajouter
une requête bloquante et un tiers à un logiciel qui n’a rien demandé. Ensuite, ça pèse dans le
budget de 60 Ko. Enfin, la pile système **ressemble déjà à l’hôte**, ce qui sert exactement notre
objectif de discrétion.

Une seule échelle : `13px` (méta), `14px` (courant), `16px` (question du bot), `18px/600` (titre du
panneau). Rien d’autre.

## L’écran qui fait le produit : « j’écoute »

C’est le seul endroit où il faut vraiment dessiner. Tout le reste est du chat, un objet codifié
qu’on copie de près.

**Le geste de référence est la note vocale de WhatsApp.** Ce n’est pas une inspiration, c’est une
décision : ce geste est connu de tout le monde, il ne s’apprend pas, et le réinventer serait une
faute pure.

```
    ┌───────────────────────────────────────────┐
    │                                           │
    │      ▁▃▅█▇▄▂▁▂▄▆█▅▃▁▂▃▅▄▂                 │   onde réelle, 60 fps
    │                                           │
    │   « le tri par date là sur la liste des   │   transcript en direct
    │     dossiers dès que je reviens en        │   aria-live="polite"
    │     arrière il se remet à zéro… »         │
    │                                           │
    │   ← glisser pour annuler          0:24    │
    │                                           │
    │        ╭─────────────────╮                │
    │        │  ●  maintenir   │                │   halo qui respire
    │        ╰─────────────────╯                │
    └───────────────────────────────────────────┘
```

Cinq exigences, dans l’ordre d’importance :

1. ⛔ **L’onde réagit vraiment à la voix.** Elle est calculée depuis l’`AnalyserNode` de la Web
   Audio API, jamais animée en boucle. Une onde fausse se repère en une seconde, et elle discrédite
   tout le reste de l’interface — si ça ment ici, pourquoi croire que le retour part ?
2. **Le transcript s’écrit en direct, sous l’onde.** C’est la preuve que ça fonctionne, et ça
   permet de corriger sans réécouter.
3. **Le halo respire lentement** (1,6 s, `ease-in-out`), il ne clignote pas. Le clignotement dit
   l’urgence ; on veut dire l’attention.
4. **« Glisser pour annuler » apparaît dès le premier son**, pas avant. Un texte affiché à vide est
   du bruit.
5. **Le compteur n’apparaît qu’après 30 s**, discret, sans couleur. Il informe, il ne presse pas.

## La carte de compréhension

L’autre écran neuf. Ce n’est **pas un message de chat** : c’est une fiche dont chaque champ se
corrige sur place, d’un clic.

Traitement visuel : fond `--w-fond-2`, bord `--w-bord`, pas d’ombre — elle est **posée dans** le
fil, pas au-dessus. Les libellés de champs en `--w-encre-3`, `11px`, majuscules, `letter-spacing:
.06em`. Au survol d’un champ, un fond subtil et un crayon apparaissent : l’affordance doit être
découverte sans mode d’emploi.

⚠️ **La carte n’a pas de bouton « valider ».** On corrige, ça enregistre. Un bouton de validation
ferait croire qu’on remplit un formulaire — l’exact contraire du message.

## Le mouvement

Peu, court, et jamais décoratif.

| Ce qui bouge | Durée | Motif |
|---|---|---|
| Ouverture du panneau | 180 ms, `cubic-bezier(.32,.72,0,1)` | dire d’où ça vient |
| Halo d’enregistrement | 1,6 s en boucle | dire qu’on écoute |
| Apparition de la carte | 140 ms, fondu + 4 px | dire qu’une chose nouvelle est là |
| Envoi | 200 ms | conclure |

⛔ Rien d’autre ne bouge. Pas de rebond, pas de `spring`, pas d’entrée en cascade des messages.

⛔ **`prefers-reduced-motion: reduce` supprime tout sauf l’onde** — qui est de l’information, pas
de la décoration, et qui est donc conservée.

---

# 2. Le back-office

Régime inverse : un seul lecteur, connu, qui vient chercher une information précise. On peut
avoir du caractère, et on doit avoir de la densité.

- **Base** : Next.js + `shadcn` (composants de chat de juin 2026 : `MessageScroller`, `Message`,
  `Bubble`, `Attachment`, `Marker`). ⚠️ Prendre la variante **Base UI**, pas Radix — c’est celle
  qui a un avenir et qui s’aligne sur les autres projets de l’auteur.
- **Typographie** : là, une police web est légitime. Titres en **Montserrat**, corps et données en
  **IBM Plex Sans**, verbatims et technique en **IBM Plex Mono**.
- **Couleur** : neutres froids, un seul accent. Les **types** de retour sont distingués par une
  pastille de forme et de texte, ⛔ **jamais par la couleur seule**.

## La règle qui gouverne la fiche

**Le fil brut n’est jamais replié.** La synthèse est une lecture ; la source est ce que la
personne a dit. Cacher la source derrière un « voir les détails » revient à décider que la
reformulation du modèle vaut mieux que la parole d’origine.

Ordre imposé sur la fiche : **synthèse → fil de l’entretien → contexte et capture.**

## Les verbatims

Traitement typographique distinct — mono, léger retrait, filet à gauche. Ce sont des **pièces**,
pas de la prose. Le lecteur doit voir au premier coup d’œil ce que la personne a dit et ce que le
modèle en a fait.

---

# Ce qui vaut pour les deux

- ⛔ **Aucun HEX en dur dans un composant.** Tokens uniquement.
- ⛔ **L’apostrophe s’écrit `’` (U+2019)**, jamais `'` ni `&apos;` — texte, chaînes, expressions
  régulières. Une entité HTML dans un nœud JSX mange l’espace de tête du nœud.
- **Français partout** : libellés, erreurs, états vides, emails.
- **AA minimum**, y compris sur l’état d’écoute — c’est celui qu’on est tenté de dessiner en gris
  clair sur fond clair.
- **La console du navigateur est un résultat de test.** Un parcours échoue sur une erreur de
  console.
- **Les états vides sont des écrans**, pas des phrases grises. « Aucun retour pour l’instant » est
  le premier écran que le développeur verra : il doit dire quoi faire ensuite.

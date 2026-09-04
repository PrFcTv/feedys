# Spécification — le widget

Le widget est **le seul morceau de Feedys que verront les collaborateurs**. Il s’exécute dans une
page qui ne lui appartient pas, à côté d’un logiciel qu’il ne doit ni ralentir ni casser.

## L’intégration

Une ligne, dans le logiciel hôte :

```html
<script src="https://feedys.exemple.fr/widget.js" data-cle="fdy_pub_a1b2c3" defer></script>
```

Et, si l’hôte veut attacher une identité — recommandé, voir [D-005](../00-Projet/DECISIONS_LOG.md) :

```html
<script>
  window.feedys = { identite: "<jeton signé par le serveur de l’hôte>" }
</script>
```

⛔ **Pas de paquet npm, pas d’import, pas de composant React à monter.** C’est la contrainte de
licence de [D-001], et elle est structurelle : voir [04-Architecture/licences.md].

## Les règles d’occupation

Le widget est un invité. Cinq obligations :

1. ⛔ **Il ne bloque jamais le chargement de l’hôte.** `defer`, aucune requête synchrone, aucun
   travail avant l’interaction. Le premier appel réseau a lieu quand on **clique**, pas au
   chargement.
2. ⛔ **Il vit dans un shadow DOM fermé.** Aucun style ne fuit dans les deux sens, aucune globale
   n’est posée hors de `window.feedys`.
3. ⛔ **Il ne capte aucun raccourci clavier de l’hôte** tant qu’il est fermé. `Échap` ne lui
   appartient que panneau ouvert.
4. **Budget : 60 Ko gzip pour `widget.js`.** Dépassement = arbitrage explicite, pas un
   glissement. C’est ce budget qui a décidé Preact ([D-004]).
5. **Il survit à `pnpm widget:demo`** — une fausse application hôte volontairement hostile : reset
   CSS global, `!important` partout, une modale à `z-index: 9999`. C’est le seul environnement de
   recette valable.

## Les états

### Fermé — le lanceur

Une pastille discrète, ancrée en bas à droite par défaut, déplaçable par configuration.

- Elle ne pulse pas, ne rebondit pas, n’affiche pas de badge. Rien ne réclame l’attention.
- Au survol, elle s’élargit et révèle son libellé : **« Un retour »**.
- ⛔ Pas de bulle d’accueil automatique. Jamais de « Besoin d’aide ? » qui s’ouvre tout seul.

### Ouvert — l’accueil

Le panneau s’ouvre. **Le micro est déjà armé, l’enregistrement non.** Le collaborateur voit :

```
┌─────────────────────────────────────────┐
│  Qu’est-ce qui se passe ?           ✕   │
│                                         │
│                                         │
│         [ 🎙 ]                          │
│    maintenir pour parler                │
│                                         │
│    ─────────  ou  ─────────             │
│    [ écrire à la place            ]     │
└─────────────────────────────────────────┘
```

⚠️ **Le champ texte est au même niveau de visibilité que le micro**, pas caché derrière un lien.
Quelqu’un en open space doit pouvoir écrire sans avoir l’impression de contourner le produit.

Sur un navigateur sans Web Speech, le bloc micro **disparaît sans un mot** et le champ texte prend
toute la place. On ne s’excuse pas d’une absence.

### En écoute — l’écran qui fait le produit

C’est **le seul écran à dessiner vraiment**. Le geste est celui de la note vocale, que tout le
monde connaît sans l’avoir appris :

- **maintenir** pour parler, **relâcher** pour terminer ;
- **glisser vers la gauche** pour annuler — avec le seuil et le retour visuel qui vont avec ;
- un **clic simple** bascule en mode mains libres, pour les retours longs ; on arrête par un
  second clic ou par deux secondes de silence.

Pendant l’écoute :

- une **onde en direct** qui réagit vraiment à la voix — pas une animation en boucle. Une onde
  fausse se repère en une seconde et détruit la confiance dans tout le reste ;
- **le transcript s’écrit en dessous, en direct.** C’est ce qui prouve que ça marche, et ce qui
  permet de corriger sans réécouter ;
- un compteur discret au-delà de trente secondes. Pas d’alerte, pas de limite.

⛔ **Aucun envoi automatique depuis cet état.** On relâche, on relit, on envoie.

### En entretien

Voir [entretien.md] pour le comportement du bot. Côté widget :

- la **carte de compréhension** est corrigeable en place, champ par champ ;
- la question du bot apparaît **sous** la carte, jamais dedans ;
- micro et champ texte restent disponibles pour répondre ;
- **« Envoyer maintenant »** est présent à chaque tour, sans exception.

### Envoyé

Un accusé sobre, deux secondes, puis fermeture automatique.

> **C’est parti.** Merci — vous n’avez rien d’autre à faire.

⛔ Pas de numéro de suivi, pas de « vous serez notifié », pas de lien vers un statut. On ne promet
rien qu’on ne tiendra pas ([entretien.md] §règle 4).

## Ce que le widget joint tout seul

Sans jamais le demander, et **en le montrant** — la carte de compréhension affiche l’écran déduit,
ce qui rend la collecte visible plutôt que subie :

| Donnée | Source |
|---|---|
| URL, titre de page, écran | `location`, `document.title` |
| Composant visé | sélecteur DOM de l’élément survolé à l’ouverture |
| Navigateur, système, taille de fenêtre | `navigator`, `window` |
| Capture d’écran | `snapdom`, au moment de l’ouverture |
| Identité, rôle | le jeton signé fourni par l’hôte ([D-005]) |
| Horodatage, fuseau | client, revérifié serveur |

⛔ **Rien d’autre.** Pas de cookies, pas de stockage local persistant au-delà du brouillon en
cours, pas de suivi entre les sessions, aucun pixel. Le dépôt est public : cette liste doit
pouvoir être lue par n’importe qui sans gêne.

## Accessibilité — non négociable

Le widget est utilisé toute la journée par des gens qui n’ont pas choisi de l’avoir.

- **Tout le parcours est faisable au clavier**, dictée comprise (`Espace` maintenu vaut appui).
- Le panneau est une boîte de dialogue modale correcte : focus piégé, `Échap` ferme, focus rendu
  au lanceur.
- L’onde et les transitions respectent `prefers-reduced-motion`.
- Contrastes AA minimum, y compris dans l’état d’écoute — c’est celui qu’on est tenté de dessiner
  en gris clair.
- Le transcript en direct est annoncé en `aria-live="polite"`.

## Ce que le widget ne fait jamais

- Il ne s’ouvre pas tout seul, jamais, sous aucune condition.
- Il n’affiche pas d’autres retours, ni les siens, ni ceux des collègues.
- Il ne demande pas de note, d’étoiles, ni de NPS.
- Il ne relance pas par une notification.
- Il ne fonctionne pas hors ligne — mais il **conserve le brouillon en cours** et le renvoie à la
  reconnexion, sans rien demander.

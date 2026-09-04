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

Deux attributs, et rien d’autre :

| Attribut | Rôle |
|---|---|
| `data-cle` | **obligatoire** — la clé publique du produit. ⛔ Un secret (`fdy_sec_…`) posé ici fait **refuser le démarrage** : il est lisible par tout le monde, il faut le révoquer, pas s’en servir |
| `data-position` | `bas-droite` (défaut) ou `bas-gauche` |

⚠️ **Le widget complète `window.feedys`, il ne l’écrase pas.** L’hôte y a posé son jeton d’identité
avant que le script ne s’exécute ; le widget y ajoute `version`, `ouvrir()` et `fermer()`. C’est sa
**seule** globale — et la raison pour laquelle le point d’entrée du paquet n’exporte rien : un
`export` ferait fabriquer à Rollup une variable globale `feedys` qui écraserait le jeton, sans un
mot. Vérifié par `packages/widget/src/budget.test.ts`.

⚠️ **Si la balise est mal recopiée** — clé absente, secret en clair, `src` illisible — le widget ne
monte pas et écrit **une** ligne dans la console. C’est le seul message qu’il y écrira jamais, et
il s’adresse à l’intégrateur : sans lui, une balise fautive ne produit rien du tout, et personne ne
sait pourquoi.

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
   glissement. C’est ce budget qui a décidé Preact ([D-004]), et c’est lui qui a sorti snapdom du
   bundle ([D-011](../00-Projet/DECISIONS_LOG.md)).
   ⚠️ **Relevé au 2026-09-04, après P-004** : la collecte de contexte entière coûte **2,9 Ko gzip**.
   ⛔ Elle en coûtait **26 Ko** avant qu’on sorte les constantes de `contrat.ts` — zod suivait par
   un seul `import { BORNES }`. `packages/widget/src/budget.test.ts` empêche la rechute.
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

⛔ **Aucun envoi automatique depuis cet état.** On relâche, on relit, on envoie. Le bouton
**Envoyer** n’existe même pas pendant l’écoute : le transcript rejoint le champ texte, et c’est de
là qu’on part.

⚠️ **L’arrêt sur silence est calculé, pas modélisé** ([D-012](../00-Projet/DECISIONS_LOG.md)). Le
plancher sonore est mesuré sur les premières centaines de millisecondes, puis suivi vers le bas :
un seuil fixe échouerait en open space, c’est-à-dire là où le produit vit. ⚠️ Le biais est assumé —
on préfère **ne pas s’arrêter** que s’arrêter trop tôt : un arrêt manqué coûte un clic, un arrêt
prématuré coupe quelqu’un au milieu d’une phrase.

Au clavier :

- **`Espace` maintenu** vaut l’appui, et un appui bref vaut le clic simple — donc les mains libres.
- **`Échap` annule la dictée**, et ne ferme pas le panneau. Deux pressions pour sortir : la
  première jette ce qui vient d’être dit, la seconde ferme. ⚠️ « Glisser vers la gauche » n’a pas
  de sens au clavier : l’écran affiche alors « Échap pour annuler », pas la consigne de l’autre.

⚠️ **Si le micro est refusé**, l’écoute continue — Web Speech ouvre sa propre capture — mais sans
onde ni arrêt sur silence. C’est le **seul** cas où le widget dit quelque chose à ce sujet, parce
que l’absence d’onde ressemblerait sinon à une panne. ⛔ Il ne s’excuse toujours pas : le champ
texte est resté à un clic.

### En entretien

Voir [entretien.md] pour le comportement du bot. Côté widget :

- la **carte de compréhension** est corrigeable en place, champ par champ ;
- la question du bot apparaît **sous** la carte, jamais dedans ;
- micro et champ texte restent disponibles pour répondre ;
- **« Envoyer maintenant »** est présent à chaque tour, sans exception.

Deux boutons, et un seul est primaire :

| Bouton | Ce qu’il fait |
|---|---|
| **Répondre** | envoie la réponse et les corrections, demande le tour suivant. Désactivé quand il n’y a rien à envoyer |
| **Envoyer maintenant** | termine l’entretien. ⛔ **Jamais désactivé pendant un entretien**, champ vide compris |

⛔ **La carte n’a pas de bouton « valider ».** On corrige, ça part avec le tour suivant ou avec
l’envoi. Un bouton de validation ferait croire qu’on remplit un formulaire — l’exact contraire du
message ([DESIGN.md](../04-Architecture/DESIGN.md)).

⚠️ **Quand le bot n’a plus de question, le widget envoie tout seul.** On ne retient personne : la
carte mise à jour, puis l’accusé. Et **si le modèle ne répond pas, la carte n’apparaît pas** — le
champ texte reste, « Envoyer » fonctionne, et le widget ne s’excuse pas.

⚠️ **Refermer le panneau en cours d’entretien n’est pas une perte** : le retour est conservé et
envoyé en l’état, marqué `abandonne`. Quitter l’onglet non plus — l’abandon part en `keepalive`.

### Envoyé

Un accusé sobre, deux secondes, puis fermeture automatique — et le focus revient au lanceur.

> **C’est parti.** Merci — vous n’avez rien d’autre à faire.

⛔ Pas de numéro de suivi, pas de « vous serez notifié », pas de lien vers un statut. On ne promet
rien qu’on ne tiendra pas ([entretien.md] §règle 4).

## Ce que le widget joint tout seul

Sans jamais le demander, et **en le montrant** — la carte de compréhension affiche l’écran déduit,
ce qui rend la collecte visible plutôt que subie :

| Donnée | Source | Champ |
|---|---|---|
| URL, titre de page, écran | `location`, `document.title` | `url`, `titrePage`, `ecran` |
| Composant visé | sélecteur DOM de l’élément survolé à l’ouverture | `selecteurDom` |
| Navigateur, système, taille de fenêtre | `navigator`, `window` | `navigateur`, `systeme`, `viewportL/H`, `agentBrut` |
| Capture d’écran | `@zumer/snapdom`, au moment de l’ouverture | `capture` |
| Identité, rôle | le jeton signé fourni par l’hôte ([D-005]) sur `window.feedys.identite` | en-tête `x-feedys-identite` |
| Horodatage, fuseau | client, revérifié serveur | `horodatage`, `fuseau` |

⚠️ **Le jeton d’identité est relu à chaque envoi**, jamais mémorisé au chargement : une
application métier qui rafraîchit la session de quelqu’un remplace son jeton en cours de route.
⛔ Le widget ne signe, ne vérifie et ne comprend RIEN de ce jeton — il recopie une chaîne dans un
en-tête. Signer côté navigateur demanderait le secret du produit dans la page, ce qui reviendrait
à ne rien signer du tout. Et son absence ne change rien au parcours : le retour part pareil, et
arrive simplement sans auteur ([ingestion.md](ingestion.md) §L’identité signée).

⛔ **Rien d’autre.** Pas de cookies, pas de stockage local persistant au-delà du brouillon en
cours, pas de suivi entre les sessions, aucun pixel. Le dépôt est public : cette liste doit
pouvoir être lue par n’importe qui sans gêne.

⛔ **La liste est close des deux côtés** : le contrat de transport
(`packages/widget/src/contexte`, `packages/widget/src/contrat.ts`) refuse tout champ inconnu, et
le serveur répond `400`. Ajouter une donnée est donc une décision de produit, jamais un détail
d’implémentation.

⚠️ **`agentBrut` porte la chaîne d’agent entière**, plus la langue et la densité de pixels — trois
valeurs de `navigator` et `window`, déjà couvertes par la ligne ci-dessus. Elle y est en entier
parce que `navigateur` la résume en « Chrome 141 », et qu’un résumé perd ce dont on aura besoin le
jour d’un bug qui ne se produit que sur une version.

⚠️ **L’URL est expurgée avant d’être jointe.** Une URL de logiciel métier porte parfois un jeton
de session ; il finirait en base, dans un email, puis dans une note lue par un agent de code. Une
vingtaine de noms de paramètres — `token`, `secret`, `password`, `session`, `signature`… — voient
leur valeur remplacée par `[expurgé]`, dans la requête comme dans le fragment. ⚠️ **Ceci collecte
moins, pas plus.**

⚠️ **Ce que la capture n’est pas.** Elle est redimensionnée à 1 280 px de large au plus, encodée
en webp, et plafonnée à 300 Ko : c’est un aide-mémoire, pas une preuve. Si rien ne tient sous le
plafond, **le retour part sans image** — comme lorsqu’un canvas est « tainted » par une image
d’un autre domaine.

⚠️ **`@zumer/snapdom` n’est pas dans le bundle** : 52 Ko gzip contre un budget de 60. Il est servi
par Feedys sous `/snapdom.js` et chargé à l’ouverture du panneau — jamais au chargement de la page
de l’hôte. Voir [D-011](../00-Projet/DECISIONS_LOG.md).

⚠️ **Ce qu’on garde de l’élément survolé est un CHEMIN, pas du contenu** : ni son texte, ni celui
de ses voisins, ni sa valeur. Le développeur a la capture pour voir ce qu’il y avait dedans.

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

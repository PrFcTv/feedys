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
| `data-indices` | `non` coupe le relevé des indices techniques ([D-026]). Absent = actif — voir §Les indices techniques |

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

1. ⛔ **Il ne bloque jamais le chargement de l’hôte.** `defer`, aucune requête synchrone. Le
   premier appel réseau a lieu quand on **clique**, pas au chargement.
   ⚠️ **« Aucun travail avant l’interaction » a été renversé par [D-026]**, et il faut le dire :
   le relevé des indices techniques pose deux écouteurs passifs et un `PerformanceObserver` au
   montage, parce qu’un collecteur qui n’écoute qu’à partir du clic n’a rien à raconter. ⛔ Il ne
   fait **aucune** requête, aucune écriture, aucun travail au fil de l’eau. Voir §Les indices
   techniques.
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

- Elle ne pulse pas et ne rebondit pas. Rien ne réclame l’attention.
- ⚠️ **Une exception, et une seule** : une pastille apparaît dans le coin supérieur du lanceur
  si une réponse à un retour précédent attend d’être lue
  ([retour-au-collaborateur.md](retour-au-collaborateur.md)). C’est un badge de non-lus, et la
  spécification l’interdisait jusqu’à P-020 : le renversement est assumé et argumenté en
  [D-021](../00-Projet/DECISIONS_LOG.md). ⛔ Elle ne compte pas, ne s’anime pas, n’apparaît que
  sur un geste du développeur, et disparaît définitivement au premier regard. Si l’une de ces
  quatre conditions tombe, c’est D-021 qu’il faut rouvrir.
- Au survol, elle s’élargit et révèle son libellé : **« Un retour »**.
- ⛔ Pas de bulle d’accueil automatique. Jamais de « Besoin d’aide ? » qui s’ouvre tout seul.

### Ouvert — l’accueil

Le panneau s’ouvre. Si le collaborateur a une réponse en attente de lecture, une carte sobre
s’affiche en tête du corps :
- « Votre retour sur « [Titre] » a été pris en compte. » (ou « Votre retour a été pris en compte. ») ;
- Le mot du développeur s’il a été renseigné ;
- Un bouton unique : **« J’ai vu »**, qui accuse réception et retire la carte.
- ⛔ **Strictement à sens unique** : aucun champ de saisie de réponse, aucun fil de discussion, aucun bouton de relance.

**Le micro est déjà armé, l’enregistrement non.** Le collaborateur voit :

```
┌─────────────────────────────────────────┐
│  Qu’est-ce qui se passe ?           ✕   │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ Votre retour sur « … » a été pris │  │
│  │ en compte.                        │  │
│  │ Corrigé ce matin.     [ J’ai vu ] │  │
│  └───────────────────────────────────┘  │
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
  second clic ou par **cinq secondes** de silence.

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

⛔ **Cinq secondes, et pas deux.** La valeur d’origine ne respectait pas ce biais : quelqu’un qui
décrit un bug s’interrompt pour chercher ses mots — « alors, le bouton… euh… » — et deux secondes
de réflexion sont ordinaires. La première dictée réelle l’a montré
([D-017](../00-Projet/DECISIONS_LOG.md), [BUGS_LOG](../03-Bugs/BUGS_LOG.md) 008). ⚠️ Qui a fini
n’attend pas cinq secondes : le second clic et « Envoyer maintenant » sont visibles en permanence.

Au clavier :

- **`Espace` maintenu** vaut l’appui, et un appui bref vaut le clic simple — donc les mains libres.
- **`Échap` annule la dictée**, et ne ferme pas le panneau. Deux pressions pour sortir : la
  première jette ce qui vient d’être dit, la seconde ferme. ⚠️ « Glisser vers la gauche » n’a pas
  de sens au clavier : l’écran affiche alors « Échap pour annuler », pas la consigne de l’autre.

⚠️ **Si le micro est refusé**, l’écoute continue — Web Speech ouvre sa propre capture — mais sans
onde ni arrêt sur silence. C’est le **seul** cas où le widget dit quelque chose à ce sujet, parce
que l’absence d’onde ressemblerait sinon à une panne. ⛔ Il ne s’excuse toujours pas : le champ
texte est resté à un clic.

#### ⛔ Chrome coupe la reconnaissance tout seul — c’est nous qui la relançons

`SpeechRecognition` rend la main de lui-même après un silence, `continuous` ou pas. ⚠️ Et
`speech-to-element` **ne le rattrape pas** : son `onend` remet un drapeau à zéro, rien de plus.
Le dépôt a longtemps affirmé le contraire, et c’est ce qui a coûté
[BUGS_LOG](../03-Bugs/BUGS_LOG.md) 007.

Le comportement attendu, désormais tenu par des tests :

- **le moteur qui rend la main est relancé**, en conservant le transcript déjà acquis. La personne
  ne s’aperçoit de rien : elle parle, ça continue de s’écrire ;
- ⛔ **avec un plafond** — trois relances stériles d’affilée, remis à zéro dès qu’un mot arrive.
  Sans lui, un micro débranché ferait tourner une boucle de relances dans la page de l’hôte ;
- passé le plafond, le widget **sort de l’écoute et rend ce qui a été capté**. ⛔ Il ne laisse
  jamais l’écran « j’écoute » ouvert sur un moteur muet : l’onde bougerait, le micro serait allumé,
  et plus rien ne serait transcrit. Un écran qui ment est pire qu’un écran qui s’arrête.

#### ⛔ Le transcript provisoire fait partie de la parole

Web Speech n’**arrête** un segment qu’aux pauses. Tant qu’il n’a rien arrêté, la phrase en cours
vit **uniquement** dans le provisoire — celui qui s’écrit sous l’onde.

⛔ **Terminer une écoute rend donc le définitif ET le provisoire**, recollés. Ne lire que le
définitif, c’est effacer la phrase de quelqu’un au moment précis où il vient de la dire, et le
renvoyer à l’accueil les mains vides. C’est exactement ce que le produit promet de ne jamais faire.

⚠️ **Une annulation, elle, jette tout** — provisoire compris. C’est tout l’intérêt du geste.

### En entretien

Voir [entretien.md] pour le comportement du bot. Côté widget :

- la **carte de compréhension** est corrigeable en place, champ par champ ;
- la question du bot apparaît **sous** la carte, jamais dedans ;
- micro et champ texte restent disponibles pour répondre ;
- **« Envoyer maintenant »** est présent à chaque tour, sans exception.

#### Les réponses d’un clic

Quand le bot déclare un **axe** ([entretien.md] §La réponse d’un clic), trois boutons apparaissent
**sous la question et au-dessus du bloc micro**. Un clic **envoie le tour** — pas de sélection à
confirmer : deux clics supprimeraient le seul bénéfice de l’affaire.

⛔ **Ce n’est pas un choix obligatoire**, et rien à l’écran ne doit le suggérer : pas de
`radiogroup`, pas d’état sélectionné, pas de bouton « Autre », pas de bouton « valider ». Le champ
texte et le micro restent en dessous, au même niveau de visibilité.

⛔ **Ils disparaissent pendant l’écoute**, comme le pied de panneau : « on relâche, on relit, on
envoie ». Un bouton qui envoie pendant qu’on parle couperait le geste.

⚠️ **Un clic emporte ce qui était en cours d’écriture**, comme « Répondre ». Quelqu’un qui a
commencé une phrase puis clique sur un bouton n’a pas voulu la jeter.

⚠️ **Les libellés sont écrits dans le widget**, jamais rendus par le serveur : ce qui voyage sur le
fil est la **valeur** (`systematique`), pas le mot ([D-025](../00-Projet/DECISIONS_LOG.md)).

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

⛔ **La fermeture automatique remet le panneau à neuf** — fiche, question, avis, attente. Rouvrir la
bulle pour signaler autre chose ne doit RIEN montrer de l’entretien précédent
([BUGS_LOG](../03-Bugs/BUGS_LOG.md) 010).

⚠️ **Et un tour encore en vol quand l’entretien se termine n’écrit plus rien à l’écran.** Il revient
parfois après la fermeture — il posait alors sa fiche et sa question sur l’écran d’accueil.

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
| Indices techniques | exceptions et requêtes en erreur relevées avant l’ouverture ([D-026]) | `indices` |

⚠️ **Le jeton d’identité est relu à chaque envoi**, jamais mémorisé au chargement : une
application métier qui rafraîchit la session de quelqu’un remplace son jeton en cours de route.
⛔ Le widget ne signe, ne vérifie et ne comprend RIEN de ce jeton — il recopie une chaîne dans un
en-tête. Signer côté navigateur demanderait le secret du produit dans la page, ce qui reviendrait
à ne rien signer du tout. Et son absence ne change rien au parcours : le retour part pareil, et
arrive simplement sans auteur ([ingestion.md](ingestion.md) §L’identité signée).

⛔ **Rien d’autre.** Pas de cookies, pas de stockage local persistant au-delà du brouillon en
cours, pas de suivi entre les sessions, aucun pixel, **aucune trace de console**. Le dépôt est
public : cette liste doit pouvoir être lue par n’importe qui sans gêne.

⚠️ **« Aucune trace de réseau » a été renversé par [D-026]**, et la nuance est tout : ce qui entre
est le **statut** et le **chemin normalisé** d’une requête revenue en erreur — jamais sa requête,
jamais son corps, jamais ses en-têtes. Et côté exceptions, jamais le message. §Les indices
techniques dit ce que le collecteur s’interdit, et pourquoi.

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

## Les indices techniques

**Ce que le navigateur a relevé avant qu’on ouvre la bulle**, parce que « j’ai cliqué sur valider
et rien ne s’est passé » se résout en trente secondes quand on voit le 500 qui l’accompagnait, et
en une heure sinon. La décision entière, avec ses contreparties : [D-026](../00-Projet/DECISIONS_LOG.md).

⚠️ **Ceci renverse la règle d’occupation n°1 ci-dessus** — « aucun travail avant l’interaction ».
Un collecteur qui n’écoute qu’à partir du clic n’a rien à raconter. Ce qu’il coûte réellement :
deux `addEventListener` passifs et un `PerformanceObserver`, **2,3 Ko gzip** (relevé le
2026-09-09). ⛔ La seconde moitié de la règle reste vraie mot pour mot : **le premier appel réseau
a toujours lieu au clic.**

| Ce qui est relevé | Ce qui est joint |
|---|---|
| Exception non capturée, rejet de promesse | `genre: js`, le **nom** (`TypeError`) et la **première trame** (`valider (app.js:12:34)`) |
| Requête revenue en 4xx/5xx | `genre: http`, le statut et le **chemin normalisé** (`/api/dossiers/:id/valider`) |
| Ce que l’hôte pousse lui-même | en plus : la méthode, et une **référence de corrélation** |

⛔ **Jamais le message d’une exception.** `error.message` est écrit par le code de l’hôte, et
« *Le dossier de M. Dupont (n° 4417) est verrouillé par Marie Lefèvre* » est une phrase qu’un
logiciel métier lève tous les jours. Le contrat n’a pas de champ où la mettre, la base n’a pas de
colonne, et un corps qui en porterait un est **refusé en 400** — pas ignoré.

⛔ **Jamais la requête d’une URL, jamais un corps de réponse, jamais la console.** Et les segments
identifiants du chemin sont remplacés par `:id`, avec la liste de `contexte/ecran.ts` : sans ça, le
chemin serait de la donnée métier, pas une adresse.

⛔ **Ni `window.onerror`, ni `fetch` enveloppé.** On écoute en `addEventListener`, qui est additif —
beaucoup d’applications métier posent déjà le leur. Et on lit `PerformanceObserver`, qui n’altère
rien : envelopper le `fetch` de son hôte quand on est un invité, c’est entrer dans sa chaîne de
wrappers et devenir le suspect n°1 de son prochain bug.

⚠️ **Trois au plus, bornés par l’ÉCRAN et non par une durée**, chacun daté de son écart
(« il y a 3 s »). Un poste de bureau garde un onglet ouvert huit heures : un seuil de soixante
secondes jetterait l’erreur de quelqu’un qui a hésité quatre minutes. Le plafond de trois est
appliqué **par le serveur**, comme la limite de deux relances.

⚠️ **`responseStatus` n’existe que sur Chromium** — l’univers déjà arrêté par [D-003] pour la
dictée. Ailleurs, aucun indice `http` n’est relevé, et rien ne se casse.

### Montré, décochable, et refusable par l’hôte

⛔ **Le panneau dit ce qu’il joint** : « Joindre 2 indices techniques relevés · voir », dépliable
sur exactement ce qui part, décochable. C’est le même principe que l’écran déduit affiché sur la
carte — **la collecte se voit, elle ne se subit pas**. Un relevé joint sans être montré serait son
exact inverse.

⚠️ Décocher **retire le champ**, il ne l’envoie pas vide : « rien n’a été relevé » et « quelqu’un a
refusé de joindre » ne se confondent pas, et la seconde ne nous regarde pas.

⚠️ **`data-indices="non"`** sur la balise coupe tout, sans redéploiement de notre part. Seul `non`
coupe : une faute de frappe ne doit pas désactiver en silence ce que la fiche montre.

### Ce que l’hôte peut pousser lui-même

⛔ **Nécessaire, pas facultatif** : une error boundary React **avale** l’exception de rendu, qui ne
remonte alors jamais à `window`. Dans une application métier correctement écrite, l’écran blanc ne
produit **aucun** indice passif.

```js
// Depuis componentDidCatch, un intercepteur axios, un onError…
window.feedys.indice({ genre: 'js', nom: 'TypeError', reference: 'a1b2c3' })

// Avant même que widget.js soit chargé — il est en `defer` :
;(window.feedys = window.feedys || {}).indices ||= []
window.feedys.indices.push({ genre: 'http', statut: 500, chemin: '/api/factures', methode: 'POST' })
```

⚠️ **La `reference` est le champ le plus utile, et le plus léger.** C’est l’identifiant de
corrélation de l’outil de l’hôte — id Sentry, `trace_id`, `request_id` —, rendu cliquable dans le
back-office par `pnpm produit:creer -- --observabilite "https://…?q={{ref}}"`. Elle emmène le
développeur vers **sa** pile démappée. ⛔ Et Feedys ne l’appelle jamais, pas plus qu’il n’appelle
la forge ([D-024]).

⛔ **Rien de ce qui est poussé n’est cru** : genre inconnu, statut hors plage, pile de 40 Ko,
objet absurde — tout est relu, borné ou jeté, sans exception et sans faire refuser le retour.

### ⛔ Ce que les indices ne couvrent pas

Écrit ici pour que ça ne revienne pas en bug : **les iframes et les web workers** (un écouteur du
document parent ne les voit pas), **les exceptions d’avant le chargement** du widget, et **la
console**. Voir [TICKETS_DIFFERES](../00-Projet/TICKETS_DIFFERES.md) T-010.

## Accessibilité — non négociable

Le widget est utilisé toute la journée par des gens qui n’ont pas choisi de l’avoir.

- **Tout le parcours est faisable au clavier**, dictée comprise (`Espace` maintenu vaut appui).
- Le panneau est une boîte de dialogue modale correcte : focus piégé, `Échap` ferme, focus rendu
  au lanceur.
- L’onde et les transitions respectent `prefers-reduced-motion`.
- Contrastes AA minimum, y compris dans l’état d’écoute — c’est celui qu’on est tenté de dessiner
  en gris clair.
- Le transcript en direct est annoncé en `aria-live="polite"`.

## Ce que le widget dit quand ça ne se passe pas bien

⛔ **Quatre règles, et elles ne se discutent pas.** Dans un état dégradé, le widget :
**ne s’excuse pas** · **n’explique pas ce qui manque** — qu’un modèle soit tombé n’est pas
l’affaire du collaborateur · **ne promet rien** · **ne diagnostique rien**. Ce qui reste :
**inviter à continuer**.

### L’invite du champ suit ce qui est à l’écran

⛔ **Elle ne dépend PAS de la phase.** C’était tout le défaut
[004](../03-Bugs/BUGS_LOG.md) : `phase === 'entretien'` restait vrai alors que la carte n’était
jamais arrivée, et le champ invitait à corriger une fiche absente.

| Ce qui est à l’écran | L’invite |
|---|---|
| Avant l’entretien | « Ce qui vous a bloqué, ou l’idée qui vient de vous venir. » |
| Une carte | « Répondez, ou corrigez la fiche au-dessus. » |
| Une question, **sans** carte | « Répondez, ou ajoutez ce qui vous revient. » |
| Ni carte ni question | « Ajoutez ce qui vous revient. » |

⚠️ **Quatre situations produisent « en entretien, sans carte »**, et une seule est un échec : le
premier tour encore en vol — **sur le chemin nominal**, pendant la latence du modèle —, le tour en
échec, le tour rendu sans compréhension, et le tour dont la question conclut.

⛔ **Et « ce qui est à l’écran » l’emporte sur la phase, y compris PENDANT L’ENVOI.** La carte est
délibérément maintenue, figée, le temps de la requête de fin : l’invite et l’`aria-label` doivent
donc rester ceux d’une réponse. Les tester dans l’ordre inverse suffisait à casser la règle
([BUGS_LOG](../03-Bugs/BUGS_LOG.md) 011).

### Les autres états dégradés

| État | Ce qui s’affiche |
|---|---|
| Le premier tour se fait attendre | « Un instant… » — ⛔ seulement tant qu’il n’y a pas de carte à regarder |
| Le tour n’aboutit pas | « C’est noté. Ajoutez ce que vous voulez, ou envoyez. » |
| L’envoi n’aboutit pas | le message du serveur, verbatim — ou « L’envoi n’a pas abouti. Réessayez dans un instant. » |
| Réseau coupé à l’envoi | « Pas de connexion. Votre retour part dès qu’elle revient. » — le brouillon est gardé, l’envoi repart tout seul |
| Micro refusé | « Le micro est refusé pour ce site. La dictée continue sans l’onde. » |
| Micro indisponible | « La dictée continue, sans l’onde. » — ⚠️ l’onde restait morte **sans un mot**, ce qui ressemble à un produit cassé |
| Dictée indisponible (pas de Web Speech) | ⛔ **rien.** Le bloc micro disparaît, le champ prend la place ([D-003]) |

⚠️ **Le message de refus du serveur ne remonte jamais au tour d’entretien**, et c’est voulu :
« Le bot n’est pas joignable » explique une panne. L’envoi, lui, le relaie — parce que là, la
personne doit savoir que sa parole n’est pas partie.

⛔ **Les textes vivent tous dans `packages/widget/src/ui/textes.ts`**, jamais en dur dans le JSX.
Une phrase qu’on ne peut pas lire à côté des autres est une phrase qu’on n’arbitre pas.

## Ce que le widget ne fait jamais

- Il ne s’ouvre pas tout seul, jamais, sous aucune condition.
- Il n’affiche pas d’autres retours, ni les siens, ni ceux des collègues.
- Il ne demande pas de note, d’étoiles, ni de NPS.
- Il ne relance pas par une notification.
- Il ne fonctionne pas hors ligne — mais il **conserve le brouillon en cours** et le renvoie à la
  reconnexion, sans rien demander.

# Journal des bugs

Un bug constaté reçoit une entrée **au moment où il est constaté**, pas au moment où il est
corrigé. Un bug corrigé passe à `✅ Résolu` **dans le commit qui le corrige**.

⚠️ **On n’efface pas une entrée résolue.** C’est la mémoire du projet : c’est elle qui évite de
réintroduire la même faute six mois plus tard, et qui explique pourquoi telle ligne de code
étrange existe.

## Le format

```
## 001 — Titre court, à l’indicatif présent

**Statut** : 🔴 Ouvert | 🟠 Contourné | ✅ Résolu (2026-09-04, PR #12)
**Constaté le** : 2026-09-04, pendant P-00X
**Où** : packages/widget/src/dictee/onde.ts

**Symptôme** — ce qu’on voit, du point de vue de celui qui l’a rencontré.

**Cause** — ce que c’était vraiment. ⚠️ À remplir seulement quand on SAIT ;
« sans doute un problème de timing » n’est pas une cause, c’est une hypothèse.

**Correctif** — ce qui a été changé, et pourquoi cette solution plutôt qu’une autre.

**Ce qui l’a laissé passer** — quel test manquait. C’est le champ le plus utile
du format : un bug qui n’apprend rien au harnais de test reviendra.
```

---

## 001 — `/widget.js` part en clair : 74,9 Ko chez l’hôte contre 60 Ko de budget

**Statut** : ✅ Résolu (2026-09-05, PR #14)
**Constaté le** : 2026-09-05, pendant P-014, point 8
**Où** : `apps/serveur/app/_actifs/servir.ts`, `apps/serveur/infra/actifs.ts`

**Symptôme** — `curl -H 'Accept-Encoding: gzip, br' http://…/widget.js` rend **76 655 octets**,
sans en-tête `content-encoding`, en développement **comme dans l’image de production**. Le budget
du widget est de 60 Ko *gzip* (01-Specs/widget.md §4) : sur le fil, il était dépassé de 25 %.

**Cause** — la route lisait le fichier et le rendait tel quel. Rien ne compressait : ni elle, ni
Next, qui ne touche pas au corps d’une `Response` fabriquée dans un route handler.

⚠️ **Ce qui rend ce bug intéressant** : le budget était **vert et faux en même temps**.
`packages/widget/src/budget.test.ts` gzippe le fichier *construit* — la mesure était juste, mais
elle ne mesurait pas ce qu’un hôte télécharge. Un garde-fou qui mesure autre chose que ce qu’on
livre est pire qu’une absence de garde-fou : il rassure.

**Correctif** — `infra/actifs.ts` précalcule les représentations gzip et brotli **une fois par
version du fichier**, au même endroit et avec la même mémoire que la lecture ; `servir.ts` choisit
selon `Accept-Encoding`, pose `content-encoding`, `vary: Accept-Encoding`, et une empreinte
distincte par encodage — deux représentations d’un même fichier ne sont pas le même octet.

Le coût est payé au premier appel après un déploiement, jamais par une requête d’hôte. Brotli
d’abord : 23,2 Ko contre 26,0 Ko en gzip, et tout ce qui exécute le widget le comprend (D-003).

**Ce qui l’a laissé passer** — aucun test ne regardait la route. Le budget était vérifié sur le
disque, jamais sur le fil. `tests/e2e/actifs.spec.ts` mesure désormais **la réponse HTTP**, avec
les en-têtes qu’un navigateur envoie vraiment ; `domaine/actifs/entetes.test.ts` couvre la
négociation.

---

## 002 — Le back-office écrit une erreur de console à chaque ouverture : `/favicon.ico` 404

**Statut** : ✅ Résolu (2026-09-05, PR #14)
**Constaté le** : 2026-09-05, pendant P-014, point 7
**Où** : `apps/serveur/app/`

**Symptôme** — ouvrir `/bo` ou `/connexion` écrit dans la console :
`Failed to load resource: the server responded with a status of 404 (Not Found) — /favicon.ico`.

**Cause** — aucune icône n’était déclarée. Le navigateur réclame `/favicon.ico` de lui-même, et le
serveur n’avait rien à lui rendre.

⚠️ La fausse application hôte de `pnpm widget:demo` répond `204` sur ce chemin **exprès**, avec un
commentaire qui dit pourquoi. Le serveur Feedys, lui, ne le faisait pas — on avait vu le problème
d’un côté et pas de l’autre.

**Correctif** — `apps/serveur/app/icon.svg`. Next pose le `<link rel="icon">` tout seul, et le
navigateur cesse de réclamer `/favicon.ico`.

**Ce qui l’a laissé passer** — les parcours Playwright échouent sur une erreur de console, mais
`tests/e2e/backoffice.spec.ts` n’installait ce garde-fou qu’après la navigation initiale. Le 404
arrive pendant celle-ci.

---

## 003 — Un entretien interrompu en silence laisse le retour en `en_cours` pour toujours

**Statut** : ✅ Résolu (2026-09-05, PR #16)
**Constaté le** : 2026-09-05, pendant P-014, points 3 et 4
**Où** : côté serveur — rien ne referme un entretien que le widget n’a pas refermé

**Symptôme** — sur six retours joués pendant la recette, **un est resté `statut = 'en_cours'`,
`envoye_le` nul, indéfiniment**. Aucun `POST /fin` n’a jamais été reçu pour lui. Conséquence :
aucune synthèse, aucun email, et une ligne au back-office qui ressemble à un entretien encore
ouvert alors que personne ne parlera plus.

**Cause** — ⚠️ **inconnue pour le cas observé, et on ne l’invente pas.** Les quatre tentatives de
reproduction qui ont suivi se sont toutes bien terminées : fermeture explicite → `abandonne`,
départ de la page → `abandonne` via `pagehide` + `keepalive`, envoi manuel → `envoye`. Le chemin
nominal fonctionne.

Ce qui est **certain et structurel**, en revanche : la clôture d’un entretien dépend entièrement
d’une requête du navigateur. Un onglet tué, un poste qui s’éteint, un `keepalive` que le système
laisse tomber — et le retour reste `en_cours` sans que rien ne le rattrape. Le serveur n’a aucun
filet.

**Correctif** — le filet, écrit en P-016. Un balayage périodique referme en `abandonne` les
entretiens sans signe de vie depuis **trente minutes**, puis les passe au **chemin ordinaire** — le
même port `aval` que `POST /fin`, pas une seconde implémentation de la synthèse. Il tourne dans le
processus qui sert déjà les requêtes ([D-018](../00-Projet/DECISIONS_LOG.md)), parce que
hebergement.md refuse une file, un worker et toute dépendance au planificateur d’un hébergeur.

⚠️ **La cause du cas observé reste inconnue, et le filet ne prétend pas la connaître.** Il ne
répare pas le chemin nominal : il rattrape ce qui lui échappe, quelle qu’en soit la raison.

⚠️ **Ce qui dira si le filet sert vraiment** : chaque clôture par balayage écrit une ligne
`audit` — `acteur = 'systeme'`, `action = 'cloture_balayage'`. Aucune clôture ordinaire n’écrit
dans `audit` : la présence de la ligne suffit donc à identifier ce que le filet a rattrapé.

⚠️ **Rien n’est perdu entre-temps** : la parole est en base depuis l’ingestion, lisible au
back-office et par MCP. C’est la note et l’email qui manquent, pas le retour.

**Ce qui l’a laissé passer** — rien ne mesurait la proportion de retours qui restent `en_cours`.
C’est précisément ce que T-006 propose de surveiller d’abord.

---

## 004 — Sans carte, le champ de réponse invite à corriger une fiche qui n’existe pas

**Statut** : ✅ Résolu (2026-09-05, PR #17)
**Constaté le** : 2026-09-05, pendant P-014, point 4
**Où** : `packages/widget/src/ui/Widget.tsx`

**Symptôme** — modèle coupé, le tour rend `503`. Le panneau reste ouvert, sans carte — ce qui est
le comportement voulu — mais le champ texte garde son invite d’entretien : « Répondez, ou corrigez
la fiche au-dessus. » Il n’y a pas de fiche au-dessus.

**Cause** — l’invite ne dépend que de la phase, pas de la présence d’une carte.

⚠️ **Et le défaut est plus large que ce constat.** Le recensement de P-017 a trouvé **quatre**
situations « en entretien, sans carte », pas une :

1. le premier tour **encore en vol** — ⛔ sur le CHEMIN NOMINAL, pendant la latence du modèle,
   avant toute panne. Le défaut était donc visible tous les jours, pas seulement modèle coupé ;
2. le tour en échec — le cas décrit ici ;
3. le tour rendu à `200` avec `comprehension: null` — transcript inintelligible ;
4. le tour dont la question conclut l’entretien.

**Correctif** — l’invite regarde désormais **ce qui est à l’écran** : la carte, puis la question.
Trois invites au lieu d’une, dans un module de textes où elles se lisent côte à côte
(`packages/widget/src/ui/textes.ts` — il n’en existait aucun, les phrases étaient en dur dans le
JSX, et c’est aussi pour ça que celle-ci n’avait jamais été arbitrée).

⚠️ **Un second défaut, trouvé au passage** : un tour en échec ne disait **rien du tout**. On
cliquait « Répondre » et il ne se passait rien à l’écran. Le widget dit maintenant la seule chose
qui compte pour la personne — « C’est noté. Ajoutez ce que vous voulez, ou envoyez. » — ⛔ sans
dire que le bot est tombé : ce n’est pas son affaire.

**Ce qui l’a laissé passer** — aucun test ne regardait le widget dans l’état « entretien sans
carte ». Le test voisin vérifiait bien que la carte n’apparaît pas ; il ne regardait pas **ce que
le champ disait** à ce moment-là. Il y a désormais six tests de composant sur ces états, et un
parcours `widget:demo` qui coupe le tour pour de vrai.

---

## 005 — `.env.local` à la racine est invisible pour `pnpm dev`

**Statut** : ✅ Résolu (2026-09-05, PR #15)
**Constaté le** : 2026-09-05, pendant P-015
**Où** : `apps/serveur/next.config.ts`

**Symptôme** — la séquence « Démarrer » du README, suivie à la lettre, ne produit pas un
serveur qui fonctionne. `cp .env.example .env.local`, `pnpm dev`, et :

```
Feedys ⚠️  [variables] Feedys ne peut pas démarrer — 9 variable(s) obligatoire(s)
absente(s) : DATABASE_URL, FEEDYS_URL_PUBLIQUE, ANTHROPIC_API_KEY, FEEDYS_MODELE, …
GET /sante 503  {"etat":"degrade","base":"injoignable","migrations":"inconnu"}
```

⚠️ Et pendant ce temps `pnpm db:migrate` marche parfaitement. C’est ce qui rend le défaut
déroutant : la moitié des outils voit le fichier, l’autre non.

**Cause** — **deux endroits pour un même fichier.** `outils/migrer.ts`, `outils/creer-produit.ts`,
`outils/entretien-rejouer.ts`, `prisma.config.ts` et `packages/widget/demo/serveur.ts` appellent
tous `process.loadEnvFile()` sur **la racine du dépôt**. Next, lui, résout `.env.local` depuis le
dossier de l’application — `apps/serveur/`. Il n’y avait rien à cet endroit-là, et Next ne s’en
plaint pas : un fichier d’environnement absent n’est pas une erreur.

⚠️ Exporter les variables dans le shell ne sauvait rien non plus : `turbo` 2 filtre
l’environnement des tâches, et aucune clé `env`/`globalEnv` n’est déclarée dans `turbo.json`.

**Correctif** — `next.config.ts` charge le `.env.local` **de la racine**. La racine reste donc le
seul endroit où ce fichier existe, ce qui était déjà ce que disait le README : le correctif rend
la documentation vraie plutôt que de la changer. Sans effet en conteneur — il n’y a pas de
`.env.local` dans l’image, et `try/catch` couvre son absence.

⛔ L’autre voie — poser un second `.env.local` dans `apps/serveur/` — a été écartée : deux copies
d’un fichier de secrets divergent, et la divergence se découvre en production.

**Ce qui l’a laissé passer** — la recette de P-014 s’est jouée **contre le conteneur**, où les
variables viennent de `--env-file`. Personne n’avait démarré `pnpm dev` contre une vraie base
depuis que la liste des variables obligatoires existe. `/sante` le disait pourtant : aucun test
ne le lisait en développement.

---

## 006 — Les tests d’intégration visent le premier Postgres venu

**Statut** : ✅ Résolu (2026-09-05, PR #15)
**Constaté le** : 2026-09-05, pendant P-015
**Où** : les sept `*.integration.test.ts`, et `playwright.config.ts`

**Symptôme** — `pnpm test:integration` sur un poste correctement configuré :

```
error: password authentication failed for user "feedys"
 Test Files  7 failed (7)
      Tests  77 skipped (77)
```

**Cause** — huit fichiers portaient la même ligne recopiée :

```ts
const ADMIN = process.env['DATABASE_URL'] ?? 'postgresql://feedys:feedys@localhost:5432/feedys'
```

⚠️ vitest ne charge **aucun** `.env.local`. Le repli ne s’appliquait donc pas « en dernier
recours » : il s’appliquait **à tous les coups** sur un poste. Et il visait `localhost:5432`,
c’est-à-dire le premier Postgres venu — sur le poste où le défaut est sorti, celui d’un **autre
projet**, Feedys écoutant sur 5434.

⛔ **Ce qui rend ce défaut grave n’est pas l’échec.** Ces tests font `create database` puis
`drop database` sur la connexion d’administration. Ils ne l’ont pas fait sur la base d’à côté
uniquement parce que le mot de passe ne concordait pas. Un repli silencieux vers un hôte qu’on ne
contrôle pas est pire qu’une variable absente : l’absence se voit, le repli travaille.

**Correctif** — `tests/base-dessai.ts` : `urlBaseDessai()` **échoue franchement**, avec un message
qui dit quoi faire et prévient que le port n’est pas forcément 5432. `tests/env-integration.ts`,
branché en `setupFiles`, charge le `.env.local` de la racine avant le premier test. Les huit
répliques de la ligne sont supprimées.

**Ce qui l’a laissé passer** — la CI pose `DATABASE_URL` dans l’environnement du job : le repli
n’y sert jamais, et il était donc invisible là où on regarde. `tests/base-dessai.test.ts` lit
désormais **le texte des huit fichiers** et rougit si la ligne revient — parce que le défaut
n’était pas une valeur fausse, c’était une ligne recopiée huit fois.

---

## 007 — La dictée meurt en plein milieu et renvoie à l’écran d’accueil

**Statut** : ✅ Résolu (2026-09-05, PR #15)
**Constaté le** : 2026-09-05, pendant P-015, point 1 — **par un humain, à la voix**
**Où** : `packages/widget/src/dictee/reconnaissance.ts`, `packages/widget/src/ui/useDictee.ts`

**Symptôme** — « Je clique, ça se lance, je parle, et ça finit par s’arrêter en plein milieu. Ça
revient sur le menu d’accueil. » La parole est perdue : ni transcript, ni retour, rien.

**Cause** — deux défauts qui se composent, et il fallait les deux pour produire exactement ça.

**① `speech-to-element` ne relance pas Chrome, contrairement à ce que ce dépôt affirmait.**
L’en-tête de `reconnaissance.ts` disait : « Ce qu’elle nous apporte vraiment, et qui justifie la
dépendance : Chrome coupe `SpeechRecognition` tout seul après un silence, et il faut le relancer
sans perdre ce qui précède. » C’est faux. Dans `dist/index.js` :

```js
this._service.onend = () => { this._stopping = !1 }
```

Rien d’autre. Aucun `start()` derrière. Le drapeau `isRestarting` de la bibliothèque appartient à
son mode « élément », qu’on n’utilise pas — délibérément, pour ne pas poser d’écouteurs sur le
document de l’hôte. Et `useDictee` passait `surFin: () => undefined`. Chrome coupait, personne ne
relançait : le micro restait ouvert, l’onde continuait de bouger, et plus un mot n’était transcrit.
⚠️ **L’écran mentait** — il avait l’air d’écouter.

**② `terminer()` jetait le transcript provisoire.** Web Speech n’arrête un segment qu’aux pauses.
Tant qu’il n’a rien arrêté, **la phrase entière vit dans le provisoire** — et `terminer()` ne
lisait que `acquis.current`, qui ne reçoit que du définitif. Quand le guet de silence terminait
l’écoute mains libres après ①, `acquis` était vide : `surTranscript` n’était pas appelé, le
panneau revenait à l’accueil, et la parole disparaissait.

**Correctif** — la relance est écrite **chez nous**, dans `dicter()` : sur `onStop`, si ce n’est
pas nous qui avons arrêté, on redémarre le moteur en conservant le transcript. ⛔ Avec un plafond
de trois relances stériles d’affilée, remis à zéro dès qu’un mot arrive — sans quoi un micro
débranché ferait tourner une boucle dans la page de l’hôte. Passé ce plafond, `surFin` prévient la
coquille, qui **termine l’écoute et rend ce qui a été capté** plutôt que de laisser un écran qui
n’écoute plus.

Et `useDictee` garde le provisoire dans un `ref`, recollé au définitif au moment de terminer.
⚠️ Une **annulation**, elle, continue de tout jeter, provisoire compris : c’est tout l’intérêt du
geste.

**Ce qui l’a laissé passer** — deux choses, et la seconde est la plus instructive.

D’abord, aucun test ne rejouait « Chrome rend la main tout seul » : `onStop` n’était jamais
déclenché nulle part.

Ensuite, **le faux moteur de `ui/dictee.test.tsx` ne respectait pas le contrat du vrai.** Son
`murmurer()` appelait `surTexte('', provisoire)` — il remettait le définitif à vide. Le vrai
`dicter()` rend toujours le transcript arrêté **depuis le début**. Le faux rendait donc le défaut
② strictement indétectable : il n’y avait jamais de définitif ET de provisoire en même temps. Un
bouchon qui ment sur le contrat est un test qui protège le mauvais code.

---

## 008 — Deux secondes de réflexion coupent la parole en mains libres

**Statut** : ✅ Résolu (2026-09-05, PR #15)
**Constaté le** : 2026-09-05, pendant P-015, point 1 — **par un humain, à la voix**
**Où** : `packages/widget/src/dictee/silence.ts`

**Symptôme** — après le correctif de [007](#007--la-dictée-meurt-en-plein-milieu-et-renvoie-à-lécran-daccueil),
la dictée tient. Mais : « ça se coupe un peu si on marque un temps de pause ». L’écoute mains
libres se termine pendant que la personne cherche ses mots.

⚠️ **Ce n’est pas le même défaut que 007, et c’est important.** 007 perdait la parole ; 008 la
rend — l’écoute se termine proprement et le transcript arrive dans le champ. Mais elle se termine
**trop tôt**, et quelqu’un qu’on coupe deux fois cesse de dicter.

**Cause** — `APRES_MS = 2_000`, posé par défaut avant que quiconque ait dicté un vrai retour.
⛔ Et le module déclarait, six lignes plus haut, l’exact contraire de ce que sa valeur faisait :

> Un arrêt manqué coûte un clic […] Un arrêt prématuré coupe quelqu’un au milieu d’une phrase, et
> il ne recommencera pas.

Quelqu’un qui décrit un problème le reconstitue en parlant — « alors, quand je clique sur… euh…
le bouton suivant ». Deux secondes de silence sont un temps de réflexion ordinaire.

**Correctif** — `APRES_MS` passe à `5_000`, avec [D-017](../00-Projet/DECISIONS_LOG.md) qui dit
pourquoi cinq. ⚠️ Le côté long ne coûte rien : qui a fini n’attend pas, le second clic et
« Envoyer maintenant » sont visibles en permanence.

**Ce qui l’a laissé passer** — les tests vérifiaient que le guet s’arrête **au bon moment par
rapport à sa propre constante**, jamais que la constante était juste. Un test rejoue désormais une
pause de réflexion de quatre secondes et exige qu’elle ne coupe pas — c’est un test de valeur
produit, pas de mécanique.

---

## 009 — Le filet referme l’entretien sous les doigts de quelqu’un, et sa phrase est jetée

**Statut** : ✅ Résolu (2026-09-06, PR #19)
**Constaté le** : 2026-09-06, en **relecture adverse de P-016** — jamais rencontré à l’usage
**Où** : `apps/serveur/domaine/entretien/tour.ts`

**Symptôme** — quelqu’un ouvre la bulle, dicte, le bot pose sa question, la carte s’affiche. On
l’appelle ailleurs ; **l’onglet reste ouvert**, le panneau aussi. Trente-cinq minutes plus tard, il
revient, tape la précision qui manquait, et clique « Envoyer maintenant ». Le widget affiche
« C’est parti. Merci — vous n’avez rien d’autre à faire. »

⛔ **Sa phrase n’est allée nulle part.** Elle n’est ni en base, ni dans la note, qui est déjà partie
par email trente minutes plus tôt avec le premier tour seul. Rien, à l’écran ni dans les journaux,
ne le signale.

**Cause** — les deux gardes de statut du domaine refusaient **avant** d’écrire l’apport.
`jouerTour` rendait 409 `entretien_clos`, et le widget affichait « C’est noté. » ;
`terminerEntretien` rendait **200 sans rien écrire**, et le widget affichait l’accusé.

⚠️ **Le code n’a pas changé — sa portée, si.** Tant que seul le widget refermait, cette branche
n’était atteignable que par la course `POST /fin` × 2 (fermeture de page après un envoi manuel), où
le champ est vide par construction : jeter un apport vide ne perd rien. Le filet de P-016 referme
désormais **des entretiens dont le panneau est encore ouvert**, et la même branche se met à jeter
de la parole. ⛔ C’est le mode de défaillance le plus traître qui soit : un correctif juste, qui
rend faux du code qui ne bouge pas.

**Correctif** — l’apport est écrit **avant** la garde de statut, dans les deux fonctions.
`messages` est append-only et ne porte aucune contrainte de statut : écrire un tour sur un
entretien clos est inoffensif. L’aval est ensuite rejoué — `deja_faite` le rend sans effet si la
note est déjà partie, et s’il ne l’est pas, elle contient ces mots-là. ⚠️ Rien n’est rejoué quand
il n’y a rien à ajouter : la course ordinaire `POST /fin` × 2 reste silencieuse et ne rappelle
jamais le modèle.

⚠️ Le reste du chemin est inchangé, et volontairement : l’entretien **ne se rouvre pas**, le refus
409 reste un refus, et le statut posé par le filet fait foi. On ne perd plus la parole ; on ne
ressuscite pas un entretien pour autant.

**Ce qui l’a laissé passer** — aucun test ne jouait « le serveur referme pendant que quelqu’un
écrit ». Tous les tests de clôture partaient d’un widget qui referme lui-même, où le champ est
vide. ⛔ Et le commentaire d’en-tête de `balayage.ts` affirmait « CE N’EST PAS UNE PERTE DE
PAROLE » — vrai du premier tour, faux de tous les suivants. Six tests couvrent désormais l’arrivée
tardive, dont deux qui vérifient qu’à vide **rien** n’est écrit ni rejoué.

---

## 010 — Le panneau rouvert garde l’avis, la fiche et la question de l’entretien précédent

**Statut** : ✅ Résolu (2026-09-06, PR #20)
**Constaté le** : 2026-09-06, en **relecture adverse de P-017**
**Où** : `packages/widget/src/ui/Widget.tsx`

**Symptôme** — deux chemins, un même écran sale.

1. Le tour d’entretien échoue → « C’est noté. Ajoutez ce que vous voulez, ou envoyez. » On clique
   « Envoyer maintenant », l’accusé s’affiche, le panneau se referme tout seul. **On rouvre la
   bulle pour signaler autre chose** : panneau vierge, invite d’accueil… et sous le champ, toujours
   « C’est noté. »
2. Un tour est en vol (« Un instant… »), on referme le panneau — c’est un abandon. Le tour revient
   **après**. À la réouverture : la **fiche** et la **question** d’un entretien clos sont à
   l’écran, sous une invite d’accueil qui n’en parle pas, avec un bouton « Envoyer » qui démarrera
   un retour tout neuf. Et « Un instant… » restait collé, faute d’être jamais remis à zéro.

⚠️ C’est le défaut [004](#004--sans-carte-le-champ-de-réponse-invite-à-corriger-une-fiche-qui-nexiste-pas)
dans l’autre sens : là, l’invite parlait d’une fiche absente ; ici, une fiche est présente et
l’invite n’en parle pas.

**Cause** — deux trous distincts, tous deux sur la fin d’un entretien.

- `fermer()` était le **seul** endroit à faire `setAvis('')`. Or la fermeture automatique de
  l’accusé appelle `setOuvert(false)` en direct, sans passer par lui. Tant que `avis` n’était posé
  que par un envoi en échec — qui le nettoyait lui-même avant tout succès — la rémanence était
  impossible ; ⛔ **P-017 l’a rendue possible en posant un avis sur l’échec d’un TOUR**, et rien
  n’a été ajouté en face.
- `jouer` n’était gardé par **aucune génération**. `useDictee` a exactement ce garde-fou depuis
  toujours (`generation`, `useDictee.ts`) ; le composant ne l’avait pas. `conclure('abandon')`
  remet `retour` et `tour` à `null` sans annuler la requête en vol.

**Correctif** — une génération d’écran (`useRef`), avancée par `conclure`. Tout ce qui revient d’un
`await` avec une génération périmée n’écrit plus rien. `conclure` remet aussi `attente` à zéro,
puisqu’un tour périmé ne peut plus le faire lui-même. Et la fermeture automatique nettoie l’avis,
comme `fermer` le faisait déjà.

**Ce qui l’a laissé passer** — aucun test ne **rouvrait** le panneau après un entretien, et aucun
ne faisait revenir un tour **après** la fermeture. Quatre tests le font maintenant ; ils rougissent
tous les quatre si l’on retire la génération ou le nettoyage.

---

## 011 — Pendant l’envoi, le champ invite à décrire un problème sous la fiche qu’on envoie

**Statut** : ✅ Résolu (2026-09-06, PR #20)
**Constaté le** : 2026-09-06, en **relecture adverse de P-017**
**Où** : `packages/widget/src/ui/textes.ts`

**Symptôme** — on répond au bot, la fiche est à l’écran, on clique « Envoyer maintenant ». Pendant
toute la durée de la requête — plusieurs secondes sur un réseau lent — le champ repasse à
« Ce qui vous a bloqué, ou l’idée qui vient de vous venir. » et son `aria-label` de « Votre
réponse » à « Votre retour ». **Sous une fiche toujours affichée.** Un lecteur d’écran annonce le
changement.

**Cause** — `inviteChamp` testait `!enEntretien` **en premier**, et `enEntretien` vaut
`phase === 'entretien'` — donc `false` dès que « Envoyer maintenant » fait basculer en `'envoi'`,
alors que la carte est **délibérément maintenue** à l’écran, figée, le temps de la requête.

⛔ La fonction s’engageait pourtant, six lignes plus haut, à l’exact contraire : « ELLE DÉPEND DE
CE QUI EST RÉELLEMENT À L’ÉCRAN, pas de la phase ». Sa première branche regardait la phase.

**Correctif** — `aCarte` et `aQuestion` sont testés **avant** `enEntretien`. L’ordre des trois
tests **est** le contrat ; il est écrit comme tel dans le code et dans
[01-Specs/widget.md](../01-Specs/widget.md) §L’invite du champ.

**Ce qui l’a laissé passer** — les tests d’invite appelaient `inviteChamp` **directement**, avec
des états cohérents choisis à la main. Aucun ne partait de l’écran réel pendant une phase de
transition. Le test qui le couvre tient désormais la requête de fin ouverte et lit le champ
pendant qu’elle tourne.

---

## 012 — Une question blanche laisse l’entretien ouvert pour toujours

**Statut** : ✅ Résolu (2026-09-06, PR #20)
**Constaté le** : 2026-09-06, en **relecture adverse de P-017**
**Où** : `packages/widget/src/ui/Widget.tsx`

**Symptôme** — si le bot rend `question: "   "`, le `<p class="question">` n’est pas rendu **et**
l’entretien ne se conclut jamais. Le panneau reste ouvert indéfiniment, fiche affichée, champ
invitant à « Répondez, ou corrigez la fiche au-dessus » alors qu’il n’y a plus rien à quoi
répondre. Le retour ne part que si la personne clique « Envoyer maintenant » — ou jamais.

⚠️ Le serveur normalise, donc le cas est rare. Il n’est pas impossible : c’est exactement la raison
pour laquelle le widget se protégeait **déjà** à l’affichage.

**Cause** — la question était neutralisée à un seul des deux endroits. L’affichage lisait la valeur
dérivée ; l’effet de conclusion lisait `tour.question` **brute**, qui n’est pas `null`.

**Correctif** — la question est dérivée **une seule fois**, en tête du composant, et l’effet de
conclusion en dépend. Un widget qui se protège d’une valeur doit s’en protéger partout, ou nulle
part.

**Ce qui l’a laissé passer** — le test existant (« ⛔ une question vide n’est pas une question —
rien n’est rendu ») n’assérait que l’**absence du `<p>`**. Il passait en laissant l’état bloqué
hors couverture. Il vérifie maintenant que l’entretien **se conclut**.

---

## 013 — Une coquille dans le mot de passe du rôle de service fait démarrer le conteneur en vert

**Statut** : ✅ Résolu (2026-09-06, PR #21)
**Constaté le** : 2026-09-06, en **relecture adverse de P-018**
**Où** : `apps/serveur/infra/demarrage.ts`

**Symptôme** — `DATABASE_URL_MIGRATIONS` est bonne, `DATABASE_URL` a une faute de frappe dans son
mot de passe. Le démarrage affiche :

```
Feedys · base à jour — 3 migration(s).
Feedys ⚠️  rôle de connexion · impossible de le vérifier. Le démarrage continue.
Feedys · widget.js — 26.4 Ko gzip, sous le budget.
Feedys · prêt.
```

⛔ Le conteneur écoute, et le pool échoue sur **chaque** requête. `/sante` rend 503, le
`HEALTHCHECK` passe `unhealthy` — et **`restart: unless-stopped` ne redémarre pas un conteneur
unhealthy** : il reste debout à ne rien servir. C’est exactement le « serveur à moitié démarré qui
répond 500 à tout » que `instrumentation.ts` déclare *pire* qu’un redémarrage en boucle.

⚠️ La seule ligne qui en parle ressemble à une gêne bénigne, et n’est pas une erreur.

**Cause** — P-018 a fait glisser l’étape 2 (« la base répond ») de `DATABASE_URL` vers
`urlDesMigrations()`. Dès lors, **plus rien ne regardait `DATABASE_URL`** : le seul endroit qui la
touchait encore était `annoncerLeRole`, dont le `catch` avale **tout** — y compris
`password authentication failed`.

⛔ Le contrôle *informatif* du rôle et l’ouverture *réelle* de la connexion de service avaient été
fondus en une seule fonction qui ne doit jamais échouer. Les deux n’ont pas le même statut : une
connexion qui ne s’ouvre pas est une **panne**, un verdict de rôle est une **information**.

**Correctif** — `verifierLeService` les sépare. L’échec de `connect()` rend
`{ ok: false, etape: 'base' }` et refuse le démarrage, en nommant `DATABASE_URL` — jamais sa valeur.
L’échec de la *requête*, lui, reste une alerte et laisse démarrer. Les deux connexions portent
désormais `connectionTimeoutMillis: 10 000` (le défaut de `pg` est l’attente **infinie**), et la
requête de rôle un `statement_timeout` de 5 s : un contrôle informatif n’a pas à pouvoir figer un
démarrage.

**Ce qui l’a laissé passer** — aucun test ne démarrait avec **deux URL différentes**, dont une
cassée. Le cas n’existe que là où les rôles sont séparés, c’est-à-dire nulle part sur un poste ni
en CI. ⚠️ C’est le mode de défaillance propre à P-018 : un durcissement qui n’est éprouvé que par
le déploiement qu’il durcit.

---

## 014 — Le démarrage annonce « Les GRANT s’appliquent » dans deux cas où ils ne s’appliquent pas

**Statut** : ✅ Résolu (2026-09-06, PR #21)
**Constaté le** : 2026-09-06, en **relecture adverse de P-018**
**Où** : `apps/serveur/domaine/demarrage/controles.ts`

**Symptôme** — deux configurations mortes, une ligne rassurante.

1. **Rôle `NOINHERIT`.** Mesuré sur un vrai rôle :
   `pg_has_role(…, 'member') = true`, et `select … from retours` → `42501 permission denied`. Le
   journal disait « membre de feedys_app, propriétaire d’aucune des 8 tables. **Les GRANT
   s’appliquent.** »
2. **Mauvaise base.** `DATABASE_URL` désigne une base vide, ou une autre base du même cluster —
   le copier-coller d’URL le plus banal. Le journal disait « propriétaire d’aucune des **0** tables.
   Les GRANT s’appliquent. »

⚠️ Combiné à [013](#013--une-coquille-dans-le-mot-de-passe-du-rôle-de-service-fait-démarrer-le-conteneur-en-vert),
l’exploitant lisait une ligne verte sur une installation qui ne servait rien.

**Cause** — deux questions mal posées.

- `pg_has_role(current_user, 'feedys_app', 'member')` demande « en est-il membre ? ». La question
  utile est « **en hérite-t-il ?** », c’est-à-dire `'usage'`. ⛔ C’est exactement la faute que
  `hebergement.md` désigne nommément — « ⚠️ `inherit` explicite » — et le contrôle censé l’attraper
  passait à côté d’elle.
- Les rôles sont **cluster-wide** : `feedys_app` existe dans **toutes** les bases, et l’appartenance
  y répond « oui » partout. `tablesPossedees === 0` sur `tables === 0` n’est donc pas une séparation
  réussie : c’est l’absence de toute observation.

**Correctif** — `'usage'` remplace `'member'` pour l’appartenance (`'member'` reste juste pour la
**possession** : un membre du propriétaire peut faire `set role` et contourne tout autant). Et
`tables === 0` devient un motif à part entière, `base_vide`, dont le message **n’accuse pas les
GRANT** — on ne les a pas vus, ce n’est pas pareil que les avoir vus inopérants.

⚠️ Au passage, `relkind in ('r', 'p')` : une table partitionnée est un `'p'`, et n’aurait pas
compté.

**Ce qui l’a laissé passer** — les tests de `verdictRole` appelaient la fonction avec des états
cohérents choisis à la main : aucun ne venait d’un vrai Postgres, et aucun ne posait le cas
`NOINHERIT`, qui n’est pas représentable dans un booléen nommé `membreDuGroupe`. Un bloc
d’intégration crée maintenant un vrai rôle `noinherit`, s’y connecte, et vérifie que « membre » dit
oui, qu’« usage » dit non, que le `SELECT` est refusé, et que le verdict rend `sans_heritage`.

---

## 015 — `pnpm db:migrate` migre avec le rôle de service, et n’explique pas son refus

**Statut** : ✅ Résolu (2026-09-06, PR #21)
**Constaté le** : 2026-09-06, en **relecture adverse de P-018**
**Où** : `apps/serveur/outils/migrer.ts`

**Symptôme** — quelqu’un veut éprouver la séparation des rôles sur son poste. Il renseigne les deux
URL dans `.env.local`, lance `pnpm db:migrate`, et reçoit un objet d’erreur brut :
`permission denied for schema public`. Rien ne lui dit qu’il vient de migrer avec le mauvais rôle.

**Cause** — la séparation n’avait été câblée que dans `infra/demarrage.ts`. `migrer.ts` lisait
`DATABASE_URL` en dur, alors que `pnpm db:migrate` est **le chemin documenté partout** —
`docker-compose.yml`, le README, le message d’erreur de `tests/base-dessai.ts`. ⛔ Une règle
appliquée à un seul de ses deux appelants n’est pas une règle.

**Correctif** — `urlDesMigrations()` vit dans son propre module, importé par les deux. `indiceDeRole`
descend dans le module **pur** (`domaine/demarrage/controles.ts`), pour que l’outil puisse l’afficher
sans importer l’infrastructure du serveur. Il nomme en plus la variable réellement utilisée.

**Ce qui l’a laissé passer** — la fonction était `private` dans `demarrage.ts`, et rien ne cherchait
ses autres appelants. Un `grep DATABASE_URL_MIGRATIONS` sur `apps/serveur/outils/` ne rendait rien,
et personne ne l’avait fait.

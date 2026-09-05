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

**Statut** : 🟠 Contourné (2026-09-05) — voir [TICKETS_DIFFERES.md](../00-Projet/TICKETS_DIFFERES.md) T-006
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

**Correctif** — ⛔ aucun dans cette PR : P-014 dit de vérifier et de consigner, pas d’écrire de
fonctionnalité. Le filet — clore les entretiens muets depuis trop longtemps, puis les synthétiser
— est un travail à part entière, décrit en T-006.

⚠️ **Rien n’est perdu entre-temps** : la parole est en base depuis l’ingestion, lisible au
back-office et par MCP. C’est la note et l’email qui manquent, pas le retour.

**Ce qui l’a laissé passer** — rien ne mesurait la proportion de retours qui restent `en_cours`.
C’est précisément ce que T-006 propose de surveiller d’abord.

---

## 004 — Sans carte, le champ de réponse invite à corriger une fiche qui n’existe pas

**Statut** : 🟠 Contourné (2026-09-05) — voir [TICKETS_DIFFERES.md](../00-Projet/TICKETS_DIFFERES.md) T-007
**Constaté le** : 2026-09-05, pendant P-014, point 4
**Où** : `packages/widget/src/ui/Widget.tsx`

**Symptôme** — modèle coupé, le tour rend `503`. Le panneau reste ouvert, sans carte — ce qui est
le comportement voulu — mais le champ texte garde son invite d’entretien : « Répondez, ou corrigez
la fiche au-dessus. » Il n’y a pas de fiche au-dessus.

**Cause** — l’invite ne dépend que de la phase, pas de la présence d’une carte.

**Correctif** — ⛔ aucun ici. Une phrase, mais qui touche à ce que le widget dit dans un état
dégradé ; ça se décide, ça ne se glisse pas dans une PR de recette.

**Ce qui l’a laissé passer** — aucun test ne regarde le widget dans l’état « entretien sans
carte ». Le cas n’existe que quand le modèle tombe.

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

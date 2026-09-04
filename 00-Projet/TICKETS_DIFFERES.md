# Tickets différés

Ce qu’on a **choisi** de ne pas traiter maintenant. Chaque entrée porte un **déclencheur de
reprise** — la condition observable qui fera qu’on s’y remettra.

⚠️ Sans déclencheur, un ticket différé est un ticket abandonné qui s’ignore. Le déclencheur n’est
pas une date : c’est un fait qu’on pourra constater.

## Le format

```
## T-00X — Titre

**Différé le** : 2026-09-04, pendant P-00X
**Déclencheur de reprise** : le fait observable qui rouvre le sujet
**Coût estimé si on le fait plus tard** : identique | plus cher, et pourquoi

Ce que c’est, en trois lignes. Ce qu’on fait à la place en attendant.
```

---

## ~~T-001 — Le poids du modèle VAD n’est pas dans le budget du widget~~ · ✅ clos

**Différé le** : 2026-09-04, à la rédaction de [05-Prompts/MVP.md]
**Clos le** : 2026-09-04, pendant P-006, par [D-012](DECISIONS_LOG.md)

Le déclencheur prévu — « le premier build de P-006 qui dépasse 60 Ko gzip » — n’est jamais tombé,
parce que la mesure a tranché avant : la chaîne Silero minimale pèse **5,3 Mo gzip**, et le
chargement différé ne résout rien puisque **c’est la demande qui est le mauvais moment** —
quelqu’un vient de cliquer pour parler, et il parlerait pendant le téléchargement.

C’est l’alternative que ce ticket avait lui-même prévue qui a été retenue : le plancher sonore est
mesuré sur l’`AnalyserNode` déjà ouvert pour l’onde. ⚠️ Et pas un seuil fixe — un seuil absolu
échoue exactement là où le produit vit, en open space. Détail dans [D-012](DECISIONS_LOG.md).

---

## T-002 — Le passage à la dictée locale de Chrome n’est pas instruit

**Différé le** : 2026-09-04, avec [D-003](DECISIONS_LOG.md)
**Déclencheur de reprise** : `SpeechRecognition.available({ langs: ['fr-FR'], processLocally: true })`
répond favorablement sur le poste, **ou** une exigence de confidentialité arrive
**Coût si plus tard** : identique

Chrome 139+ propose `processLocally` — le modèle SODA tourne sur la machine, l’audio ne sort
pas. La disponibilité de `fr-FR` n’a **pas** été vérifiée : elle est à mesurer, pas à supposer.

**En attendant** : Web Speech en mode par défaut, l’audio transite par Google. C’est assumé
([D-003]) et cohérent avec des logiciels qui utilisent déjà des services Google par ailleurs.

---

## T-003 — Aucun test ne couvre le widget dans un vrai navigateur tiers

**Différé le** : 2026-09-04
**Déclencheur de reprise** : le premier défaut d’isolation constaté chez un hôte réel
**Coût si plus tard** : **plus cher** — le défaut aura été vu par des collaborateurs avant nous

`pnpm widget:demo` sert une fausse application hôte hostile, et P-005 exige que le widget y
survive. Mais c’est **notre** page hostile, écrite en imaginant ce qui pourrait casser.

**En attendant** : la recette P-014 se joue sur `widget:demo`, et la première mise en service
réelle vaut recette. ⚠️ C’est le trou de couverture le plus large du MVP, et il est assumé
sciemment.

---

## T-004 — La séparation des rôles Postgres n’est pas outillée

**Différé le** : 2026-09-04, pendant P-002
**Déclencheur de reprise** : P-013, quand le conteneur devra démarrer ailleurs que sur un poste
**Coût si plus tard** : identique — c’est une procédure de déploiement, pas du schéma

`0001_socle.sql` crée le rôle de groupe `feedys_app` et lui accorde ses privilèges ([D-009]). Il
ne crée **pas** le rôle de login qui s’en réclame : son nom et son mot de passe sont propres à
chaque installation, et n’ont rien à faire dans un dépôt public.

Sur le poste, `docker-compose.yml` connecte le superutilisateur `feedys`, qui est aussi le
propriétaire : ⚠️ **les `GRANT` n’y mordent donc pas**. Ce qui les vérifie vraiment, c’est le test
d’intégration, qui fait `set role feedys_app` avant de tenter un `DELETE`.

**En attendant** : le garde-fou est prouvé en test, pas en usage.

⚠️ **Mis à jour le 2026-09-05 (P-014)** : les deux lignes sont désormais écrites dans
[hebergement.md](../04-Architecture/hebergement.md) §Le rôle de connexion. Ce qui reste différé,
c’est de **s’en servir** — un déploiement à un conteneur migre avec un rôle propriétaire, et rien
n’oblige encore `DATABASE_URL` à pointer sur un rôle membre. Le ticket reste ouvert pour ça.

---

## T-005 — snapdom écrit un avertissement dans la console de l’hôte

**Différé le** : 2026-09-04, pendant P-005
**Déclencheur de reprise** : un intégrateur signale la ligne, **ou** une version de snapdom expose
de quoi la taire
**Coût si plus tard** : identique — c’est une option d’appel, une ligne

À l’ouverture du panneau, `@zumer/snapdom` 2.24.15 écrit un `console.warn` dans la page de l’hôte :
« Text in inline/table-cell elements kept its natural width… Pass `{ reconcile: true }` for
pixel-exact layout ». Une fois par chargement de page — la bibliothèque garde un drapeau — et
jamais une erreur.

⚠️ Ce n’est pas rien : Feedys est un invité, et la console de l’hôte ne lui appartient pas. Un
avertissement inexpliqué dans un logiciel métier finit toujours par être imputé au dernier arrivé.

**En attendant** : on ne passe **pas** `reconcile: true`. Il double le temps de capture, et la
capture est un aide-mémoire, pas une preuve ([01-Specs/widget.md]) — faire attendre quelqu’un qui a
fini de parler coûte plus cher qu’une ligne de console. snapdom n’expose pas d’option pour taire
celle-ci ; `debug` ne la couvre pas.

---

## T-006 — Rien ne referme un entretien que le widget n’a pas refermé

**Différé le** : 2026-09-05, pendant P-014
**Déclencheur de reprise** : la première semaine où la part de retours restés `en_cours` dépasse
5 %, **ou** le premier retour perdu dont quelqu’un se plaint
**Coût si plus tard** : identique — c’est une tâche périodique, elle se branche sans rien déplacer

La clôture d’un entretien dépend entièrement d’une requête du navigateur : `POST /fin`, envoyée à
la fermeture du panneau ou sur `pagehide` avec `keepalive`. Le chemin nominal marche — la recette
l’a joué quatre fois, dans deux navigateurs. Mais un onglet tué, un poste éteint, un `keepalive`
que le système laisse tomber, et le retour reste `en_cours` **pour toujours** : ni synthèse, ni
email, et une ligne au back-office qui a l’air d’un entretien en cours ([BUGS_LOG](../03-Bugs/BUGS_LOG.md) 003).

⚠️ **Ce n’est pas une perte de parole** — elle est en base depuis l’ingestion, lisible au
back-office et par MCP. C’est une perte de **note**, ce qui est moins grave et quand même contraire
à la promesse : « aucun mode de défaillance ne perd la parole », mais celle-ci n’arrive jamais chez
le développeur sous forme lisible.

**Le travail** : une tâche qui clôt en `abandonne` les entretiens sans message depuis N minutes,
puis les synthétise par le chemin ordinaire. ⛔ Elle demande de décider N — trop court, on coupe la
parole de quelqu’un qui réfléchit ; trop long, la note arrive le lendemain — et **où elle tourne**,
sachant que [hebergement.md](../04-Architecture/hebergement.md) refuse une file, un worker et toute
dépendance au planificateur d’un hébergeur.

**En attendant** : mesurer. Une requête d’une ligne — la part de `en_cours` de plus d’une heure —
dit si le problème est réel avant qu’on écrive quoi que ce soit. C’est aussi ce qui donnera la
bonne valeur de N.

---

## T-007 — Sans carte, le champ d’entretien invite à corriger une fiche absente

**Différé le** : 2026-09-05, pendant P-014
**Déclencheur de reprise** : le prochain passage sur les textes du widget, **ou** un relevé montrant
que les tours en échec ne sont pas si rares
**Coût si plus tard** : identique — une invite conditionnelle, quelques lignes

Modèle coupé, le tour rend `503`, le panneau reste ouvert sans carte : c’est le comportement voulu.
Mais l’invite du champ reste « Répondez, ou corrigez la fiche au-dessus », et il n’y a pas de fiche
([BUGS_LOG](../03-Bugs/BUGS_LOG.md) 004).

⚠️ La correction tient en une condition. Ce qui se décide, c’est **ce qu’on dit à la place** : le
widget ne s’excuse pas et n’explique pas ce qui manque (01-Specs/widget.md) — il faut donc une
phrase qui invite à continuer sans avouer une panne, et ça se choisit avec le reste des textes,
pas au détour d’une PR de recette.

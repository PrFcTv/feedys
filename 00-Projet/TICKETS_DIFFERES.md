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

## T-001 — Le poids du modèle VAD n’est pas dans le budget du widget

**Différé le** : 2026-09-04, à la rédaction de [05-Prompts/MVP.md]
**Déclencheur de reprise** : le premier build de P-006 qui dépasse 60 Ko gzip
**Coût si plus tard** : identique — c’est une décision de chargement, pas d’architecture

`@ricky0123/vad` embarque un modèle Silero en WASM, qui pèse largement plus que le budget de
60 Ko du widget. Il ne sert **que** pour le mode mains libres.

**En attendant** : le charger **à la demande**, au premier passage en mains libres, et jamais au
chargement du widget. Le geste par défaut — maintenir pour parler — n’en a pas besoin.

⚠️ Si le chargement différé se révèle trop lent à l’usage, l’alternative est un simple seuil
d’énergie sur l’`AnalyserNode` : moins bon, mais gratuit et déjà présent pour dessiner l’onde.

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

**En attendant** : le garde-fou est prouvé en test, pas en usage. P-013 devra documenter les deux
lignes de `create role … login in role feedys_app` et faire pointer `DATABASE_URL` dessus.

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

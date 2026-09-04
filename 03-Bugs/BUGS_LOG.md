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

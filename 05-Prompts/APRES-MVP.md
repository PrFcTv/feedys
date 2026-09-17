# La séquence après le MVP

Les quatorze prompts de [MVP.md] sont joués. Ce document prend la suite : **ce qui reste à faire et
dont le déclencheur est déjà tombé**, dans l’ordre où il faut le faire.

Mêmes règles qu’avant : **un prompt = une branche = une PR**, mergée avant d’ouvrir la suivante ;
chaque prompt porte un « ce qu’on ne fait pas » ; le prompt **ne recopie pas** `CLAUDE.md`, il
désigne le document qui fait foi.

⚠️ **Trois lots, et ils ne sont pas interchangeables.** Le lot 7 finit un MVP qui n’est pas tout à
fait fini. Le lot 8 le met en service. Le lot 9 est la valeur d’après, et **rien du lot 9 ne se
commence avant qu’un vrai collaborateur ait parlé dans un vrai logiciel** — sinon on construit sur
ce qu’on imagine.

| Prompt | Ce que ça referme | État |
|---|---|---|
| P-015 · la recette qui manque | [RECETTE_MVP] points 1 et 6, [BUGS_LOG] 005 à 008 | ✅ fait |
| P-016 · le filet de clôture | [BUGS_LOG] 003, T-006 | ✅ fait |
| P-017 · ce que le widget dit quand ça casse | [BUGS_LOG] 004, T-007 | ✅ fait |
| P-018 · le rôle de connexion | T-004 | ✅ fait |
| P-019 · la première mise en service | T-003 | ⏳ **la moitié AVANT est écrite** — la pose attend un hôte |
| P-020 · le retour au collaborateur | [ROADMAP] ① | ✅ fait — **avant P-019**, malgré le verrou prévu ([D-021](../00-Projet/DECISIONS_LOG.md)) |
| P-021 · le rejeu des trente secondes | [ROADMAP] ② | 🔒 après P-019 |
| P-022 · l’audio réécoutable | [ROADMAP] ③ | 🔒 après P-019 |
| P-023 · l’écran de gestion des produits | [ROADMAP] ⑤ | 🔒 après P-019 |
| P-024 · la traçabilité du correctif | prolonge P-020 côté MCP | ✅ fait — **hors séquence** |
| P-02X · la contextualisation métier de l’entretien | [D-020](../00-Projet/DECISIONS_LOG.md) | ✅ fait — **hors séquence** |
| P-025 · la citation qui n’en est pas une | [BUGS_LOG] 016 | ✅ fait |
| P-026 · la réponse d’un clic | [D-025](../00-Projet/DECISIONS_LOG.md) | ✅ fait |
| P-027 · ce que Feedys impose à son hôte | [BUGS_LOG] 018, [D-027](../00-Projet/DECISIONS_LOG.md) | ✅ fait |
| P-028 · les indices techniques | [D-026](../00-Projet/DECISIONS_LOG.md), T-011 | ✅ fait — **hors séquence** |
| P-029 · une installation par client | [D-028](../00-Projet/DECISIONS_LOG.md), [D-029](../00-Projet/DECISIONS_LOG.md) | ✅ fait — **hors séquence**, `1.0.0` publiée |
| P-030 · aucune note ne se perd, et Telegram prévient | [BUGS_LOG] 019, T-012, la relecture du 2026-09-17 | ✅ fait — [#31](https://github.com/PrFcTv/feedys/pull/31). ⏳ la dictée à la voix reste due **avant P-019** |

⚠️ **P-024 n’a pas de section de prompt ci-dessous, et c’est normal** : il est né d’une relecture
de P-020, pas de la planification. Ce qu’il fait tient dans
[tracabilite-du-correctif.md](../01-Specs/tracabilite-du-correctif.md) et
[D-024](../00-Projet/DECISIONS_LOG.md) — « traité » n’est plus une affirmation, il porte ce qui a
corrigé. Les numéros ne se réattribuent pas : P-021 à P-023 restent ce qu’ils étaient.

⚠️ **P-02X, P-028 et P-029 n’ont pas de section non plus, pour la même raison** — ils sont nés
en dehors de cette séquence, et ce qu’ils font tient dans leur décision :

- **P-02X** — la contextualisation métier et situationnelle de l’entretien :
  [D-020](../00-Projet/DECISIONS_LOG.md), [entretien.md](../01-Specs/entretien.md) ;
- **P-028** — les indices techniques : le navigateur relève ce qu’il a vu avant l’ouverture, et
  Feedys corrèle plutôt qu’il ne recopie. [D-026](../00-Projet/DECISIONS_LOG.md),
  [widget.md](../01-Specs/widget.md) §Les indices techniques, T-011 ;
- **P-029** — une installation par client : l’image publiée sur tag de version, et ce que la
  topologie coûte. [D-028](../00-Projet/DECISIONS_LOG.md), [D-029](../00-Projet/DECISIONS_LOG.md),
  [hebergement.md](../04-Architecture/hebergement.md) §Une installation par client. C’est lui qui a
  publié `1.0.0` — et c’est après lui que la relecture de P-030 a été jouée.

[MVP.md]: MVP.md
[ROADMAP]: ../00-Projet/ROADMAP.md
[BUGS_LOG]: ../03-Bugs/BUGS_LOG.md
[RECETTE_MVP]: ../03-Bugs/RECETTE_MVP.md
[TICKETS_DIFFERES]: ../00-Projet/TICKETS_DIFFERES.md

---

## ⛔ La relecture adverse du lot 7 — 2026-09-06

Les quatre PR du lot 7 ont été écrites par la même main, et **aucune n'avait été relue**. Une passe
adverse a été jouée sur chacune, avec la consigne de chercher des défauts réels, scénario de
défaillance à l'appui, et « zéro constat » comme réponse valable.

Elle a rendu **vingt-cinq constats**, dont **sept assez graves pour entrer au [BUGS_LOG]** :

| PR | Ce qui en est sorti |
|---|---|
| [#19](https://github.com/PrFcTv/feedys/pull/19) · P-016 | ⛔ **009** — le filet referme un entretien dont le panneau est resté ouvert. Ce que la personne écrivait ensuite était **jeté**, et le widget répondait « C'est parti. » Plus une passe qui pouvait durer une heure, un aval en échec qui ne disait pas *quel* retour, et **un test tautologique** qui se présentait comme la garantie anti-divergence |
| [#20](https://github.com/PrFcTv/feedys/pull/20) · P-017 | ⛔ **010, 011, 012** — la fiche et l'avis d'un entretien clos réapparaissaient à la réouverture ; l'invite regardait la phase en promettant le contraire ; une question blanche figeait l'entretien. Et `pnpm e2e` **n'était pas hors ligne** : il appelait pour de bon api.anthropic.com |
| [#21](https://github.com/PrFcTv/feedys/pull/21) · P-018 | ⛔ **013, 014, 015** — le conteneur démarrait **vert** avec un `DATABASE_URL` cassé ; le contrôle de rôle annonçait « Les GRANT s'appliquent » sur un rôle `NOINHERIT` qui ne peut rien lire ; `pnpm db:migrate` migrait avec le rôle de service. La procédure `psql` de [hebergement.md](../04-Architecture/hebergement.md) **ne s'exécutait pas** |

⚠️ **Ce que cette passe apprend, et qui vaut plus que les constats.** Trois des sept défauts sont
de la même famille : **du code juste qui devient faux parce qu'autre chose a changé autour de lui.**
Le filet a rendu atteignable une branche qui ne perdait rien tant que le champ y était vide ; P-017
a rendu rémanent un avis qui ne l'était pas tant qu'un seul chemin le posait ; P-018 a déplacé
l'étape « la base répond » et a laissé `DATABASE_URL` sans surveillance. ⛔ **Aucun de ces trois-là
ne se voit en relisant le diff** — ils ne se voient qu'en relisant ce que le diff rend possible.

⚠️ Trois propositions de la relecture ont été **refusées**, avec l'argument dans chaque PR : faire
dépendre l'aval du `rowCount` de `clore` (ça perdrait les apports tardifs), réécrire
`0003_privilege_registre.sql` (une migration appliquée ne se réécrit pas — son sha256 est au
registre), et l'ordre de deux tests. Une relecture se discute ; elle ne s'applique pas.

⛔ **Et une faute commise en corrigeant** : le premier test d'intégration écrit pour P-018 recopiait
la requête de production au lieu de l'importer — le test tautologique reproché à P-016 deux PR plus
tôt. Corrigé, et noté ici : c'est un piège auquel on retombe.

---

# Lot 7 — Finir le MVP pour de vrai

## P-015 · La recette qui manque — ✅ fait

⚠️ **Joué le 2026-09-05.** Les huit points de [RECETTE_MVP] sont au vert. Le prompt a rapporté
bien plus que prévu : quatre défauts, dont deux que seule la voix pouvait trouver —
[BUGS_LOG] 005 (`.env.local` invisible pour `pnpm dev`), 006 (les tests visaient le Postgres d’un
autre projet), 007 (la dictée mourait en plein milieu) et 008 (deux secondes de réflexion
coupaient la parole). Le prompt est conservé tel quel : il resservira à chaque recette.

**Objectif** — jouer les deux points que P-014 n’a pas pu jouer, faute de clé de modèle. C’est la
dernière chose qui sépare le MVP de son premier utilisateur, et c’est une demi-heure.

⚠️ **Prérequis humain** : une clé de modèle dans `.env.local`, et un vrai Chrome avec un micro.
Sans ça, ce prompt n’est pas jouable — et il ne doit surtout pas être joué « à peu près ».

```
Termine la recette du MVP. ⛔ N’écris pas de fonctionnalité : tu vérifies, tu
consignes, tu corriges ce qui bloque.

Lis 03-Bugs/RECETTE_MVP.md §Ce qui n’a pas pu être joué. Les points 1 et 6 y
sont déclarés NON JOUÉS. Tu les joues, avec une clé de modèle, contre l’image de
production (docker build .) et pnpm widget:demo.

1. Le parcours nominal, dans Chrome, À LA VOIX, de bout en bout : la bulle, la
   parole, la carte de compréhension, au plus deux questions, la fermeture, la
   synthèse, l’email, la fiche au back-office, la lecture par MCP.
   ⚠️ Cette manipulation est humaine et ne s’automatise pas — RECETTE_MVP le dit
   et l’explique. Guide-moi pas à pas, demande-moi ce que tu ne peux pas voir, et
   n’écris dans le document que ce que j’ai confirmé avoir vu.

6. L’injection de prompt. Dicte — ou écris — un transcript qui tente de détourner
   le bot : lui faire ignorer ses consignes, promettre une correction, poser un
   diagnostic, enchaîner trois questions d’un coup, ou recracher son prompt
   système. Au moins quatre tentatives distinctes.
   ⛔ Les cinq règles de CLAUDE.md §Le bot doivent tenir. Note le verdict de
   CHAQUE tentative : le texte envoyé, la réponse obtenue.

Vérifie aussi, pendant que le modèle répond :
- la console reste à zéro erreur — c’est le point 7, rejoué modèle branché ;
- la limite de deux relances est tenue par le SERVEUR et pas seulement par le
  widget. Sur un entretien ENCORE OUVERT, rejoue un troisième tour à la main
  avec curl : la réponse est 200 et `question` vaut `null` — la question du
  modèle est jetée par borner(), elle n’est PAS refusée, et aucun motif de
  refus ne couvre ce cas. Vérifie en base qu’aucune troisième ligne `bot` n’a
  été écrite.
  ⚠️ Si l’entretien a déjà été refermé par le point 1, le serveur rend 409
  `entretien_clos` : ça prouve la clôture, PAS le plafond. Refais-le sur un
  retour neuf.

Puis :
- mets à jour 03-Bugs/RECETTE_MVP.md — le tableau des huit points, et une
  section par point joué disant ce qui a été VU ;
- consigne chaque écart dans 03-Bugs/BUGS_LOG.md ;
- corrige dans cette PR ce qui bloque le parcours de référence, et SEULEMENT ça.
  Ouvre un ticket différé pour le reste, avec un déclencheur ;
- si le prompt système a dû bouger, une entrée dans 00-Projet/DECISIONS_LOG.md.

⛔ Ne touche ni au widget, ni au schéma, ni au back-office si rien ne t’y force.
```

**Acceptation** — le tableau de `RECETTE_MVP.md` n’a plus aucun ⛔ **non joué** · les quatre
tentatives d’injection sont écrites *in extenso* avec leur verdict · un troisième tour appelé à la
main sur un entretien ouvert rend `200` avec `question` à `null`, sans écrire de troisième ligne
`bot`.

---

## P-016 · Le filet qui referme les entretiens muets — ✅ fait

⚠️ **Joué le 2026-09-05.** L’étape 1 a fait ce qu’elle devait et **a répondu autre chose que
prévu** : la base de développement ne peut pas dire si le défaut est fréquent — ses dix `en_cours`
sont les artefacts des tentatives d’injection de P-015. Le chiffre utile était dans l’autre volet :
la clôture nominale arrive **en huit secondes au pire**, ce qui a fixé N à trente minutes
([D-018](../00-Projet/DECISIONS_LOG.md)). Un défaut de prémisse a aussi été trouvé en chemin : le
prompt demandait de distinguer le balayage « d’un abandon volontaire dans la table audit », or
**aucune clôture n’écrivait dans `audit`** — il n’y avait rien dont se distinguer.

**Objectif** — qu’un onglet tué ne coûte plus une note. Referme [BUGS_LOG] 003 et
[T-006][TICKETS_DIFFERES].

⚠️ **Ce prompt commence par une mesure, pas par du code.** T-006 le dit : la requête d’une ligne
qui donne la part de `en_cours` de plus d’une heure dit si le problème est réel, **et** donne la
bonne valeur de N. Écrire le balayage avant de l’avoir mesuré, c’est deviner deux fois.

```
Écris le filet qui referme les entretiens que le widget n’a pas refermés.

Lis 00-Projet/TICKETS_DIFFERES.md T-006, 03-Bugs/BUGS_LOG.md 003,
04-Architecture/hebergement.md et 00-Projet/DECISIONS_LOG.md D-016.

ÉTAPE 1 — mesurer, puis t’arrêter pour me montrer le résultat.
Une requête qui donne, sur les retours existants : la part de statut = 'en_cours'
dont le dernier message date de plus d’une heure, et la distribution des délais
entre le dernier message et le POST /fin quand il est bien arrivé.
⚠️ Attends ma réponse avant l’étape 2 : c’est moi qui tranche N.

ÉTAPE 2 — le balayage.
- Il clôt en 'abandonne' les entretiens sans message depuis N minutes, puis les
  synthétise PAR LE CHEMIN ORDINAIRE — pas une seconde implémentation de la
  synthèse, la même fonction que celle du POST /fin.
- ⛔ Pas de file, pas de worker, pas de dépendance au planificateur d’un
  hébergeur : hebergement.md l’interdit explicitement, et le conteneur doit
  rester déplaçable.
- ⚠️ Deux conteneurs qui balaient en même temps ne doivent pas synthétiser deux
  fois le même retour : réserve la ligne avant de la traiter.
- Une synthèse qui échoue ne laisse pas le retour dans un état intermédiaire et
  ne bloque pas les suivants.
- Le passage en 'abandonne' PAR LE BALAYAGE se distingue d’un abandon volontaire
  dans la table audit — c’est ce qui dira si le filet sert vraiment.
- La clôture par balayage envoie l’email comme les autres.

Tests :
- unitaire et pur : la décision « ce retour est-il muet ? », sans base ;
- intégration : un retour muet est clos et synthétisé ; un retour actif ne l’est
  pas ; deux balayages simultanés ne produisent qu’une synthèse ; une synthèse
  qui échoue ne perd pas le retour.

Dans le MÊME commit :
- 03-Bugs/BUGS_LOG.md 003 passe à ✅ Résolu ;
- T-006 est clos dans 00-Projet/TICKETS_DIFFERES.md, au format de T-001 ;
- une entrée D-0XX dans 00-Projet/DECISIONS_LOG.md : où tourne le balayage,
  pourquoi là, la valeur de N et ce qui l’a décidée ;
- 01-Specs/entretien.md dit qu’un entretien peut se clore sans le widget.

⛔ N’ajoute aucune colonne metadata. ⛔ Ne touche pas au widget.
```

**Acceptation** — un retour laissé `en_cours` avec un dernier message vieux de N+1 minutes finit
`abandonne` et porte une synthèse, sans intervention · le test des deux balayages simultanés rougit
si on retire la réservation de ligne.

---

## P-017 · Ce que le widget dit quand le modèle ne répond pas — ✅ fait

⚠️ **Joué le 2026-09-05.** Le recensement a montré que le défaut était plus large que
[BUGS_LOG] 004 : **quatre** situations produisent « en entretien, sans carte », dont une **sur le
chemin nominal** — pendant la latence du modèle, avant toute panne. Et il n’existait **aucun**
module de textes : les phrases étaient en dur dans le JSX, ce qui est la vraie raison pour laquelle
celle-ci n’avait jamais été arbitrée. Deux défauts silencieux ont été fermés au passage : un tour
en échec ne disait **rien du tout**, et un micro `indisponible` laissait une onde morte sans un mot.
Le parcours `widget:demo` a été câblé dans Playwright — il n’existait pas.

**Objectif** — une phrase, choisie. Referme [BUGS_LOG] 004 et [T-007][TICKETS_DIFFERES].

⚠️ Le travail n’est pas la condition — elle tient en deux lignes. Le travail est de **décider ce
qu’on dit**, dans un état où le widget n’a le droit ni de s’excuser, ni d’expliquer ce qui manque.
C’est exactement pour ça que ça n’est pas passé dans la PR de recette.

```
Reprends les textes du widget dans ses états dégradés.

Lis 01-Specs/widget.md, 04-Architecture/DESIGN.md, 03-Bugs/BUGS_LOG.md 004 et
00-Projet/TICKETS_DIFFERES.md T-007.

Le défaut : quand le tour rend 503, le panneau reste ouvert sans carte — c’est
voulu — mais l’invite du champ reste « Répondez, ou corrigez la fiche au-dessus »
alors qu’il n’y a pas de fiche.

Attendu :
- Recense TOUS les états où le widget parle sans avoir de carte : tour en échec,
  tour lent, réseau coupé, envoi refusé, dictée indisponible. Liste-les avant
  d’écrire une ligne de code, et montre-les-moi.
- Pour chacun, une phrase qui invite à continuer. ⛔ Elle ne s’excuse pas, elle
  n’explique pas ce qui manque, elle ne promet rien, elle ne diagnostique rien.
  ⚠️ Propose-moi DEUX formulations par état ; je choisis.
- L’invite du champ dépend de la présence d’une carte, pas seulement de la phase.
- ⛔ Aucune couleur en dur : tokens uniquement. ⛔ L’apostrophe est ’ (U+2019).
- Les textes vivent au même endroit que les autres, pas éparpillés dans le JSX.

Tests :
- un test de composant sur l’état « entretien sans carte » — c’est exactement ce
  qui manquait et qui a laissé passer le défaut ;
- un parcours widget:demo qui coupe le tour et vérifie l’invite affichée.

Dans le même commit : BUGS_LOG 004 → ✅ Résolu, T-007 clos, et 01-Specs/widget.md
gagne le tableau des états dégradés avec leur phrase.

⛔ Ne refais pas le design du panneau. ⛔ Ne touche pas au serveur.
```

**Acceptation** — modèle coupé, l’invite affichée ne mentionne aucune fiche · le test de l’état
« sans carte » existe et rougit si on remet l’ancienne invite.

---

# Lot 8 — La première mise en service

## P-018 · Le rôle de connexion n’est plus le propriétaire — ✅ fait

⚠️ **Joué le 2026-09-05.** Le prompt disait « ⛔ Aucune nouvelle migration de schéma si les GRANT
existants suffisent » — ils ne suffisaient pas, et le trou ne se serait vu **qu’en production** :
la table `migrations` ne portait aucun GRANT, or la sonde la lit avec le rôle de service. Séparer
les rôles aurait fait redémarrer le conteneur en boucle. Et un rôle de service ne peut pas migrer
du tout, même sur une base à jour — mesuré : Postgres vérifie `CREATE` sur le schéma avant le
court-circuit du `if not exists`.

**Objectif** — que les `GRANT` de `0001_socle.sql` mordent en usage, et pas seulement en test.
Referme [T-004][TICKETS_DIFFERES].

```
Fais que Feedys se connecte en production avec un rôle membre de feedys_app, et
non avec le propriétaire des tables.

Lis 00-Projet/TICKETS_DIFFERES.md T-004, 00-Projet/DECISIONS_LOG.md D-009,
04-Architecture/hebergement.md §Le rôle de connexion et
04-Architecture/conventions-db.md.

Le problème : sur le poste, DATABASE_URL pointe sur le superutilisateur, qui est
aussi propriétaire — les GRANT ne s’y appliquent pas. Le garde-fou « aucun
DELETE, audit append-only » n’est donc prouvé qu’en test d’intégration.

Attendu :
- La migration tourne avec un rôle qui en a le droit ; le service sert avec un
  rôle membre de feedys_app. Deux rôles, deux moments — décris précisément
  comment le conteneur s’y prend, sachant qu’il n’a QUE son entrée
  (DECISIONS_LOG.md D-016) et qu’il doit rester déplaçable.
- ⚠️ Un contrôle au démarrage qui dit, dans les journaux, si le rôle de service
  est propriétaire de ses tables. ⛔ Il n’empêche PAS de démarrer — un poste de
  développement est légitimement en rôle unique — mais il le dit clairement.
- docker-compose.yml (le poste) et docker-compose.production.yml montrent les
  deux cas. ⛔ Aucune valeur réelle, aucun secret, aucun mot de passe d’exemple
  qui ressemble à un vrai.
- Un test d’intégration : sous le rôle de service, un DELETE sur retours échoue,
  un UPDATE sur audit échoue, un INSERT sur audit passe.

Dans le même commit : T-004 clos dans 00-Projet/TICKETS_DIFFERES.md, et
04-Architecture/hebergement.md porte la procédure en entier.

⛔ Aucune nouvelle migration de schéma si les GRANT existants suffisent — vérifie
d’abord en lisant db/migrations/0001_socle.sql.
```

**Acceptation** — sous le rôle de service, `DELETE FROM retours` échoue en test d’intégration · le
service démarre et sert normalement avec ce rôle · le journal de démarrage dit dans lequel des deux
cas il se trouve.

---

## P-019 · La première mise en service, chez un hôte réel

**Objectif** — la seule chose qui referme [T-003][TICKETS_DIFFERES], « le trou de couverture le plus
large du MVP » : le widget dans une vraie page, écrite par quelqu’un d’autre, et pas dans notre page
hostile à nous.

⚠️ **Ce prompt n’est pas jouable seul.** Il demande un logiciel métier réel, une ligne de `<script>`
posée dedans, et des collaborateurs qui parlent. Le rôle de Claude Code y est d’outiller et de
consigner, pas de constater à ma place.

✅ **La moitié « AVANT la pose » est écrite** (2026-09-05) : la liste de vérification vit dans
[hebergement.md](../04-Architecture/hebergement.md) §La pose chez un hôte, en six étapes — le
service répond, la restauration jouée pour de vrai, le produit et sa clé, la ligne de `<script>`,
l’identité signée, et ce qu’on regarde dans les dix minutes qui suivent. ⛔ **Ce qui reste demande
un hôte réel** : la pose elle-même, `03-Bugs/MISE_EN_SERVICE.md`, et la clôture de T-003.

```
Prépare et consigne la première mise en service de Feedys chez un hôte réel.

Lis 00-Projet/TICKETS_DIFFERES.md T-003, 01-Specs/ingestion.md,
04-Architecture/hebergement.md et le README.

AVANT la pose :
- Une liste de vérification d’intégration, dans 04-Architecture/hebergement.md :
  créer le produit et sa clé, poser la ligne de <script>, régler le domaine
  d’origine, brancher l’identité signée côté hôte (DECISIONS_LOG.md D-005), et
  ce qu’on regarde dans les dix minutes qui suivent.
- ⚠️ La restauration du dump se joue UNE FOIS, pour de vrai, AVANT la pose
  (hebergement.md §La sauvegarde) : une sauvegarde jamais restaurée n’existe
  pas. Ce qui a été restauré, et depuis quel dump, entre dans
  MISE_EN_SERVICE.md.
- ⛔ Aucun nom de client, aucun domaine réel, aucune clé dans le dépôt. Les
  exemples restent en exemple.fr.

APRÈS la pose, je te rapporte ce que j’ai vu ; tu consignes dans un nouveau
03-Bugs/MISE_EN_SERVICE.md, au format de RECETTE_MVP.md :
- les styles de l’hôte qui fuient dans le widget, ou l’inverse ;
- le z-index, les position:fixed et les modales de l’hôte qui passent au-dessus ;
- les collisions de globales, et le poids réellement téléchargé chez l’hôte ;
- ⛔ la console de l’hôte : toute ligne écrite par nous est un défaut, y compris
  l’avertissement de snapdom (T-005) — s’il gêne pour de vrai, T-005 se rouvre ;
- ce que les premiers retours révèlent du bot : questions inutiles, relances hors
  sujet, notes creuses.

Chaque écart → une entrée dans 03-Bugs/BUGS_LOG.md. Ce qui se corrige en une
ligne se corrige ici ; le reste devient un ticket différé avec déclencheur.

Puis : T-003 est clos ou requalifié, et la page hostile de pnpm widget:demo
apprend ce que la vraie page nous a appris.
```

**Acceptation** — un collaborateur qui n’est pas moi a envoyé un retour depuis un vrai logiciel, et
la note est arrivée · `03-Bugs/MISE_EN_SERVICE.md` existe et dit ce qui a été vu · la page de
`widget:demo` a gagné au moins une hostilité observée en vrai.

---

# Lot 9 — Après le MVP, dans l’ordre de valeur

⛔ **Rien de ce lot ne se commence avant P-019.** L’ordre vient de [ROADMAP] §Après le MVP ; il est
écrit en valeur, pas en facilité.

## P-020 · Le retour au collaborateur — ①

**Objectif** — « ce que vous avez signalé mardi est corrigé ». C’est la suite la plus rentable de
toutes : sans elle, Feedys est un puits.

⚠️ **Ce prompt se discute avant de s’écrire.** Il touche à la frontière la plus fragile du produit :
[ROADMAP] §Ce qui n’arrivera pas exclut définitivement le support en direct et la réponse humaine
dans le widget. Une notification à sens unique déclenchée par le développeur n’est pas une réponse
— mais la limite est fine, et c’est elle, le vrai travail.

```
Écris le retour au collaborateur.

Lis 00-Projet/ROADMAP.md (§Après le MVP ① et §Ce qui n’arrivera pas),
01-Specs/back-office.md, 00-Projet/DECISIONS_LOG.md D-005 et D-007, et
02-Metier/glossaire.md.

ÉTAPE 1 — la spec, et tu t’arrêtes là.
Écris 01-Specs/retour-au-collaborateur.md et montre-le-moi AVANT tout code. Il
doit trancher, en s’appuyant sur ce qui existe déjà :
- QUI déclenche : le développeur, depuis la fiche, en passant le retour à
  'traite' ou 'ecarte'. ⛔ Rien d’automatique.
- QUOI part : une notification à sens unique. ⛔ Elle n’ouvre aucun fil, elle
  n’attend aucune réponse, elle ne devient jamais un canal de support.
- OÙ on écrit à quelqu’un dont on n’a que { ref, nom, role } signés par l’hôte
  (D-005) — Feedys n’a ni adresse email de collaborateur, ni compte utilisateur.
  C’est LA question à résoudre, et elle a plusieurs réponses possibles : l’hôte
  relaie, le widget affiche au prochain passage, autre chose. Pose-moi le choix
  avec ses conséquences ; ⛔ ne le décide pas seul.
- ⛔ Ce qu’on ne dit jamais : une date, une promesse, un diagnostic.

ÉTAPE 2 — l’implémentation, une fois la spec validée. Migration SQL en colonnes
nullables typées (⛔ jamais de metadata), domaine pur et testable sans base,
l’envoi derrière l’interface existante de domaine/notification.

Dans le même commit que le code : la spec, une entrée DECISIONS_LOG, et le
glossaire si un mot nouveau apparaît.
```

**Acceptation** — la spec est écrite et validée **avant** la première ligne de code · un
collaborateur informé ne peut pas répondre dans Feedys, et rien dans l’écran ne le suggère.

---

## P-021 · Le rejeu des trente secondes — ②

**Objectif** — voir le bug plutôt que le reconstituer. Le plus gros gain de temps de diagnostic.

⚠️ **Le budget du widget est l’obstacle, et il n’est pas négociable** : 60 Ko gzip
(01-Specs/widget.md), dont 26,0 Ko sont déjà consommés — les 23,2 Ko souvent cités sont la mesure
brotli, sur le fil ([RECETTE_MVP]). Il reste 34 Ko, et `rrweb` n’y rentre pas. Le précédent existe et
il est bon : snapdom est **servi par Feedys, pas empaqueté dans le widget**
([D-011](../00-Projet/DECISIONS_LOG.md)).

```
Écris le rejeu des trente secondes précédant un retour.

Lis 00-Projet/DECISIONS_LOG.md D-011 (le précédent snapdom), 01-Specs/widget.md
§le budget, 04-Architecture/dependances.md et 04-Architecture/licences.md.

AVANT tout : vérifie la licence de rrweb en LISANT le fichier LICENSE du dépôt —
⛔ NOASSERTION sur l’API GitHub n’est pas un verdict (CLAUDE.md §Dépendances).
Mesure son poids gzip réel. Si l’une des deux réponses est mauvaise, tu
t’arrêtes et tu me le dis : ⛔ ce prompt n’a pas de plan B silencieux.

Attendu :
- rrweb est chargé À LA DEMANDE et SERVI PAR FEEDYS, comme snapdom (D-011).
  ⛔ Jamais empaqueté dans widget.js. Le budget de 60 Ko reste vérifié SUR LE
  FICHIER SERVI, en-têtes compris — BUGS_LOG 001 dit pourquoi c’est la seule
  mesure qui compte.
- Un tampon glissant de trente secondes, en mémoire, jeté à la fermeture s’il n’y
  a pas de retour. ⛔ Rien ne part tant que personne n’a parlé.
- ⚠️ Le masquage est le DÉFAUT, pas l’option : mots de passe, champs de saisie,
  tout ce qui ressemble à une donnée de dossier. Un rejeu capture l’écran de
  quelqu’un qui travaille sur de vraies personnes.
- Le stockage, la durée de rétention et l’effacement se tranchent dans 01-Specs/
  et dans une entrée DECISIONS_LOG, pas au fil du code.
- La lecture au back-office, sur la fiche, jamais dans la liste.
- ⚠️ La colonne qui porte le chemin du rejeu N’EXISTE PAS : `contextes` s’arrête
  à `capture_chemin`. Il faut donc une migration — une colonne nullable typée,
  ⛔ jamais de metadata.
- 04-Architecture/dependances.md : rrweb quitte §Ce qu’on prendra après le MVP
  pour §Ce qu’on prend, avec la date de vérification et le poids gzip mesuré —
  et en dépendance d’apps/serveur, pas de packages/widget, comme snapdom.

⛔ Ne touche pas à la boucle d’entretien. ⛔ N’ajoute rien au MCP.
```

**Acceptation** — `widget.js` **tel que servi** est toujours sous 60 Ko gzip, mesuré sur la réponse
HTTP · un champ de mot de passe est illisible dans le rejeu · aucun rejeu n’est envoyé quand le
panneau se ferme sans retour.

---

## P-022 · L’audio conservé et réécoutable — ③

**Objectif** — rendre le ton au développeur. « Ça, ça m’énerve tous les matins » ne dit pas la même
chose écrit et dit.

⚠️ Le tuyau **et le rangement** existent déjà : l’ingestion accepte un audio depuis P-003, l’écrit
sur le volume `FEEDYS_STOCKAGE` et garde son chemin dans `messages.audio_chemin`
(01-Specs/ingestion.md). Ce qui manque est **aux deux bouts** : le widget ne l’enregistre pas et ne
l’envoie pas, rien ne le rejoue, et rien ne l’efface — garder la voix de quelqu’un n’est pas garder
son transcript.

```
Conserve l’audio d’un retour et rends-le réécoutable au back-office.

Lis 01-Specs/ingestion.md, 01-Specs/back-office.md,
04-Architecture/hebergement.md et 04-Architecture/dependances.md.

ÉTAPE 1 — UNE question à trancher avant le code, dans 01-Specs/ et une entrée
DECISIONS_LOG, puis tu t’arrêtes et tu me montres :
- COMBIEN DE TEMPS on garde l’audio, et ce qui l’efface. ⚠️ C’est
  l’enregistrement de la voix d’une personne identifiée : la rétention se
  décide, elle ne se laisse pas être « pour toujours, par défaut ».
⛔ Ne rouvre PAS la question du stockage : où vit le fichier est déjà tranché,
spécifié et implémenté (01-Specs/ingestion.md, le volume FEEDYS_STOCKAGE).

ÉTAPE 2 :
- Le widget envoie l’audio EN PLUS du transcript quand la dictée a servi.
  ⛔ Le transcript reste la source de l’entretien : le bot n’attend pas l’audio,
  et un envoi d’audio qui échoue ne perd NI la parole NI la note. Écris le test.
- La lecture sur la fiche du back-office. Vérifie la licence de wavesurfer.js en
  lisant son LICENSE ; s’il ne tient pas dans MIT/Apache-2.0/ISC/BSD, un
  <audio controls> fait le travail et coûte zéro octet.
- Tout emprunt substantiel → ATTRIBUTIONS.md dans le même commit, et
  04-Architecture/dependances.md tranché : wavesurfer.js rejoint §Ce qu’on
  prend, avec la date et le poids mesuré — ou §Ce qu’on a écarté si
  <audio controls> l’emporte.

⛔ Ne transcris rien côté serveur ici : Whisper est un autre sujet, sans ticket
ouvert — voir §Ce qui n’est pas encore un prompt. Son déclencheur dépend
notamment de l’issue de T-002, qui porte sur la dictée LOCALE de Chrome et pas
sur Whisper.
```

**Acceptation** — un retour dicté porte son audio et se réécoute depuis la fiche · couper le
stockage d’audio n’empêche ni l’entretien, ni la synthèse, ni l’email · la durée de rétention est
écrite quelque part **et** appliquée par du code.

---

## P-023 · L’écran de gestion des produits — ⑤

**Objectif** — poser Feedys sur un deuxième logiciel sans passer par un script.

⚠️ Le modèle de données prévoit déjà plusieurs produits ; c’est l’écran qui manque ([ROADMAP] §hors
MVP). Et ⛔ **ça ne devient pas du multi-tenant** : pas d’organisations, pas de comptes
utilisateurs, pas de facturation — [ROADMAP] §Ce qui n’arrivera pas.

```
Écris l’écran de gestion des produits au back-office.

Lis 01-Specs/back-office.md, 00-Projet/DECISIONS_LOG.md D-005 et D-015, et
00-Projet/ROADMAP.md §Ce qui n’arrivera pas.

Attendu :
- Lister, créer, désactiver un produit : le nom, le domaine d’origine, l’état.
- La clé publique est affichée avec la ligne de <script> prête à copier.
- ⚠️ Le secret ne s’affiche qu’UNE fois, à la création, exactement comme
  pnpm produit:creer. La rotation du secret est possible et dit franchement ce
  qu’elle casse chez l’hôte.
- Le filtre par produit sur la liste des retours et dans le MCP.
- ⛔ Aucun compte utilisateur, aucune organisation, aucun rôle : l’accès au
  back-office reste ce qu’il est aujourd’hui.
- Libellés en français, tokens de DESIGN.md, ’ pour l’apostrophe.

Tests : création, unicité de la clé, désactivation → l’ingestion rend 404, et le
secret n’est jamais réaffiché après sa création — aucune page ni réponse d’API
du back-office ne le porte, ni en clair ni chiffré. ⚠️ La vérification
d’identité, elle, le déchiffre à chaque ingestion : c’est D-015, et ce n’est pas
ce qu’on teste ici.

Dans le même commit : 01-Specs/back-office.md mis à jour.
```

**Acceptation** — un deuxième produit se crée à l’écran et reçoit un retour dans la foulée · le
secret n’est jamais réaffiché · désactiver un produit fait rendre `404` à l’ingestion.

---

## P-025 · La citation qui n’en est pas une — ✅ fait

**Objectif** — une note ne peut pas citer entre guillemets un mot que le bot a écrit.
[BUGS_LOG](../03-Bugs/BUGS_LOG.md) 016.

⚠️ **Petit correctif, gros enjeu.** La citation verbatim est ce que la note a de plus fiable, et
`plafonnerConfiance` en dépend directement : une correction citée fait **monter** la confiance sur
la foi des mots du bot. ⚠️ Ce prompt passe **avant** P-026, qui étend l’exclusion qu’il pose.

```
Corrige le défaut 016 de 03-Bugs/BUGS_LOG.md.

Lis 03-Bugs/BUGS_LOG.md 016, 00-Projet/DECISIONS_LOG.md D-025,
apps/serveur/domaine/synthese/produire.ts, apps/serveur/domaine/synthese/verbatim.ts,
apps/serveur/domaine/entretien/tour.ts (composerApports) et
04-Architecture/conventions-db.md.

Le bassin des citations — parolesDe() — ne doit contenir que ce que la personne
a réellement DIT. Les lignes de correction de carte, écrites par composerApports
sous la forme « Correction · <champ> — <valeur> », sont fabriquées à partir de la
carte du bot : elles en sortent.

⛔ Ne touche pas à verbatim.ts. Il fait exactement son travail — le défaut est
   dans ce qu’on lui donne à chercher, pas dans sa façon de chercher.
⛔ Ne retire rien du fil. Les lignes de correction restent visibles au
   back-office et par MCP. C’est leur usage comme SOURCE DE CITATION qu’on
   supprime, pas leur existence.
⛔ Ne reconnais pas une correction à son préfixe de texte. Le fil doit porter
   de quoi la distinguer, sinon la règle se casse le jour où quelqu’un dicte
   « correction · ».

LA MIGRATION — décidée en D-025, ne la rediscute pas :
  create type geste_message as enum ('correction', 'reponse_axe');
  alter table messages add column if not exists geste geste_message;
« geste is null » veut dire « c’est de la parole ». ⚠️ Les DEUX valeurs sont
déclarées ici bien que P-025 n’emploie que la première : alter type … add value
ne permet pas d’employer la valeur dans la transaction qui l’ajoute.
Colonne nullable typée, ⛔ jamais de metadata. Miroir prisma/schema.prisma puis
pnpm db:generate, ⛔ jamais prisma migrate. messages reste append-only.

Le test qui manquait tient en une phrase : une ligne « Correction · » n’est pas
citable. Écris-le d’abord, vois-le rougir, puis corrige.

Dans le même commit : l’entrée 016 passe à ✅ Résolu.
```

**Acceptation** — le test rougit avant le correctif · une correction de carte n’apparaît plus jamais
en citation · une correction reste lisible dans le fil au back-office et par MCP · les six checks
verts en local.

---

## P-026 · La réponse d’un clic — ✅ fait

**Objectif** — répondre à la relance sans réactiver le micro ni retaper une phrase, **sans que le
bot mette des mots dans la bouche de personne**. [D-025](../00-Projet/DECISIONS_LOG.md).

⚠️ **Ne s’ouvre qu’après P-025** : il étend l’exclusion et réutilise la colonne posées là.

```
Écris la réponse d’un clic.

Lis 00-Projet/DECISIONS_LOG.md D-025, 01-Specs/entretien.md (§Ce qu’il est utile
de demander, §La carte de compréhension, §Les cinq règles dures),
01-Specs/widget.md §En entretien, 01-Specs/synthese.md,
04-Architecture/DESIGN.md, 04-Architecture/conventions-db.md et
02-Metier/glossaire.md.

CE QUI EST DÉJÀ DÉCIDÉ (D-025) — ⛔ ne le rediscute pas :
- deux axes, « recurrence » et « ampleur », et pas un de plus ;
- le modèle déclare l’axe, il n'écrit AUCUN libellé ;
- aucune puce « Autre » — le champ texte et le micro SONT l’autre ;
- le widget envoie la VALEUR, jamais le libellé ;
- une réponse d’un clic n’est pas de la parole : geste = 'reponse_axe',
  exclue du bassin des citations ;
- les verrous sont dans borner(), côté serveur.

CE QUE TU AS À FAIRE
1. Le contrat, côté MIT : AXES et VALEURS_AXE dans transport.ts (⛔ sans zod,
   il ne dépend de rien) ; SchemaTourRendu gagne « axe » ; SchemaCorpsTour gagne
   « axe » et « valeurAxe », liés par un refine — l’un sans l’autre est refusé.
   ⚠️ Relance budget.test.ts après : trois boutons ne doivent pas coûter 26 Ko.
2. Le modèle : SchemaTourModele gagne « axe ». Deux phrases dans
   prompts/systeme.md — un axe SEULEMENT si la réponse à ta question est
   exactement l’une de ses valeurs, sinon null. ⛔ Aucun appel supplémentaire.
3. borner() : les trois verrous de D-025 — pas de question → pas d’axe ;
   recurrence déjà posée → pas d’axe ; valeur hors énumération → jetée.
   Les tests d’abord.
4. La migration : messages.axe et messages.valeur_axe, colonnes nullables
   typées (⛔ jamais de metadata), avec un check que les deux sont nulles ou
   aucune. La colonne geste existe déjà (P-025). Miroir Prisma,
   pnpm db:generate, ⛔ jamais prisma migrate.
5. La synthèse : parolesDe() exclut aussi geste = 'reponse_axe' ; un axe
   répondu FIXE impact ou recurrence, sur le modèle de plafonnerConfiance.
   ⛔ On ne croit pas le modèle sur ce qu’on sait de source sûre.
6. Le widget : trois boutons sous la question, au-dessus du bloc micro.
   ⛔ Pas de role="radiogroup" : ce n’est pas un choix obligatoire.
   ⛔ Absents pendant l'écoute, comme le pied de panneau.
   Un clic ENVOIE le tour, en emportant le texte et les corrections en cours —
   sinon le bénéfice d’une seconde disparaît. Tokens uniquement, ⛔ aucune
   couleur en dur.
   ⛔ UN CLIC PRODUIT UNE SEULE LIGNE DE FIL, PAS DEUX. Il envoie l’axe ; il ne
      passe PAS aussi par le chemin des corrections de carte, sinon le même fait
      arrive au modèle en double — une fois « Correction · Depuis — à chaque
      fois », une fois « Réponse · Récurrence — systematique ». Le champ de la
      carte se met à jour avec la compréhension du tour suivant, exactement
      comme après une réponse dictée.
7. MCP : une ligne d’axe se lit comme CHOISIE, pas comme dite. Sans ça, le
   développeur relit le défaut 016 un étage plus bas.
8. pnpm entretien:rejouer imprime l’axe rendu à chaque tour. C’est l’outil de
   mise au point du prompt : sans lui, « le modèle propose des boutons sur une
   question ouverte » ne se constate qu’en production. ⛔ Il n'écrit toujours
   rien.

Dans le même commit : 01-Specs/entretien.md, 01-Specs/widget.md et
01-Specs/synthese.md mis à jour, et le glossaire si un mot nouveau apparaît.

⛔ Recette sur « pnpm widget:demo », jamais dans le back-office.
```

**Acceptation** — un clic termine le tour en une seconde · aucune réponse d’un clic n’apparaît jamais
en citation · un axe répondu se retrouve tel quel dans `impact` ou `recurrence` de la note · sur une
question ouverte, aucun bouton n’apparaît · le bundle tient sous 60 Ko gzip · les six checks verts
en local.

---

## P-027 · Ce que Feedys impose à son hôte, et ce qu’il lui doit

**Objectif** — deux dettes envers le logiciel qui nous héberge, trouvées en préparant la première
pose. ⛔ **À jouer AVANT la pose chez un hôte réel** : après, la première devient une négociation.

### ⚠️ Ce qui est déjà MESURÉ — ⛔ ne le remesure pas, ne le rediscute pas

**1. Sous un CSP strict, le widget s’affiche NU.** Mesuré le 2026-09-09, page même origine,
`default-src 'self'; script-src 'self'; connect-src 'self'`, sans `style-src 'unsafe-inline'` :

| | fond du lanceur | rayon | hauteur | console |
|---|---|---|---|---|
| `<style>` (aujourd’hui) | `rgb(240,240,240)` — gris système | `0px` | `59px` | ⛔ `Applying inline style violates…` |
| + `style-src 'unsafe-inline'` | `rgb(44,62,100)` = `--w-accent` | `999px` | `48px` | vide |
| **feuille construite** (`new CSSStyleSheet()` + `replaceSync`) | `rgb(44,62,100)` | `999px` | `48px` | **vide, SANS `unsafe-inline`** |

⛔ Le widget **monte et fonctionne** dans les trois cas. Ce n’est pas « la bulle n’apparaît pas » :
c’est un bouton système gris et carré dans le coin d’un logiciel métier, plus une erreur rouge dans
sa console. Ça a l’air cassé, et c’est nous.

⛔ **Et ça contredit notre propre doctrine.** [D-011](../00-Projet/DECISIONS_LOG.md) refuse de
charger snapdom depuis un CDN parce que « lui imposer un tiers au moment de l’exécution, **et la
règle CSP qui va avec**, n’est pas à nous de le décider ». Exiger `style-src 'unsafe-inline'` pour
notre propre feuille est la même faute, non appliquée jusqu’au bout.

**2. Le jeton d’identité expire au bout d’une heure, et l’exemple du README l’y encourage.** Dans
un logiciel métier, un onglet ouvert toute la journée est la norme. Passé une heure, les retours
arrivent **sans auteur** — rien n’est perdu, mais [P-020](../01-Specs/retour-au-collaborateur.md)
ne peut plus revenir vers personne, c’est-à-dire la suite que [ROADMAP] classe ①.

```
Répare les deux dettes de Feedys envers son hôte. ⛔ Les mesures sont dans
05-Prompts/APRES-MVP.md §P-027 : ne les remesure pas, sers-t’en.

Lis 05-Prompts/APRES-MVP.md §P-027, 00-Projet/DECISIONS_LOG.md D-001, D-003,
D-005 et D-011, 01-Specs/widget.md §L’intégration, 04-Architecture/licences.md,
04-Architecture/hebergement.md §La pose chez un hôte, et README.md.

═══ PARTIE 1 — LA FEUILLE DE STYLE NE DOIT PLUS EXIGER DE CSP ═══

packages/widget/src/montage.tsx pose aujourd’hui un <style> dans le shadow DOM.
Remplace-le par une feuille CONSTRUITE, avec repli sur l’ancien chemin.

⛔ LE REPLI N’EST PAS FACULTATIF. CSSStyleSheet constructible manque sur
   Safari < 16.4 et Firefox < 101. D-003 assume Chrome/Edge pour la DICTÉE,
   pas pour le widget : ailleurs, le champ texte doit rester impeccable.

⛔ ET LE REPLI NE DOIT PAS DEVENIR LE CHEMIN ORDINAIRE SANS QUE RIEN NE LE DISE.
   C’est le vrai piège de cette partie : un try/catch autour d’une
   implémentation partielle avalerait l’échec, et le widget retomberait pour
   toujours sur le <style> — en production comme en test, sans un mot. Le
   chemin réellement pris doit être OBSERVABLE et vérifié dans un vrai
   navigateur.

⚠️ happy-dom n’implémente peut-être pas adoptedStyleSheets. Si c’est le cas,
   montage.test.tsx exercerait le REPLI et resterait vert pour toujours en ne
   prouvant rien du nouveau chemin. ⛔ Vérifie-le explicitement, dis-moi ce
   qu’il en est, et fais porter la preuve du chemin construit à un parcours
   e2e — pas à un test unitaire.

LA PREUVE, en e2e, dans un vrai Chromium :
- une page servie par l’ORIGINE FEEDYS avec un CSP strict en <meta> —
  « default-src 'self'; script-src 'self'; connect-src 'self' » — et AUCUN
  unsafe-inline : le lanceur porte var(--w-accent), un rayon de 999px, une
  hauteur de 48px, et la console est VIDE ;
- le shadow DOM porte une feuille adoptée et AUCUN élément <style> ;
- ⛔ et le parcours ne s’arrête pas au chargement : ouvre le panneau, écris,
  envoie, laisse le tour partir. Une violation CSP peut n’apparaître qu’au
  premier fetch ou au chargement de snapdom.

═══ PARTIE 1 bis — DIRE CE QU’ON EXIGE VRAIMENT, ET L’AVOIR MESURÉ ═══

⛔ NE DEVINE AUCUNE DIRECTIVE. Mesure-les, une par une, en CROISANT LES DEUX
   ORIGINES (la page de démonstration est sur un autre port que Feedys — c’est
   le seul montage qui ressemble à la réalité) :
   - script-src  : widget.js, ET /snapdom.js chargé à l’ouverture du panneau ;
   - connect-src : ingestion, tour, fin, et la relève des réponses ;
   - style-src   : après la partie 1, il ne devrait plus RIEN falloir. Prouve-le ;
   - img-src     : snapdom manipule des images. Mesure si « data: » est exigé.

⚠️ MESURE AUSSI CE QUI N’EST PAS EXIGÉ, et écris-le. Une liste de directives
   trop large est aussi nuisible qu’une liste absente : elle fait relâcher une
   politique sans raison, et personne ne la resserre ensuite.

Écris le résultat dans 04-Architecture/hebergement.md §La pose chez un hôte, en
liste de vérification, avec la ligne de CSP minimale à donner à un intégrateur.

═══ PARTIE 2 — LE JETON QUI EXPIRE ═══

packages/widget/src/identite.ts lit « window.feedys.identite » à chaque envoi —
le mécanisme de rafraîchissement EXISTE déjà, mais l’hôte doit poser une
nouvelle chaîne lui-même, et l’exemple du README lui donne une heure.

Fais accepter aussi une FONCTION :

    window.feedys = { identite: () => monJetonCourant }

- ⛔ SYNCHRONE, et pas de promesse. Une fonction asynchrone ferait attendre le
  chemin d’envoi sur du code de l’hôte : une lenteur ou un blocage chez lui
  coûterait la parole de quelqu’un. ⛔ « On ne perd jamais une parole pour un
  problème d’identité » (P-012) — écris ce refus dans le code, avec sa raison,
  sinon quelqu’un ajoutera l’await dans six mois.
- ⛔ Une fonction qui LÈVE est traitée comme une identité absente. L’exception
  ne remonte jamais : un bug chez l’hôte ne casse pas l’envoi.
- ⛔ Une fonction qui rend autre chose qu’une chaîne non vide : identité absente.
- ⚠️ La forme chaîne continue de marcher, à l’identique. Aucun hôte existant
  n’a à bouger.

Puis l’exemple, dans README.md ET 01-Specs/widget.md :
- « exp » à une journée de travail, pas à une heure, AVEC la raison écrite —
  et le compromis dit franchement (un jeton fuité vaut jusqu’à son expiration) ;
- montre la forme fonction comme la manière RECOMMANDÉE dès qu’une page peut
  rester ouverte longtemps, ce qui est le cas ordinaire d’un logiciel métier.

═══ CE QUE TU NE FAIS PAS ═══

⛔ Aucun changement côté serveur : il reçoit le même en-tête, il vérifie la
   même signature. Si tu te retrouves à toucher domaine/identite/, arrête-toi.
⛔ Aucune couleur, aucun token, aucune règle de style modifiés : la partie 1
   change COMMENT la feuille est posée, jamais ce qu’elle contient.
⛔ Pas de version, pas de negociation de capacités, pas de drapeau de
   configuration pour choisir le chemin. Le widget essaie le bon, se replie, et
   se tait.
⛔ Ne touche pas au cache de /widget.js (entetes.ts) : c’est un autre sujet, et
   il a son ticket.

═══ DOCUMENTATION, DANS LE MÊME COMMIT ═══

- 01-Specs/widget.md : §L’intégration (forme fonction), et la feuille adoptée ;
- 04-Architecture/hebergement.md : la liste CSP mesurée ;
- README.md : les deux exemples corrigés ;
- 00-Projet/DECISIONS_LOG.md : une entrée — « le widget n’exige aucune
  relaxation du CSP de son hôte, et l’identité peut être une fonction
  synchrone ». Elle doit porter ce qui la renverserait ;
- 03-Bugs/BUGS_LOG.md : une entrée pour la feuille bloquée — elle a été
  CONSTATÉE, mesurée, et elle serait arrivée chez un vrai hôte.

⛔ Les six checks en local, intégralement, et tu colles la sortie.
```

**Acceptation** — sous un CSP strict **sans aucun `unsafe-inline`**, le lanceur porte
`var(--w-accent)`, un rayon de 999px, une hauteur de 48px, et la console reste vide **du
chargement jusqu’à l’envoi d’un retour** · le shadow DOM ne contient aucun `<style>` dans un
navigateur qui sait faire · le repli existe et est prouvé · `window.feedys.identite` accepte une
chaîne **et** une fonction, et une fonction qui lève n’empêche pas un envoi · `hebergement.md`
porte la ligne de CSP **mesurée**, ni plus large ni plus étroite · le bundle tient sous 60 Ko gzip.

⚠️ **Hors périmètre, à ouvrir en ticket** : l’invariant « le serveur tolère un `widget.js` vieux
d’un jour », conséquence du `stale-while-revalidate` de 86 400 s. Réel, mais c’est un autre sujet
que ce que Feedys impose à son hôte.

---

## P-030 · Aucune note ne se perd, et Telegram prévient

**Objectif** — fermer ce que la relecture du 2026-09-17 a trouvé **après** la publication de
`1.0.0` : une panne du modèle qui perd des notes pour toujours sans que personne le sache, un
rattrapage documenté qui ne peut pas marcher, des alertes écrites mais jamais codées, un contrat
widget ↔ serveur qui se trompe sur son propre écart de version. Et faire de **Telegram** le canal
recommandé : deux variables, là où l’email demande un relais SMTP par client.

⛔ **À jouer AVANT P-019.** Poser chez un vrai client une version qui perd des notes en silence,
c’est découvrir le défaut chez lui, sans aucun moyen de le voir.

⚠️ **L’email reste dans le code.** Il n’est ni retiré ni déprécié : il cesse seulement d’être le
canal qu’on recommande et qu’on documente en premier.

### ⚠️ Ce qui est déjà CONSTATÉ — ⛔ ne le remesure pas, ne le rediscute pas

Relecture du 2026-09-17, sur `main` à `0da28df`. Les six checks étaient **verts** — 825 tests
unitaires, 136 d’intégration, 26 parcours, `docker build` compris. ⛔ **Aucun des défauts
ci-dessous ne se voit dans les tests.**

**1. 🔴 Une panne du modèle perd la note pour toujours, et personne ne le sait.**

| Fait | Où |
|---|---|
| Une synthèse en `modele_indisponible` écrit une ligne de console, puis **s’arrête** | `apps/serveur/infra/composition.ts:158-169` |
| Sans synthèse, **aucune notification ne part** : `charger` rend `null` | `apps/serveur/domaine/notification/envoyer.ts:23` |
| Les trois tentatives (60 s chacune) vivent **dans** l’appel ; après, plus rien ne retente | `apps/serveur/domaine/entretien/modele.ts:141,185` |
| Le filet ne regarde que les `en_cours` : un retour `envoye` ou `abandonne` sans note n’est **jamais** repris | `apps/serveur/domaine/entretien/balayage.ts:68,144` |
| La seule alerte est un `console.warn` — sur le VPS d’un client, que personne ne lit ([D-028]) | `apps/serveur/infra/filet.ts:89` |

⛔ **Et le rattrapage documenté ne peut pas marcher**
([hebergement.md](../04-Architecture/hebergement.md) §La requête de rattrapage, l. 812-829), pour
trois raisons indépendantes :

- il appelle `pnpm entretien:rejouer --synthese`, qui **n’écrit rien**, par construction
  (`apps/serveur/outils/entretien-rejouer.ts:9-11`) ;
- l’image de production ne contient **ni `pnpm`, ni `tsx`, ni `outils/`** (étage `production` du
  `Dockerfile`), et le dépôt n’est pas sur le VPS du client (hebergement.md l. 140-142) ;
- sa requête ne voit que les retours refermés **par le filet** (`audit.action =
  'cloture_balayage'`). Un entretien refermé **normalement** par le widget, dont la synthèse a
  échoué, ne laisse aucune ligne `audit` : il est invisible.

⚠️ **Ce n’est pas un cas d’école, c’est la conséquence directe de [D-029]** : un plafond de
workspace atteint, une clé révoquée, une panne du fournisseur — et toutes les notes de la période
disparaissent. D-029 reproche à l’option (b) que « personne côté développeur n’est prévenu » ; c’est
exactement aussi vrai de l’option (a), celle qu’on a retenue.

⚠️ Le commentaire de `rejouerAval` (`apps/serveur/domaine/entretien/tour.ts:382`) affirme « Une
note qui manque se rattrape — la requête est dans hebergement.md ». **C’est faux aujourd’hui.**

**2. 🟠 Les alertes de hebergement.md n’existent pas.** §Ce qui doit être surveillé (l. 840-852)
fixe trois seuils — zéro retour sur 7 jours, moins de 40 % de `voix`, plus de 5 % d’échecs du
modèle. **Aucun n’est codé** : un `grep` ne trouve que les `console.warn` du filet et du démarrage.
Avec une installation par client et aucun « phone home » ([D-028]), **rien ne remonte**.

**3. 🟠 L’écart widget ↔ serveur existe, et D-028 affirme le contraire.**

- [D-028] (DECISIONS_LOG.md l. 1376-1378) et hebergement.md §2 (l. 88-92) : « il n’y a **jamais**
  d’écart entre le widget et le serveur qui le sert ». Faux, deux fois : `widget.js` est servi en
  `stale-while-revalidate=86400` (`apps/serveur/domaine/actifs/entetes.ts:20`), et P-027 le dit
  lui-même — **un onglet de logiciel métier reste ouvert toute la journée**, avec le widget chargé
  le matin.
- `packages/widget/src/contrat.ts` porte **douze `.strict()`**. Après un **retour arrière** de
  version, un widget plus récent qui envoie un champ inconnu voit son retour **entier** refusé en
  400 — et `packages/widget/src/envoi.ts:80` ne classe réessayables que 429 et 5xx : ⛔ **la parole
  n’entre pas en base.**
- Le widget lit les réponses **sans zod** : renommer un champ de réponse casse en silence tous les
  onglets ouverts.
- ⛔ P-027 annonçait « il a son ticket » (§P-027, « Ce que tu ne fais pas » et « Hors
  périmètre »). **Il n’a jamais été ouvert** : [TICKETS_DIFFERES] s’arrête à T-011.

**4. 🟡 `1.0.0` a été publiée sans recette à la voix.** [RECETTE_MVP] l. 181-183 exige de rejouer
le point 1 après toute modification de `dictee/` ou de `useDictee.ts`. La dernière dictée humaine
date du 2026-09-05 (P-015) ; P-017 (`41a5393`) a modifié `useDictee.ts` ensuite, et P-020, P-02X,
P-026, P-027 et P-028 ont tous touché le widget.

**5. 🟡 Le ménage.**

- **La doc a décroché.** Le tableau d’en-tête de ce fichier marque P-020 « 🔒 après P-019 » alors
  qu’il est fait, et ne liste ni P-025 à P-029 ; P-028 et P-029 n’ont pas de section. La
  [ROADMAP] n’a pas P-029, et dit encore « P-015 à P-026, dont le premier est joué ». T-004 est
  clos, mais son corps (l. 106-109) dit « Le ticket reste ouvert pour ça ».
- **`@prisma/client` est une dépendance de production que personne n’importe.** Seuls deux
  commentaires le citent (`apps/serveur/next.config.ts:24`, `apps/serveur/infra/base/migrations.ts:8`) ;
  le serveur parle à Postgres par `pg`. `04-Architecture/dependances.md` l. 45 le dit pourtant
  « accès base ». Il apporte à lui seul les trois alertes de `pnpm audit --prod`, toutes via
  `prisma@7.10.0` : `deepmerge-ts <8.0.0` (high), `mysql2 <3.22.0` (high), `mysql2 <=3.23.0`
  (moderate).
- **`pnpm test` imprime une pile d’erreur alors qu’il est vert** : happy-dom refuse de charger
  `snapdom.js` (`packages/widget/src/contexte/capture.ts:136`, « JavaScript file loading is
  disabled »).
- **`origin/deploiement-tls`** est une branche distante dont le contenu est déjà dans `main` (PR
  #23).

### Telegram — ce qu’il faut savoir avant d’écrire une ligne

- L’envoi est un `fetch` HTTPS vers `api.telegram.org/bot<JETON>/sendMessage`. **Aucune
  dépendance** n’est nécessaire.
- ⛔ **Le jeton est DANS l’URL.** Toute erreur réseau qui recopie l’URL le fait fuir — dans
  `notifications.erreur`, dans `signaler`, dans les journaux.
- ⛔ **La note contient du texte dicté.** `parse_mode: 'MarkdownV2'` exige d’échapper dix-huit
  caractères, et un seul oubli rend 400. Texte brut, ou HTML avec `& < >` échappés — rien d’autre.
- Un message est limité à **4 096 caractères**.
- ⚠️ **L’aperçu de lien** enverrait les robots de Telegram sur l’URL du back-office du client :
  `link_preview_options: { is_disabled: true }`.
- Les refus à traiter : `429` avec `parameters.retry_after`, `403` (bot bloqué, ou retiré du
  groupe), `400` (`chat not found`).
- ⛔ **Sens unique.** Pas de `getUpdates`, pas de webhook, pas de commande : le bot ne lit rien.
  Sinon Feedys devient un canal de support ([ROADMAP] §Ce qui n’arrivera pas, D-021).
- ⚠️ **Les données.** Les échanges avec un bot sont stockés chez Telegram, sans chiffrement de bout
  en bout. Si la note passe par Telegram, Telegram devient un **sous-traitant** des données des
  salariés du client, et la phrase de contrat (hebergement.md §1, l. 59-75) doit le nommer. ⛔
  L’entité juridique et l’existence d’un contrat de sous-traitance se **vérifient** ; elles ne se
  supposent pas.

```
Joue P-030 : aucune note ne se perd, et Telegram prévient.

⛔ Les constats sont dans 05-Prompts/APRES-MVP.md §P-030 : ne les remesure
pas, sers-t’en, et cite-les dans les entrées que tu écris.

Lis 05-Prompts/APRES-MVP.md §P-030, 00-Projet/DECISIONS_LOG.md D-007, D-018,
D-021, D-026, D-028 et D-029, 04-Architecture/hebergement.md (§Une
installation par client, §Les variables, §Le filet, §Ce qui doit être
surveillé), 04-Architecture/conventions-db.md, 01-Specs/synthese.md §Le rendu
par email, 01-Specs/back-office.md, 01-Specs/ingestion.md et
03-Bugs/RECETTE_MVP.md.

⚠️ Plusieurs sessions travaillent sur ce dépôt : worktree dès le départ, en
chemin court — git worktree add X:/wt-p030 -b p-030-notes-et-telegram.
⛔ Jamais de checkout dans X:\Feedys BOT.

═══ ÉTAPE 0 — CE QUI SE TRANCHE AVEC MOI, PUIS TU T’ARRÊTES ═══

Écris d’abord les deux entrées que les constats exigent. Elles datent du
constat, pas du correctif :
- 03-Bugs/BUGS_LOG.md 019 — la note perdue sur panne du modèle, et le
  rattrapage qui ne peut pas marcher. Statut 🔴 Ouvert.
- 00-Projet/TICKETS_DIFFERES.md T-012 — l’écart de version widget ↔ serveur,
  promis par P-027 et jamais ouvert.

Puis pose-moi ces choix, chacun avec ses conséquences. ⛔ Tu ne les décides
pas seul.

1. CE QUE PORTE LE MESSAGE TELEGRAM. Que Telegram devienne le canal
   recommandé, c’est décidé. Le contenu ne l’est pas :
   (a) la note entière, comme l’email — Telegram devient sous-traitant, la
       phrase de contrat change, et il faut tenir dans 4 096 caractères ;
   (b) un pointeur — type, produit, lien vers la fiche, sans titre ni
       citation : la parole ne quitte pas le serveur du client.
2. QUAND LES DEUX CANAUX SONT CONFIGURÉS : les deux partent, ou Telegram seul ?
3. QUELLES ALERTES. Celles d’exploitation (une note devenue impossible, un
   taux d’échec du modèle) ne disent rien de l’usage. Les deux autres seuils
   de hebergement.md (zéro retour en 7 jours, part de voix) SONT des
   statistiques d’usage — or la phrase de contrat promet « aucune donnée
   d’usage, aucune statistique » (hebergement.md l. 74-75). On amende la
   phrase, ou ces deux-là restent LOCALES, dans un panneau « État de
   l’installation » du back-office ?
4. LE RETOUR ARRIÈRE DE VERSION. Soit les enveloppes du contrat tolèrent un
   champ inconnu (`.strip()`) — ⛔ mais SchemaIndice reste `.strict()`, c’est
   le mur de D-026 contre `message` —, soit on écrit qu’un retour arrière
   impose d’attendre un jour et de faire recharger les onglets.
5. LA MIGRATION. Lis la structure réelle (notifications, syntheses, retours,
   audit, l’enum canal_notification), liste ce qui change, propose le SQL.
   ⚠️ `ALTER TYPE … ADD VALUE` : la nouvelle valeur n’est pas utilisable dans
      la transaction qui l’ajoute. Vérifie comment
      apps/serveur/infra/base/migrations.ts découpe ses transactions avant
      d’écrire — ne le suppose pas.
   ⚠️ `dejaEnvoyee(retourId)` suppose UNE notification par retour, et aucune
      contrainte ne le tient en base. Avec deux canaux, ça devient par canal.

═══ PARTIE 1 — AUCUNE NOTE NE SE PERD ═══

- Le filet reprend les retours clos (`envoye`, `abandonne`) SANS synthèse,
  quelle que soit la façon dont ils ont été clos — par le widget comme par
  le filet. Tentatives comptées EN BASE, en colonnes nullables typées
  (⛔ jamais de metadata), espacées, plafonnées.
- ⛔ `rien_a_synthetiser` n’est JAMAIS retenté : un retour dicté sans
  transcript ne produira jamais de note.
- Même budget que le filet (vingt retours, trois minutes), en série, sous le
  même verrou `enCours`. ⛔ Deux passes qui se chevauchent doubleraient les
  appels au modèle. `syntheses_retour_uniq` reste le vrai garde-fou contre la
  double note.
- Une note reprise part ensuite par le chemin ordinaire — `synthetiser()`
  appelle déjà `notifier()`. ⛔ Pas de second chemin.
- Plafond atteint → le retour est marqué définitivement sans note, le
  back-office le dit sur la liste ET sur la fiche, et une alerte part
  (partie 3).
- Un moyen MANUEL qui marche DANS L’IMAGE — ni pnpm, ni tsx, ni dépôt sur le
  VPS : un bouton « Refaire la note » sur la fiche d’un retour SANS note.
  ⛔ Il ne régénère jamais une note existante (une note par retour), et il ne
     touche à rien d’autre. 01-Specs/back-office.md dit ce qu’une main
     humaine a le droit de faire : mets-le à jour.
- ⛔ `entretien:rejouer` reste en lecture seule. Ne le fais pas écrire.
- Réécris hebergement.md §La requête de rattrapage avec le chemin qui marche,
  et corrige les textes qui mentent : le commentaire de `rejouerAval`
  (tour.ts:382) et le message d’alerte de filet.ts:89.

Tests, modèle en bouchon :
- il échoue, puis revient → la note est écrite et la notification part à la
  passe suivante ;
- un retour clos par le widget, sans ligne audit, est repris ;
- `rien_a_synthetiser` n’est jamais retenté ;
- le plafond de tentatives tient ;
- deux passes simultanées n’appellent pas deux fois le modèle ;
- le bouton refuse un retour qui a déjà sa note.

═══ PARTIE 2 — TELEGRAM, LE CANAL RECOMMANDÉ ═══

- `FEEDYS_TELEGRAM_JETON` et `FEEDYS_TELEGRAM_CHAT` (un chat_id peut être
  négatif : c’est un groupe). Derrière un port de canal dans
  domaine/notification, à côté du SMTP. ⛔ Module pur, `fetch` injecté.
- ⛔ Aucune dépendance : le `fetch` natif suffit. Si tu en envisages une,
  CLAUDE.md §Dépendances s’applique, fichier LICENSE lu.
- ⛔ LE JETON NE SORT JAMAIS. Toute erreur est nettoyée AVANT d’aller dans
  `notifications.erreur` ou dans `signaler`. Écris le test : une erreur qui
  recopie l’URL ne laisse pas passer le jeton.
- Texte brut, ou HTML échappé. Écris le test avec un transcript qui contient
  `<b>`, `&`, `_*[` et un emoji.
- 4 096 caractères : on tronque proprement, et le lien vers la fiche reste.
- Aperçu de lien désactivé. Délai borné (AbortSignal.timeout) — ⛔ jamais
  l’attente infinie : BUGS_LOG 013 dit ce qu’elle coûte.
- 429 → on respecte `retry_after`. 403 et 400 → `echoue`, avec une raison
  lisible, sans boucle.
- ⛔ Sens unique : ni `getUpdates`, ni webhook, ni commande.
- Un message d’essai qui marche DANS L’IMAGE, pour la liste d’installation —
  un bouton du back-office, par exemple. ⛔ La sonde `/sante` n’appelle
  toujours aucun fournisseur.
- Le démarrage : domaine/demarrage/controles.ts:44-46 dit « la note ne part
  par email pour personne » dès que SMTP manque. Telegram configuré sans SMTP
  n’est PAS une dégradation. Aucun canal configuré en est une, et le
  démarrage le dit.
- ⛔ `pnpm test` et `pnpm e2e` restent hors ligne : aucun appel réel à
  api.telegram.org. La relecture du lot 7 a trouvé un e2e qui appelait
  api.anthropic.com pour de vrai — ne refais pas cette faute.
- ⚠️ Un bot par installation : ajoute FEEDYS_TELEGRAM_JETON au tableau de
  hebergement.md §4, avec ce que sa réutilisation coûterait.
- La procédure pour obtenir le jeton et le chat_id est DOCUMENTÉE, pas codée.
  ⛔ Aucun jeton, aucun chat_id réel dans le dépôt, même en exemple.
- L’email reste, tel quel, et ses tests aussi.

═══ PARTIE 3 — LES ALERTES QUI MANQUENT ═══

Selon ce qu’on a tranché à l’étape 0, question 3.
- Le canal des alertes est Telegram, et lui seul. ⛔ Une alerte ne passe
  pas par ce qu’elle surveille — ni par le SMTP, ni par le modèle. Sans
  Telegram, elles restent en console, et le démarrage le dit.
- ⛔ Une alerte ne contient jamais de parole ni de nom. Un identifiant de
  retour n’est pas de la parole (hebergement.md §Le filet) ; le produit et
  l’origine publique disent de quelle installation il s’agit.
- ⛔ Une alerte par incident, pas une par passe : un filet qui parle toutes
  les cinq minutes finit par ne plus être lu. Dis où vit l’état qui
  l’empêche, et ce qu’il devient quand le conteneur redémarre.
- ⛔ Aucune nouvelle infrastructure : ni worker, ni cron, ni file (D-018).
- hebergement.md §Ce qui doit être surveillé devient VRAI : chaque seuil dit
  où il est calculé, et qui le lit.

═══ PARTIE 4 — L’ÉCART DE VERSION ═══

Selon ce qu’on a tranché à l’étape 0, question 4.
- La règle, dans 01-Specs/ingestion.md : un champ de requête nouveau est
  toujours facultatif ; un champ de réponse ne se renomme ni ne disparaît.
- Un test qui la tient : des corps de requête du widget `1.0.0`, ÉCRITS À LA
  MAIN et figés par version, validés contre les schémas d’aujourd’hui ; et
  les réponses d’aujourd’hui relues avec ce que le widget `1.0.0` en lit.
  ⛔ Aucun retour réel en fixture.
- D-028 et hebergement.md §2 : on ne réécrit pas le passé, on ANNOTE
  (« ⚠️ Corrigé le … »). La phrase « jamais d’écart » est fausse — dis
  pourquoi.
- T-012 est clos ou requalifié, avec ce qui reste.

═══ PARTIE 5 — LE MÉNAGE ═══

- Ce fichier : le tableau d’en-tête à jour (P-020 fait, P-025 à P-030
  listés), et une note pour P-028 et P-029 sur le modèle de celle de P-024.
  La ROADMAP : P-029, P-030, et la phrase « dont le premier est joué ».
  T-004 : le paragraphe l. 106-109 est annoté comme antérieur à la clôture.
  §Ce qui n’est pas encore un prompt : la ligne « Slack, les webhooks » dit
  que Telegram en est sorti, et pourquoi.
- `@prisma/client` : vérifie ce dont `pnpm db:generate` et l’étape
  `RUN pnpm db:generate` du Dockerfile ont réellement besoin, puis sors-le
  des dépendances de production, ou retire-le.
  ⛔ Si le miroir prisma/schema.prisma cesse de se générer, arrête-toi et
     dis-le-moi.
  Cible : `pnpm audit --prod` propre, ou chaque alerte restante justifiée
  dans 04-Architecture/dependances.md — dont la ligne « accès base » est
  fausse.
- La pile happy-dom dans la sortie de `pnpm test` : fais-la taire DANS LE
  TEST, jamais dans capture.ts.
- `origin/deploiement-tls` : ⛔ demande-moi avant de supprimer une branche
  distante.

═══ PARTIE 6 — CE QUI RESTE UNE MANIPULATION HUMAINE ═══

Une fois l’image construite, prépare le montage, puis demande-moi :
- le point 1 de RECETTE_MVP, à la voix, dans un vrai Chrome, sur
  `pnpm widget:demo` branché sur l’image ;
- un vrai message reçu sur mon téléphone, par un vrai bot.
  ⛔ Les secrets sont dans .env.local : ne me les redemande pas, ne les
     affiche pas.
Tu consignes ce que je rapporte dans RECETTE_MVP.md, dans une section datée.
Tout écart → une entrée BUGS_LOG.

═══ CE QUE TU NE FAIS PAS ═══

⛔ Tu ne retires pas l’email, et tu ne le déprécies pas.
⛔ Tu ne touches ni à la boucle d’entretien, ni au prompt du bot.
⛔ Aucun « phone home », aucun agrégateur des installations (ROADMAP §Ce qui
   n’arrivera pas) : chaque installation parle à SON bot, et à rien d’autre.
⛔ Tu ne poses aucun tag. `1.0.1` est une décision humaine : propose-la, avec
   la liste de ce qu’elle corrige (D-028 : semver nu, sans « v »).

═══ DOCUMENTATION, DANS LE MÊME COMMIT ═══

- 00-Projet/DECISIONS_LOG.md D-030 — Telegram, canal recommandé : ce qu’il
  renverse de D-007, ce qu’on a tranché à l’étape 0, et ce qui le
  renverserait ;
- 03-Bugs/BUGS_LOG.md 019 → ✅ Résolu, avec « ce qui l’a laissé passer » ;
- 01-Specs/synthese.md (le rendu Telegram à côté du rendu email),
  01-Specs/back-office.md, 01-Specs/ingestion.md ;
- 04-Architecture/hebergement.md : §Les variables, §4, la liste
  d’installation (Telegram en premier), la phrase de contrat si elle change,
  §Le filet, §Ce qui doit être surveillé ;
- README.md et .env.example : Telegram d’abord, email ensuite ;
- CLAUDE.md §Commandes si une commande apparaît ;
- 02-Metier/glossaire.md si un mot apparaît. ⛔ Jamais « ticket ».

⛔ Les six checks en local, intégralement, et tu colles la sortie.
```

**Acceptation** — un modèle coupé puis rétabli : la note arrive **sans intervention**, y compris
pour un entretien refermé par le widget · « Refaire la note » marche dans l’image, sans `pnpm` · une
note devenue impossible fait partir **une** alerte Telegram, sans parole ni nom · un vrai message
Telegram est arrivé sur un vrai téléphone · le jeton n’apparaît dans aucune erreur, aucune ligne de
base, aucun journal · un corps de requête du widget `1.0.0` passe toujours · `pnpm audit --prod`
est propre, ou justifié · la dictée à la voix est rejouée et consignée · BUGS_LOG 019 est ✅ et
T-012 clos ou requalifié · les six checks sont verts.

⚠️ **État au 2026-09-17** ([RECETTE_MVP] §P-030) : « Refaire la note » et l’alerte sans Telegram
sont vérifiés **dans l’image**. ⛔ **Le vrai message Telegram est reporté à la première
intégration**, par décision — un bot par installation, jeton posé chez le client, jamais dans le
dépôt ([T-013]). ⏳ **La dictée à la voix reste due avant P-019** — la PR a été fusionnée sans elle, par décision du
développeur : la clé de modèle du poste
est refusée (401).

[T-013]: ../00-Projet/TICKETS_DIFFERES.md

[D-028]: ../00-Projet/DECISIONS_LOG.md
[D-029]: ../00-Projet/DECISIONS_LOG.md

---

# Ce qui n’est pas encore un prompt

⚠️ Ces sujets sont ouverts et **n’ont volontairement pas de prompt** : leur déclencheur n’est pas
tombé. Les écrire maintenant reviendrait à deviner.

| Sujet | Ce qui le rouvrira |
|---|---|
| **T-002** · la dictée locale de Chrome (`processLocally`) | `SpeechRecognition.available({ langs: ['fr-FR'], processLocally: true })` répond favorablement sur le poste, **ou** une exigence de confidentialité arrive |
| **T-005** · l’avertissement snapdom dans la console de l’hôte | un intégrateur signale la ligne — c’est P-019 qui le dira —, **ou** snapdom expose de quoi la taire |
| **④ le regroupement** de retours similaires | un volume qui le justifie. [ROADMAP] : « le construire avant serait deviner » |
| **Whisper côté serveur** | Chrome n’est plus tenable, **ou** T-002 échoue et la confidentialité l’exige. Le tuyau est déjà prêt : l’ingestion accepte l’audio depuis P-003 |
| **Slack, les webhooks, l’ouverture d’issues** — [ROADMAP] §hors MVP | des retours réels ont prouvé que la note est bonne. D-007 : « ils s’ajouteront quand la note aura prouvé qu’elle est bonne » — P-019 ouvre la mesure, il ne la tranche pas. ⚠️ **Telegram en est sorti avec P-030** : il ne porte pas la note — un avis sans parole, et les alertes —, donc le motif de D-007 ne le visait pas ([D-030](../00-Projet/DECISIONS_LOG.md)). Un webhook, lui, reste ici — et c’est le premier canal d’alerte à considérer le jour où un client refuse Telegram |
| **T-008** · la liste du back-office en mode dégradé | le mode dégradé devient fréquent — un relevé, pas une impression ([RECETTE_MVP] §5) |

Le détail de chaque ticket, avec son coût si on le fait plus tard, est dans [TICKETS_DIFFERES].

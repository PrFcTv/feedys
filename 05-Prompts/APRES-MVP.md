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
| P-020 · le retour au collaborateur | [ROADMAP] ① | 🔒 après P-019 |
| P-021 · le rejeu des trente secondes | [ROADMAP] ② | 🔒 après P-019 |
| P-022 · l’audio réécoutable | [ROADMAP] ③ | 🔒 après P-019 |
| P-023 · l’écran de gestion des produits | [ROADMAP] ⑤ | 🔒 après P-019 |

[MVP.md]: MVP.md
[ROADMAP]: ../00-Projet/ROADMAP.md
[BUGS_LOG]: ../03-Bugs/BUGS_LOG.md
[RECETTE_MVP]: ../03-Bugs/RECETTE_MVP.md
[TICKETS_DIFFERES]: ../00-Projet/TICKETS_DIFFERES.md

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

# Ce qui n’est pas encore un prompt

⚠️ Ces sujets sont ouverts et **n’ont volontairement pas de prompt** : leur déclencheur n’est pas
tombé. Les écrire maintenant reviendrait à deviner.

| Sujet | Ce qui le rouvrira |
|---|---|
| **T-002** · la dictée locale de Chrome (`processLocally`) | `SpeechRecognition.available({ langs: ['fr-FR'], processLocally: true })` répond favorablement sur le poste, **ou** une exigence de confidentialité arrive |
| **T-005** · l’avertissement snapdom dans la console de l’hôte | un intégrateur signale la ligne — c’est P-019 qui le dira —, **ou** snapdom expose de quoi la taire |
| **④ le regroupement** de retours similaires | un volume qui le justifie. [ROADMAP] : « le construire avant serait deviner » |
| **Whisper côté serveur** | Chrome n’est plus tenable, **ou** T-002 échoue et la confidentialité l’exige. Le tuyau est déjà prêt : l’ingestion accepte l’audio depuis P-003 |
| **Slack, les webhooks, l’ouverture d’issues** — [ROADMAP] §hors MVP | des retours réels ont prouvé que la note est bonne. D-007 : « ils s’ajouteront quand la note aura prouvé qu’elle est bonne » — P-019 ouvre la mesure, il ne la tranche pas |
| **T-008** · la liste du back-office en mode dégradé | le mode dégradé devient fréquent — un relevé, pas une impression ([RECETTE_MVP] §5) |

Le détail de chaque ticket, avec son coût si on le fait plus tard, est dans [TICKETS_DIFFERES].

# Feuille de route

## Où on en est

**Le collaborateur a enfin quelque chose à regarder.** Le monorepo s’installe, se construit et se
vérifie ; la frontière de licence est tenue par le lint et prouvée par un test ; la base existe,
avec ses sept tables, ses privilèges et son runner de migrations. Un retour entre et se persiste —
`POST /api/retours`, avec sa clé, ses bornes et son contexte. Et la coquille du widget existe : une
ligne de `<script>` chez l’hôte, un lanceur, un panneau, un champ texte qui va jusqu’en base, le
tout dans un shadow DOM fermé qui survit à une page volontairement hostile. **Et le geste central
existe** : on maintient, on parle, l’onde suit vraiment la voix, le transcript s’écrit dessous, on
relâche, on relit, on envoie — et `source` vaut `voix`. **Et le bot parle** : le retour part, une carte de
compréhension revient, corrigeable champ par champ, avec au plus deux questions — la limite est
tenue par le serveur, sur le fil en base, et aucune défaillance ne perd la parole. **Et la note
existe** : à la fin de l’entretien, une synthèse typée est produite et stockée, avec des citations
verbatim garanties par le code plutôt que demandées au modèle. Il reste à la faire sortir — email,
back-office, MCP.

**Et quelqu’un a parlé.** Le 2026-09-05, un humain a ouvert la bulle dans un vrai Chrome, dicté un
bug à la voix, répondu à la question du bot, et refermé. La note est arrivée, citations verbatim
comprises. Il a fallu trois essais : les deux premiers ont sorti deux défauts que 543 tests
unitaires ne voyaient pas ([BUGS_LOG](../03-Bugs/BUGS_LOG.md) 007 et 008). **Le parcours de
référence du MVP marche de bout en bout.**

| Prompt | État |
|---|---|
| P-001 · le squelette du monorepo | ✅ fait |
| P-002 · le schéma et les migrations | ✅ fait |
| P-003 · l’ingestion d’un retour | ✅ fait |
| P-004 · la collecte de contexte | ✅ fait |
| P-005 · la coquille du widget | ✅ fait |
| P-006 · la dictée | ✅ fait |
| P-007 · la boucle d’entretien | ✅ fait |
| P-008 · la synthèse | ✅ fait |
| P-009 · l’email | ✅ fait |
| P-010 · le back-office | ✅ fait |
| P-011 · le serveur MCP | ✅ fait |
| P-012 · l’identité signée | ✅ fait |
| P-013 · le conteneur | ✅ fait |
| P-014 · recette du MVP | ✅ fait — ⚠️ deux points sur huit non joués, faute de clé de modèle |
| P-015 · la recette qui manquait | ✅ fait — **les huit points au vert** ([RECETTE_MVP](../03-Bugs/RECETTE_MVP.md)), quatre défauts corrigés ([BUGS_LOG](../03-Bugs/BUGS_LOG.md) 005 à 008) |
| P-016 · le filet de clôture | ✅ fait — un entretien muet depuis trente minutes se referme et se synthétise tout seul ([BUGS_LOG](../03-Bugs/BUGS_LOG.md) 003, [D-018](DECISIONS_LOG.md)) |
| P-017 · les textes des états dégradés | ✅ fait — l’invite suit ce qui est à l’écran, et le widget parle enfin quand un tour n’aboutit pas ([BUGS_LOG](../03-Bugs/BUGS_LOG.md) 004) |

La séquence de travail est dans [05-Prompts/MVP.md] — quatorze prompts, un par PR.

**La suite est écrite** : [05-Prompts/APRES-MVP.md] — neuf prompts, P-015 à P-023, dont le
premier est joué. Le lot 7
finit un MVP qui n’est pas tout à fait fini (la recette non jouée, les deux défauts contournés
de [BUGS_LOG](../03-Bugs/BUGS_LOG.md)), le lot 8 le met en service, le lot 9 est l’ordre de
valeur ci-dessous. ⛔ Rien du lot 9 ne se commence avant qu’un vrai collaborateur ait parlé
dans un vrai logiciel.

## Le MVP — ce qu’il doit faire, et rien de plus

> Un collaborateur de VictorIA clique sur la bulle, dit « le tri de la colonne date remet tout à
> zéro quand je reviens sur la page », répond à deux questions, ferme. Le développeur reçoit un
> email avec une note utilisable, et son Claude Code peut lire le retour sans quitter l’éditeur.

C’est tout. Si ce parcours marche de bout en bout sur **un seul produit**, le MVP est atteint.

| Lot | Contenu | Prompts |
|---|---|---|
| **Socle** | monorepo, licences, frontière de lint, CI, schéma et migrations | P-001 → P-002 |
| **Le tuyau** | ingestion par clé d’API, contexte, identité signée | P-003, P-004, P-012 |
| **Le widget** | coquille shadow DOM, lanceur, panneau, dictée | P-005 → P-006 |
| **Le bot** | boucle d’entretien, synthèse structurée | P-007 → P-008 |
| **La sortie** | email, back-office, MCP | P-009 → P-011 |
| **La mise en service** | conteneur, déploiement, recette | P-013 → P-014 |

### Ce qui est explicitement hors MVP

Écrit ici pour qu’on n’ait pas à en rediscuter à chaque prompt :

- plusieurs produits en parallèle — le modèle de données les prévoit, l’écran de gestion non ;
- la relecture de l’audio dans le back-office (`wavesurfer`) ;
- le rejeu de session (`rrweb`) ;
- Slack, les webhooks, l’ouverture d’issues ;
- le retour vers le collaborateur (« c’est corrigé ») ;
- le regroupement de retours similaires ;
- tout écran d’administration au-delà de la liste et de la fiche.

## Après le MVP, dans l’ordre de valeur

**① Le retour au collaborateur.** « Ce que vous avez signalé mardi est corrigé. » C’est la suite
la plus rentable de toutes : c’est elle qui fait qu’on continue à parler. Sans elle, Feedys est
un puits.

**② Le rejeu des trente secondes précédentes** (`rrweb`). Voir le bug plutôt que le reconstituer.
Le plus gros gain de temps de diagnostic, et la brique est mûre.

**③ L’audio conservé et réécoutable.** Le transcript efface le ton. « Ça, ça m’énerve tous les
matins » ne dit pas la même chose écrit et dit.

**④ Le regroupement.** Quand trois personnes signalent la même chose en des termes différents.
Utile seulement passé un certain volume — le construire avant serait deviner.

**⑤ Les autres produits.** Le portail CGP, VIXIS, OrelSign. Techniquement, c’est une ligne de
`<script>` et une clé ; l’écran de gestion des produits est le seul vrai travail.

## Ce qui n’arrivera pas

Pour couper court, ces sujets sont **hors périmètre définitivement**, pas « plus tard » :

- le vote, le classement, la feuille de route publique ;
- le multi-tenant, les organisations, la facturation, les comptes utilisateurs ;
- le support en direct, la réponse humaine dans le widget ;
- une application mobile.

# Feuille de route

## Où on en est

**Le socle est posé, le produit n’existe pas encore.** Le monorepo s’installe, se construit et se
vérifie ; la frontière de licence est tenue par le lint et prouvée par un test. Rien du produit
lui-même n’est écrit : ni ingestion, ni widget, ni entretien.

| Prompt | État |
|---|---|
| P-001 · le squelette du monorepo | ✅ fait |
| P-002 → P-014 | à faire |

La séquence de travail est dans [05-Prompts/MVP.md] — quatorze prompts, un par PR.

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

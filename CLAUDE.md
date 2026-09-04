# Feedys — le retour terrain, dicté

## ⚠️ À LIRE EN PREMIER — ce qu’est Feedys

**Feedys est un widget de remontée d’information, embarqué dans des logiciels métier, dont le
geste central est la parole.** Un collaborateur rencontre un problème ou a une idée, il ouvre la
bulle, il **parle**. Un bot le relance deux fois pour préciser. Le développeur reçoit une **note
rédigée**, pas une ligne dans un tableau.

**Ce n’est pas un board de vote. Ce n’est pas un Canny, un Fider, un Productboard.** Il n’y a
aucun vote, aucun classement public, aucune feuille de route votée par les utilisateurs. Ces
outils servent à arbitrer entre des milliers d’inconnus ; Feedys sert à écouter **une dizaine de
collaborateurs identifiés qui travaillent dans le même bureau**. Le vote n’a rien à y faire.

En conséquence, ne jamais écrire, proposer ni supposer : votes, upvotes, board public, roadmap
publique, changelog utilisateur, tri par popularité, doublons fusionnés automatiquement,
commentaires entre utilisateurs.

**Ce n’est pas non plus un support client.** Personne ne répond au collaborateur en direct. Le bot
n’est pas un agent de support : il **ne diagnostique pas, ne promet rien, ne dépanne personne**. Il
écoute, il précise, il transmet.

### Le dépôt est public, et c’est délibéré

Feedys est **open source, AGPL-3.0**. C’est le premier dépôt public de son auteur. Deux
conséquences qui ne se négocient pas : rien de confidentiel n’entre ici (voir §Secrets), et la
**frontière de licence** décrite plus bas est un invariant d’architecture, pas une formalité.

## WHAT — stack et carte du dépôt

**Stack** : monorepo pnpm + Turborepo · Next.js 16 (serveur + back-office) · Preact + Vite
(widget) · TypeScript · Prisma + PostgreSQL · Vercel AI SDK + Claude · Docker

```
apps/serveur/        Next.js 16 — API d’ingestion, entretien, back-office        AGPL-3.0
packages/widget/     Preact + Vite — le bout embarqué, build → widget.js         MIT
packages/mcp/        serveur MCP — expose les retours à un agent de code         MIT
db/migrations/       SQL brut, source de vérité du schéma
prisma/schema.prisma miroir typé de la base, jamais `prisma migrate`
```

Le widget se déploie sur les logiciels métier par **une seule ligne** :

```html
<script src="https://feedys.<domaine>/widget.js" data-cle="fdy_pub_…" defer></script>
```

## ⛔ La frontière de licence — l’invariant le plus fragile du projet

**La racine est AGPL-3.0. `packages/widget` et `packages/mcp` sont MIT.** Ce n’est pas une
coquetterie : c’est ce qui permet à Feedys d’être libre **sans contaminer les logiciels qui
l’embarquent**.

Le mécanisme, en une phrase : deux processus qui dialoguent en HTTP ne forment pas un seul
programme ; du code empaqueté dans le même bundle, si.

| Ce qu’on fait | Effet sur le logiciel hôte |
|---|---|
| Le widget est chargé par `<script src>` depuis le conteneur Feedys | ✅ aucun — deux programmes distincts |
| Le widget est installé en dépendance npm et empaqueté par le bundler de l’hôte | ⛔ **le bundle de l’hôte devient une œuvre dérivée** |

⛔ **Donc : `packages/widget` ne publie pas de paquet npm destiné à être empaqueté par l’hôte.**
Il produit **un fichier `widget.js` servi par le serveur Feedys**. C’est la seule voie
d’intégration supportée, et la raison est juridique avant d’être technique.

⛔ **Et rien de `apps/serveur` (AGPL) ne remonte dans `packages/widget` (MIT).** Pas un type, pas
une constante, pas un utilitaire. Ce qui doit être partagé entre les deux est **du contrat de
transport** — formes de requêtes et de réponses — et vit dans `packages/widget/src/contrat.ts`,
côté MIT, d’où le serveur l’importe. Jamais l’inverse. Vérifié par lint d’imports.

*La découpe est empruntée à [FasterFixes](https://github.com/manucoffin/faster-fixes), qui résout
exactement ce problème de la même façon. Détail : [04-Architecture/licences.md].*

## WHY — à quoi ça sert

Réduire au minimum la friction entre le moment où quelqu’un bute et le moment où le développeur
l’apprend. Pas de formulaire, pas de ticket, pas d’email. **Cliquer, parler, envoyer.**

Le pari est que la parole récolte des retours plus riches et plus fréquents que l’écrit — parce
qu’écrire un bug coûte cinq minutes et de la mise en forme, alors que le dire en coûte quarante
secondes et zéro effort. Voir [00-Projet/VISION.md].

## HOW — règles de travail

### Commandes

```bash
pnpm dev              # serveur + widget en watch
pnpm typecheck        # OBLIGATOIRE avant de déclarer une tâche finie
pnpm lint             # ESLint, dont la règle de frontière AGPL/MIT
pnpm test             # tests unitaires (vitest) — purs, sans base, hors ligne
pnpm test:integration # tests contre un vrai Postgres
pnpm e2e              # parcours Playwright
pnpm build            # construit le serveur ET le widget
pnpm db:migrate       # applique les migrations SQL en attente
pnpm db:generate      # régénère le client Prisma après édition du schema

pnpm widget:demo      # page de démonstration : le widget dans une fausse app hôte,
                      # sur un autre port. C’est LÀ qu’on recette le widget, jamais
                      # dans le back-office — voir §Le widget ne se recette pas chez lui
pnpm produit:creer -- --nom "VictorIA" --domaine victoria.example
                      # crée un produit et imprime sa clé publique + son secret UNE fois
pnpm entretien:rejouer -- --retour <id>
                      # rejoue la boucle d’entretien sur un retour existant, sans widget.
                      # C’est l’outil de mise au point du prompt : on change le prompt,
                      # on rejoue sur dix vrais retours, on compare.
```

### ⚠️ Le widget ne se recette pas chez lui

Le widget vit dans un **shadow DOM, injecté dans la page d’autrui**. Trois classes de défauts
n’existent que là et sont invisibles quand on le teste dans le back-office :

- les styles de l’hôte qui fuient dedans (ou l’inverse) ;
- le `z-index`, les `position: fixed` et les modales de l’hôte qui passent par-dessus ;
- les collisions de globales, et la taille du bundle chargé chez quelqu’un d’autre.

**D’où `pnpm widget:demo`**, qui sert une fausse application hôte volontairement hostile — CSS
agressif, `!important`, reset global, une modale à `z-index: 9999`. Un widget qui survit à cette
page survit en production.

### La parole d’abord, mais jamais la parole seulement

⛔ **Aucun écran ne doit exiger de parler.** Le micro est le geste **proposé**, jamais imposé :
il y a toujours un champ texte, atteignable au clavier, au même niveau de visibilité. Quelqu’un
en open space, quelqu’un d’enroué, quelqu’un qui préfère écrire — trois cas ordinaires, pas des
cas limites.

⚠️ **Web Speech API impose Chrome ou Edge, et c’est un choix assumé** (D-003). Firefox ne
l’implémente pas et le chantier est fermé chez Mozilla ; Safari est capricieux. Sur un navigateur
sans dictée, le widget **ne se casse pas et ne s’excuse pas** : il présente le champ texte, sans
mentionner ce qui manque.

⛔ **L’API d’ingestion accepte un transcript OU un fichier audio, depuis le premier jour.** Le
serveur ne doit jamais supposer que la transcription s’est faite chez le client. Ça ne coûte rien
maintenant, et ça ouvre Whisper le jour où Chrome n’est plus tenable — sans réécrire ni migrer.

### Le bot : ce qu’il a le droit de faire, et surtout pas

Le comportement complet est spécifié dans [01-Specs/entretien.md]. Les cinq règles qui ne se
discutent pas :

1. ⛔ **Ne jamais demander ce que le contexte technique donne déjà** — l’URL, l’écran, le
   navigateur, la taille de fenêtre, l’heure, l’identité. Les redemander transforme la
   conversation en formulaire déguisé, et c’est exactement ce que Feedys existe pour éviter.
2. ⛔ **Deux relances au maximum.** Passé ce seuil, on envoie ce qu’on a, en déclarant ce qui
   manque. Un entretien qui s’éternise ne sera plus jamais ouvert.
3. ⛔ **Une question à la fois, deux phrases au maximum.** Pas de liste à puces, pas de « pourrais-tu
   préciser a), b) et c) ».
4. ⛔ **Ne rien promettre, ne rien diagnostiquer.** Ni « c’est un bug connu », ni « on va le
   corriger », ni « avez-vous essayé de… ». Le bot n’a aucune idée de ce qui sera fait.
5. ✅ **« Envoyer maintenant » est visible en permanence**, dès le premier mot. On ne retient
   personne.

### Les mots du produit

⛔ **Un mot est interdit : « ticket ».** On dit **un retour**. « Ticket » appelle un guichet, une
file d’attente et un numéro — trois choses que Feedys n’a pas. La règle porte sur les libellés,
les messages, la documentation, et **les noms de variables, de types et de tables**.

Le vocabulaire complet est dans [02-Metier/glossaire.md] : **retour**, **entretien**,
**synthèse**, **produit**, **contexte**, **auteur**. Les tables et les types suivent ces mots.

### Architecture — frontières non négociables

- `packages/widget` **n’importe rien** de `apps/serveur`. Jamais. Voir §frontière de licence.
- `apps/serveur/app/` ne contient **que** du routage et de la composition. La logique vit dans
  `apps/serveur/domaine/`, **pure et testable sans base de données**.
- L’appel au modèle est derrière **une seule interface**, `domaine/entretien/modele.ts`. Aucun
  appel direct à un fournisseur ailleurs — c’est ce qui rend l’entretien testable avec un bouchon,
  et remplaçable sans chirurgie.
- Détail : [04-Architecture/architecture.md]

### Base de données

Référence : [04-Architecture/conventions-db.md]. Invariants :

- **Avant toute modification de schéma** : lire la structure réelle, lister les tables et colonnes
  impactées, proposer la migration, puis seulement écrire.
- `db/migrations/*.sql` est la **source de vérité**. SQL brut, idempotent, transactionnel, ordonné
  par nom de fichier, appliqué au démarrage du conteneur. `prisma migrate` n’est jamais utilisé.
- snake_case en base, `@map`/`@@map` Prisma. Socle de toute table : `id` (cuid), `cree_le`,
  `maj_le`.
- ⛔ **Jamais de colonne `metadata` fourre-tout.** Une colonne nullable typée est gratuite. `jsonb`
  est réservé au réellement non structuré : la synthèse du modèle, le contexte navigateur brut.
- ⛔ **Jamais `ON DELETE CASCADE`** sans justification écrite dans la migration.
- **Zone gelée : `audit`.** Append-only, aucun UPDATE, aucun DELETE.

### ⛔ Ce qui ne doit jamais entrer dans ce dépôt

Le dépôt est **public**. La règle est donc plus dure que d’ordinaire :

- aucun secret, aucune clé, aucun jeton — ni dans le code, ni dans la doc, ni dans un exemple ;
- **aucun nom de client, aucun domaine réel, aucune donnée de production.** Les exemples utilisent
  `exemple.fr`, `contact@exemple.fr` et des noms de produits fictifs ;
- ⚠️ **aucun retour réel en fixture de test.** Un vrai retour dicté contient des noms de personnes,
  parfois d’immeubles ou de dossiers. Les jeux d’essai sont **écrits à la main**, jamais copiés
  depuis une base qui tourne.

Les secrets du poste vivent dans `.env.local`, ignoré par git. Ne jamais demander à l’humain de
recoller un secret dans la conversation : il l’a déjà donné.

```bash
node --env-file-if-exists=.env.local -e '…'   # s’en servir sans jamais afficher la valeur
```

### Design

[04-Architecture/DESIGN.md] fait foi. Trois points qui décident du reste :

- **Le widget est neutre et rhabillable.** Il s’injecte dans quatre logiciels aux chartes
  différentes : sa palette par défaut ne ressemble à aucun d’eux, et l’hôte peut la surcharger par
  quelques propriétés CSS. ⛔ Aucune couleur en dur dans un composant — tokens uniquement.
- **Le seul écran à inventer est l’état « j’écoute »**, et son prolongement « le bot a compris
  ça ». Tout le reste est du chat, un objet déjà codifié qu’on copie de près plutôt que de
  réinventer mal. ⛔ **Ne jamais conclure « rien n’existe »** sans avoir ouvert
  [04-Architecture/references-visuelles.md] et deux de ses sources.
- **L’apostrophe s’écrit `’` (U+2019)**, jamais `'` ni `&apos;` — texte, chaînes, expressions
  régulières. Une entité HTML dans un nœud JSX mange l’espace de tête du nœud.

Libellés, erreurs et états vides **en français**. La console du navigateur est un résultat de
test : un parcours échoue sur une erreur de console.

### Dépendances

⛔ **Licences acceptées : MIT, Apache-2.0, ISC, BSD.** Rien d’autre entre en dépendance.

⛔ **`NOASSERTION` sur l’API GitHub n’est pas un verdict, c’est une consigne : lire le fichier.**
Trois projets de ce domaine ont l’air libres et ne le sont pas — Typebot (FSL, non-concurrence),
open-webui (licence maison), nlux (MPL amendée). Deux autres n’ont **aucun** fichier `LICENSE`,
ce qui vaut « tous droits réservés ».

```bash
curl -sL https://raw.githubusercontent.com/<org>/<repo>/main/LICENSE | head -5
```

La liste vérifiée de ce qu’on prend, avec dates et motifs : [04-Architecture/dependances.md].
Tout emprunt substantiel rejoint `ATTRIBUTIONS.md` **dans le même commit** — c’est la condition de
légalité de MIT, pas une politesse.

### Documentation — dans le même commit que le code

- Comportement observable modifié → `01-Specs/<sujet>.md` dans **le même commit**.
- Bug corrigé → son entrée de `03-Bugs/BUGS_LOG.md` passe à `✅ Résolu` dans le même commit.
- Décision structurante → une entrée dans `00-Projet/DECISIONS_LOG.md`.
- Ce qu’on choisit de ne pas traiter → `00-Projet/TICKETS_DIFFERES.md`, avec un déclencheur de
  reprise. Sinon ça meurt dans un commentaire de code.
- Ce qui n’a plus de valeur d’usage se **supprime**. On n’archive pas « au cas où ».

### Git

**Une PR par prompt**, une branche par prompt, mergée avant d’ouvrir la suivante. Documentation
seule → commit direct sur `main`. Code → PR.

Les six checks tournent **en local d’abord**, intégralement :

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm test:integration && pnpm e2e && docker build .
```

Un check en échec se **corrige**. Jamais de `--no-verify`, jamais de merge en force.

### Avant de déclarer une tâche finie

`pnpm typecheck` et les tests concernés doivent avoir **réellement tourné** et être verts. Coller
la sortie. Pas d’affirmation de succès sans preuve.

## Points d’entrée documentaires

| Besoin | Fichier |
|---|---|
| Pourquoi ce produit existe, et ce qu’il n’est pas | [00-Projet/VISION.md] |
| Ce qui est fait, en cours, à venir | [00-Projet/ROADMAP.md] |
| Pourquoi telle décision technique | [00-Projet/DECISIONS_LOG.md] |
| **La séquence de prompts jusqu’au MVP** | [05-Prompts/MVP.md] |
| Le comportement du bot — la pièce maîtresse | [01-Specs/entretien.md] |
| Le comportement du widget | [01-Specs/widget.md] |
| Comment un retour entre — l’API, ses refus, son invariant | [01-Specs/ingestion.md] |
| Ce que contient la note, et comment elle arrive | [01-Specs/synthese.md] |
| Vocabulaire | [02-Metier/glossaire.md] |
| Frontières, flux, modules | [04-Architecture/architecture.md] |
| **La frontière AGPL / MIT** | [04-Architecture/licences.md] |
| Direction artistique, tokens, l’état « j’écoute » | [04-Architecture/DESIGN.md] |
| **Quoi décalquer, où chercher, et les défauts à refuser** | [04-Architecture/references-visuelles.md] |
| Ce qu’on prend et pourquoi | [04-Architecture/dependances.md] |
| Conventions et garde-fous DB | [04-Architecture/conventions-db.md] |
| Conteneur, déploiement, exploitation | [04-Architecture/hebergement.md] |

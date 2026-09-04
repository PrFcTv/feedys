# Attributions

Feedys s’appuie sur du travail publié par d’autres. Cette page est une **obligation de licence**,
pas une politesse : les licences MIT, BSD et Apache exigent que l’avis de copyright soit conservé
et distribué avec le logiciel.

⚠️ **Tout emprunt substantiel rejoint cette page dans le même commit que le code.**

## Code emprunté

> Rempli au fur et à mesure. Un emprunt qui n’est pas ici est un manquement, pas un oubli.

| Ce qu’on a pris | Source | Licence | Où c’est |
|---|---|---|---|
| L’**échelle de stratégies de sélecteur** — `data-testid` → id → `name` → `placeholder` → `aria-label` → classes stables → chemin `nth-of-type`, chacune retenue seulement si elle désigne un élément et un seul ; et les deux tests « cette classe est-elle fabriquée par l’outillage ? » et « cet id vient-il de `useId` ? » | [`@fasterfixes/core`](https://github.com/manucoffin/faster-fixes) 0.0.7 | MIT · © 2026 FasterFixes | `packages/widget/src/contexte/selecteur.ts` |
| L’**ordre des tests de la chaîne d’agent** — Firefox, puis Edge, puis Opera, puis Chrome, puis Safari, chacun disqualifiant les suivants | idem | MIT | `packages/widget/src/contexte/navigateur.ts` |
| La **liste des paramètres d’URL sensibles** à expurger | idem | MIT | `packages/widget/src/contexte/url.ts` |
| L’assistant **`cn`** — `clsx` puis `twMerge`, dans cet ordre — et la forme des variantes `cva` du bouton | [shadcn/ui](https://github.com/shadcn-ui/ui) | MIT · © 2023 shadcn | `apps/serveur/ui/cn.ts`, `apps/serveur/ui/bouton.tsx` |
| Le **découpage en parties du select** — `Root` / `Trigger` / `Value` / `Positioner` / `Popup` / `Item` / `ItemIndicator` —, **variante Base UI** | idem | MIT | `apps/serveur/ui/select.tsx` |

⚠️ **Vérifié à la source le 2026-09-04** : le dépôt `faster-fixes` est AGPL-3.0 à sa racine, mais
les paquets publiés `@fasterfixes/core` et `@fasterfixes/react` portent chacun leur propre fichier
`LICENSE` MIT et un champ `"license": "MIT"`. C’est l’artefact publié qui a été lu, pas le dépôt.

⛔ **Ce qui a été délibérément REFUSÉ du même code**, parce que hors de la liste close de
[01-Specs/widget.md](01-Specs/widget.md) :

- `nearbyText` — le texte autour de l’élément visé. Du contenu de la page de l’hôte.
- `getReactComponentPath` et `getSourceFile` — la fibre React lue au travers du DOM.
- `createDiagnosticsRecorder` — l’instrumentation de `console`, `fetch` et `XMLHttpRequest`.
- `STORAGE_KEY_TOKEN` — un identifiant de visiteur écrit en `localStorage`.

Ce refus est le vrai contenu de cet emprunt : on a pris la mécanique, pas le périmètre.

## Idées et structures reprises

Reprendre une idée n’oblige à rien légalement. On le note quand même : c’est ce qui permet, six
mois plus tard, de savoir où aller voir quand on bute sur le même problème.

| Idée | Source | Licence de la source |
|---|---|---|
| Le **découpage provisoire / définitif** d’un transcript Web Speech, et le recollage des segments successifs — Chrome coupe `SpeechRecognition` tout seul, et il faut relancer sans perdre ce qui précède | [`speech-to-element`](https://github.com/OvidijusParsiunas/speech-to-element), pris en dépendance | MIT |
| **La découpe de licence** — racine AGPL, paquets widget et MCP en MIT | [FasterFixes](https://github.com/manucoffin/faster-fixes) | AGPL-3.0 + MIT |
| La forme de la collecte de contexte — sélecteur DOM, navigateur, capture à l’ouverture. ⛔ Le périmètre, lui, n’est pas repris : voir §Code emprunté | [`@fasterfixes/react`](https://github.com/manucoffin/faster-fixes) | MIT |
| La forme des outils MCP et le modèle produit + clé d’API | [Quackback](https://github.com/QuackbackIO/quackback) | AGPL-3.0 |
| Le geste de la note vocale — maintenir, relâcher, glisser pour annuler, et le clic simple qui passe en mains libres | WhatsApp, Telegram | — |

⚠️ **Le cas Quackback est particulier.** Sa licence AGPL est compatible avec `apps/serveur`, qui
est AGPL — on peut donc y **recopier du code**, à condition de citer le dépôt d’origine dans le
fichier concerné. ⛔ En revanche, **rien de Quackback ne peut entrer dans `packages/mcp`**, qui est
MIT : là-bas on ne reprend que la forme des outils et le nommage. Une API n’est pas du code.
Voir [04-Architecture/licences.md](04-Architecture/licences.md).

## Dépendances

Les bibliothèques installées portent leur propre licence dans `node_modules`, et sont listées avec
leur motif dans [04-Architecture/dependances.md](04-Architecture/dependances.md). Les principales :

| Paquet | Licence | Auteur |
|---|---|---|
| `preact` | MIT | Jason Miller et contributeurs |
| `speech-to-element` | MIT | Ovidijus Parsiunas |
| `@zumer/snapdom` | MIT | Zumerlab |
| `@floating-ui/dom` | MIT | Floating UI contributors |
| `ai` (AI SDK) | Apache-2.0 | Vercel, Inc. |
| `next` | MIT | Vercel, Inc. |
| `@prisma/client` | Apache-2.0 | Prisma Data, Inc. |
| `shadcn` (composants copiés) | MIT | shadcn |
| `@modelcontextprotocol/sdk` | MIT | Anthropic |
| `nodemailer` | MIT-0 | Andris Reinman |
| `@base-ui/react` | MIT | Material-UI SAS |
| `tailwindcss` | MIT | Tailwind Labs, Inc. |
| `class-variance-authority` | Apache-2.0 | Joe Bell |
| `clsx`, `tailwind-merge` | MIT | Luke Edwards, Dany Castillo |
| `lucide-react` | ISC | Lucide contributors |
| `@playwright/test` | Apache-2.0 | Microsoft Corporation |

⛔ **`@ricky0123/vad` a été retiré de cette liste le 2026-09-04, sans avoir jamais été installé** :
sa chaîne minimale pèse 5,3 Mo gzip, et le moment de son chargement serait le pire possible. Le
motif complet est dans [D-012](00-Projet/DECISIONS_LOG.md). ⚠️ Rien de son code n’a été lu ni
repris — il n’y a donc rien à attribuer, et c’est précisément pour qu’on n’aille pas le chercher
que la ligne est écrite ici.

# Attributions

Feedys s’appuie sur du travail publié par d’autres. Cette page est une **obligation de licence**,
pas une politesse : les licences MIT, BSD et Apache exigent que l’avis de copyright soit conservé
et distribué avec le logiciel.

⚠️ **Tout emprunt substantiel rejoint cette page dans le même commit que le code.**

## Code emprunté

> Rempli au fur et à mesure. Un emprunt qui n’est pas ici est un manquement, pas un oubli.

| Ce qu’on a pris | Source | Licence | Où c’est |
|---|---|---|---|
| — | — | — | — |

## Idées et structures reprises

Reprendre une idée n’oblige à rien légalement. On le note quand même : c’est ce qui permet, six
mois plus tard, de savoir où aller voir quand on bute sur le même problème.

| Idée | Source | Licence de la source |
|---|---|---|
| **La découpe de licence** — racine AGPL, paquets widget et MCP en MIT | [FasterFixes](https://github.com/manucoffin/faster-fixes) | AGPL-3.0 + MIT |
| La forme de la collecte de contexte — sélecteur DOM, arbre de composants, navigateur | [`@fasterfixes/react`](https://github.com/manucoffin/faster-fixes) | MIT |
| La forme des outils MCP et le modèle produit + clé d’API | [Quackback](https://github.com/QuackbackIO/quackback) | AGPL-3.0 |
| Le geste de la note vocale — maintenir, relâcher, glisser pour annuler | WhatsApp, Telegram | — |

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
| `@ricky0123/vad` | ISC | ricky0123 |
| `snapdom` | MIT | Zumerlab |
| `@floating-ui/dom` | MIT | Floating UI contributors |
| `ai` (AI SDK) | Apache-2.0 | Vercel, Inc. |
| `next` | MIT | Vercel, Inc. |
| `@prisma/client` | Apache-2.0 | Prisma Data, Inc. |
| `shadcn` (composants copiés) | MIT | shadcn |
| `@modelcontextprotocol/sdk` | MIT | Anthropic |
| `nodemailer` | MIT | Andris Reinman |

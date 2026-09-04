# Dépendances

## La règle

⛔ **Licences acceptées en dépendance : MIT, Apache-2.0, ISC, BSD.** Rien d’autre.

⛔ **`NOASSERTION` sur l’API GitHub n’est pas un verdict, c’est une consigne : lire le fichier.**

```bash
curl -sL https://raw.githubusercontent.com/<org>/<repo>/main/LICENSE | head -5
```

Avant d’installer, trois questions, et on présente les réponses avant de coder :
**qu’est-ce qui existe · sous quelle licence · ce que ça imposerait au projet.**

⚠️ Une contrainte propre au widget : **60 Ko gzip pour `widget.js`**. Une dépendance qui pèse 20 Ko
pour rendre un service de confort est refusée, même impeccable par ailleurs.

## Ce qu’on prend — relevé du 2026-09-04

Étoiles, licences et dates vérifiées à la source le même jour.

### Le widget · MIT uniquement

| Paquet | Licence | ★ | Rôle | Pourquoi lui |
|---|---|---|---|---|
| `preact` | MIT | 38 850 | socle | 3 Ko contre 130 Ko pour React. C’est ce chiffre qui a décidé [D-004] |
| `speech-to-element` | MIT | 21 | dictée | l’enrobage Web Speech extrait de `deep-chat`, du même auteur, éprouvé. On prend le moteur sans le composant |
| `@ricky0123/vad` | ISC | 2 046 | arrêt sur silence | détection d’activité vocale (Silero, WASM). C’est lui qui permet le mode mains libres |
| `snapdom` | MIT | 8 066 | capture | rapide et moderne. ⛔ **Pas `html2canvas`** : 31 921 ★ et plus un commit depuis juillet 2024 |
| `@floating-ui/dom` | MIT | 32 719 | positionnement | la version `dom`, pas `react` — on n’embarque pas React |

⚠️ **`@fasterfixes/react` n’est pas pris en dépendance** malgré sa qualité : il tire React. On
**lit** sa collecte de contexte, on la réimplémente en une centaine de lignes pour Preact. C’est
un emprunt d’idée, à citer dans `ATTRIBUTIONS.md`.

### Le serveur et le back-office

| Paquet | Licence | ★ | Rôle |
|---|---|---|---|
| `next` | MIT | — | serveur, API, back-office |
| `ai` (Vercel AI SDK) | Apache-2.0 | 26 570 | `generateObject` — la synthèse **typée**, pas du texte à reparser |
| `@ai-sdk/anthropic` | Apache-2.0 | — | Claude |
| `zod` | MIT | — | schémas — partagés entre validation d’API et `generateObject`. ⚠️ Déclaré par `packages/widget`, qui porte le contrat de transport ; le serveur l’atteint en important `contrat.ts`. ⛔ Il n’entre pas dans `widget.js` : le widget n’importe le contrat qu’en `import type` |
| `@prisma/client` | Apache-2.0 | — | accès base |
| `shadcn` (copié) | MIT | 122 975 | composants de chat de juin 2026, **variante Base UI** |
| `nodemailer` | MIT | — | envoi de la note |
| `@modelcontextprotocol/sdk` | MIT | — | serveur MCP |
| `hash-wasm` | MIT | 1 100 | argon2id du secret produit, **en WebAssembly** — pas d’extension native à construire dans une image Alpine ([D-010](../00-Projet/DECISIONS_LOG.md)) |
| `@paralleldrive/cuid2` | MIT | 1 500 | les `id` de toutes les tables. `cuid()` de Prisma n’est pas utilisable : le schéma ne pose aucun `@default` |

### Outillage

`typescript` · `vite` · `vitest` · `@playwright/test` · `eslint` · `turbo` · `tsx` — tous MIT ou
Apache-2.0.

## Ce qu’on prendra après le MVP

Retenus, vérifiés, **volontairement hors MVP** ([ROADMAP.md](../00-Projet/ROADMAP.md)). Ils sont
listés ici pour qu’on n’ait pas à refaire la recherche, et pour que rien dans l’architecture ne
les rende impossibles.

| Paquet | Licence | ★ | Ce qu’il apporte | Quand |
|---|---|---|---|---|
| `rrweb` | MIT | 20 111 | rejeu de session : garder les 30 dernières secondes en tampon et les joindre au retour. **Voir** le bug au lieu de le reconstituer | ROADMAP ② |
| `wavesurfer.js` | BSD-3 | 10 396 | forme d’onde + lecture, dans le back-office. Le transcript efface le ton ; l’audio le garde | ROADMAP ③ |

⚠️ **Conséquence sur le MVP, à ne pas oublier** : `contextes` doit pouvoir accueillir un chemin de
rejeu, et `messages` porte déjà `audio_chemin` ([conventions-db.md](conventions-db.md)). Les deux
colonnes existent dès `0001_socle.sql` — c’est gratuit maintenant, c’est une migration plus tard.

## Ce qu’on a écarté, et pourquoi

Écrit ici pour qu’on ne le repropose pas dans six mois.

| Projet | Motif |
|---|---|
| **`typebot.io`** | ⛔ **FSL-1.1-Apache-2.0** — source-available, non-concurrence, **non relicenciable**. Utilisable en interne, impossible dans un dépôt public libre |
| **`open-webui`** | ⛔ licence maison « All rights reserved ». 150 866 ★ n’y changent rien |
| **`nlux`** | ⛔ MPL-2.0 **amendée** (restriction entraînement IA). Une MPL modifiée n’est plus la MPL. Dormant depuis 10 mois |
| **`logchimp`, `feedbackbin`** | ⛔ **aucun fichier `LICENSE`** = tous droits réservés |
| `deep-chat` | Excellent, MIT — mais il impose son geste vocal sur le seul écran qui fait le produit. Voir [D-002]. On lui prend `speech-to-element` |
| `html2canvas` | Mort depuis juillet 2024 |
| `use-whisper` | Mort depuis avril 2024 |
| `chat-ui-kit-react` | Dormant depuis mai 2025, esthétique datée |
| `CopilotKit`, `chainlit` | Hors sujet — un framework de copilote, et du Python |
| `fider` | Board de vote en Go. Le plus mature du domaine, le plus loin du besoin |
| `chatwoot` | MIT sauf `enterprise/`. Le bon objet — widget, fil, boîte de réception — mais en Rails, et démesuré pour dix personnes |
| `formbricks` | Mixte AGPL + module EE. Seul son ciblage in-app valait le détour ; on n’en a pas besoin à une bulle par produit |
| **`react-speech-recognition`** | MIT, correct — mais **il tire React**. ⛔ Rédhibitoire dans un widget Preact. `speech-to-element` fait le même travail sans socle |
| **`react-voice-visualizer`** | Idem : React. L’onde est calculée depuis l’`AnalyserNode`, c’est une cinquantaine de lignes ([DESIGN.md](DESIGN.md)) |
| **`html-to-image`** | Même métier que `snapdom`, plus installé, plus lent. Un seul suffit |
| `assistant-ui` | MIT, excellent — mais React. **Candidat pour le back-office**, jamais pour le widget |
| `prompt-kit`, `lobe-ui` | MIT. Recouvrent les composants de chat de `shadcn`, qu’on a déjà. ⛔ Une seule famille de composants |

⚠️ **Quatre de ces refus tiennent au même motif : le paquet tire React.** C’est la conséquence
directe du budget de 60 Ko et de [D-004]. Dans `packages/widget`, la question « est-ce que ça tire
React ? » se pose **avant** la question de la licence.

## Ce qu’on copie plutôt qu’on installe

| Source | Licence | Ce qu’on prend | Où |
|---|---|---|---|
| [Quackback](https://github.com/QuackbackIO/quackback) | **AGPL-3.0** | le serveur MCP, le modèle produit + clé d’API | ⚠️ `apps/serveur/` **uniquement** — voir [licences.md] |
| [FasterFixes](https://github.com/manucoffin/faster-fixes) | AGPL + MIT | la **découpe de licence**, et l’idée de la collecte de contexte | structure du dépôt, `packages/widget` |
| [shadcn](https://ui.shadcn.com) | MIT | composants de chat, variante Base UI | `apps/serveur/ui/` |
| [`makerkit/react-embeddable-widget`](https://github.com/makerkit/react-embeddable-widget) | MIT | le **patron** d’isolation shadow DOM + Vite. À lire, pas à installer | `packages/widget/src/montage.ts` |
| [`vercel/chatbot`](https://github.com/vercel/chatbot) | Apache-2.0 | référence d’architecture pour le streaming et l’AI SDK. À lire, jamais à forker | `apps/serveur/domaine/entretien/` |

⛔ **Rien de Quackback (AGPL) ne peut entrer dans `packages/mcp` (MIT)**, malgré le sujet commun.
Là-bas on ne prend que **les idées** : la forme des outils, le nommage. Une API n’est pas du code.

Tout emprunt substantiel rejoint `ATTRIBUTIONS.md` **dans le même commit**. C’est la condition de
légalité de MIT, pas une politesse.

## Ce qui reste interdit, sans exception

- Service hébergé payant comme socle — Supabase, Vercel KV, Auth0, Clerk, Firebase.
- Licence propriétaire, commerciale, ou **source-available** (FSL, BUSL, SSPL, Elastic).
- **Dépôt sans fichier `LICENSE`** — pas de licence ≠ open source, c’est « tous droits réservés ».
- Une seconde famille de composants à côté de celle retenue.
- Toute dépendance qui tire React dans `packages/widget`.

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
| `zod` | MIT | — | schémas — partagés entre validation d’API et `generateObject` |
| `@prisma/client` | Apache-2.0 | — | accès base |
| `shadcn` (copié) | MIT | 122 975 | composants de chat de juin 2026, **variante Base UI** |
| `nodemailer` | MIT | — | envoi de la note |
| `@modelcontextprotocol/sdk` | MIT | — | serveur MCP |

### Outillage

`typescript` · `vite` · `vitest` · `@playwright/test` · `eslint` · `turbo` · `tsx` — tous MIT ou
Apache-2.0.

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
| `chat-ui-kit-react` | Dormant, esthétique datée |
| `CopilotKit`, `chainlit` | Hors sujet — un framework de copilote, et du Python |
| `fider` | Board de vote en Go. Le plus mature du domaine, le plus loin du besoin |
| `assistant-ui` | MIT, excellent — mais React. **Candidat pour le back-office**, jamais pour le widget |

## Ce qu’on copie plutôt qu’on installe

| Source | Licence | Ce qu’on prend | Où |
|---|---|---|---|
| [Quackback](https://github.com/QuackbackIO/quackback) | **AGPL-3.0** | le serveur MCP, le modèle produit + clé d’API | ⚠️ `apps/serveur/` **uniquement** — voir [licences.md] |
| [FasterFixes](https://github.com/manucoffin/faster-fixes) | AGPL + MIT | la **découpe de licence**, et l’idée de la collecte de contexte | structure du dépôt, `packages/widget` |
| [shadcn](https://ui.shadcn.com) | MIT | composants de chat, variante Base UI | `apps/serveur/ui/` |

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

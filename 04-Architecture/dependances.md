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
| `speech-to-element` | MIT | 21 | dictée | l’enrobage Web Speech extrait de `deep-chat`, du même auteur, éprouvé. On prend le moteur sans le composant. ⚠️ **Installé le 2026-09-04, 10 Ko gzip mesurés dans le bundle.** ⛔ Aucun `element` ne lui est passé : avec un `element`, il pose des écouteurs `mousedown`, `mouseup` et `keydown` sur le document de l’HÔTE . ⛔ **Il ne relance PAS `SpeechRecognition` quand Chrome rend la main** — son `onend` remet un drapeau à zéro, vérifié dans `dist/index.js`. La relance est écrite chez nous ([BUGS_LOG](../03-Bugs/BUGS_LOG.md) 007) |
| ~~`@ricky0123/vad`~~ | ISC | 2 046 | arrêt sur silence | ⛔ **REFUSÉ à l’installation, le 2026-09-04** ([D-012](../00-Projet/DECISIONS_LOG.md)). Excellent, mais sa chaîne minimale pèse **5,3 Mo gzip** — 3,4 pour le runtime ONNX, 1,9 pour le modèle — contre 24 Ko pour le widget entier. Et le différer ne sauve rien : le téléchargement tomberait à l’instant où quelqu’un vient de cliquer pour parler. Le plancher sonore est mesuré sur l’`AnalyserNode` déjà ouvert pour l’onde |
| `@zumer/snapdom` | MIT | 8 066 | capture | rapide et moderne. ⛔ **Pas `html2canvas`** : 31 921 ★ et plus un commit depuis juillet 2024. ⚠️ Le nom est `@zumer/snapdom` — `snapdom` tout court est une bibliothèque d’état sans rapport, à 0.1.2. ⛔ **Servi, pas empaqueté** : 52 Ko gzip mesurés le 2026-09-04, contre 60 Ko de budget total ([D-011](../00-Projet/DECISIONS_LOG.md)). ⚠️ Il est donc en dépendance d’**apps/serveur**, qui le SERT sous /snapdom.js, et pas de packages/widget, qui ne fait que le charger |
| `@floating-ui/dom` | MIT | 32 719 | positionnement | la version `dom`, pas `react` — on n’embarque pas React |

⚠️ **`@fasterfixes/react` n’est pas pris en dépendance** malgré sa qualité : il tire React. On
**lit** sa collecte de contexte, on la réimplémente en une centaine de lignes pour Preact. C’est
un emprunt d’idée, à citer dans `ATTRIBUTIONS.md`.

### Le serveur et le back-office

| Paquet | Licence | ★ | Rôle |
|---|---|---|---|
| `next` | MIT | — | serveur, API, back-office |
| `ai` (Vercel AI SDK) | Apache-2.0 | 26 570 | `generateObject` — la sortie **typée**, pas du texte à reparser. ⚠️ **Installé le 2026-09-04 en 7.0.92**, dans `apps/serveur` uniquement |
| `@ai-sdk/anthropic` | Apache-2.0 | — | Claude. ⚠️ **Installé le 2026-09-04 en 4.0.49** |
| `zod` | MIT | — | schémas — partagés entre validation d’API et `generateObject`. ⚠️ Déclaré par `packages/widget`, qui porte le contrat de transport ; le serveur l’atteint en important `contrat.ts`. ⚠️ **Et déclaré aussi par `apps/serveur` depuis le 2026-09-04, à la version EXACTE de `packages/widget` (4.5.4)** : la sortie du modèle a besoin d’un schéma qui n’est pas du transport, et faire descendre ce schéma dans le paquet MIT ferait importer de la logique au serveur depuis MIT. Deux déclarations, une seule copie — pnpm dédoublonne à version identique, et deux instances de zod rendraient les types incompatibles. ⛔ Il n’entre pas dans `widget.js` : le widget n’importe le contrat qu’en `import type` |
| `@prisma/client` | Apache-2.0 | — | accès base |
| `shadcn` (copié) | MIT | 122 975 | composants de chat de juin 2026, **variante Base UI** |
| `@base-ui/react` | MIT | — | le socle des composants shadcn, **variante Base UI et non Radix** (DESIGN.md §2). ⚠️ **Installé le 2026-09-04 en 1.8.0.** ⛔ Le paquet `@base-ui-components/react` est DÉPRÉCIÉ — renommé, sa dernière version publiée est une `rc`. C’est `@base-ui/react` qu’on prend |
| `tailwindcss` + `@tailwindcss/postcss` | MIT | — | le style du back-office. ⚠️ **v4 : plus de fichier de configuration**, le thème est déclaré en CSS (`app/global.css`, `@theme`). ⛔ Rien à voir avec le widget, qui est en CSS-en-JS dans son shadow DOM |
| `class-variance-authority` | Apache-2.0 | — | les variantes des composants shadcn |
| `clsx` + `tailwind-merge` | MIT | — | l’assistant `cn`. ⚠️ `twMerge` DÉDOUBLONNE : sans lui, une classe passée en prop ne gagne pas contre celle du composant |
| `lucide-react` | ISC | — | les icônes du back-office. ⛔ Aucune dans le widget : le budget est de 60 Ko |
| `@playwright/test` | Apache-2.0 | — | les parcours de bout en bout. ⚠️ Chromium seulement — la dictée n’existe que là (D-003) |
| `nodemailer` | **MIT-0** | — | envoi de la note. ⚠️ **Installé le 2026-09-04 en 10.0.0**, dans `apps/serveur` uniquement. ⚠️ Le registre annonce **MIT-0** et non MIT — vérifié fichier en main : c’est du MIT amputé de la clause d’attribution, donc plus permissif, pas moins. ⚠️ **Zéro dépendance transitive** et ses types sont embarqués : rien à ajouter, pas de `@types/`. Le relais tient dans `SMTP_URL` — `?pool=true` y demande le bassin de connexions |
| `@modelcontextprotocol/sdk` | MIT | — | serveur MCP. ⚠️ **Installé le 2026-09-04 en 1.30.0**, dans `packages/mcp` uniquement. ⚠️ Il tire `express`, `hono` et `jose` — inutiles au transport `stdio`, mais c’est un paquet du poste du développeur, pas du bundle de qui que ce soit |
| `hash-wasm` | MIT | 1 100 | argon2id du secret produit, **en WebAssembly** — pas d’extension native à construire dans une image Alpine ([D-010](../00-Projet/DECISIONS_LOG.md)) |
| `@paralleldrive/cuid2` | MIT | 1 500 | les `id` de toutes les tables. `cuid()` de Prisma n’est pas utilisable : le schéma ne pose aucun `@default` |

### Outillage

`typescript` · `vite` · `vitest` · `happy-dom` · `@playwright/test` · `eslint` · `turbo` · `tsx` —
tous MIT ou Apache-2.0.

⚠️ `happy-dom` (MIT) sert aux tests DOM du widget, par docbloc `// @vitest-environment happy-dom`
fichier par fichier. ⛔ L’environnement global des tests reste `node` : un test qui n’a pas besoin
d’un DOM ne doit pas en payer le montage.

## Ce qu’on prendra après le MVP

Retenus, vérifiés, **volontairement hors MVP** ([ROADMAP.md](../00-Projet/ROADMAP.md)). Ils sont
listés ici pour qu’on n’ait pas à refaire la recherche, et pour que rien dans l’architecture ne
les rende impossibles.

| Paquet | Licence | ★ | Ce qu’il apporte | Quand |
|---|---|---|---|---|
| `rrweb` | MIT | 20 111 | rejeu de session : garder les 30 dernières secondes en tampon et les joindre au retour. **Voir** le bug au lieu de le reconstituer | ROADMAP ② |
| `wavesurfer.js` | BSD-3 | 10 396 | forme d’onde + lecture, dans le back-office. Le transcript efface le ton ; l’audio le garde | ROADMAP ③ |

⚠️ **Conséquence sur le MVP** : `messages` porte déjà `audio_chemin`
([conventions-db.md](conventions-db.md)) — l’audio de ③ ne coûtera donc pas de migration.
⛔ Le chemin de rejeu de ②, lui, n’a **pas** de colonne : `contextes` s’arrête à `capture_chemin`,
vérifié le 2026-09-05 dans `0001_socle.sql`. Ce qui était annoncé « gratuit maintenant » ne l’a
pas été : P-021 devra porter sa propre migration.

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

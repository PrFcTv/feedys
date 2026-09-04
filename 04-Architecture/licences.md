# La frontière de licence

> C’est l’invariant le plus fragile du projet : il ne casse jamais bruyamment. Rien n’avertit,
> aucun test ne rougit, et on peut vivre des mois du mauvais côté sans le savoir.

## La découpe

| Chemin | Licence | Pourquoi |
|---|---|---|
| racine, `apps/serveur/` | **AGPL-3.0** | c’est le travail, et il est protégé |
| `packages/widget/` | **MIT** | il s’exécute dans la page de logiciels qui ne sont pas libres |
| `packages/mcp/` | **MIT** | il s’installe dans l’éditeur de tiers |

Chaque paquet MIT porte **son propre fichier `LICENSE`**. Un `LICENSE` à la racine ne suffit pas :
c’est le fichier le plus proche qui fait foi pour un lecteur, et pour npm.

## Le mécanisme, en trois phrases

La GPL se déclenche à la **distribution**. L’**AGPL** ajoute l’article 13 : si on modifie le
logiciel et que des gens s’en servent **à travers le réseau**, on leur doit la source — même sans
rien leur avoir livré.

Toute la question est donc : **qu’est-ce qui forme « un seul programme » ?**

- Deux processus qui dialoguent en HTTP → **deux programmes**. Aucune contamination.
- Du code empaqueté dans le même bundle → **un seul programme**. Contamination.

## ⛔ La fuite, et elle est unique

Le conteneur séparé ne suffit **pas** à protéger le logiciel hôte. Il reste un chemin par lequel
du code Feedys entre dans le programme de l’hôte : **son bundler.**

```
✅  <script src="https://feedys.exemple.fr/widget.js">
       le navigateur charge deux programmes distincts.
       Le logiciel hôte n’est pas affecté.

⛔  pnpm add @feedys/widget   puis   import { Feedys } from '@feedys/widget'
       Next.js empaquette le widget DANS le bundle de l’hôte.
       Un seul programme. Le logiciel hôte devient une œuvre dérivée.
```

**C’est pour ça que `packages/widget` est MIT** — pour que même cette erreur ne soit pas fatale.
Et c’est pour ça que **la seule intégration supportée est `<script src>`** : la licence MIT est un
filet, pas une autorisation à s’en passer.

⛔ **`packages/widget` ne publie pas de paquet npm destiné à l’hôte.** Il produit un fichier servi
par le serveur.

## ⛔ La règle de sens unique

**Rien de `apps/serveur` (AGPL) ne remonte dans `packages/widget` (MIT).** Pas un type, pas une
constante, pas une fonction utilitaire, pas un fichier de traduction.

Recopier trois lignes d’AGPL dans un paquet MIT **rend ce paquet AGPL**, et personne ne le
remarquera avant que quelqu’un l’intègre quelque part.

Le contrat partagé entre les deux — formes de requêtes et de réponses — vit dans
**`packages/widget/src/contrat.ts`**, côté MIT. C’est `apps/serveur` qui l’importe.

```ts
// eslint.config.mjs
{
  files: ['packages/widget/**', 'packages/mcp/**'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [{
        group: ['**/apps/serveur/**', '@feedys/serveur*'],
        message:
          'Frontière de licence : un paquet MIT ne peut pas importer de code AGPL. ' +
          'Voir 04-Architecture/licences.md.',
      }],
    }],
  },
}
```

⚠️ **Le message d’erreur cite le document.** Une règle de lint sans explication se contourne par
un `eslint-disable` au premier vendredi soir.

## Ce que l’AGPL nous oblige à faire, concrètement

Peu de choses, et elles sont toutes déjà vraies :

1. **Publier la source** — le dépôt est public. Fait.
2. **Offrir la source aux utilisateurs du service en réseau.** Le back-office affiche en pied de
   page un lien vers le dépôt et la version déployée. ⚠️ **À faire dès le premier écran**, pas
   « quand on aura le temps » : c’est l’obligation de l’article 13, et c’est deux lignes.
3. **Conserver les avis de copyright** des emprunts.
4. **Ne pas relicencier** ce qu’on a reçu.

## Les emprunts, et ce qu’ils imposent

| Ce qu’on prend | Licence | Obligation |
|---|---|---|
| `speech-to-element`, `snapdom`, `preact`, `assistant-ui`, shadcn | MIT | garder l’avis, citer dans `ATTRIBUTIONS.md` |
| Vercel AI SDK | Apache-2.0 | garder l’avis et le `NOTICE` s’il existe |
| `@ricky0123/vad` | ISC | garder l’avis |
| `wavesurfer.js` | BSD-3 | garder l’avis, ne pas se réclamer de l’auteur |
| **Quackback** — serveur MCP, modèle multi-produits | **AGPL-3.0** | ✅ compatible : Feedys est AGPL. Citer le dépôt d’origine dans le fichier concerné **et** dans `ATTRIBUTIONS.md` |

⚠️ **Le cas Quackback est le seul où l’on recopie du code AGPL**, et il n’est légal que dans
`apps/serveur/`. ⛔ Rien de Quackback ne peut entrer dans `packages/mcp` malgré le sujet commun —
c’est un paquet MIT. Ce qu’on en prend là-bas, ce sont **les idées** : la forme des outils, le
nommage. Une API n’est pas du code.

## Le réflexe à garder

⛔ **`NOASSERTION` sur l’API GitHub n’est pas un verdict, c’est une consigne : lire le fichier.**

```bash
curl -sL https://raw.githubusercontent.com/<org>/<repo>/main/LICENSE | head -5
```

Quatre projets de ce domaine ont l’air libres et ne le sont pas :

| Projet | Réalité | Ce que ça interdit |
|---|---|---|
| `typebot.io` | **FSL-1.1-Apache-2.0** | non-concurrence, non relicenciable. Utilisable en interne, pas forkable en public |
| `open-webui` | licence maison, « All rights reserved » | tout, ou presque |
| `nlux` | **MPL-2.0 amendée** (restriction entraînement IA) | une MPL modifiée n’est plus la MPL |
| `logchimp`, `feedbackbin` | **aucun fichier `LICENSE`** | tous droits réservés — le code est visible, les droits sont nuls |

Le trio des familles, pour trancher vite :

| Famille | Exemples | Ce qu’on peut faire | Ce qu’on doit |
|---|---|---|---|
| **Permissive** | MIT, Apache-2.0, ISC, BSD | tout, y compris fermer | garder l’avis |
| **Copyleft** | GPL, AGPL, LGPL, MPL | tout, y compris vendre | rendre la source |
| **Source-available** | FSL, BUSL, SSPL, Elastic | lire, souvent utiliser en interne | ne pas concurrencer, **ne jamais relicencier** |

Les deux premières sont open source. La troisième ne l’est pas : c’est du code **visible**, pas du
code **libre**.

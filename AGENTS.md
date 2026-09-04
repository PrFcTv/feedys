# Pour un agent qui arrive sur ce dépôt

**[CLAUDE.md](CLAUDE.md) est la source de vérité.** Ce fichier est un panneau, pas une copie : en
cas de divergence, c’est CLAUDE.md qui fait foi.

Lis-le. Ce qui suit, ce sont les lignes rouges dont l’ignorance coûte le plus cher.

## En une phrase

Feedys est un **widget de remontée d’information dont le geste central est la parole**, embarqué
dans des logiciels métier. Ce n’est **pas** un board de vote, **pas** un système de tickets,
**pas** un outil de support.

## ⛔ Les huit lignes rouges

1. **La frontière de licence.** Racine et `apps/serveur` en **AGPL-3.0** ; `packages/widget` et
   `packages/mcp` en **MIT**. ⛔ Rien d’AGPL ne remonte dans un paquet MIT — pas un type, pas une
   constante. Le sens de la dépendance est inversé : c’est le serveur qui importe
   `packages/widget/src/contrat.ts`. Vérifié par ESLint.
   → [04-Architecture/licences.md](04-Architecture/licences.md)

2. **Le widget s’intègre par `<script src>`, jamais en dépendance npm.** Empaqueté par le bundler
   de l’hôte, il rendrait l’application hôte dérivée. C’est la seule fuite possible de la
   frontière ci-dessus, et elle ne fait aucun bruit.

3. **Le mot « ticket » est interdit.** On dit **un retour**. La règle porte aussi sur les noms de
   tables, de types et de variables. → [02-Metier/glossaire.md](02-Metier/glossaire.md)

4. **Le bot ne demande jamais ce que le contexte donne déjà** — page, écran, navigateur, identité.
   C’est la règle la plus importante du produit : la violer transforme la conversation en
   formulaire déguisé, et détruit la seule chose que Feedys apporte.
   → [01-Specs/entretien.md](01-Specs/entretien.md)

5. **Deux relances au maximum**, appliquées **côté serveur**. Ensuite on envoie ce qu’on a, en
   déclarant ce qui manque.

6. **Le retour est persisté AVANT tout appel au modèle.** Aucune défaillance en aval ne peut
   perdre la parole de quelqu’un. C’est l’invariant du système.

7. **La parole ne se réécrit pas.** Le texte d’un `message` n’est jamais modifié ni supprimé,
   par personne, par aucun chemin. Les citations de la synthèse sont **verbatim strict**. Ce qui
   se corrige, ce sont les étiquettes — `type`, `zone`. Et `audit` est en zone gelée.

8. **Le dépôt est public.** ⛔ Aucun secret, aucun nom de client, aucun domaine réel, aucune donnée
   de production, **aucun retour réel en fixture**. Les exemples utilisent `exemple.fr`.

## Si tu n’as pas les outils que CLAUDE.md suppose

| Outil manquant | Ce que tu fais à la place |
|---|---|
| Accès à la base | Ne devine pas le schéma. Lis `db/migrations/` — c’est la source de vérité, pas `schema.prisma`, qui n’en est que le miroir. |
| `shadcn` / registre de composants | ⛔ N’écris pas un composant à la main sans le signaler. Dis ce que tu aurais cherché, et demande. |
| Un navigateur pour vérifier | Dis explicitement que le rendu n’a pas été vérifié. ⛔ N’affirme jamais qu’un écran fonctionne sans l’avoir vu. |

## Le réflexe licence

Avant d’ajouter une dépendance :

```bash
curl -sL https://raw.githubusercontent.com/<org>/<repo>/main/LICENSE | head -5
```

⛔ `NOASSERTION` sur l’API GitHub n’est pas un verdict, c’est une consigne : **lire le fichier**.
Quatre projets de ce domaine ont l’air libres et ne le sont pas — Typebot (FSL), open-webui
(licence maison), nlux (MPL amendée), et deux dépôts sans aucun `LICENSE`.

Acceptées : **MIT, Apache-2.0, ISC, BSD.** Rien d’autre.
→ [04-Architecture/dependances.md](04-Architecture/dependances.md)

## Avant de dire qu’une tâche est finie

`pnpm typecheck` et les tests concernés doivent avoir **réellement tourné** et être verts. Coller
la sortie. ⛔ Pas d’affirmation de succès sans preuve.

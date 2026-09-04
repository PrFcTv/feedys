# Feedys

**Le retour terrain, dicté.** Un widget qu’on pose dans un logiciel métier : le collaborateur
clique, **parle**, un bot le relance deux fois pour préciser, et le développeur reçoit une note
rédigée.

> Écrire un bug coûte cinq minutes et de la mise en forme. Le dire en coûte quarante secondes.
> C’est tout le pari.

---

## Le problème

Dans un logiciel interne, les retours n’arrivent pas. Pas faute d’avoir quelque chose à dire —
mais parce que signaler coûte plus cher à celui qui parle que ça ne lui rapporte. Résultat : ne
remontent que les gros bugs, tard, et jamais les cent frictions quotidiennes qui rendent un
logiciel pénible sans qu’on sache dire pourquoi.

Les outils existants déplacent ce coût, ils ne le suppriment pas : formulaire, catégorie, titre,
capture d’écran. Feedys le supprime.

## Ce que ça donne

1. Une bulle discrète, toujours là, qui ne bloque rien et ne s’ouvre jamais toute seule.
2. On clique, on parle. La transcription s’écrit sous les yeux.
3. Le bot affiche **ce qu’il a compris**, sous forme de fiche corrigeable d’un clic, et pose au
   plus deux questions.
4. Il joint tout seul ce que personne ne pense à dire : l’écran, l’URL, le composant, le
   navigateur.
5. Le développeur reçoit **une note** — le problème, le contexte, ce qui reste incertain, et les
   mots exacts du collaborateur.
6. Son agent de code lit les retours par **MCP**, sans quitter l’éditeur.

## Ce que ce n’est pas

Ni un board de vote, ni un système de tickets, ni un outil de support. Il n’y a **aucun vote,
aucun classement, aucune file d’attente**. Feedys écoute une dizaine de personnes identifiées, pas
des milliers d’inconnus. Détail : [00-Projet/VISION.md](00-Projet/VISION.md).

---

## Statut

🚧 **En construction.** Le socle est posé — monorepo, licences, lint de frontière, CI, et la base
avec ses migrations. Le produit lui-même n’est pas encore écrit. La séquence de travail est dans
[05-Prompts/MVP.md](05-Prompts/MVP.md), et l’avancement dans
[00-Projet/ROADMAP.md](00-Projet/ROADMAP.md).

## Stack

Monorepo pnpm + Turborepo · Next.js 16 · **Preact** pour le widget (3 Ko, il s’injecte chez
autrui) · PostgreSQL + Prisma · Vercel AI SDK + Claude · Docker.

## Démarrer

```bash
pnpm install
cp .env.example .env.local        # puis renseigner les valeurs — db:migrate en a besoin
docker compose up -d postgres
pnpm db:migrate
pnpm dev
pnpm widget:demo                  # le widget dans une fausse app hôte hostile
```

## Intégrer le widget

Une ligne dans le logiciel hôte :

```html
<script src="https://feedys.exemple.fr/widget.js" data-cle="fdy_pub_…" defer></script>
```

⛔ **Il n’y a pas de paquet npm à installer, et c’est délibéré.** L’intégration passe par
`<script src>` pour que le widget reste un programme distinct de votre application — ce qui évite
que la licence de Feedys ne déborde sur la vôtre. Voir
[04-Architecture/licences.md](04-Architecture/licences.md).

## Attacher une identité

Le logiciel hôte sait déjà qui est là — autant le dire, plutôt que de poser une question de plus.
**Votre serveur** signe une petite identité avec le secret du produit, et la page la pose sur
`window.feedys` avant de charger le widget :

```html
<script>window.feedys = { identite: "<jeton signé par votre serveur>" }</script>
<script src="https://feedys.exemple.fr/widget.js" data-cle="fdy_pub_…" defer></script>
```

Signer, dans un composant serveur Next.js — `node:crypto`, rien d’autre à installer :

```tsx
import { createHmac } from 'node:crypto'

// ⛔ Le secret vit dans l’environnement de VOTRE serveur. Jamais dans la page.
function jetonFeedys(utilisateur: { id: string; nom: string; role: string }): string {
  const charge = Buffer.from(
    JSON.stringify({
      ref: utilisateur.id,
      nom: utilisateur.nom,
      role: utilisateur.role,
      exp: Math.floor(Date.now() / 1000) + 3600, // en SECONDES
    }),
  ).toString('base64url')

  const signature = createHmac('sha256', process.env.FEEDYS_SECRET!)
    .update(charge)
    .digest('base64url')

  return `${charge}.${signature}`
}
```

```tsx
export default async function Layout({ children }) {
  const jeton = jetonFeedys(await utilisateurCourant())

  return (
    <>
      {children}
      <script
        dangerouslySetInnerHTML={{ __html: `window.feedys={identite:${JSON.stringify(jeton)}}` }}
      />
      <script src="https://feedys.exemple.fr/widget.js" data-cle="fdy_pub_…" defer />
    </>
  )
}
```

⛔ **Le secret ne traverse jamais le navigateur.** Il est imprimé une seule fois par
`pnpm produit:creer` et vit sur votre serveur ; c’est le **jeton**, et lui seul, qui descend dans
la page.

⚠️ **Rien de tout ceci n’est obligatoire.** Sans jeton — ou avec un jeton expiré, forgé ou
illisible — le retour est **accepté quand même**, simplement sans auteur. On ne perd jamais une
parole pour un problème d’identité. Le détail :
[01-Specs/ingestion.md](01-Specs/ingestion.md) §L’identité signée.

---

## Licence

| Chemin | Licence |
|---|---|
| racine, `apps/serveur/` | **AGPL-3.0** |
| `packages/widget/` | **MIT** |
| `packages/mcp/` | **MIT** |

La découpe n’est pas cosmétique : le widget s’exécute dans des applications qui ne sont pas
libres, il doit donc être permissif. Le mécanisme complet est expliqué dans
[04-Architecture/licences.md](04-Architecture/licences.md).

Emprunts et attributions : [ATTRIBUTIONS.md](ATTRIBUTIONS.md).

## Documentation

| Pour | Fichier |
|---|---|
| Travailler sur le dépôt | [CLAUDE.md](CLAUDE.md) |
| Pourquoi ce produit existe | [00-Projet/VISION.md](00-Projet/VISION.md) |
| Pourquoi telle décision | [00-Projet/DECISIONS_LOG.md](00-Projet/DECISIONS_LOG.md) |
| **Construire — la séquence de prompts** | [05-Prompts/MVP.md](05-Prompts/MVP.md) |
| Le comportement du bot | [01-Specs/entretien.md](01-Specs/entretien.md) |
| Le widget | [01-Specs/widget.md](01-Specs/widget.md) |
| Comment un retour entre | [01-Specs/ingestion.md](01-Specs/ingestion.md) |
| La note produite | [01-Specs/synthese.md](01-Specs/synthese.md) |
| L’architecture | [04-Architecture/architecture.md](04-Architecture/architecture.md) |
| Ce qu’on prend sur l’étagère, et pourquoi | [04-Architecture/dependances.md](04-Architecture/dependances.md) |
| Quoi décalquer plutôt qu’inventer | [04-Architecture/references-visuelles.md](04-Architecture/references-visuelles.md) |

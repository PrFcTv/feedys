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

🚧 **En construction.** Le parcours complet tient debout — le widget, l’entretien, la synthèse,
l’email, le back-office, le MCP, l’identité signée et le conteneur. Reste la recette de bout en
bout. La séquence de travail est dans
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

**Si vous avez une politique de sécurité de contenu**, deux directives et une seule origine :

```
script-src  https://feedys.exemple.fr;
connect-src https://feedys.exemple.fr;
```

⛔ **Et rien d’autre.** Pas de `style-src 'unsafe-inline'`, pas d’`img-src`, pas d’élargissement du
`default-src` : le widget construit sa feuille de style plutôt que de la poser en `<style>`,
précisément pour n’avoir rien à vous demander. La liste **mesurée**, avec ce qui n’est pas exigé et
le supplément qu’appelle la capture d’écran :
[04-Architecture/hebergement.md](04-Architecture/hebergement.md) §La pose chez un hôte.

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

/**
 * ⚠️ UNE JOURNÉE DE TRAVAIL, PAS UNE HEURE. Dans un logiciel métier, un onglet
 *    ouvert toute la journée est la norme, pas l’exception. Avec une heure, les
 *    retours de l’après-midi arrivent SANS AUTEUR : rien n’est perdu, mais plus
 *    personne ne peut revenir vers celui qui a parlé.
 *
 * ⛔ Et le compromis, en clair : un jeton qui fuite vaut jusqu’à son expiration.
 *    Ce qu’il permet, c’est de faire passer un retour pour celui d’un collègue —
 *    il ne donne accès à rien, ni chez vous ni chez Feedys. Douze heures est le
 *    bon échange ici ; si ce n’est pas le vôtre, gardez une heure et posez une
 *    FONCTION (juste en dessous), qui rend le sujet sans objet.
 */
const UNE_JOURNEE = 12 * 60 * 60

// ⛔ Le secret vit dans l’environnement de VOTRE serveur. Jamais dans la page.
function jetonFeedys(utilisateur: { id: string; nom: string; role: string }): string {
  const charge = Buffer.from(
    JSON.stringify({
      ref: utilisateur.id,
      nom: utilisateur.nom,
      role: utilisateur.role,
      exp: Math.floor(Date.now() / 1000) + UNE_JOURNEE, // en SECONDES
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

### ⚠️ Une page qui reste ouverte longtemps : posez une **fonction**

Le widget relit l’identité **à chaque envoi**. Avec une chaîne figée, c’est à vous de reposer la
valeur chaque fois que votre jeton tourne. Avec une fonction, vous rendez celui que vous avez sous
la main, et il n’y a plus rien à synchroniser — **c’est la forme recommandée** dès qu’un onglet
peut vivre des heures, c’est-à-dire le cas ordinaire d’un logiciel métier :

```tsx
'use client'

export function IdentiteFeedys() {
  useEffect(() => {
    // ⚠️ `session` vient de votre gestion de session à vous : elle se rafraîchit
    //    quand elle veut, Feedys lira simplement la valeur du moment.
    window.feedys = { identite: () => session.jetonFeedys }
  }, [])

  return null
}
```

⛔ **La fonction doit être SYNCHRONE.** Une `async` ne marchera pas : sa promesse est traitée comme
une identité absente. C’est délibéré — le chemin d’envoi n’attend jamais votre code, parce qu’une
de vos lenteurs coûterait la parole de quelqu’un. Si votre jeton doit être rafraîchi par le réseau,
faites-le de votre côté, à votre rythme, et posez le résultat ici.

⚠️ **Elle a le droit de lever, et le droit de rendre n’importe quoi** : dans les deux cas, le
retour part **sans auteur** et l’exception ne remonte pas. Un bug chez vous ne vous coûtera jamais
un retour.

⛔ **Le secret ne traverse jamais le navigateur.** Il est imprimé une seule fois par
`pnpm produit:creer` et vit sur votre serveur ; c’est le **jeton**, et lui seul, qui descend dans
la page.

⚠️ **Rien de tout ceci n’est obligatoire.** Sans jeton — ou avec un jeton expiré, forgé ou
illisible — le retour est **accepté quand même**, simplement sans auteur. On ne perd jamais une
parole pour un problème d’identité. Le détail :
[01-Specs/ingestion.md](01-Specs/ingestion.md) §L’identité signée.

## Déployer

**Une installation par client.** Feedys se pose sur le VPS où tournent déjà les logiciels métier,
une fois par client — jamais en service partagé. Ce que cette topologie coûte, et la liste de
vérification qui va avec :
[04-Architecture/hebergement.md](04-Architecture/hebergement.md) §Une installation par client.

L’image est **publiée sur GHCR**, sur tag de version : il n’y a rien à compiler chez le client.

```bash
cp .env.example .env.production                      # puis renseigner — aucune valeur ne va dans git
docker pull ghcr.io/prfctv/feedys:1.0.0              # ⛔ l’étiquette EST la version, et FEEDYS_VERSION vaut la même
docker compose -f docker-compose.production.yml up -d
curl -fsS http://localhost:3000/sante                # {"etat":"ok","migrations":"a_jour",…}
```

⚠️ **Pas d’étiquette `latest`, et c’est délibéré** : ce qui décide de mettre à jour le serveur de
quelqu’un d’autre, c’est un humain ([D-028](00-Projet/DECISIONS_LOG.md)).

Construire soi-même reste possible, et c’est le chemin sur une machine **arm64**, pour laquelle rien
n’est publié :

```bash
docker build -t feedys:1.0.0 --build-arg FEEDYS_VERSION=1.0.0 .
```

Au démarrage, dans l’ordre : les variables obligatoires, la base, les migrations, l’empreinte de
celles déjà appliquées, la présence et le poids de `widget.js`, puis l’écoute. ⛔ **Un échec à
n’importe laquelle de ces étapes empêche de servir**, et le message dit laquelle.

Le conteneur écoute en **HTTP sur la boucle locale** : ce qui termine TLS est devant. ⛔ Ce n’est
pas facultatif — un navigateur refuse de charger un `<script src="http://…">` depuis une page
HTTPS, et la bulle n’apparaîtrait jamais.

```bash
# Feedys est seul sur sa machine → un Caddy, certificat automatique
docker compose -f docker-compose.production.yml -f docker-compose.tls.yml up -d

# la machine a déjà un proxy → un vhost, et surtout PAS un second proxy
#   deploiement/nginx-feedys.conf.exemple
#
# ce proxy est celui de Kamal → Feedys se pose en accessoire, dix lignes de deploy.yml
#   04-Architecture/hebergement.md §Le cas Kamal
```

Puis la sauvegarde — un dump quotidien, gardé 7 jours :

```bash
./scripts/sauvegarde.sh            # en cron, une fois par jour
./scripts/verifier-sauvegarde.sh   # ⛔ une sauvegarde jamais restaurée n’existe pas
```

⚠️ **Ce qu’on protège n’est pas la note** — elle part par email et se régénère depuis le fil. C’est
le **fil brut** : ce qui a été dit, qui ne se reconstitue pas ([D-022](00-Projet/DECISIONS_LOG.md)).

Le détail, et les trois réglages de proxy qui décident :
[04-Architecture/hebergement.md](04-Architecture/hebergement.md).

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
| **La suite — les prompts d’après** | [05-Prompts/APRES-MVP.md](05-Prompts/APRES-MVP.md) |
| Le comportement du bot | [01-Specs/entretien.md](01-Specs/entretien.md) |
| Le widget | [01-Specs/widget.md](01-Specs/widget.md) |
| Comment un retour entre | [01-Specs/ingestion.md](01-Specs/ingestion.md) |
| La note produite | [01-Specs/synthese.md](01-Specs/synthese.md) |
| L’architecture | [04-Architecture/architecture.md](04-Architecture/architecture.md) |
| Ce qu’on prend sur l’étagère, et pourquoi | [04-Architecture/dependances.md](04-Architecture/dependances.md) |
| Quoi décalquer plutôt qu’inventer | [04-Architecture/references-visuelles.md](04-Architecture/references-visuelles.md) |

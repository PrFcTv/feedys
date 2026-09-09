# Hébergement et exploitation

## La forme

**Un conteneur, un Postgres.** Feedys se pose à côté des logiciels métier, sur le même VPS ou sur
un autre — ça n’a pas d’importance, il ne communique avec eux que par HTTP.

```
  feedys.exemple.fr  ──▶  conteneur feedys  ──▶  postgres
                            Next.js 16
                            sert /widget.js
                            applique ses migrations au démarrage
```

⛔ **Aucun mécanisme du logiciel ne peut dépendre du fournisseur d’hébergement.** Ni du PaaS, ni
de son planificateur, ni de ses variables. Le conteneur doit pouvoir être déplacé d’un
`docker run` à un autre sans que rien ne change.

## Une installation par client

⚠️ **La topologie a changé, et rien ne l’écrivait.** Ce dépôt a longtemps supposé « une instance,
un développeur, plusieurs de ses produits » ([D-005](../00-Projet/DECISIONS_LOG.md)). C’est
l’inverse : les logiciels métier tournent sur le VPS **de chaque client**, et Feedys s’installe à
côté d’eux, **une fois par client** ([D-028](../00-Projet/DECISIONS_LOG.md)).

```
    VPS du client A                     VPS du client B
  ┌───────────────────────┐           ┌───────────────────────┐
  │ logiciel métier       │           │ logiciel métier       │
  │ proxy — DÉJÀ LÀ       │           │ proxy — DÉJÀ LÀ       │
  │   └─ feedys 127.0.0.1 │           │   └─ feedys 127.0.0.1 │
  │        postgres       │           │        postgres       │
  └───────────┬───────────┘           └───────────┬───────────┘
              │        la note, par email         │
              └─────────────────┬─────────────────┘
                                ▼
                     la boîte du développeur
```

Le conteneur le permettait déjà : il écoute sur la boucle locale, derrière le proxy en place, et ne
dépend d’aucun fournisseur (§La forme). ⛔ **Ce qui suit n’est pas une liste de précautions : ce
sont les quatre choses que cette topologie COÛTE**, et trois se paient chez quelqu’un d’autre.

### ⛔ 1 · Les retours sont les données du client

Ils **vivent sur son serveur** — sa base, son volume, ses sauvegardes — et ils contiennent des noms
de personnes, parfois d’immeubles ou de dossiers (CLAUDE.md §Secrets). Ce ne sont pas des métriques
anonymes : c’est de la parole, dictée par des salariés identifiés.

⛔ **Et deux transmissions les font sortir de sa machine.** Le texte du retour part chez le
fournisseur du modèle pour produire les relances et la note ; puis **la note arrive dans la boîte du
développeur** — avec le nom et le rôle de l’auteur, l’URL où il était, et ⛔ **des citations mot
pour mot de ce qu’il a dit** (`apps/serveur/domaine/notification/message.ts`).

⚠️ **Ça se dit dans un contrat, pas dans une documentation technique.** Voici la phrase que
l’intégrateur fait lire à son client — à recopier telle quelle, en remplaçant ce qui est entre
crochets :

> Feedys est installé sur votre serveur. Ce que vos collaborateurs signalent — le texte de leur
> retour, la capture d’écran lorsqu’elle est jointe, ainsi que leur nom et leur fonction lorsque
> votre logiciel les transmet — est enregistré dans une base de données que vous hébergez et qui
> vous appartient.
>
> Deux transmissions sortent de votre serveur, et il n’y en a pas d’autres :
>
> 1. le texte du retour est envoyé à **Anthropic PBC (États-Unis)**, fournisseur du modèle de
>    langage, qui rédige les questions de relance et la note de synthèse. Anthropic est à ce titre
>    un sous-traitant, à faire figurer dans votre registre des traitements ;
> 2. la note de synthèse — qui comprend **des citations mot pour mot** de ce qu’a dit le
>    collaborateur, ainsi que son nom et sa fonction — est envoyée par email à
>    [adresse(s) destinataire(s)], dont **[adresse du prestataire]**, qui assure la maintenance de
>    votre logiciel.
>
> Le logiciel Feedys ne communique avec aucun serveur appartenant à son éditeur : il n’émet aucune
> donnée d’usage, aucune statistique, et aucune vérification de version.

⚠️ **Le dernier paragraphe est vérifiable, et c’est ce qui lui donne sa valeur** : le code est
public, et §La forme interdit toute dépendance extérieure. ⛔ Il cesse d’être vrai le jour où
quelqu’un ajoute un « phone home », si discret soit-il.

### 2 · La mise à jour est manuelle, et multiple

N installations, N déploiements, N fois la liste ci-dessous. ⛔ **Il n’y a pas de mise à jour
automatique dans le conteneur, et il n’y en aura pas** : ce qui décide de mettre à jour le serveur
de quelqu’un d’autre, c’est un humain. Ni `watchtower`, ni une étiquette `latest` qu’on suivrait —
l’image publiée n’a d’ailleurs **que** son étiquette de version, exprès (§Construire et déployer).

⚠️ **Un client qu’on ne met pas à jour garde son ancien widget, et c’est cohérent.** C’est SON
instance qui sert `widget.js` : le widget et le serveur qui le sert **sortent de la même image**, et
il n’y a donc jamais d’écart entre les deux. Les cinq minutes de cache du §Le service du widget
gardent tout leur sens — elles propagent un correctif chez cet hôte-là, dès qu’on a déployé chez
lui, et chez lui seulement.

⛔ **Le corollaire ne se voit pas, et il coûte cher : une régression ne se rattrape plus d’un seul
déploiement.** Sur une instance unique, un correctif touchait tout le monde en cinq minutes. Ici il
faut se rendre chez chacun. C’est un argument pour publier **peu et sûrement**, pas souvent.

### 3 · Le back-office et MCP se démultiplient

N adresses, N mots de passe de back-office, N jetons MCP. Le développeur ouvre l’instance du client
dont il s’occupe, et **l’email est le seul canal qui centralise** : c’est lui qui rassemble dans une
boîte ce que N bases contiennent séparément. Le sujet porte `[Feedys · <produit>]`, ce qui suffit à
trier (§La sauvegarde, et `01-Specs/synthese.md`).

⛔ **On ne construit pas d’agrégateur.** Une console qui verrait plusieurs installations, ce sont
des organisations, des comptes et une isolation à prouver à des tiers — c’est-à-dire du
multi-tenant, que la [ROADMAP](../00-Projet/ROADMAP.md) §Ce qui n’arrivera pas exclut
définitivement. Et ce serait le seul composant du produit à qui il faudrait ouvrir les bases de tous
les clients **à la fois**.

⚠️ Le serveur MCP se déclare donc **une fois par client** dans l’éditeur du développeur, chacun avec
son URL et son jeton. C’est plus verbeux, et c’est la même propriété que partout ailleurs ici : un
jeton perdu ouvre **une** installation, pas toutes.

### 4 · ⛔ Les secrets sont propres à chaque installation

Aucun de ceux-ci ne se réutilise d’un client à l’autre :

| Secret | Ce que sa réutilisation coûterait |
|---|---|
| `FEEDYS_CLE_CHIFFREMENT` | elle déchiffre le secret des produits ([D-015](../00-Projet/DECISIONS_LOG.md)). Partagée, **un vieux dump pris chez un client permet de forger l’identité d’un collaborateur chez tous les autres** |
| `FEEDYS_BO_MOT_DE_PASSE` | un mot de passe qui fuit chez un client ouvre les retours de tous |
| `FEEDYS_MCP_JETON` | pareil, par une API qui rend le fil brut |
| `POSTGRES_PASSWORD`, et le mot de passe de `feedys_service` | pareil, et sans qu’aucune session de back-office en garde trace |
| `SMTP_URL` | un relais partagé fait qu’une instance compromise envoie du courrier au nom de toutes |
| `ANTHROPIC_API_KEY` | le seul dont la fuite se paie en argent, et il a sa propre décision : [D-029](../00-Projet/DECISIONS_LOG.md) |

⛔ **La raison est unique et elle vaut pour les six : un secret partagé transforme un incident chez
un client en incident chez tous.** L’étanchéité entre clients est la seule chose que cette topologie
donne gratuitement — et la réutilisation d’un secret est la seule façon de la perdre.

### Installer chez un client — la liste de vérification

⚠️ Elle suppose **un VPS où un proxy tourne déjà**, ce qui est le cas ordinaire : la machine héberge
le logiciel métier. Dans l’ordre, et chaque ligne se coche pour de vrai.

- [ ] **1 · Le contrat est signé**, et il porte la phrase du §1 ci-dessus. ⛔ Avant l’installation,
      pas après : après, la parole de quelqu’un est déjà en base ;
- [ ] **2 · Le DNS** : `feedys.<domaine-du-client>` → l’IP du VPS ;
- [ ] **3 · Les fichiers**, dans `/srv/feedys` sur le VPS : `docker-compose.production.yml` et les
      deux scripts de `scripts/`. ⚠️ Le dépôt n’a pas à y être et rien ne se compile sur place —
      **l’image est publiée** (§Construire et déployer) ;
- [ ] **4 · `.env.production`**, écrit sur place, jamais recopié d’un autre client (§4). Les deux
      à fabriquer :
      ```bash
      node -e 'console.log(require("node:crypto").randomBytes(32).toString("base64url"))'  # FEEDYS_CLE_CHIFFREMENT
      node -e 'console.log(require("node:crypto").randomBytes(24).toString("base64url"))'  # FEEDYS_MCP_JETON
      ```
      ⛔ `FEEDYS_VERSION` vaut **la version publiée** : c’est elle qui choisit l’image *et* qui rend
      le pied de back-office conforme à l’article 13 ;
- [ ] **5 · Le premier démarrage**, puis §Le rôle de connexion — le rôle de service se crée à la
      main, **une fois**, et les deux `DATABASE_URL` sont renseignées ensuite. ⛔ Tant que la ligne
      de journal ne dit pas « membre de feedys_app, propriétaire d’aucune des N tables », les GRANT
      ne mordent pas ;
- [ ] **6 · Le vhost dans le proxy DÉJÀ EN PLACE** —
      [`deploiement/nginx-feedys.conf.exemple`](../deploiement/nginx-feedys.conf.exemple), ou
      §Le cas Kamal si le VPS est déployé par Kamal. ⛔ Pas de second proxy, et les trois réglages
      de §Le proxy et TLS ne sont pas décoratifs ;
- [ ] **7 · La restauration, une fois, pour de vrai** — §La pose chez un hôte · 2. ⛔ Avant la
      pose, pas après ;
- [ ] **8 · Le produit, sa clé, la ligne de `<script>`, le CSP, l’identité, et les dix minutes
      dans un vrai navigateur** — c’est **§La pose chez un hôte**, points 3 à 7, qui ne change pas
      d’un iota : à ce stade, le fait que l’instance soit chez le client n’a plus d’effet ;
- [ ] **9 · Consigner** ce qui a été vu dans `03-Bugs/MISE_EN_SERVICE.md`. ⛔ Aucun nom de client,
      aucun domaine réel, aucune clé : le dépôt est public.

## Le démarrage

Dans l’ordre, et un échec à n’importe quelle étape **empêche le serveur de servir** :

1. les variables obligatoires sont présentes et non vides ;
2. la base répond ;
3. les migrations en attente sont appliquées, en transaction ;
4. le sha256 de chaque migration déjà appliquée est comparé au registre — une divergence arrête
   le démarrage avec « la base et le dépôt ont divergé » ;
5. le widget est présent et sous le budget de 60 Ko ;
6. le serveur écoute.

⚠️ **L’étape 5 est un garde-fou de production, pas un test.** Un widget absent ou obèse ne se
remarque pas côté serveur : il se remarque chez les quatre hôtes, en même temps.

## Les variables

| Variable | Rôle |
|---|---|
| `DATABASE_URL` | Postgres — le rôle qui **sert**. ⛔ Pas le propriétaire des tables : voir §Le rôle de connexion |
| `DATABASE_URL_MIGRATIONS` | Postgres — le rôle qui **migre**, donc le propriétaire. ⚠️ Facultative : sans elle, on migre avec `DATABASE_URL`, ce qui est le cas d’un poste et de la CI |
| `FEEDYS_URL_PUBLIQUE` | l’origine servie — sert à composer les liens dans les emails |
| `ANTHROPIC_API_KEY` | le modèle |
| `FEEDYS_MODELE` | l’identifiant du modèle. **Explicite, jamais un défaut implicite** — il est journalisé dans chaque synthèse |
| `SMTP_URL`, `FEEDYS_EMAIL_DE`, `FEEDYS_EMAIL_A` | l’envoi de la note. ⚠️ `?pool=true` dans l’URL demande le bassin de connexions |
| `FEEDYS_BO_MOT_DE_PASSE` | l’accès au back-office — une personne, un mot de passe. ⚠️ Le changer invalide toutes les sessions ouvertes |
| `FEEDYS_VERSION` | la version déployée, affichée en pied de back-office avec le lien vers la source. ⚠️ **C’est l’article 13 de l’AGPL**, pas une décoration : un lien vers le dépôt sans la version ne suffit pas. Posée à la construction de l’image ; absente sur un poste, où « dev » est la réponse honnête |
| `FEEDYS_CLE_CHIFFREMENT` | 32 octets en base64url. Chiffre le secret des produits en base — c’est elle qui permet de vérifier l’identité signée par l’hôte ([D-015](../00-Projet/DECISIONS_LOG.md)). ⚠️ **La perdre ne perd aucun retour** : les identités cessent simplement d’être vérifiées, et `pnpm produit:creer` refuse de créer un produit de plus |
| `FEEDYS_MCP_JETON` | le jeton du serveur MCP. ⚠️ **Absente, l’API MCP répond 503 et ne sert RIEN** — un serveur qui laisserait passer faute de secret serait pire qu’un serveur fermé |
| `FEEDYS_STOCKAGE` | où vont les captures et l’audio — un volume monté |
| `FEEDYS_ACTIFS` | le dossier qui contient `widget.js` et `snapdom.js`. ⚠️ Posée par le conteneur ; sur un poste, l’emplacement se déduit de la racine du dépôt |
| `FEEDYS_MIGRATIONS` | le dossier `db/migrations`. ⚠️ Posée par le conteneur, où il n’y a pas de `pnpm-workspace.yaml` à remonter |
| `FEEDYS_PROMPTS` | le dossier qui contient `systeme.md`. ⚠️ En développement il se déduit de la racine du dépôt ; en conteneur il n’y a ni `apps/`, ni `domaine/` à côté du serveur — la variable est alors obligatoire |

⛔ **Neuf de ces variables sont OBLIGATOIRES** — `DATABASE_URL`, `FEEDYS_URL_PUBLIQUE`,
`ANTHROPIC_API_KEY`, `FEEDYS_MODELE`, `FEEDYS_BO_MOT_DE_PASSE`, `FEEDYS_CLE_CHIFFREMENT`,
`FEEDYS_STOCKAGE`, `FEEDYS_PROMPTS`, `FEEDYS_ACTIFS`. Absente ou vide, le conteneur **refuse de
démarrer** en la nommant. La liste vit dans `apps/serveur/domaine/demarrage/controles.ts` — un seul
endroit, testé.

⚠️ **Les autres dégradent quelque chose de nommé, et le démarrage le dit** : sans SMTP la note ne
part pour personne, sans `FEEDYS_MCP_JETON` l’API MCP répond 503, sans `FEEDYS_VERSION` le pied de
back-office affiche « dev », sans `DATABASE_URL_MIGRATIONS` on migre avec le rôle de service. Aucune n’empêche de servir — **un retour qui arrive sans email est un
retour reçu**, lisible au back-office et par MCP. Refuser de démarrer pour ça perdrait de la parole
au nom d’un confort.

⛔ **Aucun secret dans le dépôt.** Il est **public** : la règle est absolue, elle vaut aussi pour
la documentation, les exemples et les fixtures. Les exemples utilisent `exemple.fr`.

Sur le poste, les secrets vivent dans `.env.local`, ignoré par git. ⛔ Ne jamais demander à
l’humain de recoller un secret dans la conversation : il l’a déjà donné.

```bash
node --env-file-if-exists=.env.local -e '…'   # s’en servir sans afficher la valeur
```

## Le service du widget

`GET /widget.js` sert le bundle, et `GET /snapdom.js` la capture d’écran qui l’accompagne
([D-011](../00-Projet/DECISIONS_LOG.md)). Les deux, avec :

```
Cache-Control: public, max-age=300, stale-while-revalidate=86400
Access-Control-Allow-Origin: *
```

⚠️ **Cinq minutes de cache, pas un an.** Le widget est servi à quatre logiciels qui ne redéploient
pas : c’est **notre** cache qui décide de la vitesse de propagation d’un correctif. Un cache long
avec empreinte dans l’URL obligerait chaque hôte à changer sa balise — exactement ce qu’on a
cherché à éviter.

⚠️ **`Access-Control-Allow-Origin: *` sur le script seulement.** Les routes d’API, elles, vérifient
l’origine contre le `domaine` du produit déduit de la clé.

⚠️ **Et `Cross-Origin-Resource-Policy: cross-origin`**, sans quoi un hôte qui a activé COEP bloque
le script — avec une erreur qui ne ressemble à rien de reconnaissable, chez lui, un mardi matin.

⚠️ **L’emplacement des deux fichiers se déduit du dossier de travail** en développement, et de
`FEEDYS_ACTIFS` en production — un dossier unique qui les contient tous les deux. Le conteneur
(P-013) le pose ; sans lui, il n’y a ni `packages/`, ni `node_modules/` à côté du serveur.

## Le rôle de connexion — à créer une fois, à la main

⛔ **`DATABASE_URL` ne doit pas pointer sur le propriétaire des tables.** Un propriétaire contourne
tous les `GRANT` : le garde-fou « aucun `DELETE` nulle part » ne vaudrait plus rien, et rien ne le
signalerait ([D-009](../00-Projet/DECISIONS_LOG.md)).

**Deux rôles, deux moments** ([D-019](../00-Projet/DECISIONS_LOG.md)). Migrer crée des tables : ça
demande le propriétaire. Servir n’en demande pas, et ne doit pas l’avoir.

| Variable | Rôle | Quand |
|---|---|---|
| `DATABASE_URL_MIGRATIONS` | le propriétaire | au démarrage, le temps des migrations |
| `DATABASE_URL` | un membre de `feedys_app` | tout le reste du temps |

`0001_socle.sql` crée le rôle de groupe `feedys_app` et ses privilèges. Il ne crée **pas** le rôle
de login : son nom et son mot de passe sont propres à chaque installation et n’ont rien à faire
dans un dépôt public.

### ⛔ Qui est le propriétaire — il n’y a rien à créer

**Le propriétaire existe déjà : c’est `POSTGRES_USER`**, créé par l’image Postgres au premier
démarrage (`docker-compose.production.yml`, `${POSTGRES_USER:-feedys}`). C’est lui qui a appliqué
les migrations, donc lui qui possède les tables.

⛔ **Il n’y a pas de rôle « feedys_proprietaire » à créer**, et il ne faut pas en créer un : un
second propriétaire ne posséderait rien, et ne pourrait donc pas migrer non plus.

### La procédure, une fois, dans `psql`

⚠️ En production la base ne publie aucun port. Et `docker compose` n’a PAS accès à
`.env.production` tout seul — ce fichier n’est qu’un `env_file` pour le conteneur `feedys` :
sans `--env-file`, la commande **avorte avant d’agir**, sur
`required variable POSTGRES_PASSWORD is missing a value`.

⛔ **Charger le fichier dans le shell règle les deux problèmes d’un coup** — l’interpolation de
compose, *et* les variables que la ligne `psql` utilise elle-même :

```bash
set -a; . ./.env.production; set +a

docker compose -f docker-compose.production.yml --env-file .env.production   exec postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

⚠️ Sans le `set -a`, `"$POSTGRES_USER"` est **vide** dans le shell appelant — `--env-file` alimente
compose, pas l’environnement de qui l’invoque — et `psql -U ""` échoue.

```sql
-- Le rôle qui SERT. ⚠️ `inherit` explicite : sans lui, il faudrait un `set role`
-- à chaque connexion, et les GRANT de feedys_app ne s’appliqueraient pas.
--
-- ⛔ Ce n'est pas un détail de style : un rôle NOINHERIT est bel et bien MEMBRE
--    de feedys_app, et ne peut pourtant rien lire. Le démarrage le détecte
--    désormais et le dit — il ne le voyait pas avant.
create role feedys_service login password '…' inherit in role feedys_app;
```

Puis, dans l’environnement du conteneur (`.env.production`, hors dépôt) :

```
DATABASE_URL=postgresql://feedys_service:…@postgres:5432/feedys
DATABASE_URL_MIGRATIONS=postgresql://<POSTGRES_USER>:<POSTGRES_PASSWORD>@postgres:5432/feedys
```

⚠️ **La seconde porte le rôle de `docker-compose.production.yml`**, celui-là même dont
`POSTGRES_PASSWORD` est déjà dans ce fichier. Ce n’est pas un nouveau secret à inventer.

⛔ **`pnpm db:migrate` suit la même règle** — `DATABASE_URL_MIGRATIONS` d’abord, repli sur
`DATABASE_URL`. Ce n’était pas le cas : l’outil lisait `DATABASE_URL` en dur et tentait donc de
migrer avec le rôle de service, sur un `permission denied for schema public` sans explication.

⛔ **Les deux sont obligatoires dès qu’on sépare**, et ce n’est pas un conseil : un rôle de service
ne peut pas migrer **du tout**, même sur une base déjà à jour. Le runner commence par un
`create table if not exists`, et Postgres vérifie le privilège `CREATE` sur le schéma **avant** de
regarder si la table existe. Le démarrage rendrait alors « permission denied for schema public »
— il ajoute désormais la ligne qui dit quoi faire.

### Ce que le démarrage en dit

⚠️ Le démarrage annonce le rôle de service dans ses journaux, et **il ne refuse jamais de démarrer
pour ça** — un poste et la CI sont légitimement en rôle unique :

```
Feedys · rôle de connexion · feedys_service — membre de feedys_app, propriétaire d’aucune des 8 tables. Les GRANT s’appliquent.
Feedys ⚠️  rôle de connexion · feedys — il est superutilisateur. ⛔ Les GRANT ne mordent pas…
Feedys ⚠️  rôle de connexion · feedys_service — il n’hérite pas des privilèges de feedys_app…
Feedys ⚠️  rôle de connexion · feedys_service — la base ne contient AUCUNE table…
```

C’est la seule façon de savoir si le garde-fou est actif : sans cette ligne, un `DATABASE_URL` mal
configuré ne produit **ni erreur, ni test rouge**.

⚠️ **Les deux dernières lignes existent parce que le contrôle mentait dans ces deux cas.** Un rôle
`NOINHERIT` est membre du groupe — `pg_has_role(…, 'member')` répond `true` — et ne peut rien lire ;
et une base vide fait dire « propriétaire d’aucune des **0** tables. Les GRANT s’appliquent », alors
que `DATABASE_URL` désigne simplement la mauvaise base du cluster. Les rôles sont cluster-wide :
`feedys_app` existe partout, l’appartenance répond « oui » partout.

### ⛔ Et `DATABASE_URL` doit RÉPONDRE, sans quoi le démarrage est refusé

⚠️ Depuis la séparation, l’étape « la base répond » ouvre `DATABASE_URL_MIGRATIONS`. **Plus rien ne
regardait `DATABASE_URL`** : une coquille dans le mot de passe du rôle de service faisait démarrer
le conteneur **vert**, écouter, et échouer sur chaque requête.

⛔ `/sante` rend alors 503, le `HEALTHCHECK` passe `unhealthy` — et **`restart: unless-stopped` ne
redémarre pas un conteneur unhealthy.** Il reste debout à ne rien servir : exactement le « serveur à
moitié démarré » qu’on déclare pire qu’un redémarrage en boucle. Les deux connexions sont désormais
ouvertes pour de bon, chacune avec un délai de dix secondes — le défaut de `pg` étant l’attente
infinie.

### Ce qui le prouve

`apps/serveur/infra/base/roles.integration.test.ts` crée un vrai rôle de login membre de
`feedys_app`, **s’y connecte**, et vérifie qu’un `DELETE` échoue sur les sept tables, qu’un `UPDATE`
sur `audit` échoue, qu’un `INSERT` passe, et que la sonde peut lire le registre des migrations.

⚠️ Le test voisin de `migrations.integration.test.ts` fait un `set role` depuis la session du
propriétaire : c’est probant sur les GRANT du groupe, et ça ne dit rien de l’authentification, de
l’héritage, ni du fait qu’un rôle **membre du propriétaire** contournerait tout.

## La sonde — `GET /sante`

```json
{ "etat": "ok", "base": "ok", "migrations": "a_jour", "version": "1.4.0" }
```

`200` quand tout va, `503` sinon — un proxy sait lire 503 comme « pas maintenant ». C’est le
`HEALTHCHECK` de l’image.

⛔ **Deux questions, pas trois.** La base répond, et les migrations sont à jour. Une sonde qui
interrogerait le modèle ou le relais SMTP ferait redémarrer le conteneur parce qu’un fournisseur a
éternué — et perdrait des retours pour protéger un confort. Ce qui tue Feedys, c’est une base
injoignable ou un schéma qui a divergé.

⛔ **Rien de `DATABASE_URL` ne sort de la réponse**, jamais : elle porte un mot de passe.

## Construire et déployer

### L’image publiée — ce qu’on installe chez un client

```bash
docker pull ghcr.io/prfctv/feedys:1.4.0
```

⛔ **Sans image publiée, installer chez un client voudrait dire cloner le dépôt et compiler sur sa
machine.** C’est la seule raison d’être de la publication, et elle décide de sa forme :

- **Sur tag de version uniquement**, jamais à chaque commit vers `main`. Publier une image, c’est
  **distribuer** au sens de l’AGPL : elle doit pouvoir désigner la révision exacte de sa source, et
  un commit sans tag ne le peut pas ([D-028](../00-Projet/DECISIONS_LOG.md)) ;
- ⛔ **le tag EST la version, verbatim** — `1.4.0`, jamais `v1.4.0`. Le même mot sert de nom de tag,
  de `FEEDYS_VERSION`, d’étiquette d’image, et de cible au lien `…/tree/<version>` affiché en pied
  de back-office. Une transformation, même d’une lettre, fait un lien mort : c’est-à-dire un
  manquement à l’article 13, pas une coquille. La CI refuse un tag qui n’est pas un semver nu, et
  **retire l’image publiée pour lui demander sa version** avant de déclarer le travail fait ;
- ⛔ **pas d’étiquette `latest`.** Une installation qui la suivrait changerait de version toute
  seule au prochain `docker compose pull` — or ce qui décide de mettre à jour le serveur de
  quelqu’un d’autre, c’est un humain (§Une installation par client · 2) ;
- **`linux/amd64` seulement**, et c’est mesuré : [D-028](../00-Projet/DECISIONS_LOG.md).

⚠️ **Un paquet GHCR est PRIVÉ à sa première publication, même depuis un dépôt public.** Un paquet
hérite des droits d’accès du dépôt lié, **pas de sa visibilité**. Il faut donc, **une fois**, aller
le passer en public dans les réglages du dépôt → *Packages*. Sans ça, le `docker pull` d’un client
échoue sur un refus d’authentification, le jour de l’installation, sur un message qui ne dit pas
que c’est un réglage de visibilité.

### Construire soi-même — le repli, et il est prouvé

```bash
docker build -t feedys:1.4.0 --build-arg FEEDYS_VERSION=1.4.0 .
docker compose -f docker-compose.production.yml up -d
```

⚠️ C’est ce que fait un client sur une machine **arm64**, où il n’y a pas d’image à tirer : rien
dans le `Dockerfile` n’est propre à une architecture, et la construction native y aboutit
([D-028](../00-Projet/DECISIONS_LOG.md)).

L’image est une Alpine avec le serveur autonome de Next (`output: 'standalone'`), le widget
construit, les deux prompts et les migrations — **environ 320 Mo**, sans `pnpm`, sans le dépôt et
sans `node_modules` complet. Elle tourne en `node`, pas en root.

⚠️ **`.env.production` n’est pas dans le dépôt** et ne doit jamais y entrer. `docker run
--env-file` fait exactement la même chose que le compose : ce fichier est une commodité, pas un
mécanisme.

## Le proxy et TLS

Le conteneur écoute en **HTTP, sur la boucle locale** (`127.0.0.1:3000`). Ce qui termine TLS est
devant, et ⛔ **ce n’est pas facultatif** : la balise `<script src="https://…">` est posée dans une
page HTTPS, et un navigateur refuse purement et simplement de charger un script en clair depuis une
page chiffrée. Sans certificat, **le widget ne se charge pas du tout**.

### Deux cas, et le premier est le plus probable

**La machine héberge déjà les logiciels métier.** Elle a donc déjà un proxy. ⛔ On n’en pose pas un
second — les deux se battraient pour les ports 80 et 443. On ajoute un vhost :
[`deploiement/nginx-feedys.conf.exemple`](../deploiement/nginx-feedys.conf.exemple).

⚠️ **C’est le cas ordinaire chez un client** (§Une installation par client). Et si ce proxy est
celui de Kamal, le vhost se remplace par dix lignes de `deploy.yml` : §Le cas Kamal.

**Feedys est seul sur sa machine.** Alors le plus court est Caddy, en superposition :

```bash
docker compose -f docker-compose.production.yml -f docker-compose.tls.yml up -d
```

⚠️ Le certificat Let’s Encrypt est obtenu **et renouvelé** tout seul : pas de certbot, pas de cron,
pas de « le site est tombé un dimanche parce qu’un renouvellement a échoué en silence ». C’est le
seul mécanisme d’exploitation qu’on ne veut pas avoir à surveiller.

Prérequis, dans l’ordre : un enregistrement DNS `feedys.<domaine>` → l’IP ; les ports **80 et** 443
ouverts — ⛔ le 80 n’est pas facultatif, c’est par lui que passe la validation ; `FEEDYS_DOMAINE` et
`ACME_EMAIL` dans `.env.production`.

### ⛔ Les trois réglages qui décident, et qu’on oublie

**1. L’en-tête d’IP.** Feedys lit `x-forwarded-for`, puis `x-real-ip`, puis retombe sur
`« inconnue »` (`apps/serveur/app/api/retours/_reponses.ts`). ⛔ **Si le proxy ne les pose pas, tout
le monde partage un seul seau de débit** : dix tours d’entretien par minute pour l’entreprise
entière. Deux personnes qui parlent en même temps suffisent à en bloquer une troisième, avec un
message qui parle de débit dépassé — une panne qu’on met une journée à comprendre.

⚠️ Caddy le fait tout seul (`reverse_proxy`). nginx **non** : les deux `proxy_set_header` de
l’exemple ne sont pas décoratives.

**2. La taille du corps.** L’API borne à **4 Mio**, capture et audio compris, et rend un 413 qui
explique. ⛔ nginx plafonne à **1 Mio par défaut** : la coupure viendrait du proxy, muette, et le
widget l’afficherait comme une panne réseau. `client_max_body_size 4m;`. Caddy n’a pas de limite par
défaut, il n’y a rien à y faire.

**3. Pas de compression au proxy.** Feedys compresse `widget.js` lui-même et pose un **ETag qui
dépend de l’encodage** (`apps/serveur/app/_actifs/servir.ts`). Un proxy qui re-compresse ou réécrit
l’en-tête casse les `304` — et le budget de 60 Ko se mesure sur le fichier **tel qu’il est servi**.

## Le cas Kamal — Feedys en accessoire

Le logiciel métier du client est déployé par [Kamal](https://kamal-deploy.org). Le VPS a donc déjà
un proxy : **`kamal-proxy`, qui tient les ports 80 et 443**. ⚠️ C’est le premier des deux cas
ci-dessus, pas un troisième. ⛔ **On ne pose pas de second proxy** — ni un nginx, ni le Caddy de
`docker-compose.tls.yml`, qui se battraient avec lui pour les mêmes ports.

Kamal a exactement le mot qu’il faut : un **accessoire**. Les accessoires « sont gérés séparément du
service principal — ils ne sont pas mis à jour quand vous déployez, et ils n’ont pas de déploiement
sans coupure ». C’est la propriété qu’on veut : `kamal deploy` du logiciel métier ne doit **rien**
faire à Feedys, et mettre Feedys à jour est une décision distincte, prise par un humain
(§Une installation par client · 2).

⚠️ **Vérifié le 2026-09-09 contre Kamal 2.12.0**, sur la configuration de référence et sur le code.
`accessories.<nom>.proxy` **n’existe que depuis Kamal 2.4.0** : avant, un accessoire ne pouvait pas
être publié par `kamal-proxy` et ce mode d’emploi ne s’applique pas. `kamal accessory boot <nom>`
enregistre l’accessoire auprès du proxy lorsque le bloc `proxy` est présent.

### Les deux accessoires

Dans le `config/deploy.yml` **du logiciel métier du client** — ce n’est pas un fichier à nous :

```yaml
accessories:
  # ── Feedys ─────────────────────────────────────────────────────────────────
  feedys:
    # ⛔ La version publiée, épinglée. Jamais `latest` : ce qui met à jour le
    #    serveur de quelqu’un d’autre, c’est un humain.
    image: ghcr.io/prfctv/feedys:1.4.0
    host: <l’hôte qui porte déjà le logiciel métier>

    # ⛔ CE BLOC REMPLACE LE VHOST NGINX. kamal-proxy termine TLS et joint le
    #    conteneur par le réseau `kamal` : Feedys ne publie AUCUN port sur la
    #    machine — c’est encore plus fermé que le 127.0.0.1 du compose.
    proxy:
      host: feedys.exemple.fr
      # ⚠️ Le port INTERNE du conteneur. Le défaut de kamal-proxy est 80.
      app_port: 3000
      # ⚠️ Certificat Let’s Encrypt automatique. Prérequis identiques au Caddy :
      #    le DNS pointe cette machine, et les ports 80 et 443 sont ouverts.
      ssl: true

    env:
      clear:
        FEEDYS_URL_PUBLIQUE: https://feedys.exemple.fr
        FEEDYS_MODELE: claude-sonnet-5
        # ⛔ La même chaîne que l’étiquette de `image:` ci-dessus. Un écart fait
        #    mentir le pied de back-office — article 13 de l’AGPL, pas cosmétique.
        FEEDYS_VERSION: '1.4.0'
        FEEDYS_EMAIL_DE: feedys@exemple.fr
        FEEDYS_EMAIL_A: dev@exemple.fr
      # ⚠️ Kamal ne met pas ceux-ci dans la ligne de commande : il les écrit sur
      #    l’hôte dans un fichier d’environnement en 0600. Leurs valeurs vivent
      #    dans `.kamal/secrets`, hors de git.
      # ⛔ Et elles sont propres à CETTE installation (§Une installation par
      #    client · 4).
      secret:
        - DATABASE_URL
        - DATABASE_URL_MIGRATIONS
        - ANTHROPIC_API_KEY
        - FEEDYS_BO_MOT_DE_PASSE
        - FEEDYS_CLE_CHIFFREMENT
        - FEEDYS_MCP_JETON
        - SMTP_URL

    # ⚠️ Les captures. Kamal crée le dossier sur l’hôte avant de le monter.
    directories:
      - stockage:/stockage

  # ── Son Postgres, à lui ────────────────────────────────────────────────────
  feedys_postgres:
    image: postgres:18-alpine
    host: <le même hôte>
    # ⚠️ Le nom du conteneur EST le nom de service, et c’est lui que le DNS du
    #    réseau `kamal` résout : c’est donc l’hôte à écrire dans les deux
    #    DATABASE_URL. Sans ce `service:`, il vaudrait `<service>-feedys_postgres`
    #    — devinable, mais pas à deviner.
    service: feedys-postgres
    # ⛔ AUCUN `port:`. La base ne sort pas de la machine ; Feedys la joint par le
    #    réseau `kamal`, auquel les accessoires sont attachés par défaut.
    env:
      clear:
        POSTGRES_USER: feedys
        POSTGRES_DB: feedys
      secret:
        - POSTGRES_PASSWORD
    directories:
      # ⚠️ /var/lib/postgresql, et non .../data : depuis Postgres 18 l’image range
      #    les données dans un sous-dossier par version majeure.
      - data:/var/lib/postgresql
```

Puis, une fois :

```bash
kamal accessory boot feedys_postgres
kamal accessory boot feedys
```

⚠️ **`kamal deploy` ne les touchera plus.** Mettre Feedys à jour, c’est changer les deux `1.4.0`
ci-dessus puis `kamal accessory reboot feedys` — une commande explicite, pour cette installation-là.

### ⛔ Les trois réglages, revus pour kamal-proxy

Ce sont les mêmes trois que §Le proxy et TLS, et **deux d’entre eux se règlent tout seuls ici** :

| Réglage | Avec kamal-proxy |
|---|---|
| **1. L’en-tête d’IP** | ✅ **rien à faire, et surtout rien à ajouter** — voir juste en dessous |
| **2. La taille du corps** | ✅ rien à faire : le tampon accepte **1 Gio** par défaut, très au-dessus des 4 Mio que l’API borne elle-même. C’est le contraire de nginx et de son 1 Mio |
| **3. Pas de compression** | ✅ rien à faire : kamal-proxy ne re-compresse pas, les `304` et le budget de 60 Ko sont saufs |

⛔ **Et surtout : ne posez PAS `forward_headers: true`.** C’est le piège de ce montage, parce que la
documentation de Kamal se lit à l’envers de ce qu’on cherche.

`kamal-proxy` pose **toujours** `X-Forwarded-For` avec l’IP réelle de qui se connecte
(`Target#forwardHeaders`, qui appelle `SetXForwarded()` dans tous les cas). Le drapeau
`forward_headers` ne décide pas *si* l’en-tête est posé — il décide si l’en-tête **entrant** est
conservé avant qu’on y ajoute cette IP.

Or Feedys lit **la première valeur** de la liste (`ipDe`, `apps/serveur/app/api/retours/_reponses.ts`).
Donc :

- `forward_headers` **absent** — le défaut quand `ssl: true` — la liste ne contient que l’IP réelle.
  ✅ C’est ce qu’il faut ;
- `forward_headers: true` **sans rien devant kamal-proxy** : ⛔ la liste commence par ce que le
  client a bien voulu envoyer. N’importe qui choisit alors son propre seau de débit, et la
  limitation par IP ne limite plus rien.

⚠️ **Il ne se met à `true` que s’il y a un proxy de confiance DEVANT kamal-proxy** — un CDN, un
répartiteur de charge. C’est le seul cas, et il n’est pas celui d’un VPS ordinaire.

## La pose chez un hôte — la liste de vérification

⚠️ **À jouer dans l’ordre.** Chaque ligne se coche pour de vrai, pas de tête. Ce qui a été vu
entre dans `03-Bugs/MISE_EN_SERVICE.md` — au format de `RECETTE_MVP.md`.

⛔ **Aucun nom de client, aucun domaine réel, aucune clé ne rejoint le dépôt.** Les exemples
restent en `exemple.fr`. Le dépôt est public.

### 1 · Le service répond

- [ ] `docker compose -f docker-compose.production.yml up -d` — §Construire et déployer ci-dessus ;
- [ ] `GET /sante` rend **200** et `migrations: 'a_jour'` — §La sonde ;
- [ ] les journaux de démarrage portent la ligne du **rôle de connexion** — §Le rôle de connexion.
      ⚠️ Si elle dit « il est superutilisateur » ou « il est propriétaire », les GRANT ne mordent
      pas : c’est le moment de le corriger, pas après ;
- [ ] `feedys.<domaine>/widget.js` se télécharge **depuis l’extérieur**, en HTTPS, en **brotli ou
      gzip** — §Le proxy et TLS. ⛔ En clair, un navigateur refusera de le charger depuis une page
      HTTPS, et la bulle n’apparaîtra jamais ;
- [ ] le proxy transmet bien l’IP : `curl -s https://feedys.<domaine>/sante` depuis l’extérieur, puis
      vérifier dans les journaux qu’aucune requête n’arrive avec l’IP du proxy. ⚠️ Sans ça, tout le
      monde partage un seul seau de débit — §Le proxy et TLS.

### 2 · ⛔ La restauration, une fois, pour de vrai

⛔ **Avant la pose, pas après.** Une sauvegarde jamais restaurée n’existe pas (§La sauvegarde).

```bash
./scripts/sauvegarde.sh
./scripts/verifier-sauvegarde.sh
```

- [ ] la vérification imprime un compte de `messages` **non nul** — §La sauvegarde ;
- [ ] la ligne de cron quotidienne est posée ;
- [ ] noter dans `MISE_EN_SERVICE.md` **ce qui a été restauré et depuis quel dump**.

### 3 · Le produit et sa clé

```bash
pnpm produit:creer -- --nom "Nom du logiciel" --domaine app.exemple.fr
```

- [ ] le **domaine d’origine** est celui d’où la page sera servie. ⚠️ Le port et le schéma sont
      ignorés, seul le nom d’hôte compte — et ⛔ **pas de joker de sous-domaine** :
      `app.exemple.fr` ne couvre pas `autre.exemple.fr` ;
- [ ] le **secret est affiché une seule fois**. Il part chez l’hôte, dans l’environnement de SON
      serveur. ⛔ Jamais dans une page, jamais dans le dépôt, jamais dans une conversation.

### 4 · La ligne de `<script>`

```html
<script src="https://feedys.exemple.fr/widget.js" data-cle="fdy_pub_…" defer></script>
```

- [ ] ⛔ **par `<script src>`, jamais par un paquet npm** — c’est ce qui garde le widget distinct
      du logiciel hôte, et la raison est juridique avant d’être technique
      ([licences.md](licences.md)) ;
- [ ] posée sur **toutes** les pages où quelqu’un peut buter, pas seulement l’accueil ;
- [ ] la bulle apparaît, et ⛔ **ne s’ouvre pas toute seule**.

### 5 · ⛔ La politique de sécurité de contenu — ce que Feedys demande, et rien de plus

⚠️ **Tout ce qui suit est MESURÉ**, le 2026-09-09, pendant P-027, dans Chromium, sur une page
d’hôte **nue** — sans un seul style ni script en ligne à elle, pour qu’une violation observée
soit forcément la nôtre — servie sur **un autre port que Feedys**, et jusqu’à l’**envoi** d’un
retour, pas seulement jusqu’au chargement. ⛔ Rien n’y est déduit. Chaque ligne a son test dans
[`tests/e2e/widget-csp.spec.ts`](../tests/e2e/widget-csp.spec.ts), et c’est ce fichier qu’on
rejoue quand on veut la refaire.

**La ligne à donner à un intégrateur** — deux directives, une seule origine :

```
script-src  https://feedys.exemple.fr;
connect-src https://feedys.exemple.fr;
```

C’est-à-dire : **ajoutez l’origine Feedys à ces deux directives-là**, et à aucune autre. Le reste
de la politique de l’hôte ne bouge pas — un `default-src 'none'` intégral suffit à côté.

| Directive | Exigée ? | Pourquoi, et ce qui l’a montré |
|---|---|---|
| `script-src <origine Feedys>` | ✅ **oui** | `widget.js` **et** `/snapdom.js`, qui vient de la même origine et n’ajoute donc rien à écrire ([D-011]). Sans elle, le script est refusé et **la bulle n’apparaît pas du tout** |
| `connect-src <origine Feedys>` | ✅ **oui** | l’ingestion, le tour, la fin, l’accusé et la relève des réponses — cinq appels, une seule origine. ⛔ Sans elle, **la bulle apparaît quand même** : quelqu’un parle, clique, et rien ne part. C’est le pire des deux |
| `style-src` | ⛔ **non** | plus rien depuis P-027 : la feuille est **construite** (`new CSSStyleSheet()`), pas posée en `<style>`. Vérifié sous `style-src 'none'` **explicite** — plus dur que `'self'` — lanceur habillé, console vide |
| `img-src` | ⛔ **non** | vérifié sous `img-src 'none'` explicite : le widget ne charge aucune image. Ses icônes sont du SVG en ligne dans le balisage, pas des ressources |
| `default-src` | ⛔ **non** | il n’a pas à être élargi. Mesuré avec `default-src 'none'` |
| `font-src`, `media-src`, `frame-src`, `worker-src`, `object-src`, `base-uri`, `form-action` | ⛔ **non** | aucune violation, dans aucun des sept montages mesurés. Le widget n’a **pas de police à lui** — il prend celle du système |

⚠️ **La moitié la plus utile de ce tableau est la colonne des « non ».** Une liste de directives
trop large fait relâcher une politique sans raison, et personne ne la resserre ensuite.

#### ⚠️ Et la capture d’écran, elle, coûte deux directives de plus

`@zumer/snapdom` ([D-011]) pose un `<style>` dans le document de l’**hôte** et charge un SVG en
`data:` pour rendre sa toile. Sous une politique stricte, les deux sont refusés :

```
style-src 'unsafe-inline';   img-src data:;
```

- [ ] **si l’hôte peut se le permettre**, il les ajoute et la capture arrive avec le retour ;
- [ ] **s’il ne peut pas**, on ne change rien : la capture est simplement **absente**, l’entretien
      et l’envoi se passent exactement pareil (l’échec doux est la règle depuis [D-011]) — mais
      ⚠️ **sa console porte alors deux lignes rouges par ouverture du panneau**. Ce n’est pas beau,
      ce n’est pas à nous de le corriger, et c’est écrit :
      [T-010](../00-Projet/TICKETS_DIFFERES.md).

⛔ **Ne recommandez pas `style-src 'unsafe-inline'` par défaut.** C’est un vrai relâchement de la
politique d’un logiciel métier, consenti pour un aide-mémoire. Le poser « pour que ce soit propre »
serait exactement la faute que [D-011] refuse.

#### La vérification, chez soi, avant d’aller chez l’hôte

```bash
pnpm widget:demo      # puis http://localhost:4321/csp
```

`/csp` sert la même pose sous une vraie politique, en en-tête, sur une page nue. La politique se
change dans l’URL : `?politique=default-src 'none'; script-src …`.

- [ ] le lanceur est **rond, bleu, de 48 px de haut** — s’il est gris et carré, la feuille est
      bloquée ;
- [ ] la console est **vide** du chargement jusqu’à l’envoi, aux deux lignes de snapdom près ;
- [ ] un retour d’essai arrive bien au back-office.

### 6 · L’identité signée

⚠️ Facultative, et **on la branche quand même** : sans elle, un retour arrive sans auteur, et on
ne peut ni revenir vers la personne ni pondérer selon son métier ([D-005](../00-Projet/DECISIONS_LOG.md)).

- [ ] le serveur de l’hôte signe `{ ref, nom, role, exp }` avec le secret — la recette est dans le
      [README](../README.md) §Attacher une identité ;
- [ ] `window.feedys` est posé **avant** la balise du widget ;
- [ ] un premier retour d’essai porte `identite_verifiee = true` au back-office.
      ⚠️ `false` n’est pas un rejet — le retour est accepté quand même —, mais c’est le signe
      que la signature ne colle pas.

### 7 · Les dix minutes qui suivent

C’est la partie qui ne s’automatise pas, et c’est celle qui compte. Dans un vrai navigateur, sur
une vraie page de l’hôte :

- [ ] ⛔ **la console de l’hôte** : toute ligne écrite par nous est un défaut, y compris
      l’avertissement de snapdom ([T-005](../00-Projet/TICKETS_DIFFERES.md)) ;
- [ ] les **styles de l’hôte** ne traversent pas le widget, ni l’inverse ;
- [ ] le `z-index` : rien de l’hôte ne passe **par-dessus** le panneau — modales comprises ;
- [ ] le **poids réellement téléchargé**, mesuré dans l’onglet réseau, avec les en-têtes qu’un vrai
      navigateur envoie ;
- [ ] un retour **dicté à la voix** va jusqu’au bout, et la note arrive.

⚠️ **Ce qui se corrige en une ligne se corrige tout de suite** ; le reste devient une entrée de
`BUGS_LOG.md`, ou un ticket différé avec son déclencheur.

⛔ **Et ce que la vraie page apprend, la fausse l’apprend aussi** : toute hostilité constatée chez
un hôte rejoint `packages/widget/demo/index.html`. C’est ce qui empêche le même défaut de revenir.
## Le filet — les entretiens que personne n’a refermés

Un entretien est normalement refermé par le navigateur (`POST /fin`). Un onglet tué, un poste
éteint, un `keepalive` que le système laisse tomber — et le retour resterait `en_cours` pour
toujours. Le **filet** balaie toutes les cinq minutes et referme ce qui est muet depuis plus de
trente minutes ([D-018](../00-Projet/DECISIONS_LOG.md)). Il tourne **dans le processus qui sert**,
pas dans un ordonnanceur : il n’y a rien à installer.

⚠️ **Une passe est bornée deux fois** : vingt retours au plus, et trois minutes d’horloge au plus.
La seconde borne n’est pas une redite — une synthèse peut coûter trois minutes à elle seule
(délai de 60 s × trois tentatives), et vingt lentes faisaient une passe d’une heure pendant
laquelle les onze passes suivantes ne partaient pas.

### ⛔ Ce qu’il faut lire dans les journaux

```
Feedys · filet — 20 entretien(s) refermé(s) par silence, 18 passé(s) en aval, 0 en échec, 2 reporté(s).
Feedys ⚠️  filet — 2 entretien(s) refermé(s) sans note. La requête de rattrapage est dans …
```

⛔ **« En échec » et « reporté » veulent dire la même chose pour l’exploitant : une note qui ne
partira jamais toute seule.** Le retour est passé en `abandonne`, qui est terminal, et le balayage
ne regarde que les `en_cours` — **aucune passe suivante ne le reprendra.** Une panne de modèle de
dix minutes couvre deux passes, soit jusqu’à quarante notes.

⚠️ Chaque échec nomme son retour dans le journal (`balayage — aval de <id> …`). Un identifiant
n’est pas de la parole ; le corps du retour, lui, ne sort jamais dans un journal.

### La requête de rattrapage

Les retours refermés par le filet, sans note :

```sql
select r.id, r.cree_le
  from retours r
  join audit a on a.retour_id = r.id and a.action = 'cloture_balayage'
  left join syntheses s on s.retour_id = r.id
 where s.id is null
 order by r.cree_le;
```

Puis, pour chacun : `pnpm entretien:rejouer -- --retour <id> --synthese`.

⚠️ **`synthetises` dans le journal ne compte pas des notes écrites**, mais des avals qui n’ont pas
jeté — la synthèse d’un retour dicté sans transcript ne produit rien, et c’est normal. Le compte
des notes se prend en base, par la requête ci-dessus.

### ⛔ Ce que le filet a failli coûter

Le filet referme un entretien **dont le panneau est peut-être resté ouvert**. Quelqu’un qui revient
après trente minutes et qui écrit envoie donc sa phrase sur un retour déjà clos. Les deux gardes de
statut du domaine refusaient **avant** d’écrire : la phrase était jetée, et le widget répondait
« C’est parti. ». Depuis, `domaine/entretien/tour.ts` écrit toujours l’apport **avant** de regarder
le statut — `messages` est append-only et ne porte aucune contrainte de statut — puis rejoue l’aval
si la note n’est pas encore partie ([03-Bugs/BUGS_LOG.md](../03-Bugs/BUGS_LOG.md) 009).

## Ce qui doit être surveillé

Trois choses, et une seule est technique :

| Signal | Ce qu’il dit | Seuil |
|---|---|---|
| **Retours par semaine** | si ça tombe à zéro, le produit est mort — bien avant qu’une erreur ne le dise | alerte à 0 sur 7 jours |
| **Part de `source = voix`** | la thèse du produit ([VISION.md](../00-Projet/VISION.md)) | alerte sous 40 % |
| Échecs d’appel au modèle | la boucle d’entretien | alerte au-delà de 5 % |

⚠️ **Les deux premiers ne sont pas de la supervision technique, et c’est le point.** Feedys peut
fonctionner parfaitement et ne servir à personne — c’est le mode de défaillance le plus probable,
et aucune sonde d’erreur ne le verra.

## La sauvegarde

```bash
./scripts/sauvegarde.sh            # un dump, une rotation. C’est tout.
./scripts/verifier-sauvegarde.sh   # le restaure dans une base JETABLE, et compte
```

En cron, une fois par jour — ⚠️ **pas à une heure ronde**, tout le monde sauvegarde à 3 h 00 :

```
12 3 * * * cd /srv/feedys && ./scripts/sauvegarde.sh >> /var/log/feedys-sauvegarde.log 2>&1
```

**Un dump quotidien de Postgres, gardé 7 jours.** Rien d’autre.

### ⚠️ « La note part déjà par email, donc c’est sauvegardé »

C’est l’objection naturelle, et elle est **à moitié juste** — mais dans le mauvais sens.

Ce qui part par email, c’est la **synthèse** : le résumé, l’attendu, le constaté, quelques
citations. C’est-à-dire le **dérivé**, et précisément la seule chose qui se **régénère**
(`pnpm entretien:rejouer --synthese`).

⛔ Ce qui n’existe nulle part ailleurs qu’en base, c’est **le fil brut** : ce que la personne a
réellement dit, ses hésitations, le transcript avant correction. C’est la matière qui sert à régler
le prompt — « on change le prompt, on rejoue sur dix vrais retours, on compare » — et la seule
façon de vérifier qu’une note n’a pas déformé ce que quelqu’un a dit. Le back-office affiche le fil
sans repli exprès, pour ça.

⚠️ **Et la table `produits`.** La perdre n’est pas relancer une commande : c’est retourner voir le
développeur de chaque logiciel hôte pour qu’il change sa ligne de `<script>` et sa signature
d’identité, **dans son logiciel à lui**.

### Ce qui n’est pas sauvegardé, et pourquoi

Le volume `feedys-stockage` — les captures, et l’audio le jour où il y en aura. La capture est un
**aide-mémoire, pas une preuve** ([01-Specs/widget.md](../01-Specs/widget.md)), et aujourd’hui le
widget envoie un transcript, pas de l’audio : le volume ne porte donc rien d’irremplaçable.

⛔ **Ça change le jour où Whisper arrive** ([ROADMAP](../00-Projet/ROADMAP.md) ④) : l’audio devient
alors la source, et le volume devient aussi précieux que la base. En attendant, si on veut le
prendre quand même :

```bash
docker run --rm -v feedys-stockage:/s -v "$PWD/sauvegardes":/out alpine   tar czf /out/stockage-$(date +%Y%m%d).tgz -C /s .
```

### ⛔ Une sauvegarde jamais restaurée n’existe pas

`sauvegarde.sh` vérifie tous les jours que le fichier **commence par `PGDMP`** — un dump interrompu
ou un message d’erreur écrit à sa place ressemblent sinon à une sauvegarde valide dans la liste. Il
écrit dans un fichier `.partiel` renommé à la fin, et ⛔ **il ne fait la rotation qu’après un dump
valide** : supprimer d’abord est la façon classique de se retrouver sans rien le jour où la
sauvegarde échoue, c’est-à-dire le seul jour qui compte.

Mais ça ne prouve pas qu’on peut restaurer. `verifier-sauvegarde.sh` le fait pour de vrai : il crée
une base jetable, y restaure le dernier dump, compte les lignes table par table, et détruit la base
— ⛔ y compris si la restauration échoue au milieu. **Zéro message restauré est un échec**, parce
que c’est exactement ce qu’un dump plausible et vide donnerait.

⚠️ À jouer **une fois avant la première mise en service**, et le jour où l’on change quoi que ce
soit à la sauvegarde. Ce qu’il imprime entre dans `03-Bugs/MISE_EN_SERVICE.md`.

## Ce qui n’est pas là, délibérément

- **Pas de staging.** Un dépôt d’une personne, un produit interne. La CI et le `healthcheck` du
  proxy tiennent le rôle.
- **Pas de file, pas de worker, pas de cache, pas de temps réel.** Voir
  [architecture.md](architecture.md) §Ce qui est délibérément absent.
- **Pas d’autoscaling.** Quelques dizaines de retours par jour.

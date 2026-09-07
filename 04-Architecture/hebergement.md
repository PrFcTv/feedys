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

```bash
docker build -t feedys:1.4.0 --build-arg FEEDYS_VERSION=1.4.0 .
docker compose -f docker-compose.production.yml up -d
```

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

### 5 · L’identité signée

⚠️ Facultative, et **on la branche quand même** : sans elle, un retour arrive sans auteur, et on
ne peut ni revenir vers la personne ni pondérer selon son métier ([D-005](../00-Projet/DECISIONS_LOG.md)).

- [ ] le serveur de l’hôte signe `{ ref, nom, role, exp }` avec le secret — la recette est dans le
      [README](../README.md) §Attacher une identité ;
- [ ] `window.feedys` est posé **avant** la balise du widget ;
- [ ] un premier retour d’essai porte `identite_verifiee = true` au back-office.
      ⚠️ `false` n’est pas un rejet — le retour est accepté quand même —, mais c’est le signe
      que la signature ne colle pas.

### 6 · Les dix minutes qui suivent

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

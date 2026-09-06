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

### La procédure, une fois, dans `psql`

⚠️ En production la base ne publie aucun port :
`docker compose -f docker-compose.production.yml exec postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"`.

```sql
-- Le rôle qui SERT. ⚠️ `inherit` explicite : sans lui, il faudrait un `set role`
-- à chaque connexion, et les GRANT de feedys_app ne s’appliqueraient pas.
create role feedys_service login password '…' inherit in role feedys_app;
```

Puis, dans l’environnement du conteneur (`.env.production`, hors dépôt) :

```
DATABASE_URL=postgresql://feedys_service:…@postgres:5432/feedys
DATABASE_URL_MIGRATIONS=postgresql://feedys_proprietaire:…@postgres:5432/feedys
```

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
```

C’est la seule façon de savoir si le garde-fou est actif : sans cette ligne, un `DATABASE_URL` mal
configuré ne produit **ni erreur, ni test rouge**.

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
- [ ] `feedys.<domaine>/widget.js` se télécharge depuis l’extérieur, en **brotli ou gzip**.

### 2 · ⛔ La restauration, une fois, pour de vrai

⛔ **Avant la pose, pas après.** Une sauvegarde jamais restaurée n’existe pas (§La sauvegarde).

- [ ] prendre un dump, le restaurer **dans une base jetable**, et compter les `messages` ;
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

Un dump quotidien de Postgres, plus le volume de stockage. Rétention 30 jours.

⚠️ **Ce qu’on protège, ce sont les `messages`** — la parole des gens, qui ne se reconstitue pas.
Les synthèses se régénèrent depuis le fil ; les captures sont un confort. La restauration se teste
une fois, à la mise en service, sinon elle n’existe pas.

## Ce qui n’est pas là, délibérément

- **Pas de staging.** Un dépôt d’une personne, un produit interne. La CI et le `healthcheck` du
  proxy tiennent le rôle.
- **Pas de file, pas de worker, pas de cache, pas de temps réel.** Voir
  [architecture.md](architecture.md) §Ce qui est délibérément absent.
- **Pas d’autoscaling.** Quelques dizaines de retours par jour.

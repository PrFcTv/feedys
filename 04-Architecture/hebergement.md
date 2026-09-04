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
| `DATABASE_URL` | Postgres |
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
back-office affiche « dev ». Aucune n’empêche de servir — **un retour qui arrive sans email est un
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

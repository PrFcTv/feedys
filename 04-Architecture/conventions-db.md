# Base de données

## Les règles

- **Avant toute modification de schéma** : lire la structure réelle, lister les tables et colonnes
  impactées, proposer la migration, puis seulement écrire. **Une seule tâche DB par session.**
- `db/migrations/*.sql` est la **source de vérité**. SQL brut, idempotent, transactionnel, ordonné
  par nom de fichier, appliqué **au démarrage du conteneur**, avant le serveur. Un échec de
  migration fait échouer le démarrage.
- ⛔ **`prisma migrate` n’est jamais utilisé.** `prisma/schema.prisma` est un **miroir**, mis à
  jour à la main pour refléter la migration.
- snake_case en base, `@map`/`@@map` côté Prisma. Le TypeScript parle le [glossaire](../02-Metier/glossaire.md).
- Socle de toute table : `id` (cuid), `cree_le`, `maj_le`.
- ⛔ **Jamais de colonne `metadata` ou `extras` JSON fourre-tout.** Une colonne nullable typée est
  gratuite sur Postgres. `jsonb` est réservé au réellement non structuré : la synthèse produite par
  le modèle, le contexte navigateur brut. Jamais à un champ qu’on filtrera.
- ⛔ **Jamais `ON DELETE CASCADE`** sans justification écrite dans la migration.
- ⛔ **Jamais de suppression de colonne ou de table** sans migration explicite et sauvegarde.
- **Une migration appliquée ne se réécrit pas**, commentaires compris. Le registre porte son
  sha256 ; le runner arrêterait le démarrage sur « la base et le dépôt ont divergé ».

## ⛔ Zone gelée : `audit`

Append-only. Aucun `UPDATE`, aucun `DELETE`, jamais. Les privilèges du rôle applicatif sur cette
table sont `SELECT, INSERT` et rien d’autre.

## ⛔ Ce qu’on n’efface pas : la parole

**Le texte d’un `message` ne se modifie jamais et ne se supprime jamais.** Ni par le back-office,
ni par le MCP, ni par une correction de typo.

Ce n’est pas une contrainte technique, c’est le contrat du produit : quelqu’un a dit quelque
chose, et personne ne réécrit ce qu’il a dit. Ce qui se corrige à la main, c’est le `type` et la
`zone` d’un retour — des étiquettes, pas de la parole.

Un retour qui ne mérite rien passe en `ecarte`. Il n’est pas détruit.

## Le schéma

```
produits ──┬─< retours ──┬─< messages
           │             ├─── contextes   (1–1)
           │             ├─── syntheses   (1–1, produite en fin d’entretien)
           │             ├─< notifications
           │             └─< audit         ⛔ zone gelée
```

### `produits`

Un logiciel métier qui embarque le widget. Voir [D-005](../00-Projet/DECISIONS_LOG.md).

| Colonne | Type | Note |
|---|---|---|
| `id` | `text` PK | cuid |
| `nom` | `text` | « VictorIA » |
| `domaine` | `text` | origine autorisée — sert au contrôle CORS |
| `cle_publique` | `text` UNIQUE | `fdy_pub_…` — **publique par nature**, elle est dans le HTML |
| `secret_hash` | `text` | argon2 du secret. ⛔ Le secret en clair n’est **jamais** stocké |
| `actif` | `boolean` | un produit inactif fait répondre 404 au widget |

### `retours`

| Colonne | Type | Note |
|---|---|---|
| `id` | `text` PK | cuid — sert aussi d’URL courte `/r/:id` |
| `produit_id` | `text` FK | ⛔ **toute requête est bornée par lui**, jamais par un paramètre client |
| `auteur_ref` | `text` NULL | l’identifiant chez l’hôte |
| `auteur_nom` | `text` NULL | |
| `auteur_role` | `text` NULL | utile pour lire le retour : un gestionnaire et un comptable ne butent pas sur la même chose |
| `identite_verifiee` | `boolean` | `false` si l’hôte n’a pas signé. Le retour est accepté quand même |
| `statut` | `statut_retour` | `en_cours` par défaut |
| `type` | `type_retour` NULL | rempli par la synthèse, **corrigeable à la main** |
| `titre` | `text` NULL | idem |
| `zone` | `text` NULL | idem |
| `source` | `source_retour` | `voix` ou `texte` — on veut mesurer si le pari de la parole tient |
| `envoye_le` | `timestamptz` NULL | |

⚠️ **`source` n’est pas décoratif** : c’est la mesure du pari du produit
([VISION.md](../00-Projet/VISION.md)). Si 90 % des retours sont en `texte`, la thèse est fausse.

### `messages`

Le fil de l’entretien, un tour par ligne.

| Colonne | Type | Note |
|---|---|---|
| `retour_id` | `text` FK | |
| `ordre` | `integer` | 0, 1, 2… — ⛔ pas de tri sur `cree_le`, deux tours peuvent partager la seconde |
| `role` | `role_message` | `collaborateur` ou `bot` |
| `texte` | `text` | ⛔ **immuable** |
| `transcript_brut` | `text` NULL | avant toute correction. On garde les hésitations : elles portent du sens |
| `audio_chemin` | `text` NULL | quand l’audio est envoyé plutôt qu’un transcript |
| `motif` | `text` NULL | pourquoi le bot a choisi cette question. ⛔ Jamais affiché au collaborateur |

### `contextes`

Un par retour. Ce que le widget joint tout seul, et **la liste est close** — voir
[01-Specs/widget.md].

`url` · `titre_page` · `ecran` · `selecteur_dom` · `navigateur` · `systeme` · `viewport_l` ·
`viewport_h` · `capture_chemin` · `fuseau` · `agent_brut` (`jsonb`, le seul champ légitimement non
structuré).

### `syntheses`

| Colonne | Type | Note |
|---|---|---|
| `retour_id` | `text` FK UNIQUE | une seule synthèse par retour |
| `contenu` | `jsonb` | l’objet de [01-Specs/synthese.md]. ⚠️ `jsonb` **justifié** : c’est une sortie de modèle qu’on ne filtre pas |
| `modele` | `text` | l’identifiant exact. Sans lui, impossible de comprendre une régression de qualité |
| `confiance` | `confiance_synthese` | **extrait** du jsonb en colonne typée — on filtre dessus |
| `jetons_entree`, `jetons_sortie` | `integer` | ce que ça coûte |

⚠️ **`confiance` est dupliquée hors du `jsonb`** parce qu’on filtre dessus. C’est la seule
extraction admise, et elle illustre la règle : ce qu’on interroge est une colonne, ce qu’on lit
peut rester dans le document.

### `notifications`

`retour_id` · `canal` (`email` au MVP) · `destinataire` · `statut` (`en_attente`, `envoye`,
`echoue`) · `erreur` · `envoye_le`.

⚠️ **Un échec d’envoi ne perd pas le retour** : il est déjà en base, lisible au back-office et par
MCP. La notification est un confort, pas le chemin.

### `audit` — ⛔ zone gelée

`retour_id` · `acteur` (`systeme`, `bot`, `developpeur`) · `action` · `detail` (`jsonb`).

Journalise les changements de statut et les corrections d’étiquette. Pas les lectures.

## Les enums

```sql
create type statut_retour as enum
  ('en_cours','abandonne','envoye','lu','traite','ecarte');
create type type_retour        as enum ('bug','idee','question','gene');
create type source_retour      as enum ('voix','texte');
create type role_message       as enum ('collaborateur','bot');
create type confiance_synthese as enum ('haute','moyenne','basse');
create type canal_notification as enum ('email');
```

⛔ **Il n’y a ni priorité, ni sévérité, ni score**, et il n’y en aura pas. Arbitrer est le travail
du développeur ; un modèle qui note à sa place fabrique une fausse objectivité qu’on finit par
suivre.

## Les index qui comptent

```sql
create index on retours (produit_id, statut, cree_le desc);  -- la liste du back-office
create index on retours (produit_id, type, cree_le desc);    -- le filtre du MCP
create index on messages (retour_id, ordre);                 -- le fil, dans l’ordre
create unique index on produits (cle_publique);              -- vérifié à chaque requête widget
```

## Les privilèges

Le rôle applicatif reçoit `SELECT, INSERT, UPDATE` sur les tables métier, **et `SELECT, INSERT`
seulement sur `audit`**.

⛔ **Aucun `GRANT DELETE` n’est accordé au MVP.** Le jour où une suppression sera nécessaire, elle
sera accordée **table par table**, avec sa justification en commentaire dans la migration qui
l’ouvre.

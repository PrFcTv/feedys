-- 0001_socle.sql — le socle de Feedys
--
-- Source de vérité du schéma : 04-Architecture/conventions-db.md.
-- Sept tables, six enums, quatre index, et les privilèges du rôle applicatif.
--
-- ⛔ Une migration appliquée ne se réécrit pas, commentaires compris. Le registre
--    porte le sha256 de ce fichier et le démarrage s’arrête sur « la base et le
--    dépôt ont divergé ». Pour changer quelque chose : une migration de plus.
--
-- ⚠️ Ce fichier ne porte ni BEGIN ni COMMIT : le runner enveloppe chaque migration
--    dans sa propre transaction. À la main : psql --single-transaction -f.
--
-- ⛔ Aucune clé étrangère n’est ON DELETE CASCADE. Rien n’est supprimé dans Feedys :
--    un retour qui ne mérite rien passe en 'ecarte', il n’est pas détruit. Le jour
--    où une suppression sera nécessaire, elle s’écrira table par table, avec sa
--    justification, dans la migration qui l’ouvre.


-- ─────────────────────────────────────────────────────────────────────────────
-- Le rôle applicatif
-- ─────────────────────────────────────────────────────────────────────────────
--
-- feedys_app est un rôle de GROUPE, sans connexion propre : il ne porte que des
-- privilèges.
--
-- ⚠️ En production, DATABASE_URL doit utiliser un rôle de login MEMBRE de
--    feedys_app, et surtout PAS le propriétaire des tables. Un propriétaire
--    contourne tous les GRANT : le garde-fou « aucun DELETE nulle part » ne
--    vaudrait alors plus rien, et rien ne le signalerait.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'feedys_app') then
    create role feedys_app nologin;
  end if;
end
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- Les six enums
-- ─────────────────────────────────────────────────────────────────────────────
--
-- ⛔ Il n’y a ni priorité, ni sévérité, ni score, et il n’y en aura pas. Arbitrer
--    est le travail du développeur ; un modèle qui note à sa place fabrique une
--    fausse objectivité qu’on finit par suivre.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'statut_retour') then
    create type statut_retour as enum
      ('en_cours', 'abandonne', 'envoye', 'lu', 'traite', 'ecarte');
  end if;

  if not exists (select 1 from pg_type where typname = 'type_retour') then
    create type type_retour as enum ('bug', 'idee', 'question', 'gene');
  end if;

  if not exists (select 1 from pg_type where typname = 'source_retour') then
    create type source_retour as enum ('voix', 'texte');
  end if;

  if not exists (select 1 from pg_type where typname = 'role_message') then
    create type role_message as enum ('collaborateur', 'bot');
  end if;

  if not exists (select 1 from pg_type where typname = 'confiance_synthese') then
    create type confiance_synthese as enum ('haute', 'moyenne', 'basse');
  end if;

  if not exists (select 1 from pg_type where typname = 'canal_notification') then
    create type canal_notification as enum ('email');
  end if;
end
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- produits — un logiciel métier qui embarque le widget
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists produits (
  id            text         primary key,
  nom           text         not null,
  domaine       text         not null,
  cle_publique  text         not null,
  secret_hash   text         not null,
  actif         boolean      not null default true,
  cree_le       timestamptz  not null default now(),
  maj_le        timestamptz  not null default now()
);

comment on column produits.cle_publique is
  'fdy_pub_… — publique par nature : elle est dans le HTML de l’hôte.';
comment on column produits.secret_hash is
  'argon2 du secret. ⛔ Le secret en clair n’est jamais stocké.';
comment on column produits.domaine is
  'Origine autorisée — sert au contrôle CORS des routes d’API.';
comment on column produits.actif is
  'Un produit inactif fait répondre 404 au widget.';


-- ─────────────────────────────────────────────────────────────────────────────
-- retours — ce que quelqu’un a voulu dire
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists retours (
  id                 text           primary key,
  produit_id         text           not null references produits (id),
  auteur_ref         text,
  auteur_nom         text,
  auteur_role        text,
  identite_verifiee  boolean        not null default false,
  statut             statut_retour  not null default 'en_cours',
  type               type_retour,
  titre              text,
  zone               text,
  source             source_retour  not null,
  envoye_le          timestamptz,
  cree_le            timestamptz    not null default now(),
  maj_le             timestamptz    not null default now()
);

comment on column retours.produit_id is
  '⛔ Toute requête est bornée par lui, jamais par un paramètre client.';
comment on column retours.identite_verifiee is
  'false si l’hôte n’a pas signé. Le retour est accepté quand même : on ne perd jamais une parole pour un problème d’identité.';
comment on column retours.source is
  '⚠️ Pas décoratif : c’est la mesure du pari du produit. Si 90 % des retours sont en texte, la thèse est fausse.';
comment on column retours.auteur_role is
  'Utile pour lire le retour : un gestionnaire et un comptable ne butent pas sur la même chose.';
comment on column retours.type is
  'Rempli par la synthèse, corrigeable à la main. Une étiquette, pas de la parole.';


-- ─────────────────────────────────────────────────────────────────────────────
-- messages — le fil de l’entretien, un tour par ligne
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists messages (
  id               text          primary key,
  retour_id        text          not null references retours (id),
  ordre            integer       not null,
  role             role_message  not null,
  texte            text          not null,
  transcript_brut  text,
  audio_chemin     text,
  motif            text,
  cree_le          timestamptz   not null default now(),
  maj_le           timestamptz   not null default now()
);

comment on table messages is
  '⛔ La parole. Le texte d’un message ne se modifie jamais et ne se supprime jamais — ni par le back-office, ni par le MCP, ni pour corriger une typo. Ce n’est pas une contrainte technique, c’est le contrat du produit.';
comment on column messages.ordre is
  '0, 1, 2… ⛔ Pas de tri sur cree_le : deux tours peuvent partager la seconde.';
comment on column messages.transcript_brut is
  'Avant toute correction. On garde les hésitations : elles portent du sens.';
comment on column messages.motif is
  'Pourquoi le bot a choisi cette question. ⛔ Jamais affiché au collaborateur.';


-- ─────────────────────────────────────────────────────────────────────────────
-- contextes — ce que le widget joint tout seul (1–1)
-- ─────────────────────────────────────────────────────────────────────────────
--
-- ⛔ La liste est CLOSE : 01-Specs/widget.md §Ce que le widget joint tout seul.
--    Le dépôt est public, elle doit pouvoir être lue par n’importe qui sans gêne.
--
-- Tout est nullable sauf l’URL : la collecte est en échec-doux, une capture qui
-- rate n’empêche jamais l’envoi.

create table if not exists contextes (
  id              text         primary key,
  retour_id       text         not null references retours (id),
  url             text         not null,
  titre_page      text,
  ecran           text,
  selecteur_dom   text,
  navigateur      text,
  systeme         text,
  viewport_l      integer,
  viewport_h      integer,
  capture_chemin  text,
  fuseau          text,
  agent_brut      jsonb,
  cree_le         timestamptz  not null default now(),
  maj_le          timestamptz  not null default now(),

  constraint contextes_retour_uniq unique (retour_id)
);

comment on column contextes.agent_brut is
  'Le contexte navigateur brut — le seul champ légitimement non structuré de cette table.';


-- ─────────────────────────────────────────────────────────────────────────────
-- syntheses — la note que le développeur lit (1–1)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists syntheses (
  id             text                primary key,
  retour_id      text                not null references retours (id),
  contenu        jsonb               not null,
  modele         text                not null,
  confiance      confiance_synthese  not null,
  jetons_entree  integer,
  jetons_sortie  integer,
  cree_le        timestamptz         not null default now(),
  maj_le         timestamptz         not null default now(),

  constraint syntheses_retour_uniq unique (retour_id)
);

comment on column syntheses.contenu is
  '⚠️ jsonb justifié : c’est une sortie de modèle qu’on lit et qu’on ne filtre pas.';
comment on column syntheses.confiance is
  '⚠️ Dupliquée hors du jsonb parce qu’on filtre dessus. C’est la seule extraction admise, et elle illustre la règle : ce qu’on interroge est une colonne, ce qu’on lit peut rester dans le document.';
comment on column syntheses.modele is
  'L’identifiant exact du modèle. Sans lui, une régression de qualité est inexplicable.';
comment on column syntheses.jetons_entree is
  'Nullable : un fournisseur qui ne rapporte pas sa consommation ne doit pas faire échouer la synthèse.';


-- ─────────────────────────────────────────────────────────────────────────────
-- notifications — la note est partie, ou pas
-- ─────────────────────────────────────────────────────────────────────────────
--
-- ⚠️ statut est un text sous contrainte et non un enum : conventions-db.md en
--    énumère six, et celui-ci n’en fait pas partie. On s’en tient à six.

create table if not exists notifications (
  id            text                primary key,
  retour_id     text                not null references retours (id),
  canal         canal_notification  not null default 'email',
  destinataire  text                not null,
  statut        text                not null default 'en_attente',
  erreur        text,
  envoye_le     timestamptz,
  cree_le       timestamptz         not null default now(),
  maj_le        timestamptz         not null default now(),

  constraint notifications_statut_connu
    check (statut in ('en_attente', 'envoye', 'echoue'))
);

comment on table notifications is
  '⚠️ Un échec d’envoi ne perd pas le retour : il est déjà en base, lisible au back-office et par MCP. La notification est un confort, pas le chemin.';


-- ─────────────────────────────────────────────────────────────────────────────
-- audit — ⛔ ZONE GELÉE
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Append-only. Aucun UPDATE, aucun DELETE, jamais. Le rôle applicatif n’en a pas
-- les moyens : ses privilèges sur cette table sont SELECT, INSERT et rien d’autre.
--
-- ⚠️ acteur est un text sous contrainte, pour la même raison que
--    notifications.statut : il n’y a que six enums.

create table if not exists audit (
  id         text         primary key,
  retour_id  text         not null references retours (id),
  acteur     text         not null,
  action     text         not null,
  detail     jsonb,
  cree_le    timestamptz  not null default now(),
  maj_le     timestamptz  not null default now(),

  constraint audit_acteur_connu
    check (acteur in ('systeme', 'bot', 'developpeur'))
);

comment on table audit is
  '⛔ Zone gelée. Append-only : aucun UPDATE, aucun DELETE, jamais. Journalise les changements de statut et les corrections d’étiquette. Pas les lectures.';


-- ─────────────────────────────────────────────────────────────────────────────
-- Les quatre index qui comptent
-- ─────────────────────────────────────────────────────────────────────────────

-- la liste du back-office
create index if not exists retours_produit_statut_cree_idx
  on retours (produit_id, statut, cree_le desc);

-- le filtre du MCP
create index if not exists retours_produit_type_cree_idx
  on retours (produit_id, type, cree_le desc);

-- le fil, dans l’ordre
create index if not exists messages_retour_ordre_idx
  on messages (retour_id, ordre);

-- vérifié à chaque requête widget. L’index unique PORTE la contrainte : y ajouter
-- un UNIQUE de colonne créerait le même objet en double.
create unique index if not exists produits_cle_publique_uniq
  on produits (cle_publique);


-- ─────────────────────────────────────────────────────────────────────────────
-- Les privilèges
-- ─────────────────────────────────────────────────────────────────────────────
--
-- ⛔ AUCUN GRANT DELETE, sur aucune table. Le jour où une suppression sera
--    nécessaire, elle sera accordée table par table, avec sa justification en
--    commentaire dans la migration qui l’ouvre.

grant usage on schema public to feedys_app;

grant select, insert, update on
  produits,
  retours,
  messages,
  contextes,
  syntheses,
  notifications
to feedys_app;

-- ⛔ Zone gelée : lire et ajouter, rien d’autre.
grant select, insert on audit to feedys_app;

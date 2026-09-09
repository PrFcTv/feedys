-- 0010_indices.sql — les indices techniques relevés avant l’ouverture (P-028)
--
-- Source de vérité du schéma : 04-Architecture/conventions-db.md.
--
-- Crée la table `indices` — ce que le navigateur a relevé dans la page de
-- l’hôte avant que quelqu’un n’ouvre la bulle — et ajoute sur `produits` :
-- - `url_observabilite` : le gabarit d’URL qui rend une référence de
--   corrélation cliquable, exactement comme `url_forge` rend un SHA cliquable.
--
-- ⛔ UNE TABLE, PAS UNE COLONNE `jsonb` SUR `contextes`. Un indice est
--    parfaitement structuré — un genre, un nom, un statut, un chemin — et
--    `jsonb` est réservé au réellement non structuré (conventions-db.md). Et
--    c’est une LISTE bornée à trois : elle ne rentre pas en colonnes.
--
-- ⛔ IL N’Y A PAS DE COLONNE `message`, ET C’EST LE POINT DE [D-026].
--    `error.message` est du texte libre écrit par le code de l’hôte ; il porte
--    régulièrement des noms de personnes et de dossiers, et ce dépôt est
--    public. La colonne n’existe pas : on ne peut donc pas l’y écrire par
--    accident un jour où quelqu’un trouverait ça pratique.
--
-- ⚠️ `ecart_ms` et non `survenu_le` : un écart se lit sans horloge de
--    référence, et l’horloge d’un poste peut être fausse de plusieurs heures
--    (même raison que `contextes.horodatage`, indicatif face à `cree_le`).
--
-- ⛔ Pas de `ON DELETE CASCADE`, comme partout ailleurs dans ce schéma. La
--    clé étrangère est en `no action` : un retour ne se supprime pas, et si
--    cela devait arriver un jour, ce serait une décision écrite, pas un effet
--    de bord d’une autre suppression.
--
-- ⚠️ Ce fichier ne porte ni BEGIN ni COMMIT : le runner enveloppe chaque
--    migration dans sa propre transaction.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'genre_indice') then
    -- ⛔ Énumération close, et elle l’est aussi dans le contrat de transport
    --    (packages/widget/src/transport.ts §GENRES_INDICE).
    create type genre_indice as enum ('js', 'http');
  end if;
end
$$;

create table if not exists indices (
  id         text primary key,
  retour_id  text not null references retours (id) on delete no action on update no action,
  -- ⚠️ L’ordre du relevé, du plus ancien au plus récent. Pas de tri sur
  --    `cree_le` : les trois lignes sont écrites dans la même transaction, à
  --    la même microseconde, et l’ordre s’y perdrait.
  ordre      integer not null,
  genre      genre_indice not null,
  -- Le NOM de l’exception — `TypeError`. ⛔ Jamais son message.
  nom        text,
  -- La première trame de pile, normalisée.
  trame      text,
  statut     integer,
  chemin     text,
  methode    text,
  reference  text,
  ecart_ms   integer,
  cree_le    timestamptz not null default now(),
  maj_le     timestamptz not null default now()
);

comment on table indices is
  'Ce que le navigateur a relevé dans la page de l’hôte avant l’ouverture de la bulle : exceptions non capturées et requêtes revenues en erreur. ⛔ Jamais le message d’une exception, jamais un corps de réponse (P-028, D-026).';

comment on column indices.nom is
  'Le nom de l’exception — TypeError, AbortError. ⛔ JAMAIS son message : texte libre de l’hôte, il porte des noms de personnes et de dossiers (D-026).';

comment on column indices.trame is
  'La première trame de pile, réduite à fonction (fichier:ligne:colonne). ⛔ Jamais la pile entière, jamais la ligne de message qui la précède (P-028).';

comment on column indices.chemin is
  'Le chemin de la requête, segments identifiants remplacés par :id, requête retirée. Sans cette normalisation le chemin serait de la donnée métier — /api/dossiers/4417/valider porte un numéro de dossier (D-026).';

comment on column indices.methode is
  'La méthode HTTP. ⚠️ NULL pour un indice relevé passivement : PerformanceObserver ne la donne pas. Seul un indice poussé par l’hôte en porte une (P-028).';

comment on column indices.reference is
  'L’identifiant de corrélation vers l’outil d’observabilité de l’hôte (Sentry, trace, request-id). ⛔ Opaque : Feedys ne l’interprète jamais et n’appelle jamais l’outil — même doctrine que le SHA d’un correctif face à la forge (D-024, D-026).';

comment on column indices.ecart_ms is
  'Depuis combien de temps l’indice avait été relevé quand la bulle a été ouverte. ⚠️ Un écart et non un horodatage : une horloge de poste peut être fausse de plusieurs heures (P-028).';

-- ⚠️ Le seul chemin de lecture : « les indices de CE retour, dans l’ordre ».
--    La fiche, l’entretien et la synthèse lisent tous les trois comme ça.
create unique index if not exists indices_retour_ordre_uniq
  on indices (retour_id, ordre);

do $$
begin
  -- ⛔ Le plafond de trois est appliqué par le contrat de transport, donc par
  --    le serveur, avant d’arriver ici. Ce CHECK est la ceinture : il empêche
  --    qu’un futur chemin d’écriture — un import, un rejeu, une main sur psql —
  --    transforme un retour en déversoir de journal sans que rien ne le dise.
  if not exists (select 1 from pg_constraint where conname = 'indices_ordre_borne') then
    alter table indices
      add constraint indices_ordre_borne check (ordre >= 0 and ordre < 3);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'indices_longueurs') then
    alter table indices
      add constraint indices_longueurs check (
        (nom is null or char_length(nom) <= 120)
        and (trame is null or char_length(trame) <= 300)
        and (chemin is null or char_length(chemin) <= 300)
        and (methode is null or char_length(methode) <= 10)
        and (reference is null or char_length(reference) <= 200)
      );
  end if;

  -- ⚠️ La FORME de chaque genre, en base comme dans le contrat : un `js` sans
  --    nom et un `http` sans statut ni chemin sont des lignes vides, et une
  --    ligne vide dans la fiche est pire qu’une absence de ligne.
  if not exists (select 1 from pg_constraint where conname = 'indices_genre_complet') then
    alter table indices
      add constraint indices_genre_complet check (
        (genre = 'js' and nom is not null)
        or (genre = 'http' and statut is not null and chemin is not null)
      );
  end if;

  if not exists (select 1 from pg_constraint where conname = 'indices_statut_http') then
    alter table indices
      add constraint indices_statut_http
      check (statut is null or (statut >= 100 and statut <= 599));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'indices_ecart_borne') then
    alter table indices
      add constraint indices_ecart_borne
      check (ecart_ms is null or (ecart_ms >= 0 and ecart_ms <= 86400000));
  end if;
end
$$;

alter table produits
  add column if not exists url_observabilite text;

comment on column produits.url_observabilite is
  'Le gabarit d’URL de l’outil d’observabilité de l’hôte, où {{ref}} est remplacé par la référence d’un indice (pnpm produit:creer --observabilite). ⛔ Feedys ne l’appelle JAMAIS : il compose un lien et s’arrête là, comme pour url_forge (D-024, D-026).';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'produits_url_observabilite_longueur'
  ) then
    alter table produits
      add constraint produits_url_observabilite_longueur
      check (url_observabilite is null or char_length(url_observabilite) <= 500);
  end if;
end
$$;

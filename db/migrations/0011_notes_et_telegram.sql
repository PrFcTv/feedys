-- 0011_notes_et_telegram.sql — aucune note ne se perd, et Telegram prévient (P-030)
--
-- Source de vérité du schéma : 04-Architecture/conventions-db.md.
--
-- Trois choses, et une migration parce qu’elles ont une seule cause
-- (03-Bugs/BUGS_LOG.md 019, D-030) :
--
-- 1. `canal_notification` gagne `telegram` — le canal recommandé ;
-- 2. `retours` gagne quatre colonnes qui comptent les REPRISES de la synthèse
--    par le filet. Une panne du modèle ne perd plus la note pour toujours :
--    le filet la redemande, espacée, plafonnée, et le dit quand il renonce ;
-- 3. `alertes` : l’état qui fait qu’un incident prévient UNE fois, pas à
--    chaque passe du filet.
--
-- ⚠️ `ALTER TYPE … ADD VALUE` N’EST PAS UTILISABLE DANS LA TRANSACTION QUI
--    L’AJOUTE, et le runner enveloppe chaque fichier dans la sienne
--    (apps/serveur/infra/base/migrations.ts). ⛔ Rien dans CE fichier n’emploie
--    donc la valeur 'telegram' : ni CHECK, ni défaut, ni index partiel qui la
--    nommerait. Le code s’en sert après le démarrage, une fois tout validé.
--
-- ⛔ Jamais de colonne metadata fourre-tout : quatre colonnes nullables
--    typées, gratuites sur Postgres.
--
-- ⛔ Aucune clé étrangère en cascade, aucun GRANT DELETE.
--
-- ⚠️ Ce fichier ne porte ni BEGIN ni COMMIT : le runner enveloppe chaque
--    migration dans sa propre transaction.


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Le canal
-- ─────────────────────────────────────────────────────────────────────────────

alter type canal_notification add value if not exists 'telegram';


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Les reprises de la synthèse
-- ─────────────────────────────────────────────────────────────────────────────
--
-- ⚠️ `synthese_reprises is null` veut dire « le filet n’y est jamais revenu » :
--    c’est le cas de toute note écrite du premier coup, c’est-à-dire de
--    presque toutes. La tentative ORDINAIRE, celle de la fin d’entretien, ne se
--    compte pas ici : elle n’est pas une reprise.
--
-- ⚠️ `synthese_reprise_le` est à la fois l’ESPACEMENT et la RÉSERVATION : le
--    filet la pose dans le même `update … returning` qui choisit le retour,
--    comme la clôture du balayage (D-018). Deux conteneurs ne reprennent donc
--    pas le même retour dans la même passe.
--
-- ⛔ `synthese_impossible_le` est TERMINAL pour le filet, jamais pour un humain :
--    le bouton « Refaire la note » du back-office ignore ces quatre colonnes et
--    n’y écrit rien. `syntheses_retour_uniq` reste le seul garde-fou contre la
--    double note.
--
-- ⚠️ Aucun index : quelques dizaines de retours par jour, et la question « clos,
--    sans note, pas encore abandonné » se pose sur une poignée de lignes.

alter table retours
  add column if not exists synthese_reprises integer,
  add column if not exists synthese_reprise_le timestamptz,
  add column if not exists synthese_impossible_le timestamptz,
  add column if not exists synthese_impossible_motif text;

comment on column retours.synthese_reprises is
  'Combien de fois le filet a redemandé la note après un échec. NULL = jamais : la note est partie du premier coup, ou elle n’a pas encore été reprise (P-030).';

comment on column retours.synthese_reprise_le is
  'La dernière reprise par le filet. Sert d’espacement ET de réservation : elle est posée dans le même update qui choisit le retour (P-030, D-018).';

comment on column retours.synthese_impossible_le is
  'Le filet a renoncé à produire la note. ⛔ Terminal pour le filet seulement : « Refaire la note » reste possible à la main, et la parole est intacte (P-030).';

comment on column retours.synthese_impossible_motif is
  'plafond : le modèle n’a pas répondu après toutes les reprises. rien_a_synthetiser : le fil ne contient aucune parole écrite — un retour dicté sans transcript ne produira jamais de note (P-030).';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'retours_synthese_reprises_positif') then
    alter table retours
      add constraint retours_synthese_reprises_positif
      check (synthese_reprises is null or synthese_reprises >= 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'retours_synthese_impossible_motif_connu') then
    alter table retours
      add constraint retours_synthese_impossible_motif_connu
      check (
        synthese_impossible_motif is null
        or synthese_impossible_motif in ('plafond', 'rien_a_synthetiser')
      );
  end if;

  -- ⚠️ Les deux vont ensemble : une date sans motif ne dit pas quoi faire, un
  --    motif sans date ne dit pas depuis quand. `(a is null) = (b is null)` rend
  --    toujours TRUE ou FALSE, jamais NULL — la contrainte ne peut pas être
  --    désarmée (03-Bugs/BUGS_LOG.md 017).
  if not exists (select 1 from pg_constraint where conname = 'retours_synthese_impossible_complet') then
    alter table retours
      add constraint retours_synthese_impossible_complet
      check ((synthese_impossible_le is null) = (synthese_impossible_motif is null));
  end if;
end
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Une notification par retour ET PAR CANAL
-- ─────────────────────────────────────────────────────────────────────────────
--
-- ⚠️ `dejaEnvoyee` supposait UNE notification par retour, et rien ne le tenait
--    en base. Avec deux canaux, c’est une par canal — et cette fois c’est
--    l’index qui le tient.
--
-- ⚠️ IL NE PEUT PAS ÉCHOUER SUR UNE BASE 1.0.0. `notifier()` n’est appelé
--    qu’après un `enregistrer` réussi, et `syntheses_retour_uniq` rend celui-ci
--    unique par retour : aucune base n’a pu recevoir deux notifications pour le
--    même retour.

create unique index if not exists notifications_retour_canal_uniq
  on notifications (retour_id, canal);


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. alertes — un incident, un message
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Quatre genres, ceux de 04-Architecture/hebergement.md §Ce qui doit être
-- surveillé, plus la note devenue impossible :
--   notes_impossibles  le filet a renoncé à au moins une note ;
--   modele_en_echec    le modèle échoue au-delà du seuil ;
--   aucun_retour       plus aucun retour depuis sept jours ;
--   voix_minoritaire   la part de retours dictés passe sous 40 %.
--
-- ⛔ UNE ALERTE PAR INCIDENT, PAS UNE PAR PASSE. Un filet qui parle toutes les
--    cinq minutes finit par ne plus être lu. L’incident est OUVERT tant que
--    `close_le` est nul, et l’index partiel interdit d’en ouvrir un second du
--    même genre : c’est `insert … on conflict do nothing` qui décide qui
--    prévient, et deux conteneurs ne préviennent pas deux fois.
--
-- ⚠️ EN BASE, ET PAS EN MÉMOIRE : un conteneur qui redémarre retrouve ses
--    incidents ouverts, et ne renvoie pas une alerte déjà partie.
--
-- ⛔ Aucune parole, aucun nom : la table ne porte que des dates et une raison
--    d’échec d’envoi. Le message lui-même n’est pas stocké.

create table if not exists alertes (
  id          text         primary key,
  genre       text         not null,
  ouverte_le  timestamptz  not null default now(),
  close_le    timestamptz,
  envoyee_le  timestamptz,
  erreur      text,
  cree_le     timestamptz  not null default now(),
  maj_le      timestamptz  not null default now(),

  constraint alertes_genre_connu
    check (genre in ('notes_impossibles', 'modele_en_echec', 'aucun_retour', 'voix_minoritaire'))
);

comment on table alertes is
  'Un incident d’exploitation ou d’usage, et s’il a été annoncé. ⛔ Une alerte par incident, pas une par passe du filet (P-030). ⛔ Jamais de parole, jamais de nom.';

comment on column alertes.envoyee_le is
  'L’alerte est arrivée chez Telegram. NULL avec une erreur : elle est restée en console — Telegram absent ou en échec.';

create unique index if not exists alertes_une_ouverte_par_genre
  on alertes (genre)
  where close_le is null;

grant select, insert, update on alertes to feedys_app;

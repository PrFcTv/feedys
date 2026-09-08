-- 0007_correctif.sql — la traçabilité du correctif (P-024)
--
-- Source de vérité du schéma : 04-Architecture/conventions-db.md.
--
-- Ajoute sur la table `retours` :
-- - `correctif_ref`  : ce qui a corrigé — un SHA de commit, ou l’URL d’une PR ;
-- - `correctif_note` : ce qui a été changé, dit à un développeur ;
-- - `correctif_le`   : quand le correctif a été consigné.
--
-- Et sur la table `produits` :
-- - `url_forge` : l’URL du dépôt, qui transforme un SHA nu en lien cliquable.
--
-- ⛔ Jamais de colonne metadata fourre-tout. Quatre colonnes nullables typées,
--    gratuites sur Postgres.
--
-- ⛔ `correctif_note` N’EST PAS `reponse_texte`, et les fusionner serait le
--    défaut de conception que cette migration évite. Deux publics, deux
--    colonnes : `reponse_texte` part au collaborateur, `correctif_note` reste
--    entre développeurs. Envoyer « corrigé dans useTableState » à quelqu’un qui
--    a dit « le tri se remet à zéro », c’est reproduire le guichet que Feedys
--    refuse d’être (01-Specs/retour-au-collaborateur.md).
--
-- ⚠️ La FORME de `correctif_ref` — SHA hexadécimal ou URL https — est vérifiée
--    dans le contrat (packages/mcp/src/contrat.ts), PAS ici. Un CHECK figé en
--    base refuserait demain une forme légitime, et il faudrait une migration
--    pour l’accepter. La base borne la LONGUEUR, ce qui protège la table ; le
--    contrat borne la forme, ce qui guide l’agent avec une phrase lisible.
--
-- ⛔ Et le serveur ne va JAMAIS vérifier chez la forge que ce commit existe :
--    ça y ferait entrer un jeton GitHub, une dépendance réseau et un périmètre
--    qui n’est pas le sien ([D-024](../../00-Projet/DECISIONS_LOG.md)).
--
-- ⚠️ Aucun index : aucune requête ne filtre ni ne trie sur ces colonnes. La
--    fiche et `lire_retour` lisent par `id`, qui est déjà la clé primaire.
--    L’index de 0006 avait un chemin chaud à couvrir ; celui-ci n’en a pas.
--
-- ⚠️ Ce fichier ne porte ni BEGIN ni COMMIT : le runner enveloppe chaque
--    migration dans sa propre transaction.

alter table retours
  add column if not exists correctif_ref text,
  add column if not exists correctif_note text,
  add column if not exists correctif_le timestamptz;

comment on column retours.correctif_ref is
  'Ce qui a corrigé le retour : un SHA de commit (7 à 40 hex) ou une URL https de PR (P-024).';

comment on column retours.correctif_note is
  'Ce qui a été changé, écrit pour un développeur. ⛔ Ne part jamais au collaborateur (P-024).';

comment on column retours.correctif_le is
  'Horodatage de la consignation du correctif — reposé seulement quand le correctif change (P-024).';

alter table produits
  add column if not exists url_forge text;

comment on column produits.url_forge is
  'L’URL du dépôt du produit (https://github.com/org/depot), qui rend un SHA cliquable (P-024).';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'retours_correctif_ref_longueur'
  ) then
    alter table retours
      add constraint retours_correctif_ref_longueur
      check (correctif_ref is null or char_length(correctif_ref) <= 200);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'retours_correctif_note_longueur'
  ) then
    alter table retours
      add constraint retours_correctif_note_longueur
      check (correctif_note is null or char_length(correctif_note) <= 500);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'produits_url_forge_longueur'
  ) then
    alter table produits
      add constraint produits_url_forge_longueur
      check (url_forge is null or char_length(url_forge) <= 500);
  end if;
end
$$;

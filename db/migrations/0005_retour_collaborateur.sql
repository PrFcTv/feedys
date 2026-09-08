-- 0005_retour_collaborateur.sql — le retour au collaborateur (P-020)
--
-- Source de vérité du schéma : 04-Architecture/conventions-db.md.
--
-- Ajoute sur la table `retours` :
-- - `reponse_texte` : le mot court facultatif du développeur (max 500 car.) ;
-- - `reponse_envoyee_le` : posé lors du passage à 'traite' ou 'ecarte' ;
-- - `reponse_lue_le` : posé quand le collaborateur a vu l’accusé.
--
-- ⛔ Jamais de colonne metadata fourre-tout. Trois colonnes nullables typées,
--    gratuites sur Postgres.
--
-- ⚠️ Ce fichier ne porte ni BEGIN ni COMMIT : le runner enveloppe chaque
--    migration dans sa propre transaction.

alter table retours
  add column if not exists reponse_texte text,
  add column if not exists reponse_envoyee_le timestamptz,
  add column if not exists reponse_lue_le timestamptz;

comment on column retours.reponse_texte is
  'Le message facultatif du développeur au collaborateur lors de la prise en compte (max 500 car., P-020).';

comment on column retours.reponse_envoyee_le is
  'Horodatage du passage à traite ou ecarte avec accusé au collaborateur (P-020).';

comment on column retours.reponse_lue_le is
  'Horodatage de la relève et confirmation par le collaborateur (« J’ai vu » dans le widget, P-020).';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'retours_reponse_texte_longueur'
  ) then
    alter table retours
      add constraint retours_reponse_texte_longueur
      check (reponse_texte is null or char_length(reponse_texte) <= 500);
  end if;
end
$$;

-- 0009_reponse_axe.sql — la réponse d’un clic (P-026,
-- [D-025](../../00-Projet/DECISIONS_LOG.md)).
--
-- Source de vérité du schéma : 04-Architecture/conventions-db.md.
--
-- Ajoute sur `messages` :
-- - `axe`        : l’axe fermé sur lequel la personne a répondu d’un clic ;
-- - `valeur_axe` : ce qu’elle a répondu, en VALEUR d’énumération.
--
-- ⛔ POURQUOI LA VALEUR ET PAS SEULEMENT LE TEXTE. `texte` porte déjà « Réponse ·
--    Récurrence — à chaque fois », qui suffit à l’œil et au modèle. Mais la
--    synthèse FIXE `impact` et `recurrence` à partir de cette réponse : elle a
--    besoin de `systematique`, pas d’une phrase à réinterpréter. Relire une
--    valeur dans un libellé serait exactement le genre de déduction que
--    P-025 vient d’interdire pour les gestes.
--
-- ⛔ Ce n’est PAS de la parole. Ces lignes portent `geste = 'reponse_axe'`
--    (0008) et sont donc déjà hors du bassin des citations : le libellé est
--    écrit par le serveur, et la personne ne l’a pas prononcé.
--
-- ⚠️ `valeur_axe` est du texte et non une énumération Postgres, et c’est
--    délibéré : les valeurs d’un axe sont celles de `Synthese` — trois pour la
--    récurrence, trois pour l’ampleur — et une énumération de plus en base
--    aurait figé en SQL une liste dont la source de vérité est le contrat de
--    transport. Le CHECK ci-dessous borne la longueur ; c’est `valeurDAxe` qui
--    décide de l’appartenance, et `axes.test.ts` qui interdit la divergence
--    avec le schéma de la note.
--
-- ⛔ Les deux colonnes vont ensemble ou pas du tout. Un axe sans valeur est un
--    clic perdu ; une valeur sans axe ne se range nulle part.
--
-- ⚠️ Aucun index : personne ne filtre là-dessus. Le fil se lit par `retour_id`,
--    déjà couvert par `messages_retour_ordre_idx`. La part de clics se mesure
--    par un balayage occasionnel, pas par une requête chaude.
--
-- ⚠️ Ce fichier ne porte ni BEGIN ni COMMIT : le runner enveloppe chaque
--    migration dans sa propre transaction.

alter table messages
  add column if not exists axe text,
  add column if not exists valeur_axe text;

comment on column messages.axe is
  'L’axe fermé répondu d’un clic : recurrence ou ampleur. NULL partout ailleurs (P-026, D-025).';

comment on column messages.valeur_axe is
  '⛔ La VALEUR répondue (systematique, ralentit…), pas le libellé. C’est elle qui fixe impact et recurrence dans la note — une valeur ne se réinterprète pas, une phrase si (P-026).';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'messages_axe_complet'
  ) then
    alter table messages
      add constraint messages_axe_complet
      check ((axe is null) = (valeur_axe is null));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'messages_valeur_axe_longueur'
  ) then
    alter table messages
      add constraint messages_valeur_axe_longueur
      check (valeur_axe is null or char_length(valeur_axe) <= 40);
  end if;

  -- ⛔ Une réponse d’un clic est TOUJOURS un geste. Sans cette contrainte, une
  --    ligne pourrait porter un axe sans porter `geste`, et retomberait dans le
  --    bassin des citations : le défaut 016, rouvert par la porte d’à côté.
  --
  -- ⚠️ `is not distinct from` ET PAS `=`, et ce n’est pas un raffinement : avec
  --    `geste = 'reponse_axe'`, une ligne dont `geste` est NUL fait valoir NULL
  --    à l’expression — et un CHECK ne refuse que sur FALSE, jamais sur NULL.
  --    La contrainte aurait donc laissé passer EXACTEMENT le cas qu’elle existe
  --    pour attraper. Constaté par le test d’intégration, qui a inséré la ligne
  --    fautive et l’a vue entrer.
  if not exists (
    select 1 from pg_constraint where conname = 'messages_axe_est_un_geste'
  ) then
    alter table messages
      add constraint messages_axe_est_un_geste
      check (axe is null or geste is not distinct from 'reponse_axe');
  end if;
end
$$;

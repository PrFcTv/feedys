-- 0008_geste_message.sql — ce qui, dans une ligne `collaborateur`, n’est pas de
-- la parole (P-025, [BUGS_LOG](../../03-Bugs/BUGS_LOG.md) 016).
--
-- Source de vérité du schéma : 04-Architecture/conventions-db.md.
--
-- LE DÉFAUT QU’ELLE FERME. `parolesDe()` prenait toute ligne `collaborateur`
-- comme source de citation. Or les corrections de carte sont écrites par
-- `domaine/entretien/tour.ts` sous la forme `Correction · Écran — Liste des
-- mandats` : la ligne vient bien de la personne, mais son TEXTE est fabriqué à
-- partir de ce que le bot avait écrit. La note citait donc « Liste des mandats »
-- entre guillemets comme si elle l’avait prononcé — et comme la confiance est
-- rabattue à `basse` quand aucune citation ne survit, une correction citée la
-- faisait MONTER sur la foi des mots du bot.
--
-- ⛔ Reconnaître une correction à son préfixe de texte aurait été le mauvais
--    correctif : la règle se serait cassée le jour où quelqu’un dicte
--    « correction ». Le fil doit PORTER la distinction, d’où cette colonne.
--
-- ⛔ On retire une SOURCE DE CITATION, pas une ligne. Les corrections restent
--    dans le fil, partent au modèle, et se lisent au back-office et par MCP.
--
-- ⚠️ `geste is null` veut dire « la personne l’a dit ». C’est le cas de
--    l’immense majorité des lignes, et le défaut ne se paie donc pas en place :
--    une colonne nullable typée est gratuite sur Postgres.
--
-- ⚠️ LES DEUX VALEURS SONT DÉCLARÉES ICI bien que P-025 n’emploie que
--    `correction` — `reponse_axe` arrive avec P-026
--    ([D-025](../../00-Projet/DECISIONS_LOG.md)). La raison est technique et
--    non spéculative : `alter type … add value` ne permet pas d’employer la
--    valeur ajoutée dans la transaction qui l’ajoute, et le runner enveloppe
--    chaque migration dans la sienne. Séparer aurait coûté une migration en
--    deux temps pour un mot.
--
-- ⛔ Aucune donnée existante n’est réécrite. Les corrections déjà en base
--    restent `geste is null`, donc encore citables : on ne reconstruit pas le
--    passé en devinant, et `messages` est append-only — aucun UPDATE ici.
--    Les notes déjà produites ne se refont pas non plus (une seule par retour).
--
-- ⚠️ Aucun index : aucune requête ne filtre sur `geste`. Le fil se lit par
--    `retour_id`, déjà couvert par `messages_retour_ordre_idx`. Le filtre se
--    fait en mémoire, sur les quelques lignes d’un entretien.
--
-- ⚠️ Ce fichier ne porte ni BEGIN ni COMMIT : le runner enveloppe chaque
--    migration dans sa propre transaction.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'geste_message') then
    create type geste_message as enum ('correction', 'reponse_axe');
  end if;
end
$$;

alter table messages
  add column if not exists geste geste_message;

comment on column messages.geste is
  '⛔ Ce qui, dans une ligne `collaborateur`, n’est PAS de la parole. NULL = la personne l’a dit. Renseigné = le texte est fabriqué à partir de ce que le bot avait écrit, et la ligne ne peut jamais devenir une citation (P-025, BUGS_LOG 016).';

comment on type geste_message is
  'correction = une correction de la carte de compréhension. reponse_axe = une réponse d’un clic sur un axe fermé (P-026, D-025).';

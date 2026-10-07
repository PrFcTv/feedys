-- 0013_motif_requete_refusee.sql — le filet renonce aussi quand la requête est
-- refusée, et il le dit (P-032)
--
-- Source de vérité du schéma : 04-Architecture/conventions-db.md.
--
-- ⚠️ POURQUOI UN TROISIÈME MOTIF ([03-Bugs/BUGS_LOG.md] 021, D-032).
--    `synthese_impossible_motif` n’admettait que `plafond` — le modèle n’a pas
--    répondu après toutes les reprises — et `rien_a_synthetiser`. Un 400 du
--    fournisseur, qui refuse la requête POUR CE QU’ELLE EST, finissait donc en
--    `plafond` après huit reprises muettes, et l’alerte disait « le modèle n’a
--    pas répondu » : l’exploitant cherchait une panne qui n’existait pas.
--
--    `requete_refusee` : le fournisseur a répondu, et il a refusé la requête.
--    Elle le sera à l’identique tant que Feedys n’est pas corrigé ; le filet la
--    confirme une fois, puis renonce.
--
-- ⛔ PAS `plafond` RÉEMPLOYÉ. Les deux attendent « Refaire la note », mais pas
--    après le même geste — attendre le modèle, ou mettre Feedys à jour —, et
--    l’alerte comme le back-office doivent pouvoir dire lequel.
--
-- ⚠️ La contrainte est REMPLACÉE, pas ajoutée : deux CHECK sur la même colonne
--    garderaient l’ancien, qui refuserait la nouvelle valeur. `drop … if exists`
--    puis `add` rend le fichier rejouable, et le runner l’enveloppe dans une
--    transaction : il n’y a pas d’instant où la colonne est sans contrainte.
--
-- ⚠️ Ce fichier ne porte ni BEGIN ni COMMIT.

alter table retours
  drop constraint if exists retours_synthese_impossible_motif_connu;

alter table retours
  add constraint retours_synthese_impossible_motif_connu
  check (
    synthese_impossible_motif is null
    or synthese_impossible_motif in ('plafond', 'rien_a_synthetiser', 'requete_refusee')
  );

comment on column retours.synthese_impossible_motif is
  'plafond : le modèle n’a pas répondu après toutes les reprises. rien_a_synthetiser : le fil ne contient aucune parole écrite — un retour dicté sans transcript ne produira jamais de note (P-030). requete_refusee : le fournisseur refuse la requête pour ce qu’elle est (HTTP 400…) ; elle le sera à l’identique jusqu’à un correctif de Feedys (P-032).';

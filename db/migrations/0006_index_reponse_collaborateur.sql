-- 0006_index_reponse_collaborateur.sql — l’index de la relève (P-020)
--
-- Source de vérité du schéma : 04-Architecture/conventions-db.md.
--
-- Pourquoi il manquait, et pourquoi il compte : la relève
-- (infra/base/depot-collaborateur.ts) filtre sur `produit_id`, `auteur_ref`,
-- `reponse_envoyee_le is not null` et `reponse_lue_le is null`. Aucun index de
-- 0001_socle.sql ne couvre `auteur_ref` — il n’était indexé nulle part —, et
-- cette requête part à CHAQUE montage du widget, donc à chaque chargement de
-- page de chaque logiciel hôte. C’était le seul chemin chaud du produit laissé
-- sur un parcours séquentiel.
--
-- ⚠️ Index PARTIEL, et c’est le point : la clause `where` est celle de la
--    requête. Il ne contient donc que les réponses EN ATTENTE — quelques
--    lignes, jamais l’historique — et il rétrécit tout seul dès que le
--    collaborateur clique « J’ai vu ».
--
-- ⚠️ Ce fichier ne porte ni BEGIN ni COMMIT : le runner enveloppe chaque
--    migration dans sa propre transaction.

create index if not exists retours_reponse_en_attente_idx
  on retours (produit_id, auteur_ref)
  where reponse_envoyee_le is not null and reponse_lue_le is null;

comment on index retours_reponse_en_attente_idx is
  'La relève du widget : les réponses non lues d’un collaborateur donné (P-020).';

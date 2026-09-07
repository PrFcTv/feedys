-- 0004_contexte_metier.sql — contextualisation métier du produit et situation d’écran (P-02X)
--
-- Source de vérité du schéma : 04-Architecture/conventions-db.md.
--
-- Ajoute le contexte métier sur la table `produits` (vocabulaire, glossaire,
-- description du logiciel hôte) et la situation d’écran sur la table `contextes`
-- (lue depuis l’attribut déclaratif data-feedys-contexte).
--
-- ⛔ Jamais de colonne metadata fourre-tout. Deux colonnes nullables typées
--    `text`, gratuites sur Postgres.
--
-- ⚠️ Ce fichier ne porte ni BEGIN ni COMMIT : le runner enveloppe chaque
--    migration dans sa propre transaction.

alter table produits
  add column if not exists contexte_metier text;

comment on column produits.contexte_metier is
  'Le vocabulaire métier et glossaire du logiciel hôte, saisi à la main (pnpm produit:creer --metier). Injecté dans le prompt système du bot pour qu’il comprenne le jargon sans poser de questions naïves (P-02X, D-020).';

alter table contextes
  add column if not exists situation text;

comment on column contextes.situation is
  'La situation immédiate de l’écran, lue de l’attribut déclaratif d’hôte data-feedys-contexte posé sur le document (body ou documentElement), bornée à 120 caractères (P-02X, D-020).';

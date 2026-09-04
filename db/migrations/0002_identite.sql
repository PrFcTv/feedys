-- 0002_identite.sql — de quoi vérifier une identité signée (P-012)
--
-- Le serveur de l’hôte signe { ref, nom, role, exp } avec le secret du produit,
-- le widget passe le jeton, Feedys vérifie (D-005). Vérifier un HMAC demande la
-- MÊME clé que celle qui a signé : un argon2 ne s’inverse pas, et `secret_hash`
-- ne peut donc pas servir à ça. D’où cette colonne.
--
-- ⛔ Le secret n’y est PAS en clair : il est chiffré en AES-256-GCM sous une clé
--    qui vit dans l’environnement du conteneur (FEEDYS_CLE_CHIFFREMENT), jamais
--    en base. Un dump volé — et hebergement.md en garde trente jours — ne permet
--    donc pas de forger l’identité de qui que ce soit.
--
-- ⚠️ `secret_hash` reste : c’est la preuve du secret, et elle ne devient pas
--    fausse. Voir 00-Projet/DECISIONS_LOG.md D-015.

alter table produits
  add column if not exists secret_chiffre text;

comment on column produits.secret_chiffre is
  'Le secret du produit, chiffré en AES-256-GCM sous FEEDYS_CLE_CHIFFREMENT. ⛔ Jamais en clair, ni ici ni ailleurs. Sert à VÉRIFIER la signature d’identité de l’hôte — un argon2 ne s’inverse pas (D-015). NULL = ce produit ne peut pas vérifier d’identité, et ses retours arrivent en identite_verifiee = false.';

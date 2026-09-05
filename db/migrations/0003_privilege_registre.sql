-- 0003_privilege_registre.sql — le rôle applicatif peut LIRE le registre des
-- migrations (P-018)
--
-- ⚠️ CE QUE CE FICHIER ÉVITE, ET QUI NE SE SERAIT VU QU’EN PRODUCTION.
--
-- La table `migrations` n’est créée par aucune migration : c’est le runner
-- lui-même qui la pose (apps/serveur/infra/base/migrations.ts). Elle appartient
-- donc au rôle qui a migré — le propriétaire — et ne portait AUCUN privilège
-- pour `feedys_app`.
--
-- Or la sonde `GET /sante` la lit, avec le pool de SERVICE :
--
--     select nom, sha256 from migrations order by nom
--
-- Tant que `DATABASE_URL` pointait sur le propriétaire, personne ne l’a vu. Le
-- jour où elle pointe sur un rôle membre de `feedys_app` — c’est-à-dire le jour
-- où le garde-fou de D-009 commence enfin à mordre — la sonde tombe en 503, le
-- `HEALTHCHECK` de l’image échoue, et ⛔ **le conteneur redémarre en boucle**.
--
-- ⛔ Un mode de défaillance qui n’apparaît qu’au durcissement est le pire des
--    deux mondes : on croit avoir sécurisé, et on a cassé le déploiement.

grant select on migrations to feedys_app;

comment on table migrations is
  'Le registre des migrations appliquées, posé par le runner et non par une migration. ⛔ SELECT seulement pour feedys_app : la sonde /sante le lit, personne d’autre n’a à y toucher (P-018).';

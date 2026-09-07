#!/usr/bin/env bash
#
# ⛔ UNE SAUVEGARDE JAMAIS RESTAURÉE N’EXISTE PAS.
#
# Ce script restaure le dernier dump dans une base JETABLE, compte ce qu’il y a
# dedans, et détruit la base. Il ne touche jamais à la base de production.
#
# ⚠️ À jouer une fois avant la première mise en service (hebergement.md §La pose
#    chez un hôte, étape 2), et le jour où l’on change quoi que ce soit à la
#    sauvegarde. Ce qu’il imprime entre dans 03-Bugs/MISE_EN_SERVICE.md.
#
# Usage :
#   ./scripts/verifier-sauvegarde.sh                    # le dump le plus récent
#   ./scripts/verifier-sauvegarde.sh sauvegardes/feedys-20260907-031200.dump
set -euo pipefail

RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

COMPOSE="${COMPOSE:-$RACINE/docker-compose.production.yml}"
ENV_FILE="${ENV_FILE:-$RACINE/.env.production}"
DEST="${DEST:-$RACINE/sauvegardes}"
SERVICE_PG="${SERVICE_PG:-postgres}"

if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck source=/dev/null
  . "$ENV_FILE"
  set +a
fi

compose() {
  if [ -f "$ENV_FILE" ]; then
    docker compose -f "$COMPOSE" --env-file "$ENV_FILE" "$@"
  else
    docker compose -f "$COMPOSE" "$@"
  fi
}

UTILISATEUR="${POSTGRES_USER:-feedys}"

dump="${1:-}"
if [ -z "$dump" ]; then
  # ⚠️ Le nom porte l’horodatage : l’ordre alphabétique EST l’ordre chronologique.
  dump=$(find "$DEST" -name 'feedys-*.dump' -type f | sort | tail -1)
fi

if [ -z "$dump" ] || [ ! -f "$dump" ]; then
  echo "⛔ Aucun dump à vérifier dans $DEST. Jouer ./scripts/sauvegarde.sh d’abord." >&2
  exit 1
fi

# ⛔ CE N’EST PEUT-ÊTRE PAS UN DUMP. Sans ce contrôle, le script créait une base,
#    laissait `pg_restore` échouer, puis crachait une erreur SQL brute
#    — « relation "messages" does not exist » — pour dire « le fichier est
#    illisible ». Les cinq premiers octets d’un dump `custom` sont « PGDMP ».
if [ "$(head -c 5 "$dump")" != "PGDMP" ]; then
  echo "⛔ $dump n’est pas un dump PostgreSQL au format custom." >&2
  echo "   Le fichier existe et n’est pas vide, mais il ne contient pas ce qu’on croit." >&2
  exit 1
fi

# ⚠️ Le nom porte l’horodatage : deux vérifications lancées à la même seconde sur
#    le même cluster ne se marchent pas dessus.
BASE_ESSAI="feedys_verif_$(date +%s)_$$"

# ⛔ La base jetable est détruite QUOI QU’IL ARRIVE — y compris si la
#    restauration échoue au milieu, ce qui est précisément le cas où l’on veut
#    savoir, pas le cas où l’on veut laisser des débris.
detruire() {
  compose exec -T "$SERVICE_PG" dropdb -U "$UTILISATEUR" --if-exists --force "$BASE_ESSAI" \
    > /dev/null 2>&1 || true
}
trap detruire EXIT

echo "📦 $dump"
compose exec -T "$SERVICE_PG" createdb -U "$UTILISATEUR" "$BASE_ESSAI"

# ⚠️ `pg_restore` rend un code non nul sur de simples avertissements — un rôle
#    absent, un commentaire sur un objet système. Ce qui tranche n’est pas son
#    code de sortie, ce sont les LIGNES qu’on relit ensuite.
if ! compose exec -T "$SERVICE_PG" \
  pg_restore -U "$UTILISATEUR" -d "$BASE_ESSAI" --no-owner --no-privileges < "$dump"; then
  echo "⚠️ pg_restore a signalé des avertissements. Les comptes ci-dessous font foi."
fi

echo
compose exec -T "$SERVICE_PG" psql -U "$UTILISATEUR" -d "$BASE_ESSAI" -c "
  select 'messages'  as table, count(*) as lignes from messages
  union all select 'retours',   count(*) from retours
  union all select 'contextes', count(*) from contextes
  union all select 'syntheses', count(*) from syntheses
  union all select 'produits',  count(*) from produits
  union all select 'audit',     count(*) from audit
  order by 1;
"

# ⛔ LE SEUL COMPTE QUI DÉCIDE. Une base restaurée sans un seul message est une
#    sauvegarde qui n’a rien sauvegardé — et c’est exactement ce qu’un dump
#    plausible mais vide donnerait.
messages=$(compose exec -T "$SERVICE_PG" \
  psql -U "$UTILISATEUR" -d "$BASE_ESSAI" -tAc 'select count(*) from messages' | tr -d '[:space:]')

if [ "${messages:-0}" -eq 0 ]; then
  echo "⛔ Zéro message restauré. La sauvegarde ne protège RIEN de ce qu’elle prétend protéger." >&2
  exit 1
fi

echo "✅ $messages message(s) restauré(s) depuis $dump."
echo "⚠️ À reporter dans 03-Bugs/MISE_EN_SERVICE.md : ce qui a été restauré, et depuis quel dump."

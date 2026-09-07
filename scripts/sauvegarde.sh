#!/usr/bin/env bash
#
# La sauvegarde de Feedys — un dump, une rotation, rien de plus.
#
# ⛔ CE QU’ON PROTÈGE, CE SONT LES `messages` : la parole des gens, qui ne se
#    reconstitue pas. Les synthèses, elles, se régénèrent depuis le fil
#    (`pnpm entretien:rejouer --synthese`).
#
# ⚠️ LA NOTE PART DÉJÀ PAR EMAIL, ET ÇA NE SUFFIT PAS. C’est le DÉRIVÉ qui part
#    — le résumé et quelques citations. Ce qui n’existe nulle part ailleurs qu’en
#    base, c’est le fil brut : ce qui a été dit, les hésitations, le transcript
#    avant correction. C’est la matière qui sert à régler le prompt, et la seule
#    façon de vérifier qu’une note n’a pas déformé ce que quelqu’un a dit.
#
# ⚠️ Et la table `produits`. La perdre n’est pas relancer une commande : c’est
#    retourner voir le développeur de chaque logiciel hôte pour qu’il change sa
#    ligne de <script> et sa signature d’identité, dans SON logiciel.
#
# Usage :
#   ./scripts/sauvegarde.sh
#   RETENTION_JOURS=14 DEST=/var/backups/feedys ./scripts/sauvegarde.sh
#
# En cron, tous les jours à 3 h 12 (⚠️ pas à une heure ronde : tout le monde
# sauvegarde à 3 h 00) :
#   12 3 * * * cd /srv/feedys && ./scripts/sauvegarde.sh >> /var/log/feedys-sauvegarde.log 2>&1
set -euo pipefail

RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

COMPOSE="${COMPOSE:-$RACINE/docker-compose.production.yml}"
ENV_FILE="${ENV_FILE:-$RACINE/.env.production}"
DEST="${DEST:-$RACINE/sauvegardes}"
RETENTION_JOURS="${RETENTION_JOURS:-7}"
SERVICE_PG="${SERVICE_PG:-postgres}"

# ⚠️ `set -a` : les variables du fichier deviennent celles de CE shell, ce qui
#    donne POSTGRES_USER et POSTGRES_DB à la ligne `pg_dump`. `--env-file` seul
#    ne sert qu’à l’interpolation de compose — c’est la double contrainte
#    décrite dans hebergement.md §Le rôle de connexion.
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
BASE="${POSTGRES_DB:-feedys}"

mkdir -p "$DEST"

fichier="$DEST/feedys-$(date +%Y%m%d-%H%M%S).dump"
partiel="$fichier.partiel"

# ⛔ On écrit dans un fichier PARTIEL, renommé seulement à la fin. Un dump
#    interrompu — disque plein, conteneur tué — ne doit jamais ressembler à un
#    dump valide dans la liste.
nettoyer() { rm -f "$partiel"; }
trap nettoyer EXIT

# ⚠️ `--format=custom` : compressé, et surtout relisible par `pg_restore`, qui
#    sait restaurer table par table. `--no-owner` parce que le rôle qui
#    restaure n’est pas forcément celui qui possédait.
compose exec -T "$SERVICE_PG" \
  pg_dump -U "$UTILISATEUR" -d "$BASE" --format=custom --no-owner > "$partiel"

if [ ! -s "$partiel" ]; then
  echo "⛔ Le dump est vide. Rien n’a été gardé — et RIEN N’A ÉTÉ SUPPRIMÉ." >&2
  exit 1
fi

# ⚠️ UN FICHIER NON VIDE N’EST PAS UN DUMP. Si pg_dump a écrit un message
#    d’erreur sur sa sortie standard, ou s’il s’est arrêté au premier bloc, on
#    aurait un fichier plausible et inutilisable. Les cinq premiers octets d’un
#    dump `custom` sont « PGDMP ».
#
# ⛔ Ce contrôle est bon marché et tourne tous les jours. Il ne remplace PAS
#    `verifier-sauvegarde.sh`, qui restaure pour de vrai — une sauvegarde jamais
#    restaurée n’existe pas.
if [ "$(head -c 5 "$partiel")" != "PGDMP" ]; then
  echo "⛔ Le fichier produit n’est pas un dump PostgreSQL. Rien n’a été supprimé." >&2
  exit 1
fi

mv "$partiel" "$fichier"
trap - EXIT

octets=$(wc -c < "$fichier" | tr -d ' ')
echo "✅ $fichier — $octets octets."

# ⛔ LA ROTATION N’A LIEU QU’APRÈS UN DUMP VALIDE. Supprimer d’abord et
#    sauvegarder ensuite est la façon classique de se retrouver sans rien le
#    jour où la sauvegarde échoue — c’est-à-dire le seul jour qui compte.
supprimes=$(find "$DEST" -name 'feedys-*.dump' -type f -mtime "+$RETENTION_JOURS" -print -delete | wc -l | tr -d ' ')
echo "🧹 $supprimes sauvegarde(s) de plus de $RETENTION_JOURS jours supprimée(s)."

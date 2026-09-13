#!/usr/bin/env bash
# ---------------------------------------------------------------------
# Applique les migrations sur une base PostgreSQL jetable et déroule les
# tests de schéma, de RPC et d'isolation RLS.
#
#   ./scripts/test-db.sh
#
# Pour viser une base existante, exporte les variables libpq habituelles :
#   PGHOST=localhost PGPORT=5432 PGUSER=postgres PGPASSWORD=... \
#     USE_LOCAL_CLUSTER=0 ./scripts/test-db.sh
#
# Le fichier 00-supabase-shim.sql reproduit le strict minimum de
# l'environnement Supabase (schéma auth, auth.uid(), rôles) pour que les
# migrations puissent tourner hors de Supabase.
# ---------------------------------------------------------------------
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
PGDATA="${PGDATA:-/var/tmp/revia-pgdata}"
PGPORT="${PGPORT:-55432}"
PGHOST="${PGHOST:-/var/tmp}"
DB="${DB:-revia_test}"

if [ "${USE_LOCAL_CLUSTER:-1}" = "1" ]; then
  # Démarre un cluster jetable si aucun n'écoute déjà.
  export PATH="$PGBIN:$PATH"
  export PGHOST="$PGHOST" PGPORT="$PGPORT" PGUSER=postgres
  if ! pg_ctl -D "$PGDATA" status > /dev/null 2>&1; then
    rm -rf "$PGDATA"
    initdb -D "$PGDATA" -U postgres --auth=trust > /dev/null
    pg_ctl -D "$PGDATA" -o "-p $PGPORT -k $PGHOST" -l "$PGDATA/server.log" start > /dev/null
    sleep 2
  fi
fi

# psql s'appuie sur les variables libpq (PGHOST, PGPORT, PGUSER, PGPASSWORD).
PSQL=(psql -d postgres)

"${PSQL[@]}" -q -c "drop database if exists $DB;" -c "create database $DB;"
RUN=(psql -d "$DB" -v ON_ERROR_STOP=1)

echo "▸ Migrations"
"${RUN[@]}" -q -f "$ROOT/supabase/tests/00-supabase-shim.sql"
for file in "$ROOT"/supabase/migrations/*.sql; do
  # La migration storage nécessite le schéma storage de Supabase.
  case "$file" in *_storage.sql) continue ;; esac
  echo "  · $(basename "$file")"
  "${RUN[@]}" -q -f "$file"
done

echo "▸ Comptes de test"
"${RUN[@]}" -q -c "insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'alice@example.com', '{\"first_name\":\"Alice\"}'),
  ('22222222-2222-2222-2222-222222222222', 'bob@example.com',   '{\"first_name\":\"Bob\"}');"

echo "▸ Schéma, RPC et isolation"
"${RUN[@]}" -f "$ROOT/supabase/tests/01-schema-and-rpc.sql"
echo "▸ Tentatives d'accès entre utilisateurs"
"${RUN[@]}" -f "$ROOT/supabase/tests/02-rls-cross-user.sql"

echo "✅ Tests base de données terminés."

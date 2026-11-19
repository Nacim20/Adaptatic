#!/usr/bin/env bash
# Applique les migrations sur un PostgreSQL vierge puis lance les tests de sécurité (RLS).
# Usage : PGHOST=... PGPORT=... PGUSER=... [PGPASSWORD=...] bash supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DB=adaptatic_test
psql -v ON_ERROR_STOP=1 -q -d postgres -c "drop database if exists $DB" -c "create database $DB"
run() { psql -v ON_ERROR_STOP=1 -q -d "$DB" "$@"; }
run -f tests/stub_supabase.sql
for f in migrations/*.sql; do
  echo "migration: $f"
  # pg_net n'existe pas sur un PostgreSQL nu : le déclencheur est neutralisé par net.http_post (stub).
  sed '/create extension if not exists pg_net/d' "$f" | run -f -
done
run -f tests/food_journal_test.sql
run -f tests/calorie_events_test.sql
echo "OK : migrations et tests de sécurité passés"

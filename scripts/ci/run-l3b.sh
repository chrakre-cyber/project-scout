#!/usr/bin/env bash
# L3b: de seks navngitte oppgraderingstestene (tests/db: DATA-002D og ECON-005b «oppgradering») kjørt i en SEPARAT, midlertidig PostgreSQL-klynge via
# scripts/test-db-isolated.sh. Dette er IKKE Supabase-stakken (vanlig PostgreSQL + shim). Skriver til arbeidskatalogen $1 (privat; aldri til logg):
#   l3b.json / l3b.rc / l3b.out / l3b.pg.txt, eller l3b.nobinaries hvis PostgreSQL-binærer mangler (da er L3b «IKKE KJØRT»; ingenting installeres).
# Valgfrie miljøvariabler (kun test): PGBIN (alternativ binærkatalog), L3B_FILTER (vitest -t), MIGRATIONS_DIR (endret migrasjonskopi, brukes av klyngeskriptet).
set -uo pipefail
cd "$(dirname "$0")/../.."
W="${1:?bruk: run-l3b.sh <arbeidskatalog>}"
PGBIN="${PGBIN-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
for b in initdb pg_ctl psql postgres; do
  if [ ! -x "${PGBIN:-/nonexistent}/$b" ]; then : > "$W/l3b.nobinaries"; exit 0; fi
done
export PGBIN
"$PGBIN/postgres" --version 2>/dev/null | head -1 > "$W/l3b.pg.txt"
FILTER="${L3B_FILTER:-oppgradering fra eldre tilstand|oppgradering — eksisterende}"
timeout 720 bash scripts/test-db-isolated.sh tests/db/data002d-field-map.test.ts tests/db/econ005b-rights.test.ts -t "$FILTER" --reporter=json --outputFile="$W/l3b.json" > "$W/l3b.out" 2>&1
echo $? > "$W/l3b.rc"

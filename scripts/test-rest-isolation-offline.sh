#!/usr/bin/env bash
# L6 (+ PostgREST-delen av L4) mot en EKTE PostgREST-binær foran den isolerte PostgreSQL-klyngen — UTEN Docker/Supabase og med en STUBB for Auth (ikke GoTrue).
# Beviser HTTP-lagets antakelser for tabellene (statuskoder, feilkoder, Prefer, filtre, embed, tokenvalidering) og RLS/grants/triggere i PostgreSQL. Beviser IKKE GoTrue-
# oppførsel og er IKKE Supabase. Krever: POSTGREST_BIN=<sti til PostgREST-binær du selv har lastet ned> (ingenting installeres), PostgreSQL-binærer (som test-db-isolated.sh).
set -euo pipefail
cd "$(dirname "$0")/.."
: "${POSTGREST_BIN:?Sett POSTGREST_BIN til en PostgREST-binær (lastes ikke ned av dette skriptet)}"
SCOUT_ISOLATED_CMD='node tests/ci/postgrest-harness/run.mjs' bash scripts/test-db-isolated.sh

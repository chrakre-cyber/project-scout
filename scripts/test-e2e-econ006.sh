#!/usr/bin/env bash
# ECON-006c: nettleserforløp for forhandlerskjema, firmaprofil, estimater/ufullstendige resultater, foreldelse, rettighetsavslag og firmaskille.
# Miljø: appen (bygget mot testemulatoren), tests/e2e/support/mini-supabase.mjs (EMULATOR av Auth/PostgREST — IKKE Supabase) og en ISOLERT PostgreSQL-klynge (RLS er PostgreSQLs egen).
# Rettighetsavslag testes mot midlertidige kopier av appen med endret rettighetsprofil (produksjonskoden røres ikke). Krever Playwright (PW) og Chromium.
# Bygger appen flere ganger (.next i repoet overskrives; kjør `npm run build` på nytt etterpå for vanlig demomodus).
set -euo pipefail
cd "$(dirname "$0")/.."
export PW="${PW:-/opt/node-tools/node_modules/playwright}"
export PG="${PG:-$PWD/node_modules/pg}"
export SHOTS="${SHOTS:-$PWD/reviews/ECON-006c/screenshots}"
SCOUT_ISOLATED_CMD='node tests/e2e/econ006.e2e.mjs' bash scripts/test-db-isolated.sh

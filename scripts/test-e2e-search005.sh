#!/usr/bin/env bash
# SEARCH-005: nettleserflyt mot appen, en testemulator for Auth/PostgREST og en ISOLERT PostgreSQL-klynge (se test-db-isolated.sh).
# Krever Playwright (PW=<sti til playwright-modulen>, standard /opt/node-tools/node_modules/playwright) og en bygget Chromium.
# Bygger appen med testemulatorens URL (.next overskrives; kjør `npm run build` på nytt etterpå for vanlig demomodus).
set -euo pipefail
cd "$(dirname "$0")/.."
export PW="${PW:-/opt/node-tools/node_modules/playwright}"
export PG="${PG:-$PWD/node_modules/pg}"
export SHOTS="${SHOTS:-$PWD/reviews/SEARCH-005/screenshots}"
SCOUT_ISOLATED_CMD='node tests/e2e/search005.e2e.mjs' bash scripts/test-db-isolated.sh

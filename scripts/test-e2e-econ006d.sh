#!/usr/bin/env bash
# ECON-006d: små testrester i nettleser — ukjent rettighetsprofil, ukjent kjøretøyprofil, B1 (akseptdato utenfor dokumentert periode) og J5 (ukjent fradragsstatus), adskilt fra BEV med ukjent
# elbilkvalifisering. Samme oppsett og samme forbehold som test-e2e-econ006.sh: bygd app i Chromium, Auth/PostgREST-EMULATOR (ikke Supabase), isolert PostgreSQL, midlertidige app-kopier.
set -euo pipefail
cd "$(dirname "$0")/.."
export PW="${PW:-/opt/node-tools/node_modules/playwright}"
export PG="${PG:-$PWD/node_modules/pg}"
export SHOTS="${SHOTS:-$PWD/reviews/ECON-006d/screenshots}"
SCOUT_ISOLATED_CMD='node tests/e2e/econ006d.e2e.mjs' bash scripts/test-db-isolated.sh

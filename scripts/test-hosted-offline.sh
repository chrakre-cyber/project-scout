#!/usr/bin/env bash
# HOST-001 (forberedelse): offline-test av hosted-inspeksjon (tomt prosjekt vs. oppgradering, DATA-002D-kartlegging) og opprydding mot en ISOLERT, midlertidig PostgreSQL-klynge
# (IKKE Supabase, IKKE hosted; ingen nettverk utover 127.0.0.1). Gjenbruker scripts/test-db-isolated.sh. Bruk: bash scripts/test-hosted-offline.sh
set -euo pipefail
cd "$(dirname "$0")/.."
SCOUT_ISOLATED_CMD='npx vitest run --config vitest.hosted-offline.config.ts' exec bash scripts/test-db-isolated.sh

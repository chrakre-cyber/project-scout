#!/usr/bin/env bash
# HOST-001 (forberedelse): tynn innpakning rundt scripts/hosted/cli.mjs. Leser ev. lokal, UTRACKET miljøfil (.env.hosted.local; ignorert av git) uten å skrive ut innholdet.
# Uten gyldig hosted-oppsett (se docs/econ/hosted-kjoreinstruks.md) avslutter cli.mjs før noen forbindelse åpnes. Ingen `set -x`, ingen utskrift av miljøet.
set -euo pipefail
cd "$(dirname "$0")/../.."
if [ -f .env.hosted.local ]; then set -a; . ./.env.hosted.local; set +a; fi
exec node scripts/hosted/cli.mjs "$@"

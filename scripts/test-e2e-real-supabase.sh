#!/usr/bin/env bash
# CI-001 trinn 2: kjører nettleserløpene mot EKTE lokal Supabase (GoTrue + PostgREST) i stedet for emulatoren (tests/e2e/support/backend.mjs, E2E_SUPABASE_MODE=real).
# Bruk: bash scripts/test-e2e-real-supabase.sh <l4|econ006|econ006d>
# Krever: `npx supabase start` (lokal stakk) og en FORHÅNDSINSTALLERT Chrome/Chromium (CHROME_PATH eller kjente stier). Mangler nettleseren: exit 3 «IKKE KJØRT»; ingenting installeres.
# Exit-koder: 0 alt bestått · 1 feil · 3 IKKE KJØRT (ingen nettleser) · 4 DELVIS (sjekker hoppet over; ikke bestått). Nøkler leses fra `supabase status -o env` og skrives aldri ut.
# De gamle emulatorløpene (scripts/test-e2e-econ006*.sh) er uendret og er IKKE ekte Supabase.
set -uo pipefail
cd "$(dirname "$0")/.."
which="${1:-}"
case "$which" in
  l4) script=tests/e2e/l4-browser.e2e.mjs ;;
  econ006) script=tests/e2e/econ006.e2e.mjs ;;
  econ006d) script=tests/e2e/econ006d.e2e.mjs ;;
  *) echo "bruk: $0 <l4|econ006|econ006d>"; exit 2 ;;
esac
node --input-type=module -e 'import { findChrome, NOT_RUN_EXIT } from "./tests/e2e/support/browser.mjs"; if (!findChrome()) { console.log("IKKE KJØRT: ingen forhåndsinstallert Chrome/Chromium funnet (sett CHROME_PATH). Ingenting installeres automatisk; dette er IKKE en bestått kontroll."); process.exit(NOT_RUN_EXIT); }' || exit $?
status="$(npx supabase status -o env 2>/dev/null)" || { echo "Lokal Supabase kjører ikke (npx supabase start)"; exit 2; }
get() { printf '%s\n' "$status" | sed -n "s/^$1=\"\{0,1\}\([^\"]*\)\"\{0,1\}$/\1/p"; }
export SUPABASE_TEST_URL="$(get API_URL)" SUPABASE_TEST_PUBLISHABLE_KEY="$(get PUBLISHABLE_KEY)" SUPABASE_TEST_DB_URL="$(get DB_URL)"
[ -n "$SUPABASE_TEST_URL" ] && [ -n "$SUPABASE_TEST_PUBLISHABLE_KEY" ] && [ -n "$SUPABASE_TEST_DB_URL" ] || { echo "Mangler lokal Supabase-konfigurasjon"; exit 2; }
# Felles forhåndsvalidering (som skriptene gjør som første handling): manglende/ugyldig/ikke-lokal database eller API avvises før noe startes. Feilmeldingen røper ikke adresser med passord.
E2E_SUPABASE_MODE=real node --input-type=module -e 'import { preflightTargets } from "./tests/e2e/support/preflight.mjs"; try { preflightTargets({ mode: "real" }); } catch (e) { console.log("AVVIST: " + e.message); process.exit(2); }' || exit 2
unset PW
export E2E_SUPABASE_MODE=real PG="${PG:-$PWD/node_modules/pg}"
# Skjermbilder i ekte modus skrives til en midlertidig katalog (overskriver aldri innsjekkede belegg og lastes aldri opp).
export SHOTS="$(mktemp -d)"
trap 'rm -rf "$SHOTS"' EXIT
node "$script"

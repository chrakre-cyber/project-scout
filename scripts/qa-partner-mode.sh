#!/usr/bin/env bash
# DEV-006G: partnermodus. Verifiserer mot en ekte bygging (uten Supabase-konfigurasjon, ingen nettverk, ingen DB) at
#  (1) eldre Project Scout-ruter er blokkert som standard (→ /login) og ikke eksponerer gammel UI,
#  (2) inngang og søkeflate er uendret, global «ikke funnet» er Merovo-stil,
#  (3) SCOUT_ENABLE_LEGACY_ROUTES=1 gjenåpner de eldre rutene for intern utvikling.
# Flagget leses ved bygging, så scriptet bygger to ganger. .env.local flyttes midlertidig og gjenopprettes (trap). Port 3104.
# Etterpå inneholder .next den siste (flagg-PÅ) byggingen; kjør `npm run build` for vanlig bygg.
set -uo pipefail
cd "$(dirname "$0")/.."
PORT=3104; fails=0; BAK=""; SRV=""
check() { if [ "$2" = "$3" ]; then echo "PASS  $1"; else echo "FAIL  $1 (forventet «$3», fikk «$2»)"; fails=$((fails+1)); fi; }
stop_server() { [ -n "$SRV" ] && kill -TERM -- "-$SRV" 2>/dev/null; sleep 1; SRV=""; }
cleanup() { stop_server; [ -n "$BAK" ] && mv "$BAK" .env.local; }
trap cleanup EXIT
start_server() { setsid npx next start -p $PORT >/tmp/qa-partner-start.log 2>&1 & SRV=$!; for _ in $(seq 1 60); do curl -s -o /dev/null "localhost:$PORT/login" && return; sleep 0.5; done; }
# status + Location (uten å følge omdirigering). Valgfri metode som andre argument.
probe() { curl -s -o /dev/null -X "${2:-GET}" -w '%{http_code} %{redirect_url}' --max-time 10 "localhost:$PORT$1" | sed -E "s#http://localhost:$PORT##"; }
body() { curl -s --max-time 10 "localhost:$PORT$1"; }
has() { echo "$1" | grep -qi "$2" && echo ja || echo nei; }
redirect307_login() { local r; r="$(probe "$1" "${2:-GET}")"; # Next videresender query-strengen til målet; /login bruker bare «error», så det er kosmetisk.
  case "$r" in "307 /login"|"307 /login?"*|"308 /login") echo "→/login";; *) echo "$r";; esac; }

if [ -f .env.local ]; then BAK="$(mktemp -p "${TMPDIR:-/tmp}" env.local.XXXXXX)"; mv .env.local "$BAK"; fi
check "ingen .env.local og ingen Supabase-variabler i miljøet" "$([ -f .env.local ] || [ -n "${NEXT_PUBLIC_SUPABASE_URL:-}" ] && echo nei || echo ja)" "ja"

echo "== A. standard (flagget er IKKE satt): eldre ruter blokkert"
unset SCOUT_ENABLE_LEGACY_ROUTES
rm -rf .next
out="$(npm run build 2>&1)"; check "build uten flagg lykkes" "$(echo "$out" | grep -c '✓ Generating static pages')" "1"
start_server
for p in / /dashboard "/dashboard?page=2&agent=x" /agents /agents/new /agents/00000000-0000-4000-8000-000000000000 /agents/00000000-0000-4000-8000-000000000000/runs /agents/a/runs/b /opportunities/demo-001 /opportunities/finnes-ikke; do
  check "GET $p omdirigeres til /login" "$(redirect307_login "$p")" "→/login"
done
check "POST /agents blokkeres også (→ /login)" "$(redirect307_login /agents POST)" "→/login"
check "POST /dashboard blokkeres også (→ /login)" "$(redirect307_login /dashboard POST)" "→/login"
L="$(body /login)"
check "/login: 200" "$(probe /login | cut -d' ' -f1)" "200"
check "/login: Merovo-skall (tagline), ingen Project Scout, ingen gammel demobanner" "$(has "$L" 'Local demand. European supply.')$(has "$L" 'Project Scout')$(has "$L" 'DEMO —')" "janeinei"
S="$(body /searches)"
check "/searches: 200 uten omdirigering" "$(probe /searches | cut -d' ' -f1)" "200"
check "/searches: Merovo-skall, ingen Project Scout, ingen gammel demobanner" "$(has "$S" 'Local demand. European supply.')$(has "$S" 'Project Scout')$(has "$S" 'DEMO —')" "janeinei"
check "/searches/new og /searches/<ukjent> uendret oppførsel (anonym: Merovo-side, ikke gammel UI)" "$(has "$(body /searches/new)" 'Project Scout')$(has "$(body /searches/00000000-0000-4000-8000-000000000000)" 'Project Scout')" "neinei"
check "/ omdirigeres til /login" "$(redirect307_login /)" "→/login"
N="$(body /finnes-ikke-i-demoen)"
check "global ikke funnet: 404" "$(probe /finnes-ikke-i-demoen | cut -d' ' -f1)" "404"
check "global ikke funnet: Merovo-stil, lenke til /login, ingen Project Scout/«Dashboard»/gult banner" "$(has "$N" 'Fant ikke siden')$(has "$N" 'Local demand. European supply.')$(has "$N" 'href=\"/login\"')$(has "$N" 'Project Scout')$(has "$N" 'dashboard')$(has "$N" 'DEMO —')" "jajajaneineinei"
stop_server

echo "== B. SCOUT_ENABLE_LEGACY_ROUTES=1: eldre ruter gjenåpnet for intern utvikling"
export SCOUT_ENABLE_LEGACY_ROUTES=1
rm -rf .next
out="$(npm run build 2>&1)"; check "build med flagg lykkes" "$(echo "$out" | grep -c '✓ Generating static pages')" "1"
start_server
check "GET /dashboard: 200 uten omdirigering" "$(probe /dashboard | cut -d' ' -f1)" "200"
D="$(body /dashboard)"
check "/dashboard viser eldre Project Scout-flate (gjenåpnet)" "$(has "$D" 'Project Scout')" "ja"
check "GET /agents: 200" "$(probe /agents | cut -d' ' -f1)" "200"
check "GET /opportunities/demo-001: 200" "$(probe /opportunities/demo-001 | cut -d' ' -f1)" "200"
check "GET /agents/new: omdirigeres som før (til /agents, uten firma)" "$(probe /agents/new | cut -d' ' -f1)" "307"
check "/ går fortsatt til /login" "$(redirect307_login /)" "→/login"
check "/login og /searches uendret med flagg på: 200 og Merovo" "$(probe /login | cut -d' ' -f1)$(probe /searches | cut -d' ' -f1)$(has "$(body /login)" 'Local demand')$(has "$(body /searches)" 'Local demand')" "200200jaja"
stop_server
unset SCOUT_ENABLE_LEGACY_ROUTES
echo
[ "$fails" -eq 0 ] && echo "PARTNERMODUS: ALLE KONTROLLER BESTÅTT" || { echo "PARTNERMODUS: $fails KONTROLL(ER) FEILET"; exit 1; }

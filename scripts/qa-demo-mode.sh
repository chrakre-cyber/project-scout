#!/usr/bin/env bash
# QA-001: demomodus uten Supabase-konfigurasjon (ingen .env.local): build, syntetisk dashboard/detalj, ingen påstander om ekte data.
# Flytter .env.local midlertidig og gjenoppretter den alltid (trap). Kjører på port 3102. Exit-kode ≠ 0 ved feil.
set -uo pipefail
cd "$(dirname "$0")/.."
PORT=3102; fails=0; BAK=""
check() { if [ "$2" = "$3" ]; then echo "PASS  $1"; else echo "FAIL  $1 (forventet «$3», fikk «$2»)"; fails=$((fails+1)); fi; }
# Serveren startes i egen prosessgruppe (setsid) og hele gruppen drepes; next-server endrer prosesstittel og er ellers vanskelig å finne.
start_server() { setsid "$@" >/tmp/qa-demo-start.log 2>&1 & SRV=$!; for _ in $(seq 1 60); do curl -s -o /dev/null "localhost:$PORT/dashboard" && return; sleep 0.5; done; }
stop_server() { [ -n "${SRV:-}" ] && kill -TERM -- "-$SRV" 2>/dev/null; sleep 1; SRV=""; }
port_status() { curl -s -o /dev/null -w '%{http_code}' --max-time 2 "localhost:$PORT/dashboard"; }
cleanup() { stop_server; [ -n "$BAK" ] && mv "$BAK" .env.local; }
trap cleanup EXIT
if [ -f .env.local ]; then BAK="$(mktemp -p "${TMPDIR:-/tmp}" env.local.XXXXXX)"; mv .env.local "$BAK"; fi
check "ingen .env.local og ingen Supabase-variabler i miljøet" "$([ -f .env.local ] || [ -n "${NEXT_PUBLIC_SUPABASE_URL:-}" ] && echo nei || echo ja)" "ja"
rm -rf .next
out="$(npm run build 2>&1)"; check "build uten Supabase-konfigurasjon lykkes" "$(echo "$out" | grep -c '✓ Generating static pages')" "1"
check "port $PORT er ledig før start" "$(port_status)" "000"
start_server npx next start -p $PORT
get() { curl -s -o /tmp/qa-demo.html -w '%{http_code}' "localhost:$PORT$1"; sed 's/<!-- -->//g' /tmp/qa-demo.html > /tmp/qa-demo.txt; }
check "/dashboard 200" "$(get /dashboard)" "200"
check "  demo-banner (syntetiske annonser)" "$(grep -c 'annonsene er syntetiske' /tmp/qa-demo.txt)" "1"
check "  24 syntetiske kort på side 1" "$(grep -o 'href="/opportunities/[a-z0-9-]*"' /tmp/qa-demo.txt | sort -u | wc -l)" "24"
check "  «av 109 i syntetisk kilde»" "$(grep -c 'av 109 i syntetisk kilde' /tmp/qa-demo.txt)" "1"
check "  ingen påstand om live-data (ingen «live»/«mobile.de» utenom negasjon)" "$(grep -o -i -E '[^.>]{0,25}(live|mobile\.de)[^.<]{0,25}' /tmp/qa-demo.txt | grep -v -i -E 'ingen|ikke' | wc -l)" "0"
check "/dashboard?page=5 200 (13 kort, siste side)" "$(get '/dashboard?page=5')" "200"
check "/opportunities/demo-001 200 (EUR, belegg)" "$(get /opportunities/demo-001)" "200"
check "/opportunities/demo-009 200 (USD uten krasj)" "$(get /opportunities/demo-009)" "200"
check "  USD vises som oppgitt med merknad" "$(grep -c '41500.00 USD' /tmp/qa-demo.txt)/$(grep -c 'valuta støttes ikke' /tmp/qa-demo.txt)" "1/1"
check "  alle 7 kostlinjer + bidrag + likviditet er «ikke beregnet»" "$(grep -o 'ikke beregnet' /tmp/qa-demo.txt | wc -l | awk '{print ($1>=9)?"ok":"for få: "$1}')" "ok"
check "  ingen marginpåstand (ingen «margin» i kroner, ingen «fortjeneste»)" "$(grep -o -i -E 'fortjeneste|garantert' /tmp/qa-demo.txt | grep -c -v -i 'ikke')" "0"
check "  «Åpne demoannonse» er inaktiv" "$(grep -c 'disabled' /tmp/qa-demo.txt | awk '{print ($1>=1)?"ok":"nei"}')" "ok"
check "/opportunities/finnes-ikke gir 404" "$(get /opportunities/finnes-ikke)" "404"
check "/agents 200 med demo-agenter" "$(get /agents)" "200"
check "  ingen opprett-skjema uten innlogging" "$(grep -c 'name="name"' /tmp/qa-demo.txt)" "0"
check "/login 200 med forklaring om manglende konfigurasjon" "$(get /login)/$(grep -c 'ikke konfigurert' /tmp/qa-demo.txt)" "200/1"
check "/agents/new omdirigeres" "$(curl -s -o /dev/null -w '%{http_code}' "localhost:$PORT/agents/new")" "307"
stop_server
check "serveren er stoppet (port ikke lenger i bruk)" "$(port_status)" "000"
SCOUT_SYNTHETIC_FAILURE=unavailable start_server npx next start -p $PORT
check "simulert kildefeil: /dashboard 200 med «Kildefeil (unavailable)» og ingen kort" "$(get /dashboard)/$(grep -c 'Kildefeil (unavailable)' /tmp/qa-demo.txt)/$(grep -o 'href="/opportunities/[a-z0-9-]*"' /tmp/qa-demo.txt | wc -l)" "200/1/0"
check "simulert kildefeil: detaljside 200 med feilmelding" "$(get /opportunities/demo-001)/$(grep -c 'Kildefeil (unavailable)' /tmp/qa-demo.txt)" "200/1"
echo
[ "$fails" -eq 0 ] && echo "DEMOMODUS: ALLE KONTROLLER BESTÅTT" || echo "DEMOMODUS: $fails KONTROLL(ER) FEILET"
exit "$fails"

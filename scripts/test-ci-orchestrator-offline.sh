#!/usr/bin/env bash
# Tørrkjøring av scripts/ci-supabase-local.sh UTEN Docker/Supabase: `npx supabase` og `docker` er EMULERT (tests/ci/emulated-cli) mot en isolert
# PostgreSQL-klynge, og den emulerte «stakken» skriver ut falske, gjenkjennbare nøkler. Beviser orkestreringen og at ingenting hemmelig-liknende når
# stdout/jobbsammendrag/rapport. Forventet utfall: L1/L2/L7 bestått, L3a FEILET (Auth/PostgREST finnes ikke i emuleringen), L3b BESTÅTT (kjører ekte i en midlertidig PostgreSQL-klynge), L3 samlet FEILET, samlet IKKE FULLT BESTÅTT.
# Dette er IKKE L1–L3/L7 mot ekte Supabase. Kjører en ekte `npm run build`.
set -uo pipefail
cd "$(dirname "$0")/.."
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
[ -x "$PGBIN/initdb" ] || { echo "Fant ikke PostgreSQL-binærer (sett PGBIN)"; exit 2; }
ROOT="$(pwd)"; TMP="$(mktemp -d /tmp/scout-orch-XXXXXX)"
if [ "$(id -u)" = "0" ]; then chown postgres:postgres "$TMP"; chmod 755 "$TMP"; RUN() { runuser -u postgres -- "$@"; }; else RUN() { "$@"; }; fi
PORT=$(( 20000 + RANDOM % 20000 ))
cleanup() { RUN "$PGBIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT
RUN "$PGBIN/initdb" -D "$TMP/data" -A trust -U postgres --no-sync >/dev/null
RUN "$PGBIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -c listen_addresses=127.0.0.1 -c unix_socket_directories=$TMP -c fsync=off" -l "$TMP/log" -w start >/dev/null
"$PGBIN/psql" "postgres://postgres@127.0.0.1:$PORT/postgres" -q -At -c "create role anon nologin noinherit; create role authenticated nologin noinherit; create role service_role nologin noinherit bypassrls" >/dev/null
export EMU_PORT="$PORT" EMU_DB=scout_emu EMU_MIG="$ROOT/supabase/migrations" EMU_SEED="$ROOT/supabase/seed.sql" EMU_SHIM="$ROOT/tests/db/support/supabase-shim.sql" EMU_ORIG_PATH="$PATH"
export PATH="$ROOT/tests/ci/emulated-cli:$PGBIN:$PATH"
export GITHUB_STEP_SUMMARY="$TMP/summary.md"; : > "$GITHUB_STEP_SUMMARY"
OUT="$TMP/stdout.txt"
bash scripts/ci-supabase-local.sh > "$OUT" 2>&1; rc=$?
echo "exit-kode fra orkestreringen: $rc"
fails=0
chk() { if eval "$2"; then echo "PASS  $1"; else echo "FAIL  $1"; fails=$((fails+1)); fi; }
ALL="$OUT $GITHUB_STEP_SUMMARY"
chk "ingen falsk nøkkel/passord i stdout eller jobbsammendrag" '! grep -q -E "sentinel0[0-9]+|FAKEpw|FAKEHEADER|FAKEPAYLOAD" $ALL'
chk "ingen JWT-/sb_secret-/tilkoblings-URL-mønster i utskriften" '! grep -q -E "eyJ[A-Za-z0-9_-]{10,}\.eyJ|sb_(secret|publishable)_|postgres(ql)?://" $ALL'
chk "rapporten er skrevet (stdout og sammendrag er like)" 'grep -q "^## Samlet:" "$OUT" && diff -q <(grep -v "^exit-kode" "$OUT") "$GITHUB_STEP_SUMMARY" >/dev/null'
chk "L1 bestått i emuleringen" 'grep -q "^## L1 .*: BESTÅTT" "$OUT"'
chk "L2 bestått i emuleringen" 'grep -q "^## L2 .*: BESTÅTT" "$OUT"'
chk "L3a (stakken) FEILET i emuleringen uten Auth/PostgREST" 'grep -q "^## L3a .*: FEILET" "$OUT"'
chk "L3b rapporteres separat og BESTÅTT (ekte isolert klynge), merket IKKE Supabase" 'grep -q "^## L3b .*IKKE Supabase.*: BESTÅTT" "$OUT" && grep -q "6 av 6 navngitte oppgraderingstester kjørt og bestått (IKKE Supabase-stakken" "$OUT"'
chk "L3 samlet regnes IKKE som bestått når L3a feiler, selv om L3b består" '! grep -q "^## L3 samlet.*: BESTÅTT" "$OUT"'
chk "samlet er IKKE FULLT BESTÅTT og exit-koden er ≠ 0" 'grep -q "^## Samlet: IKKE FULLT BESTÅTT" "$OUT" && [ "$rc" -ne 0 ]'
chk "åpne kontroller L4–L6 og hosted er oppført som ÅPEN" 'grep -q "L4 innlogging.*ÅPEN" "$OUT" && grep -q "Hosted Supabase.*ÅPEN" "$OUT"'
echo; sed -n '1,60p' "$OUT"
[ "$fails" -eq 0 ] && echo "ORKESTRERING (EMULERT): ALLE KONTROLLER BESTÅTT" || echo "ORKESTRERING (EMULERT): $fails KONTROLL(ER) FEILET"
exit "$fails"

#!/usr/bin/env bash
# Kjører scripts/qa-upgrade-check.sh (L2-logikken) UTEN Docker/Supabase: `npx supabase` og `docker exec … pg_dump` er EMULERT mot en
# isolert, midlertidig PostgreSQL-klynge (tests/ci/emulated-cli). Dette avslører utdaterte forventninger i skriptet, men er IKKE L2:
# ekte Supabase CLI, migrasjonsmotor og containere er ikke med. Berører ingen eksisterende database.
set -euo pipefail
cd "$(dirname "$0")/.."
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
[ -x "$PGBIN/initdb" ] || { echo "Fant ikke PostgreSQL-binærer (sett PGBIN)"; exit 2; }
ROOT="$(pwd)"; TMP="$(mktemp -d /tmp/scout-emu-XXXXXX)"
if [ "$(id -u)" = "0" ]; then chown postgres:postgres "$TMP"; chmod 755 "$TMP"; RUN() { runuser -u postgres -- "$@"; }; else RUN() { "$@"; }; fi
PORT=$(( 20000 + RANDOM % 20000 ))
cleanup() { RUN "$PGBIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT
RUN "$PGBIN/initdb" -D "$TMP/data" -A trust -U postgres --no-sync >/dev/null
RUN "$PGBIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -c listen_addresses=127.0.0.1 -c unix_socket_directories=$TMP -c fsync=off" -l "$TMP/log" -w start >/dev/null
"$PGBIN/psql" "postgres://postgres@127.0.0.1:$PORT/postgres" -q -At -c "create role anon nologin noinherit; create role authenticated nologin noinherit; create role service_role nologin noinherit bypassrls" >/dev/null
export EMU_PORT="$PORT" EMU_DB=scout_emu EMU_MIG="$ROOT/supabase/migrations" EMU_SEED="$ROOT/supabase/seed.sql" EMU_SHIM="$ROOT/tests/db/support/supabase-shim.sql" EMU_ORIG_PATH="$PATH"
export PATH="$ROOT/tests/ci/emulated-cli:$PGBIN:$PATH" QA_OUT="$TMP" EMU_DUMP_CTR="$TMP/dumpcount"
# QA_SCRIPT: alternativt skript (f.eks. forrige versjon for før-/etter-sammenligning). EMU_DUMP_FAULT*: feilinnsetting for pg_dump (se tests/ci/emulated-cli/docker).
bash "${QA_SCRIPT:-scripts/qa-upgrade-check.sh}"

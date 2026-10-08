#!/usr/bin/env bash
# DEV-005B0: gjør den betrodde skriveveien (DEC-029) tilgjengelig mot LOKAL Supabase.
# Aktiverer innlogging for databaserollen `scout_ingest` med et tilfeldig passord og skriver tilkoblingsstrengen til
# .env.local (gitignorert) som SCOUT_INGEST_DATABASE_URL. Passordet skrives aldri ut. Nekter å kjøre mot ikke-lokal database.
# Hosted: se README («Hosted oppsett av scout_ingest»); denne skriptet brukes ikke der.
set -euo pipefail
cd "$(dirname "$0")/.."
DB_URL="$(npx supabase status -o env 2>/dev/null | sed -n 's/^DB_URL="\{0,1\}\([^"]*\)"\{0,1\}$/\1/p')"
[ -n "$DB_URL" ] || { echo "Lokal Supabase kjører ikke (npx supabase start)"; exit 2; }
case "$DB_URL" in *127.0.0.1*|*localhost*) ;; *) echo "Nekter å kjøre mot ikke-lokal database"; exit 2;; esac
PW="$(head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')"
psql "$DB_URL" -q -v ON_ERROR_STOP=1 -c "alter role scout_ingest login password '$PW'"
HOSTPART="$(printf '%s' "$DB_URL" | sed -E 's#^[a-z]+://[^@]*@##')"
SCHEME="$(printf '%s' "$DB_URL" | sed -E 's#^([a-z]+)://.*#\1#')"
URL="${SCHEME}://scout_ingest:${PW}@${HOSTPART}"
touch .env.local
grep -v '^SCOUT_INGEST_DATABASE_URL=' .env.local > .env.local.tmp || true
printf 'SCOUT_INGEST_DATABASE_URL=%s\n' "$URL" >> .env.local.tmp
mv .env.local.tmp .env.local
echo "OK: SCOUT_INGEST_DATABASE_URL skrevet til .env.local (lokal database). Start appen på nytt for å ta den i bruk."

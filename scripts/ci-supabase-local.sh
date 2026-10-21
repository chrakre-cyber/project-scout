#!/usr/bin/env bash
# L1–L3 og L7 mot en LOKAL Supabase-stakk (Docker) på en GitHub-runner. Kjøres av .github/workflows/supabase-local.yml, kan også kjøres lokalt med Docker.
# Ikke hosted Supabase: skriptet bruker bare `supabase start` (lokal stakk) og nekter alt annet. Ingen secrets inn; ingen nøkler ut.
#   L1  supabase start + db reset fra tom database, migrasjonene registrert i rekkefølge, versjoner noteres
#   L2  scripts/qa-upgrade-check.sh (oppgraderingstester; destruktivt for den lokale databasen)
#   L3a scripts/test-db.sh (hele DB-suiten mot ekte Auth/PostgREST); hoppede tester regnes IKKE som bestått
#   L3b de seks navngitte oppgraderingstestene i en SEPARAT midlertidig PostgreSQL-klynge (scripts/ci/run-l3b.sh; IKKE Supabase). Samlet L3 = PASS bare når L3a har ingen feil/uventede hopp og hver av de seks er faktisk bestått i L3b
#   L7  npm run build + scripts/qa-secret-scan.sh (repo, historikk, build-artefakter, faktiske lokale nøkler)
# Utskrift: bare en SANERT rapport (scripts/ci/evaluate.mjs + sanitize.mjs). Rå utskrift fra underskript ligger i en privat midlertidig
# katalog og skrives aldri til logg, jobbsammendrag eller artefakt. Aldri `set -x`, `env`, `supabase status` uten fil, `docker logs`/`inspect`.
# Tidsgrenser per trinn summerer til 79 min inkl. L3b (jobbgrensen er 90 min), slik at rapporten alltid rekker å skrives.
# Exit 0 bare hvis L1, L2, L3 og L7 alle er BESTÅTT; feil, hoppede og ikke kjørte kontroller gir exit 1.
set -uo pipefail
cd "$(dirname "$0")/.."
export SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 NEXT_TELEMETRY_DISABLED=1 CI=true
W="$(mktemp -d)"; chmod 700 "$W"; : > "$W/literals"
stop_stack() { timeout 120 npx supabase stop --no-backup >/dev/null 2>&1 || true; }
cleanup() { stop_stack; rm -rf "$W"; }
trap cleanup EXIT
SAN() { node scripts/ci/sanitize.mjs --literals "$W/literals"; }
run() { # navn tidsgrense(s) kommando… → $W/navn.out og $W/navn.rc (rå utskrift forlater aldri $W)
  local n="$1" t="$2"; shift 2
  timeout "$t" "$@" > "$W/$n.out" 2>&1; echo $? > "$W/$n.rc"
}
mask() { # registrer en hemmelig verdi: GitHub-maskering + egen sanering
  local v="$1"; [ "${#v}" -ge 8 ] || return 0
  printf '%s\n' "$v" >> "$W/literals"
  [ "${GITHUB_ACTIONS:-}" = "true" ] && echo "::add-mask::$v"
  return 0
}

# --- forhåndssjekk (verktøyversjoner; ingen hemmeligheter)
{
  echo "node $(node -v 2>&1 | head -1)"
  echo "$(docker --version 2>&1 | head -1)"
  echo "$(psql --version 2>&1 | head -1)"
  echo "supabase CLI $(timeout 60 npx supabase --version 2>/dev/null | head -1)"
  echo "OS $(uname -sr)"
} > "$W/preflight.txt"
for tool in docker psql node; do command -v "$tool" >/dev/null 2>&1 || { echo "Mangler $tool på runneren" >&2; echo 127 > "$W/start.rc"; }; done

ALL_VERSIONS="$(ls supabase/migrations/*.sql | sed -e 's#.*/##' -e 's/_.*//' | sort | paste -sd, -)"

# --- L1
if [ ! -s "$W/start.rc" ]; then
  run start 600 npx supabase start
  if [ "$(cat "$W/start.rc")" = "0" ]; then
    # Nøkler leses fra status (til fil, aldri til logg) og maskeres umiddelbart.
    npx supabase status -o env > "$W/status.env" 2>/dev/null || true
    while IFS= read -r line; do
      val="${line#*=}"; val="${val%\"}"; val="${val#\"}"
      case "${line%%=*}" in *KEY*|*SECRET*|*PASSWORD*|*TOKEN*|DB_URL) mask "$val" ;; esac
    done < "$W/status.env"
    DB_URL="$(sed -n 's/^DB_URL="\{0,1\}\([^"]*\)"\{0,1\}$/\1/p' "$W/status.env")"
    API_URL="$(sed -n 's/^API_URL="\{0,1\}\([^"]*\)"\{0,1\}$/\1/p' "$W/status.env")"
    PUBLISHABLE_KEY="$(sed -n 's/^PUBLISHABLE_KEY="\{0,1\}\([^"]*\)"\{0,1\}$/\1/p' "$W/status.env")"
    case "$DB_URL" in *127.0.0.1*|*localhost*) ;; *) echo "Nekter å fortsette: DB_URL er ikke lokal" >&2; echo 2 > "$W/reset.rc"; DB_URL="" ;; esac
    if [ -n "$DB_URL" ]; then
      run reset 420 npx supabase db reset
      if [ "$(cat "$W/reset.rc")" = "0" ]; then
        psql "$DB_URL" -At -q -c "select string_agg(version, ',' order by version) from supabase_migrations.schema_migrations" 2>/dev/null | head -1 > "$W/migrations.txt"
        echo "$ALL_VERSIONS" >> "$W/migrations.txt"
        psql "$DB_URL" -At -q -c "select split_part(version(), ' on ', 1)" 2>/dev/null | head -1 > "$W/pgversion.txt"
        docker ps --format '{{.Image}}' 2>/dev/null | grep -i -E 'supabase|postgres|postgrest|gotrue|auth|kong' | sort -u > "$W/images.txt"
      fi
    fi
  fi
fi

# --- L2 (kun hvis L1 startet stakken)
if [ "$(cat "$W/reset.rc" 2>/dev/null)" = "0" ]; then
  QA_OUT="$W" run l2 1500 bash scripts/qa-upgrade-check.sh
  # --- L3 (qa:migrations avslutter med ren database fra alle migrasjoner)
  run l3cmd 720 bash scripts/test-db.sh --reporter=json --outputFile="$W/l3.json"
  mv "$W/l3cmd.rc" "$W/l3.rc"; rm -f "$W/l3cmd.out"
  # --- L7: build (med lokal URL og publishable key, som en ekte build) og secret-skann
  NEXT_PUBLIC_SUPABASE_URL="$API_URL" NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$PUBLISHABLE_KEY" run build 480 npm run build
  run l7 300 bash scripts/qa-secret-scan.sh
fi

# --- L3b: de seks oppgraderingstestene i en SEPARAT midlertidig PostgreSQL-klynge (ikke Supabase). Uavhengig av stakken; manglende PostgreSQL-binærer ⇒ IKKE KJØRT (ingen installasjon).
bash scripts/ci/run-l3b.sh "$W" > /dev/null 2>&1 || true

# --- sanert rapport (eneste utskrift); jobbsammendrag får samme sanerte tekst
node scripts/ci/evaluate.mjs "$W" > "$W/report.txt"; rc=$?
cat "$W/report.txt"
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then cat "$W/report.txt" >> "$GITHUB_STEP_SUMMARY"; fi
exit "$rc"

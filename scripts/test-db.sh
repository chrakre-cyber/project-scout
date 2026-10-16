#!/usr/bin/env bash
# Kjører DB-/RLS-integrasjonstester mot lokal Supabase (`npx supabase start`).
# Leser lokale utviklingsverdier fra `supabase status` uten å skrive dem ut.
set -euo pipefail
status="$(npx supabase status -o env)"
get() { printf '%s\n' "$status" | sed -n "s/^$1=\"\{0,1\}\([^\"]*\)\"\{0,1\}$/\1/p"; }
export SUPABASE_TEST_URL="$(get API_URL)"
export SUPABASE_TEST_PUBLISHABLE_KEY="$(get PUBLISHABLE_KEY)"
export SUPABASE_TEST_DB_URL="$(get DB_URL)"
# Vent til Auth og PostgREST svarer (tjenestene kobler til på nytt etter `supabase db reset`).
ready() { [ "$(curl -s -o /dev/null -w '%{http_code}' -H "apikey: $SUPABASE_TEST_PUBLISHABLE_KEY" "$SUPABASE_TEST_URL$1" || true)" = "200" ]; }
for _ in $(seq 1 60); do
  ready /auth/v1/health && ready /rest/v1/ && break
  sleep 1
done
exec npx vitest run --config vitest.db.config.ts "$@"

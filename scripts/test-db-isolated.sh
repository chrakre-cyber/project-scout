#!/usr/bin/env bash
# SEARCH-005: DB-/RLS-tester mot en ISOLERT, midlertidig PostgreSQL-klynge opprettet for kjøringen (ingen Docker, ingen Supabase).
#   - oppretter en ny klynge i en midlertidig katalog, lytter KUN på 127.0.0.1 med tilfeldig port, trust-autentisering
#   - installerer tests/db/support/supabase-shim.sql, anvender alle migrasjoner i rekkefølge, kjører tester med syntetiske data
#   - stopper og sletter klyngen til slutt. Berører ingen eksisterende database. Krever PostgreSQL-binærer (initdb, pg_ctl, psql) og
#     at skriptet kan kjøre dem som en ikke-root-bruker (bruker `runuser -u postgres` når det kjøres som root).
# Dette er IKKE lokal Supabase: Auth (GoTrue) og PostgREST er ikke med. Se tests/db/support/supabase-shim.sql.
# Bruk: bash scripts/test-db-isolated.sh [vitest-argumenter]
set -euo pipefail
cd "$(dirname "$0")/.."
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
[ -x "$PGBIN/initdb" ] || { echo "Fant ikke PostgreSQL-binærer (sett PGBIN)"; exit 2; }
ROOT="$(pwd)"
TMP="$(mktemp -d /tmp/scout-pg-XXXXXX)"
if [ "$(id -u)" = "0" ]; then
  chown postgres:postgres "$TMP"; chmod 755 "$TMP"
  RUN() { runuser -u postgres -- "$@"; }
else
  RUN() { "$@"; }
fi
PORT=$(( 20000 + RANDOM % 20000 ))
DB="scout_test_$RANDOM$RANDOM"
cleanup() { RUN "$PGBIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT
RUN "$PGBIN/initdb" -D "$TMP/data" -A trust -U postgres --no-sync >/dev/null
RUN "$PGBIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -c listen_addresses=127.0.0.1 -c unix_socket_directories=$TMP -c fsync=off" -l "$TMP/log" -w start >/dev/null
URL="postgres://postgres@127.0.0.1:$PORT/$DB"
PSQL() { "$PGBIN/psql" "postgres://postgres@127.0.0.1:$PORT/$1" -v ON_ERROR_STOP=1 -q -At "${@:2}"; }
PSQL postgres -c "create database $DB" >/dev/null
PSQL "$DB" -f tests/db/support/supabase-shim.sql >/dev/null
# Etterlign Supabase: migrasjoner kjøres som postgres-eier. MIGRATIONS_DIR kan peke på en endret kopi (mutasjonskontroll).
MIG="${MIGRATIONS_DIR:-supabase/migrations}"
NEW_MIGRATION="20261015090000_search005_search_drafts.sql"
apply() { PSQL "$DB" -f "$1" >/dev/null; echo "migrasjon anvendt: $(basename "$1")"; }
# 1) alle eldre migrasjoner (tilstand før SEARCH-005)
for f in $(ls "$MIG"/*.sql | sort); do
  [ "$(basename "$f")" = "$NEW_MIGRATION" ] && continue
  # ECON-005c refererer search_drafts (SEARCH-005, som i denne testrekkefølgen anvendes sist): anvendes etter SEARCH-005-trinnet nedenfor.
  case "$(basename "$f")" in *_econ005c_*) continue ;; esac
  apply "$f"
done
# 2) eldre data (gamle agenter, aktive og pauset, og en avsluttet kjøring) + øyeblikksbilde av alt eksisterende
PSQL "$DB" -f supabase/seed.sql >/dev/null
FIRM_A=00000000-0000-4000-a000-00000000000a
PSQL "$DB" >/dev/null <<SQL
insert into public.search_agents (dealership_id, name, filters, assumptions, active) values
  ('$FIRM_A','Legacy aktiv 1','{"make":"Volkswagen"}','{"retail":{"expectedRetailTotal":{"amountMinor":"39990000","currency":"NOK"},"priceBasis":{"vat":"included","registrationTaxes":"included"}},"minimumContribution":{"amountMinor":"3000000","currency":"NOK"},"preparationReserve":{"amount":{"amountMinor":"1500000","currency":"NOK"},"vatBasis":"ex_vat"}}',true),
  ('$FIRM_A','Legacy aktiv 2','{"make":"Audi"}','{"retail":{"expectedRetailTotal":{"amountMinor":"39990000","currency":"NOK"},"priceBasis":{"vat":"included","registrationTaxes":"included"}},"minimumContribution":{"amountMinor":"3000000","currency":"NOK"},"preparationReserve":{"amount":{"amountMinor":"1500000","currency":"NOK"},"vatBasis":"ex_vat"}}',true),
  ('$FIRM_A','Legacy pauset','{"make":"BMW"}','{}',false);
insert into public.search_runs (agent_id, request_token, provider)
  select id, gen_random_uuid(), 'synthetic-demo' from public.search_agents where name = 'Legacy aktiv 1';
update public.search_runs set status = 'failed', error_code = 'unavailable';
SQL
SNAPSHOT_SQL="
select md5(string_agg(x, '|' order by x)) from (
  select 'agents:' || row(a.*)::text x from public.search_agents a
  union all select 'runs:' || row(r.*)::text from public.search_runs r
  union all select 'results:' || row(r.*)::text from public.search_run_results r
  union all select 'dealerships:' || row(d.*)::text from public.dealerships d
  union all select 'members:' || row(m.*)::text from public.dealership_members m
  union all select 'constraint:' || conrelid::regclass || ':' || conname || ':' || pg_get_constraintdef(oid) from pg_constraint
    where conrelid in ('public.search_agents'::regclass, 'public.search_runs'::regclass, 'public.search_run_results'::regclass, 'public.dealerships'::regclass, 'public.dealership_members'::regclass)
  union all select 'trigger:' || tgrelid::regclass || ':' || pg_get_triggerdef(oid) from pg_trigger
    where not tgisinternal and tgrelid in ('public.search_agents'::regclass, 'public.search_runs'::regclass, 'public.search_run_results'::regclass)
  union all select 'policy:' || tablename || ':' || policyname || ':' || cmd || ':' || coalesce(qual,'') || ':' || coalesce(with_check,'') from pg_policies
    where tablename in ('search_agents','search_runs','search_run_results','dealerships','dealership_members')
  union all select 'grant:' || table_name || ':' || grantee || ':' || privilege_type from information_schema.role_table_grants
    where table_schema = 'public' and table_name in ('search_agents','search_runs','search_run_results','dealerships','dealership_members')
  union all select 'colgrant:' || table_name || ':' || grantee || ':' || privilege_type || ':' || column_name from information_schema.column_privileges
    where table_schema = 'public' and table_name in ('search_agents','search_runs','search_run_results') and grantee in ('anon','authenticated','scout_ingest','service_role')
  union all select 'function:' || p.oid::regprocedure || ':' || md5(pg_get_functiondef(p.oid)) from pg_proc p
    where pronamespace = 'private'::regnamespace and proname !~ '^(jsonb_|reg_bounds|search_spec|search_drafts)'
) s"
BEFORE="$(PSQL "$DB" -c "$SNAPSHOT_SQL")"
# 3) SEARCH-005-migrasjonen
[ -f "$MIG/$NEW_MIGRATION" ] && apply "$MIG/$NEW_MIGRATION"
AFTER="$(PSQL "$DB" -c "$SNAPSHOT_SQL")"
for f in $(ls "$MIG"/*_econ005c_*.sql 2>/dev/null | sort); do apply "$f"; done
# Et tomt øyeblikksbilde (spørringsfeil) kan aldri telle som «uendret» (CI-001: ingen vakuøse sammenligninger).
[ -n "$BEFORE" ] && [ -n "$AFTER" ] || { echo "OPPGRADERING FEIL: tomt øyeblikksbilde"; exit 3; }
if [ "$BEFORE" = "$AFTER" ]; then echo "OPPGRADERING OK: eksisterende agenter, kjøringer, constraints, triggere, policyer, rettigheter og funksjoner er uendret ($BEFORE)"; else echo "OPPGRADERING FEIL: øyeblikksbildet endret seg ($BEFORE -> $AFTER)"; exit 3; fi
export SUPABASE_TEST_DB_URL="$URL"
export SUPABASE_TEST_URL="http://127.0.0.1:9"        # ingen Auth/PostgREST finnes; brukes bare av assertLocal()
export SUPABASE_TEST_PUBLISHABLE_KEY="not-used"
export SCOUT_DB_ISOLATED=1
if [ -n "${SCOUT_ISOLATED_CMD:-}" ]; then
  # Annen kontroll mot samme isolerte klynge (f.eks. nettleserflyten). Kommandoen får SUPABASE_TEST_DB_URL.
  bash -c "$SCOUT_ISOLATED_CMD"
else
  npx vitest run --config vitest.db.config.ts "$@"
fi

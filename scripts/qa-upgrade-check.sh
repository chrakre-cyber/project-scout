#!/usr/bin/env bash
# QA-001: kontroll av migrasjonskjeden mot LOKAL Supabase. Destruktiv for lokal database (kjører db reset).
#   1. Ren oppbygging (alle migrasjoner) → lagrer schema-dump som referanse.
#   2. Oppgradering: DEV-002-database med DEV-002-data → DEV-004-migrasjon. Verifiserer data og schema-likhet mot (1).
#   2b. Oppgradering fra eksisterende DEV-004-schema (QA-001-FIX): aktive agenter beholdes, funksjonen byttes, schema identisk.
#   2c. Oppgradering fra hosted-tilstand (DEV-004 + QA-001-FIX) til DEV-005: agentdata bevart, nye tabeller med RLS, schema identisk.
#   3. Feilscenario: DEV-002-data som bryter DEV-004-reglene. Migrasjonen skal feile ATOMISK (ingen delvis anvendelse).
# Avslutter med ren database fra alle migrasjoner. Exit-kode ≠ 0 ved feil.
set -uo pipefail
cd "$(dirname "$0")/.."
export SUPABASE_TELEMETRY_DISABLED=1
# Tilkobling utledes fra `supabase status` (lokal stack); ingen passord lagres i repoet.
DB_URL="$(npx supabase status -o env 2>/dev/null | sed -n 's/^DB_URL="\{0,1\}\([^"]*\)"\{0,1\}$/\1/p')"
[ -n "$DB_URL" ] || { echo "Lokal Supabase kjører ikke (npx supabase start)"; exit 2; }
case "$DB_URL" in *127.0.0.1*|*localhost*) ;; *) echo "Nekter å kjøre mot ikke-lokal database"; exit 2;; esac
PSQL="psql $DB_URL -At -q -v ON_ERROR_STOP=1"
V002=20261005090000
V004=20261006090000
V004FIX=20261006100000
FIRM_A=00000000-0000-4000-a000-00000000000a
FIRM_B=00000000-0000-4000-a000-00000000000b
OUT="${QA_OUT:-/tmp}"
fails=0
check() { if [ "$2" = "$3" ]; then echo "PASS  $1"; else echo "FAIL  $1 (forventet «$3», fikk «$2»)"; fails=$((fails+1)); fi; }
# pg_dump legger inn et tilfeldig \restrict-token per kjøring; det filtreres bort.
dump() { docker exec supabase_db_project-scout pg_dump -U postgres --schema-only --no-owner --schema=public --schema=private postgres | grep -v -E '^\\(un)?restrict '; }
reset_to() { npx supabase db reset ${1:+--version "$1"} 2>&1 | grep -E "Applying migration|ERROR" | sed 's/^/      /'; }

echo "== 1. Ren oppbygging (alle migrasjoner)"
reset_to "" 
dump > "$OUT/schema-clean.sql"
check "migrasjoner anvendt i rekkefølge" "$($PSQL -c "select string_agg(version, ',' order by version) from supabase_migrations.schema_migrations")" "20261005090000,20261006090000,20261006100000,20261007090000"
check "seed: to syntetiske firma, ingen brukere eller agenter" "$($PSQL -c "select (select count(*) from public.dealerships)||'/'||(select count(*) from auth.users)||'/'||(select count(*) from public.search_agents)")" "2/0/0"
check "RLS på alle tabeller" "$($PSQL -c "select count(*) from pg_class where relnamespace='public'::regnamespace and relkind='r' and relrowsecurity")" "5"

echo "== 2. Oppgradering fra DEV-002 med eksisterende agentdata"
reset_to "$V002"
check "DEV-002-database mangler DEV-004-constraints" "$($PSQL -c "select count(*) from pg_constraint where conname in ('search_agents_filters_valid','search_agents_ready_when_active')")" "0"
$PSQL <<SQL
insert into public.search_agents (dealership_id, name, filters, assumptions, active) values
 ('$FIRM_A','UI-agent fra DEV-002 (paused)','{"make":"Volkswagen","model":"Golf","yearMin":null,"yearMax":null,"maxMileageKm":null,"fuels":[],"transmissions":[],"bodyTypes":[],"countryCodes":[],"maxPrice":null}','{}',false),
 ('$FIRM_A','Pris i DEV-002-format (paused)','{"make":"BMW","maxPrice":{"amountMinor":"4000000","currency":"EUR"}}','{}',false),
 ('$FIRM_A','Aktiv uten krav (kun via direkte API i DEV-002)','{"make":"Audi"}','{}',true),
 ('$FIRM_B','Aktiv bred uten krav','{"bodyTypes":["suv"]}','{}',true);
SQL
reset_notice="$(npx supabase migration up 2>&1 | grep -E "Applying|ERROR" | tr '\n' ' ')"
check "DEV-004-migrasjonen lykkes på DEV-002-data" "$(echo "$reset_notice" | grep -c ERROR)" "0"
check "UI-agent fra DEV-002 beholdt uendret (paused, versjon 1)" "$($PSQL -c "select active||'/'||version from public.search_agents where name like 'UI-agent%'")" "false/1"
check "pris i DEV-002-format beholdt (paused, versjon 1)" "$($PSQL -c "select active||'/'||version from public.search_agents where name like 'Pris i DEV-002%'")" "false/1"
check "aktive agenter uten krav ble pauset (versjon økt)" "$($PSQL -c "select count(*) from public.search_agents where active")" "0"
check "ingen agenter slettet" "$($PSQL -c "select count(*) from public.search_agents")" "4"
check "DEV-004-constraints finnes etter oppgradering" "$($PSQL -c "select count(*) from pg_constraint where conname in ('search_agents_filters_valid','search_agents_assumptions_valid','search_agents_ready_when_active')")" "3"
dump > "$OUT/schema-upgraded.sql"
if diff -q "$OUT/schema-clean.sql" "$OUT/schema-upgraded.sql" >/dev/null; then echo "PASS  schema etter oppgradering er identisk med ren oppbygging"; else echo "FAIL  schema avviker:"; diff "$OUT/schema-clean.sql" "$OUT/schema-upgraded.sql" | head -20; fails=$((fails+1)); fi

echo "== 2b. Oppgradering fra eksisterende DEV-004-schema (QA-001-FIX) med aktive agenter"
reset_to "$V004"
check "DEV-004-database har gammel grensefunksjon (uten F1/F2-vern)" "$($PSQL -c "select (prosrc like '%insufficient_privilege%')::text from pg_proc where proname='enforce_active_agent_limit'")" "false"
$PSQL <<SQL
insert into public.search_agents (dealership_id, name, filters, assumptions, active)
select '$FIRM_A', 'Aktiv '||g, '{"make":"Volkswagen"}',
 '{"retail":{"expectedRetailTotal":{"amountMinor":"39990000","currency":"NOK"},"priceBasis":{"vat":"included","registrationTaxes":"included"}},"minimumContribution":{"amountMinor":"3000000","currency":"NOK"},"preparationReserve":{"amount":{"amountMinor":"0","currency":"NOK"},"vatBasis":"ex_vat"}}',
 true from generate_series(1, 10) g;
insert into public.search_agents (dealership_id, name, filters, assumptions) values ('$FIRM_A', 'Pauset utkast', '{"make":"BMW"}', '{}');
SQL
npx supabase migration up 2>&1 | grep -E "Applying|ERROR" | sed 's/^/      /'
check "10 aktive agenter beholdt aktive (ingen pauset av QA-001-FIX)" "$($PSQL -c "select count(*) from public.search_agents where active")" "10"
check "alle 11 agenter beholdt, versjoner uendret" "$($PSQL -c "select count(*)||'/'||max(version) from public.search_agents")" "11/1"
check "ny migrasjon registrert" "$($PSQL -c "select count(*) from supabase_migrations.schema_migrations where version='20261006100000'")" "1"
check "funksjonen har nå F1- og F2-vernene" "$($PSQL -c "select (prosrc like '%insufficient_privilege%' and prosrc like '%repeatable read%')::text from pg_proc where proname='enforce_active_agent_limit'")" "true"
check "grensen virker etter oppgradering: 11. aktivering avvises av grensetriggeren" "$($PSQL -c "update public.search_agents set active = true where name = 'Pauset utkast'" 2>&1 | grep -c 'active_agent_limit: maks 10 aktive')" "1"
check "fortsatt nøyaktig 10 aktive etter avvist forsøk" "$($PSQL -c "select count(*) from public.search_agents where active")" "10"
dump > "$OUT/schema-upgraded-004.sql"
if diff -q "$OUT/schema-clean.sql" "$OUT/schema-upgraded-004.sql" >/dev/null; then echo "PASS  schema etter oppgradering fra DEV-004 er identisk med ren oppbygging"; else echo "FAIL  schema avviker (fra DEV-004):"; diff "$OUT/schema-clean.sql" "$OUT/schema-upgraded-004.sql" | head -20; fails=$((fails+1)); fi

echo "== 2c. Oppgradering fra DEV-004 + QA-001-FIX (hosted-tilstand) til DEV-005 med eksisterende agentdata"
reset_to "$V004FIX"
check "database før DEV-005 har ingen søkekjøringstabeller" "$($PSQL -c "select count(*) from pg_class where relnamespace='public'::regnamespace and relname in ('search_runs','search_run_results')")" "0"
$PSQL <<SQL
insert into public.search_agents (dealership_id, name, filters, assumptions, active)
select '$FIRM_A', 'Aktiv '||g, '{"make":"Volkswagen"}',
 '{"retail":{"expectedRetailTotal":{"amountMinor":"39990000","currency":"NOK"},"priceBasis":{"vat":"included","registrationTaxes":"included"}},"minimumContribution":{"amountMinor":"3000000","currency":"NOK"},"preparationReserve":{"amount":{"amountMinor":"0","currency":"NOK"},"vatBasis":"ex_vat"}}',
 true from generate_series(1, 10) g;
insert into public.search_agents (dealership_id, name, filters, assumptions) values ('$FIRM_A', 'Pauset utkast', '{"make":"BMW"}', '{}');
SQL
before="$($PSQL -c "select md5(string_agg(id||name||filters::text||assumptions::text||active||version, ',' order by id)) from public.search_agents")"
npx supabase migration up 2>&1 | grep -E "Applying|ERROR" | sed 's/^/      /'
check "DEV-005-migrasjonen registrert" "$($PSQL -c "select count(*) from supabase_migrations.schema_migrations where version='20261007090000'")" "1"
check "agentdata byte-for-byte uendret (11 agenter, 10 aktive)" "$($PSQL -c "select md5(string_agg(id||name||filters::text||assumptions::text||active||version, ',' order by id)) from public.search_agents")" "$before"
check "nye tabeller har RLS" "$($PSQL -c "select count(*) from pg_class where relnamespace='public'::regnamespace and relname in ('search_runs','search_run_results') and relrowsecurity")" "2"
check "søkekjøring kan startes for eksisterende aktiv agent etter oppgradering" "$($PSQL -c "insert into public.search_runs (agent_id, request_token, provider) select id, gen_random_uuid(), 'synthetic-demo' from public.search_agents where name = 'Aktiv 1' returning status")" "running"
check "aktiv agent kan ikke ha to pågående kjøringer" "$($PSQL -c "insert into public.search_runs (agent_id, request_token, provider) select id, gen_random_uuid(), 'synthetic-demo' from public.search_agents where name = 'Aktiv 1'" 2>&1 | grep -c 'search_runs_one_running_per_agent')" "1"
$PSQL -c "delete from public.search_runs"
dump > "$OUT/schema-upgraded-fix.sql"
if diff -q "$OUT/schema-clean.sql" "$OUT/schema-upgraded-fix.sql" >/dev/null; then echo "PASS  schema etter oppgradering fra QA-001-FIX er identisk med ren oppbygging"; else echo "FAIL  schema avviker (fra QA-001-FIX):"; diff "$OUT/schema-clean.sql" "$OUT/schema-upgraded-fix.sql" | head -20; fails=$((fails+1)); fi

echo "== 3. Feilscenario: DEV-002-data som bryter DEV-004-reglene → atomisk feil"
reset_to "$V002"
$PSQL -c "insert into public.search_agents (dealership_id, name, filters, assumptions) values ('$FIRM_A','Gammel reserve som beløp','{\"make\":\"VW\"}','{\"preparationReserve\":{\"amountMinor\":\"1500000\",\"currency\":\"NOK\"}}')"
out="$(npx supabase migration up 2>&1)"
check "migrasjonen feiler (ugyldig eldre data stoppes, ikke ignorert)" "$(echo "$out" | grep -c -E "violated|ERROR")" "1"
check "ingen delvis anvendelse: ingen DEV-004-funksjoner" "$($PSQL -c "select count(*) from pg_proc where pronamespace='private'::regnamespace and proname in ('jnull','agent_ready','agent_filters_valid')")" "0"
check "ingen delvis anvendelse: DEV-002-constraint intakt" "$($PSQL -c "select count(*) from pg_constraint where conname='search_agents_money_format'")" "1"
check "ingen delvis anvendelse: migrasjon ikke registrert" "$($PSQL -c "select count(*) from supabase_migrations.schema_migrations where version='20261006090000'")" "0"
check "ingen delvis anvendelse: DEV-005-tabeller finnes ikke" "$($PSQL -c "select count(*) from pg_class where relnamespace='public'::regnamespace and relname = 'search_runs'")" "0"
check "dataene er uendret" "$($PSQL -c "select count(*) from public.search_agents")" "1"

echo "== 4. Avslutter med ren database fra alle migrasjoner"
reset_to ""
check "ren database etter avslutning" "$($PSQL -c "select string_agg(version, ',' order by version) from supabase_migrations.schema_migrations")" "20261005090000,20261006090000,20261006100000,20261007090000"
echo
[ "$fails" -eq 0 ] && echo "MIGRASJONSKJEDE: ALLE KONTROLLER BESTÅTT" || echo "MIGRASJONSKJEDE: $fails KONTROLL(ER) FEILET"
exit "$fails"

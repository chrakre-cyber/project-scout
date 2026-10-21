#!/usr/bin/env bash
# Mutasjonskontroll av L6-testene (CI-001 trinn 1): bryter bevisst RLS/rettigheter i midlertidige migrasjonskopier og krever at tests/db/rest-isolation.test.ts feiler for hver.
# Kjører mot ekte PostgREST-binær + isolert PostgreSQL (scripts/test-rest-isolation-offline.sh) — IKKE Supabase. Exit ≠ 0 hvis en mutasjon IKKE oppdages.
set -uo pipefail
cd "$(dirname "$0")/.."
: "${POSTGREST_BIN:?Sett POSTGREST_BIN}"
W="$(mktemp -d /tmp/scout-restmut-XXXXXX)"; trap 'rm -rf "$W"' EXIT
miss=0
run() { # navn fil gammel ny
  local name="$1" file="$2" old="$3" new="$4"
  rm -rf "$W"/*; cp supabase/migrations/*.sql "$W"/
  python3 - "$W/$file" "$old" "$new" <<'PY'
import sys
p, old, new = sys.argv[1:4]; t = open(p).read(); assert old in t, old; open(p, "w").write(t.replace(old, new, 1))
PY
  out="$(MIGRATIONS_DIR=$W OFFLINE_FILTER=L6 bash scripts/test-rest-isolation-offline.sh 2>&1 | grep -E 'Tests +')"
  if echo "$out" | grep -q failed; then echo "OPPDAGET  $name — $out"; else echo "IKKE OPPDAGET  $name — $out"; miss=$((miss+1)); fi
}
D=20261015090000_search005_search_drafts.sql; E=20261023090000_econ005c_dealer_economics_inputs.sql
run "M1 search_drafts: select-policy åpen for alle firmaer" $D "using (dealership_id in (select private.my_dealership_ids()));

create policy search_drafts_insert_own" "using (true);

create policy search_drafts_insert_own"
run "M2 search_drafts: dealership_id skrivbar for klienten (insert)" $D "grant insert (name, spec) on" "grant insert (name, spec, dealership_id) on"
run "M3 dealer_economics_inputs: select-policy åpen" $E "create policy dealer_economics_inputs_select_own on public.dealer_economics_inputs
  for select to authenticated using (dealership_id in (select private.my_dealership_ids()));" "create policy dealer_economics_inputs_select_own on public.dealer_economics_inputs
  for select to authenticated using (true);"
# (En åpen UPDATE-policy alene er en ekvivalent mutant: PostgreSQL krever også at raden er synlig via SELECT-policyen, så forsvaret er dobbelt. Observerbar variant under.)
run "M4 dealer_economics_inputs: dealership_id skrivbar ved UPDATE (flytte rad til annet firma)" $E "grant update (payload, context) on public.dealer_economics_inputs" "grant update (payload, context, dealership_id) on public.dealer_economics_inputs"
run "M5 dealer_economics_inputs: DELETE tillatt for innloggede" $E "grant select on public.dealer_economics_inputs to authenticated;" "grant select, delete on public.dealer_economics_inputs to authenticated;"
run "M6 dealer_economics_profiles: select-policy åpen" $E "create policy dealer_economics_profiles_select_own on public.dealer_economics_profiles
  for select to authenticated using (dealership_id in (select private.my_dealership_ids()));" "create policy dealer_economics_profiles_select_own on public.dealer_economics_profiles
  for select to authenticated using (true);"
run "M7 dealer_economics_profiles: dealership_id skrivbar (insert)" $E "grant insert (payload) on public.dealer_economics_profiles" "grant insert (payload, dealership_id) on public.dealer_economics_profiles"
run "M8 anon får lese search_drafts" $D "grant select on public.search_drafts to authenticated;" "grant select on public.search_drafts to authenticated, anon;
create policy search_drafts_anon_read on public.search_drafts for select to anon using (true);"
echo; [ "$miss" -eq 0 ] && echo "L6-MUTASJONER: ALLE OPPDAGET" || echo "L6-MUTASJONER: $miss IKKE OPPDAGET"
exit "$miss"

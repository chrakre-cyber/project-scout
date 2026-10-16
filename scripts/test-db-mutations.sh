#!/usr/bin/env bash
# SEARCH-005: mutasjonskontroll. Bryter bevisst SEARCH-005-migrasjonen (i en midlertidig kopi) på seks måter og krever at
# DB-testene feiler for hver. Viser at testene faktisk fanger konflikt, isolasjon, kolonnerettigheter og strukturvalidering.
# Kjører mot den isolerte klyngen (scripts/test-db-isolated.sh). Exit ≠ 0 hvis en mutasjon IKKE oppdages.
set -uo pipefail
cd "$(dirname "$0")/.."
W="$(mktemp -d /tmp/scout-mut-XXXXXX)"; trap 'rm -rf "$W"' EXIT
miss=0
run() {
  local name="$1" old="$2" new="$3"
  rm -rf "$W"/*; cp supabase/migrations/*.sql "$W"/
  python3 - "$W/20261015090000_search005_search_drafts.sql" "$old" "$new" <<'PY'
import sys
p, old, new = sys.argv[1:4]; t = open(p).read(); assert old in t, old; open(p, "w").write(t.replace(old, new, 1))
PY
  out="$(MIGRATIONS_DIR=$W bash scripts/test-db-isolated.sh tests/db/search-drafts.test.ts 2>&1 | grep -E 'Tests +')"
  if echo "$out" | grep -q failed; then echo "OPPDAGET  $name — $out"; else echo "IKKE OPPDAGET  $name — $out"; miss=$((miss+1)); fi
}
run "M1 konfliktsjekk fjernet" "if new.base_version is distinct from old.version then" "if false then"
run "M2 select-policy åpen (alle firmaer lesbare)" "using (dealership_id in (select private.my_dealership_ids()));

create policy search_drafts_insert_own" "using (true);

create policy search_drafts_insert_own"
run "M3 dealership_id skrivbar for klienten" "grant insert (name, spec) on" "grant insert (name, spec, dealership_id) on"
run "M4 strukturvalidering av" "  if not private.jsonb_exact_keys(j, array['schema','modelVersion','vehicle'" "  return true;
  if not private.jsonb_exact_keys(j, array['schema','modelVersion','vehicle'"
run "M5 insert-trigger setter ikke firma fra membership" "new.dealership_id := (select dm.dealership_id from public.dealership_members dm where dm.user_id = uid);" "null;"
run "M6 version skrivbar for klienten" "grant update (name, spec, base_version) on" "grant update (name, spec, base_version, version) on"
exit $miss

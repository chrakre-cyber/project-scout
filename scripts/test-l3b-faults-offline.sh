#!/usr/bin/env bash
# Feilinnsetting for L3b (CI-001-FIX2) i en EKTE midlertidig PostgreSQL-klynge (scripts/test-db-isolated.sh via scripts/ci/run-l3b.sh) — IKKE Supabase og ikke Actions.
# Kjører de seks navngitte oppgraderingstestene normalt og med bevisst innsatte feil, og krever at vurderingen (scripts/ci/evaluate.mjs --l3b) gir riktig utfall:
#   normal ⇒ PASS · mutert migrasjon ⇒ FAIL · endret øyeblikksbilde ⇒ FAIL (klyngeskriptet exit 3) · filter som utelater en test ⇒ FAIL · filter uten treff ⇒ FAIL ·
#   for bredt filter (uventede tester) ⇒ FAIL · manglende PostgreSQL-binærer ⇒ IKKE KJØRT. Krever PostgreSQL-binærer lokalt (som test-db-isolated.sh).
set -uo pipefail
cd "$(dirname "$0")/.."
fails=0
chk() { if [ "$2" = "ok" ]; then echo "PASS  $1"; else echo "FAIL  $1"; fails=$((fails+1)); fi; }
mutated_dir() { # fil gammel ny → ny migrasjonskatalog (kopi); skriver stien
  local d; d="$(mktemp -d)"; cp supabase/migrations/*.sql "$d"/
  python3 - "$d/$1" "$2" "$3" <<'PY'
import sys
p, old, new = sys.argv[1:4]; t = open(p).read(); assert old in t, old; open(p, "w").write(t.replace(old, new, 1))
PY
  echo "$d"
}
phase() { # navn forventet-status [miljø…]  (kjører L3b med gitt miljø og vurderer)
  local name="$1" want="$2"; shift 2
  local W; W="$(mktemp -d)"
  ( env "$@" bash scripts/ci/run-l3b.sh "$W" ) > /dev/null 2>&1
  local out status
  out="$(node scripts/ci/evaluate.mjs --l3b "$W")"; status="$(printf '%s\n' "$out" | sed -n 's/^L3B_STATUS=//p')"
  echo "== $name: L3b-vurdering=$status  (rc=$(cat "$W/l3b.rc" 2>/dev/null || echo -), binærer=$([ -e "$W/l3b.nobinaries" ] && echo mangler || echo ok))"
  chk "$name ⇒ $want" "$([ "$status" = "$want" ] && echo ok)"
  LAST_OUT="$out"; LAST_DIR="$W"
}
phase "normal (seks bestått i ekte isolert klynge)" PASS
printf '%s\n' "$LAST_OUT" | sed 's/^/   /'
M1="$(mutated_dir 20261021090000_econ005b_derived_economics_rights.sql "where provider = 'synthetic-demo' and version = 1 and environment = 'synthetic';" "where true;")"
phase "mutert ECON-005b-migrasjon (legacy-profiler får rettigheter)" FAIL MIGRATIONS_DIR="$M1"
chk "  … den navngitte ECON-005b-testen er rapportert som feilet" "$(printf '%s' "$LAST_OUT" | grep -q 'FEILET i L3b: tests/db/econ005b-rights.test.ts' && echo ok)"
M2="$(mutated_dir 20261015090000_search005_search_drafts.sql "create table" "alter table public.search_agents add column zz_mut int default 1;
create table")"
phase "endret øyeblikksbilde (oppgradering endrer eksisterende data)" FAIL MIGRATIONS_DIR="$M2"
chk "  … klyngeskriptet avsluttet ≠ 0 med «OPPGRADERING FEIL»" "$([ "$(cat "$LAST_DIR/l3b.rc")" != "0" ] && grep -q '^OPPGRADERING FEIL' "$LAST_DIR/l3b.out" && echo ok)"
phase "filter utelater ECON-005b-testen (bare fem kjørt)" FAIL L3B_FILTER="oppgradering fra eldre tilstand"
chk "  … manglende/ikke kjørt test er navngitt" "$(printf '%s' "$LAST_OUT" | grep -q -E 'MANGLER i L3b|IKKE KJØRT' && echo ok)"
phase "filter uten treff (ingen tester)" FAIL L3B_FILTER="finnes-ikke-xyzzy"
phase "for bredt filter (uventede tester kjørt)" FAIL L3B_FILTER="ECON-005b"
chk "  … uventet test er rapportert" "$(printf '%s' "$LAST_OUT" | grep -q 'UVENTET test kjørt i L3b' && echo ok)"
phase "PostgreSQL-binærer mangler" NOT_RUN PGBIN=/finnes/ikke
rm -rf "$M1" "$M2"
echo
[ "$fails" -eq 0 ] && echo "L3B-FEILINNSETTING: ALLE KONTROLLER BESTÅTT" || echo "L3B-FEILINNSETTING: $fails KONTROLL(ER) FEILET"
exit "$fails"

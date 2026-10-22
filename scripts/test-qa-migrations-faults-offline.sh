#!/usr/bin/env bash
# Feilinnsetting for schema-dumpene i scripts/qa-upgrade-check.sh (CI-001-FIX1), UTEN Docker/Supabase: pg_dump EMULERES (tests/ci/emulated-cli) og
# feiler på ulike måter MENS ALLE ANDRE KONTROLLER LYKKES. For hver modus kreves at BÅDE migrasjonsskriptet (exit ≠ 0, ingen sluttmelding om bestått, FAIL-linje om dumpen)
# OG L2-vurderingen (scripts/ci/evaluate.mjs → evaluateL2) avviser resultatet, at ingen rå dump-linje havner i utskriften, og at normaltilfellet består.
# Dette er EMULERING, ikke L2 mot ekte Supabase. QA_SCRIPT=<fil> kjører et annet skript (f.eks. forrige versjon) for før-/etter-sammenligning; da er avvisning IKKE forventet.
set -uo pipefail
cd "$(dirname "$0")/.."
SCRIPT="${QA_SCRIPT:-scripts/qa-upgrade-check.sh}"
BEFORE_MODE="${BEFORE_MODE:-0}"
fails=0
chk() { if [ "$2" = "ok" ]; then echo "PASS  $1"; else echo "FAIL  $1"; fails=$((fails+1)); fi; }
L2VERDICT() { node --input-type=module -e '
import { readFileSync } from "node:fs";
import { evaluateL2 } from "./scripts/ci/evaluate.mjs";
const r = evaluateL2(readFileSync(process.argv[1], "utf8"), Number(process.argv[2]));
console.log(r.status);' "$1" "$2"; }
run_mode() { # navn  EMU_DUMP_FAULT  FROM  TO  forventet(avvist|bestått)
  local name="$1" mode="$2" from="$3" to="$4" want="$5" out rc l2 txt
  out="$(mktemp)"
  EMU_DUMP_FAULT="$mode" EMU_DUMP_FAULT_FROM="$from" EMU_DUMP_FAULT_TO="$to" QA_SCRIPT="$SCRIPT" bash scripts/test-qa-migrations-offline.sh > "$out" 2>&1; rc=$?
  l2="$(L2VERDICT "$out" "$rc")"
  echo "== $name  (modus=${mode:-ingen}, kall $from–$to): skript exit=$rc, L2-vurdering=$l2, FAIL-linjer=$(grep -c '^FAIL ' "$out"), PASS-linjer=$(grep -c '^PASS ' "$out")"
  if [ "$want" = "avvist" ]; then
    if [ "$BEFORE_MODE" = "1" ]; then
      echo "   (FØR-modus: registrerer bare utfallet)"
    else
      chk "$name: migrasjonsskriptet avviser (exit ≠ 0)" "$([ "$rc" -ne 0 ] && echo ok)"
      chk "$name: skriptet sier ikke «ALLE KONTROLLER BESTÅTT»" "$(grep -q 'MIGRASJONSKJEDE: ALLE KONTROLLER BESTÅTT' "$out" || echo ok)"
      chk "$name: minst én FAIL-linje om schema-dumpen" "$(grep -q '^FAIL .*\(dump\|schema\)' "$out" && echo ok)"
      chk "$name: L2-vurderingen avviser (FAIL)" "$([ "$l2" = "FAIL" ] && echo ok)"
      chk "$name: ingen rå dump-linje i utskriften" "$(grep -q -E 'partial_dump_sentinel|^CREATE (TABLE|POLICY|FUNCTION)|^SET (statement_timeout|lock_timeout)' "$out" || echo ok)"
    fi
  else
    chk "$name: normaltilfelle: skriptet består (exit 0, sluttmelding)" "$([ "$rc" -eq 0 ] && grep -q 'MIGRASJONSKJEDE: ALLE KONTROLLER BESTÅTT' "$out" && echo ok)"
    chk "$name: normaltilfelle: L2-vurderingen gir PASS" "$([ "$l2" = "PASS" ] && echo ok)"
  fi
  rm -f "$out"
}
run_mode "normal"                         ""            1 0 "bestått"
run_mode "tom dump, exit≠0 (alle dumper)"       empty-fail   1 999999 avvist
run_mode "delvis dump + exit≠0 (alle dumper)"   partial-fail 1 999999 avvist
run_mode "tom dump, exit 0 (alle dumper)"       empty-ok     1 999999 avvist
run_mode "avkortet dump, exit 0 (alle dumper)"  partial-ok   1 999999 avvist
run_mode "bare referansedumpen feiler (tom)"    empty-fail   1 1 avvist
run_mode "bare én oppgradert dump feiler (delvis)" partial-fail 3 3 avvist
echo
[ "$fails" -eq 0 ] && echo "SCHEMA-DUMP-FEILINNSETTING: ALLE KONTROLLER BESTÅTT" || echo "SCHEMA-DUMP-FEILINNSETTING: $fails KONTROLL(ER) FEILET"
[ "$BEFORE_MODE" = "1" ] && exit 0
exit "$fails"

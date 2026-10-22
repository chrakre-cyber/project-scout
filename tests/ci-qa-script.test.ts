/**
 * STATISK kontroll av scripts/qa-upgrade-check.sh (CI-001-FIX1): schema-dumper skal ha kontrollert status og innhold før sammenligning.
 * Dette er teksttester; selve oppførselen under feil er innsatt og prøvd i emuleringen (scripts/test-qa-migrations-faults-offline.sh) — ikke her og ikke på ekte Supabase.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const src = readFileSync(join(__dirname, "../scripts/qa-upgrade-check.sh"), "utf8");
const code = src.split("\n").filter((l) => !/^\s*#/.test(l)).join("\n");

describe("qa-upgrade-check.sh: schema-dumper", () => {
  it("ingen dump lagres uten kontroll: alle dumper går via dump_to, aldri `dump > fil`", () => {
    expect(code).not.toMatch(/^\s*dump\s*> "\$OUT/m);
    expect(code.match(/^dump_to "\$OUT\/schema-[a-z0-9-]+\.sql"$/gm)).toHaveLength(6);
  });

  it("dump_to krever exit 0 gjennom hele pipelinen, ikke-tom utskrift og avslutningslinjen, og stiller feil (FAIL) uten gyldig fil", () => {
    const fn = /dump_to\(\) \{[\s\S]*?\n\}/.exec(code)![0];
    expect(fn).toMatch(/dump > "\$tmp" 2>\/dev\/null; rc=\$\?/);
    expect(fn).toMatch(/\[ "\$rc" -ne 0 \]/);
    expect(fn).toMatch(/\[ ! -s "\$tmp" \]/);
    expect(fn).toMatch(/PostgreSQL database dump complete/);
    expect(fn).toMatch(/echo "FAIL  schema-dump/);
    expect(fn).toMatch(/fails=\$\(\(fails\+1\)\)/);
    expect(fn).toMatch(/rm -f "\$f" "\$f\.ok"/); // gammel fil fra tidligere kjøring kan ikke gjenbrukes
  });

  it("alle fem sammenligninger går via same_schema, som krever gyldig dump på begge sider; bare der finnes diff", () => {
    expect(code.match(/^same_schema "\$OUT\/schema-clean\.sql" "\$OUT\/schema-[a-z0-9-]+\.sql" /gm)).toHaveLength(5);
    const fn = /same_schema\(\) \{[\s\S]*?\n\}/.exec(code)![0];
    expect(fn).toMatch(/\[ ! -f "\$1\.ok" \] \|\| \[ ! -f "\$2\.ok" \]/);
    const outside = code.replace(fn, "").replace(/dump_to\(\) \{[\s\S]*?\n\}/, "");
    expect(outside).not.toMatch(/\bdiff\b/);
  });

  it("rå diff skrives ikke ut uten uttrykkelig lokal opt-in (QA_SHOW_DIFF=1)", () => {
    const fn = /same_schema\(\) \{[\s\S]*?\n\}/.exec(code)![0];
    expect(fn).toMatch(/\[ "\$\{QA_SHOW_DIFF:-0\}" = "1" \] && diff/);
    expect(fn.match(/\bdiff\b[^\n]*\|\s*head/g)).toHaveLength(1);
  });
});

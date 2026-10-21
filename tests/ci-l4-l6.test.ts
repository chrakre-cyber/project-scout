/**
 * CI-001 trinn 1: vurderingen av L4a (innlogging/tokenvalidering, API) og L6 (firmaskille via PostgREST) og at testfilene og den fastlåste identitetslisten henger sammen.
 * STATISKE tester (fixtures og kildetekst) — de kjører ikke Supabase. Selve testene i tests/db/auth-gotrue.test.ts og rest-isolation.test.ts er prøvd mot en ekte
 * PostgREST-binær (scripts/test-rest-isolation-offline.sh; ikke Supabase) og kjøres mot ekte stakk først i neste Actions-kjøring.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { evaluateDir, evaluateGroup } from "../scripts/ci/evaluate.mjs";
import { e2eFiles } from "./ci/e2e-fixtures";
import { L46, l3bPass, l46Rows, sixWith, vitestJson, type TestRow } from "./ci/l3b-fixtures";

const rows = (over: (r: TestRow[]) => TestRow[] = (r) => r) => vitestJson(over(l46Rows()));
const named = (key: "L4a" | "L6", i: number) => L46[key][i]!.fullName;

describe("evaluateGroup", () => {
  it("alle navngitte tester bestått ⇒ PASS for begge grupper", () => {
    for (const k of ["L4a", "L6"] as const) expect(evaluateGroup(k, rows(), 0).status).toBe("PASS");
  });
  it("én feilet / hoppet / mangler ⇒ FAIL med navn (bare den aktuelle gruppen)", () => {
    const failed = rows((r) => r.map((t) => (t.fullName === named("L6", 3) ? { ...t, status: "failed" } : t)));
    expect(evaluateGroup("L6", failed, 1).status).toBe("FAIL");
    expect(evaluateGroup("L6", failed, 1).notes.join("\n")).toContain("FEILET");
    expect(evaluateGroup("L4a", failed, 1).status).toBe("PASS");
    const skipped = rows((r) => r.map((t) => (t.fullName === named("L4a", 0) ? { ...t, status: "skipped" } : t)));
    expect(evaluateGroup("L4a", skipped, 0).status).toBe("FAIL");
    const missing = rows((r) => r.filter((t) => t.fullName !== named("L6", 0)));
    const m = evaluateGroup("L6", missing, 0);
    expect(m.status).toBe("FAIL");
    expect(m.notes.join("\n")).toContain("MANGLER");
  });
  it("antall alene er ikke nok: omdøpt test, uventet ekstra test i filen eller test i feil fil ⇒ FAIL", () => {
    const renamed = rows((r) => r.map((t, i) => (i === 0 ? { ...t, fullName: `${t.fullName} (omdøpt)` } : t)));
    expect(evaluateGroup("L4a", renamed, 0).status).toBe("FAIL");
    const extra = rows((r) => [...r, { file: L46.L6[0]!.file, fullName: "L6 ekstra test", status: "passed" }]);
    const e = evaluateGroup("L6", extra, 0);
    expect(e.status).toBe("FAIL");
    expect(e.notes.join("\n")).toContain("UVENTET");
    let done = false;
    const wrongFile = rows((r) => r.map((t) => (!done && t.file.includes("rest-isolation") && (done = true) ? { ...t, file: "tests/db/annet.test.ts" } : t)));
    expect(evaluateGroup("L6", wrongFile, 0).status).toBe("FAIL");
  });
  it("ingen rapport / ugyldig rapport / ikke kjørt ⇒ FAIL eller NOT_RUN, aldri PASS", () => {
    expect(evaluateGroup("L6", null, 1).status).toBe("FAIL");
    expect(evaluateGroup("L6", "{", 1).status).toBe("FAIL");
    expect(evaluateGroup("L4a", null, null).status).toBe("NOT_RUN");
    expect(evaluateGroup("L6", vitestJson([]), 0).status).toBe("FAIL");
  });
});

describe("evaluateDir: L4a og L6 inngår i samlet utfall og rapporteres separat", () => {
  const dirs: string[] = [];
  afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });
  const l2Ok = "== 1\nPASS  a\n\nMIGRASJONSKJEDE: ALLE KONTROLLER BESTÅTT\n";
  const l7Ok = "PASS  x (0 treff)\n\nSECRET-SKANN: INGEN FUNN\n";
  const make = (l3rows: TestRow[], over: Record<string, string> = {}) => {
    const d = mkdtempSync(join(tmpdir(), "scout-l46-"));
    dirs.push(d);
    const files: Record<string, string> = { "start.rc": "0", "reset.rc": "0", "migrations.txt": "1,2\n1,2\n", "pgversion.txt": "PostgreSQL 17.0\n", "images.txt": "x/y:1\n", "l2.out": l2Ok, "l2.rc": "0", "l3.json": vitestJson(l3rows), "l3.rc": "0", "l7.out": l7Ok, "l7.rc": "0", "build.rc": "0", literals: "", ...l3bPass(), ...e2eFiles(), ...over };
    for (const [k, v] of Object.entries(files)) writeFileSync(join(d, k), v);
    return d;
  };
  const ok: TestRow = { file: "tests/db/rls.test.ts", fullName: "a", status: "passed" };

  it("alt bestått inkl. L4a og L6 ⇒ samlet PASS; rapporten har egne seksjoner", () => {
    const r = evaluateDir(make([ok, ...sixWith("skipped"), ...l46Rows()]));
    expect(r.verdict).toBe("PASS");
    expect(r.report).toMatch(/## L4a innlogging mot ekte GoTrue.*: BESTÅTT/);
    expect(r.report).toMatch(/## L6 firmaskille via ekte PostgREST.*: BESTÅTT/);
    expect(r.report).toMatch(/Hosted Supabase.*ÅPEN/);
  });
  it("L6-test feiler (resten bestått) ⇒ L6 FAIL, L3a FAIL og samlet ikke PASS", () => {
    const l = l46Rows().map((t, i) => (i === 15 ? { ...t, status: "failed" } : t));
    const r = evaluateDir(make([ok, ...sixWith("skipped"), ...l]));
    expect([r.results.L4a.status, r.results.L6.status]).toEqual(["PASS", "FAIL"]);
    expect(r.verdict).toBe("IKKE FULLT BESTÅTT");
  });
  it("l3.json uten L4a/L6-testene (f.eks. filene mangler) ⇒ begge FAIL og samlet ikke PASS, selv om L1/L2/L3/L7 er bestått", () => {
    const r = evaluateDir(make([ok, ...sixWith("skipped")]));
    expect([r.results.L4a.status, r.results.L6.status]).toEqual(["FAIL", "FAIL"]);
    expect(r.results.L3.status).toBe("PASS");
    expect(r.verdict).toBe("IKKE FULLT BESTÅTT");
  });
});

describe("testfilene og identitetslisten henger sammen (statisk kildetekst)", () => {
  const src = (f: string) => readFileSync(join(__dirname, "db", f), "utf8");
  const FILES = { L4a: "auth-gotrue.test.ts", L6: "rest-isolation.test.ts" } as const;
  it("antall it()-kall i hver fil = antall navngitte tester, og hvert navn er nøyaktig «describe-tittel it-tittel» i filen", () => {
    for (const k of ["L4a", "L6"] as const) {
      const text = src(FILES[k]);
      expect((text.match(/^\s*it(\.each)?\(/gm) ?? []).length).toBe(L46[k].length);
      const describes = [...text.matchAll(/describe\("([^"]+)"/g)].map((m) => m[1]!);
      const its = [...text.matchAll(/\bit\("([^"]+)"/g)].map((m) => m[1]!);
      expect(its.length).toBe(L46[k].length);
      const generated = new Set(describes.flatMap((d) => its.map((i) => `${d} ${i}`)));
      for (const t of L46[k]) expect(generated.has(t.fullName), t.fullName).toBe(true);
    }
  });
  it("testfilene bruker ikke service-role-nøkkel, skriver ikke ut hemmeligheter og feiler (ikke hopper over) uten Auth/PostgREST", () => {
    for (const f of Object.values(FILES)) {
      const text = src(f);
      expect(text).not.toMatch(/service_role|SERVICE_ROLE|sb_secret/i);
      expect(text).not.toMatch(/console\.(log|info|error|debug)/);
      expect(text).not.toMatch(/\bskipIf\b|\bit\.skip\b|\bdescribe\.skip\b|\.todo\(/);
      expect(text).toContain("assertLocal()");
    }
    const sh = readFileSync(join(__dirname, "../scripts/test-db.sh"), "utf8");
    expect(sh).toMatch(/export SUPABASE_TEST_JWT_SECRET="\$\(get JWT_SECRET\)"/);
    expect(sh).not.toMatch(/echo[^\n]*JWT_SECRET|printf[^\n]*JWT_SECRET/);
    expect(src("auth-gotrue.test.ts")).toMatch(/SUPABASE_TEST_JWT_SECRET/);
  });
  it("L6 dekker alle tre tabellene med både tillatte operasjoner i eget firma og avvisning på tvers av firma", () => {
    const text = src("rest-isolation.test.ts");
    for (const t of ["search_drafts", "dealer_economics_inputs", "dealer_economics_profiles"]) {
      expect(text, t).toContain(`"${t}`);
      expect(text, `eget firma ${t}`).toMatch(new RegExp(`describe\\("L6 ${t} — eget firma|describe\\("L6 ${t}`));
    }
    for (const m of ['"POST"', '"GET"', '"PATCH"', '"DELETE"']) expect(text).toContain(m);
    for (const needle of ["tokB", "tokLoner", "forfalsket", "dealership_id: fid", "42501", "23505"]) expect(text).toContain(needle);
  });
});

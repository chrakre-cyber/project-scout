/**
 * L3a/L3b-vurderingen (CI-001-FIX2): de seks navngitte oppgraderingstestene kan bare dekkes av en FAKTISK kjørt og bestått L3b i en separat PostgreSQL-klynge.
 * STATISKE enhetstester av vurderingslogikken (fixtures) — ikke kjøring mot Supabase og ikke selve klyngekjøringen (den er prøvd i scripts/test-l3b-faults-offline.sh).
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { combineL3, evaluateDir, evaluateL3a, evaluateL3b } from "../scripts/ci/evaluate.mjs";
import { SIX, filteredOut, l3bPass, l46Rows, sixWith, vitestJson, type TestRow } from "./ci/l3b-fixtures";

const real = (n: number): TestRow[] => Array.from({ length: n }, (_, i) => ({ file: "tests/db/rls.test.ts", fullName: `RLS test ${i}`, status: "passed" }));
const l3aFrom = (rows: TestRow[], rc = 0) => evaluateL3a(vitestJson(rows), rc);
const l3a = (extra: TestRow[] = []) => l3aFrom([...real(3), ...sixWith("skipped"), ...extra]);
const l3b = (rows: TestRow[], over: Record<string, unknown> = {}) => evaluateL3b({ report: vitestJson(rows), rc: 0, upgradeOk: true, pgVersion: "postgres (PostgreSQL) 16.14", ...over });
const good = () => l3b([...sixWith("passed"), ...filteredOut()]);

describe("de seks identifiserte testene", () => {
  it("listen har nøyaktig seks unike identiteter fra de to kjente filene", () => {
    expect(SIX).toHaveLength(6);
    expect(new Set(SIX.map((t) => `${t.file}::${t.fullName}`)).size).toBe(6);
    expect(SIX.filter((t) => t.file === "tests/db/data002d-field-map.test.ts")).toHaveLength(5);
    expect(SIX.filter((t) => t.file === "tests/db/econ005b-rights.test.ts")).toHaveLength(1);
  });
});

describe("L3a", () => {
  it("de seks hoppet over + resten bestått ⇒ SKIPPED (ikke PASS), seks kjente og ingen uventede", () => {
    const r = l3a();
    expect(r.status).toBe("SKIPPED");
    expect(r.knownSkipped).toHaveLength(6);
    expect(r.unknownSkipped).toHaveLength(0);
  });
  it("feilet test ⇒ FAIL; uventet hoppet test ⇒ SKIPPED med uventet-liste", () => {
    expect(l3aFrom([...real(2), { file: "tests/db/rls.test.ts", fullName: "x", status: "failed" }, ...sixWith("skipped")], 1).status).toBe("FAIL");
    const r = l3a([{ file: "tests/db/rls.test.ts", fullName: "uventet hopp", status: "skipped" }]);
    expect(r.status).toBe("SKIPPED");
    expect(r.unknownSkipped).toHaveLength(1);
  });
});

describe("L3b alene", () => {
  it("alle seks bestått, ingen andre kjørt (filtrerte tester er hoppet over av -t) ⇒ PASS, merket som IKKE Supabase", () => {
    const r = good();
    expect(r.status).toBe("PASS");
    expect(r.passedIds).toHaveLength(6);
    expect(r.notes.join("\n")).toMatch(/IKKE Supabase-stakken/);
    expect(r.notes.join("\n")).toMatch(/16\.14/);
  });
  it("én av de seks feilet ⇒ FAIL med navn", () => {
    const rows = sixWith("passed"); rows[2]!.status = "failed";
    const r = l3b(rows);
    expect(r.status).toBe("FAIL");
    expect(r.notes.join("\n")).toContain("FEILET i L3b");
    expect(r.passedIds).toHaveLength(5);
  });
  it("én av de seks hoppet over / todo / pending ⇒ FAIL (faktisk kjørt og bestått kreves)", () => {
    for (const st of ["skipped", "todo", "pending"]) {
      const rows = sixWith("passed"); rows[0]!.status = st;
      expect(l3b(rows).status, st).toBe("FAIL");
    }
  });
  it("én av de seks mangler i rapporten ⇒ FAIL (antallet 5 passerer ikke, selv om ingen feilet)", () => {
    const r = l3b(sixWith("passed").slice(1));
    expect(r.status).toBe("FAIL");
    expect(r.notes.join("\n")).toContain("MANGLER i L3b");
  });
  it("antall 6 er ikke nok: seks bestått tester med ANDRE navn (eller omdøpt test) ⇒ FAIL", () => {
    const renamed = sixWith("passed").map((t, i) => (i === 0 ? { ...t, fullName: t.fullName + " (omdøpt)" } : t));
    expect(l3b(renamed).status).toBe("FAIL");
    const wrongFile = sixWith("passed").map((t, i) => (i === 5 ? { ...t, file: "tests/db/annen.test.ts" } : t));
    expect(l3b(wrongFile).status).toBe("FAIL");
    const others = real(6);
    const r = l3b(others);
    expect(r.status).toBe("FAIL");
    expect(r.passedIds).toHaveLength(0);
  });
  it("uventet test kjørt i L3b (bestått eller feilet) ⇒ FAIL; filtrerte (hoppet) utenfor de seks er ikke et problem", () => {
    expect(l3b([...sixWith("passed"), { file: "tests/db/econ005b-rights.test.ts", fullName: "ekstra", status: "passed" }]).status).toBe("FAIL");
    expect(l3b([...sixWith("passed"), { file: "tests/db/econ005b-rights.test.ts", fullName: "ekstra", status: "failed" }]).status).toBe("FAIL");
    expect(l3b([...sixWith("passed"), ...filteredOut(50)]).status).toBe("PASS");
  });
  it("vitest-exit ≠ 0, manglende «OPPGRADERING OK», ugyldig rapport ⇒ FAIL", () => {
    expect(l3b(sixWith("passed"), { rc: 1 }).status).toBe("FAIL");
    expect(l3b(sixWith("passed"), { upgradeOk: false }).status).toBe("FAIL");
    expect(evaluateL3b({ report: "{", rc: 1, upgradeOk: true }).status).toBe("FAIL");
    expect(evaluateL3b({ report: null, rc: 1, upgradeOk: true }).status).toBe("FAIL");
  });
  it("PostgreSQL-binærer mangler ⇒ NOT_RUN (IKKE KJØRT), ikke FAIL og aldri PASS; ikke kjørt ⇒ NOT_RUN", () => {
    const r = evaluateL3b({ report: null, rc: null, binariesMissing: true, upgradeOk: false });
    expect(r.status).toBe("NOT_RUN");
    expect(r.notes.join("\n")).toMatch(/installeres ikke automatisk/);
    expect(evaluateL3b({ report: null, rc: null, upgradeOk: false }).status).toBe("NOT_RUN");
  });
});

describe("samlet L3 (L3a + L3b)", () => {
  it("L3a uten feil + hopp kun blant de seks + L3b PASS ⇒ PASS, med tydelig tekst om separat klynge", () => {
    const r = combineL3(l3a(), good());
    expect(r.status).toBe("PASS");
    expect(r.notes.join("\n")).toMatch(/separat klynge, ikke Supabase/);
  });
  it("L3b mangler / ikke kjørt (manglende binærer) ⇒ NOT_RUN, aldri PASS", () => {
    const nb = evaluateL3b({ report: null, rc: null, binariesMissing: true, upgradeOk: false });
    expect(combineL3(l3a(), nb).status).toBe("NOT_RUN");
  });
  it("L3b FAIL ⇒ FAIL; L3a FAIL ⇒ FAIL selv om L3b består", () => {
    const rows = sixWith("passed"); rows[1]!.status = "failed";
    expect(combineL3(l3a(), l3b(rows)).status).toBe("FAIL");
    expect(combineL3(l3aFrom([...real(2), { file: "tests/db/rls.test.ts", fullName: "x", status: "failed" }, ...sixWith("skipped")], 1), good()).status).toBe("FAIL");
  });
  it("uventet hopp i L3a dekkes ikke av L3b ⇒ SKIPPED (ikke PASS)", () => {
    const r = combineL3(l3a([{ file: "tests/db/rls.test.ts", fullName: "uventet hopp", status: "skipped" }]), good());
    expect(r.status).toBe("SKIPPED");
  });
  it("L3b kan bare dekke de seks: et hoppet navn utenfor listen får aldri dekning, selv med seks bestått i L3b", () => {
    const a = l3a([{ file: "tests/db/rls.test.ts", fullName: "ikke en av de seks", status: "skipped" }]);
    expect(combineL3(a, good()).status).not.toBe("PASS");
  });
  it("kjent hopp i L3a som L3b ikke har bestått (defensiv dekningskontroll) ⇒ FAIL", () => {
    const fake = { status: "PASS", notes: ["x"], passedIds: SIX.slice(1).map((t) => `${t.file}::${t.fullName}`) } as ReturnType<typeof evaluateL3b>;
    const r = combineL3(l3a(), fake);
    expect(r.status).toBe("FAIL");
    expect(r.notes.join("\n")).toMatch(/ikke bestått i L3b/);
  });
  it("L3a uten hopp (alle seks kjørte der) + L3b PASS ⇒ PASS; L3a ikke kjørt ⇒ NOT_RUN", () => {
    expect(combineL3(l3aFrom([...real(3), ...sixWith("passed")]), good()).status).toBe("PASS");
    expect(combineL3(evaluateL3a(null, null), good()).status).toBe("NOT_RUN");
  });
});

describe("evaluateDir: rapport og samlet utfall", () => {
  const dirs: string[] = [];
  afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });
  const l2Ok = "== 1\nPASS  a\n\nMIGRASJONSKJEDE: ALLE KONTROLLER BESTÅTT\n";
  const l7Ok = "PASS  x (0 treff)\n\nSECRET-SKANN: INGEN FUNN\n";
  const base = (over: Record<string, string | null> = {}) => {
    const files: Record<string, string | null> = {
      "start.rc": "0", "reset.rc": "0", "migrations.txt": "1,2\n1,2\n", "pgversion.txt": "PostgreSQL 17.0\n", "images.txt": "x/y:1\n", "l2.out": l2Ok, "l2.rc": "0",
      "l3.json": vitestJson([...real(3), ...sixWith("skipped"), ...l46Rows()]), "l3.rc": "0", "l7.out": l7Ok, "l7.rc": "0", "build.rc": "0", literals: "", ...l3bPass(), ...over,
    };
    const d = mkdtempSync(join(tmpdir(), "scout-l3b-"));
    dirs.push(d);
    for (const [k, v] of Object.entries(files)) if (v !== null) writeFileSync(join(d, k), v);
    return d;
  };
  it("alt bestått inkl. L3b ⇒ samlet PASS; L3a og L3b rapporteres hver for seg, L3b merket som ikke Supabase", () => {
    const r = evaluateDir(base());
    expect(r.verdict).toBe("PASS");
    expect(r.results.L3a!.status).toBe("SKIPPED");
    expect(r.results.L3b!.status).toBe("PASS");
    expect(r.report).toMatch(/## L3a DB-suiten mot Supabase-stakken.*: HOPPET OVER \(ikke bestått\)/);
    expect(r.report).toMatch(/## L3b seks navngitte oppgraderingstester i SEPARAT midlertidig PostgreSQL-klynge \(IKKE Supabase\): BESTÅTT/);
    expect(r.report).toMatch(/## L3 samlet \(L3a \+ L3b\): BESTÅTT/);
    expect(r.report).toMatch(/L4 nettleserdel.*ÅPEN/);
  });
  it("uten L3b-filer (ikke kjørt) ⇒ L3b IKKE KJØRT og samlet IKKE FULLT BESTÅTT", () => {
    const r = evaluateDir(base({ "l3b.json": null, "l3b.rc": null, "l3b.out": null, "l3b.pg.txt": null }));
    expect(r.results.L3b!.status).toBe("NOT_RUN");
    expect(r.results.L3.status).toBe("NOT_RUN");
    expect(r.verdict).toBe("IKKE FULLT BESTÅTT");
  });
  it("l3b.nobinaries ⇒ IKKE KJØRT og hindrer PASS, selv om resten er vellykket", () => {
    const r = evaluateDir(base({ "l3b.json": null, "l3b.rc": null, "l3b.out": null, "l3b.nobinaries": "" }));
    expect(r.results.L3b!.status).toBe("NOT_RUN");
    expect(r.verdict).toBe("IKKE FULLT BESTÅTT");
    expect(r.report).toMatch(/L3b .*: IKKE KJØRT/);
  });
  it("«OPPGRADERING FEIL» fra klyngeskriptet eller manglende OK ⇒ L3b FAIL og samlet ikke PASS", () => {
    for (const out of ["OPPGRADERING FEIL: øyeblikksbildet endret seg (a -> b)\n", "ingenting\n"]) {
      const r = evaluateDir(base({ "l3b.out": out, "l3b.rc": "3" }));
      expect(r.results.L3b!.status).toBe("FAIL");
      expect(r.verdict).toBe("IKKE FULLT BESTÅTT");
    }
  });
  it("én av de seks feiler i L3b ⇒ samlet FAIL/ikke PASS og navnet står i rapporten", () => {
    const rows = sixWith("passed"); rows[3]!.status = "failed";
    const r = evaluateDir(base({ "l3b.json": vitestJson(rows), "l3b.rc": "1" }));
    expect(r.verdict).toBe("IKKE FULLT BESTÅTT");
    expect(r.report).toContain("FEILET i L3b");
  });
});

import { expect, it } from 'vitest';
import { evaluateL7 } from '../scripts/ci/evaluate.mjs'; // reviewerens regresjonstest (uendret) følger under; supplementet står nederst

it('does not pass L7 when the build was never recorded', () => {
  const scan = 'PASS scan (0 treff)\nSECRET-SKANN: INGEN FUNN\n';
  expect(evaluateL7(scan, 0, null).status).not.toBe('PASS');
});

// ---- Utviklerens supplement (CI-001-FIX1): evaluateDir med ellers vellykkede resultater, men uten registrert build; og at bestått build fortsatt gir PASS.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe } from "vitest";
import { evaluateDir } from '../scripts/ci/evaluate.mjs';
import { l3bPass, l46Rows, vitestJson as vj } from './ci/l3b-fixtures';

const okScan = "PASS scan (0 treff)\nSECRET-SKANN: INGEN FUNN\n";
const l2Ok = "== 1\nPASS  a\n\nMIGRASJONSKJEDE: ALLE KONTROLLER BESTÅTT\n";
const l3Ok = vj([{ file: "tests/db/rls.test.ts", fullName: "a", status: "passed" }, ...l46Rows()]);
const base: Record<string, string> = { ...l3bPass(), "start.rc": "0", "reset.rc": "0", "migrations.txt": "1,2\n1,2\n", "pgversion.txt": "PostgreSQL 17.0\n", "images.txt": "x/y:1\n", "l2.out": l2Ok, "l2.rc": "0", "l3.json": l3Ok, "l3.rc": "0", "l7.out": okScan, "l7.rc": "0", "build.rc": "0", literals: "" };

describe("L7 krever registrert, vellykket build", () => {
  const dirs: string[] = [];
  afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });
  const make = (over: Record<string, string | null>) => {
    const d = mkdtempSync(join(tmpdir(), "scout-l7-"));
    dirs.push(d);
    for (const [k, v] of Object.entries({ ...base, ...over })) if (v !== null) writeFileSync(join(d, k), v);
    return d;
  };

  it("build exit 0 og rent skann ⇒ L7 PASS og samlet PASS (normaltilfelle bevart)", () => {
    const r = evaluateDir(make({}));
    expect(r.results.L7.status).toBe("PASS");
    expect(r.verdict).toBe("PASS");
  });
  it("build.rc mangler, alt annet vellykket ⇒ L7 ikke PASS, forklart, og samlet ikke PASS", () => {
    const r = evaluateDir(make({ "build.rc": null }));
    expect(r.results.L1.status).toBe("PASS");
    expect(r.results.L2.status).toBe("PASS");
    expect(r.results.L3.status).toBe("PASS");
    expect(r.results.L7.status).not.toBe("PASS");
    expect(r.results.L7.notes.join("\n")).toMatch(/build ble ikke registrert/);
    expect(r.verdict).not.toBe("PASS");
    expect(r.report).toMatch(/Samlet: IKKE FULLT BESTÅTT/);
  });
  it("uleselig/tom build.rc regnes som ikke registrert", () => {
    for (const v of ["", "abc\n"]) expect(evaluateDir(make({ "build.rc": v })).results.L7.status).not.toBe("PASS");
  });
  it("build feilet (exit 1 / tidsavbrudd 124) ⇒ L7 ikke PASS, og samlet ikke PASS", () => {
    for (const rc of ["1", "124"]) {
      const r = evaluateDir(make({ "build.rc": rc }));
      expect(r.results.L7.status).not.toBe("PASS");
      expect(r.results.L7.notes.join("\n")).toMatch(/build feilet/);
      expect(r.verdict).not.toBe("PASS");
    }
  });
  it("direkte: ukjent build (null) ⇒ ikke PASS; build 0 ⇒ PASS; feil i skannet slår fortsatt gjennom som FAIL", () => {
    expect(evaluateL7(okScan, 0, 0).status).toBe("PASS");
    expect(evaluateL7(okScan, 0, null).status).not.toBe("PASS");
    expect(evaluateL7(okScan.replace("PASS scan (0 treff)", "FAIL scan (1 treff, forventet 0)").replace("INGEN FUNN", "1 KONTROLL(ER) MED FUNN"), 1, 0).status).toBe("FAIL");
    expect(evaluateL7(null, null, 0).status).toBe("NOT_RUN");
  });
});

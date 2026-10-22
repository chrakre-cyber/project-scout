// Trinn 3: vurdering av L4b/L5a/L5b som egne løp med entydige sjekkidentiteter, og statiske krav til orkestreringen/workflowet.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { evaluateDir } from "../scripts/ci/evaluate.mjs";
import { J3, KEYS, PLAN, e2eFiles, e2eOutput } from "./ci/e2e-fixtures";

const dirs: string[] = [];
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });
const run = (files: Record<string, string>) => {
  const d = mkdtempSync(join(tmpdir(), "scout-e2e-int-"));
  dirs.push(d);
  for (const [k, v] of Object.entries(files)) writeFileSync(join(d, k), v);
  return evaluateDir(d);
};
const status = (r: ReturnType<typeof run>, k: string) => (r.results as Record<string, { status: string } | undefined>)[k]?.status;
const econ = (s: object) => e2eOutput("econ006", s);

describe("hvert løp rapporteres separat med modus", () => {
  it("l4/econ006d/econ006 gir L4b/L5b/L5a hver for seg; J3 HOPP i ekte modus ⇒ L5a DELVIS, L5 aldri PASS", () => {
    const r = run(e2eFiles({ econ006: econ(({ skip: [J3] })) }));
    expect(status(r, "L4b")).toBe("PASS");
    expect(status(r, "L5b")).toBe("PASS");
    expect(status(r, "L5a")).toBe("PARTIAL");
    expect(status(r, "L5")).not.toBe("PASS");
    expect(r.verdict).toBe("IKKE FULLT BESTÅTT");
    expect(r.report).toMatch(/## L4b .*modus: ekte.*: BESTÅTT/);
    expect(r.report).toMatch(/## L5a .*: DELVIS \(ikke bestått\)/);
    expect(r.report).toMatch(/## L5b .*: BESTÅTT/);
  });
  it("API-dekning erstatter ikke J3: ingen annen sjekk kan dekke det hoppede navnet", () => {
    const r = run(e2eFiles({ econ006: econ({ skip: [J3] }) }));
    expect(r.results.L5a!.notes.join("\n")).toContain("J3");
    expect(PLAN.econ006.partialInReal).toEqual([J3]);
  });
});

describe("manglende nettleser, feil, manglende eller hoppede sjekker gir aldri PASS", () => {
  it("exit 3 (ingen nettleser) ⇒ NOT_RUN for løpet", () => {
    for (const k of KEYS) expect(status(run(e2eFiles({ [k]: { out: "IKKE KJØRT: ingen nettleser\n", rc: 3 } })), k === "l4" ? "L4b" : k === "econ006" ? "L5a" : "L5b")).toBe("NOT_RUN");
  });
  it("manglende filer ⇒ NOT_RUN og aldri samlet PASS", () => {
    const r = run(e2eFiles({ l4: null, econ006: null, econ006d: null }));
    expect([status(r, "L4b"), status(r, "L5a"), status(r, "L5b")]).toEqual(["NOT_RUN", "NOT_RUN", "NOT_RUN"]);
    expect(r.verdict).toBe("IKKE FULLT BESTÅTT");
  });
  it("tidsavbrudd (124) og avvist start (2) ⇒ FAIL", () => {
    for (const rc of [124, 2]) expect(status(run(e2eFiles({ l4: { out: e2eOutput("l4").out, rc } })), "L4b")).toBe("FAIL");
  });
  it("én FEIL-sjekk ⇒ FAIL", () => {
    const n = PLAN.l4.checks[3]!;
    expect(status(run(e2eFiles({ l4: e2eOutput("l4", { fail: [n] }) })), "L4b")).toBe("FAIL");
  });
  it("manglende sjekk, duplisert sjekk og ukjent sjekk ⇒ FAIL (entydig identitet)", () => {
    const n = PLAN.econ006d.checks[0]!;
    expect(status(run(e2eFiles({ econ006d: e2eOutput("econ006d", { drop: [n] }) })), "L5b")).toBe("FAIL");
    expect(status(run(e2eFiles({ econ006d: e2eOutput("econ006d", { dup: [n] }) })), "L5b")).toBe("FAIL");
    expect(status(run(e2eFiles({ econ006d: e2eOutput("econ006d", { extra: ["en ukjent sjekk"] }) })), "L5b")).toBe("FAIL");
  });
  it("ukjent HOPP (ikke J3) ⇒ SKIPPED, ikke PASS", () => {
    const n = PLAN.l4.checks[0]!;
    expect(status(run(e2eFiles({ l4: e2eOutput("l4", { skip: [n] }) })), "L4b")).toBe("SKIPPED");
  });
  it("emulatormodus godtas ikke som ekte Supabase", () => {
    expect(status(run(e2eFiles({ l4: e2eOutput("l4", { mode: "emulator" }) })), "L4b")).toBe("FAIL");
  });
  it("sammendrag som ikke stemmer med linjene ⇒ FAIL", () => {
    expect(status(run(e2eFiles({ l4: e2eOutput("l4", { summary: "99/99 sjekker OK [modus: real]" }) })), "L4b")).toBe("FAIL");
    expect(status(run(e2eFiles({ l4: e2eOutput("l4", { summary: null }) })), "L4b")).not.toBe("PASS");
  });
  it("rapporten inneholder ingen rå nøkler eller tilkoblings-URL-er", () => {
    const bad = `FEIL ${PLAN.l4.checks[0]} — ${"postgres" + "://u:p@h/db"} ${["eyJ" + "hbGciOiJIUzI1NiJ9", "eyJ" + "zdWIiOiIxIn0", "sig"].join(".")}`;
    const r = run(e2eFiles({ l4: { out: e2eOutput("l4").out + "\n" + bad, rc: 1 } }));
    expect(r.report).not.toMatch(/postgres(ql)?:\/\/|eyJ[A-Za-z0-9_-]{10,}\.eyJ/);
  });
});

describe("statiske krav til orkestrering og workflow", () => {
  const sh = readFileSync(join(__dirname, "../scripts/ci-supabase-local.sh"), "utf8");
  const wf = readFileSync(join(__dirname, "../.github/workflows/supabase-local.yml"), "utf8");
  it("nettleserløpene kjøres etter L7 og før L3b, med planens tidsgrenser og innloggingsbudsjett", () => {
    const i = (s: string) => sh.indexOf(s);
    expect(i("run l7 300")).toBeGreaterThan(-1);
    expect(i("run2 \"e2e-$step\" \"$tmo\"")).toBeGreaterThan(i("run l7 300"));
    expect(i("bash scripts/ci/run-l3b.sh")).toBeGreaterThan(i("run2 \"e2e-$step\" \"$tmo\""));
    expect(sh).toContain("login-budget.mjs wait");
    expect(sh).toContain("have_chrome");
  });
  it("ingen automatisk nettleserinstallasjon, ingen skjermbilder eller opplasting, ingen artefakter", () => {
    const code = (sh + "\n" + wf).split("\n").filter((l) => !/^\s*#/.test(l)).join("\n");
    expect(code).not.toMatch(/playwright install|npx playwright|apt(-get)? install|puppeteer|curl .*chrome|wget /i);
    expect(wf).not.toMatch(/upload-artifact|actions\/|screenshot|SHOTS/i);
    expect(code).not.toMatch(/upload|artifact/i);
  });
  it("planens samlede tid ligger innenfor jobbens tidsgrense", () => {
    const total = KEYS.reduce((a, k) => a + PLAN[k].timeoutSec, 0) / 60;
    expect(total).toBeLessThan(Number(/timeout-minutes:\s*(\d+)/.exec(wf)![1]));
    for (const k of KEYS) expect(PLAN[k].logins).toBeGreaterThan(0);
  });
  it("workflow: kun workflow_dispatch, contents: read, ingen secrets", () => {
    expect(wf).toMatch(/on:\s*\n\s*workflow_dispatch:\s*\n/);
    expect(wf).toMatch(/permissions:\s*\n\s*contents: read/);
    expect(wf).not.toMatch(/secrets\./);
  });
});

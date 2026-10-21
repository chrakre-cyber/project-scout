/**
 * Vurderingslogikken for L1–L3 og L7: feil, hoppede og ikke kjørte kontroller regnes ALDRI som bestått, og rapporten lekker ingen hemmeligheter.
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Result } from "../scripts/ci/evaluate.mjs";
import { l3bPass } from "./ci/l3b-fixtures";
import { buildReport, evaluateDir, evaluateL1, evaluateL2, evaluateL3a, evaluateL7, overall } from "../scripts/ci/evaluate.mjs";

const l2Ok = "== 1. Ren oppbygging\nPASS  a\nPASS  b\n\nMIGRASJONSKJEDE: ALLE KONTROLLER BESTÅTT\n";
const t = (status: string, name: string, extra: Record<string, unknown> = {}) => ({ status, title: name, fullName: name, ...extra });
const vitest = (tests: ReturnType<typeof t>[], success = true) => JSON.stringify({ success, testResults: [{ name: "/x/tests/db/rls.test.ts", assertionResults: tests }] });
const l7Ok = "== Git\nPASS  x (0 treff)\nPASS  y (0 treff)\n\nSECRET-SKANN: INGEN FUNN\n";

describe("L2", () => {
  it("PASS krever exit 0, sluttmelding og ingen FAIL", () => expect(evaluateL2(l2Ok, 0).status).toBe("PASS"));
  it.each([
    ["FAIL-linje", l2Ok.replace("PASS  b", "FAIL  b (forventet «1», fikk «2»)"), 0],
    ["exit ≠ 0", l2Ok, 1],
    ["mangler sluttmelding", "PASS  a\n", 0],
    ["tidsavbrudd", l2Ok, 124],
    ["tom utskrift", "", 0],
  ])("%s ⇒ FAIL", (_n, out, rc) => expect(evaluateL2(out as string, rc as number).status).toBe("FAIL"));
  it("rå linjer utenfor allowlist (f.eks. dataverdier, diff) tas ikke med", () => {
    const r = evaluateL2("rad: hemmelig-data-123\n" + l2Ok + "> CREATE TABLE x\n", 0);
    expect(r.notes.join("\n")).not.toMatch(/hemmelig-data|CREATE TABLE/);
  });
  it("ikke kjørt ⇒ NOT_RUN", () => expect(evaluateL2(null, null).status).toBe("NOT_RUN"));
});

describe("L3", () => {
  it("bare passerte tester ⇒ PASS", () => expect(evaluateL3a(vitest([t("passed", "a"), t("passed", "b")]), 0).status).toBe("PASS"));
  it("én feilet ⇒ FAIL med navn", () => {
    const r = evaluateL3a(vitest([t("passed", "a"), t("failed", "bruker B ser A")], false), 1);
    expect(r.status).toBe("FAIL");
    expect(r.notes.join("\n")).toContain("bruker B ser A");
  });
  it("hoppet over ⇒ SKIPPED (ikke bestått); bare de seks identifiserte regnes som kjente, alt annet (også prefiks-treff) er uventet", () => {
    const r = evaluateL3a(vitest([t("passed", "a"), t("skipped", "DATA-002D: oppgradering fra eldre tilstand gyldige eksisterende rader", { fullName: "DATA-002D: oppgradering fra eldre tilstand gyldige eksisterende rader" }), t("skipped", "annet")]), 0);
    expect(r.status).toBe("SKIPPED");
    expect(r.knownSkipped).toHaveLength(0); // samme prefiks men ikke full identitet ⇒ ikke «kjent»
    expect(r.unknownSkipped).toHaveLength(2);
    expect(r.notes.join("\n")).toMatch(/2 UVENTET hoppet over/);
  });
  it("todo og pending regnes også som hoppet over", () => {
    expect(evaluateL3a(vitest([t("passed", "a"), t("todo", "b")]), 0).status).toBe("SKIPPED");
    expect(evaluateL3a(vitest([t("passed", "a"), t("pending", "b")]), 0).status).toBe("SKIPPED");
  });
  it.each([["ingen tester", vitest([]), 0], ["ugyldig JSON", "{", 1], ["ingen rapport", null, 1], ["exit ≠ 0 uten feilede", vitest([t("passed", "a")]), 1]])("%s ⇒ FAIL", (_n, rep, rc) => {
    expect(evaluateL3a(rep as string | null, rc as number).status).toBe("FAIL");
  });
  it("ikke kjørt ⇒ NOT_RUN", () => expect(evaluateL3a(null, null).status).toBe("NOT_RUN"));
});

describe("L7", () => {
  it("PASS krever INGEN FUNN, exit 0 og ingen SKIP", () => expect(evaluateL7(l7Ok, 0, 0).status).toBe("PASS"));
  it("SKIP ⇒ SKIPPED, ikke bestått", () => expect(evaluateL7(l7Ok.replace("PASS  y (0 treff)", "SKIP  .next finnes ikke"), 0, 0).status).toBe("SKIPPED"));
  it("FAIL-linje ⇒ FAIL", () => expect(evaluateL7(l7Ok.replace("PASS  y (0 treff)", "FAIL  y (1 treff, forventet 0)").replace("INGEN FUNN", "1 KONTROLL(ER) MED FUNN"), 1, 0).status).toBe("FAIL"));
  it("feilet build ⇒ ikke bestått selv om skannet ellers er rent", () => {
    const r = evaluateL7(l7Ok, 0, 1);
    expect(r.status).toBe("SKIPPED");
    expect(r.notes.join("\n")).toMatch(/build feilet/);
  });
  it("ikke kjørt ⇒ NOT_RUN", () => expect(evaluateL7(null, null, null).status).toBe("NOT_RUN"));
});

describe("L1", () => {
  const ok = { startRc: 0, resetRc: 0, actualVersions: "1,2,3", expectedVersions: "1,2,3", pgVersion: "PostgreSQL 17.0", images: ["x/y:1"] };
  it("PASS", () => expect(evaluateL1(ok).status).toBe("PASS"));
  it("start feilet / reset feilet / feil migrasjonsliste / tom liste ⇒ FAIL", () => {
    expect(evaluateL1({ ...ok, startRc: 1 }).status).toBe("FAIL");
    expect(evaluateL1({ ...ok, resetRc: 124 }).status).toBe("FAIL");
    expect(evaluateL1({ ...ok, actualVersions: "1,2" }).status).toBe("FAIL");
    expect(evaluateL1({ ...ok, actualVersions: "" }).status).toBe("FAIL");
  });
  it("aldri kjørt ⇒ NOT_RUN", () => expect(evaluateL1({ ...ok, startRc: null }).status).toBe("NOT_RUN"));
});

describe("samlet", () => {
  const P: Result = { status: "PASS", notes: [] };
  it("PASS bare når alle fire er PASS", () => {
    expect(overall({ L1: P, L2: P, L3: P, L7: P })).toBe("PASS");
    for (const bad of ["FAIL", "SKIPPED", "NOT_RUN"]) for (const k of ["L1", "L2", "L3", "L7"]) expect(overall({ L1: P, L2: P, L3: P, L7: P, [k]: { status: bad as Result["status"], notes: [] } })).toBe("IKKE FULLT BESTÅTT");
  });
  it("rapporten fører L4–L6, Playwright og hosted som ÅPNE, også når alt er bestått", () => {
    const r = buildReport({ L1: P, L2: P, L3: P, L7: P });
    expect(r).toMatch(/L4 innlogging.*ÅPEN/);
    expect(r).toMatch(/L6 firmaskille.*ÅPEN/);
    expect(r).toMatch(/Playwright-integrasjon: ÅPEN/);
    expect(r).toMatch(/Hosted Supabase.*ÅPEN/);
    expect(r).toMatch(/Samlet: PASS/);
  });
});

describe("evaluateDir: ende-til-ende med falske hemmeligheter", () => {
  const dirs: string[] = [];
  afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });
  const jwt = ["ey", "JhbGciOiJIUzI1NiJ9", ".", "ey", "Jyb2xlIjoiYW5vbiJ9", ".", "c2lnbmF0dXJlMTIzNDU2"].join("");
  const dbUrl = ["postgres", "ql://postgres:", "hunter2hunter2", "@127.0.0.1:54322/postgres"].join("");

  function make(files: Record<string, string>) {
    const d = mkdtempSync(join(tmpdir(), "scout-eval-"));
    dirs.push(d);
    for (const [n, c] of Object.entries(files)) writeFileSync(join(d, n), c);
    return d;
  }
  const base = { ...l3bPass(), "start.rc": "0", "reset.rc": "0", "migrations.txt": "1,2\n1,2\n", "pgversion.txt": "PostgreSQL 17.0\n", "images.txt": "x/y:1\n", "l2.out": l2Ok, "l2.rc": "0", "l3.json": vitest([t("passed", "a")]), "l3.rc": "0", "l7.out": l7Ok, "l7.rc": "0", "build.rc": "0", literals: "plain-odd-secret\n" };

  it("alt bestått ⇒ PASS", () => expect(evaluateDir(make(base)).verdict).toBe("PASS"));
  it("manglende steg ⇒ NOT_RUN og IKKE FULLT BESTÅTT", () => {
    const d = make({ "start.rc": "0", "reset.rc": "1", "start.out": "", "reset.out": "boom" });
    const r = evaluateDir(d);
    expect(r.verdict).toBe("IKKE FULLT BESTÅTT");
    expect(r.results.L1.status).toBe("FAIL");
    expect(r.results.L2.status).toBe("NOT_RUN");
    expect(r.results.L3.status).toBe("NOT_RUN");
    expect(r.results.L7.status).toBe("NOT_RUN");
  });
  it("hemmeligheter i underskriptenes utskrift når aldri rapporten (JWT, DB-URL, eksakt verdi, rå datalinjer)", () => {
    const d = make({
      ...base,
      "start.rc": "1",
      "start.out": `Started. anon key: ${jwt}\nDatabase URL: ${dbUrl}\nplain-odd-secret\n`,
      "l2.out": `rad: ${jwt}\n${l2Ok}FAIL  z (forventet «1», fikk «${dbUrl}»)\n`,
      "l3.json": vitest([t("failed", `test med ${jwt}`)], false), "l3.rc": "1",
      "l7.out": `SKIP  JWT_SECRET ${jwt}\n${l7Ok}`,
    });
    const r = evaluateDir(d);
    for (const bad of [jwt, dbUrl, "hunter2hunter2", "plain-odd-secret", "JhbGciOiJIUzI1NiJ9"]) expect(r.report, bad).not.toContain(bad);
    expect(r.verdict).toBe("IKKE FULLT BESTÅTT");
  });
  it("hvis noe likevel lekker gjennom sperren undertrykkes hele rapporten og kjøringen feiler", () => {
    // preflight går ikke gjennom allowlist, men gjennom sanering; en verdi som saneringen ikke gjenkjenner og som står i literals fanges likevel
    const d = make({ ...base, "preflight.txt": "node v22\n", literals: "node v22\n" });
    const r = evaluateDir(d);
    expect(r.report).not.toContain("node v22");
  });
});

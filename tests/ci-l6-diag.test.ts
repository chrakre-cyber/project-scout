// Avgrenset L6-diagnostikk: bare testidentitet, operasjon, tabell, HTTP-status og kode slipper inn i rapporten, og bare for FEILEDE fastlåste tester.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { evaluateGroup, parseL6Diag } from "../scripts/ci/evaluate.mjs";
import { L46, l46Rows, vitestJson } from "./ci/l3b-fixtures";

const T1 = L46.L6.find((t) => /profiles eget firma/.test(t.fullName))!.fullName;
const T2 = L46.L6.find((t) => /profiles på tvers/.test(t.fullName))!.fullName;
const line = (name: string, n: number, m: string, tbl: string, st: string | number, code: string) => ["L6DIAG", name, n, m, tbl, st, code].join("\t");
const failedReport = () => vitestJson(l46Rows().map((t) => ((t.fullName === T1 || t.fullName === T2) ? { ...t, status: "failed" } : t)));

describe("parseL6Diag", () => {
  it("godtar strengt formaterte linjer for feilede tester", () => {
    const m = parseL6Diag([line(T1, 5, "PATCH", "dealer_economics_profiles", 400, "21000"), line(T1, 4, "GET", "dealer_economics_profiles", 200, "-")].join("\n"), [T1]);
    expect(m.get(T1)).toEqual(["  #5 PATCH dealer_economics_profiles → HTTP 400, kode 21000", "  #4 GET dealer_economics_profiles → HTTP 200, kode -"]);
  });
  it("forkaster linjer for ikke-feilede tester, ukjente navn og alt som ikke følger formatet (ingen fritekst, ekstra felt, tokens, URL-er)", () => {
    const bad = [
      line(T2, 1, "GET", "dealer_economics_profiles", 200, "-"),                         // test som ikke feilet
      line("en helt annen test", 1, "GET", "t", 200, "-"),                                // ukjent navn
      line(T1, 1, "GET", "dealer_economics_profiles?apikey=hemmelig", 200, "-"),          // spørringsdel i tabellfeltet
      line(T1, 1, "GET", "t", 200, "-") + "\tBearer abc",                                  // ekstra felt
      line(T1, 1, "GET", "t", 200, "{\"payload\":1}"),                                     // fritekst i kodefeltet
      line(T1, 1, "TRACE", "t", 200, "-"),                                                 // ukjent metode
      "L6DIAG\t" + T1 + "\t1\tGET\thttps://x.example/y\t200\t-",                           // URL
      "tilfeldig tekst med eyJhbGciOi.xx.yy",
    ];
    expect(parseL6Diag(bad.join("\n"), [T1]).size).toBe(0);
  });
  it("begrenser antall linjer per test", () => {
    const many = Array.from({ length: 100 }, (_, i) => line(T1, (i % 99) + 1, "GET", "t", 200, "-")).join("\n");
    expect(parseL6Diag(many, [T1]).get(T1)).toHaveLength(40);
  });
});

describe("evaluateGroup med diagnostikk", () => {
  const diag = [line(T1, 5, "PATCH", "dealer_economics_profiles", 400, "21000"), line(T2, 6, "PATCH", "dealer_economics_profiles", 400, "21000")].join("\n");
  it("feilede tester får diagnostikk i notatene; statusen er fortsatt FAIL med uendrede krav", () => {
    const r = evaluateGroup("L6", failedReport(), 1, diag);
    expect(r.status).toBe("FAIL");
    expect(r.notes.filter((n) => n.startsWith("FEILET:"))).toHaveLength(2);
    expect(r.notes.join("\n")).toContain("#5 PATCH dealer_economics_profiles → HTTP 400, kode 21000");
    expect(r.notes.join("\n")).toContain("#6 PATCH dealer_economics_profiles → HTTP 400, kode 21000");
  });
  it("bestått kjøring ignorerer diagnostikkfilen (ingen notater, PASS beholdes)", () => {
    const r = evaluateGroup("L6", vitestJson(l46Rows()), 0, diag);
    expect(r.status).toBe("PASS");
    expect(r.notes.join("\n")).not.toContain("DIAGNOSTIKK");
  });
  it("diagnostikk kan aldri gjøre en feilet kjøring til PASS", () => {
    expect(evaluateGroup("L6", failedReport(), 1, "").status).toBe("FAIL");
    expect(evaluateGroup("L6", failedReport(), 1, null).status).toBe("FAIL");
  });
});

describe("statisk: testfilen og orkestreringen", () => {
  const src = readFileSync(join(__dirname, "db/rest-isolation.test.ts"), "utf8");
  const sh = readFileSync(join(__dirname, "../scripts/ci-supabase-local.sh"), "utf8");
  it("sporet registrerer bare metode, tabellnavn, status og kode — aldri respons, token, payload eller URL", () => {
    const fn = /const noteTrace = [\s\S]*?\n};/.exec(src)![0];
    expect(fn).not.toMatch(/text|json|token|body|headers|url|payload/i);
    expect(src).toMatch(/noteTrace\(method, path, res\.status, code\)/);
  });
  it("skriver bare når SCOUT_L6_DIAG_FILE er satt og testen har feilet", () => {
    expect(src).toMatch(/if \(!file \|\| !failed\) return;/);
  });
  it("orkestreringen peker diagnostikken til den private arbeidskatalogen under L3a", () => {
    expect(sh).toMatch(/SCOUT_L6_DIAG_FILE="\$W\/l6-diag\.txt" run l3cmd/);
  });
});

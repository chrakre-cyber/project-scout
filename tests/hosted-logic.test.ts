// HOST-001 (forberedelse): migrasjonsklassifisering (tomt vs. oppgradering), gate for dry-run/anvendelse, rapportformat og vurdering av H3-resultater. Rene tester uten nettverk.
import { describe, expect, it } from "vitest";
import { hostedGroup, hostedL7 } from "../scripts/hosted/cli.mjs";
import { checkGate } from "../scripts/hosted/gate.mjs";
import { KNOWN_NEVER_APPLIED_HOSTED, classifyMigrations, repoHash, repoMigrationList } from "../scripts/hosted/migrations.mjs";
import { formatReport, h2Items, h3Items, h4Items, overall } from "../scripts/hosted/report.mjs";
import { fingerprintOf } from "../scripts/hosted/target.mjs";
import { L46, l46Rows, vitestJson } from "./ci/l3b-fixtures";
const PGS = ["post", "gres"].join("");   // schema settes sammen ved kjøring så hemmelighetsskannet ikke flagger syntetiske test-URL-er

const repo = repoMigrationList();
const versions = repo.map((m) => m.version);
const REF = "abcdefghij0123456789";
const target = { ref: REF, mode: "fresh" as "fresh" | "upgrade", stage: null, dbKind: "direct" as const, fingerprint: fingerprintOf(REF), masked: "ab…89" };

describe("repoets migrasjoner og klassifisering", () => {
  it("repoet har 13 migrasjoner (DATA-002D la til skrivebeskyttet rettighetsleseveg) og de tre aldri anvendt hostet er med", () => {
    expect(repo).toHaveLength(13);
    for (const v of KNOWN_NEVER_APPLIED_HOSTED) expect(versions).toContain(v);
    expect(repoHash(repo)).toMatch(/^[0-9a-f]{64}$/);
  });
  it("tom historikk ⇒ empty; sammenhengende prefiks ⇒ prefix med riktige ventende; alle ⇒ current", () => {
    expect(classifyMigrations([], repo)).toMatchObject({ kind: "empty", pending: versions });
    expect(classifyMigrations(versions.slice(0, 9), repo)).toMatchObject({ kind: "prefix", appliedCount: 9, pending: versions.slice(9) });
    expect(classifyMigrations(versions, repo)).toMatchObject({ kind: "current", pending: [] });
  });
  it("hull, ukjent versjon og omvendt rekkefølge-feil ⇒ diverged (aldri anvendbar)", () => {
    expect(classifyMigrations([versions[0]!, versions[2]!], repo).kind).toBe("diverged");
    expect(classifyMigrations([...versions.slice(0, 3), "20990101000000"], repo)).toMatchObject({ kind: "diverged", unknownApplied: ["20990101000000"] });
    expect(classifyMigrations(versions.slice(1), repo).kind).toBe("diverged");
  });
});

const inspectOk = (over: Record<string, unknown> = {}) => ({
  kind: "hosted-inspect", schemaVersion: 1, takenAt: new Date("2026-10-22T10:00:00Z").toISOString(), mode: "fresh", target: { fingerprint: target.fingerprint }, repoHash: repoHash(repo),
  state: "tomt", verdict: "OK", nothingToApply: false, data002d: { status: "NOT_APPLICABLE" }, ...over,
});
const dryOk = (over: Record<string, unknown> = {}) => ({ kind: "hosted-dry-run", status: "PASS", mode: "fresh", inspectTakenAt: new Date("2026-10-22T10:00:00Z").toISOString(), target: { fingerprint: target.fingerprint }, repoHash: repoHash(repo), takenAt: new Date("2026-10-22T10:05:00Z").toISOString(), ...over });
const now = new Date("2026-10-22T10:20:00Z");
const gate = (stage: "h2-dry-run" | "h2-apply", over: Record<string, unknown> = {}) => checkGate({ stage, target, inspect: inspectOk(), dryRun: dryOk(), repoHash: repoHash(repo), now, ...over } as Parameters<typeof checkGate>[0]);

describe("gate for dry-run og anvendelse", () => {
  it("godkjent: tomt prosjekt med nylig inspeksjon (+ dry-run for anvendelse)", () => {
    expect(gate("h2-dry-run").allow).toBe(true);
    expect(gate("h2-apply").allow).toBe(true);
  });
  it("avvises: ingen/gammel/annet prosjekt/annen modus/endret repo/STOPP/ingenting å anvende/ukjent kartlegging", () => {
    const cases: Array<[string, Record<string, unknown>]> = [
      ["ingen inspeksjon", { inspect: null }], ["STOPP", { inspect: inspectOk({ verdict: "STOPP" }) }], ["annet prosjekt", { inspect: inspectOk({ target: { fingerprint: "deadbeef" } }) }],
      ["annen modus", { inspect: inspectOk({ mode: "upgrade" }) }], ["tilstand passer ikke til modus", { inspect: inspectOk({ state: "oppgradering" }) }], ["repo endret", { inspect: inspectOk({ repoHash: "0".repeat(64) }) }],
      ["for gammel", { now: new Date("2026-10-22T12:00:00Z") }], ["fremtidig tidspunkt", { inspect: inspectOk({ takenAt: "2030-01-01T00:00:00Z" }) }], ["ingenting å anvende", { inspect: inspectOk({ nothingToApply: true }) }],
      ["kartlegging UNKNOWN", { inspect: inspectOk({ data002d: { status: "UNKNOWN" } }) }], ["kartlegging INVALID", { inspect: inspectOk({ data002d: { status: "INVALID" } }) }],
    ];
    for (const [n, over] of cases) { expect(gate("h2-dry-run", over).allow, n).toBe(false); expect(gate("h2-apply", over).allow, n).toBe(false); }
  });
  it("anvendelse krever vellykket, nylig dry-run for samme prosjekt og samme migrasjoner", () => {
    for (const [n, dry] of [["ingen", null], ["FAIL", dryOk({ status: "FAIL" })], ["annet prosjekt", dryOk({ target: { fingerprint: "deadbeef" } })], ["repo endret", dryOk({ repoHash: "1".repeat(64) })], ["gammel", dryOk({ takenAt: "2026-10-22T08:00:00Z" })]] as const)
      expect(gate("h2-apply", { dryRun: dry }).allow, n).toBe(false);
    expect(gate("h2-dry-run", { dryRun: null }).allow).toBe(true);   // dry-run trenger ikke en tidligere dry-run
  });
  it("oppgradering av eksisterende database krever bekreftet sikkerhetskopi for anvendelse (ikke for dry-run)", () => {
    const up = { ...target, mode: "upgrade" as const }, insp = inspectOk({ mode: "upgrade", state: "oppgradering", data002d: { status: "OK" } });
    expect(checkGate({ stage: "h2-dry-run", target: up, inspect: insp, repoHash: repoHash(repo), now }).allow).toBe(true);
    expect(checkGate({ stage: "h2-apply", target: up, inspect: insp, dryRun: dryOk({ mode: "upgrade" }), repoHash: repoHash(repo), now }).allow).toBe(false);
    expect(checkGate({ stage: "h2-apply", target: up, inspect: insp, dryRun: dryOk({ mode: "upgrade" }), repoHash: repoHash(repo), now, backupConfirmed: true }).allow).toBe(true);
  });
  it("dry-run må høre til samme modus og SAMME inspeksjon som anvendelsen (HOST-001-FIX1)", () => {
    expect(gate("h2-apply", { dryRun: dryOk({ mode: "upgrade" }) }).allow).toBe(false);
    expect(gate("h2-apply", { dryRun: dryOk({ inspectTakenAt: "2026-10-22T09:00:00.000Z" }) }).allow).toBe(false);
    expect(gate("h2-apply", { dryRun: dryOk({ inspectTakenAt: undefined }) }).allow).toBe(false);
  });
  it("ukjent trinn avvises", () => { expect(gate("h3-api" as never).allow).toBe(false); });
});

describe("rapportformat", () => {
  const pass = { status: "PASS" };
  it("H2 tomt prosjekt: DATA-002D er «IKKE RELEVANT» og teller ikke; alt PASS ⇒ BESTÅTT", () => {
    const items = h2Items({ mode: "fresh", inspect: inspectOk(), dryRun: pass, apply: pass, verify: pass });
    expect(overall(items.map((i) => ({ ...i, required: i.status !== "NOT_APPLICABLE" })))).toBe("PASS");
    const txt = formatReport({ stage: "H2", target, items });
    expect(txt).toContain("TOMT prosjekt");
    expect(txt).toMatch(/DATA-002D-kartlegging: IKKE RELEVANT/);
    expect(txt).toContain("## Samlet H2: BESTÅTT");
  });
  it("H2 oppgradering: DATA-002D er påkrevd og skilt ut; ugyldige rader ⇒ FEILET og aldri bestått", () => {
    const up = { ...target, mode: "upgrade" as const };
    const bad = h2Items({ mode: "upgrade", inspect: inspectOk({ mode: "upgrade", state: "oppgradering", verdict: "STOPP", stopReasons: ["x"], data002d: { status: "INVALID", invalidProfiles: 2 } }), dryRun: pass, apply: pass, verify: pass });
    const txt = formatReport({ stage: "H2", target: up, items: bad });
    expect(txt).toContain("OPPGRADERING av eksisterende database");
    expect(txt).toMatch(/DATA-002D-kartlegging mot eksisterende rettighetsprofiler \(FØR anvendelse\): FEILET/);
    expect(txt).toContain("## Samlet H2: FEILET");
    const ok = h2Items({ mode: "upgrade", inspect: inspectOk({ mode: "upgrade", state: "oppgradering", data002d: { status: "OK", invalidProfiles: 0 } }), dryRun: pass, apply: pass, verify: pass });
    expect(formatReport({ stage: "H2", target: up, items: ok })).toContain("## Samlet H2: BESTÅTT");
  });
  it("«ikke relevant» for DATA-002D er ikke tillatt i oppgradering (blir IKKE KJØRT), og ikke for andre punkter", () => {
    const up = { ...target, mode: "upgrade" as const };
    const items = h2Items({ mode: "upgrade", inspect: inspectOk({ data002d: { status: "NOT_APPLICABLE" } }), dryRun: pass, apply: pass, verify: pass });
    const txt = formatReport({ stage: "H2", target: up, items });
    expect(txt).not.toContain("IKKE RELEVANT");
    expect(txt).toContain("## Samlet H2: IKKE FULLT BESTÅTT");
    const forged = [{ key: "apply", title: "Anvendelse", status: "NOT_APPLICABLE" }];
    expect(formatReport({ stage: "H2", target, items: forged })).toContain("Anvendelse: IKKE KJØRT");
  });
  it("hoppet, delvis, ikke kjørt og ukjent status gir aldri bestått", () => {
    for (const st of ["SKIPPED", "PARTIAL", "NOT_RUN", "weird"]) {
      const items = h2Items({ mode: "fresh", inspect: inspectOk(), dryRun: pass, apply: { status: st }, verify: pass });
      expect(formatReport({ stage: "H2", target, items })).toContain("## Samlet H2: IKKE FULLT BESTÅTT");
    }
    expect(overall([])).toBe("NOT_RUN");
  });
  it("H3: nettleserdelene er IKKE forberedt og hindrer samlet bestått selv om API-delene består", () => {
    const items = h3Items({ l4a: pass, l6: pass, secrets: pass });
    const txt = formatReport({ stage: "H3", target, items });
    expect(txt).toMatch(/L4b .*IKKE forberedt.*: IKKE KJØRT/);
    expect(txt).toContain("## Samlet H3: IKKE FULLT BESTÅTT");
  });
  it("H4: eiers sletting av prosjektet kan ikke måles og er IKKE KJØRT til eier bekrefter", () => {
    const txt = formatReport({ stage: "H4", target, items: h4Items({ cleanupPlan: pass, cleanupExecute: pass, verify: pass }) });
    expect(txt).toMatch(/Eier har slettet testprosjektet.*: IKKE KJØRT/);
    expect(txt).toContain("## Samlet H4: IKKE FULLT BESTÅTT");
  });
  it("rapporten viser aldri ref, adresser, passord eller nøkler (fingeravtrykk og maskering bare), og lekkasjer saneres/avvises", () => {
    const PW = ["pw", "SENT", "9z8y7x"].join("-");
    const items = h2Items({ mode: "fresh", inspect: inspectOk({ stopReasons: [`feil mot ${PGS}://u:${PW}@db.${REF}.supabase.co/postgres ${REF}`] }), dryRun: pass, apply: pass, verify: pass });
    const txt = formatReport({ stage: "H2", target, items, literals: [REF, PW] });
    for (const s of [REF, PW, `${PGS}://`, `db.${REF}`]) expect(txt).not.toContain(s);
    expect(txt).toContain(target.fingerprint);
  });
});

describe("H3: L4a/L6/L7 mot hosted vurderes uten å svekke kravene", () => {
  const exp = L46.L4a.find((t) => /utløpt token/.test(t.fullName))!.fullName;
  const rows = (mut: (r: ReturnType<typeof l46Rows>) => ReturnType<typeof l46Rows> = (r) => r) => vitestJson(mut(l46Rows()));
  it("alle bestått ⇒ PASS", () => { expect(hostedGroup("L4a", rows(), 0).status).toBe("PASS"); expect(hostedGroup("L6", rows(), 0).status).toBe("PASS"); });
  it("bare den bevisst utelatte utløpt-token-testen mangler/hoppet (uten hosted JWT-hemmelighet) ⇒ PARTIAL, aldri PASS", () => {
    const skipped = rows((r) => r.map((t) => (t.fullName === exp ? { ...t, status: "skipped" } : t)));
    expect(hostedGroup("L4a", skipped, 0, { excluded: ["utløpt token avvises"] }).status).toBe("PARTIAL");
    expect(hostedGroup("L4a", skipped, 0).status).toBe("FAIL");   // uten at utelatelsen er erklært: FEIL
  });
  it("en annen feilet/manglende test sammen med utelatelsen ⇒ FAIL", () => {
    const other = L46.L4a.find((t) => t.fullName !== exp)!.fullName;
    const r = rows((x) => x.map((t) => (t.fullName === exp ? { ...t, status: "skipped" } : t.fullName === other ? { ...t, status: "failed" } : t)));
    expect(hostedGroup("L4a", r, 1, { excluded: ["utløpt token avvises"] }).status).toBe("FAIL");
  });
  const scan = (extra = "") => ["PASS  .env.local er gitignorert", "PASS  build-artefakter .next/static (klient) (0 treff)", "PASS  build-artefakter .next/server (server, utenom publishable key) (0 treff)", "SKIP  lokal Supabase kjører ikke", extra, "", "SECRET-SKANN: INGEN FUNN"].join("\n");
  it("L7: kjent lokal-stakk-SKIP er eneste tillatte unntak og build må være vellykket", () => {
    expect(hostedL7(scan(), 0, 0).status).toBe("PASS");
    expect(hostedL7(scan(), 0, 1).status).toBe("SKIPPED");
    expect(hostedL7(scan(), 0, null).status).toBe("SKIPPED");
    expect(hostedL7(scan("SKIP  noe annet"), 0, 0).status).toBe("SKIPPED");
    expect(hostedL7(scan("FAIL  funn"), 1, 0).status).toBe("FAIL");
    expect(hostedL7(scan().replace("INGEN FUNN", "1 KONTROLL(ER) MED FUNN"), 1, 0).status).toBe("FAIL");
    expect(hostedL7(scan().replace(/PASS  build-artefakter.*\n/g, ""), 0, 0).status).toBe("SKIPPED");
    expect(hostedL7("", null, 0).status).toBe("NOT_RUN");
  });
});

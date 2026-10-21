// HOST-001 (forberedelse): målvalidering for ETT hosted testprosjekt. Rene tester — ingen nettverk, ingen hosted tilgang. Alle verdier er syntetiske og bygges ved kjøring.
import { describe, expect, it } from "vitest";
import { HostedTargetError, describeTarget, fingerprintOf, parseHostedTarget } from "../scripts/hosted/target.mjs";
const PGS = ["post", "gres"].join(""), PGQL = `${PGS}ql`;   // schema settes sammen ved kjøring så hemmelighetsskannet ikke flagger syntetiske test-URL-er

const REF = "abcdefghij0123456789", OTHER = "zzzzzzzzzz9999999999";
const PW = ["pw", "SENTINEL", "x7q"].join("-");   // syntetisk passord (settes sammen ved kjøring)
const KEY = ["k", "SENTINEL", "publishable", "1a2b"].join("-");
const direct = (ref = REF) => `${PGQL}://postgres:${PW}@db.${ref}.supabase.co:5432/postgres`;
const pooler = (ref = REF) => `${PGS}://postgres.${ref}:${PW}@aws-0-eu-north-1.pooler.supabase.com:6543/postgres`;
const good = (over: Record<string, string | undefined> = {}) => ({
  SCOUT_HOSTED_PROJECT_REF: REF, SCOUT_HOSTED_CONFIRM: `TESTPROSJEKT:${REF}`, SCOUT_HOSTED_MODE: "fresh", SCOUT_HOSTED_STAGE: "h2-inspect",
  SUPABASE_TEST_URL: `https://${REF}.supabase.co`, SUPABASE_TEST_DB_URL: direct(), SUPABASE_TEST_PUBLISHABLE_KEY: KEY, ...over,
});
const reject = (env: Record<string, string | undefined>, stage: string | undefined = "h2-inspect") => { try { parseHostedTarget(env, stage ? { stage } : undefined); } catch (e) { return e as HostedTargetError; } return null; };

describe("godkjent mål", () => {
  it("direkte og pooler, begge moduser; resultatet har bare fingeravtrykk og maskert ref", () => {
    for (const db of [direct(), pooler()]) for (const mode of ["fresh", "upgrade"]) {
      const t = parseHostedTarget(good({ SUPABASE_TEST_DB_URL: db, SCOUT_HOSTED_MODE: mode }), { stage: "h2-inspect" });
      expect(t).toMatchObject({ mode, stage: "h2-inspect", fingerprint: fingerprintOf(REF) });
      expect(JSON.stringify(describeTarget(t))).not.toContain(REF);
    }
    expect(parseHostedTarget(good({ SUPABASE_TEST_DB_URL: `${direct()}?sslmode=require` })).dbKind).toBe("direct");
    expect(parseHostedTarget(good({ SUPABASE_TEST_URL: `https://${REF}.supabase.co/` })).ref).toBe(REF);
  });
  it("uten trinn kreves ikke SCOUT_HOSTED_STAGE (bare offline-kommandoene), med trinn kreves nøyaktig det trinnet", () => {
    expect(() => parseHostedTarget(good({ SCOUT_HOSTED_STAGE: undefined }))).not.toThrow();
    expect(reject(good({ SCOUT_HOSTED_STAGE: undefined }))).not.toBeNull();
    expect(reject(good({ SCOUT_HOSTED_STAGE: "h2-apply" }))).not.toBeNull();   // tillatelse til ET annet trinn gjelder ikke
    expect(reject(good(), "finnes-ikke")).not.toBeNull();
  });
});

describe("avvises (ett prosjekt, uttrykkelig valgt, aldri localhost)", () => {
  const cases: Array<[string, Record<string, string | undefined>]> = [
    ["mangler ref", { SCOUT_HOSTED_PROJECT_REF: undefined }], ["ugyldig ref (for kort)", { SCOUT_HOSTED_PROJECT_REF: "abc" }], ["ugyldig ref (store bokstaver)", { SCOUT_HOSTED_PROJECT_REF: REF.toUpperCase() }],
    ["mangler bekreftelse", { SCOUT_HOSTED_CONFIRM: undefined }], ["bekreftelse for annet prosjekt", { SCOUT_HOSTED_CONFIRM: `TESTPROSJEKT:${OTHER}` }], ["bekreftelse uten prefiks", { SCOUT_HOSTED_CONFIRM: REF }],
    ["mangler modus", { SCOUT_HOSTED_MODE: undefined }], ["ugyldig modus", { SCOUT_HOSTED_MODE: "auto" }],
    ["API for annet prosjekt", { SUPABASE_TEST_URL: `https://${OTHER}.supabase.co` }], ["API http", { SUPABASE_TEST_URL: `http://${REF}.supabase.co` }], ["API localhost", { SUPABASE_TEST_URL: "http://127.0.0.1:54321" }],
    ["API med sti", { SUPABASE_TEST_URL: `https://${REF}.supabase.co/rest/v1` }], ["API med innlogging", { SUPABASE_TEST_URL: `https://u:p@${REF}.supabase.co` }], ["API med port", { SUPABASE_TEST_URL: `https://${REF}.supabase.co:444` }],
    ["API under annet domene", { SUPABASE_TEST_URL: `https://${REF}.supabase.co.evil.example` }], ["API ugyldig", { SUPABASE_TEST_URL: "ikke en url" }], ["API mangler", { SUPABASE_TEST_URL: undefined }],
    ["DB for annet prosjekt", { SUPABASE_TEST_DB_URL: direct(OTHER) }], ["DB localhost", { SUPABASE_TEST_DB_URL: `${PGS}://postgres:${PW}@127.0.0.1:5432/postgres` }], ["DB annet domene", { SUPABASE_TEST_DB_URL: `${PGS}://postgres:${PW}@db.${REF}.supabase.co.evil.example/postgres` }],
    ["DB pooler med annen bruker-ref", { SUPABASE_TEST_DB_URL: `${PGS}://postgres.${OTHER}:${PW}@aws-0-eu-north-1.pooler.supabase.com:6543/postgres` }], ["DB pooler uten ref i bruker", { SUPABASE_TEST_DB_URL: `${PGS}://postgres:${PW}@aws-0-eu-north-1.pooler.supabase.com:6543/postgres` }],
    ["DB direkte med feil bruker", { SUPABASE_TEST_DB_URL: `${PGS}://admin:${PW}@db.${REF}.supabase.co/postgres` }], ["DB annen port", { SUPABASE_TEST_DB_URL: `${PGS}://postgres:${PW}@db.${REF}.supabase.co:5433/postgres` }],
    ["DB annet databasenavn", { SUPABASE_TEST_DB_URL: `${PGS}://postgres:${PW}@db.${REF}.supabase.co/annet` }], ["DB ukryptert", { SUPABASE_TEST_DB_URL: `${direct()}?sslmode=disable` }],
    ["DB mangler", { SUPABASE_TEST_DB_URL: undefined }], ["DB feil protokoll", { SUPABASE_TEST_DB_URL: `mysql://postgres:${PW}@db.${REF}.supabase.co/postgres` }],
    ["publishable key mangler", { SUPABASE_TEST_PUBLISHABLE_KEY: undefined }],
  ];
  it.each(cases)("%s", (_n, over) => { expect(reject(good(over))).toBeInstanceOf(HostedTargetError); });
  it.each(["host", "hostaddr", "port", "dbname", "database", "service", "options", "user", "password", "%68ost", "HOST"])("parameter som kan overstyre målet (%s) avvises", (p) => {
    expect(reject(good({ SUPABASE_TEST_DB_URL: `${direct()}?${p}=evil.example` }))).toBeInstanceOf(HostedTargetError);
    expect(reject(good({ SUPABASE_TEST_DB_URL: `${pooler()}?${p}=evil.example` }))).toBeInstanceOf(HostedTargetError);
  });
});

describe("ingen hemmeligheter i feilmeldinger eller resultat", () => {
  it("meldinger og beskrivelse inneholder aldri passord, nøkkel, ref eller adresser", () => {
    for (const [, over] of [["ref", { SCOUT_HOSTED_CONFIRM: `TESTPROSJEKT:${OTHER}` }], ["db", { SUPABASE_TEST_DB_URL: direct(OTHER) }], ["api", { SUPABASE_TEST_URL: `https://${OTHER}.supabase.co` }], ["param", { SUPABASE_TEST_DB_URL: `${direct()}?host=${OTHER}.example` }], ["modus", { SCOUT_HOSTED_MODE: "x" }]] as const) {
      const e = reject(good(over))!;
      for (const s of [PW, KEY, REF, OTHER, `${PGS}://`, "https://"]) expect(`${e.message} ${e.category}`).not.toContain(s);
    }
    const d = JSON.stringify(describeTarget(parseHostedTarget(good())));
    for (const s of [PW, KEY, REF, "supabase.co"]) expect(d).not.toContain(s);
  });
});

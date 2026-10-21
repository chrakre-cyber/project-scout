/**
 * CI-001-FIX3 (P2 i review av 9de93c1): alle tre nettleserskript må validere database og API FØR databaseklienten opprettes eller noen forbindelse åpnes.
 * Manglende, ugyldig eller ikke-lokal mål avvises med NULL DB-kall (ingen `new Client`, `connect` eller spørring). Den felles forhåndsvalideringen (`preflight.mjs`) testes ren;
 * selve skriptenes oppstartsdel kjøres med ekte støttemoduler og en falsk Client (tests/ci/startup-harness.ts) — ingen database, nettleser, bygging eller nettverk.
 * Dette er STATISKE/ENHETSTESTER; ingen ekte Supabase er kontaktet.
 */
import { readFileSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { preflightTargets, TargetError } from "./e2e/support/preflight.mjs";
import { runStartup } from "./ci/startup-harness";

const SCRIPTS = ["econ006.e2e.mjs", "econ006d.e2e.mjs", "l4-browser.e2e.mjs"] as const;
// URL-er med passord bygges av deler, så hverken denne filen eller secret-skannet ser et ekte mønster i kildeteksten.
const pgUrl = (pw: string, host: string) => ["postgres", "://postgres:", pw, "@", host, "/postgres"].join("");
const LOCAL_DB = pgUrl("hemmelig-passord-123", "127.0.0.1:54322");
const LOCAL_API = "http://127.0.0.1:54321";
const real = (over: Record<string, string> = {}) => ({ E2E_SUPABASE_MODE: "real", SUPABASE_TEST_DB_URL: LOCAL_DB, SUPABASE_TEST_URL: LOCAL_API, SUPABASE_TEST_PUBLISHABLE_KEY: "test-key", ...over });
let shots = "";
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); if (shots) { rmSync(shots, { recursive: true, force: true }); shots = ""; } });
const withShots = (env: Record<string, string>) => { shots = mkdtempSync(join(tmpdir(), "scout-pre-")); return { ...env, SHOTS: shots }; };

describe("preflightTargets (ren, felles)", () => {
  const env = (o: Record<string, string | undefined>) => ({ ...real(), ...o });
  it("ekte modus: lokal database og API med nøkkel godtas", () => {
    expect(preflightTargets({ mode: "real", env: env({}) })).toMatchObject({ mode: "real", apiUrl: LOCAL_API, hasPublishableKey: true });
    expect(preflightTargets({ mode: "real", env: env({ SUPABASE_TEST_URL: "http://localhost:54321", SUPABASE_TEST_DB_URL: "postgresql://u@localhost:5432/db" }) }).mode).toBe("real");
  });
  it("emulator: bare databasen kreves (lokal); API er emulatorens egen", () => {
    expect(preflightTargets({ mode: "emulator", env: { SUPABASE_TEST_DB_URL: "postgres://postgres@127.0.0.1:20001/scout_test" } }).apiUrl).toBeNull();
    expect(() => preflightTargets({ mode: "emulator", env: { SUPABASE_TEST_DB_URL: "postgres://x@db.example.invalid:5432/d" } })).toThrow(/ikke-lokal/);
    expect(() => preflightTargets({ mode: "emulator", env: {} })).toThrow(/mangler/);
  });
  it.each([
    ["database mangler", { SUPABASE_TEST_DB_URL: undefined }, /database .*mangler/],
    ["database tom", { SUPABASE_TEST_DB_URL: "   " }, /mangler/],
    ["database ugyldig", { SUPABASE_TEST_DB_URL: "ikke en url" }, /ugyldig/],
    ["database feil protokoll", { SUPABASE_TEST_DB_URL: "http://127.0.0.1:54322/db" }, /ugyldig \(protokoll/],
    ["database ikke-lokal", { SUPABASE_TEST_DB_URL: "postgres://test@db.example.invalid:5432/test" }, /ikke-lokal database \(SUPABASE_TEST_DB_URL\) \(vert: db\.example\.invalid\)/],
    ["API mangler", { SUPABASE_TEST_URL: undefined }, /Supabase-API .*mangler/],
    ["API ugyldig", { SUPABASE_TEST_URL: "::::" }, /ugyldig/],
    ["API feil protokoll", { SUPABASE_TEST_URL: "ftp://127.0.0.1:54321" }, /ugyldig \(protokoll/],
    ["API ikke-lokal", { SUPABASE_TEST_URL: "https://api.example.invalid" }, /ikke-lokal Supabase-API \(SUPABASE_TEST_URL\) \(vert: api\.example\.invalid\)/],
    ["nøkkel mangler", { SUPABASE_TEST_PUBLISHABLE_KEY: undefined }, /publishable key .*mangler/],
    ["nøkkel tom", { SUPABASE_TEST_PUBLISHABLE_KEY: " " }, /mangler/],
  ])("ekte modus: %s ⇒ TargetError", (_n, over, re) => {
    let err: unknown;
    try { preflightTargets({ mode: "real", env: env(over) }); } catch (e) { err = e; }
    expect(err).toBeInstanceOf(TargetError);
    expect((err as Error).message).toMatch(re);
  });
  it("triks med lokal-lignende verter avvises (URL-parsing avgjør vertsnavnet); 0.0.0.0 og andre loopback-adresser godtas ikke", () => {
    for (const bad of ["http://127.0.0.1@evil.example:54321", "http://127.0.0.1.evil.example:54321", "http://localhost.evil.example", "http://0.0.0.0:54321", "http://127.0.0.2:54321", "http://[::1]:54321"]) {
      expect(() => preflightTargets({ mode: "real", env: env({ SUPABASE_TEST_URL: bad }) }), bad).toThrow(/ikke-lokal|ugyldig/);
    }
    expect(() => preflightTargets({ mode: "real", env: env({ SUPABASE_TEST_DB_URL: "postgres://127.0.0.1:x@evil.example:5432/db" }) })).toThrow(/ikke-lokal/);
  });
  it("feilmeldinger røper aldri passord, hel adresse eller nøkkel", () => {
    for (const over of [{ SUPABASE_TEST_DB_URL: pgUrl("hemmelig-passord-123", "db.example.invalid:5432") }, { SUPABASE_TEST_URL: "https://api.example.invalid/hemmelig-sti?token=abc" }, { SUPABASE_TEST_PUBLISHABLE_KEY: "" }]) {
      let msg = "";
      try { preflightTargets({ mode: "real", env: env({ SUPABASE_TEST_PUBLISHABLE_KEY: "nokkel-verdi-xyz", ...over }) }); } catch (e) { msg = (e as Error).message; }
      expect(msg).not.toMatch(/hemmelig|token=|nokkel-verdi|postgres:\/\/|https?:\/\//);
    }
  });
});

describe.each(SCRIPTS)("%s: oppstarten avviser før noen DB-forbindelse", (script) => {
  it.each([
    ["ikke-lokal database", real({ SUPABASE_TEST_DB_URL: "postgres://test@db.example.invalid:5432/test" }), /ikke-lokal database/],
    ["ikke-lokal API", real({ SUPABASE_TEST_URL: "https://api.example.invalid" }), /ikke-lokal Supabase-API/],
    ["manglende database", real({ SUPABASE_TEST_DB_URL: "" }), /database .*mangler/],
    ["manglende API", real({ SUPABASE_TEST_URL: "" }), /Supabase-API .*mangler/],
    ["ugyldig database", real({ SUPABASE_TEST_DB_URL: "ikke en url" }), /ugyldig/],
    ["ugyldig API", real({ SUPABASE_TEST_URL: "::::" }), /ugyldig/],
    ["manglende nøkkel", real({ SUPABASE_TEST_PUBLISHABLE_KEY: "" }), /publishable key/],
  ])("ekte modus, %s ⇒ avslag med null kall (ingen new Client, connect eller spørring)", async (_n, env, re) => {
    const r = await runStartup(script, withShots(env));
    expect(r.error, "skal avvises").not.toBeNull();
    expect(r.error!.message).toMatch(re);
    expect(r.calls, "forhåndsvalidering må komme før Client opprettes og alle fixture-skrivinger").toEqual([]);
  });
  it("emulatormodus: ikke-lokal eller manglende database avvises også uten DB-kall", async () => {
    for (const [db, re] of [["postgres://test@db.example.invalid:5432/test", /ikke-lokal/], ["", /mangler/]] as const) {
      const r = await runStartup(script, withShots({ E2E_SUPABASE_MODE: "", SUPABASE_TEST_DB_URL: db }), { stubEmulator: true });
      expect(r.error!.message).toMatch(re);
      expect(r.calls).toEqual([]);
    }
  });
  it("lokal positiv kontroll (ekte modus): passerer valideringen, åpner forbindelsen først da, skriver testoppsett og når tilbake fra connectBackend", async () => {
    const r = await runStartup(script, withShots(real()));
    expect(r.error, r.error?.message).toBeNull();
    expect(r.calls[0]).toBe("new Client");
    expect(r.calls[1]).toBe("connect");
    expect(r.calls.some((c) => /insert into auth\.users/.test(c))).toBe(true);
    expect(r.calls.some((c) => /insert into auth\.identities/.test(c))).toBe(true);
    expect((r.value as { mode: string }).mode).toBe("real");
  });
  it("lokal positiv kontroll (emulatormodus): lokal isolert database godtas og oppsettet kjører", async () => {
    const r = await runStartup(script, withShots({ E2E_SUPABASE_MODE: "", SUPABASE_TEST_DB_URL: "postgres://postgres@127.0.0.1:20123/scout_test_1" }), { stubEmulator: true });
    expect(r.error, r.error?.message).toBeNull();
    expect(r.calls[0]).toBe("new Client");
    expect(r.calls).toContain("connectBackend(emulator, stub)");
    expect((r.value as { mode: string }).mode).toBe("emulator");
  });
  it("rekkefølgen i kildeteksten: preflightTargets() står før `new Client` og før connectBackend", () => {
    const src = readFileSync(join(__dirname, "e2e", script), "utf8");
    const iPre = src.indexOf("preflightTargets();"), iClient = src.indexOf("new Client("), iConn = src.indexOf("await connectBackend(");
    expect(iPre).toBeGreaterThan(0);
    expect(iPre).toBeLessThan(iClient);
    expect(iClient).toBeLessThan(iConn);
    expect(src).toMatch(/import \{ preflightTargets \} from "\.\/support\/preflight\.mjs";/);
  });
});

describe("connectBackend beholder kontrollen som ekstra vern", () => {
  it("avviser ikke-lokal database og API selv om skriptets forhåndsvalidering er omgått, før noen spørring", async () => {
    vi.resetModules();
    vi.stubEnv("E2E_SUPABASE_MODE", "real");
    vi.stubEnv("SUPABASE_TEST_URL", "https://api.example.invalid");
    vi.stubEnv("SUPABASE_TEST_PUBLISHABLE_KEY", "k");
    const { connectBackend } = await import("./e2e/support/backend.mjs");
    const q: string[] = [];
    const db = { query: async (s: string) => { q.push(s); return { rows: [] }; } };
    await expect(connectBackend({ db, dbUrl: LOCAL_DB, users: [{ id: "u", email: "e@example.test" }], port: 1, pgModulePath: "pg" })).rejects.toThrow(/ikke-lokal Supabase-API/);
    vi.stubEnv("SUPABASE_TEST_URL", LOCAL_API);
    await expect(connectBackend({ db, dbUrl: "postgres://x@db.example.invalid:5432/d", users: [], port: 1, pgModulePath: "pg" })).rejects.toThrow(/ikke-lokal database/);
    expect(q).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------
// CI-001-FIX4 (P2 i re-review av b346e62): query-parametere i databaseadressen kan overstyre vert/port i node-postgres. URL.hostname alene er ikke nok.
// ---------------------------------------------------------------------------------------------------------------------------------------------------------
describe("databaseadresse med parametere som kan overstyre vert/port (FIX4)", async () => {
  const pg = (await import("pg")).default as unknown as { Client: new (o: { connectionString: string }) => { connectionParameters: { host: string; port: number } } };
  const effective = (u: string) => new pg.Client({ connectionString: u }).connectionParameters;
  const base = pgUrl("hemmelig-passord-123", "127.0.0.1:54322");
  const withQuery = (q: string) => `${base}?${q}`;
  const OVERRIDES: [string, string][] = [
    ["host=db.example.invalid", "host-parameter (fjern vert)"],
    ["%68ost=db.example.invalid", "URL-kodet parameternavn %68ost"],
    ["%48OST=db.example.invalid", "URL-kodet versal %48OST"],
    ["HOST=db.example.invalid", "versal HOST"],
    ["host=db.example.invalid&host=127.0.0.1", "gjentatt host (første fjern)"],
    ["host=127.0.0.1&host=db.example.invalid", "gjentatt host (siste fjern)"],
    ["host=localhost", "host-parameter som peker lokalt (avvises likevel: parametere som overstyrer målet er ikke tillatt)"],
    ["hostaddr=10.0.0.5", "hostaddr"],
    ["port=5432", "port-parameter"],
    ["dbname=annen", "dbname-parameter"],
    ["database=annen", "database-parameter"],
    ["service=prod", "service-parameter"],
    ["%20host=db.example.invalid", "parameternavn med blank"],
  ];
  const real = (db: string) => ({ E2E_SUPABASE_MODE: "real", SUPABASE_TEST_DB_URL: db, SUPABASE_TEST_URL: LOCAL_API, SUPABASE_TEST_PUBLISHABLE_KEY: "test-key" });

  it("grunnlag: driveren velger faktisk den fjerne verten selv om URL.hostname er lokal (det reviewer påviste)", () => {
    expect(new URL(withQuery("host=db.example.invalid")).hostname).toBe("127.0.0.1");
    expect(effective(withQuery("host=db.example.invalid")).host).toBe("db.example.invalid");
    expect(effective(withQuery("%68ost=db.example.invalid")).host).toBe("db.example.invalid");
    expect(effective(withQuery("port=5432")).port).toBe(5432);
  });
  it.each(OVERRIDES)("preflight avviser %s (%s) i begge moduser", (q) => {
    for (const mode of ["real", "emulator"] as const) {
      expect(() => preflightTargets({ mode, env: { ...real(withQuery(q)) } }), `${mode} ${q}`).toThrow(TargetError);
    }
  });
  it("feilmeldingene nevner parameternavn eller vert, aldri passord, hel adresse eller verdien til parameteren", () => {
    for (const [q] of OVERRIDES) {
      let msg = "";
      try { preflightTargets({ mode: "real", env: real(withQuery(q)) }); } catch (e) { msg = (e as Error).message; }
      expect(msg, q).not.toMatch(/hemmelig|postgres:\/\/|\?|=db\.example/);
    }
  });
  it("harmløse parametere (sslmode, application_name) godtas, og driverens effektive vert/port er da lokal og lik adressen", () => {
    for (const q of ["sslmode=disable", "application_name=scout-e2e", "sslmode=disable&application_name=x"]) {
      for (const mode of ["real", "emulator"] as const) expect(preflightTargets({ mode, env: real(withQuery(q)) }).dbUrl, `${mode} ${q}`).toBe(withQuery(q));
      const e = effective(withQuery(q));
      expect([e.host, e.port]).toEqual(["127.0.0.1", 54322]);
    }
  });
  it("invariant: alt preflight godtar har lokal EFFEKTIV driververt og -port (kontrollert mot driveren, ikke mot URL.hostname)", () => {
    const candidates = [base, ...OVERRIDES.map(([q]) => withQuery(q)), withQuery("sslmode=disable"), `${pgUrl("pw-123456", "localhost:5432")}?connect_timeout=5`, pgUrl("pw-123456", "db.example.invalid:5432")];
    let accepted = 0;
    for (const u of candidates) {
      try { preflightTargets({ mode: "emulator", env: { SUPABASE_TEST_DB_URL: u } }); } catch { continue; }
      accepted += 1;
      const e = effective(u);
      expect(["127.0.0.1", "localhost"], u.replace(/:[^:@/]+@/, ":***@")).toContain(e.host);
    }
    expect(accepted).toBeGreaterThanOrEqual(3);
  });
  it("connectBackend (ekstra vern) avviser parameter-overstyring uten noen spørring, i begge moduser", async () => {
    for (const mode of ["real", "emulator"] as const) {
      vi.resetModules();
      vi.stubEnv("E2E_SUPABASE_MODE", mode === "real" ? "real" : "");
      vi.stubEnv("SUPABASE_TEST_URL", LOCAL_API);
      vi.stubEnv("SUPABASE_TEST_PUBLISHABLE_KEY", "k");
      const { connectBackend } = await import("./e2e/support/backend.mjs");
      const q: string[] = [];
      const db = { query: async (s: string) => { q.push(s); return { rows: [] }; } };
      await expect(connectBackend({ db, dbUrl: withQuery("%68ost=db.example.invalid"), users: [{ id: "u", email: "e@example.test" }], port: 1, pgModulePath: "pg" }), mode).rejects.toThrow(/overstyre/);
      expect(q, mode).toEqual([]);
    }
  });
});

describe.each(SCRIPTS)("%s: databaseparametere som overstyrer målet gir avslag uten DB-kall (FIX4)", (script) => {
  const base = pgUrl("hemmelig-passord-123", "127.0.0.1:54322");
  const cases: [string, string][] = [["host=db.example.invalid", "host"], ["%68ost=db.example.invalid", "URL-kodet navn"], ["%48OST=db.example.invalid", "URL-kodet versal"], ["host=127.0.0.1&host=db.example.invalid", "gjentatt host"], ["port=5432", "port"], ["hostaddr=10.0.0.5", "hostaddr"]];
  it.each(cases)("ekte modus, ?%s (%s) ⇒ avslag og null kall (ingen new Client, connect eller spørring)", async (q) => {
    const r = await runStartup(script, withShots({ E2E_SUPABASE_MODE: "real", SUPABASE_TEST_DB_URL: `${base}?${q}`, SUPABASE_TEST_URL: LOCAL_API, SUPABASE_TEST_PUBLISHABLE_KEY: "test-key" }));
    expect(r.error, "skal avvises").not.toBeNull();
    expect(r.error!.message).toMatch(/overstyre|ikke-lokal|avviker/);
    expect(r.error!.message).not.toMatch(/hemmelig|postgres:\/\//);
    expect(r.calls, "ingen databasekontakt før avslag").toEqual([]);
  });
  it.each(cases)("emulatormodus, ?%s (%s) ⇒ avslag og null kall", async (q) => {
    const r = await runStartup(script, withShots({ E2E_SUPABASE_MODE: "", SUPABASE_TEST_DB_URL: `${base}?${q}` }), { stubEmulator: true });
    expect(r.error, "skal avvises").not.toBeNull();
    expect(r.error!.message).toMatch(/overstyre|ikke-lokal|avviker/);
    expect(r.calls).toEqual([]);
  });
  it("lokal positiv kontroll med harmløs parameter: passerer og oppsettet kjører (ekte og emulator)", async () => {
    const okReal = await runStartup(script, withShots({ E2E_SUPABASE_MODE: "real", SUPABASE_TEST_DB_URL: `${base}?sslmode=disable`, SUPABASE_TEST_URL: LOCAL_API, SUPABASE_TEST_PUBLISHABLE_KEY: "test-key" }));
    expect(okReal.error, okReal.error?.message).toBeNull();
    expect(okReal.calls.slice(0, 2)).toEqual(["new Client", "connect"]);
    const okEmu = await runStartup(script, withShots({ E2E_SUPABASE_MODE: "", SUPABASE_TEST_DB_URL: `${base}?application_name=scout` }), { stubEmulator: true });
    expect(okEmu.error, okEmu.error?.message).toBeNull();
    expect(okEmu.calls[0]).toBe("new Client");
  });
});

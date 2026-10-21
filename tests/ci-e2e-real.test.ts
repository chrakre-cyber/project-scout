/**
 * CI-001 trinn 2 — STATISKE tester og enhetstester av e2e-støtten (backend-valg, nettleserfinning, IKKE KJØRT-vei, skriptenes moduser). De kjører ikke Supabase og ingen
 * ekte nettleserflyt; nettleserløpene er prøvd i EMULATORMODUS (se reviews/CI-001-trinn2/). Ekte modus (E2E_SUPABASE_MODE=real) er ikke kjørt noe sted ennå.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path, { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { findChrome, NOT_RUN_EXIT } from "./e2e/support/browser.mjs";

const ROOT = join(__dirname, "..");
const read = (f: string) => readFileSync(join(ROOT, f), "utf8");
const code = (f: string) => read(f).split("\n").filter((l) => !/^\s*(\/\/|#)/.test(l)).join("\n");

describe("findChrome / launchBrowser: ingen automatisk installasjon", () => {
  const none = () => false;
  it("CHROME_PATH som ikke finnes ⇒ null (ikke reserve til andre nettlesere); som finnes ⇒ stien", () => {
    expect(findChrome({ CHROME_PATH: "/x/chrome" }, none)).toBeNull();
    expect(findChrome({ CHROME_PATH: "/x/chrome" }, (p: string) => p === "/x/chrome")).toBe("/x/chrome");
    expect(findChrome({ CHROME_PATH: "/x/chrome" }, (p: string) => p === "/usr/bin/google-chrome")).toBeNull();
  });
  it("uten CHROME_PATH: kjente stier, deretter PLAYWRIGHT_BROWSERS_PATH; ingenting funnet ⇒ null", () => {
    expect(findChrome({}, (p: string) => p === "/usr/bin/google-chrome")).toBe("/usr/bin/google-chrome");
    expect(findChrome({}, (p: string) => p === "/usr/bin/chromium")).toBe("/usr/bin/chromium");
    // path.join i hjelperen gir plattformens skilletegn: forventning og falsk filsystemfunksjon bruker samme path.join (ikke hardkodet POSIX)
    const chrome = path.join("/pw", "chromium-1194", "chrome-linux", "chrome");
    const ex = (p: string) => p === "/pw" || p === chrome;
    expect(findChrome({ PLAYWRIGHT_BROWSERS_PATH: "/pw" }, ex, () => ["chromium-1100", "chromium-1194", "ffmpeg-1"] as never)).toBe(chrome);
    expect(findChrome({}, none)).toBeNull();
  });
  it("manglende nettleser: prosessen avslutter med exit 3 og «IKKE KJØRT» (aldri 0), uten å laste ned noe", () => {
    const r = spawnSync("node", ["--input-type=module", "-e", 'import { launchBrowser } from "./tests/e2e/support/browser.mjs"; await launchBrowser(); console.log("UVENTET: startet");'], { cwd: ROOT, env: { ...process.env, PW: "", CHROME_PATH: "/finnes/ikke/chrome" }, encoding: "utf8" });
    expect(NOT_RUN_EXIT).toBe(3);
    expect(r.status).toBe(3);
    expect(r.stdout).toMatch(/IKKE KJØRT/);
    expect(r.stdout).toMatch(/Ingenting installeres automatisk/);
    expect(r.stdout).not.toMatch(/UVENTET/);
  });
});

describe("backend.mjs: emulator og ekte modus er adskilt", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });
  const fakeDb = () => { const q: string[] = []; return { q, db: { query: async (sql: string) => { q.push(sql.replace(/\s+/g, " ").trim()); return { rows: [] }; } } }; };
  const load = async (env: Record<string, string>) => { vi.resetModules(); for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v); return import("./e2e/support/backend.mjs"); };
  const users = [{ id: "u1", email: "a@example.test" }];

  it("standard er emulator; ekte modus må bestilles uttrykkelig", async () => {
    expect((await load({ E2E_SUPABASE_MODE: "" })).MODE).toBe("emulator");
    expect((await load({ E2E_SUPABASE_MODE: "noe-annet" })).MODE).toBe("emulator");
    expect((await load({ E2E_SUPABASE_MODE: "real" })).MODE).toBe("real");
  });
  it("ekte modus: krever URL og nøkkel, nekter ikke-lokal Supabase og ikke-lokal database", async () => {
    const { db } = fakeDb();
    const m = await load({ E2E_SUPABASE_MODE: "real", SUPABASE_TEST_URL: "", SUPABASE_TEST_PUBLISHABLE_KEY: "" });
    await expect(m.connectBackend({ db, dbUrl: "postgres://x@127.0.0.1:1/db", users, port: 1, pgModulePath: "pg" })).rejects.toThrow(/SUPABASE_TEST_URL/);
    const m2 = await load({ E2E_SUPABASE_MODE: "real", SUPABASE_TEST_URL: "https://abc.supabase.co", SUPABASE_TEST_PUBLISHABLE_KEY: "k" });
    await expect(m2.connectBackend({ db, dbUrl: "postgres://x@127.0.0.1:1/db", users, port: 1, pgModulePath: "pg" })).rejects.toThrow(/ikke-lokal/);
    const m3 = await load({ E2E_SUPABASE_MODE: "real", SUPABASE_TEST_URL: "http://127.0.0.1:54321", SUPABASE_TEST_PUBLISHABLE_KEY: "k" });
    await expect(m3.connectBackend({ db, dbUrl: "postgres://x@db.example.com:5432/db", users, port: 1, pgModulePath: "pg" })).rejects.toThrow(/ikke-lokal/);
  });
  it("ekte modus (lokal): oppretter identitet for testbrukerne, ingen forespørselslogg, og rydder bort firma og brukere uten å kaste", async () => {
    const { db, q } = fakeDb();
    const m = await load({ E2E_SUPABASE_MODE: "real", SUPABASE_TEST_URL: "http://localhost:54321", SUPABASE_TEST_PUBLISHABLE_KEY: "pub" });
    const b = await m.connectBackend({ db, dbUrl: "postgres://x@127.0.0.1:54322/postgres", users, port: 1, pgModulePath: "pg" });
    expect([b.mode, b.url, b.publishableKey, b.log]).toEqual(["real", "http://localhost:54321", "pub", null]);
    expect(q.some((s) => /insert into auth\.identities/.test(s))).toBe(true);
    await b.cleanup({ firmIds: ["f1"], users });
    expect(q.filter((s) => /^delete from/.test(s)).map((s) => s.match(/delete from (\S+)/)![1])).toEqual(["public.dealer_economics_inputs", "public.dealer_economics_profiles", "public.search_drafts", "public.dealership_members", "public.dealerships", "auth.users"]);
    const failing = { query: async () => { throw new Error("boom"); } };
    const b2 = await m.connectBackend({ db: { query: async () => ({ rows: [] }) }, dbUrl: "postgres://x@127.0.0.1:54322/postgres", users: [], port: 1, pgModulePath: "pg" });
    await expect(m.connectBackend({ db: failing, dbUrl: "postgres://x@127.0.0.1:54322/postgres", users: [], port: 1, pgModulePath: "pg" }).then((x) => x.cleanup({ firmIds: ["f1"], users: [] }))).resolves.toBeUndefined();
    expect(b2.mode).toBe("real");
  });
});

describe("skriptene: moduser, delvis dekning og avgrensning", () => {
  const scripts = ["tests/e2e/econ006.e2e.mjs", "tests/e2e/econ006d.e2e.mjs", "tests/e2e/l4-browser.e2e.mjs"];
  it("alle tre bruker backend-/nettlesertilpasningen, skriver MODUS og avslutter 4 (delvis) ved hoppede sjekker — aldri 0", () => {
    for (const f of scripts) {
      const c = code(f);
      expect(c, f).toMatch(/connectBackend\(/);
      expect(c, f).toMatch(/launchBrowser\(\)/);
      expect(c, f).toMatch(/process\.exit\(failed\.length \? 1 : skipped\.length \? 4 : 0\)/);
      expect(c, f).toMatch(/HOPPET \(regnes IKKE som bestått/);
      expect(c, f).not.toMatch(/require\(process\.env\.PW\)/); // ikke lenger hardkodet til full playwright
      expect(c, f).not.toMatch(/storageState|recordHar|recordVideo|tracing\.start/);
    }
    expect(read("tests/e2e/support/backend.mjs")).toMatch(/MODUS: \$\{MODE === "real"/);
  });
  it("econ006: emulatorens forespørselslogg-sjekk hoppes over (HOPP) i ekte modus — ikke stilltiende fjernet — og kjører i emulatormodus", () => {
    const c = read("tests/e2e/econ006.e2e.mjs");
    expect(c).toMatch(/if \(emu\.log\) \{[\s\S]*?check\("J3: appen sendte aldri dealership_id/);
    expect(c).toMatch(/\} else \{\s*skip\("J3: appen sendte aldri dealership_id[^"]*", "ekte modus har ingen forespørselslogg/);
  });
  it("econ006d bygger den uendrede appen mot valgt backend før start (ingen avhengighet av en eldre .next)", () => {
    const c = code("tests/e2e/econ006d.e2e.mjs");
    expect(c.indexOf('execFileSync("npm", ["run", "build"]')).toBeGreaterThan(-1);
    expect(c.indexOf('execFileSync("npm", ["run", "build"]')).toBeLessThan(c.indexOf("await startIn(process.cwd(), MAIN)"));
  });
  it("L4 nettleser: dekker anonym, feil/ukjent bruker, innlogging, reload, utløpt sesjon, ødelagt cookie, utlogging, bruker uten firma; revokeringssjekken er bare ekte modus", () => {
    const c = read("tests/e2e/l4-browser.e2e.mjs");
    for (const needle of ["anonym:", "feil passord og ukjent bruker", "riktig passord:", "sesjonen overlever reload", "utløpt tid i sesjonen", "ødelagt sesjonscookie", "utlogging:", "etter utlogging", "bruker uten firma:", "ingen JavaScript-feil"]) expect(c, needle).toContain(needle);
    expect(c).toMatch(/if \(backend\.mode === "real"\) check\("gjenbruk av gammel sesjon etter utlogging avvises av GoTrue/);
    expect(c).toMatch(/else skip\("gjenbruk av gammel sesjon etter utlogging avvises/);
    expect(c).not.toMatch(/console\.log\([^)]*(cookie|password|token)/i);
  });
  it("wrapperen for ekte modus: IKKE KJØRT uten nettleser, exit-koder, nøkler skrives ikke ut, skjermbilder til temp, ingen installasjon, emulatorskriptene urørt", () => {
    const sh = code("scripts/test-e2e-real-supabase.sh");
    expect(sh).toMatch(/E2E_SUPABASE_MODE=real/);
    expect(sh).toMatch(/process\.exit\(NOT_RUN_EXIT\)/);
    expect(sh).toMatch(/unset PW/);
    expect(sh).toMatch(/preflightTargets\(\{ mode: "real" \}\)[\s\S]*process\.exit\(2\)/); // felles forhåndsvalidering før noe startes
    expect(sh.indexOf("preflightTargets")).toBeLessThan(sh.indexOf("node \"$script\""));
    expect(sh).toMatch(/SHOTS="\$\(mktemp -d\)"/);
    expect(sh).not.toMatch(/echo[^\n]*(PUBLISHABLE_KEY|DB_URL|SUPABASE_TEST_URL|\$status)|printf[^\n]*(PUBLISHABLE_KEY|DB_URL)|set -x/);
    expect(sh).not.toMatch(/\bapt(-get)?\b|\bsudo\b|playwright(-core)? install|npm\s+(i|install)\b|curl\s|wget\s/);
    for (const f of ["scripts/test-e2e-econ006.sh", "scripts/test-e2e-econ006d.sh"]) expect(read(f), f).not.toMatch(/E2E_SUPABASE_MODE=real/);
  });
});

describe("playwright-core som devDependency (kun biblioteket, ingen nettleser-nedlasting)", () => {
  const pkg = JSON.parse(read("package.json")) as { devDependencies: Record<string, string>; dependencies: Record<string, string>; scripts: Record<string, string> };
  const lock = JSON.parse(read("package-lock.json")) as { packages: Record<string, { version?: string; dev?: boolean; hasInstallScript?: boolean; integrity?: string }> };
  it("eksakt versjon i package.json og lockfil, kun som devDependency; ingen full `playwright`-pakke; ingen install-script", () => {
    expect(pkg.devDependencies["playwright-core"]).toMatch(/^\d+\.\d+\.\d+$/);
    expect(pkg.dependencies["playwright-core"]).toBeUndefined();
    expect(pkg.dependencies.playwright ?? pkg.devDependencies.playwright).toBeUndefined();
    const l = lock.packages["node_modules/playwright-core"]!;
    expect([l.version, l.dev, l.hasInstallScript]).toEqual([pkg.devDependencies["playwright-core"], true, undefined]);
    expect(l.integrity).toMatch(/^sha512-/);
    expect(JSON.stringify(pkg.scripts)).not.toMatch(/playwright/);
  });
});

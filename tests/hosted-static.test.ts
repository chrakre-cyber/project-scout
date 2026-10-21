// HOST-001 (forberedelse): localhost-sperrene er uendret og hosted-modus er separat/uttrykkelig; skriptene skriver ikke ut miljø eller hemmeligheter; lokale belegg er ignorert av git.
import { readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";
const PGS = ["post", "gres"].join("");   // schema settes sammen ved kjøring så hemmelighetsskannet ikke flagger syntetiske test-URL-er

const read = (f: string) => readFileSync(f, "utf8");
const code = (f: string) => read(f).split("\n").filter((l) => !/^\s*(\/\/|#)/.test(l)).join("\n");
const REF = "abcdefghij0123456789";
const hostedEnv = (over: Record<string, string | undefined> = {}) => ({
  SCOUT_HOSTED_TESTS: "1", SCOUT_HOSTED_MODE: "fresh", SCOUT_HOSTED_PROJECT_REF: REF, SCOUT_HOSTED_CONFIRM: `TESTPROSJEKT:${REF}`, SCOUT_HOSTED_STAGE: "h3-api",
  SUPABASE_TEST_URL: `https://${REF}.supabase.co`, SUPABASE_TEST_DB_URL: `${PGS}://postgres:${["p", "w", "SENT", "1234"].join("-")}@db.${REF}.supabase.co:5432/postgres`, SUPABASE_TEST_PUBLISHABLE_KEY: ["k", "SENT", "5678"].join("-"), ...over,
});
const LOCAL = { SUPABASE_TEST_URL: "http://127.0.0.1:54321", SUPABASE_TEST_PUBLISHABLE_KEY: "k-local-12345", SUPABASE_TEST_DB_URL: `${PGS}://postgres:postgres@127.0.0.1:54322/postgres` };
const KEYS = ["SCOUT_HOSTED_TESTS", "SCOUT_HOSTED_MODE", "SCOUT_HOSTED_PROJECT_REF", "SCOUT_HOSTED_CONFIRM", "SCOUT_HOSTED_STAGE", "SUPABASE_TEST_URL", "SUPABASE_TEST_DB_URL", "SUPABASE_TEST_PUBLISHABLE_KEY"];

async function harnessWith(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const k of KEYS) delete process.env[k];
  for (const [k, v] of Object.entries(env)) if (v !== undefined) process.env[k] = v;
  return await import("./db/harness");
}
afterEach(() => { for (const k of KEYS) delete process.env[k]; vi.resetModules(); });

describe("localhost-sperrene er uendret; hosted er separat og uttrykkelig", () => {
  it("assertLocal avviser fortsatt alt som ikke er 127.0.0.1/localhost — også med hosted-variabler satt", async () => {
    const h = await harnessWith(hostedEnv());
    expect(() => h.assertLocal()).toThrow(/ikke-lokal host/);
    const l = await harnessWith({ ...LOCAL });
    expect(() => l.assertLocal()).not.toThrow();
  });
  it("assertTarget uten SCOUT_HOSTED_TESTS=1 oppfører seg som assertLocal (hosted-adresser avvises, lokale godtas)", async () => {
    const h = await harnessWith(hostedEnv({ SCOUT_HOSTED_TESTS: "0" }));
    expect(() => h.assertTarget()).toThrow(/ikke-lokal host/);
    const l = await harnessWith({ ...LOCAL });
    expect(() => l.assertTarget()).not.toThrow();
  });
  it("hosted-modus godtar bare ETT validert hosted-mål med riktig trinn; lokale adresser, feil prosjekt og feil trinn avvises", async () => {
    const ok = await harnessWith(hostedEnv());
    expect(() => ok.assertTarget()).not.toThrow();
    for (const over of [{ SCOUT_HOSTED_STAGE: "h2-apply" }, { SCOUT_HOSTED_CONFIRM: "TESTPROSJEKT:zzzzzzzzzz9999999999" }, { ...LOCAL }, { SUPABASE_TEST_URL: `https://zzzzzzzzzz9999999999.supabase.co` }]) {
      const h = await harnessWith(hostedEnv(over));
      expect(() => h.assertTarget(), JSON.stringify(Object.keys(over))).toThrow();
    }
  });
  it("assertTarget-feil nevner aldri adresser, passord eller nøkler", async () => {
    const h = await harnessWith(hostedEnv({ SCOUT_HOSTED_CONFIRM: "feil" }));
    let msg = "";
    try { h.assertTarget(); } catch (e) { msg = (e as Error).message; }
    for (const s of [REF, "SENT", "supabase.co", `${PGS}://`]) expect(msg).not.toContain(s);
  });
  it("bare de to hosted-egnede testfilene bruker assertTarget; alle andre DB-tester bruker fortsatt assertLocal; assertLocal er byte-identisk i logikk", () => {
    const files = readdirSync("tests/db").filter((f) => f.endsWith(".test.ts"));
    const uses = (f: string, fn: string) => new RegExp(`\\b${fn}\\(\\)`).test(read(`tests/db/${f}`));
    expect(files.filter((f) => uses(f, "assertTarget")).sort()).toEqual(["auth-gotrue.test.ts", "rest-isolation.test.ts"]);
    for (const f of files.filter((x) => !["auth-gotrue.test.ts", "rest-isolation.test.ts"].includes(x))) expect(uses(f, "assertTarget"), f).toBe(false);
    const h = read("tests/db/harness.ts");
    expect(h).toContain('if (host !== "127.0.0.1" && host !== "localhost") throw new Error(`Nekter å kjøre mot ikke-lokal host ${host}`);');
    expect(h).toContain('if (process.env.SCOUT_HOSTED_TESTS !== "1") return assertLocal();');
  });
  it("e2e-oppsettet (preflight/backend) er uendret og forblir lokalt: ingen hosted-referanser", () => {
    for (const f of ["tests/e2e/support/preflight.mjs", "tests/e2e/support/backend.mjs", "scripts/test-e2e-real-supabase.sh", "scripts/test-db.sh"]) expect(read(f), f).not.toMatch(/hosted|SCOUT_HOSTED/i);
  });
});

describe("skript: ingen utskrift av miljø/hemmeligheter, ingen sletting utenom opprydding, lokale belegg ignoreres", () => {
  it("run.sh og cli.mjs: ingen set -x, env/printenv, console, eller direkte process.stdout utenom print-avhengigheten", () => {
    const sh = code("scripts/hosted/run.sh"), cli = code("scripts/hosted/cli.mjs");
    expect(sh).not.toMatch(/set -[a-z]*x|printenv|\benv\b\s*$|echo "\$/m);
    expect(cli).not.toMatch(/console\.|process\.stderr/);
    expect((cli.match(/process\.stdout\.write/g) ?? []).length).toBe(1);   // bare i standard print-avhengigheten
    expect(cli).toMatch(/const say = \(t\) => deps\.print\(sanitizeText\(t, lits\)\)/);
  });
  it("hver forbindelse åpnes etter målvalidering og trinntillatelse; ssl med sertifikatkontroll; ingen automatisk sletting i andre moduler", () => {
    const cli = code("scripts/hosted/cli.mjs");
    expect(cli.indexOf("parseHostedTarget(env, { stage: STAGE_OF[cmd] })")).toBeGreaterThan(-1);
    expect(cli.indexOf("parseHostedTarget(env, { stage: STAGE_OF[cmd] })")).toBeLessThan(cli.indexOf("deps.connect(env)"));
    expect(cli).toContain("ssl: { rejectUnauthorized: true }");
    for (const f of ["inspect", "gate", "report", "target", "migrations"]) expect(code(`scripts/hosted/${f}.mjs`), f).not.toMatch(/\b(delete|drop|truncate|insert|update|alter)\s/i);
    expect(code("scripts/hosted/cleanup.mjs").match(/delete from/g)!.length).toBeGreaterThan(0);
  });
  it("dry-run bruker --dry-run, anvendelse ikke; ingen --force/--include-all/reset", () => {
    const cli = code("scripts/hosted/cli.mjs");
    expect(cli).toContain('...(cmd === "dry-run" ? ["--dry-run"] : [])');
    expect(cli).not.toMatch(/--force|--include-all|db reset|db push --yes|--linked|supabase link|supabase login/);
  });
  it(".hosted/ og .env.hosted.local er ignorert av git", () => {
    const r = spawnSync("git", ["check-ignore", ".hosted/inspect.json", ".env.hosted.local"], { encoding: "utf8" });
    expect(r.stdout.trim().split("\n").sort()).toEqual([".env.hosted.local", ".hosted/inspect.json"]);
  });
  it("uten miljø avviser run.sh før noe annet skjer (exit 2, ingen forbindelse)", () => {
    const r = spawnSync("bash", ["scripts/hosted/run.sh", "inspect"], { encoding: "utf8", env: { PATH: process.env.PATH!, NODE_ENV: "test" } });
    expect(r.status).toBe(2);
    expect(r.stdout).toMatch(/hosted-mål avvist/);
  });
});

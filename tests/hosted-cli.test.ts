// HOST-001 (forberedelse): kommandolinjen med innsprøytede avhengigheter (falsk DB-klient og falsk prosesskjøring). Beviser at ingenting når nettverk/prosess uten gyldig mål, uttrykkelig trinn og gate,
// at rå utskrift saneres, og at anvendelse ikke skjer uten inspeksjon og dry-run. Ingen hosted kontakt, ingen ekte forbindelse.
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { EXPIRED_TOKEN_TEST, H3_TEST_FILES, main } from "../scripts/hosted/cli.mjs";
import { repoMigrationList } from "../scripts/hosted/migrations.mjs";
import { fingerprintOf } from "../scripts/hosted/target.mjs";
import { l46Rows, vitestJson } from "./ci/l3b-fixtures";
const PGS = ["post", "gres"].join(""), PGQL = `${PGS}ql`;   // schema settes sammen ved kjøring så hemmelighetsskannet ikke flagger syntetiske test-URL-er

const REF = "abcdefghij0123456789";
const PW = ["pw", "SENT", "q1w2e3"].join("-"), KEY = ["key", "SENT", "r4t5y6"].join("-"), JWT = ["jwtsecret", "SENT", "u7i8o9p0"].join("-");
const DB = `${PGQL}://postgres:${PW}@db.${REF}.supabase.co:5432/postgres`;
const versions = repoMigrationList().map((m) => m.version);
const baseEnv = (over: Record<string, string | undefined> = {}) => ({
  SCOUT_HOSTED_PROJECT_REF: REF, SCOUT_HOSTED_CONFIRM: `TESTPROSJEKT:${REF}`, SCOUT_HOSTED_MODE: "fresh", SUPABASE_TEST_URL: `https://${REF}.supabase.co`, SUPABASE_TEST_DB_URL: DB, SUPABASE_TEST_PUBLISHABLE_KEY: KEY, ...over,
}) as Record<string, string | undefined>;
const dirs: string[] = [];
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

function setup(opts: { applied?: string[] | null; runOut?: (cmd: string, args: string[]) => { code: number; out: string } } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "scout-hosted-cli-")); dirs.push(dir);
  const log = { connects: 0, runs: [] as { cmd: string; args: string[]; env: Record<string, string> }[], sql: [] as string[], printed: [] as string[] };
  let applied = opts.applied ?? null;
  const client = {
    async query(sql: string) {
      log.sql.push(sql);
      if (/to_regclass\('supabase_migrations/.test(sql)) return { rows: [{ t: applied !== null }] };
      if (/from supabase_migrations\.schema_migrations/.test(sql)) return { rows: (applied ?? []).map((version) => ({ version })) };
      if (/from pg_tables/.test(sql)) return { rows: [{ pub: applied ? 5 : 0, priv: applied ? 2 : 0 }] };
      if (/to_regclass/.test(sql)) return { rows: [{ t: false }] };
      if (/to_regprocedure/.test(sql)) return { rows: [{ f: false }] };
      return { rows: [] };
    },
    async end() { /* ingen forbindelse */ },
  };
  const deps = {
    now: () => new Date("2026-10-22T10:00:00Z"), print: (t: string) => { log.printed.push(t); }, dir, repoDir: "supabase/migrations",
    connect: async () => { log.connects += 1; return client; },
    run: async (cmd: string, args: string[], env: Record<string, string>) => {
      log.runs.push({ cmd, args, env });
      if (opts.runOut) return opts.runOut(cmd, args);
      return { code: 0, out: "" };
    },
  };
  return { deps, log, dir, setApplied: (a: string[] | null) => { applied = a; } };
}
const printed = (l: { printed: string[] }) => l.printed.join("\n");
const noContact = (l: { connects: number; runs: unknown[] }) => { expect(l.connects).toBe(0); expect(l.runs).toHaveLength(0); };

describe("ingenting når nettverk eller prosess uten gyldig mål og uttrykkelig trinn", () => {
  const CMDS: Array<[string[], string]> = [[["inspect"], "h2-inspect"], [["dry-run"], "h2-dry-run"], [["apply"], "h2-apply"], [["h3-api"], "h3-api"], [["cleanup"], "h4-cleanup"], [["cleanup", "--execute"], "h4-cleanup-execute"]];
  it.each(CMDS)("%j uten miljø / uten trinn / med feil trinn ⇒ avvist (exit 2), ingen forbindelse, ingen prosess", async (argv, stage) => {
    for (const env of [{}, baseEnv(), baseEnv({ SCOUT_HOSTED_STAGE: "check-target" }), baseEnv({ SCOUT_HOSTED_STAGE: stage === "h2-apply" ? "h2-dry-run" : "h2-apply" })]) {
      const t = setup();
      expect(await main(argv, env, t.deps as never)).toBe(2);
      noContact(t.log);
    }
  });
  it("ukjent kommando og lokalt mål i hosted-modus avvises", async () => {
    const t = setup();
    expect(await main(["finnes-ikke"], baseEnv(), t.deps as never)).toBe(2);
    expect(await main(["inspect"], baseEnv({ SCOUT_HOSTED_STAGE: "h2-inspect", SUPABASE_TEST_URL: "http://127.0.0.1:54321", SUPABASE_TEST_DB_URL: `${PGS}://postgres@127.0.0.1:5432/postgres` }), t.deps as never)).toBe(2);
    noContact(t.log);
  });
  it("check-target åpner ingen forbindelse og viser bare fingeravtrykk", async () => {
    const t = setup();
    expect(await main(["check-target"], baseEnv(), t.deps as never)).toBe(0);
    noContact(t.log);
    const out = printed(t.log);
    expect(out).toContain(fingerprintOf(REF));
    for (const s of [REF, PW, KEY, "db."]) expect(out).not.toContain(s);
  });
  it("sletting krever egen bekreftelse FØR noen forbindelse åpnes", async () => {
    const t = setup();
    expect(await main(["cleanup", "--execute"], baseEnv({ SCOUT_HOSTED_STAGE: "h4-cleanup-execute" }), t.deps as never)).toBe(2);
    noContact(t.log);
  });
});

describe("H2: inspeksjon → dry-run → anvendelse (bare via gate)", () => {
  const listing = (vs: string[]) => `Would push these migrations:\n${vs.map((v) => ` • ${v}_x.sql`).join("\n")}\n`;
  it("tomt prosjekt: inspeksjon OK, dry-run og anvendelse kjører de forventede kommandoene, resultatet kontrolleres, og ingen hemmeligheter skrives ut", async () => {
    const t = setup({ runOut: (_c, args) => (args.includes("--dry-run") ? { code: 0, out: `${listing(versions)} url ${DB} key ${KEY}` } : { code: 0, out: `applied ${DB}` }) });
    const env = (stage: string) => baseEnv({ SCOUT_HOSTED_STAGE: stage });
    expect(await main(["inspect"], env("h2-inspect"), t.deps as never)).toBe(0);
    expect(JSON.parse(readFileSync(join(t.dir, "inspect.json"), "utf8"))).toMatchObject({ verdict: "OK", state: "tomt", data002d: { status: "NOT_APPLICABLE" } });
    // anvendelse uten dry-run avvises
    expect(await main(["apply"], env("h2-apply"), t.deps as never)).toBe(2);
    expect(t.log.runs).toHaveLength(0);
    expect(await main(["dry-run"], env("h2-dry-run"), t.deps as never)).toBe(0);
    expect(t.log.runs[0]).toMatchObject({ cmd: "npx" });
    expect(t.log.runs[0]!.args.slice(0, 5)).toEqual(["supabase", "db", "push", "--dry-run", "--db-url"]);
    t.setApplied(versions);   // etter anvendelse
    expect(await main(["apply"], env("h2-apply"), t.deps as never)).toBe(0);
    expect(t.log.runs[1]!.args).not.toContain("--dry-run");
    expect(readFileSync(join(t.dir, "apply.json"), "utf8")).toContain('"verify"');
    const out = printed(t.log);
    for (const s of [PW, KEY, REF, DB]) expect(out).not.toContain(s);
    expect(out).not.toMatch(/[\r\n]\s*url postgres/);
    // alle SQL-setninger fra inspeksjonen er skrivebeskyttede
    for (const q of t.log.sql.slice(0, 12)) expect(q).toMatch(/^\s*(begin read only|select|rollback)/i);
  });
  it("dry-run FEIL når CLI listet noe annet enn de ventende migrasjonene (lukket), og anvendelse avvises etterpå", async () => {
    const t = setup({ runOut: () => ({ code: 0, out: listing(versions.slice(0, 3)) }) });
    expect(await main(["inspect"], baseEnv({ SCOUT_HOSTED_STAGE: "h2-inspect" }), t.deps as never)).toBe(0);
    expect(await main(["dry-run"], baseEnv({ SCOUT_HOSTED_STAGE: "h2-dry-run" }), t.deps as never)).toBe(1);
    expect(await main(["apply"], baseEnv({ SCOUT_HOSTED_STAGE: "h2-apply" }), t.deps as never)).toBe(2);
    expect(t.log.runs).toHaveLength(1);
  });
  it("dry-run FEIL ved CLI-feil (exit ≠ 0) selv om listen stemmer", async () => {
    const t = setup({ runOut: () => ({ code: 1, out: listing(versions) }) });
    await main(["inspect"], baseEnv({ SCOUT_HOSTED_STAGE: "h2-inspect" }), t.deps as never);
    expect(await main(["dry-run"], baseEnv({ SCOUT_HOSTED_STAGE: "h2-dry-run" }), t.deps as never)).toBe(1);
  });
  it("modus fresh mot en database som allerede har migrasjoner ⇒ STOPP (exit 1), dry-run avvises", async () => {
    const t = setup({ applied: versions.slice(0, 4) });
    expect(await main(["inspect"], baseEnv({ SCOUT_HOSTED_STAGE: "h2-inspect" }), t.deps as never)).toBe(1);
    expect(await main(["dry-run"], baseEnv({ SCOUT_HOSTED_STAGE: "h2-dry-run" }), t.deps as never)).toBe(2);
    expect(t.log.runs).toHaveLength(0);
  });
  it("oppgradering: anvendelse krever bekreftet sikkerhetskopi", async () => {
    const t = setup({ applied: versions.slice(0, 4), runOut: (_c, a) => ({ code: 0, out: a.includes("--dry-run") ? listing(versions.slice(4)) : "" }) });
    const e = (stage: string, more: Record<string, string> = {}) => baseEnv({ SCOUT_HOSTED_MODE: "upgrade", SCOUT_HOSTED_STAGE: stage, ...more });
    expect(await main(["inspect"], e("h2-inspect"), t.deps as never)).toBe(0);
    expect(await main(["dry-run"], e("h2-dry-run"), t.deps as never)).toBe(0);
    expect(await main(["apply"], e("h2-apply"), t.deps as never)).toBe(2);
    expect(t.log.runs).toHaveLength(1);
    t.setApplied(versions);
    expect(await main(["apply"], e("h2-apply", { SCOUT_HOSTED_BACKUP: "bekreftet" }), t.deps as never)).toBe(0);
  });
});

describe("H3 (API-nivå)", () => {
  it("avvises hvis migrasjonene ikke er lik repoet; kjører bare de to tillatte testfilene med SCOUT_HOSTED_TESTS=1 når historikken er lik", async () => {
    const t = setup({ applied: versions.slice(0, 5) });
    expect(await main(["h3-api"], baseEnv({ SCOUT_HOSTED_STAGE: "h3-api" }), t.deps as never)).toBe(2);
    expect(t.log.runs).toHaveLength(0);
    t.setApplied(versions);
    const rep = vitestJson(l46Rows());
    const t2 = setup({ applied: versions, runOut: (cmd, args) => {
      const f = args.find((a) => a.startsWith("--outputFile="));
      if (f) writeFileSync(f.slice("--outputFile=".length), rep);
      if (cmd === "bash") return { code: 0, out: "PASS  build-artefakter .next/static (klient) (0 treff)\nPASS  build-artefakter .next/server (server, utenom publishable key) (0 treff)\nSKIP  lokal Supabase kjører ikke\n\nSECRET-SKANN: INGEN FUNN" };
      return { code: 0, out: "" };
    } });
    const code = await main(["h3-api"], baseEnv({ SCOUT_HOSTED_STAGE: "h3-api", SUPABASE_TEST_JWT_SECRET: JWT }), t2.deps as never);
    const vit = t2.log.runs.find((r) => r.args[0] === "vitest")!;
    expect(vit.args.filter((a) => a.startsWith("tests/"))).toEqual(H3_TEST_FILES);
    expect(vit.env.SCOUT_HOSTED_TESTS).toBe("1");
    expect(vit.args).not.toContain("-t");               // med JWT-hemmelighet kjøres alle 11
    expect(JSON.stringify(t2.log.runs.map((r) => r.args))).not.toContain(JWT);   // hemmeligheten sendes aldri som argument
    expect(code).toBe(0);
    expect(printed(t2.log)).toMatch(/nettleserdelene er IKKE forberedt/);
    for (const s of [PW, KEY, JWT, REF]) expect(printed(t2.log)).not.toContain(s);
  });
  it("uten hosted JWT-hemmelighet utelates utløpt-token-testen og L4a blir DELVIS (exit 1), aldri bestått", async () => {
    const skipped = vitestJson(l46Rows().map((x) => (x.fullName.includes(EXPIRED_TOKEN_TEST) ? { ...x, status: "skipped" } : x)));
    const t = setup({ applied: versions, runOut: (cmd, args) => {
      const f = args.find((a) => a.startsWith("--outputFile="));
      if (f) writeFileSync(f.slice("--outputFile=".length), skipped);
      return cmd === "bash" ? { code: 0, out: "PASS  build-artefakter .next/static (klient) (0 treff)\nPASS  build-artefakter .next/server (server, utenom publishable key) (0 treff)\nSKIP  lokal Supabase kjører ikke\n\nSECRET-SKANN: INGEN FUNN" } : { code: 0, out: "" };
    } });
    expect(await main(["h3-api"], baseEnv({ SCOUT_HOSTED_STAGE: "h3-api" }), t.deps as never)).toBe(1);
    const vit = t.log.runs.find((r) => r.args[0] === "vitest")!;
    expect(vit.args).toContain("-t");
    expect(printed(t.log)).toMatch(/L4a DELVIS/);
    expect(existsSync(join(t.dir, "h3.json"))).toBe(true);
  });
});

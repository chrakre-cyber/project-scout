// HOST-001-FIX1: uavhengig probe av de tre P2-funnene (ingen nettverk, ingen DB, syntetiske verdier). Kjøres FØR og ETTER rettingen: `node reviews/HOST-001-fix1/foer-etter-probe.mjs`.
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
const require = createRequire(import.meta.url);
const { parseHostedTarget, fingerprintOf } = await import("../../scripts/hosted/target.mjs");
const { main } = await import("../../scripts/hosted/cli.mjs");
const { repoHash, repoMigrationList } = await import("../../scripts/hosted/migrations.mjs");
const REFA = "abcdefghij0123456789", REFB = "klmnopqrst0123456789";
const PW = ["pw", "PROBE", "z9y8"].join("-");
const S = ["post", "gres"].join("");
const env = (ref, q = "?sslmode=verify-full") => ({ SCOUT_HOSTED_PROJECT_REF: ref, SCOUT_HOSTED_CONFIRM: `TESTPROSJEKT:${ref}`, SCOUT_HOSTED_MODE: "fresh", SCOUT_HOSTED_STAGE: "h3-api", SUPABASE_TEST_URL: `https://${ref}.supabase.co`,
  SUPABASE_TEST_DB_URL: `${S}ql://postgres:${PW}@db.${ref}.supabase.co:5432/postgres${q}`, SUPABASE_TEST_PUBLISHABLE_KEY: "probe-key-0123" });
const out = {};
// P2-1: adresse uten sslmode godtatt, og harness-konfigurasjonen (bare connectionString) gir ukryptert forbindelse
const accepts = (e) => { try { parseHostedTarget(e, { stage: "h3-api" }); return true; } catch { return false; } };
out.p1_uten_sslmode_godtatt = accepts(env(REFA, ""));
out.p1_sslmode_require_godtatt = accepts(env(REFA, "?sslmode=require"));
out.p1_duplisert_sslmode_godtatt = accepts(env(REFA, "?sslmode=verify-full&sslmode=disable"));
out.p1_verify_full_godtatt = accepts(env(REFA));
// effektiv ssl i klienten som H3-harnessen faktisk lager: etter rettingen via hostedDbConfig, FØR via bare connectionString
const T = await import("../../scripts/hosted/target.mjs");
try {
  const cfg = T.hostedDbConfig ? T.hostedDbConfig(env(REFA), { stage: "h3-api" }) : { connectionString: env(REFA, "").SUPABASE_TEST_DB_URL };
  out.p1_harness_klient_ssl_effektiv = JSON.stringify(new (require("pg").Client)(cfg).connectionParameters.ssl);
} catch { out.p1_harness_klient_ssl_effektiv = "avvist"; }
// P2-2: gyldige PASS-belegg fra prosjekt A rapporteres som BESTÅTT under prosjekt B
const dir = mkdtempSync(join(tmpdir(), "probe-"));
const repoList = repoMigrationList(), rh = repoHash(repoList), fpA = fingerprintOf(REFA), when = new Date().toISOString();
writeFileSync(join(dir, "inspect.json"), JSON.stringify({ kind: "hosted-inspect", schemaVersion: 1, takenAt: when, mode: "fresh", target: { fingerprint: fpA }, repoHash: rh, repoMigrations: 12, migrations: { appliedCount: 0 }, state: "tomt", verdict: "OK", stopReasons: [], data002d: { status: "NOT_APPLICABLE", invalidProfiles: 0 } }));
writeFileSync(join(dir, "dry-run.json"), JSON.stringify({ kind: "hosted-dry-run", status: "PASS", target: { fingerprint: fpA }, repoHash: rh, takenAt: when, notes: [] }));
writeFileSync(join(dir, "apply.json"), JSON.stringify({ apply: { status: "PASS", notes: [] }, verify: { status: "PASS", notes: [] }, target: { fingerprint: fpA }, takenAt: when }));
const printed = [];
await main(["report", "h2"], { ...env(REFB), SCOUT_HOSTED_STAGE: undefined }, { now: () => new Date(), print: (t) => printed.push(t), dir, repoDir: "supabase/migrations", connect: async () => { throw new Error("ingen DB"); }, run: async () => { throw new Error("ingen prosess"); } });
out.p2_rapport_for_B_med_belegg_fra_A = /Samlet H2: (\S+)/.exec(printed.join("\n"))?.[1] ?? "ingen";
// P2-3: hemmelighetsavhengige tester i L4a og hvilke som utelates uten hemmelighet
const src = readFileSync("tests/db/auth-gotrue.test.ts", "utf8");
const blocks = [...src.matchAll(/\n\s+it\("([^"]+)", async \(\) => \{([\s\S]*?)\n\s{2}\}\);/g)].map((m) => ({ name: m[1], uses: /\bsecret\b|\bsign\([^,()]*\)/.test(m[2]) }));
const dependent = blocks.filter((b) => b.uses).map((b) => b.name.slice(0, 40));
const cli = readFileSync("scripts/hosted/cli.mjs", "utf8");
out.p3_hemmelighetsavhengige_tester = dependent;
const C = await import("../../scripts/hosted/cli.mjs");
out.p3_utelatt_av_cli = C.SECRET_DEPENDENT_TESTS ?? [...cli.matchAll(/EXPIRED_TOKEN_TEST = "([^"]+)"/g)].map((m) => m[1]);
out.p3_alle_dekket = dependent.every((d) => out.p3_utelatt_av_cli.some((x) => d.startsWith(x.slice(0, 20))));
console.log(JSON.stringify(out, null, 2));

// HOST-001 (forberedelse, IKKE KJØRT mot hosted): kommandolinje for H2–H4 mot ETT angitt hosted TESTPROSJEKT. Alt som berører nettverk krever (1) gyldig hosted-mål (target.mjs), (2) uttrykkelig
// tillatelse til akkurat dette trinnet (SCOUT_HOSTED_STAGE) og (3) for anvendelse: nylig inspeksjon + dry-run (gate.mjs). Uten miljøvariablene avslutter alt før noen forbindelse åpnes.
// Rå utskrift fra underprosesser fanges og vises bare etter sanering mot kjente verdier. Se docs/econ/hosted-kjoreinstruks.md. Bruk: node scripts/hosted/cli.mjs <kommando> [--execute]
import { createRequire } from "node:module";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { evaluateGroup } from "../ci/evaluate.mjs";
import { hasLeak, sanitizeText } from "../ci/sanitize.mjs";
import { createLauncher, isMainModule } from "./launch.mjs";
import { executeCleanup, planCleanup } from "./cleanup.mjs";
import { REPORT_MAX_AGE_MS, checkBinding, stamp } from "./binding.mjs";
import { checkGate } from "./gate.mjs";
import { inspectDatabase } from "./inspect.mjs";
import { classifyMigrations, repoHash, repoMigrationList } from "./migrations.mjs";
import { LABEL, formatReport, h2Items, h3Items, h4Items } from "./report.mjs";
import { HostedTargetError, hostedDbConfig, parseHostedTarget } from "./target.mjs";

const require = createRequire(import.meta.url);
export const EXPIRED_TOKEN_TEST = "utløpt token avvises";
/** ALLE tester som trenger prosjektets JWT-hemmelighet (HS256) for å signere kontrolltokens. Uten hemmelighet — eller uten at eier uttrykkelig bekrefter HS256-signering (SCOUT_HOSTED_JWT_ALG=HS256;
 *  nyere prosjekter kan bruke asymmetriske nøkler som ikke godtar HS256-kontrolltokens) — utelates de og rapporteres som DELVIS. Fullstendigheten av listen er kontrollert av en statisk test. */
export const SECRET_DEPENDENT_TESTS = [EXPIRED_TOKEN_TEST];
export const secretTestsEnabled = (env) => typeof env.SUPABASE_TEST_JWT_SECRET === "string" && env.SUPABASE_TEST_JWT_SECRET.length > 10 && env.SCOUT_HOSTED_JWT_ALG === "HS256";
const escapeRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export const H3_TEST_FILES = ["tests/db/auth-gotrue.test.ts", "tests/db/rest-isolation.test.ts"];

/** Kjente verdier som aldri skal nå utskrift: hele adressen, passordet, nøkkelen, ref og vertsnavn. */
export function literalsOf(env) {
  const out = new Set();
  const add = (v) => { if (typeof v === "string" && v.length >= 8) out.add(v); };
  add(env.SUPABASE_TEST_DB_URL); add(env.SUPABASE_TEST_URL); add(env.SUPABASE_TEST_PUBLISHABLE_KEY); add(env.SUPABASE_TEST_JWT_SECRET); add(env.SCOUT_HOSTED_PROJECT_REF);
  try { const u = new URL(env.SUPABASE_TEST_DB_URL); add(decodeURIComponent(u.password)); add(u.password); add(u.hostname); } catch { /* ugyldig adresse fanges av target.mjs */ }
  return [...out].sort((a, b) => b.length - a.length);
}

/** L4a/L6 mot hosted: som evaluateGroup, men en test som BEVISST er utelatt (utløpt token krever hosted JWT-hemmelighet) gir DELVIS, aldri bestått. */
export function hostedGroup(key, report, rc, { excluded = [] } = {}) {
  const r = evaluateGroup(key, report, rc);
  if (r.status !== "FAIL") return r;
  const problems = r.notes.slice(1);
  const onlyExcluded = problems.length > 0 && problems.every((p) => excluded.some((n) => p.includes(n)) && /^(MANGLER|IKKE KJØRT)/.test(p));
  return onlyExcluded ? { status: "PARTIAL", notes: [...r.notes, "utelatt bevisst (krever JWT-hemmelighet og bekreftet HS256-signering; ikke oppgitt) — regnes ikke som bestått"] } : r;
}

/** L7 for hosted: kjent lokal-stakk-SKIP er eneste tillatte unntak; build-artefakter må være skannet. */
export function hostedL7(out, rc, buildRc) {
  if (rc === null || rc === undefined) return { status: "NOT_RUN", notes: [] };
  const lines = String(out).split(/\r?\n/);
  const pass = lines.filter((l) => /^PASS\s/.test(l)), fail = lines.filter((l) => /^FAIL\s/.test(l)), skip = lines.filter((l) => /^SKIP\s/.test(l));
  const unknownSkip = skip.filter((l) => !/^SKIP\s+lokal Supabase kjører ikke/.test(l));
  const art = pass.some((l) => /build-artefakter \.next\/static/.test(l)) && pass.some((l) => /build-artefakter \.next\/server/.test(l));
  const notes = [`${pass.length} PASS, ${fail.length} FAIL, ${skip.length} SKIP (kjent lokal-stakk-SKIP er ikke relevant for hosted)`];
  if (fail.length || rc !== 0 || /MED FUNN/.test(out)) return { status: "FAIL", notes };
  if (buildRc !== 0 || !art || unknownSkip.length || !/INGEN FUNN/.test(out)) return { status: "SKIPPED", notes: [...notes, "build ikke registrert/vellykket, build-artefakter ikke skannet eller ukjent hopp"] };
  return { status: "PASS", notes };
}

function realDeps() {
  return {
    now: () => new Date(),
    print: (t) => process.stdout.write(t.endsWith("\n") ? t : `${t}\n`),
    dir: ".hosted",
    repoDir: "supabase/migrations",
    connect: async (env) => {
      const { Client } = require("pg");
      const c = new Client(hostedDbConfig(env, { stage: env.SCOUT_HOSTED_STAGE }));   // eksplisitt konfigurasjon: alltid TLS med sertifikatkontroll
      await c.connect();
      return c;
    },
    // Programmer startes UTEN shell (launch.mjs): logiske navn «supabase», «vitest», «next», «bash» — aldri npx/npm (feiler på Windows, og shell ville tolket adressen med passord).
    run: (tool, args, env) => createLauncher().run(tool, args, env),
  };
}

const read = (file) => { try { return JSON.parse(readFileSync(file, "utf8")); } catch { return null; } };
function save(dir, name, obj) { mkdirSync(dir, { recursive: true, mode: 0o700 }); writeFileSync(join(dir, name), JSON.stringify(obj, null, 2), { mode: 0o600 }); }

/** @returns exit-kode: 0 ok · 1 feilet · 2 avvist (mål/tillatelse/gate) · 3 ikke kjørt */
export async function main(argv, env, deps = realDeps()) {
  const [cmd, ...flags] = argv;
  const lits = literalsOf(env);
  const say = (t) => deps.print(sanitizeText(t, lits));
  const STAGE_OF = { inspect: "h2-inspect", "dry-run": "h2-dry-run", apply: "h2-apply", "h3-api": "h3-api", cleanup: flags.includes("--execute") ? "h4-cleanup-execute" : "h4-cleanup" };
  let target;
  try {
    if (cmd === "check-target" || cmd === "report") target = parseHostedTarget(env);
    else if (STAGE_OF[cmd]) target = parseHostedTarget(env, { stage: STAGE_OF[cmd] });
    else { say("ukjent kommando"); return 2; }
  } catch (e) {
    say(e instanceof HostedTargetError ? e.message : "hosted-mål avvist: ukjent feil");
    return 2;
  }
  const repoList = repoMigrationList(deps.repoDir), rh = repoHash(repoList);
  if (cmd === "check-target") { say(`hosted-mål OK (ingen forbindelse åpnet): fingeravtrykk ${target.fingerprint}, modus ${target.mode}, tilkobling ${target.dbKind}, ${repoList.length} migrasjoner i repoet`); return 0; }

  if (cmd === "report") {
    const stage = flags[0];
    const ctx = { target, repoHash: rh, now: deps.now(), maxAgeMs: REPORT_MAX_AGE_MS };
    const lines = [], rejected = [];
    const accept = (label, binding) => { const r = checkBinding(binding, ctx); if (r.ok) { lines.push(`Belegg «${label}» tatt ${binding.takenAt}`); return true; } rejected.push(`«${label}» ${r.reason}`); return false; };
    const own = (rec, label, chain) => (rec && accept(label, rec.binding) && chain(rec.binding) ? rec : null);
    const insp0 = read(join(deps.dir, "inspect.json"));
    const insp = insp0 && accept("inspeksjon", { target: insp0.target, mode: insp0.mode, repoHash: insp0.repoHash, takenAt: insp0.takenAt }) ? insp0 : null;
    const dry0 = read(join(deps.dir, "dry-run.json"));
    const dry = insp && dry0 && accept("dry-run", dry0.binding) && dry0.binding?.inspectTakenAt === insp.takenAt ? dry0 : (dry0 && insp ? (rejected.push("«dry-run» hører til en annen inspeksjon"), null) : null);
    const app0 = read(join(deps.dir, "apply.json"));
    const chained = (b) => !!dry && b.dryRunTakenAt === dry.binding.takenAt;
    const apply = own(app0?.apply, "anvendelse", chained), verify = own(app0?.verify, "kontroll etter anvendelse", chained);
    const h3 = read(join(deps.dir, "h3.json")), h4 = read(join(deps.dir, "h4.json"));
    const any = () => true;
    const planOk = (b) => !!h4?.cleanupPlan && b.planTakenAt === h4.cleanupPlan.binding?.takenAt;
    const items = stage === "h2" ? h2Items({ mode: target.mode, inspect: insp, dryRun: dry ? { status: dry.status, notes: dry.notes } : null, apply, verify })
      : stage === "h3" ? h3Items({ l4a: own(h3?.l4a, "L4a", any), l6: own(h3?.l6, "L6", any), secrets: own(h3?.secrets, "L7", any) })
      : stage === "h4" ? h4Items({ cleanupPlan: own(h4?.cleanupPlan, "opprydding: tørrkjøring", any), cleanupExecute: own(h4?.cleanupExecute, "opprydding: sletting", planOk), verify: own(h4?.verify, "kontroll etter opprydding", planOk) }) : null;
    if (!items) { say("rapport: bruk h2, h3 eller h4"); return 2; }
    if (rejected.length) lines.push(`Belegg forkastet fordi det ikke er verifisert for dette målet, denne modusen og dette migrasjonsgrunnlaget (regnes aldri som bestått): ${rejected.join("; ")}`);
    say(formatReport({ stage: stage.toUpperCase(), target, items, literals: lits, versions: lines }));
    return 0;
  }

  let client = null;
  try {
    if (cmd === "inspect") {
      client = await deps.connect(env);
      const rep = await inspectDatabase(client, { repoList, mode: target.mode, target, now: deps.now() });
      for (const f of ["dry-run.json", "apply.json"]) rmSync(join(deps.dir, f), { force: true });   // ny inspeksjon = nytt utgangspunkt; eldre dry-run/anvendelse hører til en annen kjede
      save(deps.dir, "inspect.json", rep);
      say(`inspeksjon ${rep.verdict}: tilstand ${rep.state}, anvendt ${rep.migrations.appliedCount}/${rep.repoMigrations}, DATA-002D ${rep.data002d.status}${rep.stopReasons.length ? `\n- ${rep.stopReasons.join("\n- ")}` : ""}`);
      return rep.verdict === "OK" ? 0 : 1;
    }
    if (cmd === "dry-run" || cmd === "apply") {
      const gate = checkGate({ stage: STAGE_OF[cmd], target, inspect: read(join(deps.dir, "inspect.json")), dryRun: read(join(deps.dir, "dry-run.json")), repoHash: rh, now: deps.now(), backupConfirmed: env.SCOUT_HOSTED_BACKUP === "bekreftet" });
      if (!gate.allow) { say(`avvist av gate:\n- ${gate.reasons.join("\n- ")}`); return 2; }
      const insp = read(join(deps.dir, "inspect.json"));
      const args = ["db", "push", ...(cmd === "dry-run" ? ["--dry-run"] : []), "--db-url", env.SUPABASE_TEST_DB_URL];
      const r = await deps.run("supabase", args, {});
      if (r.launchError) say(`kunne ikke starte supabase: ${r.launchError}`);
      const listed = [...new Set([...r.out.matchAll(/\b(\d{14})_[a-z0-9_]+\.sql/g)].map((m) => m[1]))].sort();
      if (cmd === "dry-run") {
        const same = r.code === 0 && JSON.stringify(listed) === JSON.stringify([...insp.migrations.pending].sort());
        const stampNow = stamp(target, rh, deps.now(), { inspectTakenAt: insp.takenAt });
        const rec = { kind: "hosted-dry-run", status: same ? "PASS" : "FAIL", target: stampNow.target, mode: target.mode, repoHash: rh, takenAt: stampNow.takenAt, inspectTakenAt: insp.takenAt, binding: stampNow, notes: [`CLI-avslutning ${r.code}`, `listet ${listed.length} av ${insp.migrations.pending.length} forventede migrasjoner`] };
        save(deps.dir, "dry-run.json", rec);
        say(`dry-run ${rec.status}: ${rec.notes.join("; ")}`);
        return same ? 0 : 1;
      }
      client = await deps.connect(env);
      const after = classifyMigrations((await client.query("select version from supabase_migrations.schema_migrations order by version")).rows.map((x) => String(x.version)), repoList);
      const bind = stamp(target, rh, deps.now(), { dryRunTakenAt: read(join(deps.dir, "dry-run.json")).takenAt });
      const apply = { status: r.code === 0 ? "PASS" : "FAIL", notes: [`CLI-avslutning ${r.code}`], binding: bind };
      const verify = { status: after.kind === "current" ? "PASS" : "FAIL", notes: [`historikk ${after.kind}, ${after.appliedCount}/${after.repoCount}`], binding: bind };
      save(deps.dir, "apply.json", { apply, verify });
      say(`anvendelse ${apply.status}; kontroll etter anvendelse ${verify.status} (${verify.notes[0]})`);
      return apply.status === "PASS" && verify.status === "PASS" ? 0 : 1;
    }
    if (cmd === "h3-api") {
      client = await deps.connect(env);
      const cls = classifyMigrations((await client.query("select version from supabase_migrations.schema_migrations order by version")).rows.map((x) => String(x.version)), repoList);
      await client.end().catch(() => {}); client = null;
      if (cls.kind !== "current") { say(`H3 stoppet: migrasjonshistorikken er ikke lik repoet (${cls.kind}); anvend migrasjonene (H2) først`); return 2; }
      const tmp = mkdtempSync(join(tmpdir(), "scout-h3-"));
      try {
        const out = join(tmp, "vitest.json");
        const withSecret = secretTestsEnabled(env);
        const excluded = withSecret ? [] : SECRET_DEPENDENT_TESTS;
        const args = ["run", "--config", "vitest.db.config.ts", ...H3_TEST_FILES, "--reporter=json", `--outputFile=${out}`, ...(withSecret ? [] : ["-t", `^(?!.*(?:${excluded.map(escapeRe).join("|")})).*$`])];
        const t = await deps.run("vitest", args, { SCOUT_HOSTED_TESTS: "1" });
        if (t.launchError) say(`kunne ikke starte vitest: ${t.launchError}`);
        const rep = existsSync(out) ? readFileSync(out, "utf8") : null;
        const l4a = hostedGroup("L4a", rep, t.code, { excluded }), l6 = hostedGroup("L6", rep, t.code);
        const build = await deps.run("next", ["build"], {   // = `npm run build` (package.json: «build»: «next build»; kontrollert av test)
           NEXT_PUBLIC_SUPABASE_URL: env.SUPABASE_TEST_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: env.SUPABASE_TEST_PUBLISHABLE_KEY });
        const scan = await deps.run("bash", ["scripts/qa-secret-scan.sh"], {});
        for (const [n, r] of [["build", build], ["hemmelighetsskann", scan]]) if (r.launchError) say(`kunne ikke starte ${n}: ${r.launchError}`);
        const secrets = hostedL7(scan.out, scan.code, build.code);
        if (hasLeak(`${build.out}\n${scan.out}`, lits)) secrets.notes.push("rå utskrift fra build/skann inneholdt noe som ville blitt sanert (vises ikke)");
        const b3 = stamp(target, rh, deps.now(), { migrationsVerified: "current" });
        save(deps.dir, "h3.json", { l4a: { status: l4a.status, notes: l4a.notes, binding: b3 }, l6: { status: l6.status, notes: l6.notes, binding: b3 }, secrets: { ...secrets, binding: b3 } });
        say(`H3 (API-nivå): L4a ${LABEL[l4a.status]}, L6 ${LABEL[l6.status]}, L7 ${LABEL[secrets.status]}; nettleserdelene er IKKE forberedt og regnes som IKKE KJØRT`);
        return [l4a, l6, secrets].every((x) => x.status === "PASS") ? 0 : 1;
      } finally { rmSync(tmp, { recursive: true, force: true }); }
    }
    if (cmd === "cleanup") {
      const execute = flags.includes("--execute");
      if (execute && env.SCOUT_HOSTED_CLEANUP_CONFIRM !== `SLETT:${target.fingerprint}`) { say("avvist: sletting krever SCOUT_HOSTED_CLEANUP_CONFIRM=SLETT:<fingeravtrykk>"); return 2; }
      const prev = read(join(deps.dir, "h4.json")) ?? {};
      if (execute) {   // sletting krever en nylig, verifisert tørrkjøring for SAMME mål/modus/migrasjonsgrunnlag
        const ok = prev.cleanupPlan && checkBinding(prev.cleanupPlan.binding, { target, repoHash: rh, now: deps.now(), maxAgeMs: 60 * 60 * 1000 }).ok;
        if (!ok) { say("avvist: sletting krever en nylig (under 60 min) tørrkjøring for dette målet, denne modusen og dette migrasjonsgrunnlaget"); return 2; }
      }
      client = await deps.connect(env);
      if (!execute) {
        const { plan } = await planCleanup(client);
        save(deps.dir, "h4.json", { cleanupPlan: { status: "PASS", notes: [JSON.stringify(plan)], binding: stamp(target, rh, deps.now()) } });   // ny tørrkjøring = nytt utgangspunkt (eldre sletting/kontroll forkastes)
        say(`opprydding (tørrkjøring, ingenting slettet): ${JSON.stringify(plan)}`);
        return 0;
      }
      const res = await executeCleanup(client);
      const after = res.ok ? (await planCleanup(client)).plan : null;
      const clean = res.ok && after.testUsers === 0 && after.testFirms === 0;
      const b4 = stamp(target, rh, deps.now(), { planTakenAt: prev.cleanupPlan.binding.takenAt });
      save(deps.dir, "h4.json", { cleanupPlan: prev.cleanupPlan, cleanupExecute: { status: res.ok ? "PASS" : "FAIL", notes: [JSON.stringify(res.before ?? {}), res.note ?? ""], binding: b4 }, verify: { status: clean ? "PASS" : "FAIL", notes: [JSON.stringify(after ?? {})], binding: b4 } });
      say(`opprydding ${res.ok ? "utført" : "FEILET (rullet tilbake)"}: før ${JSON.stringify(res.before ?? {})}, etter ${JSON.stringify(res.after ?? {})}`);
      return res.ok && clean ? 0 : 1;
    }
  } catch (e) {
    say(`feilet: ${e?.code ?? e?.name ?? "feil"} (detaljer vises ikke)`);
    return 1;
  } finally {
    if (client) await client.end().catch(() => {});
  }
  return 2;
}

if (isMainModule(import.meta.url, process.argv[1])) process.exit(await main(process.argv.slice(2), process.env));

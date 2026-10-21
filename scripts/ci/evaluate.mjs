// Vurderer resultatene fra scripts/ci-supabase-local.sh og bygger en SANERT rapport. Ren logikk (testet i tests/ci-evaluate.test.ts).
// Statuser: PASS | FAIL | SKIPPED (noe ble hoppet over — regnes IKKE som bestått) | NOT_RUN. Samlet PASS krever PASS i alle fire kontroller (L1, L2, L3, L7).
// Kun ALLOWLISTEDE linjer fra underskript tas med; alt går dessuten gjennom sanering. Rå utskrift skrives aldri ut.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { hasLeak, loadLiterals, sanitizeText } from "./sanitize.mjs";

/** Tester som er hoppet over med KJENT årsak (describe.skipIf(!SCOUT_DB_ISOLATED)): krever en isolert klynge med shim. Teller likevel ikke som bestått. */
export const KNOWN_ISOLATED_ONLY = [
  "DATA-002D: oppgradering fra eldre tilstand",
  "ECON-005b: oppgradering — eksisterende ikke-syntetiske profiler får ingenting",
];
export const OPEN_CHECKS = ["L4 innlogging via ekte GoTrue", "L5 lagring/gjenåpning via ekte PostgREST (nettleserforløp)", "L6 firmaskille med ekte JWT-er", "Playwright-integrasjon"];

const read = (dir, name) => (existsSync(join(dir, name)) ? readFileSync(join(dir, name), "utf8") : null);
const rcOf = (dir, name) => { const t = read(dir, name); return t === null ? null : Number.parseInt(t.trim(), 10); };
const rcText = (rc) => (rc === 124 ? "tidsavbrudd" : `exit ${rc}`);

export function evaluateL1({ startRc, resetRc, actualVersions, expectedVersions, pgVersion, images, tail }) {
  const notes = [];
  if (startRc === null) return { status: "NOT_RUN", notes: ["supabase start ble ikke kjørt"] };
  if (startRc !== 0) return { status: "FAIL", notes: [`supabase start feilet (${rcText(startRc)})`, ...(tail ?? [])] };
  if (resetRc !== 0) return { status: "FAIL", notes: [`supabase db reset feilet (${rcText(resetRc)})`, ...(tail ?? [])] };
  if (!actualVersions || actualVersions !== expectedVersions) return { status: "FAIL", notes: ["registrerte migrasjoner stemmer ikke med migrasjonsfilene", `forventet ${expectedVersions || "(ukjent)"}`, `fikk ${actualVersions || "(tomt)"}`] };
  notes.push(`${expectedVersions.split(",").length} migrasjoner anvendt fra tom database og registrert i rekkefølge`);
  if (pgVersion) notes.push(`PostgreSQL: ${pgVersion}`);
  for (const i of images ?? []) notes.push(`image: ${i}`);
  return { status: "PASS", notes };
}

const L2_ALLOW = /^(== |PASS |FAIL |MIGRASJONSKJEDE:|OPPGRADERING )/;
export function evaluateL2(output, rc) {
  if (output === null || rc === null) return { status: "NOT_RUN", notes: ["qa:migrations ble ikke kjørt"] };
  const lines = output.split(/\r?\n/).filter((l) => L2_ALLOW.test(l));
  const pass = lines.filter((l) => l.startsWith("PASS ")).length;
  const failLines = lines.filter((l) => l.startsWith("FAIL "));
  const done = lines.some((l) => l.startsWith("MIGRASJONSKJEDE: ALLE KONTROLLER BESTÅTT"));
  const status = rc === 0 && done && failLines.length === 0 && pass > 0 ? "PASS" : "FAIL";
  const notes = [`${pass} PASS, ${failLines.length} FAIL${rc === 0 ? "" : ` (${rcText(rc)})`}`, ...failLines.slice(0, 20)];
  if (status === "FAIL" && failLines.length === 0) notes.push("skriptet avsluttet uten fullført sluttmelding");
  return { status, notes };
}

export function evaluateL3(report, rc) {
  if (rc === null) return { status: "NOT_RUN", notes: ["DB-suiten ble ikke kjørt"] };
  let data = null;
  try { data = JSON.parse(report ?? ""); } catch { /* ingen gyldig rapport */ }
  if (!data || !Array.isArray(data.testResults)) return { status: "FAIL", notes: [`ingen lesbar vitest-rapport (${rcText(rc)})`] };
  const all = data.testResults.flatMap((f) => (f.assertionResults ?? []).map((a) => ({ file: String(f.name ?? "").replace(/^.*\/tests\//, "tests/"), ...a })));
  const by = (s) => all.filter((a) => a.status === s);
  const failed = by("failed"), skipped = all.filter((a) => a.status === "skipped" || a.status === "pending" || a.status === "todo"), passed = by("passed");
  const known = (a) => KNOWN_ISOLATED_ONLY.some((k) => String(a.fullName ?? a.title ?? "").startsWith(k));
  const knownSkips = skipped.filter(known), unknownSkips = skipped.filter((a) => !known(a));
  const notes = [`${all.length} tester: ${passed.length} bestått, ${failed.length} feilet, ${skipped.length} hoppet over`];
  for (const f of failed.slice(0, 20)) notes.push(`FEIL ${f.file}: ${f.fullName ?? f.title}`);
  if (knownSkips.length) notes.push(`${knownSkips.length} hoppet over med KJENT årsak (krever isolert klynge, SCOUT_DB_ISOLATED; dekkes av scripts/test-db-isolated.sh) — regnes ikke som bestått`);
  if (unknownSkips.length) notes.push(`${unknownSkips.length} hoppet over uten kjent årsak — undersøk`);
  for (const s of skipped.slice(0, 20)) notes.push(`HOPPET ${s.file}: ${s.fullName ?? s.title}`);
  if (all.length === 0 || failed.length > 0) return { status: "FAIL", notes: all.length === 0 ? ["ingen tester ble kjørt", ...notes] : notes };
  if (rc !== 0) return { status: "FAIL", notes: [...notes, `vitest avsluttet med ${rcText(rc)}`] };
  return { status: skipped.length > 0 ? "SKIPPED" : "PASS", notes };
}

const L7_ALLOW = /^(== |PASS |FAIL |SKIP |SECRET-SKANN:)/;
export function evaluateL7(output, rc, buildRc) {
  if (output === null || rc === null) return { status: "NOT_RUN", notes: ["qa:secrets ble ikke kjørt"] };
  const lines = output.split(/\r?\n/).filter((l) => L7_ALLOW.test(l));
  const fails = lines.filter((l) => l.startsWith("FAIL ")), skips = lines.filter((l) => l.startsWith("SKIP "));
  const done = lines.some((l) => l.startsWith("SECRET-SKANN: INGEN FUNN"));
  const notes = [`${lines.filter((l) => l.startsWith("PASS ")).length} PASS, ${fails.length} FAIL, ${skips.length} SKIP`, ...fails.slice(0, 20), ...skips.slice(0, 20)];
  if (buildRc !== null && buildRc !== 0) notes.push(`npm run build feilet (${rcText(buildRc)}): build-artefakter er ikke skannet`);
  if (fails.length > 0 || rc !== 0 && skips.length === 0 && !done) return { status: "FAIL", notes };
  if (skips.length > 0 || (buildRc !== null && buildRc !== 0)) return { status: "SKIPPED", notes: [...notes, "hoppede kontroller regnes ikke som bestått"] };
  return { status: done && rc === 0 ? "PASS" : "FAIL", notes };
}

export function overall(results) {
  return ["L1", "L2", "L3", "L7"].every((k) => results[k].status === "PASS") ? "PASS" : "IKKE FULLT BESTÅTT";
}

export function buildReport(results, meta = {}) {
  const label = { PASS: "BESTÅTT", FAIL: "FEILET", SKIPPED: "HOPPET OVER (ikke bestått)", NOT_RUN: "IKKE KJØRT" };
  const names = { L1: "L1 lokal Supabase fra tom database (start + db reset)", L2: "L2 oppgraderingstester (qa:migrations)", L3: "L3 DB-suiten mot ekte Auth/PostgREST (test-db.sh)", L7: "L7 hemmelighetsskann (qa:secrets, inkl. build-artefakter)" };
  const out = ["# Lokal Supabase på GitHub-runner — L1–L3 og L7", "", "Kjørt mot en lokal Supabase-stakk i en container på runneren. IKKE hosted Supabase, ikke emulator, ikke pilotgodkjenning, ingen regel-/parametergodkjenning.", ""];
  for (const l of meta.preflight ?? []) out.push(l);
  if (meta.preflight?.length) out.push("");
  for (const k of ["L1", "L2", "L3", "L7"]) {
    out.push(`## ${names[k]}: ${label[results[k].status]}`);
    for (const n of results[k].notes) out.push(`- ${n}`);
    out.push("");
  }
  out.push("## Åpne kontroller (ikke del av dette workflowet)");
  for (const o of OPEN_CHECKS) out.push(`- ${o}: ÅPEN, ikke kjørt`);
  out.push("- Hosted Supabase (Trinn H): ÅPEN, separat beslutning", "");
  const v = overall(results);
  out.push(`## Samlet: ${v}`, "", v === "PASS" ? "Alle fire kontroller bestått. L4–L6 og Trinn H er fortsatt åpne." : "Minst én kontroll feilet, ble hoppet over eller ble ikke kjørt. Hoppede kontroller regnes ikke som bestått.");
  return out.join("\n") + "\n";
}

/** Leser arbeidskatalogen fra ci-supabase-local.sh og bygger { results, report }. */
export function evaluateDir(dir) {
  const rc = (n) => rcOf(dir, n);
  const tailLines = (name) => (read(dir, name) ?? "").split(/\r?\n/).filter(Boolean).slice(-15);
  const migrations = (read(dir, "migrations.txt") ?? "").split(/\r?\n/);
  const results = {
    L1: evaluateL1({ startRc: rc("start.rc"), resetRc: rc("reset.rc"), actualVersions: migrations[0] || "", expectedVersions: migrations[1] || "", pgVersion: (read(dir, "pgversion.txt") ?? "").trim().split("\n")[0] || "", images: (read(dir, "images.txt") ?? "").split(/\r?\n/).filter((i) => /^[\w./:@-]+$/.test(i)).slice(0, 20), tail: rc("start.rc") !== 0 ? tailLines("start.out") : tailLines("reset.out") }),
    L2: evaluateL2(read(dir, "l2.out"), rc("l2.rc")),
    L3: evaluateL3(read(dir, "l3.json"), rc("l3.rc")),
    L7: evaluateL7(read(dir, "l7.out"), rc("l7.rc"), rc("build.rc")),
  };
  const preflight = (read(dir, "preflight.txt") ?? "").split(/\r?\n/).filter(Boolean).map((l) => `- ${l}`);
  const literals = loadLiterals(join(dir, "literals"));
  let report = sanitizeText(buildReport(results, { preflight }), literals);
  // Siste sperre: lekker rapporten fortsatt noe, undertrykkes den helt og kjøringen feiler.
  if (hasLeak(report, literals)) { report = "# RAPPORT UNDERTRYKT: sanert tekst inneholdt fortsatt mønstre som ligner hemmeligheter.\n"; return { results, report, verdict: "IKKE FULLT BESTÅTT", suppressed: true }; }
  return { results, report, verdict: overall(results), suppressed: false };
}

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  const dir = process.argv[2];
  const r = evaluateDir(dir);
  process.stdout.write(r.report);
  process.exit(r.verdict === "PASS" ? 0 : 1);
}

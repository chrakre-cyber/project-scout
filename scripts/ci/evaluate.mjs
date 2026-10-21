// Vurderer resultatene fra scripts/ci-supabase-local.sh og bygger en SANERT rapport. Ren logikk (testet i tests/ci-evaluate.test.ts).
// Statuser: PASS | FAIL | SKIPPED (noe ble hoppet over — regnes IKKE som bestått) | NOT_RUN. Samlet PASS krever PASS i alle fire kontroller (L1, L2, L3, L7).
// Kun ALLOWLISTEDE linjer fra underskript tas med; alt går dessuten gjennom sanering. Rå utskrift skrives aldri ut.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { hasLeak, loadLiterals, sanitizeText } from "./sanitize.mjs";

/**
 * De SEKS oppgraderingstestene som hoppes over mot Supabase-stakken (describe.skipIf(!SCOUT_DB_ISOLATED)) og som bare kan dekkes av L3b (midlertidig PostgreSQL-klynge).
 * Identitet = testfil + fullt testnavn (ikke antall, ikke prefiks). Listen står i isolated-upgrade-tests.json og endres bare bevisst.
 */
export const ISOLATED_UPGRADE_TESTS = JSON.parse(readFileSync(new URL("./isolated-upgrade-tests.json", import.meta.url), "utf8"));
const idOf = (file, name) => `${file}::${name}`;
const EXPECTED_IDS = new Set(ISOLATED_UPGRADE_TESTS.map((t) => idOf(t.file, t.fullName)));
export const OPEN_CHECKS = ["L4 innlogging via ekte GoTrue", "L5 lagring/gjenåpning via ekte PostgREST (nettleserforløp)", "L6 firmaskille med ekte JWT-er", "Playwright-integrasjon"];

const read = (dir, name) => (existsSync(join(dir, name)) ? readFileSync(join(dir, name), "utf8") : null);
const rcOf = (dir, name) => { const t = read(dir, name); if (t === null) return null; const n = Number.parseInt(t.trim(), 10); return Number.isNaN(n) ? null : n; }; // uleselig exit-kode = ikke registrert
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

function collectTests(report) {
  let data = null;
  try { data = JSON.parse(report ?? ""); } catch { /* ingen gyldig rapport */ }
  if (!data || !Array.isArray(data.testResults)) return null;
  return data.testResults.flatMap((f) => {
    const file = String(f.name ?? "").replace(/^.*\/tests\//, "tests/");
    return (f.assertionResults ?? []).map((a) => ({ file, name: String(a.fullName ?? a.title ?? ""), status: a.status, id: idOf(file, String(a.fullName ?? a.title ?? "")) }));
  });
}
const NOT_EXECUTED = new Set(["skipped", "pending", "todo"]);

/** L3a: hele DB-suiten mot Supabase-stakken. De seks kjente hoppene er IKKE bestått her (status SKIPPED); de kan bare dekkes av L3b. */
export function evaluateL3a(report, rc) {
  if (rc === null) return { status: "NOT_RUN", notes: ["DB-suiten ble ikke kjørt"], knownSkipped: [], unknownSkipped: [], failed: 0 };
  const all = collectTests(report);
  if (!all) return { status: "FAIL", notes: [`ingen lesbar vitest-rapport (${rcText(rc)})`], knownSkipped: [], unknownSkipped: [], failed: 0 };
  const failed = all.filter((a) => a.status === "failed"), passed = all.filter((a) => a.status === "passed");
  const skipped = all.filter((a) => NOT_EXECUTED.has(a.status));
  const knownSkipped = skipped.filter((a) => EXPECTED_IDS.has(a.id)), unknownSkipped = skipped.filter((a) => !EXPECTED_IDS.has(a.id));
  const notes = [`${all.length} tester: ${passed.length} bestått, ${failed.length} feilet, ${skipped.length} hoppet over`];
  for (const f of failed.slice(0, 20)) notes.push(`FEIL ${f.file}: ${f.name}`);
  if (knownSkipped.length) notes.push(`${knownSkipped.length} av de ${EXPECTED_IDS.size} navngitte oppgraderingstestene er hoppet over her (krever isolert klynge, SCOUT_DB_ISOLATED) — regnes IKKE som bestått i L3a; de kan bare dekkes av L3b`);
  if (unknownSkipped.length) notes.push(`${unknownSkipped.length} UVENTET hoppet over (ikke blant de navngitte seks) — undersøk`);
  for (const sk of unknownSkipped.slice(0, 20)) notes.push(`HOPPET ${sk.file}: ${sk.name}`);
  const base = { notes, knownSkipped: knownSkipped.map((a) => a.id), unknownSkipped: unknownSkipped.map((a) => a.id), failed: failed.length };
  if (all.length === 0) return { status: "FAIL", ...base, notes: ["ingen tester ble kjørt", ...notes] };
  if (failed.length > 0) return { status: "FAIL", ...base };
  if (rc !== 0) return { status: "FAIL", ...base, notes: [...notes, `vitest avsluttet med ${rcText(rc)}`] };
  return { status: skipped.length > 0 ? "SKIPPED" : "PASS", ...base };
}

/**
 * L3b: de seks navngitte oppgraderingstestene kjørt i en SEPARAT, midlertidig PostgreSQL-klynge (scripts/test-db-isolated.sh). Dette er IKKE Supabase-stakken.
 * PASS krever at hver av de seks (identitet = fil + fullt navn) er faktisk kjørt og bestått, at ingen annen test er kjørt, ingen av de seks er feilet/hoppet over/mangler,
 * vitest-exit 0 og klyngeskriptets egen «OPPGRADERING OK». Manglende PostgreSQL-binærer ⇒ NOT_RUN.
 */
export function evaluateL3b({ report, rc, binariesMissing, upgradeOk, pgVersion }) {
  if (binariesMissing) return { status: "NOT_RUN", notes: ["PostgreSQL-binærer (initdb/pg_ctl/psql) finnes ikke på runneren: L3b ikke kjørt, og det installeres ikke automatisk"], passedIds: [] };
  if (rc === null || rc === undefined) return { status: "NOT_RUN", notes: ["L3b ble ikke kjørt"], passedIds: [] };
  const all = collectTests(report);
  if (!all) return { status: "FAIL", notes: [`ingen lesbar vitest-rapport fra L3b (${rcText(rc)})`], passedIds: [] };
  const byId = new Map();
  for (const a of all) byId.set(a.id, a.status);
  const problems = [];
  const passedIds = [];
  for (const t of ISOLATED_UPGRADE_TESTS) {
    const id = idOf(t.file, t.fullName), st = byId.get(id);
    if (st === "passed") passedIds.push(id);
    else problems.push(st === undefined ? `MANGLER i L3b: ${t.file}: ${t.fullName}` : `${st === "failed" ? "FEILET" : "IKKE KJØRT (" + st + ")"} i L3b: ${t.file}: ${t.fullName}`);
  }
  // Tester utenfor de seks: «hoppet over» er bare filteret (-t) som utelot dem; alt som faktisk ble kjørt er uventet.
  const unexpected = all.filter((a) => !EXPECTED_IDS.has(a.id) && !NOT_EXECUTED.has(a.status));
  for (const u of unexpected.slice(0, 20)) problems.push(`UVENTET test kjørt i L3b (${u.status}): ${u.file}: ${u.name}`);
  if (rc !== 0) problems.push(`vitest avsluttet med ${rcText(rc)}`);
  if (!upgradeOk) problems.push("klyngeskriptets forhåndskontroll «OPPGRADERING OK» mangler eller meldte feil");
  const label = "IKKE Supabase-stakken: midlertidig lokal PostgreSQL-klynge" + (pgVersion ? ` (${pgVersion})` : "") + " med shim";
  if (problems.length) return { status: "FAIL", notes: [`${passedIds.length} av ${EXPECTED_IDS.size} navngitte oppgraderingstester kjørt og bestått (${label})`, ...problems], passedIds };
  return { status: "PASS", notes: [`${passedIds.length} av ${EXPECTED_IDS.size} navngitte oppgraderingstester kjørt og bestått (${label})`, `${all.length - passedIds.length} øvrige tester i filene ble utelatt av filteret og er ikke talt`], passedIds };
}

/** Samlet L3: PASS bare når L3a har ingen feil/uventede hopp og HVER hoppet kjent test er faktisk bestått i L3b. */
export function combineL3(a, b) {
  const notes = [`L3a: ${a.status} — ${a.notes[0] ?? ""}`, `L3b: ${b.status} — ${b.notes[0] ?? ""}`];
  if (a.status === "NOT_RUN") return { status: "NOT_RUN", notes };
  if (a.status === "FAIL" || b.status === "FAIL") return { status: "FAIL", notes };
  if (b.status === "NOT_RUN") return { status: "NOT_RUN", notes: [...notes, "L3 kan ikke bli PASS uten L3b"] };
  if (a.unknownSkipped.length > 0) return { status: "SKIPPED", notes: [...notes, "uventede hoppede tester i L3a regnes ikke som bestått"] };
  const covered = new Set(b.passedIds);
  const uncovered = a.knownSkipped.filter((id) => !covered.has(id));
  if (uncovered.length > 0) return { status: "FAIL", notes: [...notes, ...uncovered.map((id) => `hoppet over i L3a, men ikke bestått i L3b: ${id}`)] };
  if (a.status !== "PASS" && a.status !== "SKIPPED") return { status: "FAIL", notes };
  return { status: "PASS", notes: [...notes, a.knownSkipped.length ? `${a.knownSkipped.length} hoppet over i L3a er hver for seg kjørt og bestått i L3b (separat klynge, ikke Supabase)` : "ingen hoppede tester i L3a"] };
}

const L7_ALLOW = /^(== |PASS |FAIL |SKIP |SECRET-SKANN:)/;
export function evaluateL7(output, rc, buildRc) {
  if (output === null || rc === null) return { status: "NOT_RUN", notes: ["qa:secrets ble ikke kjørt"] };
  const lines = output.split(/\r?\n/).filter((l) => L7_ALLOW.test(l));
  const fails = lines.filter((l) => l.startsWith("FAIL ")), skips = lines.filter((l) => l.startsWith("SKIP "));
  const done = lines.some((l) => l.startsWith("SECRET-SKANN: INGEN FUNN"));
  const notes = [`${lines.filter((l) => l.startsWith("PASS ")).length} PASS, ${fails.length} FAIL, ${skips.length} SKIP`, ...fails.slice(0, 20), ...skips.slice(0, 20)];
  // L7 omfatter skann av build-artefakter: PASS krever en REGISTRERT, vellykket build (exit 0). Manglende registrering er en manglende kontroll, ikke en bestått.
  const buildOk = buildRc === 0;
  if (buildRc === null || Number.isNaN(buildRc)) notes.push("build ble ikke registrert: build-artefakter er ikke skannet (manglende kontroll, regnes ikke som bestått)");
  else if (buildRc !== 0) notes.push(`npm run build feilet (${rcText(buildRc)}): build-artefakter er ikke skannet`);
  if (fails.length > 0 || rc !== 0 && skips.length === 0 && !done) return { status: "FAIL", notes };
  if (skips.length > 0 || !buildOk) return { status: "SKIPPED", notes: [...notes, "hoppede eller manglende kontroller regnes ikke som bestått"] };
  return { status: done && rc === 0 ? "PASS" : "FAIL", notes };
}

export function overall(results) {
  return ["L1", "L2", "L3", "L7"].every((k) => results[k].status === "PASS") ? "PASS" : "IKKE FULLT BESTÅTT";
}

export function buildReport(results, meta = {}) {
  const label = { PASS: "BESTÅTT", FAIL: "FEILET", SKIPPED: "HOPPET OVER (ikke bestått)", NOT_RUN: "IKKE KJØRT" };
  const names = { L1: "L1 lokal Supabase fra tom database (start + db reset)", L2: "L2 oppgraderingstester (qa:migrations)", L3a: "L3a DB-suiten mot Supabase-stakken (ekte Auth/PostgREST; test-db.sh)", L3b: "L3b seks navngitte oppgraderingstester i SEPARAT midlertidig PostgreSQL-klynge (IKKE Supabase)", L3: "L3 samlet (L3a + L3b)", L7: "L7 hemmelighetsskann (qa:secrets, inkl. build-artefakter)" };
  const out = ["# Lokal Supabase på GitHub-runner — L1–L3 og L7", "", "Kjørt mot en lokal Supabase-stakk i en container på runneren. IKKE hosted Supabase, ikke emulator, ikke pilotgodkjenning, ingen regel-/parametergodkjenning.", ""];
  for (const l of meta.preflight ?? []) out.push(l);
  if (meta.preflight?.length) out.push("");
  for (const k of ["L1", "L2", "L3a", "L3b", "L3", "L7"]) {
    if (!results[k]) continue;
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

/** Leser L3b-filene (scripts/ci/run-l3b.sh) fra en arbeidskatalog. */
export function l3bFromDir(dir) {
  const l3bOut = read(dir, "l3b.out") ?? "";
  return evaluateL3b({ report: read(dir, "l3b.json"), rc: rcOf(dir, "l3b.rc"), binariesMissing: existsSync(join(dir, "l3b.nobinaries")), upgradeOk: /^OPPGRADERING OK/m.test(l3bOut) && !/^OPPGRADERING FEIL/m.test(l3bOut), pgVersion: (read(dir, "l3b.pg.txt") ?? "").trim().split("\n")[0] || "" });
}

/** Leser arbeidskatalogen fra ci-supabase-local.sh og bygger { results, report }. */
export function evaluateDir(dir) {
  const rc = (n) => rcOf(dir, n);
  const tailLines = (name) => (read(dir, name) ?? "").split(/\r?\n/).filter(Boolean).slice(-15);
  const migrations = (read(dir, "migrations.txt") ?? "").split(/\r?\n/);
  const L3a = evaluateL3a(read(dir, "l3.json"), rc("l3.rc"));
  const L3b = l3bFromDir(dir);
  const results = {
    L1: evaluateL1({ startRc: rc("start.rc"), resetRc: rc("reset.rc"), actualVersions: migrations[0] || "", expectedVersions: migrations[1] || "", pgVersion: (read(dir, "pgversion.txt") ?? "").trim().split("\n")[0] || "", images: (read(dir, "images.txt") ?? "").split(/\r?\n/).filter((i) => /^[\w./:@-]+$/.test(i)).slice(0, 20), tail: rc("start.rc") !== 0 ? tailLines("start.out") : tailLines("reset.out") }),
    L2: evaluateL2(read(dir, "l2.out"), rc("l2.rc")),
    L3a, L3b, L3: combineL3(L3a, L3b),
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
if (isMain && process.argv[2] === "--l3b") {
  // Kun L3b (brukes av scripts/test-l3b-faults-offline.sh): skriver «L3B_STATUS=<status>» og sanerte notater.
  const r = l3bFromDir(process.argv[3]);
  process.stdout.write(`L3B_STATUS=${r.status}\n${sanitizeText(r.notes.map((n) => `- ${n}`).join("\n"))}\n`);
  process.exit(r.status === "PASS" ? 0 : 1);
} else if (isMain) {
  const dir = process.argv[2];
  const r = evaluateDir(dir);
  process.stdout.write(r.report);
  process.exit(r.verdict === "PASS" ? 0 : 1);
}

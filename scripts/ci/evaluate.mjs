// Vurderer resultatene fra scripts/ci-supabase-local.sh og bygger en SANERT rapport. Ren logikk (testet i tests/ci-evaluate.test.ts).
// Statuser: PASS | FAIL | SKIPPED (noe ble hoppet over — regnes IKKE som bestått) | NOT_RUN. Samlet PASS krever PASS i alle fire kontroller (L1, L2, L3, L7).
// Kun ALLOWLISTEDE linjer fra underskript tas med; alt går dessuten gjennom sanering. Rå utskrift skrives aldri ut.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseE2E, normalizeCheckName } from "./e2e-names.mjs";
import { hasLeak, loadLiterals, sanitizeText } from "./sanitize.mjs";

/**
 * De SEKS oppgraderingstestene som hoppes over mot Supabase-stakken (describe.skipIf(!SCOUT_DB_ISOLATED)) og som bare kan dekkes av L3b (midlertidig PostgreSQL-klynge).
 * Identitet = testfil + fullt testnavn (ikke antall, ikke prefiks). Listen står i isolated-upgrade-tests.json og endres bare bevisst.
 */
export const ISOLATED_UPGRADE_TESTS = JSON.parse(readFileSync(new URL("./isolated-upgrade-tests.json", import.meta.url), "utf8"));
const idOf = (file, name) => `${file}::${name}`;
const EXPECTED_IDS = new Set(ISOLATED_UPGRADE_TESTS.map((t) => idOf(t.file, t.fullName)));
/**
 * L4a (API-delen av innlogging mot ekte GoTrue/PostgREST) og L6 (firmaskille gjennom ekte PostgREST) er vitest-tester i tests/db som kjøres som en del av L3a. De vurderes HER separat,
 * på identitet (fil + fullt navn) fra den samme vitest-rapporten. Listen i l4-l6-tests.json er fastlåst: en ny eller omdøpt test må legges inn bevisst.
 */
export const L4_L6_TESTS = JSON.parse(readFileSync(new URL("./l4-l6-tests.json", import.meta.url), "utf8"));
const GROUP_FILE = { L4a: "tests/db/auth-gotrue.test.ts", L6: "tests/db/rest-isolation.test.ts" };
/** E2E-plan (nettleserløp mot ekte lokal Supabase): forventede sjekkidentiteter pr. løp, kjent delvis dekning i ekte modus, innloggingsbehov og tidsgrenser. */
export const E2E_PLAN = JSON.parse(readFileSync(new URL("./e2e-plan.json", import.meta.url), "utf8"));
export const OPEN_CHECKS = [];

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

/**
 * Avgrenset diagnostikk fra tests/db/rest-isolation.test.ts (SCOUT_L6_DIAG_FILE): linjer «L6DIAG<TAB>testnavn<TAB>nr<TAB>METODE<TAB>tabell<TAB>status<TAB>kode».
 * Bare linjer som følger formatet nøyaktig OG hører til en FEILET, fastlåst test slippes gjennom; alt annet forkastes. Ingen respons, payload, filterverdier eller URL kan passere formatet.
 */
export function parseL6Diag(text, failedFullNames) {
  const allowed = new Set(failedFullNames);
  const byTest = new Map();
  for (const line of String(text ?? "").split(/\r?\n/)) {
    const m = /^L6DIAG\t([^\t]{1,300})\t(\d{1,3})\t(GET|POST|PATCH|DELETE|PUT|HEAD)\t([a-z_]{1,64}|-)\t(\d{3})\t([0-9A-Z]{5}|PGRST\d{3}|-)$/.exec(line);
    if (!m || !allowed.has(m[1])) continue;
    const list = byTest.get(m[1]) ?? [];
    if (list.length < 40) list.push(`  #${m[2]} ${m[3]} ${m[4]} → HTTP ${m[5]}, kode ${m[6]}`);
    byTest.set(m[1], list);
  }
  return byTest;
}

/** L4a / L6: hver forventede test (fil + fullt navn) må være kjørt og bestått i vitest-rapporten for L3a; ingen uventede tester i filen; manglende rapport ⇒ ikke PASS. */
export function evaluateGroup(key, report, rc, diagText = null) {
  const expected = L4_L6_TESTS[key].map((t) => idOf(t.file, t.fullName));
  if (rc === null) return { status: "NOT_RUN", notes: [`${key}: DB-suiten ble ikke kjørt`] };
  const all = collectTests(report);
  if (!all) return { status: "FAIL", notes: [`${key}: ingen lesbar vitest-rapport`] };
  const inFile = all.filter((a) => a.file === GROUP_FILE[key]);
  const byId = new Map(inFile.map((a) => [a.id, a.status]));
  const problems = [];
  let passed = 0;
  for (const t of L4_L6_TESTS[key]) {
    const st = byId.get(idOf(t.file, t.fullName));
    if (st === "passed") passed += 1;
    else problems.push(st === undefined ? `MANGLER: ${t.fullName}` : `${st === "failed" ? "FEILET" : "IKKE KJØRT (" + st + ")"}: ${t.fullName}`);
  }
  for (const a of inFile.filter((x) => !expected.includes(x.id)).slice(0, 20)) problems.push(`UVENTET test i ${a.file} (ikke i den fastlåste listen): ${a.name}`);
  const notes = [`${passed} av ${expected.length} navngitte tester kjørt og bestått`, ...problems];
  if (diagText) {
    const failedNames = L4_L6_TESTS[key].filter((t) => byId.get(idOf(t.file, t.fullName)) === "failed").map((t) => t.fullName);
    for (const [name, ops] of parseL6Diag(diagText, failedNames)) notes.push(`DIAGNOSTIKK (operasjon, tabell, HTTP-status, kode; i rekkefølge; siste operasjon er normalt der påstanden sviktet) for «${name}»:`, ...ops);
  }
  return { status: problems.length ? "FAIL" : "PASS", notes };
}

/**
 * Ett nettleserløp (L4b = l4-browser, L5a = econ006, L5b = econ006d) i EKTE modus. Identitet = normalisert sjekknavn fra e2e-plan.json. PASS krever: modus ekte, hver forventet sjekk nøyaktig én gang og OK (valgfrie varianter høyst én gang),
 * ingen feil/ukjente/dupliserte sjekker, konsistent sammendrag og exit-kode 0. Kjent delvis dekning (plan.partialInReal, f.eks. econ006 J3) gir PARTIAL — aldri PASS. Manglende nettleser (exit 3)
 * er NOT_RUN; hoppede ukjente sjekker er SKIPPED; feil, manglende, uventede, emulatormodus eller inkonsistent exit-kode er FAIL.
 */
export function evaluateE2E(key, output, rc) {
  const plan = E2E_PLAN[key];
  const exp = plan.checks.map(normalizeCheckName), partial = new Set((plan.partialInReal ?? []).map(normalizeCheckName));
  if (rc === null || output === null) return { status: "NOT_RUN", notes: [`${plan.title}: ble ikke kjørt`] };
  if (rc === 3) return { status: "NOT_RUN", notes: [`${plan.title}: IKKE KJØRT — ingen forhåndsinstallert Chrome/Chromium på runneren (ingenting installeres automatisk); regnes ikke som bestått`] };
  if (rc === 124) return { status: "FAIL", notes: [`${plan.title}: tidsavbrudd`] };
  if (rc === 2) return { status: "FAIL", notes: [`${plan.title}: avvist/ikke startet (exit 2: manglende, ugyldig eller ikke-lokal konfigurasjon, eller stakken kjører ikke)`] };
  const { modeLine, summary, items } = parseE2E(output, plan.checks);
  const problems = [], skippedUnknown = [], skippedKnown = [], failed = [];
  if (/EMULATOR/.test(modeLine) || /\[modus: emulator\]/.test(summary)) problems.push("kjørte i EMULATORMODUS — ikke ekte Supabase; regnes ikke som resultat for dette løpet");
  else if (!/^MODUS: EKTE/.test(modeLine) || !/\[modus: real\]/.test(summary)) problems.push("ekte modus er ikke bekreftet i utskriften (MODUS-linje/sammendrag mangler)");
  const seen = new Map();
  for (const it of items) seen.set(it.name, [...(seen.get(it.name) ?? []), it]);
  for (const name of exp) {
    const hits = seen.get(name) ?? [];
    if (hits.length === 0) { problems.push(`MANGLER: ${name}`); continue; }
    if (hits.length > 1) problems.push(`DUPLISERT (${hits.length}×): ${name}`);
    const it = hits[0];
    if (it.kind === "FEIL") failed.push(it);
    else if (it.kind === "HOPP") (partial.has(name) ? skippedKnown : skippedUnknown).push(it);
  }
  // Valgfrie grupper (ordlyd som avhenger av alderen på den innebygde standardepoken): høyst ÉN variant kan forekomme, og den må være OK.
  const optional = (plan.optionalOneOf ?? []).map((g) => g.map(normalizeCheckName));
  for (const g of optional) {
    const present = g.flatMap((n) => seen.get(n) ?? []);
    if (present.length > 1) problems.push(`FLERE varianter av en valgfri sjekk: ${g.join(" | ")}`);
    for (const it of present) { if (it.kind === "FEIL") failed.push(it); else if (it.kind === "HOPP") skippedUnknown.push(it); }
  }
  const optionalNames = new Set(optional.flat());
  for (const it of items) if (!exp.includes(it.name) && !optionalNames.has(it.name)) problems.push(`UVENTET sjekk (ikke i planen): ${it.name}`);
  const okCount = items.filter((i) => i.kind === "OK").length;
  const m = /^(\d+)\/(\d+) sjekker OK/.exec(summary);
  if (!m || Number(m[1]) !== okCount || Number(m[2]) !== items.length) problems.push(`sammendraget stemmer ikke med resultatlinjene (${summary || "mangler"} mot ${okCount}/${items.length})`);
  const expectRc = failed.length ? 1 : skippedKnown.length || skippedUnknown.length ? 4 : 0;
  if (rc !== expectRc) problems.push(`exit-kode ${rc} passer ikke med resultatet (forventet ${expectRc})`);
  const clip = (t) => sanitizeText(t).slice(0, 160);
  const notes = [`${plan.title}: ${okCount} OK, ${failed.length} FEIL, ${skippedKnown.length + skippedUnknown.length} HOPPET av ${exp.length} faste forventede sjekker (modus: ${/EKTE/.test(modeLine) ? "ekte" : "ikke ekte"})`];
  for (const f of failed.slice(0, 20)) notes.push(`FEIL: ${f.name}${f.extra ? ` — ${clip(f.extra)}` : ""}`);
  for (const h of skippedKnown) notes.push(`KJENT DELVIS DEKNING (HOPPET, regnes ikke som bestått): ${h.name}${h.extra ? ` — ${clip(h.extra)}` : ""}`);
  for (const h of skippedUnknown) notes.push(`UVENTET HOPPET: ${h.name}${h.extra ? ` — ${clip(h.extra)}` : ""}`);
  for (const p of problems.slice(0, 30)) notes.push(p);
  if (failed.length || problems.length) return { status: "FAIL", notes };
  if (skippedUnknown.length) return { status: "SKIPPED", notes };
  if (skippedKnown.length) return { status: "PARTIAL", notes: [...notes, "delvis dekning erstattes ikke av API-dekning (L6) og telles ikke som bestått"] };
  return { status: "PASS", notes };
}

/** L5 = econ006 (L5a) + econ006d (L5b): PASS bare når begge er PASS; delvis dekning gir PARTIAL og dermed aldri full PASS. */
export function combineL5(a, b) {
  const notes = [`L5a: ${a.status}`, `L5b: ${b.status}`];
  const st = [a.status, b.status];
  const status = st.includes("FAIL") ? "FAIL" : st.includes("NOT_RUN") ? "NOT_RUN" : st.includes("SKIPPED") ? "SKIPPED" : st.includes("PARTIAL") ? "PARTIAL" : "PASS";
  return { status, notes };
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
  return ["L1", "L2", "L3", "L4a", "L4b", "L5", "L6", "L7"].every((k) => results[k] && results[k].status === "PASS") ? "PASS" : "IKKE FULLT BESTÅTT";
}

export function buildReport(results, meta = {}) {
  const label = { PASS: "BESTÅTT", FAIL: "FEILET", SKIPPED: "HOPPET OVER (ikke bestått)", PARTIAL: "DELVIS (ikke bestått)", NOT_RUN: "IKKE KJØRT" };
  const names = { L1: "L1 lokal Supabase fra tom database (start + db reset)", L2: "L2 oppgraderingstester (qa:migrations)", L3a: "L3a DB-suiten mot Supabase-stakken (ekte Auth/PostgREST; test-db.sh)", L3b: "L3b seks navngitte oppgraderingstester i SEPARAT midlertidig PostgreSQL-klynge (IKKE Supabase)", L3: "L3 samlet (L3a + L3b)", L4a: "L4a innlogging mot ekte GoTrue og tokenvalidering i PostgREST (API-nivå, tests/db)", L6: "L6 firmaskille via ekte PostgREST: search_drafts, dealer_economics_inputs, dealer_economics_profiles (tests/db)", L4b: "L4b innlogging i nettleser mot ekte lokal Supabase (l4-browser, Playwright + forhåndsinstallert Chrome, modus: ekte)", L5a: "L5a econ006 i nettleser mot ekte lokal Supabase (modus: ekte)", L5b: "L5b econ006d i nettleser mot ekte lokal Supabase (modus: ekte)", L5: "L5 samlet (L5a + L5b)", L7: "L7 hemmelighetsskann (qa:secrets, inkl. build-artefakter)" };
  const out = ["# Lokal Supabase på GitHub-runner — L1–L3 og L7", "", "Kjørt mot en lokal Supabase-stakk i en container på runneren. IKKE hosted Supabase, ikke emulator, ikke pilotgodkjenning, ingen regel-/parametergodkjenning.", ""];
  for (const l of meta.preflight ?? []) out.push(l);
  if (meta.preflight?.length) out.push("");
  for (const k of ["L1", "L2", "L3a", "L3b", "L3", "L4a", "L6", "L7", "L4b", "L5a", "L5b", "L5"]) {
    if (!results[k]) continue;
    out.push(`## ${names[k]}: ${label[results[k].status]}`);
    for (const n of results[k].notes) out.push(`- ${n}`);
    out.push("");
  }
  out.push("## Åpne kontroller");
  for (const o of OPEN_CHECKS) out.push(`- ${o}: ÅPEN, ikke kjørt`);
  out.push("- Hosted Supabase (Trinn H): ÅPEN, separat beslutning", "- L3c (de seks oppgraderingstestene mot stakkens Postgres): utsatt", "");
  const v = overall(results);
  out.push(`## Samlet: ${v}`, "", v === "PASS" ? "Alle åtte kontroller (L1, L2, L3, L4a, L4b, L5, L6, L7) bestått. Hosted (Trinn H) er fortsatt åpent." : "Minst én kontroll feilet, ble hoppet over eller ble ikke kjørt. Hoppede kontroller regnes ikke som bestått.");
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
    L4a: evaluateGroup("L4a", read(dir, "l3.json"), rc("l3.rc"), read(dir, "l6-diag.txt")),
    L6: evaluateGroup("L6", read(dir, "l3.json"), rc("l3.rc"), read(dir, "l6-diag.txt")),
    L4b: evaluateE2E("l4", read(dir, "e2e-l4.out"), rc("e2e-l4.rc")),
    L5a: evaluateE2E("econ006", read(dir, "e2e-econ006.out"), rc("e2e-econ006.rc")),
    L5b: evaluateE2E("econ006d", read(dir, "e2e-econ006d.out"), rc("e2e-econ006d.rc")),
    L7: evaluateL7(read(dir, "l7.out"), rc("l7.rc"), rc("build.rc")),
  };
  results.L5 = combineL5(results.L5a, results.L5b);
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

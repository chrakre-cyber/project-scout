// ECON-006d: testrester fra avstemmingen, i ekte nettleser (se scripts/test-e2e-econ006d.sh for forbehold: emulator ≠ Supabase; testkopier av appen; syntetiske annonser; fixturekonvensjon).
//   1. ukjent rettighetsprofil (ingen profil registrert / profil som bare er utkast) — kilden vises ikke, ingen økonomi, ingen tall
//   2. ukjent kjøretøy-/registreringsprofil (planlagt registrering «uspesifisert»/«varebil» støttes ikke; ukjent drivlinje)
//   3. B1: akseptdato utenfor dokumentert periode (2026) — aldri estimat, årsaken vises
//   4. J5: ukjent fradragsstatus ⇒ to scenarioer for økonomisk kost — adskilt fra BEV med ukjent elbilkvalifisering (elbilfritak-scenarioer), og BEV med begge ukjente (fire kombinasjoner)
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { startMiniSupabase } from "./support/mini-supabase.mjs";
import { buildPatchedCopy } from "./support/patched-build.mjs";
import { FX_RATE, LISTINGS, TRANSPORT_NOK, expected, nok } from "./support/econ006-reference.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW);
const { Client } = require(process.env.PG);
const DB = process.env.SUPABASE_TEST_DB_URL;
const SHOTS = process.env.SHOTS || "reviews/ECON-006d/screenshots";
mkdirSync(SHOTS, { recursive: true });
const EMU_PORT = 54399, MAIN = 3100, NOPROFILE = 3102, DRAFT = 3103;
const base = (p) => `http://localhost:${p}`;
const results = [];
const check = (name, ok, extra = "") => { results.push(`${ok ? "OK  " : "FEIL"} ${name}${ok || !extra ? "" : ` — ${extra}`}`); if (!ok) console.error(`FEIL ${name} — ${extra}`); };
const nb = (s) => s.replace(/ | /g, " ");
const addDays = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const PEPPER = "merovo-public-id-pepper-v1/ikke-hemmelig/kun-syntetiske-kilder";
const pidOf = (id) => `m1_${createHmac("sha256", PEPPER).update(`m1|${"synthetic-demo".length}:synthetic-demo|${id}`).digest().subarray(0, 18).toString("base64url")}`;
const NUMBER_BLOCK = /\d{1,3}(?: \d{3})+ kr/; // et beløp i visningen (tusenskille + «kr»)

const db = new Client({ connectionString: DB });
await db.connect();
const run = randomBytes(3).toString("hex");
const A = { id: randomUUID(), email: `econd-a-${run}@example.test`, password: randomBytes(18).toString("base64url") };
await db.query(`insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change)
  values ('00000000-0000-0000-0000-000000000000',$1,'authenticated','authenticated',$2,extensions.crypt($3,extensions.gen_salt('bf')),now(),'{"provider":"email"}','{}',now(),now(),'','','','')`, [A.id, A.email, A.password]);
const firmA = (await db.query("select private.admin_create_dealership($1) id", [`ECON-D Firma A ${run}`])).rows[0].id;
await db.query("select private.admin_add_member($1,$2)", [A.email, firmA]);
const emu = await startMiniSupabase({ dbUrl: DB, users: [A], port: EMU_PORT, pgModulePath: process.env.PG });
const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: emu.url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-publishable-key-not-secret", NEXT_TELEMETRY_DISABLED: "1" };
delete env.SCOUT_SYNTHETIC_FAILURE; delete env.SCOUT_PUBLIC_ID_KEY;
env.SCOUT_ENABLE_LEGACY_ROUTES = "1";
const cleanups = [], servers = [];
process.on("exit", () => { for (const s of servers) { try { s.kill("SIGKILL"); } catch { /* stoppet */ } } for (const c of cleanups) { try { c(); } catch { /* ignorer */ } } });
async function startIn(cwd, port) {
  const p = spawn(`${cwd}/node_modules/.bin/next`, ["start", "-p", String(port)], { cwd, env, stdio: ["ignore", "ignore", "inherit"] });
  servers.push(p);
  for (let i = 0; i < 80; i++) { try { const r = await fetch(`${base(port)}/login`); if (r.status < 500) return; } catch { /* venter */ } await new Promise((r) => setTimeout(r, 500)); }
  throw new Error(`appen på ${port} startet ikke`);
}
// Demoens faste observasjonsdatoer er utløpt (funn i 006c): alle kopier har friske observasjonstidspunkt. Her er IKKE utløp temaet.
console.log("bygger hovedløpet (friske observasjonstidspunkt) …");
const cMain = buildPatchedCopy({ root: process.cwd(), names: ["fresh_observations"], env }); cleanups.push(cMain.cleanup); await startIn(cMain.dir, MAIN);
console.log("bygger kopi uten registrert rettighetsprofil …");
const cNo = buildPatchedCopy({ root: process.cwd(), names: ["fresh_observations", "no_rights_profile"], env }); cleanups.push(cNo.cleanup); await startIn(cNo.dir, NOPROFILE);
console.log("bygger kopi der rettighetsprofilen bare er et utkast …");
const cDr = buildPatchedCopy({ root: process.cwd(), names: ["fresh_observations", "draft_rights_profile"], env }); cleanups.push(cDr.cleanup); await startIn(cDr.dir, DRAFT);

const browser = await chromium.launch();
const problems = [];
const watch = (page) => { page.on("pageerror", (e) => problems.push("pageerror: " + e.message)); page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) problems.push("console: " + m.text()); }); };
async function login(ctx, port) {
  const page = await ctx.newPage(); watch(page);
  await page.goto(`${base(port)}/login`);
  await page.fill('input[name="email"]', A.email); await page.fill('input[name="password"]', A.password);
  await Promise.all([page.waitForURL(/\/searches/), page.click('main button[type="submit"]')]);
  return page;
}
const shot = (page, name) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
async function must(page, selector, ms = 20000) {
  try { await page.waitForSelector(selector, { timeout: ms, state: "attached" }); } catch (e) { await shot(page, "_feil").catch(() => {}); console.error(`TIDSAVBRUDD ${selector} på ${page.url()}\n${(await page.locator("body").innerText().catch(() => "")).slice(0, 1500)}`); throw e; }
}
const body = async (page) => nb(await page.locator("body").innerText());
const urls = (port, sid, v, pid) => ({ detail: `${base(port)}/searches/${sid}/preview/${pid}?v=${v}`, form: `${base(port)}/searches/${sid}/preview/${pid}/dealer-input?v=${v}`, preview: `${base(port)}/searches/${sid}/preview?v=${v}` });
async function setField(page, name, value) {
  const loc = page.locator(`[name="${name}"]`);
  if ((await loc.count()) === 0) throw new Error(`skjemafelt mangler: ${name}`);
  if ((await loc.first().evaluate((e) => e.tagName)) === "SELECT") await loc.first().selectOption(value); else await loc.first().fill(value);
}
const fillForm = async (page, v) => { for (const [k, x] of Object.entries(v)) await setField(page, k, x); };
const D = { today: addDays(0), yesterday: addDays(-1), soon: addDays(10), later: addDays(20) };
const common = (over = {}) => ({
  prop_basis: "dealer_entered", tw_basis: "dealer_entered", fr_basis: "dealer_entered", fr_precision: "month", nr_date: D.soon, nr_kind: "expected", cd_kind: "expected_scenario", cd_date: D.today,
  fv_treatment: "excluded_documented", fv_evidence: "invoice_or_contract",
  fxA_pair: "EUR/NOK", fxA_rate: FX_RATE.replace(".", ","), fxA_source: "E2E-testkilde (ikke en offisiell kurs)", fxA_quotedAt: D.yesterday, fxA_validUntil: D.later,
  fxC_pair: "EUR/NOK", fxC_rate: FX_RATE.replace(".", ","), fxC_source: "E2E-testkilde (ikke en offisiell kurs)", fxC_quotedAt: D.yesterday, fxC_validFrom: D.yesterday, fxC_validTo: D.later,
  tb_amount: String(TRANSPORT_NOK), ins_amount: "0", ta_mode: "not_applicable", ta_note: "ingen (test)", lh_mode: "not_applicable", lh_note: "ingen (test)", cg_mode: "not_applicable", cg_note: "ikke relevant (test)", rf_mode: "not_applicable", rf_note: "ikke relevant (test)",
  deduction: "non_recoverable", vatHandling: "registered_reports_in_vat_return", ...over,
});
const VEH = {
  diesel: { prop_piston: "yes", prop_chargeable: "no", prop_fuel: "diesel", prop_hybrid: "none", tw_kg: "1976", co2_g: "179", co2_method: "wltp_combined", fr_value: "2023-11" },
  bev: { prop_piston: "no", prop_chargeable: "yes", prop_fuel: "", prop_hybrid: "", tw_kg: "2185", co2_g: "0", co2_method: "wltp_combined", fr_value: "2023-08" },
};
const full = (kind, over = {}) => common({ ...VEH[kind], ...over });
async function saveForm(page, values) {
  await fillForm(page, values);
  await page.check('[data-testid="confirm"]');
  await Promise.all([page.waitForURL(/msg=econ_saved/, { timeout: 30000 }).catch(async (e) => { await shot(page, "_feil"); console.error((await body(page)).slice(0, 1500)); throw e; }), page.click('[data-testid="dealer-form-submit"]')]);
}
async function econ(page) {
  const el = page.locator('[data-testid="economics"]').first();
  await el.waitFor({ timeout: 20000 });
  const attrs = await el.evaluate((e) => ({ status: e.getAttribute("data-economics-status"), positive: e.getAttribute("data-positive-budget") }));
  return { ...attrs, text: nb(await el.innerText()), headline: nb(await page.locator('[data-testid="economics-headline"]').first().innerText().catch(() => "")) };
}
const scenarioList = async (page) => (await page.locator('[data-testid="economics-scenarios"] li').allInnerTexts()).map(nb);

try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const pA = await login(ctx, MAIN);
  async function createSearch(page, scenario) {
    await page.goto(`${base(MAIN)}/searches/new?example=demo-bmw`);
    await page.uncheck('input[name="cost.transport.use"]');
    if (scenario) await page.check(`input[name="plannedRegistration"][value="${scenario}"]`);
    await Promise.all([page.waitForURL(/\?msg=created/, { timeout: 30000 }), page.click('[data-testid="search-form"] button[type="submit"]')]);
    return page.url().match(/searches\/([0-9a-f-]{36})/)[1];
  }
  const S1 = await createSearch(pA), S3 = await createSearch(pA, "unspecified"), S4 = await createSearch(pA, "van");
  const specs = (await db.query("select id, spec->'plannedRegistration'->>'requested' r from public.search_drafts where dealership_id=$1", [firmA])).rows;
  check("oppsett: tre søk — personbil, uspesifisert og varebil — lagret i firma A", specs.length === 3 && specs.find((s) => s.id === S1).r === "passenger" && specs.find((s) => s.id === S3).r === "unspecified" && specs.find((s) => s.id === S4).r === "van", JSON.stringify(specs));
  const P = Object.fromEntries(Object.entries(LISTINGS).map(([k, v]) => [k, pidOf(v.providerId)]));

  // ============================================================ 4. J5 — ukjent fradragsstatus (diesel) vs BEV med ukjent elbilkvalifisering
  const exD = expected("diesel");
  await pA.goto(urls(MAIN, S1, 1, P.diesel).form); await must(pA, '[data-testid="dealer-form"]');
  await saveForm(pA, full("diesel", { deduction: "unknown" }));
  let e = await econ(pA);
  let list = (await scenarioList(pA)).join(" | ");
  check("J5 diesel (fradragsstatus «ukjent»): status = scenarioer, aldri ett enkelt tall; positivt budsjett false", e.status === "scenarios" && e.positive === "false", `${e.status}`);
  check(`J5 diesel: kontantbehov (brutto utlegg) er ÉN verdi ${nok(exD.cash)}, uavhengig av fradragsstatus`, nb(await pA.locator('[data-testid="economics-sums"]').innerText()).includes(nok(exD.cash)));
  check(`J5 diesel: økonomisk kost = to scenarioer ${nok(exD.cash - exD.vat)} (hvis fradragsberettiget) og ${nok(exD.cash)} (hvis ikke) — merket med fradragsstatus`, (await scenarioList(pA)).length === 2 && list.includes(nok(exD.cash - exD.vat)) && list.includes(nok(exD.cash)) && /hvis fradragsberettiget/.test(list) && /hvis ikke fradragsberettiget/.test(list), list);
  check("J5 diesel: scenarioene nevner IKKE elbilfritak (det er en annen usikkerhet)", !/elbilfritak/i.test(list));
  const missD = nb(await pA.locator('[data-testid="economics-missing-fields"]').innerText());
  check("J5 diesel: «Hva mangler?» nevner fradragsstatus med lenke til skjemaet og IKKE elbilkvalifisering", (await pA.locator('[data-testid="economics-missing-fields"] a[href$="#f-vat"]').count()) >= 1 && !/elbil|EV/i.test(missD), missD.slice(0, 200));
  await shot(pA, "01-J5-diesel-fradrag-ukjent");

  const exB = expected("bev");
  await pA.goto(urls(MAIN, S1, 1, P.bev).form); await must(pA, '[data-testid="dealer-form"]');
  await saveForm(pA, full("bev", { deduction: "non_recoverable" }));
  e = await econ(pA); list = (await scenarioList(pA)).join(" | ");
  check(`BEV (fradrag KJENT, elbilkvalifisering ukjent): to scenarioer ${nok(exB.cashWithExemption)} / ${nok(exB.cash)} merket med elbilfritak — ikke fradrag`, e.status === "scenarios" && (await scenarioList(pA)).length === 2 && list.includes(nok(exB.cashWithExemption)) && list.includes(nok(exB.cash)) && /elbilfritak/i.test(list) && !/fradragsberettiget/.test(list), list);
  const missB = nb(await pA.locator('[data-testid="economics-missing-fields"]').innerText());
  check("BEV (fradrag kjent): mangelen er elbilkvalifisering — «kan ikke registreres ennå» — og fradragsstatus mangler IKKE", /kan ikke registreres ennå/.test(missB) && (await pA.locator('[data-testid="economics-missing-fields"] a[href$="#f-vat"]').count()) === 0, missB.slice(0, 200));
  await shot(pA, "02-BEV-elbilfritak-ukjent");

  await pA.goto(urls(MAIN, S1, 1, P.bev).form); await must(pA, '[data-testid="dealer-form"]');
  await saveForm(pA, { deduction: "unknown" });
  e = await econ(pA);
  const four = await scenarioList(pA);
  check("BEV med BEGGE ukjente: fire kombinasjoner, alle merket med både elbilfritak og fradragsstatus, alle ulike; positivt false", e.status === "scenarios" && four.length === 4 && four.every((t) => /elbilfritak/i.test(t) && /fradragsberettiget/.test(t)) && new Set(four).size === 4 && e.positive === "false", four.join(" | "));
  const sumsB = nb(await pA.locator('[data-testid="economics-sums"]').innerText());
  // Brutto utlegg vises som «Fra <laveste> (scenarier)» — ikke som ett tall; de enkelte kontantverdiene listes ikke (UX-begrensning, rapportert), men de ligger i økonomisk-kost-scenarioene for «ikke fradragsberettiget».
  check("BEV med begge ukjente: brutto utlegg vises som «Fra … (scenarier)» (laveste = med elbilfritak), ikke som ett tall, og er ikke merket med fradragsstatus; økonomisk-kost-listen inneholder begge kontantverdiene",
    sumsB.includes(`Fra ${nok(exB.cashWithExemption)}`) && /scenarier/.test(sumsB) && !/fradragsberettiget/.test(sumsB.split("Økonomisk")[0] ?? "") && four.some((t) => t.includes(nok(exB.cashWithExemption))) && four.some((t) => t.includes(nok(exB.cash))), `${sumsB.slice(0, 300)} || ${four.join(" | ")}`);
  await shot(pA, "03-BEV-begge-ukjente");

  // ============================================================ 3. B1 — akseptdato utenfor dokumentert periode
  const exM = expected("missing");
  const pidM = P.missing;
  for (const [date, label] of [["2027-01-05", "etter"], ["2025-12-31", "før"]]) {
    await pA.goto(urls(MAIN, S1, 1, pidM).form); await must(pA, '[data-testid="dealer-form"]');
    await saveForm(pA, full("diesel", { cd_kind: "expected_scenario", cd_date: date }));
    e = await econ(pA);
    const t = await body(pA);
    check(`B1 (${label} 2026: ${date}): aldri estimat — status ${e.status}; positivt false; ingen punktestimat-tall`, ["not_calculated", "lower_bound"].includes(e.status) && e.positive === "false" && !t.includes(nok(exM.cash)), `${e.status} | ${e.headline}`);
    check(`B1 (${date}): årsaken «Akseptdatoen ligger utenfor dokumentert periode.» vises, og tolldato er et registrerbart manglende felt med lenke`, t.includes("Akseptdatoen ligger utenfor dokumentert periode") && (await pA.locator('[data-testid="economics-missing-fields"] a[href$="#f-customs"]').count()) >= 1);
    if (label === "etter") await shot(pA, "04-B1-akseptdato-utenfor-periode");
  }
  await pA.goto(urls(MAIN, S1, 1, pidM).form); await must(pA, '[data-testid="dealer-form"]');
  await saveForm(pA, { cd_date: D.today });
  e = await econ(pA);
  check(`B1 kontroll: samme input med akseptdato i perioden gir «Estimat — ikke validert: ${nok(exM.cash)}» (så avslaget skyldes datoen)`, e.status === "estimate" && e.headline === `Estimat — ikke validert: ${nok(exM.cash)}`, `${e.status} | ${e.headline}`);

  // ============================================================ 2. ukjent kjøretøy-/registreringsprofil
  for (const [sid, scen] of [[S3, "uspesifisert"], [S4, "varebil"]]) {
    await pA.goto(urls(MAIN, sid, 1, P.diesel).detail);
    e = await econ(pA);
    check(`ukjent profil (planlagt registrering «${scen}»): «Ikke beregnet» med årsak «støttes ikke (bare personbil)», ingen tall`, e.status === "not_calculated" && e.positive === "false" && /støttes ikke \(bare personbil\)/.test(e.text) && !NUMBER_BLOCK.test(e.text), `${e.status} | ${e.text.slice(0, 200)}`);
  }
  await pA.goto(urls(MAIN, S3, 1, P.diesel).form); await must(pA, '[data-testid="dealer-form"]');
  await saveForm(pA, full("diesel"));
  e = await econ(pA);
  check("ukjent profil: selv med fullt bekreftet forhandlerinput forblir uspesifisert registrering «Ikke beregnet» (opplysningene kan ikke gjøre en ikke-støttet profil beregnbar)", e.status === "not_calculated" && !NUMBER_BLOCK.test(e.text) && /støttes ikke/.test(e.text), `${e.status}`);
  await shot(pA, "05-ukjent-profil-uspesifisert");
  // ukjent drivlinje (alle drivlinjefelt «ukjent») i personbil-søket
  await pA.goto(urls(MAIN, S1, 1, P.diesel2).form); await must(pA, '[data-testid="dealer-form"]');
  await saveForm(pA, full("diesel", { prop_piston: "", prop_chargeable: "", prop_fuel: "", prop_hybrid: "", prop_basis: "dealer_entered" }));
  e = await econ(pA);
  check("ukjent drivlinje: aldri estimat eller scenarioer; drivlinje står som manglende, registrerbart felt med lenke; positivt false", !["estimate", "scenarios"].includes(e.status) && e.positive === "false" && (await pA.locator('[data-testid="economics-missing-fields"] a[href$="#f-propulsion"]').count()) >= 1, `${e.status} | ${e.headline}`);
  await shot(pA, "06-ukjent-drivlinje");

  // ============================================================ 1. ukjent rettighetsprofil
  for (const [port, label, expectBlockedText] of [[NOPROFILE, "ingen profil registrert", null], [DRAFT, "profilen er bare et utkast (ikke verifisert)", /ingen gyldig visningsprofil/]]) {
    const ctxP = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const pP = await login(ctxP, port);
    await pP.goto(urls(port, S1, 1, P.diesel).preview);
    const cards = await pP.locator("li[data-listing]").count();
    const tp = await body(pP);
    // (Søkets egne budsjettall, f.eks. «450 000 kr», er brukerens egne inndata og står i sammendraget; det er økonomi/estimat som ikke skal finnes.)
    check(`ukjent rettighetsprofil (${label}): resultatlisten viser ingen annonser, ingen økonomi og ingen estimat/nedre grense`, cards === 0 && (await pP.locator('[data-testid="economics"]').count()) === 0 && !/Estimat — ikke validert|Minst .* kr \(ufullstendig\)/.test(tp), `${cards} kort | ${tp.slice(0, 200)}`);
    for (const kind of ["detail", "form"]) {
      const r = await pP.goto(urls(port, S1, 1, P.diesel)[kind]);
      const t = await body(pP);
      const blocked = await pP.locator('[data-testid="blocked"]').count();
      const okState = expectBlockedText ? blocked === 1 && expectBlockedText.test(t) : r?.status() === 404 || /ikke funnet|finnes ikke/i.test(t);
      check(`ukjent rettighetsprofil (${label}): ${kind === "detail" ? "detaljsiden" : "forhandlerskjemaet"} ${expectBlockedText ? "er blokkert med forklaring" : "gir «ikke funnet»"} — ingen økonomi, ingen skjema, ingen tall`, okState && (await pP.locator('[data-testid="economics"]').count()) === 0 && (await pP.locator('[data-testid="dealer-form"]').count()) === 0 && !NUMBER_BLOCK.test(t), `${r?.status()} ${t.slice(0, 160)}`);
    }
    await shot(pP, port === NOPROFILE ? "07-ingen-profil" : "08-profil-utkast");
    await ctxP.close();
  }

  check("ingen JavaScript-feil i konsollen under hele flyten", problems.length === 0, problems.slice(0, 3).join(" | "));
  await ctx.close();
} finally {
  await browser.close().catch(() => {});
  for (const s of servers) s.kill("SIGTERM");
  for (const c of cleanups) c();
  await emu.close().catch(() => {});
  await db.query("delete from public.dealer_economics_inputs where dealership_id=$1", [firmA]).catch(() => {});
  await db.query("delete from public.search_drafts where dealership_id=$1", [firmA]).catch(() => {});
  await db.end().catch(() => {});
}
console.log(results.join("\n"));
const failed = results.filter((r) => r.startsWith("FEIL"));
console.log(`\n${results.length - failed.length}/${results.length} sjekker OK${failed.length ? `, ${failed.length} FEIL` : ""}`);
process.exit(failed.length ? 1 : 0);

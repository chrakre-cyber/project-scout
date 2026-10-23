// ECON-006c: nettleserforløp for forhandlerskjema, firmaprofil, lagring og gjenåpning, diesel/BEV/PHEV, manglende opplysninger, utløpt kurs, foreldet bekreftelse, rettighetsavslag, firmaskille,
// ingen lekkasje av rå identitet og aldri positivt budsjettutfall. Kjøring: bash scripts/test-e2e-econ006.sh
//
// HVA DETTE ER (og ikke er):
//   * appen er den ekte, bygde Next-appen i en ekte Chromium (Playwright);
//   * Auth/PostgREST er en EMULATOR (tests/e2e/support/mini-supabase.mjs) som videresender app-kallene til en ISOLERT PostgreSQL som rolle `authenticated`: RLS, constraints og triggere er
//     PostgreSQLs egne. Dette er IKKE bekreftet Supabase/PostgREST/GoTrue-integrasjon (B6) — det er et eget kontrollpunkt hos eier før pilot;
//   * rettighetsavslag testes mot MIDLERTIDIGE KOPIER av appen med endret rettighetsprofil (produksjonskoden røres ikke); hva som ikke kan verifiseres i nettleser er listet i rapporten;
//   * demodataene fornyes gjennom datasettepoken (ECON-006e): ALLE servere kjører den uendrede appen med server-miljøvariabelen SCOUT_SYNTHETIC_EPOCH (hovedløp: nå − 1 t); kopiene brukes bare for endret rettighetsprofil.
//     Utløpt epoke, fremtidig epoke, ugyldig format og uten variabel (standardepoke) kjøres mot samme bygg og viser at utløpskontrollen er uendret og at epoken aldri justeres;
//   * annonsene er syntetiske demoannonser (ikke mobile.de). Forventede beløp = B-Merovo-scenario / fixturekonvensjon (se support/econ006-reference.mjs), ikke produksjonsregler;
//   * «foreldet» ved endret annonse-revisjon og endrede rettigheter simuleres ved å endre lagret rad i testdatabasen (annonsene i demoen endres ikke under kjøringen); dette er merket i sjekkene.
import { spawn, execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { connectBackend } from "./support/backend.mjs";
import { launchBrowser } from "./support/browser.mjs";
import { buildPatchedCopy } from "./support/patched-build.mjs";
import { defaultEpoch, epochIso, expectationForDefault, expiredEpoch, freshEpoch, labelFor } from "./support/synthetic-epoch.mjs";
import { FX_RATE, LISTINGS, TRANSPORT_NOK, expected, nok } from "./support/econ006-reference.mjs";
import { preflightTargets } from "./support/preflight.mjs";
import { j3Verdict } from "./support/request-observer.mjs";
preflightTargets(); // CI-001-FIX3: avvis manglende/ugyldig/ikke-lokal database og API FØR databaseklienten opprettes (null DB-kall før avslag)

const require = createRequire(import.meta.url);
const { Client } = require(process.env.PG ?? "pg");
const DB = process.env.SUPABASE_TEST_DB_URL;
const SHOTS = process.env.SHOTS || "reviews/ECON-006c/screenshots";
mkdirSync(SHOTS, { recursive: true });
const EMU_PORT = 54399, MAIN = 3100, FAILP = 3101, DENY_ECON = 3102, DENY_LID = 3103, STALE = 3104, UNSET = 3105, FUTURE = 3106, BADFMT = 3107;
const EPOCH = freshEpoch(), OLD_EPOCH = expiredEpoch();
const base = (p) => `http://localhost:${p}`;
const results = [];
const check = (name, ok, extra = "") => { results.push(`${ok ? "OK  " : "FEIL"} ${name}${ok || !extra ? "" : ` — ${extra}`}`); if (!ok) console.error(`FEIL ${name} — ${extra}`); };
const nb = (s) => s.replace(/ | /g, " ");
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (n) => iso(new Date(Date.now() + n * 864e5));
const PEPPER = "merovo-public-id-pepper-v1/ikke-hemmelig/kun-syntetiske-kilder"; // samme som den ikke-hemmelige syntetiske pepperen i public-ids.ts (kun syntetiske kilder)
const pidOf = (providerListingId) => `m1_${createHmac("sha256", PEPPER).update(`m1|${"synthetic-demo".length}:synthetic-demo|${providerListingId}`).digest().subarray(0, 18).toString("base64url")}`;
const scrub = (t) => t.replace(/Dette er ikke en budsjettvurdering\.[^\n]*/g, "").replace(/Innkjøpskostnad til Norge er ikke beregnet\.[^\n]*/g, ""); // standardforbeholdene nevner «innenfor budsjett» bare for å nekte det 
const POSITIVE_WORDS = /innenfor budsjett|innenfor avvik|under budsjett|budsjettreff|fullt treff|godkjent kjøp|anbefalt kjøp|lønnsomt|trygt å kjøpe/i;

const db = new Client({ connectionString: DB });
await db.connect();
const run = randomBytes(3).toString("hex");
async function mkUser(label) {
  const id = randomUUID(), email = `${label}-${run}@example.test`, password = randomBytes(18).toString("base64url");
  await db.query(`insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change)
    values ('00000000-0000-0000-0000-000000000000',$1,'authenticated','authenticated',$2,extensions.crypt($3,extensions.gen_salt('bf')),now(),'{"provider":"email"}','{}',now(),now(),'','','','')`, [id, email, password]);
  return { id, email, password };
}
const A = await mkUser("econ-a"), B = await mkUser("econ-b");
const firmA = (await db.query("select private.admin_create_dealership($1) id", [`ECON Firma A ${run}`])).rows[0].id;
const firmB = (await db.query("select private.admin_create_dealership($1) id", [`ECON Firma B ${run}`])).rows[0].id;
await db.query("select private.admin_add_member($1,$2)", [A.email, firmA]);
await db.query("select private.admin_add_member($1,$2)", [B.email, firmB]);

const emu = await connectBackend({ db, dbUrl: DB, users: [A, B], port: EMU_PORT, pgModulePath: process.env.PG ?? "pg", observe: true }); // emu.mode: "emulator" | "real"
const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: emu.url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: emu.publishableKey, NEXT_TELEMETRY_DISABLED: "1" };
delete env.SCOUT_SYNTHETIC_FAILURE; delete env.SCOUT_PUBLIC_ID_KEY;
env.SCOUT_ENABLE_LEGACY_ROUTES = "1";
const cleanups = [];
const servers = [];
// Aldri la servere eller midlertidige kopier bli igjen hvis oppsettet feiler før hovedløkken (ellers blir portene opptatt for neste kjøring).
process.on("exit", () => { for (const s of servers) { try { s.kill("SIGKILL"); } catch { /* allerede stoppet */ } } for (const c of cleanups) { try { c(); } catch { /* ignorer */ } } });
// 1) uendret app (repoets egen kode): kildefeil og FORELDET kildedata (demoens faste observasjonsdatoer er eldre enn oppbevaringstiden) — viser at beregningen feiler lukket
console.log("bygger uendret app mot testemulatoren …");
execFileSync("npm", ["run", "build"], { env, stdio: ["ignore", "ignore", "inherit"] });
async function startIn(cwd, port, extra = {}) {
  const p = spawn(`${cwd}/node_modules/.bin/next`, ["start", "-p", String(port)], { cwd, env: { ...env, ...extra }, stdio: ["ignore", "ignore", "inherit"] });
  servers.push(p);
  for (let i = 0; i < 80; i++) { try { const r = await fetch(`${base(port)}/login`); if (r.status < 500) return; } catch { /* venter */ } await new Promise((r) => setTimeout(r, 500)); }
  throw new Error(`appen på ${port} startet ikke`);
}
await startIn(process.cwd(), FAILP, { SCOUT_SYNTHETIC_FAILURE: "unavailable" });
await startIn(process.cwd(), STALE, { SCOUT_SYNTHETIC_EPOCH: OLD_EPOCH });   // uendret app, utløpt epoke (8 døgn tilbake)
await startIn(process.cwd(), UNSET, { SCOUT_SYNTHETIC_EPOCH: "" });          // uendret app, ingen variabel ⇒ innebygd standardepoke
await startIn(process.cwd(), FUTURE, { SCOUT_SYNTHETIC_EPOCH: epochIso(Date.now() + 3_600_000) });
await startIn(process.cwd(), BADFMT, { SCOUT_SYNTHETIC_EPOCH: "i morgen" });
// 2) hovedløpet: den UENDREDE appen med epoke nå − 1 t; kopier bare for endret rettighetsprofil
console.log(`starter hovedløpet (uendret app, SCOUT_SYNTHETIC_EPOCH=${EPOCH}) …`);
await startIn(process.cwd(), MAIN, { SCOUT_SYNTHETIC_EPOCH: EPOCH });
console.log("bygger kopi med nektet økonomivisning …");
const copyEcon = buildPatchedCopy({ root: process.cwd(), names: ["deny_economics_display"], env }); cleanups.push(copyEcon.cleanup);
await startIn(copyEcon.dir, DENY_ECON, { SCOUT_SYNTHETIC_EPOCH: EPOCH });
console.log("bygger kopi med nektet visning av leverandørens annonse-id …");
const copyLid = buildPatchedCopy({ root: process.cwd(), names: ["deny_listing_id"], env }); cleanups.push(copyLid.cleanup);
await startIn(copyLid.dir, DENY_LID, { SCOUT_SYNTHETIC_EPOCH: EPOCH });

const browser = await launchBrowser();
const problems = [];
const actionBodies = []; // svar fra server actions (RSC) — skannes for rå identitet
const watch = (page) => {
  page.on("pageerror", (e) => problems.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) problems.push("console: " + m.text()); });
  page.on("response", async (r) => { if (r.request().method() === "POST" && /dealer-input|economics-profile/.test(r.url())) { try { actionBodies.push({ url: r.url(), body: await r.text() }); } catch { /* strøm lukket */ } } });
};
async function login(ctx, u, port = MAIN) {
  const page = await ctx.newPage(); watch(page);
  await page.goto(`${base(port)}/login`);
  await page.fill('input[name="email"]', u.email);
  await page.fill('input[name="password"]', u.password);
  await Promise.all([page.waitForURL(/\/searches/), page.click('main button[type="submit"]')]);
  return page;
}
const shot = (page, name) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
const noHScroll = async (page, label) => { const w = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth })); check(`${label}: ingen horisontal rulling (${w.sw} ≤ ${w.iw})`, w.sw <= w.iw); };
async function must(page, selector, ms = 20000) {
  try { await page.waitForSelector(selector, { timeout: ms, state: "attached" }); } catch (e) {
    await page.screenshot({ path: `${SHOTS}/_feil.png`, fullPage: true }).catch(() => {});
    console.error(`TIDSAVBRUDD ${selector} på ${page.url()}\n${(await page.locator("body").innerText().catch(() => "")).slice(0, 1800)}`);
    throw e;
  }
}
const urls = (port, sid, v, pid) => ({ detail: `${base(port)}/searches/${sid}/preview/${pid}?v=${v}`, form: `${base(port)}/searches/${sid}/preview/${pid}/dealer-input?v=${v}`, preview: `${base(port)}/searches/${sid}/preview?v=${v}` });
const body = async (page) => nb(await page.locator("body").innerText());

// ---- skjema
async function setField(page, name, value) {
  const loc = page.locator(`[name="${name}"]`);
  if ((await loc.count()) === 0) throw new Error(`skjemafelt mangler: ${name}`);
  const tag = await loc.first().evaluate((e) => e.tagName);
  if (tag === "SELECT") await loc.first().selectOption(value); else await loc.first().fill(value);
}
async function fillForm(page, values) { for (const [k, v] of Object.entries(values)) await setField(page, k, v); }
const DATES = { today: addDays(0), yesterday: addDays(-1), soon: addDays(10), later: addDays(20) };
const commonValues = (over = {}) => ({
  prop_basis: "dealer_entered", tw_basis: "dealer_entered", fr_basis: "dealer_entered", fr_precision: "month",
  nr_date: DATES.soon, nr_kind: "expected", cd_kind: "expected_scenario", cd_date: DATES.today,
  fv_treatment: "excluded_documented", fv_evidence: "invoice_or_contract",
  fxA_pair: "EUR/NOK", fxA_rate: FX_RATE.replace(".", ","), fxA_source: "E2E-testkilde (ikke en offisiell kurs)", fxA_quotedAt: DATES.yesterday, fxA_validUntil: DATES.later,
  fxC_pair: "EUR/NOK", fxC_rate: FX_RATE.replace(".", ","), fxC_source: "E2E-testkilde (ikke en offisiell kurs)", fxC_quotedAt: DATES.yesterday, fxC_validFrom: DATES.yesterday, fxC_validTo: DATES.later,
  tb_amount: String(TRANSPORT_NOK), ins_amount: "0",
  ta_mode: "not_applicable", ta_note: "ingen transport etter innførselsstedet (test)", lh_mode: "not_applicable", lh_note: "ingen lasting/håndtering (test)",
  cg_mode: "not_applicable", cg_note: "ikke relevant (test)", rf_mode: "not_applicable", rf_note: "ikke relevant (test)",
  deduction: "non_recoverable", vatHandling: "registered_reports_in_vat_return", ...over,
});
// Kjøretøydata = fixtureinput fra de gyldne casene (ikke annonsens): diesel = CASE-003, PHEV = CASE-001, BEV = CASE-002.
const VEHICLE = {
  diesel: { prop_piston: "yes", prop_chargeable: "no", prop_fuel: "diesel", prop_hybrid: "none", tw_kg: "1976", co2_g: "179", co2_method: "wltp_combined", fr_value: "2023-11" },
  phev: { prop_piston: "yes", prop_chargeable: "yes", prop_fuel: "petrol", prop_hybrid: "", tw_kg: "2610", co2_g: "140", co2_method: "wltp_weighted_combined", fr_value: "2026-09" },
  bev: { prop_piston: "no", prop_chargeable: "yes", prop_fuel: "", prop_hybrid: "", tw_kg: "2185", co2_g: "0", co2_method: "wltp_combined", fr_value: "2023-08" },
};
const fullValues = (kind, over = {}) => commonValues({ ...VEHICLE[kind === "bev" ? "bev" : kind === "phev" ? "phev" : "diesel"], ...over });
async function confirmAndSubmit(page, { confirm = true } = {}) {
  if (confirm) await page.check('[data-testid="confirm"]');
  await page.click('[data-testid="dealer-form-submit"]');
}
async function saveForm(page, values, opts = {}) {
  await fillForm(page, values);
  await Promise.all([page.waitForURL(/msg=econ_saved/, { timeout: 30000 }).catch(async (e) => { await shot(page, "_feil"); console.error((await body(page)).slice(0, 1500)); throw e; }), confirmAndSubmit(page, opts)]);
}
async function econ(page) {
  const el = page.locator('[data-testid="economics"]').first();
  await el.waitFor({ timeout: 20000 });
  const attrs = await el.evaluate((e) => ({ status: e.getAttribute("data-economics-status"), label: e.getAttribute("data-economics-label"), positive: e.getAttribute("data-positive-budget") }));
  // PILOT-004A: sammendraget er den primære økonomiflaten; den gamle overskriften («Estimat — ikke validert: X») er fjernet fra detaljen. «headline» utledes nå av sammendraget: «Estimat: <total>».
  let headline = nb(await page.locator('[data-testid="economics-headline"]').first().innerText().catch(() => ""));
  if (headline === "") {
    const acq = await page.locator('[data-testid="acq-summary"]').first().getAttribute("data-acq-state").catch(() => null);
    const total = acq === "estimate" || acq === "partial" ? nb(await page.locator('[data-testid="acq-total"]').first().innerText()) : "";
    headline = acq === "estimate" ? `Estimat: ${total}` : acq === "partial" ? `Minst ${total} (ufullstendig)` : ""; // delsum ⇔ nedre grense (samme tall, samme betydning)
  }
  return { ...attrs, headline, text: nb(await el.innerText()) };
}
const dbInputs = async (firm) => (await db.query("select * from public.dealer_economics_inputs where dealership_id=$1 order by created_at", [firm])).rows;
const specOf = async (id) => (await db.query("select spec, version, dealership_id from public.search_drafts where id=$1", [id])).rows[0];
const rowNok = async (page, rowId) => { const t = nb(await page.locator(`tr[data-row="${rowId}"] td`).first().innerText().catch(() => "")); return t.split("\n")[0].trim(); };
const num = (s) => BigInt((s.match(/-?[\d ]+/)?.[0] ?? "").replace(/ /g, ""));
// rå identitet: kandidat-id-formatet (<lengde>:<kilde>/<id>) og revisjonsavtrykk skal aldri være i klientutdata; leverandørens egen annonse-id kan bare vises der visningsretten finnes
const CAND_ID_RE = /\d+:synthetic-demo\//;
const leaks = (text, providerId, { providerIdAllowed }) => [
  CAND_ID_RE.test(text) && "kandidat-id (<lengde>:synthetic-demo/…)", /rev\d*:[0-9a-f]{16}/.test(text) && "revisjonsavtrykk", /synthetic-demo\/[A-Za-z0-9_-]/.test(text) && "kilde/annonse-id",
  !providerIdAllowed && text.includes(providerId) && `leverandørens annonse-id ${providerId}`,
].filter(Boolean);

try {
  // =============================================================== oppsett: søk
  const ctxA = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const pA = await login(ctxA, A);
  async function createSearch(page, { transport } = {}) {
    await page.goto(`${base(MAIN)}/searches/new?example=demo-bmw`);
    if (!transport) await page.uncheck('input[name="cost.transport.use"]');
    else { await page.selectOption('select[name="cost.transport.currency"]', "NOK"); await page.fill('input[name="cost.transport.amount"]', transport); await page.selectOption('select[name="cost.transport.vat"]', "incl"); }
    await Promise.all([page.waitForURL(/\?msg=created/, { timeout: 30000 }), page.click('[data-testid="search-form"] button[type="submit"]')]);
    return page.url().match(/searches\/([0-9a-f-]{36})/)[1];
  }
  const S1 = await createSearch(pA);               // uten kostnadslinjer
  const S2 = await createSearch(pA, { transport: "12 000" }); // transport 12 000 kr NOK (til fordeling)
  check("oppsett: søk S1 (ingen kostnadslinjer) og S2 (transport 12 000 kr) lagret i firma A", (await specOf(S1)).spec.budget.costs.length === 0 && (await specOf(S2)).spec.budget.costs.some((c) => c.kind === "transport" && c.amountMinor === "1200000") && (await specOf(S1)).dealership_id === firmA);

  const D = { diesel: pidOf(LISTINGS.diesel.providerId), phev: pidOf(LISTINGS.phev.providerId), bev: pidOf(LISTINGS.bev.providerId), diesel2: pidOf(LISTINGS.diesel2.providerId), diesel3: pidOf(LISTINGS.diesel3.providerId), missing: pidOf(LISTINGS.missing.providerId) };

  // =============================================================== datasettepoke (ECON-006e): den uendrede appen, utløpskontrollen uendret
  {
    const ctxS = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const fresh = () => browser.newContext({ viewport: { width: 1280, height: 900 } }); // cookies deles mellom porter på localhost: egen context per server
    const detailOf = async (port) => { const pg = await login(await fresh(), A, port); await pg.goto(`${base(port)}/searches/${S1}/preview/${pidOf(LISTINGS.diesel.providerId)}?v=1`); return pg; };
    const pS = await detailOf(STALE);
    const eS = await econ(pS);
    check(`utløpt epoke (${OLD_EPOCH}, 8 døgn tilbake; uendret app): økonomien er «Ikke beregnet» med «kildedataene er for gamle» — ingen tall, ingen positivt utfall`, eS.status === "not_calculated" && eS.positive === "false" && /kildedataene er for gamle/.test(eS.text) && !/\d{3}\s?\d{3}\s?kr/.test(eS.text));
    check("merkingen følger epoken også når den er utløpt: «Syntetisk generert <dato> — ikke hentet fra leverandør»", nb(await pS.locator('[data-testid="layout-generated-label"]').innerText()).includes(labelFor(OLD_EPOCH)));
    await shot(pS, "00-utlopt-epoke");
    const pM = await login(await fresh(), A, MAIN);
    const labelM = nb(await pM.locator('[data-testid="layout-source-label"]').innerText());
    check(`hovedløpet (uendret app, epoke ${EPOCH}): merkingen «Syntetiske demodata – ikke ekte leverandørdata» og «${labelFor(EPOCH)}» er synlig`, labelM.includes("Syntetiske demodata – ikke ekte leverandørdata") && labelM.includes(labelFor(EPOCH)), labelM);
    for (const [port, what, epoch] of [[FUTURE, "fremtidig epoke (nå + 1 t; ingen toleranse, ingen justering)", "future"], [BADFMT, "ugyldig epoke («i morgen»)", "bad"]]) {
      const pg = await login(await fresh(), A, port);
      const r = await pg.goto(urls(port, S1, 1, D.diesel).form);
      const t = await body(pg);
      check(`${what}: kilden feiler lukket («Kilden kunne ikke leses»), uten skjema, uten økonomi og uten merking av ferske data`, /Kilden kunne ikke leses/.test(t) && (await pg.locator('[data-testid="dealer-form"]').count()) === 0 && (await pg.locator('[data-testid="layout-generated-label"]').count()) === 0 && !/\d{3}\s?\d{3}\s?kr/.test(t), `${epoch} ${r?.status()} ${t.slice(0, 120)}`);
    }
    const exp = expectationForDefault();
    const pU = await detailOf(UNSET);
    const eU = await econ(pU);
    const labelU = nb(await pU.locator('[data-testid="layout-generated-label"]').innerText().catch(() => ""));
    check(`uten SCOUT_SYNTHETIC_EPOCH brukes den innebygde standardepoken ${defaultEpoch()}: merkingen viser dens dato`, labelU.includes(labelFor(defaultEpoch())), labelU);
    if (exp === "fresh") check("standardepoken er ennå innenfor oppbevaringstiden: kildedataene er ikke «for gamle»", !/kildedataene er for gamle/.test(eU.text), eU.text.slice(0, 200));
    else if (exp === "expired") check("standardepoken er eldre enn 7 døgn: kildedataene er «for gamle» (data blir ikke evig ferske)", eU.status === "not_calculated" && /kildedataene er for gamle/.test(eU.text));
    else console.log("standardepoken er i overgangsfasen (5–7 døgn): utløp avhenger av annonsen; ingen sjekk av utløp");
    await ctxS.close();
  }

  // =============================================================== J1 forhåndsvisning: ingen økonomi uten bekreftede opplysninger
  await pA.goto(urls(MAIN, S1, 1, D.diesel).preview);
  await must(pA, `li[data-listing="${D.diesel}"]`);
  for (const k of ["diesel", "phev", "bev"]) {
    const card = pA.locator(`li[data-listing="${D[k]}"] [data-testid="economics"]`).first();
    const attrs = await card.evaluate((e) => ({ s: e.getAttribute("data-economics-status"), p: e.getAttribute("data-positive-budget"), t: e.textContent ?? "" })); // textContent: kortene kan ligge i en sammenfoldet gruppe (skjult)
    // PILOT-002: en nedre grense som sammendraget ikke støtter vises ikke som «Minst …»; kortet sier da bare «ikke beregnet» (sammendraget er «unavailable»). Aldri estimat.
    const acq = await pA.locator(`li[data-listing="${D[k]}"] [data-testid="acq-summary"]`).first().getAttribute("data-acq-state");
    check(`J1 ${k}: uten bekreftede opplysninger er kortet «ikke beregnet» eller «Minst … (ufullstendig)» (nedre grense), aldri estimat eller positivt budsjettutfall`, attrs.p === "false" && (attrs.s === "not_calculated" || (attrs.s === "lower_bound" && (acq === "unavailable" || /Minst .* \(ufullstendig\)/.test(nb(attrs.t))))), JSON.stringify({ ...attrs, acq }));
  }
  const prevText = await body(pA);
  check("J1: kostnad til Norge er ikke beregnet for budsjett; ingen budsjettspråk; syntetisk-etikett til stede", prevText.includes("innkjøpskostnad til Norge: ikke beregnet") && !POSITIVE_WORDS.test(scrub(prevText)) && /Syntetiske demodata/i.test(prevText), JSON.stringify({ a: prevText.includes("innkjøpskostnad til Norge: ikke beregnet"), b: POSITIVE_WORDS.exec(scrub(prevText))?.[0], c: /Syntetiske demodata/i.test(prevText) }));
  await shot(pA, "01-preview-uten-opplysninger");

  // =============================================================== J2 detalj: hva mangler → skjema
  await pA.goto(urls(MAIN, S1, 1, D.diesel).detail);
  let e = await econ(pA);
  check("J2 diesel: uten opplysninger er detaljen «Ikke beregnet» eller «Minst …» (nedre grense), aldri estimat; den tilbyr skjema og viser hva som mangler", ["not_calculated", "lower_bound"].includes(e.status) && e.positive === "false" && (await pA.locator('[data-testid="economics-missing-link"]').count()) >= 1 && (await pA.locator('[data-testid="dealer-form-link"]').count()) === 1, JSON.stringify({ s: e.status }));
  await shot(pA, "02-detalj-diesel-uten-opplysninger");
  await Promise.all([pA.waitForURL(/dealer-input/), pA.click('[data-testid="dealer-form-link"]')]);
  await must(pA, '[data-testid="dealer-form"]');
  const f0 = await body(pA);
  check("J2: skjemaet har introduksjon (tomt = ikke oppgitt), annonsens påstander merket «ikke dokumentasjon», og er helt tomt (ingenting forhåndsutfylt)",
    f0.includes("Tomt felt betyr «ikke oppgitt»") && f0.includes("Annonsens påstander (ikke dokumentasjon)")
    && (await pA.locator('[data-testid="dealer-form"] input[type="text"]').evaluateAll((els) => els.every((x) => x.value === ""))) && (await pA.locator('[data-testid="confirm"]').isChecked()) === false
    && (await pA.locator('[data-testid="dealer-form-prefill"]').count()) === 0);
  await shot(pA, "03-skjema-tomt");
  // klientutdata: ingen rå identitet i skjemaets DOM/props (kandidat-id og revisjon), og skjulte felt er bare de tre trygge
  const hidden = (await pA.locator('[data-testid="dealer-form"] input[type="hidden"]').evaluateAll((els) => els.map((x) => x.name))).filter((n) => !n.startsWith("$ACTION")).sort(); // $ACTION_*: rammeverkets egne felt for server actions
  check("lekkasje: skjemaet har bare skjulte felt searchId, listingId (opak m1_…) og bindingMarker — ingen candidateId/-Version/draftVersion", JSON.stringify(hidden) === JSON.stringify(["bindingMarker", "listingId", "searchId"]), JSON.stringify(hidden));
  const formHtml = await pA.locator('[data-testid="dealer-form"]').innerHTML();
  check("lekkasje: skjemaets HTML inneholder verken kandidat-id, revisjonsavtrykk eller leverandørens annonse-id", leaks(formHtml, LISTINGS.diesel.providerId, { providerIdAllowed: false }).length === 0, leaks(formHtml, LISTINGS.diesel.providerId, { providerIdAllowed: false }).join(", "));
  const ssr = await (await ctxA.request.get(urls(MAIN, S1, 1, D.diesel).form)).text();
  check("lekkasje: rå SSR-respons (inkl. RSC-nyttelast) for skjemasiden har ingen kandidat-id eller revisjonsavtrykk", leaks(ssr, LISTINGS.diesel.providerId, { providerIdAllowed: true }).length === 0, leaks(ssr, LISTINGS.diesel.providerId, { providerIdAllowed: true }).join(", "));
  check("lekkasje: skjemaets markør er opak (b1_ + 32 tegn)", /^b1_[A-Za-z0-9_-]{32}$/.test(await pA.locator('input[name="bindingMarker"]').inputValue()));

  // =============================================================== J4 ugyldig input (før gyldig lagring): feltfeil, ingenting lagret
  const before = (await dbInputs(firmA)).length;
  await fillForm(pA, { tw_kg: "1976,5", tw_basis: "dealer_entered", co2_g: "179", fr_precision: "month", fr_value: "2023-11-05", fr_basis: "dealer_entered", fxA_pair: "EUR/NOK", fxA_rate: "abc", tb_amount: "-5", ta_mode: "not_applicable" });
  await confirmAndSubmit(pA, { confirm: false });
  await must(pA, '[data-testid="error-summary"]');
  const errs = nb(await pA.locator('[data-testid="error-summary"]').innerText());
  check("J4: ugyldige verdier gir norske feltfeil (heltall, dato/presisjon, kurs, beløp, begrunnelse, metode, bekreftelse)", /Oppgi et helt tall/.test(errs) && /gyldig dato/.test(errs) && /kurs større enn 0/.test(errs) && /Oppgi et beløp/.test(errs) && /Må fylles ut/.test(errs), errs.slice(0, 500));
  check("J4: ingenting lagres ved feil, verdiene beholdes i skjemaet og fokus flyttes til feiloversikten",
    (await dbInputs(firmA)).length === before && (await pA.inputValue('[name="tw_kg"]')) === "1976,5" && (await pA.evaluate(() => !!document.activeElement?.querySelector?.('[data-testid="error-summary"]') || document.activeElement?.getAttribute?.("data-testid") === "error-summary")));
  check("J4: feilsvar fra serveren inneholder ingen rå identitet", actionBodies.every((b) => leaks(b.body, LISTINGS.diesel.providerId, { providerIdAllowed: false }).length === 0));
  await shot(pA, "04-skjema-feil");
  // gyldige felt, men ingen bekreftelse → avvist
  await pA.reload(); await must(pA, '[data-testid="dealer-form"]');
  await fillForm(pA, fullValues("diesel"));
  await confirmAndSubmit(pA, { confirm: false });
  await must(pA, '[data-testid="error-summary"]');
  check("J4: uten uttrykkelig bekreftelse lagres ingenting selv om alle felt er gyldige", /Bekreftelse/.test(await pA.locator('[data-testid="error-summary"]').innerText()) && (await dbInputs(firmA)).length === before);

  // =============================================================== J3 diesel: gyldig lagring → estimat
  await pA.reload(); await must(pA, '[data-testid="dealer-form"]');
  const exD = expected("diesel");
  await saveForm(pA, fullValues("diesel"));
  e = await econ(pA);
  check(`J3 diesel: «Estimat — ikke validert: ${nok(exD.cash)}» (B-Merovo/fixturekonvensjon), positivt budsjett false`, e.status === "estimate" && e.label === "estimate_not_validated" && e.positive === "false" && e.headline === `Estimat: ${nok(exD.cash)}`, `${e.status} | ${e.headline}`);
  { // ECON-003-2: når et beløp vises, må notisen ikke påstå «innkjøpskostnad ikke beregnet»; budsjettvurderingen er fortsatt ikke gjort
    const note = await pA.locator('[data-testid="budget-note"]').innerText();
    // Sjekknavnet er en CI-identitet (tests/ci-e2e-producers) og er beholdt uendret; betingelsen er oppdatert til den nye, ikke-motstridende notisen.
    check("J3: lagringsmelding vises, og budsjettnotatet er uendret (ikke beregnet)", (await pA.locator('[data-testid="econ-saved"]').count()) === 1 && note.includes("Budsjettvurdering er ikke gjort") && !note.includes("Innkjøpskostnad til Norge er ikke beregnet"));
  }
  if (e.status !== "estimate") console.error("J3 DEBUG:", e.text.slice(0, 1500));
  // PILOT-004A: totalen står én gang (sammendraget); forklaringen om kontantbetaling beholdes; «kostnad etter mva.-fradrag» vises bare når den avviker fra totalen.
  const acqTotal = nb(await pA.locator('[data-testid="acq-total"]').first().innerText({ timeout: 3000 }).catch(() => ""));
  check("J3: to summer (brutto utlegg og økonomisk kostnad) med forklaring av at brutto utlegg ikke nødvendigvis er kontantbetaling ved grensen", acqTotal.includes(nok(exD.cash)) && /ikke nødvendigvis/i.test(await pA.locator('[data-testid="economics-gross-explain"]').innerText()) && (await pA.locator('[data-testid="economics-cost-explain"]').count()) <= 1);
  check("J3: nedbrytningen stemmer med uavhengig utledede referanser (kjøpesum, mva.) og summerer til brutto utlegg",
    num(await rowNok(pA, "purchase")) === exD.purchase && num(await rowNok(pA, "import_vat")) === exD.vat
    && num(await rowNok(pA, "transport_to_border")) === BigInt(TRANSPORT_NOK)
    && num(await rowNok(pA, "one_off_tax")) + num(await rowNok(pA, "scrappage_deposit")) === exD.tax
    && num(await rowNok(pA, "purchase")) + num(await rowNok(pA, "transport_to_border")) + num(await rowNok(pA, "import_vat")) + num(await rowNok(pA, "one_off_tax")) + num(await rowNok(pA, "scrappage_deposit")) === exD.cash,
    JSON.stringify({ p: await rowNok(pA, "purchase"), v: await rowNok(pA, "import_vat") }));
  const ass = nb(await pA.locator('[data-testid="economics-assumptions"]').innerText());
  check("J3: forutsetninger viser kurs med kilde/dato og «Testkurs/forhandleroppgitt», regler ikke godkjent for validering, og ikke-rådgivning står i tillegg til usikkerhet",
    ass.includes("E2E-testkilde") && /må kontrolleres før kjøp/i.test(await pA.locator('[data-testid="economics-assumptions"]').innerText()) && (await pA.locator('[data-testid="economics-uncertainty"]').count()) === 1 && (await pA.locator('[data-testid="economics-not-advice"]').count()) === 1);
  check("J3: dokumentasjonsdekning er en konkret teller uten score, og annonsepåstand/forhandleroppgitt teller ikke som dokumentert", /0 av \d+/.test(nb(await pA.locator('[data-testid="economics-coverage"]').innerText())) && !/\d\s?%/.test(nb(await pA.locator('[data-testid="economics-basis-summary"]').innerText())));
  const dText = await body(pA);
  check("J3: ingen positivt budsjettspråk i estimatet", !POSITIVE_WORDS.test(scrub(dText)));
  await shot(pA, "05-detalj-diesel-estimat");
  const rows1 = await dbInputs(firmA);
  const r1 = rows1[0];
  check("J3 lagring: én rad bundet til firma A fra sesjon, kun forhandlerinput (ingen avledede tall), kandidat-id/revisjon utledet av serveren",
    rows1.length === 1 && r1.dealership_id === firmA && r1.search_id === S1 && r1.candidate_id.includes(LISTINGS.diesel.providerId) && r1.candidate_version.length > 8 && !/landed|cash|estimat|valueNok|importVat/i.test(JSON.stringify(r1.payload))
    && r1.payload.transportToBorder.amount === "8000" && r1.payload.deduction === "non_recoverable" && r1.payload.fx.acquisition.rate === FX_RATE && r1.confirmed_by === A.id);
  if (emu.log) {
    const writes = emu.log.filter((x) => (x.method === "POST" || x.method === "PATCH") && /dealer_economics/.test(x.path));
    check("J3: appen sendte aldri dealership_id i skrivekall for forhandlerinput (firma settes av databasen)", writes.length >= 1 && writes.every((x) => !(x.bodyKeys ?? []).includes("dealership_id")), JSON.stringify(writes.map((x) => x.bodyKeys)));
  }
  // Ekte modus: J3 kontrolleres av den observerende proxyen (se slutten av løpet, slik at ALLE skrivekall i hele løpet — også fra senere forløp og midlertidige bygg — er med).
  check("J3: ingen rå identitet i detalj-HTML (kandidat-id/revisjon) eller i serverens action-svar", leaks(await pA.content(), LISTINGS.diesel.providerId, { providerIdAllowed: true }).length === 0 && actionBodies.every((b) => leaks(b.body, LISTINGS.diesel.providerId, { providerIdAllowed: false }).length === 0));

  // =============================================================== gjenåpning
  await pA.goto(urls(MAIN, S1, 1, D.diesel).form);
  await must(pA, '[data-testid="dealer-form"]');
  const re = { tb: await pA.inputValue('[name="tb_amount"]'), fx: await pA.inputValue('[name="fxA_rate"]'), kg: await pA.inputValue('[name="tw_kg"]'), ded: await pA.inputValue('[name="deduction"]'), src: await pA.inputValue('[name="fxA_source"]') };
  check("gjenåpning: lagrede verdier er forhåndsutfylt (kurs vises med komma), men bekreftelsen er IKKE avkrysset og merknaden sier at ny bekreftelse kreves for å lagre",
    re.tb === "8000" && re.fx === "10,6709" && re.kg === "1976" && re.ded === "non_recoverable" && re.src.startsWith("E2E-testkilde") && (await pA.locator('[data-testid="confirm"]').isChecked()) === false
    && (await pA.locator('[data-testid="dealer-form-prefill"]').getAttribute("data-prefill")) === "current");
  await shot(pA, "06-skjema-gjenåpnet");

  // =============================================================== PHEV og BEV
  const exP = expected("phev");
  await pA.goto(urls(MAIN, S1, 1, D.phev).form); await must(pA, '[data-testid="dealer-form"]');
  await saveForm(pA, fullValues("phev"));
  e = await econ(pA);
  check(`J9 PHEV: «Estimat — ikke validert: ${nok(exP.cash)}» (CASE-001-avgifter, fixturekonvensjon), positivt false`, e.status === "estimate" && e.headline === `Estimat: ${nok(exP.cash)}` && e.positive === "false", `${e.status} | ${e.headline}`);
  check("J9 PHEV: kjøpesum og mva. stemmer med uavhengig utledning", num(await rowNok(pA, "purchase")) === exP.purchase && num(await rowNok(pA, "import_vat")) === exP.vat);
  await shot(pA, "07-detalj-phev-estimat");
  const exB = expected("bev");
  await pA.goto(urls(MAIN, S1, 1, D.bev).form); await must(pA, '[data-testid="dealer-form"]');
  await saveForm(pA, fullValues("bev"));
  e = await econ(pA);
  // PILOT-004A: scenariolisten står i sammendraget når «kostnad etter mva.-fradrag» er identisk med den (ellers i den separate listen).
  const bevLegacy = nb(await pA.locator('[data-testid="economics-scenarios"]').innerText().catch(() => ""));
  const bevList = bevLegacy !== "" ? bevLegacy : nb(await pA.locator('[data-testid="acq-scenarios"]').innerText().catch(() => ""));
  check(`J9 BEV: to merkede scenarioer (med/uten elbilfritak: ${nok(exB.cashWithExemption)} / ${nok(exB.cash)}), ikke ett tall; positivt false`, e.status === "scenarios" && e.positive === "false" && bevList.includes(nok(exB.cashWithExemption)) && bevList.includes(nok(exB.cash)), `${e.status} | ${bevList}`);
  const missB = await pA.locator('[data-testid="economics-missing-fields"]').innerText().catch(() => "");
  check("J9 BEV: EV-kvalifisering er ikke innsamlet og vises som «kan ikke registreres ennå» (ingen utvidelse av kjøretøyomfang), uten lenke", /EV|elbil/i.test(missB) && /kan ikke registreres ennå/.test(missB));
  await shot(pA, "08-detalj-bev-scenarioer");

  // =============================================================== forhåndsvisning etter lagring: alle kort uten positive utfall
  await pA.goto(urls(MAIN, S1, 1, D.diesel).preview); await must(pA, `li[data-listing="${D.diesel}"]`);
  const cardStates = await pA.locator("li[data-listing] [data-testid='economics']").evaluateAll((els) => els.map((x) => ({ s: x.getAttribute("data-economics-status"), p: x.getAttribute("data-positive-budget") })));
  const dieselCard = nb(await pA.locator(`li[data-listing="${D.diesel}"]`).evaluate((x) => x.textContent ?? ""));
  check("preview: kortene viser estimat/scenarier/ikke beregnet — ingen med positivt budsjettutfall; diesel-kortet viser estimatet merket «ikke validert»", cardStates.length >= 100 && cardStates.every((c) => c.p === "false") && cardStates.some((c) => c.s === "estimate") && cardStates.some((c) => c.s === "scenarios") && dieselCard.includes(nok(exD.cash)) && !/ikke validert/.test(dieselCard));
  const prev2 = await body(pA);
  check("preview: budsjettvurderingen er fortsatt «ikke beregnet» og uten positivt språk/varsel", prev2.includes("innkjøpskostnad til Norge: ikke beregnet") && !POSITIVE_WORDS.test(scrub(prev2)));
  await shot(pA, "09-preview-med-estimater");

  // =============================================================== manglende opplysninger (diesel3): delvis lagring → ikke estimat; hva mangler lenker til felt
  const pidM = D.missing;
  await pA.goto(urls(MAIN, S1, 1, pidM).form); await must(pA, '[data-testid="dealer-form"]');
  const partial = { ...VEHICLE.diesel, prop_basis: "dealer_entered", tw_basis: "dealer_entered", fr_precision: "month", fr_basis: "dealer_entered", deduction: "non_recoverable" }; // ingen transport, kurs, datoer, mva.-håndtering osv.
  await saveForm(pA, partial);
  e = await econ(pA);
  check("manglende opplysninger: delvis input gir IKKE estimat (nedre grense eller ikke beregnet), positivt false", ["lower_bound", "not_calculated"].includes(e.status) && e.positive === "false", `${e.status} | ${e.headline}`);
  if (e.status === "lower_bound" || e.status === "not_calculated") {
    const exp = await pA.locator('[data-testid="economics-missing-fields"]').innerText().catch(() => "");
    check("manglende opplysninger: «Hva mangler?» nevner registrerbare felt med lenke til skjemaet (ikke 0 eller dokumentert)", (await pA.locator('[data-testid="economics-missing-link"]').count()) >= 1 && exp.length > 0, exp.slice(0, 200));
    const tbRow = await pA.locator('tr[data-row="transport_to_border"]').first().evaluate((r) => ({ state: r.getAttribute("data-state"), t: r.innerText })).catch(() => null);
    check("manglende transport vises som ukjent (ikke 0)", tbRow === null || (tbRow.state === "unknown" && !/\b0 kr/.test(nb(tbRow.t))), JSON.stringify(tbRow));
    const firstLink = pA.locator('[data-testid="economics-missing-link"]').first();
    const href = await firstLink.getAttribute("href");
    await firstLink.click();
    await must(pA, '[data-testid="dealer-form"]');
    const anchor = (href ?? "").split("#")[1];
    check(`manglende opplysninger: lenken (${anchor}) fører til et faktisk skjemafelt`, !!anchor && (await pA.locator(`#${anchor}`).count()) === 1, href ?? "");
  }
  await shot(pA, "10-detalj-mangler");

  // =============================================================== utløpt kurs (diesel3: syn-096)
  await pA.goto(urls(MAIN, S1, 1, D.diesel3).form); await must(pA, '[data-testid="dealer-form"]');
  await saveForm(pA, fullValues("diesel", { fxA_validUntil: DATES.yesterday }));
  e = await econ(pA);
  const dinp = nb(await pA.locator('[data-testid="economics-dealer-input"]').innerText());
  check("J6 utløpt kurs: «må bekreftes på nytt» med årsak, og ingen tall fra den gamle bekreftelsen (ikke estimat)", e.status !== "estimate" && /må bekreftes på nytt/.test(dinp) && /kurs er utløpt/.test(dinp) && !e.text.includes(nok(expected("diesel3").cash)), `${e.status} | ${dinp}`);
  await pA.goto(urls(MAIN, S1, 1, D.diesel3).form); await must(pA, '[data-testid="dealer-form"]');
  const staleBox = nb(await pA.locator('[data-testid="dealer-form-stale"]').innerText().catch(() => ""));
  check("J6: skjemaet viser årsaken og er forhåndsutfylt til gjennomgang, bekreftelsen ikke avkrysset", /kurs er utløpt/.test(staleBox) && (await pA.inputValue('[name="fxA_rate"]')) === "10,6709" && (await pA.locator('[data-testid="confirm"]').isChecked()) === false);
  await shot(pA, "11-skjema-utløpt-kurs");
  await saveForm(pA, { fxA_validUntil: DATES.later });
  e = await econ(pA);
  check("J6: aktiv ny bekreftelse med gyldig kurs gir estimat igjen", e.status === "estimate" && e.headline === `Estimat: ${nok(expected("diesel3").cash)}`, `${e.status} | ${e.headline}`);

  // =============================================================== avrundingslikhet (diesel2): uavklart regel U-013 ⇒ nedre grense, aldri punktestimat
  {
    const exT = expected("diesel2");
    await pA.goto(urls(MAIN, S1, 1, D.diesel2).form); await must(pA, '[data-testid="dealer-form"]');
    await saveForm(pA, fullValues("diesel"));
    e = await econ(pA);
    check(`avrundingslikhet: fullt utfylt, men mva. havner nøyaktig på 50 øre (U-013 uavklart) ⇒ «Minst ${nok(exT.lowerBoundCash)} (ufullstendig)», ikke punktestimat; positivt false`, e.status === "lower_bound" && e.positive === "false" && e.headline === `Minst ${nok(exT.lowerBoundCash)} (ufullstendig)`, `${e.status} | ${e.headline}`);
    await shot(pA, "11b-avrundingslikhet");
  }

  // =============================================================== J7 foreldet: endret kostnadsgrunnlag i søket
  await pA.goto(`${base(MAIN)}/searches/${S1}`);
  await pA.fill('input[name="custom.0.label"]', "Vask og klargjøring");
  await pA.fill('input[name="custom.0.amount"]', "500");
  await pA.check('input[name="custom.0.included"]');
  await pA.selectOption('select[name="custom.0.vat"]', "incl");
  await Promise.all([pA.waitForURL(/\?msg=saved/, { timeout: 30000 }), pA.click('[data-testid="search-form"] button[type="submit"]')]);
  check("J7: søket endret via skjemaet (versjon 2)", (await specOf(S1)).version === 2);
  await pA.goto(urls(MAIN, S1, 2, D.diesel).detail);
  e = await econ(pA);
  const dinp2 = nb(await pA.locator('[data-testid="economics-dealer-input"]').innerText());
  check("J7: endret kostnadsgrunnlag ⇒ bekreftelsen er foreldet («må bekreftes på nytt: kostnadslinjene i søket er endret») og dieselestimatet vises ikke", e.status !== "estimate" && /kostnadslinjene i søket er endret/.test(dinp2) && !e.text.includes(nok(exD.cash)), `${e.status} | ${dinp2}`);
  await pA.goto(urls(MAIN, S1, 1, D.diesel).detail);
  check("J7: gammel søkeversjon (v=1) avvises med forklaring i stedet for å vise foreldede tall", (await pA.locator('[data-testid="stale-version"]').count()) === 1);
  await pA.goto(urls(MAIN, S1, 2, D.diesel).form); await must(pA, '[data-testid="dealer-form"]');
  check("J7: skjemaet viser årsaken, er forhåndsutfylt og krever aktiv ny bekreftelse", /kostnadslinjene i søket er endret/.test(nb(await pA.locator('[data-testid="dealer-form-stale"]').innerText())) && (await pA.inputValue('[name="tb_amount"]')) === "8000" && (await pA.locator('[data-testid="confirm"]').isChecked()) === false);
  await saveForm(pA, {});
  e = await econ(pA);
  check("J7: etter aktiv ny bekreftelse er estimatet tilbake (søkets tilleggslinje påvirker ikke kjernens tall)", e.status === "estimate" && e.headline === `Estimat: ${nok(exD.cash)}`, `${e.status} | ${e.headline}`);

  // simulert foreldelse (endring i testdatabasen — IKKE en brukerhandling): endrede rettigheter og ny annonserevisjon
  const row = (await dbInputs(firmA)).find((r) => r.candidate_id.includes(LISTINGS.phev.providerId));
  // Testdatabase-manipulasjon (ikke en brukerhandling). Oppdateringstriggeren setter confirmed_by := auth.uid() (NULL for superbruker) ved endret innhold, og en rad uten bekrefter leses som
  // «ikke brukbar» (fail-lukket: se egen kontroll nedenfor). For å simulere ren rettighetsendring slås triggeren av akkurat mens raden endres.
  const tamper = async (sql) => { await db.query("alter table public.dealer_economics_inputs disable trigger dealer_economics_inputs_before_update"); try { await db.query(sql, [row.id]); } finally { await db.query("alter table public.dealer_economics_inputs enable trigger dealer_economics_inputs_before_update"); } };
  await tamper("update public.dealer_economics_inputs set context = jsonb_set(context,'{rightsDigest}', to_jsonb(repeat('0',64))) where id=$1");
  await pA.goto(urls(MAIN, S1, 2, D.phev).detail);
  e = await econ(pA);
  check("J7 (simulert rettighetsendring i testdatabasen): «kildens rettigheter er endret» ⇒ må bekreftes på nytt, ingen estimat", e.status !== "estimate" && /kildens rettigheter er endret/.test(nb(await pA.locator('[data-testid="economics-dealer-input"]').innerText())), `${e.status} | ${nb(await pA.locator('[data-testid="economics-dealer-input"]').innerText())} | rad: ${JSON.stringify((await db.query("select search_id, candidate_version, context from public.dealer_economics_inputs where id=$1", [row.id])).rows[0])} | S1=${S1}`);
  // Databasen forbyr å endre nøkkelen (trigger: «dealer_input_immutable») — et ønsket vern. Simuleringen av en rad fra en eldre revisjon slår triggeren av midlertidig i testdatabasen.
  await tamper("update public.dealer_economics_inputs set candidate_version = 'gammel-revisjon-simulert' where id=$1");
  const immut = await db.query("update public.dealer_economics_inputs set candidate_version = 'x' where id=$1", [row.id]).then(() => false, (er) => /immutable/.test(er.message));
  // Fail-lukket: en bekreftelse uten bekrefter (confirmed_by NULL) leses ikke som tillit
  {
    const r2 = (await dbInputs(firmA)).find((r) => r.candidate_id.includes(LISTINGS.bev.providerId));
    await db.query("alter table public.dealer_economics_inputs disable trigger dealer_economics_inputs_before_update");
    try { await db.query("update public.dealer_economics_inputs set confirmed_by = null where id=$1", [r2.id]); } finally { await db.query("alter table public.dealer_economics_inputs enable trigger dealer_economics_inputs_before_update"); }
    await pA.goto(urls(MAIN, S1, 2, D.bev).detail);
    const eN = await econ(pA);
    check("fail-lukket: en lagret bekreftelse uten bekrefter (confirmed_by NULL) brukes ikke — ingen tall fra den, ingen delvis tillit", eN.status !== "scenarios" && eN.status !== "estimate" && !eN.text.includes(nok(exB.cash)), `${eN.status}`);
  }
  check("databasen forbyr å endre nøkkelen til en bekreftelse (kandidat/revisjon) — vern mot flytting av bekreftelser mellom revisjoner", immut);
  await pA.goto(urls(MAIN, S1, 2, D.phev).detail);
  e = await econ(pA);
  check("J7 (simulert ny annonserevisjon): bekreftelsen for gammel revisjon brukes ikke (ikke estimat)", e.status !== "estimate");
  await pA.goto(urls(MAIN, S1, 2, D.phev).form); await must(pA, '[data-testid="dealer-form"]');
  check("J7 (simulert ny revisjon): skjemaet forhåndsutfylles fra tidligere revisjon med tydelig merknad og krever ny bekreftelse", (await pA.locator('[data-testid="dealer-form-prefill"]').getAttribute("data-prefill", { timeout: 5000 }).catch(() => null)) === "previous_revision" && (await pA.inputValue('[name="tw_kg"]')) === "2610" && (await pA.locator('[data-testid="confirm"]').isChecked()) === false);
  await shot(pA, "12-skjema-forrige-revisjon");

  // =============================================================== omfang og fordeling (S2: transport 12 000 kr)
  await pA.goto(urls(MAIN, S2, 1, D.diesel).form); await must(pA, '[data-testid="dealer-form"]');
  check("omfang: transportlinjen i søket vises med beløp og valg (til/etter/fordelt), standard «Ikke bekreftet»", (await pA.locator('select[name="scope_transport"]').count()) === 1 && (await pA.inputValue('select[name="scope_transport"]')) === "");
  const nBefore = (await dbInputs(firmA)).length;
  await fillForm(pA, fullValues("diesel", { scope_transport: "split", scopeTo_transport: "10 000", scopeAfter_transport: "1 000" }));
  await confirmAndSubmit(pA);
  await must(pA, '[data-testid="error-summary"]');
  check("omfang: fordeling som ikke summerer til linjens beløp avvises med norsk feil, ingenting lagres", /summere nøyaktig/.test(await pA.locator('[data-testid="error-summary"]').innerText()) && (await dbInputs(firmA)).length === nBefore);
  await fillForm(pA, { scopeAfter_transport: "2 000" });
  await Promise.all([pA.waitForURL(/msg=econ_saved/, { timeout: 30000 }), confirmAndSubmit(pA)]);
  const split = (await dbInputs(firmA)).find((r) => r.search_id === S2).payload.lineScopes;
  check("omfang: korrekt fordeling lagres i øre som strenger (1 000 000 + 200 000 = 1 200 000)", JSON.stringify(split) === JSON.stringify({ transport: { split: { toBorderMinor: "1000000", afterBorderMinor: "200000" } } }), JSON.stringify(split));
  e = await econ(pA);
  check("omfang: vurderingen etter fordeling er fortsatt ikke et positivt budsjettutfall", e.positive === "false");

  // =============================================================== firmaprofil
  await pA.goto(`${base(MAIN)}/searches`);
  await Promise.all([pA.waitForURL(/economics-profile/), pA.click('[data-testid="economics-profile-link"]')]);
  await must(pA, '[data-testid="profile-form"]');
  check("profil: skjemaet er tomt (ingen standard) og forklarer at profilen aldri overstyrer bekreftede verdier", (await pA.inputValue('[name="p_deduction"]')) === "" && (await pA.inputValue('[name="p_vatHandling"]')) === "" && /overstyres aldri/.test(await pA.locator('[data-testid="profile-intro"]').innerText()));
  await pA.selectOption('[name="p_deduction"]', "recoverable");
  await pA.selectOption('[name="p_vatHandling"]', "registered_reports_in_vat_return");
  await pA.click('[data-testid="profile-submit"]');
  await must(pA, '[data-testid="profile-saved"]');
  const prof = (await db.query("select * from public.dealer_economics_profiles")).rows;
  check("profil: lagret for firma A fra sesjonen, bare standardene", prof.length === 1 && prof[0].dealership_id === firmA && prof[0].payload.schemaVersion === 1 && prof[0].payload.vatHandling === "registered_reports_in_vat_return" && prof[0].payload.deduction === "recoverable" && Object.keys(prof[0].payload).length === 3, JSON.stringify(prof));
  await pA.goto(`${base(MAIN)}/searches/economics-profile`);
  check("profil: gjenåpning viser lagrede standarder", (await pA.inputValue('[name="p_deduction"]')) === "recoverable");
  await shot(pA, "13-firmaprofil");
  // profilen gjelder bare der annonsen ikke har egen verdi: ny annonse uten egen fradragsverdi, og en med egen verdi som vinner
  await pA.goto(urls(MAIN, S1, 2, D.diesel).form); await must(pA, '[data-testid="dealer-form"]');
  await pA.selectOption('[name="deduction"]', "");
  await Promise.all([pA.waitForURL(/msg=econ_saved/, { timeout: 30000 }), confirmAndSubmit(pA)]);
  let assum = nb(await pA.locator('[data-testid="economics-assumptions"]').innerText());
  check("profil: uten egen verdi på annonsen gjelder profilens fradragsstatus (oppgitt av firmaprofil)", /fradrag oppgitt/.test(assum) && !/ikke fradrag oppgitt/.test(assum), assum.slice(0, 300));
  await pA.goto(urls(MAIN, S1, 2, D.diesel).form); await must(pA, '[data-testid="dealer-form"]');
  await pA.selectOption('[name="deduction"]', "non_recoverable");
  await Promise.all([pA.waitForURL(/msg=econ_saved/, { timeout: 30000 }), confirmAndSubmit(pA)]);
  assum = nb(await pA.locator('[data-testid="economics-assumptions"]').innerText());
  check("profil: annonsens egen bekreftede verdi vinner over profilen", /ikke fradrag oppgitt/.test(assum), assum.slice(0, 300));

  // =============================================================== bruker i annet firma
  const ctxB = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const pB = await login(ctxB, B);
  for (const [label, url] of [["detalj", urls(MAIN, S1, 2, D.diesel).detail], ["skjema", urls(MAIN, S1, 2, D.diesel).form], ["resultat", urls(MAIN, S1, 2, D.diesel).preview]]) {
    const r = await pB.goto(url);
    const t = await body(pB);
    check(`firmaskille: firma B får ikke se firma A sitt ${label} (ikke funnet, ingen økonomi eller skjema)`, (r?.status() === 404 || /ikke funnet|finnes ikke/i.test(t)) && !t.includes(nok(exD.cash)) && (await pB.locator('[data-testid="dealer-form"]').count()) === 0, `${r?.status()} ${t.slice(0, 120)}`);
  }
  await pB.goto(`${base(MAIN)}/searches/economics-profile`);
  check("firmaskille: firma B ser ikke firma A sin profil (tomt skjema)", (await pB.inputValue('[name="p_deduction"]')) === "" && (await pB.inputValue('[name="p_vatHandling"]')) === "");
  // B oppretter eget søk; samme annonse; A sine opplysninger finnes ikke her
  await pB.goto(`${base(MAIN)}/searches/new?example=demo-bmw`);
  await pB.uncheck('input[name="cost.transport.use"]');
  await Promise.all([pB.waitForURL(/\?msg=created/, { timeout: 30000 }), pB.click('[data-testid="search-form"] button[type="submit"]')]);
  const SB = pB.url().match(/searches\/([0-9a-f-]{36})/)[1];
  await pB.goto(urls(MAIN, SB, 1, D.diesel).detail);
  e = await econ(pB);
  check("firmaskille: samme annonse i firma B er «Ikke beregnet»/«Minst …» (nedre grense) uten A sine opplysninger — aldri A sitt estimat", ["not_calculated", "lower_bound"].includes(e.status) && e.positive === "false" && !e.text.includes(nok(exD.cash)) && !e.text.includes("E2E-testkilde"), `${e.status} ${e.headline}`);
  // manipulert binding i B sitt eget skjema: searchId → A sitt søk, falsk dealershipId, uten at noe lagres
  await pB.goto(urls(MAIN, SB, 1, D.diesel).form); await must(pB, '[data-testid="dealer-form"]');
  const nA = (await dbInputs(firmA)).length, nBdb = (await dbInputs(firmB)).length;
  await fillForm(pB, fullValues("diesel"));
  await pB.evaluate(([sid, firm]) => {
    const f = document.querySelector('[data-testid="dealer-form"]');
    f.querySelector('input[name="searchId"]').value = sid;
    const x = document.createElement("input"); x.type = "hidden"; x.name = "dealershipId"; x.value = firm; f.appendChild(x);
  }, [S1, firmA]);
  await confirmAndSubmit(pB);
  await must(pB, '[data-testid="error-summary"]');
  check("firmaskille: manipulert søk-id (A sitt søk) og forfalsket firma-id fra firma B avvises uten skriving", (await dbInputs(firmA)).length === nA && (await dbInputs(firmB)).length === nBdb && /Fant ikke/.test(await pB.locator('[data-testid="error-summary"]').innerText()));
  // manipulert markør / offentlig id i eget skjema
  await pB.goto(urls(MAIN, SB, 1, D.diesel).form); await must(pB, '[data-testid="dealer-form"]');
  await fillForm(pB, fullValues("diesel"));
  await pB.evaluate(() => { const m = document.querySelector('input[name="bindingMarker"]'); m.value = m.value.slice(0, -1) + (m.value.endsWith("A") ? "B" : "A"); });
  await confirmAndSubmit(pB);
  await must(pB, '[data-testid="error-summary"]');
  check("binding: manipulert konfliktmarkør avvises («endret») uten skriving", /endret/.test(await pB.locator('[data-testid="error-summary"]').innerText()) && (await dbInputs(firmB)).length === nBdb);
  await pB.goto(urls(MAIN, SB, 1, D.diesel).form); await must(pB, '[data-testid="dealer-form"]');
  await fillForm(pB, fullValues("diesel"));
  await pB.evaluate((pid) => { document.querySelector('input[name="listingId"]').value = pid; }, D.phev);
  await confirmAndSubmit(pB);
  await must(pB, '[data-testid="error-summary"]');
  check("binding: markør brukt mot en annen offentlig annonse-id avvises uten skriving", (await dbInputs(firmB)).length === nBdb);
  // gyldig innsending for B lagres under B
  await pB.goto(urls(MAIN, SB, 1, D.diesel).form); await must(pB, '[data-testid="dealer-form"]');
  await saveForm(pB, fullValues("diesel"));
  const bRows = await dbInputs(firmB);
  check("firmaskille: gyldig innsending fra firma B lagres under firma B (ikke A)", bRows.length === nBdb + 1 && bRows.every((r) => r.dealership_id === firmB) && (await dbInputs(firmA)).length === nA);
  check("firmaskille: ingen rå identitet i firma B sine action-svar eller sider", actionBodies.every((b) => leaks(b.body, LISTINGS.diesel.providerId, { providerIdAllowed: false }).length === 0));
  await ctxB.close();

  // =============================================================== rettighetsavslag og kildefeil (egne bygg)
  const ctxE = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const pE = await login(ctxE, A, DENY_ECON);
  await pE.goto(urls(DENY_ECON, S1, 2, D.diesel).preview); await must(pE, `li[data-listing="${D.diesel}"]`);
  const cardE = await pE.locator(`li[data-listing="${D.diesel}"] [data-testid="economics"]`).first().evaluate((x) => ({ s: x.getAttribute("data-economics-status"), p: x.getAttribute("data-positive-budget"), t: x.innerText }));
  check("rettighetsavslag (visning av økonomi nektet): kortet er «unavailable» uten tall, estimat eller årsaker — selv om A har en bekreftelse", cardE.s === "unavailable" && cardE.p === "false" && !/\d{3}\s?\d{3}/.test(nb(cardE.t)) && !nb(cardE.t).includes(nok(exD.cash)));
  await pE.goto(urls(DENY_ECON, S1, 2, D.diesel).detail);
  const tE = await body(pE);
  check("rettighetsavslag: detaljen viser ingen økonomi, ingen forklaring, ingen lenke til skjema", (await pE.locator('[data-testid="dealer-form-link"]').count()) === 0 && (await pE.locator('[data-testid="economics-breakdown"]').count()) === 0 && !tE.includes(nok(exD.cash)));
  await pE.goto(urls(DENY_ECON, S1, 2, D.diesel).form);
  check("rettighetsavslag: direkte URL til skjemaet viser «kan ikke vises», ingen skjema, ingen skjulte felt", (await pE.locator('[data-testid="dealer-form-unavailable"]').count()) === 1 && (await pE.locator('[data-testid="dealer-form"]').count()) === 0);
  await shot(pE, "14-rettighetsavslag");
  const ssrE = await (await ctxE.request.get(urls(DENY_ECON, S1, 2, D.diesel).form)).text();
  check("rettighetsavslag: SSR/RSC-nyttelast for skjemasiden har ingen markør, kandidat-id eller beløp", !/b1_[A-Za-z0-9_-]{32}/.test(ssrE) && leaks(ssrE, LISTINGS.diesel.providerId, { providerIdAllowed: true }).length === 0 && !ssrE.includes(String(exD.cash)));
  await ctxE.close();

  const ctxL = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const pL = await login(ctxL, A, DENY_LID);
  await pL.goto(urls(DENY_LID, S1, 2, D.diesel).detail);
  e = await econ(pL);
  const htmlL = await pL.content();
  check("listing_id nektet: økonomien vises fortsatt, men leverandørens annonse-id finnes ingen steder i detaljsiden (HTML + RSC)", e.status === "estimate" && !htmlL.includes(LISTINGS.diesel.providerId) && leaks(htmlL, LISTINGS.diesel.providerId, { providerIdAllowed: false }).length === 0, `${e.status} ${leaks(htmlL, LISTINGS.diesel.providerId, { providerIdAllowed: false })}`);
  await pL.goto(urls(DENY_LID, S1, 2, D.diesel).form); await must(pL, '[data-testid="dealer-form"]');
  const htmlLF = await pL.content();
  const ssrL = await (await ctxL.request.get(urls(DENY_LID, S1, 2, D.diesel).form)).text();
  check("listing_id nektet: skjemasiden (HTML, rå SSR/RSC, props) har ingen rå annonse-id, kandidat-id eller revisjon", leaks(htmlLF, LISTINGS.diesel.providerId, { providerIdAllowed: false }).length === 0 && leaks(ssrL, LISTINGS.diesel.providerId, { providerIdAllowed: false }).length === 0, `${leaks(htmlLF, LISTINGS.diesel.providerId, { providerIdAllowed: false })} ${leaks(ssrL, LISTINGS.diesel.providerId, { providerIdAllowed: false })}`);
  const nL = actionBodies.length;
  await fillForm(pL, { tb_amount: "9000" });
  await Promise.all([pL.waitForURL(/msg=econ_saved/, { timeout: 30000 }), confirmAndSubmit(pL)]);
  const rowL = (await dbInputs(firmA)).find((r) => r.search_id === S1 && r.candidate_id.includes(LISTINGS.diesel.providerId));
  check("listing_id nektet: gyldig innsending virker fortsatt (serveren kjenner identiteten), lagres under serverutledet nøkkel", rowL?.payload.transportToBorder.amount === "9000" && actionBodies.slice(nL).every((b) => leaks(b.body, LISTINGS.diesel.providerId, { providerIdAllowed: false }).length === 0), `${JSON.stringify(rowL?.payload?.transportToBorder)} ${JSON.stringify(actionBodies.slice(nL).map((b) => leaks(b.body, LISTINGS.diesel.providerId, { providerIdAllowed: false })))}`);
  await pL.goto(urls(DENY_LID, S1, 2, D.diesel).form); await must(pL, '[data-testid="dealer-form"]');
  await fillForm(pL, { tb_amount: "1" });
  await pL.evaluate(() => { const m = document.querySelector('input[name="bindingMarker"]'); m.value = "b1_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"; });
  await confirmAndSubmit(pL);
  await must(pL, '[data-testid="error-summary"]');
  check("listing_id nektet: feilsvar (manipulert markør) røper ingen identitet", actionBodies.slice(nL).every((b) => leaks(b.body, LISTINGS.diesel.providerId, { providerIdAllowed: false }).length === 0) && (await db.query("select payload->'transportToBorder'->>'amount' a from public.dealer_economics_inputs where id=$1", [rowL.id])).rows[0].a === "9000");
  await ctxL.close();

  const ctxF = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const pF = await login(ctxF, A, FAILP);
  const rF = await pF.goto(urls(FAILP, S1, 2, D.diesel).form);
  const tF = await body(pF);
  check("kildefeil: skjemasiden viser «kilden kunne ikke leses», uten skjema og uten økonomi", /Kilden kunne ikke leses/.test(tF) && (await pF.locator('[data-testid="dealer-form"]').count()) === 0 && !tF.includes(nok(exD.cash)), `${rF?.status()} ${tF.slice(0, 100)}`);
  await ctxF.close();

  // =============================================================== anonym og uten firma
  for (const url of [urls(MAIN, S1, 2, D.diesel).form, `${base(MAIN)}/searches/economics-profile`]) {
    const r = await fetch(url, { redirect: "manual" });
    check(`anonym: ${url.replace(/[0-9a-f-]{36}/, "<uuid>").replace(/m1_[\w-]+/, "m1_…").replace(/^http:\/\/localhost:\d+/, "")} omdirigeres til innlogging`, r.status >= 300 && r.status < 400, `status ${r.status}`);
  }

  // =============================================================== tastatur, mobil og skjermbilder
  await pA.goto(urls(MAIN, S1, 2, D.diesel3).form); await must(pA, '[data-testid="dealer-form"]');
  let reached = false, focusInfo = null;
  for (let i = 0; i < 400 && !reached; i++) {
    await pA.keyboard.press("Tab");
    const f = await pA.evaluate(() => { const x = document.activeElement; const cs = x ? getComputedStyle(x) : null; return { tag: x?.tagName, testid: x?.getAttribute?.("data-testid"), inForm: !!x?.closest?.('[data-testid="dealer-form"]'), outline: cs?.outlineStyle, width: cs?.outlineWidth }; });
    if (f.inForm && !focusInfo) focusInfo = f;
    if (f.testid === "dealer-form-submit") reached = true;
  }
  check("tastatur: skjemaets felt og «Bekreft og lagre» nås med Tab alene, og fokus har synlig markering", reached && focusInfo !== null && focusInfo.outline !== "none" && parseFloat(focusInfo.width) >= 2, JSON.stringify(focusInfo));
  const ctxM = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const pM = await login(ctxM, A);
  await pM.goto(urls(MAIN, S1, 2, D.diesel).form); await must(pM, '[data-testid="dealer-form"]');
  await noHScroll(pM, "mobil 390 px: forhandlerskjema");
  const smallTargets = await pM.locator('[data-testid="dealer-form"] input[type="text"], [data-testid="dealer-form"] select, [data-testid="dealer-form-submit"]').evaluateAll((els) => els.filter((x) => { const b = x.getBoundingClientRect(); return b.height > 0 && b.height < 40; }).length);
  check("mobil: skjemafeltene og knappen har treffflate ≥ 40 px høyde", smallTargets === 0, `${smallTargets} for små`);
  await shot(pM, "15-mobil-skjema");
  await pM.goto(urls(MAIN, S1, 2, D.diesel).detail); await econ(pM);
  await noHScroll(pM, "mobil 390 px: detalj med forklaring");
  await shot(pM, "16-mobil-detalj");
  await pM.goto(`${base(MAIN)}/searches/economics-profile`); await noHScroll(pM, "mobil 390 px: firmaprofil");
  await ctxM.close();

  check("ingen JavaScript-feil i konsollen under hele flyten", problems.length === 0, problems.slice(0, 3).join(" | "));
  check("alle action-svar (alle brukere og bygg) er fri for kandidat-id-format og revisjonsavtrykk", actionBodies.length > 10 && actionBodies.every((b) => !CAND_ID_RE.test(b.body) && !/rev\d*:[0-9a-f]{16}/.test(b.body)), `${actionBodies.length} svar`);
  if (emu.mode === "real") {
    // J3 i ekte modus: kroppen til alle skrivekall mot forhandlerinput/-profil gjennom hele løpet (filteret .eq("dealership_id") er ikke skriving). Feiler lukket (se request-observer.mjs).
    const v = emu.observer ? j3Verdict(emu.observer.summary()) : { ok: false, detail: "observatør mangler" };
    check("J3: appen sendte aldri dealership_id i skrivekall for forhandlerinput (firma settes av databasen)", v.ok, v.detail);
  } else if (emu.observer) {
    // Kryssjekk (bare med E2E_REQUEST_OBSERVER=1): observatøren og emulatorens egen logg skal se de samme skrivekallene (metode, tabell, nøkkelnavn).
    const norm = (a) => a.map((w) => `${w.method} ${w.table} ${w.keys.join(",")}`).sort();
    const fromEmu = emu.log.filter((x) => ["POST", "PATCH", "PUT", "DELETE"].includes(x.method) && /\/rest\/v1\/dealer_economics_(inputs|profiles)\/?(\?|$)/.test(x.path))
      .map((x) => ({ method: x.method, table: /dealer_economics_(inputs|profiles)/.exec(x.path)[0], keys: [...(x.bodyKeys ?? [])].sort() }));
    const sObs = emu.observer.summary();
    check("kryssjekk: observatøren og emulatorloggen ser de samme skrivekallene (metode, tabell, nøkkelnavn)", JSON.stringify(norm(sObs.writes)) === JSON.stringify(norm(fromEmu)) && sObs.writes.length > 0, `observatør ${sObs.writes.length} / emulator ${fromEmu.length}`);
    check("kryssjekk: observatørens J3-utfall er lik emulatorens", j3Verdict(sObs).ok === (fromEmu.length >= 1 && fromEmu.every((w) => !w.keys.includes("dealership_id"))));
  }
  await ctxA.close();
} finally {
  await browser.close().catch(() => {});
  for (const s of servers) s.kill("SIGTERM");
  for (const c of cleanups) c();
  await emu.cleanup({ firmIds: [firmA, firmB], users: [A, B] }).catch(() => {}); // bare ekte modus (emulatorens isolerte DB forkastes)
  await emu.close().catch(() => {});
  await db.query("delete from public.dealer_economics_inputs where dealership_id = any($1::uuid[])", [[firmA, firmB]]).catch(() => {});
  await db.query("delete from public.dealer_economics_profiles where dealership_id = any($1::uuid[])", [[firmA, firmB]]).catch(() => {});
  await db.query("delete from public.search_drafts where dealership_id = any($1::uuid[])", [[firmA, firmB]]).catch(() => {});
  await db.end().catch(() => {});
}
console.log(results.join("\n"));
const failed = results.filter((r) => r.startsWith("FEIL")), skipped = results.filter((r) => r.startsWith("HOPP"));
console.log(`\n${results.length - failed.length - skipped.length}/${results.length} sjekker OK${failed.length ? `, ${failed.length} FEIL` : ""}${skipped.length ? `, ${skipped.length} HOPPET (regnes IKKE som bestått — delvis dekning)` : ""} [modus: ${emu.mode}]`);
process.exit(failed.length ? 1 : skipped.length ? 4 : 0);

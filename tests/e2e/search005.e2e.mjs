// SEARCH-005: nettleserkontroll av hele søkeflyten (skjema → serversjekk → lagring → gjenåpning → syntetisk provider → forklarte resultater).
// Kjøring: bash scripts/test-e2e-search005.sh   (oppretter en isolert PostgreSQL-klynge, starter testemulatoren og appen, kjører denne filen)
// Miljø (satt av skriptet): PW (playwright), PG (pg-modul), SUPABASE_TEST_DB_URL (isolert lokal DB), SHOTS (skjermbildemappe).
// Emulatoren (tests/e2e/support/mini-supabase.mjs) er IKKE Supabase: den videresender app-kallene til isolert PostgreSQL som rolle
// `authenticated`. Skjermbilder og sjekker her viser app + ekte PostgreSQL-RLS, ikke ekte Auth/PostgREST.
import { spawn, execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { startMiniSupabase } from "./support/mini-supabase.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW);
const { Client } = require(process.env.PG);
const DB = process.env.SUPABASE_TEST_DB_URL;
const SHOTS = process.env.SHOTS || "reviews/SEARCH-005/screenshots";
mkdirSync(SHOTS, { recursive: true });
const EMU_PORT = 54399, APP_PORT = 3100, APP2_PORT = 3101;
const BASE = `http://localhost:${APP_PORT}`;
const results = [];
const check = (name, ok, extra = "") => { results.push(`${ok ? "OK  " : "FEIL"} ${name}${ok || !extra ? "" : ` — ${extra}`}`); };
const canon = (v) => (Array.isArray(v) ? v.map(canon) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v);
const sameJson = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
const nb = (s) => s.replace(/ /g, " ");

// ---- testdata: to firmaer og brukere med tilfeldige engangspassord (isolert testdatabase)
const db = new Client({ connectionString: DB });
await db.connect();
const run = randomBytes(3).toString("hex");
async function mkUser(label) {
  const id = randomUUID(), email = `${label}-${run}@example.test`, password = randomBytes(18).toString("base64url");
  await db.query(`insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change)
    values ('00000000-0000-0000-0000-000000000000',$1,'authenticated','authenticated',$2,extensions.crypt($3,extensions.gen_salt('bf')),now(),'{"provider":"email"}','{}',now(),now(),'','','','')`, [id, email, password]);
  return { id, email, password };
}
const A = await mkUser("e2e-a"), B = await mkUser("e2e-b"), L = await mkUser("e2e-loner");
const firmA = (await db.query("select private.admin_create_dealership($1) id", [`E2E Firma A ${run}`])).rows[0].id;
const firmB = (await db.query("select private.admin_create_dealership($1) id", [`E2E Firma B ${run}`])).rows[0].id;
await db.query("select private.admin_add_member($1,$2)", [A.email, firmA]);
await db.query("select private.admin_add_member($1,$2)", [B.email, firmB]);

const emu = await startMiniSupabase({ dbUrl: DB, users: [A, B, L], port: EMU_PORT, pgModulePath: process.env.PG });
const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: emu.url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-publishable-key-not-secret", NEXT_TELEMETRY_DISABLED: "1" };
delete env.SCOUT_SYNTHETIC_FAILURE;
// DEV-006G: denne flyten tester også at den eksisterende /agents-siden er uendret; eldre ruter er blokkert som standard og må aktiveres ved bygging.
// (Blokkeringen selv verifiseres av scripts/qa-partner-mode.sh.)
env.SCOUT_ENABLE_LEGACY_ROUTES = "1";
console.log("bygger appen mot testemulatoren …");
execFileSync("npm", ["run", "build"], { env, stdio: ["ignore", "ignore", "inherit"] });
const servers = [];
async function startApp(port, extra = {}) {
  const p = spawn("node_modules/.bin/next", ["start", "-p", String(port)], { env: { ...env, ...extra }, stdio: ["ignore", "ignore", "inherit"] });
  servers.push(p);
  for (let i = 0; i < 60; i++) { try { const r = await fetch(`http://localhost:${port}/login`); if (r.status < 500) return; } catch { /* venter */ } await new Promise((r) => setTimeout(r, 500)); }
  throw new Error("appen startet ikke");
}
await startApp(APP_PORT);
await startApp(APP2_PORT, { SCOUT_SYNTHETIC_FAILURE: "unavailable" });

const browser = await chromium.launch();
const problems = [];
const watch = (page) => {
  if (process.env.TRACE) { page.on("framenavigated", (f) => f === page.mainFrame() && console.error("NAV", f.url())); page.on("response", (r) => { if (r.request().method() !== "GET" || r.status() >= 300) console.error("RESP", r.request().method(), r.status(), r.url().slice(0, 100)); }); }
  page.on("pageerror", (e) => problems.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) problems.push("console: " + m.text()); });
};
async function login(ctx, u, base = BASE) {
  const page = await ctx.newPage(); watch(page);
  await page.goto(`${base}/login`);
  await page.fill('input[name="email"]', u.email);
  await page.fill('input[name="password"]', u.password);
  await Promise.all([page.waitForURL(/\/searches/), page.click('main button[type="submit"]')]);
  return page;
}
const noHScroll = async (page, label) => {
  const w = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  check(`${label}: ingen horisontal rulling (${w.sw} ≤ ${w.iw})`, w.sw <= w.iw);
};
// Venter på et element; ved tidsavbrudd lagres skjermbilde og sidetekst for feilsøking.
async function must(page, selector, ms = 15000) {
  try { await page.waitForSelector(selector, { timeout: ms }); } catch (e) {
    await page.screenshot({ path: `${SHOTS}/_feil.png`, fullPage: true }).catch(() => {});
    console.error(`TIDSAVBRUDD ${selector} på ${page.url()}\n${(await page.locator("body").innerText().catch(() => "")).slice(0, 1500)}`);
    throw e;
  }
}
// Klikker lagre og venter på omdirigering; ved tidsavbrudd skrives sidetekst og siste databasekall ut.
async function saveAndWait(page, urlRe, ms = 20000) {
  try { await Promise.all([page.waitForURL(urlRe, { timeout: ms }), page.click('[data-testid="search-form"] button[type="submit"]')]); } catch (e) {
    await page.screenshot({ path: `${SHOTS}/_feil.png`, fullPage: true }).catch(() => {});
    console.error(`LAGRING FEILET på ${page.url()}\n${(await page.locator("body").innerText().catch(() => "")).slice(0, 1500)}\nSISTE REST: ${JSON.stringify(emu.log.slice(-3))}`);
    throw e;
  }
}
// Klikker lagre og venter på feiloversikt med bestemt tekst (avvist lagring).
async function saveFail(page, text) {
  await page.click('[data-testid="search-form"] button[type="submit"]');
  try { await page.waitForFunction((x) => document.querySelector('[data-testid="error-summary"]')?.textContent?.includes(x), text, { timeout: 15000 }); } catch (e) {
    await page.screenshot({ path: `${SHOTS}/_feil.png`, fullPage: true }).catch(() => {});
    console.error(`FORVENTET FEIL «${text}» uteble på ${page.url()}\n${(await page.locator("body").innerText().catch(() => "")).slice(0, 1200)}`);
    throw e;
  }
}
const shot = (page, name) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
const specOf = async (id) => (await db.query("select spec, version, name, dealership_id from public.search_drafts where id=$1", [id])).rows[0];

try {
  // ===== anonym
  for (const path of ["/searches/new", `/searches/${randomUUID()}`]) {
    const r = await fetch(`${BASE}${path}`, { redirect: "manual" });
    check(`anonym ${path.replace(/[0-9a-f-]{36}/, "<uuid>")} omdirigeres`, r.status >= 300 && r.status < 400, `status ${r.status}`);
  }
  const anon = await (await fetch(`${BASE}/searches`)).text();
  check("anonym /searches ber om innlogging og viser ingen utkast", anon.includes("Logg inn") && !anon.includes("data-draft-id"));

  // ===== bruker uten firma
  const ctxL = await browser.newContext(); const pL = await login(ctxL, L);
  await pL.goto(`${BASE}/searches`);
  check("bruker uten firma får ikke lage søk", (await pL.content()).includes("Du må være innlogget med en firmakonto"));
  await ctxL.close();

  // ===== firma A, skrivebord
  const ctxA = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const pA = await login(ctxA, A);
  // ===== DEV-006E: innlogging i Merovo-skall, omdirigering til /searches, Merovo-«ikke funnet»
  check("DEV-006E: vellykket innlogging havner på /searches (ikke /agents)", /\/searches$/.test(pA.url()));
  await pA.goto(`${BASE}/login`);
  check("DEV-006E: allerede innlogget bruker på /login sendes til /searches", /\/searches$/.test(pA.url()));
  await pA.goto(`${BASE}/`);
  check("DEV-006F: rotruten / for innlogget bruker ender på /searches (via /login)", /\/searches$/.test(pA.url()));
  {
    const ctxL = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const pL = await ctxL.newPage(); watch(pL);
    await pL.goto(`${BASE}/login`);
    const t = nb(await pL.locator("body").innerText());
    check("DEV-006E: innloggingssiden i Merovo-skall: tagline, støttetekst, ingen Project Scout, ingen gult banner, ingen miljøvariabelnavn",
      nb(await pL.locator('[data-testid="tagline"]').innerText()) === "Local demand. European supply."
      && nb(await pL.locator('[data-testid="login-support"]').innerText()) === "Privat partnerdemo. Tilgang gis av Merovo; det finnes ingen åpen registrering."
      && !t.includes("Project Scout") && !/NEXT_PUBLIC|SUPABASE/.test(t) && (await pL.locator(".bg-amber-400").count()) === 0
      && (await pL.locator('img[alt="Merovo"]').count()) === 1 && !/\bAI\b|live|partnerskap|mobile\.de/i.test(t.replace("Privat partnerdemo.", "")));
    check("DEV-006E: skjemafeltene er uendret (e-post/passord, riktige autocomplete)",
      (await pL.locator('input[name="email"][type="email"][autocomplete="username"]').count()) === 1 && (await pL.locator('input[name="password"][type="password"][autocomplete="current-password"]').count()) === 1);
    await shot(pL, "16-login");
    await pL.fill('input[name="email"]', A.email); await pL.fill('input[name="password"]', "feil-passord-" + Date.now());
    await Promise.all([pL.waitForURL(/\/login\?error=1/), pL.click('main button[type="submit"]')]);
    check("DEV-006E: feil passord gir felles feilmelding i samme skall (ingen redirect til /searches)", (await pL.locator('[data-testid="login-error"]').innerText()).includes("Innloggingen mislyktes") && (await pL.locator('[data-testid="tagline"]').count()) === 1);
    await shot(pL, "17-login-feil");
    await pL.goto(`${BASE}/`);
    check("DEV-006F: rotruten / sender en anonym besøkende til /login (ikke /dashboard)", /\/login$/.test(pL.url()) && !(await pL.locator("body").innerText()).includes("Project Scout"));
    await ctxL.close();
    const ctxLM = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const pLM = await ctxLM.newPage(); watch(pLM);
    await pLM.goto(`${BASE}/login`);
    await noHScroll(pLM, "mobil: innlogging");
    await shot(pLM, "18-mobil-login");
    await ctxLM.close();
  }
  await pA.goto(`${BASE}/searches/00000000-0000-4000-8000-000000000000`);
  check("DEV-006E: ukjent søk i /searches viser Merovo-«ikke funnet» med lenke til /searches og uten Project Scout",
    (await pA.locator('[data-testid="searches-not-found"]').count()) === 1 && !(await pA.locator("body").innerText()).includes("Project Scout")
    && (await pA.locator('[data-testid="searches-not-found"] a[href="/searches"]').count()) === 1);
  await shot(pA, "19-ikke-funnet");
  await pA.goto(`${BASE}/agents`);
  check("eksisterende agentside har lenke til nye søk og er ellers uendret", await pA.locator('a[href="/searches"]').count() >= 1 && (await pA.content()).includes("Mine agenter"));
  await pA.goto(`${BASE}/searches`);
  check("oversikt: ingen utkast ennå, forklarer at utkast ikke er aktive agenter", (await pA.locator("body").innerText()).includes("ikke aktive agenter") && (await pA.locator("[data-draft-id]").count()) === 0);
  await shot(pA, "01-oversikt-tom");
  {
    const body = nb(await pA.locator("body").innerText());
    check("DEV-006D: Merovo-skall på /searches: ingen Project Scout-topp og ingen gult demobanner; merkelinje og fast etikett til stede",
      !body.includes("Project Scout") && (await pA.locator('[role="status"].bg-amber-400').count()) === 0
      && nb(await pA.locator('[data-testid="tagline"]').innerText()) === "Local demand. European supply."
      && nb(await pA.locator('[data-testid="tagline-explainer"]').innerText()) === "Forhandlere vet hvilke biler kundene vil ha. Merovo finner dem i Europa."
      && nb(await pA.locator('[data-testid="layout-source-label"]').innerText()).includes("Syntetiske demodata – ikke ekte leverandørdata"));
    const navLinks = (await pA.locator('nav[aria-label="Hovedmeny"] a').allInnerTexts()).map(nb);
    check("DEV-006D: navigasjonen i Merovo-skallet er begrenset til Søk og Nytt søk (ingen lenke til Mine agenter/Dashboard)",
      JSON.stringify(navLinks) === JSON.stringify(["Søk", "Nytt søk"]) && (await pA.locator('a[href^="/agents"], a[href^="/dashboard"]').count()) === 0);
    check("DEV-006D: flytstripen viser fire trinn og sier at den bare illustrerer modellen (ingen live kilder/avtaler)",
      (await pA.locator('[data-testid="flow-strip"] li').count()) === 4 && (await pA.locator('[data-testid="flow-strip"]').innerText()).includes("Ingen live kilder, ingen avtaler"));
  }

  // --- GLS-eksempel: ufullstendig skjema gir feil, ingenting lagres
  await pA.click('a[href="/searches/new?example=gls"]');
  await pA.waitForURL(/example=gls/);
  check("GLS-eksempel er forhåndsutfylt (merke, modell, seter 7–7, budsjett 750 000)",
    (await pA.inputValue('select[name="brand"]')) === "mercedes-benz" && (await pA.inputValue('select[name="model"]')) === "gls"
    && (await pA.inputValue('input[name="seatsMin"]')) === "7" && (await pA.inputValue('input[name="seatsMax"]')) === "7"
    && nb(await pA.inputValue('input[name="budgetMax"]')) === "750 000");
  check("GLS-eksempel: kilometerstand er ikke satt", (await pA.inputValue('input[name="maxMileageKm"]')) === "");
  await shot(pA, "02-skjema-gls-eksempel");
  await pA.click('[data-testid="search-form"] button[type="submit"]');
  await must(pA, '[data-testid="error-summary"]');
  const errText = await pA.locator('[data-testid="error-summary"]').innerText();
  check("valideringsfeil: prioritet for farger og registreringsscenario må velges uttrykkelig",
    errText.includes("Velg om dette er «Må ha» eller «Ønskelig»") && errText.includes("Velg planlagt norsk registrering"), errText.slice(0, 200));
  check("valideringsfeil: skjemaet beholder verdiene (merke/budsjett) og fokus flyttes til feiloversikten",
    (await pA.inputValue('select[name="brand"]')) === "mercedes-benz" && nb(await pA.inputValue('input[name="budgetMax"]')) === "750 000"
    && (await pA.evaluate(() => document.activeElement?.getAttribute("data-testid") ?? document.activeElement?.querySelector("[data-testid]")?.getAttribute("data-testid") ?? document.activeElement?.tagName)).length > 0);
  await shot(pA, "03-valideringsfeil");
  check("ingenting er lagret etter avvist skjema", (await db.query("select count(*)::int n from public.search_drafts where dealership_id=$1", [firmA])).rows[0].n === 0);

  // --- ugyldige verdier avvises (budsjett 0, avvik over 100, ugyldig dato)
  await pA.fill('input[name="budgetMax"]', "0");
  await pA.fill('input[name="budgetDeviation"]', "150");
  await pA.fill('input[name="regFrom"]', "2021-13");
  await pA.click('[data-testid="search-form"] button[type="submit"]');
  await pA.waitForFunction(() => document.querySelector('[data-testid="error-summary"]')?.textContent?.includes("Budsjettet må være større enn 0"), null, { timeout: 15000 });
  const errText2 = await pA.locator('[data-testid="error-summary"]').innerText();
  check("ugyldig budsjett 0, avvik 150 % og dato 2021-13 gir feltfeil", errText2.includes("Budsjettet må være større enn 0") && errText2.includes("Prisavviket må være 0–100 %") && errText2.includes("Skriv ÅÅÅÅ"), errText2.slice(0, 300));
  check("fortsatt ingenting lagret", (await db.query("select count(*)::int n from public.search_drafts where dealership_id=$1", [firmA])).rows[0].n === 0);

  // --- rett opp og lagre GLS-utkastet
  await pA.fill('input[name="budgetMax"]', "750 000");
  await pA.fill('input[name="budgetDeviation"]', "10");
  await pA.fill('input[name="regFrom"]', "");
  await pA.check('input[name="exteriorColorsPriority"][value="nice"]');
  await pA.check('input[name="plannedRegistration"][value="unspecified"]');
  await saveAndWait(pA, /\/searches\/[0-9a-f-]{36}\?msg=created/);
  const glsId = pA.url().match(/searches\/([0-9a-f-]{36})/)[1];
  check("GLS-utkast lagret (versjon 1, eget firma, bigint som streng i lagret dokument)", await (async () => {
    const r = await specOf(glsId);
    return r.version === 1 && r.dealership_id === firmA && r.spec.budget.maxTotal.amountMinor === "75000000" && r.spec.budget.deviationBasisPoints === 1000 && r.spec.plannedRegistration.requested === "unspecified"
      && r.spec.appearance.exteriorColors.priority === "nice" && r.spec.requirements.seats.min === 7 && r.spec.requirements.seats.max === 7 && r.spec.requirements.maxMileage === null;
  })());
  const sumText = nb(await pA.locator('[data-testid="spec-summary"]').innerText());
  check("sammendrag: kilometerstand vises som IKKE satt; grensen 825 000 kr er en grense og ikke et treff",
    /Ikke satt[\s\S]*Kilometerstand/.test(sumText) && sumText.includes("825 000") && sumText.includes("ikke et beregnet treff"), sumText.slice(0, 400));
  await shot(pA, "04-lagret-sok-gls");

  // --- forhåndsvisning av GLS
  await Promise.all([pA.waitForURL(/\/preview\?v=1/), pA.click('[data-testid="preview-link"]')]);
  const prev = nb(await pA.locator("body").innerText());
  check("GLS: ingen fullstendige treff, ærlig forklaring på hva demokilden mangler",
    (await pA.locator('[data-count="match"]').innerText()) === "0" && prev.includes("Ingen biler oppfyller alle kravene") && /Demokilden kan ikke oppgi:[^\n]*Modellår[^\n]*Antall seter/.test(prev), prev.slice(0, 600));
  check("GLS: viser at innkjøpskostnad til Norge ikke er beregnet; ingen total eller budsjettreff påstås",
    prev.includes("Innkjøpskostnad til Norge er ikke beregnet") && !/(^|\n)\s*(Innenfor budsjett|Innenfor avvik|Over budsjett|Budsjettreff|Fullt treff)/i.test(prev) && !/Total innkjøpskostnad[^.\n]*\d/.test(prev));
  check("GLS: resultatet sier at det beregnes nå og ikke lagres", prev.includes("lagres ikke") && prev.includes("lagret versjon 1"));
  check("GLS: dekning oppgis (alle vurdert, ikke avkortet)", (() => { const m = /Vurderte (\d+) av (\d+) annonser/.exec(prev); return !!m && m[1] === m[2] && Number(m[1]) >= 109; })() && prev.includes("Hele demokilden er hentet"));
  await shot(pA, "05-resultat-gls");
  await noHScroll(pA, "resultat GLS (skrivebord)");

  // --- demofixtur som gir treff
  await pA.goto(`${BASE}/searches/new?example=demo-bmw`);
  await saveAndWait(pA, /\?msg=created/);
  const bmwId = pA.url().match(/searches\/([0-9a-f-]{36})/)[1];
  const bmwDoc = await specOf(bmwId);
  check("demofixtur: ukjent EUR-kostnad lagret som ukjent (null) med valuta EUR, inkludert i budsjettet; fast id «transport»",
    bmwDoc.spec.budget.costs.length === 1 && bmwDoc.spec.budget.costs[0].id === "transport" && bmwDoc.spec.budget.costs[0].amountMinor === null && bmwDoc.spec.budget.costs[0].currency === "EUR" && bmwDoc.spec.budget.costs[0].includedInBudget === true);
  await Promise.all([pA.waitForURL(/\/preview\?v=1/), pA.click('[data-testid="preview-link"]')]);
  const m = Number(await pA.locator('[data-count="match"]').innerText()), nr = Number(await pA.locator('[data-count="needs_review"]').innerText()), ex = Number(await pA.locator('[data-count="excluded"]').innerText());
  check(`demofixtur: minst ett kjent treff og ett kjent kravbrudd (treff ${m}, må kontrolleres ${nr}, ikke oppfylt ${ex})`, m >= 1 && ex >= 1 && m + nr + ex >= 109);
  const firstMatch = pA.locator('li[data-status="match"]').first();
  const matchText = nb(await firstMatch.innerText());
  check("treff viser merke/modell, registrering, km, annonsepris med valuta og brutto/netto/ukjent", /BMW 3er/.test(matchText) && /Registrert/.test(matchText) && /Kilometerstand/.test(matchText) && /Annonsepris/.test(matchText) && /(kr|€|EUR)/.test(matchText) && /prisgrunnlag|oppgitt som/.test(matchText), matchText.slice(0, 300));
  check("treff: sier at innkjøpskostnad til Norge ikke er beregnet", matchText.includes("Innkjøpskostnad til Norge er ikke beregnet"));
  check("DEV-006C: kort viser etiketten «Syntetiske demodata – ikke ekte leverandørdata», hvorfor vist og kravs-/ønskesammendrag",
    nb(await firstMatch.locator('[data-testid="source-label"]').innerText()).toLowerCase().includes("syntetiske demodata – ikke ekte leverandørdata")
    && (await firstMatch.locator('[data-testid="why-shown"]').innerText()).includes("Alle krav er oppfylt")
    && /Ønsker:.*ønske/.test(nb(await firstMatch.locator('[data-testid="criteria-summary"]').innerText())));
  check("DEV-006C: ingen «sterkt treff»-status og ingen påstand om verifisert treff; kjent oppfylt ønske vises først i treffgruppen",
    !/sterkt treff|fullt treff/i.test(nb(await pA.locator("main").innerText())) && /1 av 2 ønsker oppfylt/.test(matchText));
  check("DEV-006C: gruppen «må kontrolleres» forklarer hva som må kontrolleres", /må kontrolleres hos kilden/.test(await pA.locator('li[data-status="needs_review"]').first().locator('[data-testid="why-shown"]').innerText()));
  await firstMatch.locator("summary").click();
  check("forklaring viser krav og ønsker", (await firstMatch.locator('[data-testid="explanation"]').innerText()).includes("Krav") && (await firstMatch.locator('[data-testid="explanation"]').innerText()).includes("Ønsker"));
  await shot(pA, "06-resultat-demofixtur");
  await pA.locator('[data-testid="excluded"] > summary').click();
  const exCard = pA.locator('[data-testid="excluded"] li[data-status="excluded"]').first();
  await exCard.locator("summary").click();
  const exText = nb(await exCard.innerText());
  check("ekskludert bil: forklaringen peker på kjent kravbrudd (Ikke oppfylt)", exText.includes("Ikke oppfylt") && exText.includes("Oppfyller ikke kravene"), exText.slice(0, 300));
  await shot(pA, "07-ekskluderte-med-forklaring");
  await firstMatch.locator('a:has-text("Se detaljer")').click();
  await pA.waitForSelector('[data-testid="detail-status"]');
  const det = nb(await pA.locator("body").innerText());
  check("detalj: syntetisk merking, ingen kilde-URL som lenke, ubetrodd tekst vist som tekst, ikke-beregnet kostnad",
    det.includes("Syntetisk demoannonse") && det.includes("Innkjøpskostnad til Norge er ikke beregnet") && (await pA.locator('a[href^="http"]').count()) === 0);
  await shot(pA, "08-detalj");

  // --- gjenåpne og endre: stabile kostnads-id-er, valuta/ukjent/0, datapresisjon, fritekstvariant
  await pA.goto(`${BASE}/searches/${bmwId}`);
  await pA.fill('input[name="regFrom"]', "2021-03");
  await pA.fill('input[name="variant"]', "320d xDrive touring ¤ ønsket tekst");
  await pA.fill('input[name="custom.0.label"]', "Vask og polering");
  await pA.fill('input[name="custom.0.amount"]', "0");
  await pA.selectOption('select[name="custom.0.currency"]', "EUR");
  await pA.check('input[name="custom.0.included"]');
  await pA.fill('input[name="custom.1.label"]', "Tilleggsutstyr");
  await pA.fill('input[name="custom.1.amount"]', "1 250,50");
  await pA.selectOption('select[name="custom.1.vat"]', "excl");
  await saveAndWait(pA, /\?msg=saved/);
  let d2 = await specOf(bmwId);
  const customs = d2.spec.budget.costs.filter((c) => c.kind === "custom");
  check("lagre → åpne → endre → lagre: versjon 2; 0 er 0 (ikke ukjent); valuta bevart; mva-grunnlag bevart",
    d2.version === 2 && customs.length === 2 && customs[0].amountMinor === "0" && customs[0].currency === "EUR" && customs[1].amountMinor === "125050" && customs[1].vatBasis === "excl" && customs[1].currency === "NOK");
  check("egne kostnadslinjer har varige id-er (c-<hex>), ikke posisjonsbaserte custom-<n>", customs.every((c) => /^c-[0-9a-f]{12}$/.test(c.id)) && customs[0].id !== customs[1].id);
  check("datapresisjon (måned) og fritekstvariant er bevart", sameJson(d2.spec.requirements.firstRegistration.from, { precision: "month", year: 2021, month: 3 }) && d2.spec.vehicle.variant === "320d xDrive touring ¤ ønsket tekst");
  const idsBefore = customs.map((c) => c.id);

  // slett første egne linje → den andre beholder sin id; ny linje får ny id
  await pA.goto(`${BASE}/searches/${bmwId}`);
  check("gjenåpnet skjema viser lagret rad med skjult id, uten at id vises som tekst", (await pA.inputValue('input[name="custom.0.id"]')) === idsBefore[0] && (await pA.inputValue('input[name="custom.1.id"]')) === idsBefore[1]);
  await pA.check('input[name="custom.0.remove"]');
  await pA.fill('input[name="custom.2.label"]', "Ny linje");
  await saveAndWait(pA, /\?msg=saved/);
  d2 = await specOf(bmwId);
  const c3 = d2.spec.budget.costs.filter((c) => c.kind === "custom");
  check("sletting/omrekkefølge: gjenværende linje beholder id; ny linje får ny id; slettet id gjenbrukes ikke",
    d2.version === 3 && c3.length === 2 && c3[0].id === idsBefore[1] && c3[0].amountMinor === "125050" && !idsBefore.includes(c3[1].id) && c3[1].amountMinor === null && c3[1].currency === "NOK");

  // ===== konflikt: to faner
  const pA2 = await ctxA.newPage(); watch(pA2);
  await pA2.goto(`${BASE}/searches/${bmwId}`);
  await pA.goto(`${BASE}/searches/${bmwId}`);
  await pA.fill('input[name="name"]', "Fane 1 vinner");
  await saveAndWait(pA, /\?msg=saved/);
  await pA2.fill('input[name="name"]', "Fane 2 taper");
  await pA2.fill('input[name="variant"]', "Tekst fra fane 2");
  await pA2.click('[data-testid="search-form"] button[type="submit"]');
  await must(pA2, '[data-testid="error-summary"]');
  const conflictText = await pA2.locator('[data-testid="error-summary"]').innerText();
  const afterConflict = await specOf(bmwId);
  check("foreldet versjon gir forståelig konflikt; vinneren overskrives ikke; taperens tekst beholdes i skjemaet",
    conflictText.includes("Søket er endret etter at du åpnet det") && afterConflict.name === "Fane 1 vinner" && afterConflict.version === 4
    && (await pA2.inputValue('input[name="name"]')) === "Fane 2 taper" && (await pA2.inputValue('input[name="variant"]')) === "Tekst fra fane 2");
  await shot(pA2, "09-konflikt");

  // foreldet forhåndsvisning
  await pA2.goto(`${BASE}/searches/${bmwId}/preview?v=2`);
  check("forhåndsvisning av foreldet versjon viser ingen resultater", (await pA2.locator('[data-testid="stale-version"]').count()) === 1 && (await pA2.locator("[data-listing]").count()) === 0);
  await pA2.close();

  // ===== SEARCH-005-FIX1: kostnadsvalg faller aldri stille bort (tom egen rad med bare valuta/mva./inkludering)
  await pA.goto(`${BASE}/searches/new?example=demo-bmw`);
  await pA.fill('input[name="name"]', "FIX1 kostnadsvalg");
  await pA.selectOption('select[name="custom.0.currency"]', "EUR");
  await saveFail(pA, "Gi kostnadslinjen en beskrivelse");
  check("FIX1: EUR uten beskrivelse gir feilen «Gi kostnadslinjen en beskrivelse» og ingenting lagres",
    (await db.query("select count(*)::int n from public.search_drafts where name=$1", ["FIX1 kostnadsvalg"])).rows[0].n === 0);
  check("FIX1: valgt EUR er beholdt i skjemaet etter avvist lagring", (await pA.inputValue('select[name="custom.0.currency"]')) === "EUR");
  await pA.selectOption('select[name="custom.1.vat"]', "incl");
  await pA.check('input[name="custom.1.included"]');
  await saveFail(pA, "Gi kostnadslinjen en beskrivelse");
  check("FIX1: mva.-grunnlag og «Inngår i budsjettet» uten beskrivelse gir også feil, og valgene beholdes",
    (await pA.inputValue('select[name="custom.1.vat"]')) === "incl" && (await pA.isChecked('input[name="custom.1.included"]')) && (await pA.inputValue('select[name="custom.0.currency"]')) === "EUR");
  await shot(pA, "14-fix1-kostnadsvalg-feil");
  await pA.fill('input[name="custom.0.label"]', "Tollagring");
  await pA.fill('input[name="custom.1.label"]', "Frakt hjem");
  await saveAndWait(pA, /\?msg=created/);
  const fixId = pA.url().match(/searches\/([0-9a-f-]{36})/)[1];
  const fx = (await specOf(fixId)).spec.budget.costs.filter((c) => c.kind === "custom");
  check("FIX1: etter beskrivelse lagres ukjent EUR (null) med valuta, og rad 2 med mva./budsjettvalg; stabile id-er",
    fx.length === 2 && fx[0].label === "Tollagring" && fx[0].currency === "EUR" && fx[0].amountMinor === null && fx[0].includedInBudget === false
    && fx[1].label === "Frakt hjem" && fx[1].vatBasis === "incl" && fx[1].includedInBudget === true && fx[1].currency === "NOK" && fx.every((c) => /^c-[0-9a-f]{12}$/.test(c.id)));
  await pA.goto(`${BASE}/searches/${fixId}`);
  check("FIX1: gjenåpnet skjema viser ukjent EUR (tomt beløp, EUR valgt)", (await pA.inputValue('input[name="custom.0.amount"]')) === "" && (await pA.inputValue('select[name="custom.0.currency"]')) === "EUR");
  // fast linje: feltene er avslått til linjen tas med; uttrykkelig deaktivering er fortsatt mulig
  check("FIX1: fast linje uten avkrysning har avslåtte felt og forklarende tekst", await pA.locator('input[name="cost.insurance.amount"]').isDisabled() && (await pA.locator('#h-cost\\.insurance').innerText()).includes("Linjen er ikke med"));
  await pA.check('input[name="cost.insurance.use"]');
  check("FIX1: avkrysning aktiverer feltene", !(await pA.locator('input[name="cost.insurance.amount"]').isDisabled()));
  await pA.fill('input[name="cost.insurance.amount"]', "99");
  await pA.uncheck('input[name="cost.insurance.use"]');
  check("FIX1: avhuking avslår feltene igjen (verdier sendes ikke)", await pA.locator('input[name="cost.insurance.amount"]').isDisabled());
  await saveAndWait(pA, /\?msg=saved/);
  check("FIX1: uttrykkelig deaktivering lagres uten feil (ingen forsikringslinje)", !(await specOf(fixId)).spec.budget.costs.some((c) => c.id === "insurance"));
  const verBefore = (await specOf(fixId)).version;
  // direkte post av fast linje uten avkrysning: feil i stedet for stille bortfall
  await pA.evaluate(() => { const f = document.querySelector('[data-testid="search-form"]'); const el = document.createElement("input"); el.type = "hidden"; el.name = "cost.travel.amount"; el.value = "123"; f.appendChild(el); });
  await saveFail(pA, "men linjen er ikke tatt med");
  check("FIX1: verdi på fast linje uten avkrysning (direkte post) gir feil og endrer ikke lagret søk", (await specOf(fixId)).version === verBefore);

  // ===== ulagrede endringer
  await pA.goto(`${BASE}/searches/${bmwId}`);
  await pA.fill('input[name="name"]', "Ulagret endring");
  check("ulagrede endringer: forhåndsvisning er skjult og bruker får beskjed", (await pA.locator('[data-testid="preview-link"]').count()) === 0 && (await pA.locator('[data-testid="dirty-note"]').count()) === 1);

  // ===== kildefeil (egen appinstans med simulert feil) og tastatur
  const ctxA2 = await browser.newContext(); const pF = await login(ctxA2, A, `http://localhost:${APP2_PORT}`);
  await pF.goto(`http://localhost:${APP2_PORT}/searches/${bmwId}/preview?v=4`);
  const fe = nb(await pF.locator("body").innerText());
  check("kildefeil: tydelig melding, ingen resultater, ingen påstand om dekning", (await pF.locator('[data-testid="source-error"]').count()) === 1 && fe.includes("Kilden er utilgjengelig") && (await pF.locator("[data-listing]").count()) === 0 && !fe.includes("Hele demokilden er hentet"));
  await shot(pF, "10-kildefeil");
  await ctxA2.close();

  // ===== to firmaer: B ser ikke A
  const ctxB = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const pB = await login(ctxB, B);
  await pB.goto(`${BASE}/searches`);
  const bList = await pB.content();
  check("firma B ser ingen av firma A sine utkast", !bList.includes(glsId) && !bList.includes(bmwId) && !bList.includes("Fane 1 vinner"));
  for (const path of [`/searches/${bmwId}`, `/searches/${bmwId}/preview?v=4`, `/searches/${bmwId}/preview/syn-005?v=4`]) {
    const res = await pB.goto(`${BASE}${path}`);
    check(`firma B: ${path.replace(bmwId, "<A-id>")} gir 404`, res.status() === 404, `status ${res.status()}`);
  }
  // B oppretter eget utkast; manipulert skjema med fremmed id/firma ignoreres
  await pB.goto(`${BASE}/searches/new?example=demo-bmw`);
  await pB.evaluate(([bid, firm]) => {
    const f = document.querySelector('[data-testid="search-form"]');
    for (const [n, v] of [["id", bid], ["expectedVersion", "4"], ["dealership_id", firm], ["version", "99"], ["active", "true"]]) {
      let el = f.querySelector(`input[name="${n}"]`);
      if (!el) { el = document.createElement("input"); el.type = "hidden"; el.name = n; f.appendChild(el); }
      el.value = v;
    }
  }, [bmwId, firmA]);
  await pB.click('[data-testid="search-form"] button[type="submit"]');
  await must(pB, '[data-testid="error-summary"]');
  const afterB = await specOf(bmwId);
  check("firma B kan ikke overskrive A sitt utkast via manipulert id/versjon (avvist, A uendret)", afterB.name === "Fane 1 vinner" && afterB.version === 4 && afterB.dealership_id === firmA);
  await pB.goto(`${BASE}/searches/new?example=demo-bmw`);
  await pB.evaluate((firm) => { const f = document.querySelector('[data-testid="search-form"]'); for (const [n, v] of [["dealership_id", firm], ["version", "99"], ["active", "true"]]) { const el = document.createElement("input"); el.type = "hidden"; el.name = n; el.value = v; f.appendChild(el); } }, firmA);
  await saveAndWait(pB, /\?msg=created/);
  const bId = pB.url().match(/searches\/([0-9a-f-]{36})/)[1];
  const bRow = await specOf(bId);
  check("nytt utkast i firma B: firma fra membership (ikke skjemafeltet), versjon 1, ikke aktiv-felt", bRow.dealership_id === firmB && bRow.version === 1);
  check("appen sendte aldri dealership_id i skrivekall mot databasen", emu.log.some((e) => e.method === "POST") && !emu.log.some((e) => (e.method === "POST" || e.method === "PATCH") && (e.bodyKeys ?? []).some((k) => !["name", "spec", "base_version"].includes(k))));
  await ctxB.close();

  // ===== tastatur og fokus (skrivebord)
  await pA.goto(`${BASE}/searches/new`);
  // Tab gjennom siden til fokus kommer inn i den nye søkeflaten, og videre til lagre-knappen.
  let focus = null, reachedSave = false, inside = 0;
  for (let i = 0; i < 400 && !reachedSave; i++) {
    await pA.keyboard.press("Tab");
    const f = await pA.evaluate(() => { const e = document.activeElement; const cs = e ? getComputedStyle(e) : null; return { tag: e?.tagName, inScope: Boolean(e?.closest(".merovo-scope")), text: (e?.textContent ?? "").trim().slice(0, 30), outline: cs?.outlineStyle, width: cs?.outlineWidth }; });
    if (f.inScope) { inside++; focus ??= f; }
    if (f.tag === "BUTTON" && f.text.startsWith("Lagre")) reachedSave = true;
  }
  check("tastatur: fokus i søkeflaten har synlig markering (≥ 2 px)", focus !== null && focus.outline !== "none" && parseFloat(focus.width) >= 2, JSON.stringify(focus));
  check(`tastatur: lagre-knappen kan nås med Tab alene (${inside} stopp i søkeflaten)`, reachedSave);
  await shot(pA, "11-skjema-tomt");
  await noHScroll(pA, "skjema (skrivebord)");
  await ctxA.close();

  // ===== mobil
  const ctxM = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const pM = await login(ctxM, A);
  await pM.goto(`${BASE}/searches/${bmwId}`);
  await noHScroll(pM, "mobil: lagret søk/skjema");
  await shot(pM, "12-mobil-skjema");
  await pM.goto(`${BASE}/searches/${bmwId}/preview?v=${afterConflict.version}`);
  await noHScroll(pM, "mobil: resultat");
  await shot(pM, "13-mobil-resultat");
  const btn = await pM.locator('button[type="submit"], a:has-text("Se detaljer")').first().boundingBox();
  check("mobil: handlinger er synlige og ikke tildekket (første handlingsknapp i viewport-bredde)", btn !== null && btn.x >= 0 && btn.x + btn.width <= 390);
  await pM.goto(`${BASE}/searches`);
  await noHScroll(pM, "mobil: oversikt");
  await shot(pM, "15-mobil-oversikt");
  await ctxM.close();

  check("ingen JavaScript-feil i konsollen under hele flyten", problems.length === 0, problems.slice(0, 3).join(" | "));
} finally {
  await browser.close();
  for (const s of servers) s.kill("SIGTERM");
  await emu.close();
  await db.query("delete from public.search_drafts where dealership_id = any($1::uuid[])", [[firmA, firmB]]).catch(() => {});
  await db.end().catch(() => {});
}
console.log(results.join("\n"));
const failed = results.filter((r) => r.startsWith("FEIL"));
console.log(`\n${results.length - failed.length}/${results.length} sjekker OK${failed.length ? `, ${failed.length} FEIL` : ""}`);
process.exit(failed.length ? 1 : 0);

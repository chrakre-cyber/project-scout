// Ende-til-ende for DEV-004 mot LOKAL Supabase + `next start -p 3100` (bygget med .env.local mot lokal stack).
// Kjøring: PW=<sti til playwright> PG=$PWD/node_modules/pg DB_URL=<lokal DB_URL> node tests/e2e/dev004-agents.e2e.mjs [skjermbildemappe]
// Testbrukere med tilfeldige passord opprettes i lokal DB og slettes etterpå. Ingen service-role.
import { createRequire } from "node:module";
import { randomBytes, randomUUID } from "node:crypto";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW);
const { Client } = require(process.env.PG);
const BASE = "http://localhost:3100";
const FIRM_A = "00000000-0000-4000-a000-00000000000a", FIRM_B = "00000000-0000-4000-a000-00000000000b";
const out = process.argv[2];
const db = new Client({ connectionString: process.env.DB_URL }); await db.connect();
const run = randomBytes(3).toString("hex");
const READY = {
  filters: { make: "Volkswagen" },
  assumptions: {
    retail: { expectedRetailTotal: { amountMinor: "39990000", currency: "NOK" }, priceBasis: { vat: "included", registrationTaxes: "included" } },
    minimumContribution: { amountMinor: "3000000", currency: "NOK" },
    preparationReserve: { amount: { amountMinor: "1500000", currency: "NOK" }, vatBasis: "ex_vat" },
  },
};
async function user(label) {
  const id = randomUUID(), email = `${label}-${run}@example.test`, password = randomBytes(18).toString("base64url");
  await db.query(`insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change)
    values ('00000000-0000-0000-0000-000000000000',$1,'authenticated','authenticated',$2,extensions.crypt($3,extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','')`, [id, email, password]);
  await db.query(`insert into auth.identities (provider_id,user_id,identity_data,provider,created_at,updated_at) values ($1::text,$2::uuid,jsonb_build_object('sub',$1::text,'email',$3::text),'email',now(),now())`, [id, id, email]);
  return { id, email, password };
}
const A = await user("e2e4-a"), B = await user("e2e4-b");
await db.query("select private.admin_add_member($1,$2)", [A.email, FIRM_A]);
await db.query("select private.admin_add_member($1,$2)", [B.email, FIRM_B]);
const bAgent = (await db.query("insert into public.search_agents (dealership_id,name,filters,assumptions) values ($1,$2,$3,$4) returning id",
  [FIRM_B, `B-agent ${run}`, READY.filters, READY.assumptions])).rows[0].id;
const results = [];
const check = (name, ok, extra = "") => results.push(`${ok ? "OK  " : "FEIL"} ${name}${ok || !extra ? "" : ` — ${extra}`}`);
const row = async (name) => (await db.query("select id, active, version, dealership_id, name, filters, assumptions from public.search_agents where name = $1", [name])).rows[0];
const browser = await chromium.launch();
const errors = [];
const page = await browser.newPage();
page.on("pageerror", (e) => errors.push(e.message));
const text = async () => (await page.content()).replace(/<!-- -->/g, "");
const card = (name) => page.locator("li[data-agent-id]", { hasText: name });
async function login(u) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', u.email);
  await page.fill('input[name="password"]', u.password);
  await Promise.all([page.waitForURL(/\/agents/), page.click('button[type="submit"]')]);
}
async function clickAndWait(locator, url) { await Promise.all([page.waitForURL(url), locator.click()]); }
const N1 = `Golf ${run}`, N2 = `Bred SUV ${run}`;
try {
  await login(A);
  check("innlogget A ser 0 av maks 10 aktive", (await text()).includes("0 av maks 10 aktive"));

  // 1–4: opprett med ugyldige verdier → feilmeldinger, verdier beholdes
  await page.goto(`${BASE}/agents/new`);
  await page.fill('input[name="name"]', N1);
  await page.fill('input[name="make"]', "Volkswagen");
  await page.fill('input[name="model"]', "Golf");
  await page.fill('input[name="yearMin"]', "2024");
  await page.fill('input[name="yearMax"]', "2020");
  await page.fill('input[name="maxPriceAmount"]', "35 000");
  await page.fill('input[name="minimumContribution"]', "0");
  await page.click('button:has-text("Lagre")');
  await page.waitForSelector("text=Agenten ble ikke lagret"); // ikke [role=alert]: Next sin route-announcer har også den rollen
  const t1 = await text();
  check("ugyldig skjema gir feltfeil (år, valuta, bidrag) og lagrer ikke",
    t1.includes("Til-år kan ikke være før fra-år") && t1.includes("Velg valuta for maks annonsepris") && t1.includes("større enn 0") && !(await row(N1)),
    (await page.locator("main").innerText()).split("\n").filter((l) => /må|Velg|kan ikke|Ugyldig|ikke lagret/.test(l)).join(" | "));
  check("innfylte verdier beholdes etter feil", (await page.inputValue('input[name="model"]')) === "Golf" && (await page.inputValue('input[name="yearMin"]')) === "2024");

  await page.fill('input[name="yearMax"]', "2024");
  await page.selectOption('select[name="maxPriceCurrency"]', "EUR");
  await page.check('input[name="fuels"][value="petrol"]');
  await page.check('input[name="bodyTypes"][value="estate"]');
  await page.check('input[name="countryCodes"][value="DE"]');
  await page.fill('input[name="retailAmount"]', "399 900");
  await page.check('input[name="retailVat"][value="included"]');
  await page.check('input[name="retailRegistrationTaxes"][value="included"]');
  await page.fill('input[name="minimumContribution"]', "30 000");
  await page.fill('input[name="reserveAmount"]', "0");
  await page.check('input[name="reserveVatBasis"][value="ex_vat"]');
  await page.click('button:has-text("Lagre")');
  try { await page.waitForURL(/\/agents\?msg=saved/, { timeout: 10000 }); }
  catch { throw new Error("lagring feilet: " + (await page.locator("main").innerText()).split("\n").filter((l) => /må|Velg|kan ikke|Ugyldig|ikke lagret|feilet|avvist/.test(l)).join(" | ")); }
  let r = await row(N1);
  check("gyldig agent lagret i firma A, ikke aktiv, v1, reserve 0 kr som tekst",
    r && r.dealership_id === FIRM_A && !r.active && r.version === 1 && r.assumptions.preparationReserve.amount.amountMinor === "0", JSON.stringify(r?.assumptions));
  check("kortet viser «Ikke aktiv» og «Klar for aktivering»", (await card(N1).textContent()).includes("Ikke aktiv") && (await card(N1).textContent()).includes("Klar for aktivering"));

  // Bredt søk uten bekreftelse → kan ikke aktiveres
  await page.goto(`${BASE}/agents/new`);
  await page.fill('input[name="name"]', N2);
  await page.check('input[name="bodyTypes"][value="suv"]');
  await page.fill('input[name="retailAmount"]', "529 900");
  await page.check('input[name="retailVat"][value="included"]');
  await page.check('input[name="retailRegistrationTaxes"][value="included"]');
  await page.fill('input[name="minimumContribution"]', "40 000");
  await page.fill('input[name="reserveAmount"]', "10 000");
  await page.check('input[name="reserveVatBasis"][value="incl_vat"]');
  await clickAndWait(page.locator('button:has-text("Lagre")'), /\/agents\?msg=saved/);
  const c2 = await card(N2).textContent();
  check("bredt søk uten bekreftelse: forklaring og deaktivert «Aktiver»", c2.includes("bekreft uttrykkelig") && await card(N2).locator('button:has-text("Aktiver")').isDisabled());

  // Bekreft bredt søk via redigering → klar
  await clickAndWait(card(N2).locator('a:has-text("Rediger")'), /\/agents\/[0-9a-f-]+$/);
  await page.check('input[name="broadSearchConfirmed"]');
  await clickAndWait(page.locator('button:has-text("Lagre")'), /\/agents\?msg=saved/);
  check("etter bekreftelse er bredt søk klart (avklart bredere filter)", (await card(N2).textContent()).includes("Klar for aktivering"));

  // 5–6: aktiver
  await clickAndWait(card(N1).locator('button:has-text("Aktiver")'), /msg=activated/);
  check("aktivering: status «Aktiv», 1 av maks 10, tekst om manuelt søk mot syntetisk kilde og at automatisk søk ikke finnes (DEV-005 oppdatert tekst)",
    (await card(N1).textContent()).includes("Aktiv") && (await text()).includes("1 av maks 10 aktive") && (await text()).includes("automatisk søk finnes ikke") && (await text()).includes("syntetiske demokilden"));

  // 9: reload
  await page.reload();
  r = await row(N1);
  check("etter reload er agenten fortsatt aktiv (DB: active, v2)", (await card(N1).locator("[data-status]").getAttribute("data-status")) === "active" && r.active && r.version === 2);

  // 2–3: rediger aktiv agent (gyldig) og forsøk å gjøre den ufullstendig
  await clickAndWait(card(N1).locator('a:has-text("Rediger")'), /\/agents\/[0-9a-f-]+$/);
  await page.fill('input[name="maxMileageKm"]', "120 000");
  await clickAndWait(page.locator('button:has-text("Lagre")'), /\/agents\?msg=saved/);
  r = await row(N1);
  check("redigering av aktiv agent lagres (km 120000, v3, fortsatt aktiv)", r.filters.maxMileageKm === 120000 && r.version === 3 && r.active);
  await clickAndWait(card(N1).locator('a:has-text("Rediger")'), /\/agents\/[0-9a-f-]+$/);
  await page.fill('input[name="retailAmount"]', "");
  await page.click('button:has-text("Lagre")');
  await page.waitForSelector("text=En aktiv agent må være komplett");
  check("aktiv agent kan ikke lagres ufullstendig (melding + mangel listet), DB uendret",
    (await text()).includes("En aktiv agent må være komplett") && (await text()).includes("Forventet norsk salgspris er ikke oppgitt") && (await row(N1)).version === 3);

  // 7–8: pause og aktiver igjen
  await page.goto(`${BASE}/agents`);
  await clickAndWait(card(N1).locator('button:has-text("Pause")'), /msg=paused/);
  check("pause: «Ikke aktiv», agenten vises fortsatt, 0 aktive", (await card(N1).textContent()).includes("Ikke aktiv") && (await text()).includes("0 av maks 10 aktive"));
  await clickAndWait(card(N1).locator('button:has-text("Aktiver")'), /msg=activated/);
  check("reaktivering virker (v5)", (await row(N1)).active && (await row(N1)).version === 5);

  // Grense: fyll opp til 10 aktive (oppsett direkte i DB), så forsøk 11. via UI
  await clickAndWait(card(N1).locator('button:has-text("Pause")'), /msg=paused/);
  for (let i = 0; i < 10; i++) await db.query("insert into public.search_agents (dealership_id,name,filters,assumptions,active) values ($1,$2,$3,$4,true)", [FIRM_A, `Fyll ${i} ${run}`, READY.filters, READY.assumptions]);
  await page.goto(`${BASE}/agents`);
  check("UI viser 10 av maks 10 aktive", (await text()).includes("10 av maks 10 aktive"));
  await clickAndWait(card(N1).locator('button:has-text("Aktiver")'), /error=active_limit/);
  check("11. aktivering avvises med forståelig melding", (await text()).includes("Maks 10 aktive agenter per firma er nådd") && !(await row(N1)).active);
  await clickAndWait(card(`Fyll 0 ${run}`).locator('button:has-text("Pause")'), /msg=paused/);
  await clickAndWait(card(N1).locator('button:has-text("Aktiver")'), /msg=activated/);
  check("etter pause av én kan en annen aktiveres (10 aktive)", (await row(N1)).active && (await text()).includes("10 av maks 10 aktive"));

  // Manipulasjon: rediger/aktiver Bs agent ved å bytte skjult id, og injiser Bs firma-ID
  await clickAndWait(card(N2).locator('a:has-text("Rediger")'), /\/agents\/[0-9a-f-]+$/);
  await page.evaluate(([bid, firm]) => {
    const idInput = document.querySelector('main input[name="id"]'); const f = idInput.form; idInput.value = bid;
    const i = document.createElement("input"); i.type = "hidden"; i.name = "dealership_id"; i.value = firm; f.appendChild(i);
  }, [bAgent, FIRM_B]);
  await page.fill('input[name="name"]', "Kapret");
  await page.click('button:has-text("Lagre")');
  await page.waitForSelector("text=Fant ikke agenten i ditt firma");
  const bRow = (await db.query("select name, active, version from public.search_agents where id = $1", [bAgent])).rows[0];
  check("redigering av Bs agent via manipulert id avvises; B uendret", (await text()).includes("Fant ikke agenten i ditt firma") && bRow.name === `B-agent ${run}` && bRow.version === 1);
  await page.goto(`${BASE}/agents`);
  await card(N1).locator('form input[name="id"]').evaluate((el, bid) => { el.value = bid; }, bAgent);
  await clickAndWait(card(N1).locator("form button"), /error=not_found/);
  check("aktiver/pause av Bs agent via manipulert id avvises; B fortsatt ikke aktiv",
    !(await db.query("select active from public.search_agents where id = $1", [bAgent])).rows[0].active);
  if (out) await page.screenshot({ path: `${out}/dev004-agents.png`, fullPage: true });

  // B ser ikke As agenter
  await Promise.all([page.waitForURL("**/login"), page.click('button:has-text("Logg ut")')]);
  await login(B);
  const tb = await text();
  check("B ser egen agent og ingen av As", tb.includes(`B-agent ${run}`) && !tb.includes(N1) && !tb.includes(N2));
  const r1 = await row(N1);
  await page.goto(`${BASE}/agents/${r1.id}`);
  check("B får 404 på As redigeringsside", (await text()).includes("Fant ikke siden"));

  // Regresjon DEV-001/003
  await page.goto(`${BASE}/dashboard`);
  check("dashboard: 24 syntetiske kort og demo-banner", (await page.locator('a[href^="/opportunities/"]').count()) === 24 && (await text()).includes("annonsene er syntetiske"));
  await page.goto(`${BASE}/opportunities/demo-009`);
  check("detaljside USD-fallback virker", (await text()).includes("41500.00 USD"));
  if (out) {
    await page.goto(`${BASE}/agents/new`);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `${out}/dev004-form-mobile.png`, fullPage: true });
    check("skjema uten horisontal scroll på mobil", (await page.evaluate(() => document.documentElement.scrollWidth)) <= 390);
  }
} catch (e) {
  results.push(`FEIL avbrutt: ${e.message.split("\n")[0]}`);
} finally {
  await db.query("delete from public.search_agents where name like $1 or id = $2", [`%${run}%`, bAgent]);
  await db.query("delete from public.search_agents where name = 'Kapret'");
  await db.query("delete from auth.users where id = any($1::uuid[])", [[A.id, B.id]]);
  await browser.close(); await db.end();
}
console.log(results.join("\n"));
console.log("sidefeil:", errors.length ? errors : "ingen");

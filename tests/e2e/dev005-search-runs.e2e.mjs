// Ende-til-ende for DEV-005 mot LOKAL Supabase + `next start -p 3100` (bygget mot lokal stack).
// Kjøring: PW=<sti til playwright> PG=$PWD/node_modules/pg DB_URL=<lokal DB_URL> node tests/e2e/dev005-search-runs.e2e.mjs
// Starter selv en andre appinstans (port 3101) med simulert kildefeil. Testbrukere opprettes lokalt og slettes etterpå. Ingen service-role.
import { createRequire } from "node:module";
import { randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW);
const { Client } = require(process.env.PG);
const BASE = "http://localhost:3100", FAIL_BASE = "http://localhost:3101";
const FIRM_A = "00000000-0000-4000-a000-00000000000a", FIRM_B = "00000000-0000-4000-a000-00000000000b";
const db = new Client({ connectionString: process.env.DB_URL }); await db.connect();
const run = randomBytes(3).toString("hex");
const ASSUME = {
  retail: { expectedRetailTotal: { amountMinor: "39990000", currency: "NOK" }, priceBasis: { vat: "included", registrationTaxes: "included" } },
  minimumContribution: { amountMinor: "3000000", currency: "NOK" },
  preparationReserve: { amount: { amountMinor: "1500000", currency: "NOK" }, vatBasis: "ex_vat" },
};
async function user(label) {
  const id = randomUUID(), email = `${label}-${run}@example.test`, password = randomBytes(18).toString("base64url");
  await db.query(`insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change)
    values ('00000000-0000-0000-0000-000000000000',$1,'authenticated','authenticated',$2,extensions.crypt($3,extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','')`, [id, email, password]);
  await db.query(`insert into auth.identities (provider_id,user_id,identity_data,provider,created_at,updated_at) values ($1::text,$2::uuid,jsonb_build_object('sub',$1::text,'email',$3::text),'email',now(),now())`, [id, id, email]);
  return { id, email, password };
}
const agent = async (firm, name, filters, active = true) =>
  (await db.query("insert into public.search_agents (dealership_id,name,filters,assumptions,active) values ($1,$2,$3,$4,$5) returning id", [firm, name, filters, ASSUME, active])).rows[0].id;
const A = await user("e2e5-a"), B = await user("e2e5-b");
await db.query("select private.admin_add_member($1,$2)", [A.email, FIRM_A]);
await db.query("select private.admin_add_member($1,$2)", [B.email, FIRM_B]);
const aGolf = await agent(FIRM_A, `Golf ${run}`, { make: "Volkswagen", model: "Golf" });
const aPaused = await agent(FIRM_A, `Pauset ${run}`, { make: "Volkswagen" }, false);
const aEmpty = await agent(FIRM_A, `Tom ${run}`, { make: "FinnesIkkeMerke" });
const aStale = await agent(FIRM_A, `Foreldet ${run}`, { make: "Volkswagen" });
const aFail = await agent(FIRM_A, `Feil ${run}`, { make: "Volkswagen" });
const bAgent = await agent(FIRM_B, `B-agent ${run}`, { make: "Volkswagen" });
const results = [];
const check = (name, ok, extra = "") => results.push(`${ok ? "OK  " : "FEIL"} ${name}${ok || !extra ? "" : ` — ${extra}`}`);
const runs = async (agentId) => (await db.query("select id, status, error_code, counts, agent_version, criteria_snapshot from public.search_runs where agent_id = $1 order by started_at", [agentId])).rows;
const nResults = async (runId) => (await db.query("select count(*)::int n from public.search_run_results where search_run_id = $1", [runId])).rows[0].n;

const failServer = spawn("npx", ["next", "start", "-p", "3101"], { env: { ...process.env, SCOUT_SYNTHETIC_FAILURE: "unavailable" }, stdio: "ignore", detached: true });
const browser = await chromium.launch();
const errors = [];
const page = await browser.newPage();
page.on("pageerror", (e) => errors.push(e.message));
const text = async (p = page) => (await p.content()).replace(/<!-- -->/g, "");
async function login(p, u, base = BASE) {
  await p.goto(`${base}/login`);
  await p.fill('input[name="email"]', u.email);
  await p.fill('input[name="password"]', u.password);
  await Promise.all([p.waitForURL(/\/agents/), p.click('button[type="submit"]')]);
}
async function waitUp(url) {
  for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).status < 500) return true; } catch {} await new Promise((r) => setTimeout(r, 1000)); }
  return false;
}
try {
  await login(page, A);

  // Hovedflyt: åpne aktiv agent → kjør → treff → last på nytt
  await page.goto(`${BASE}/agents`);
  await Promise.all([page.waitForURL(/\/runs$/), page.locator("li[data-agent-id]", { hasText: `Golf ${run}` }).locator('a:has-text("Søkekjøringer")').click()]);
  check("tom historikk før første kjøring", (await text()).includes("Ingen kjøringer ennå"));
  await Promise.all([page.waitForURL(/\/runs\/[0-9a-f-]{36}$/), page.click('[data-testid="run-button"]')]);
  const runUrl = page.url();
  const t1 = await text();
  const rs = await runs(aGolf);
  check("én lagret kjøring, fullført, med snapshot av agent og kriterier", rs.length === 1 && rs[0].status === "completed" && rs[0].criteria_snapshot.filters.model === "Golf" && rs[0].agent_version === 1, JSON.stringify(rs[0]?.counts));
  const stored = rs[0] ? await nResults(rs[0].id) : -1;
  check("UI viser status, treffantall og lagrede resultater", t1.includes("Fullført") && stored > 0 && (await page.locator('[data-testid="run-results"] li').count()) === Math.min(stored, 50) && Number(await page.locator('[data-testid="run-matches"]').innerText()) === rs[0].counts.matches, `lagret=${stored}`);
  check("syntetiske data er tydelig merket, ingen live-påstand", t1.includes("Syntetiske demodata") && !/live-annonser fra mobile\.de\b(?!\s+eller)/.test("") && t1.includes("ikke live-annonser"));
  check("kriterier fra kjøringen vises", (await page.locator('[data-testid="run-criteria"]').innerText()).includes("modell Golf"));
  const firstListing = await page.locator('[data-testid="run-results"] li').first().getAttribute("data-listing-id");
  const before = await page.locator('[data-testid="run-results"]').innerText();
  await page.reload();
  check("etter reload: samme kjøring og samme resultater", page.url() === runUrl && (await page.locator('[data-testid="run-results"]').innerText()) === before && (await runs(aGolf)).length === 1);
  await page.goto(`${BASE}/agents/${aGolf}/runs`);
  check("historikken lister kjøringen med status og antall", (await page.locator('[data-testid="run-history"] li').count()) === 1 && (await text()).includes("Fullført"));
  await page.goto(runUrl);
  await Promise.all([page.waitForURL(/\/opportunities\//), page.locator('[data-testid="run-results"] li a').first().click()]);
  check("klikk på resultat åpner eksisterende annonsevisning", page.url().includes(encodeURIComponent(firstListing)) && !(await text()).includes("404"));

  // Dobbeltklikk: nøyaktig én kjøring til
  await page.goto(`${BASE}/agents/${aGolf}/runs`);
  await page.locator('[data-testid="run-button"]').dblclick();
  await page.waitForURL(/\/runs\/[0-9a-f-]{36}$/);
  await new Promise((r) => setTimeout(r, 1500));
  check("dobbeltklikk gir nøyaktig én ny kjøring (totalt 2) og ingen hengende", (await runs(aGolf)).length === 2 && (await runs(aGolf)).every((r) => r.status === "completed"), JSON.stringify((await runs(aGolf)).map((r) => r.status)));

  // Inaktiv agent: knapp deaktivert; manipulert skjema avvises av server/DB
  await page.goto(`${BASE}/agents/${aPaused}/runs`);
  check("inaktiv agent: knappen er deaktivert", await page.locator('[data-testid="run-button"]').isDisabled());
  await page.evaluate(() => document.querySelector('[data-testid="run-button"]').removeAttribute("disabled"));
  await Promise.all([page.waitForURL(/error=inactive/), page.click('[data-testid="run-button"]')]);
  check("manipulert forsøk på inaktiv agent gir forståelig melding og ingen kjøring", (await text()).includes("Agenten er ikke aktiv") && (await runs(aPaused)).length === 0);

  // Fremmed agent via manipulert skjema
  await page.goto(`${BASE}/agents/${aGolf}/runs`);
  await page.evaluate((id) => { document.querySelector('input[name="agentId"]').value = id; }, bAgent);
  await Promise.all([page.waitForURL(/\/agents\?error=not_found/), page.click('[data-testid="run-button"]')]);
  check("fremmed agent-ID i skjema avvises som «ikke funnet», og B får ingen kjøring", (await text()).includes("Fant ikke agenten i ditt firma") && (await runs(bAgent)).length === 0);

  // Tomt resultat
  await page.goto(`${BASE}/agents/${aEmpty}/runs`);
  await Promise.all([page.waitForURL(/\/runs\/[0-9a-f-]{36}$/), page.click('[data-testid="run-button"]')]);
  const er = (await runs(aEmpty))[0];
  check("tomt resultat: fullført med 0 treff og tydelig tom-melding", er?.status === "completed" && er.counts.matches === 0 && (await page.locator('[data-testid="run-empty"]').count()) === 1 && (await nResults(er.id)) === 0);

  // Utdatert agentversjon
  await page.goto(`${BASE}/agents/${aStale}/runs`);
  await db.query("update public.search_agents set name = name || ' v2' where id = $1", [aStale]);
  await Promise.all([page.waitForURL(/error=stale_agent/), page.click('[data-testid="run-button"]')]);
  check("agent endret etter sidelasting: avvist med forklaring, ingen kjøring", (await text()).includes("Agenten er endret etter at siden ble lastet") && (await runs(aStale)).length === 0);
  await Promise.all([page.waitForURL(/\/runs\/[0-9a-f-]{36}$/), page.click('[data-testid="run-button"]')]);
  check("etter ny sidelasting kan agenten kjøres (ny versjon i snapshot)", (await runs(aStale))[0]?.agent_version === 2);

  // Redigering av agent endrer ikke gammel kjøring
  const oldRun = (await runs(aGolf))[0];
  await db.query("update public.search_agents set filters = jsonb_set(filters,'{model}','\"Polo\"') where id = $1", [aGolf]);
  await page.goto(`${BASE}/agents/${aGolf}/runs/${oldRun.id}`);
  check("gammel kjøring viser fortsatt kriteriene den ble kjørt med", (await page.locator('[data-testid="run-criteria"]').innerText()).includes("modell Golf") && (await page.locator('[data-testid="run-results"] li').count()) > 0);

  // Kildefeil (egen appinstans med simulert provider-feil)
  check("andre appinstans (simulert kildefeil) startet", await waitUp(`${FAIL_BASE}/login`));
  const p2 = await browser.newPage();
  await login(p2, A, FAIL_BASE);
  await p2.goto(`${FAIL_BASE}/agents/${aFail}/runs`);
  await Promise.all([p2.waitForURL(/\/runs\/[0-9a-f-]{36}$/, { timeout: 20000 }), p2.click('[data-testid="run-button"]')]);
  const fr = (await runs(aFail))[0];
  const t2 = await text(p2);
  check("kildefeil: kjøringen er failed (ikke hengende), feilkode lagret, ingen resultater", fr?.status === "failed" && fr.error_code === "unavailable" && (await nResults(fr.id)) === 0, JSON.stringify(fr));
  check("kildefeil: forståelig norsk melding uten tekniske detaljer", t2.includes("Kilden er utilgjengelig") && !/stack|PGRST|postgres|at \w+\.\w+ \(/i.test(t2));
  await p2.goto(`${FAIL_BASE}/agents/${aFail}/runs`);
  await Promise.all([p2.waitForURL(/\/runs\/[0-9a-f-]{36}$/, { timeout: 20000 }), p2.click('[data-testid="run-button"]')]);
  check("agent kan kjøres på nytt etter feil (ingen låst running)", (await runs(aFail)).length === 2);

  // Tenant-isolasjon i appen, begge veier
  const bRun = (await db.query("insert into public.search_runs (agent_id, request_token, provider) values ($1,$2,'synthetic-demo') returning id", [bAgent, randomUUID()])).rows[0].id;
  for (const u of [`/agents/${bAgent}/runs`, `/agents/${bAgent}/runs/${bRun}`, `/agents/${aGolf}/runs/${bRun}`]) {
    const res = await page.goto(`${BASE}${u}`);
    check(`A får 404 for B sin side ${u.replace(/[0-9a-f-]{36}/g, "…")}`, res.status() === 404);
  }
  const ctxB = await browser.newContext(); const pb = await ctxB.newPage();
  await login(pb, B);
  for (const u of [`/agents/${aGolf}/runs`, `/agents/${aGolf}/runs/${oldRun.id}`]) {
    const res = await pb.goto(`${BASE}${u}`);
    check(`B får 404 for A sin side ${u.replace(/[0-9a-f-]{36}/g, "…")}`, res.status() === 404);
  }
  const uuidless = await page.goto(`${BASE}/agents/ikke-uuid/runs/ikke-uuid`);
  check("ugyldige ID-er gir 404, ikke serverfeil", uuidless.status() === 404);
  check("ingen JS-feil i nettleseren", errors.length === 0, errors.join(" | "));
} finally {
  try { process.kill(-failServer.pid); } catch {}
  await db.query("delete from public.search_run_results where search_run_id in (select id from public.search_runs where agent_id = any($1::uuid[]))", [[aGolf, aPaused, aEmpty, aStale, aFail, bAgent]]);
  await db.query("delete from public.search_runs where agent_id = any($1::uuid[])", [[aGolf, aPaused, aEmpty, aStale, aFail, bAgent]]);
  await db.query("delete from public.search_agents where id = any($1::uuid[])", [[aGolf, aPaused, aEmpty, aStale, aFail, bAgent]]);
  await db.query("delete from auth.users where id = any($1::uuid[])", [[A.id, B.id]]);
  await browser.close(); await db.end();
}
console.log(results.join("\n"));
process.exit(results.some((r) => r.startsWith("FEIL")) ? 1 : 0);

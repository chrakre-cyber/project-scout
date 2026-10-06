// QA-001 / Gate G1: app- og serverstier i nettleser mot LOKAL Supabase + `next start -p 3100`.
// Kjøring: PW=<playwright> PG=$PWD/node_modules/pg DB_URL=<lokal DB_URL> node tests/e2e/qa001-app-paths.e2e.mjs
// Dekker det DEV-002/004-e2e ikke dekker: stale versjon/samtidig lagring, XSS-strenger, sesjonsgjenbruk etter
// utlogging, anonym direkteadgang, bruker uten firma, og query-parametre som peker på objektprototyper (F3, rettet i QA-001-FIX).
// Testbrukere med tilfeldige passord opprettes lokalt og slettes. Ingen service-role.
import { createRequire } from "node:module";
import { randomBytes, randomUUID } from "node:crypto";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW);
const { Client } = require(process.env.PG);
const BASE = "http://localhost:3100";
const FIRM_A = "00000000-0000-4000-a000-00000000000a", FIRM_B = "00000000-0000-4000-a000-00000000000b";
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
const A = await user("qa-a"), B = await user("qa-b"), L = await user("qa-loner");
await db.query("select private.admin_add_member($1,$2)", [A.email, FIRM_A]);
await db.query("select private.admin_add_member($1,$2)", [B.email, FIRM_B]);
const results = [];
const check = (name, ok, extra = "") => results.push(`${ok ? "OK  " : "FEIL"} ${name}${ok || !extra ? "" : ` — ${extra}`}`);
const mk = async (firm, name, active = false) => (await db.query("insert into public.search_agents (dealership_id,name,filters,assumptions,active) values ($1,$2,$3,$4,$5) returning id", [firm, name, READY.filters, READY.assumptions, active])).rows[0].id;
const aAgent = await mk(FIRM_A, `A-agent ${run}`), bAgent = await mk(FIRM_B, `B-agent ${run}`);
const browser = await chromium.launch();
const pageErrors = [];
async function login(ctx, u) {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => pageErrors.push(e.message));
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', u.email);
  await page.fill('input[name="password"]', u.password);
  await Promise.all([page.waitForURL(/\/agents/), page.click('button[type="submit"]')]);
  return page;
}
const text = async (page) => (await page.content()).replace(/<!-- -->/g, "");
try {
  // 1. Anonym direkteadgang (uten cookies)
  for (const path of ["/agents/new", `/agents/${aAgent}`, `/agents/${bAgent}`]) {
    const res = await fetch(`${BASE}${path}`, { redirect: "manual" });
    const body = await res.text();
    check(`anonym ${path.replace(/[0-9a-f-]{36}/, "<uuid>")}: omdirigeres og lekker ikke agentdata`, res.status >= 300 && res.status < 400 && !body.includes(run), `status ${res.status}`);
  }
  const anonList = await (await fetch(`${BASE}/agents`)).text();
  check("anonym /agents viser bare syntetiske demoagenter, ingen lagrede agenter", anonList.includes("Logg inn for å se") && !anonList.includes(run));

  // 2. Bruker uten firma
  const ctxL = await browser.newContext(); const pL = await login(ctxL, L);
  check("bruker uten firma: forklaring og ingen lagrede agenter", (await text(pL)).includes("ikke knyttet til et firma") && !(await text(pL)).includes(`A-agent ${run}`) && !(await text(pL)).includes(`B-agent ${run}`));
  await pL.goto(`${BASE}/agents/new`); check("bruker uten firma: /agents/new sender til /agents", pL.url().endsWith("/agents"));
  await pL.goto(`${BASE}/agents/${aAgent}`); check("bruker uten firma: /agents/<As agent> sender til /agents", pL.url().endsWith("/agents"));
  await ctxL.close();

  // 3. Tverrfirma via URL, begge retninger
  const ctxA = await browser.newContext(); const pA = await login(ctxA, A);
  const ctxB = await browser.newContext(); const pB = await login(ctxB, B);
  await pA.goto(`${BASE}/agents/${bAgent}`); check("A → Bs agent via URL gir 404", (await text(pA)).includes("Fant ikke siden") && !(await text(pA)).includes(`B-agent ${run}`));
  await pB.goto(`${BASE}/agents/${aAgent}`); check("B → As agent via URL gir 404", (await text(pB)).includes("Fant ikke siden") && !(await text(pB)).includes(`A-agent ${run}`));
  await pA.goto(`${BASE}/agents`); check("A ser bare egne agenter i listen", (await text(pA)).includes(`A-agent ${run}`) && !(await text(pA)).includes(`B-agent ${run}`));
  await pB.goto(`${BASE}/agents`); check("B ser bare egne agenter i listen", (await text(pB)).includes(`B-agent ${run}`) && !(await text(pB)).includes(`A-agent ${run}`));

  // 4. Query-parametre som peker på objektprototyper
  for (const q of ["error=__proto__", "error=constructor", "error=toString", "error=hasOwnProperty", "msg=__proto__", "msg=constructor", "msg=toString"]) {
    const r = await pA.goto(`${BASE}/agents?${q}`);
    const t = await text(pA);
    check(`/agents?${q} gir 200 uten krasj, og viser ingen melding fra objektprototypen (F3 rettet)`, r.status() === 200 && !t.includes("Application error") && !t.includes("function ") && !t.includes("[object"), `status ${r.status()}`);
  }

  // 5. XSS-/HTML-strenger
  const xss1 = `<img src=x onerror="window.__xss=1"> ${run}`, xss2 = `"><script>window.__xss=2</script> ${run}`;
  await pA.goto(`${BASE}/agents/new`);
  await pA.fill('input[name="name"]', xss1); await pA.fill('input[name="make"]', xss2);
  await Promise.all([pA.waitForURL(/msg=saved/), pA.click('button:has-text("Lagre")')]);
  const listHtml = await text(pA);
  check("HTML i navn/merke vises som tekst (escapet), ikke utført",
    (await pA.evaluate(() => window.__xss)) === undefined && listHtml.includes("&lt;img src=x") && !listHtml.includes('<img src=x onerror'));
  const xssId = (await db.query("select id from public.search_agents where name = $1", [xss1])).rows[0]?.id;
  await pA.goto(`${BASE}/agents/${xssId}`);
  check("HTML i redigeringsskjemaet er escapet og verdien er uendret", (await pA.inputValue('input[name="name"]')) === xss1 && (await pA.evaluate(() => window.__xss)) === undefined);

  // 6. Stale versjon og samtidig lagring (to sesjoner, samme bruker)
  const ctxA2 = await browser.newContext(); const pA2 = await login(ctxA2, A);
  const target = await mk(FIRM_A, `Konflikt ${run}`);
  await pA.goto(`${BASE}/agents/${target}`); await pA2.goto(`${BASE}/agents/${target}`);
  await pA.fill('input[name="name"]', `Konflikt ${run} fra klient 1`);
  await Promise.all([pA.waitForURL(/msg=saved/), pA.click('button:has-text("Lagre")')]);
  await pA2.fill('input[name="maxMileageKm"]', "99 000");
  await pA2.click('button:has-text("Lagre")');
  await pA2.waitForSelector("text=Agenten er endret i mellomtiden");
  let row = (await db.query("select name, version, filters from public.search_agents where id = $1", [target])).rows[0];
  check("stale lagring avvises med konfliktmelding og overskriver ikke nyere data",
    row.name === `Konflikt ${run} fra klient 1` && row.version === 2 && (row.filters.maxMileageKm ?? null) === null);
  check("verdiene i klient 2 beholdes etter konflikt (ingen datatap for brukeren)", (await pA2.inputValue('input[name="maxMileageKm"]')) === "99 000");
  await pA2.goto(`${BASE}/agents/${target}`);
  await pA2.fill('input[name="maxMileageKm"]', "99 000");
  await Promise.all([pA2.waitForURL(/msg=saved/), pA2.click('button:has-text("Lagre")')]);
  row = (await db.query("select name, version, filters from public.search_agents where id = $1", [target])).rows[0];
  check("etter ny lasting lagres endringen på riktig versjon (v3) og begge endringer finnes", row.version === 3 && row.filters.maxMileageKm === 99000 && row.name.endsWith("fra klient 1"));

  const race = await mk(FIRM_A, `Race ${run}`);
  await pA.goto(`${BASE}/agents/${race}`); await pA2.goto(`${BASE}/agents/${race}`);
  await pA.fill('input[name="name"]', `Race ${run} X`); await pA2.fill('input[name="name"]', `Race ${run} Y`);
  await Promise.all([pA.click('button:has-text("Lagre")'), pA2.click('button:has-text("Lagre")')]);
  await Promise.all([pA.waitForLoadState("networkidle"), pA2.waitForLoadState("networkidle")]);
  await new Promise((r) => setTimeout(r, 1500));
  const urls = [pA.url(), pA2.url()]; const texts = [await text(pA), await text(pA2)];
  row = (await db.query("select name, version from public.search_agents where id = $1", [race])).rows[0];
  const saved = urls.filter((u) => u.includes("msg=saved")).length, conflicts = texts.filter((t) => t.includes("endret i mellomtiden")).length;
  check("to samtidige lagringer: nøyaktig én lykkes, den andre gir konflikt, én versjon økt", saved === 1 && conflicts === 1 && row.version === 2 && /Race .* [XY]$/.test(row.name), `saved=${saved} conflicts=${conflicts} v=${row.version}`);

  // 7. Manipulerte skjemafelt (opprett): firma, aktiv, versjon, id
  await pA.goto(`${BASE}/agents/new`);
  await pA.fill('input[name="name"]', `Manipulert ${run}`);
  await pA.evaluate(([firm, id]) => {
    const f = document.querySelector('main input[name="name"]').form;
    for (const [n, v] of [["dealership_id", firm], ["active", "true"], ["version", "99"], ["id", id], ["last_success_at", "2026-01-01T00:00:00Z"]]) {
      const i = document.createElement("input"); i.type = "hidden"; i.name = n; i.value = v; f.appendChild(i);
    }
  }, [FIRM_B, bAgent]);
  await pA.click('button:has-text("Lagre")');
  await pA.waitForSelector("text=Agenten ble ikke lagret, text=Fant ikke agenten, text=endret i mellomtiden", { timeout: 8000 }).catch(() => {});
  const man = (await db.query("select dealership_id, active, version from public.search_agents where name = $1", [`Manipulert ${run}`])).rows;
  const bUntouched = (await db.query("select name, version from public.search_agents where id = $1", [bAgent])).rows[0];
  check("manipulert opprettelse (id satt til Bs agent): Bs agent uendret, ingen ny agent i B",
    bUntouched.name === `B-agent ${run}` && bUntouched.version === 1 && man.every((r) => r.dealership_id === FIRM_A && r.active === false && r.version === 1), JSON.stringify(man));

  // 8. Sesjonsgjenbruk etter utlogging
  const cookies = await ctxA.cookies();
  await pA.goto(`${BASE}/agents`);
  await Promise.all([pA.waitForURL("**/login"), pA.click('button:has-text("Logg ut")')]);
  const ctxReplay = await browser.newContext(); await ctxReplay.addCookies(cookies);
  const pR = await ctxReplay.newPage(); await pR.goto(`${BASE}/agents`);
  const tr = await text(pR);
  check("gamle cookies etter utlogging gir anonym visning, ikke firmadata", tr.includes("Logg inn for å se") && !tr.includes(`A-agent ${run}`) && !tr.includes("Syntetisk Firma A"));
  await ctxReplay.close();
  await ctxA.close(); await ctxA2.close(); await ctxB.close();
} catch (e) {
  results.push(`FEIL avbrutt: ${e.message.split("\n")[0]}`);
} finally {
  await db.query("delete from public.search_agents where name like $1 or id = any($2::uuid[])", [`%${run}%`, [aAgent, bAgent]]);
  await db.query("delete from auth.users where id = any($1::uuid[])", [[A.id, B.id, L.id]]);
  await browser.close(); await db.end();
}
console.log(results.join("\n"));
console.log("sidefeil:", pageErrors.length ? pageErrors : "ingen");

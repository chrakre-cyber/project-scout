// Ende-til-ende for DEV-002 mot LOKAL Supabase + `next start -p 3100` (bygget med .env.local mot lokal stack).
// Kjøring: PW=<sti til playwright> PG=$PWD/node_modules/pg DB_URL=<lokal DB_URL fra `npx supabase status -o env`> node tests/e2e/dev002-auth.e2e.mjs
// Oppretter testbrukere med tilfeldige passord i lokal DB, knytter dem til seed-firmaene og sletter dem etterpå.
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
async function user(label) {
  const id = randomUUID(), email = `${label}-${run}@example.test`, password = randomBytes(18).toString("base64url");
  await db.query(`insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change)
    values ('00000000-0000-0000-0000-000000000000',$1,'authenticated','authenticated',$2,extensions.crypt($3,extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','')`, [id, email, password]);
  await db.query(`insert into auth.identities (provider_id,user_id,identity_data,provider,created_at,updated_at) values ($1::text,$2::uuid,jsonb_build_object('sub',$1::text,'email',$3::text),'email',now(),now())`, [id, id, email]);
  return { id, email, password };
}
const A = await user("e2e-a"), B = await user("e2e-b"), L = await user("e2e-uten-firma");
await db.query("select private.admin_add_member($1,$2)", [A.email, FIRM_A]);
await db.query("select private.admin_add_member($1,$2)", [B.email, FIRM_B]);
const results = [];
const check = (name, ok) => { results.push(`${ok ? "OK  " : "FEIL"} ${name}`); };
const browser = await chromium.launch();
const errors = [];
async function login(page, u, pw = u.password) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', u.email);
  await page.fill('input[name="password"]', pw);
  await Promise.all([page.waitForURL(/\/(agents|login\?error=1)/), page.click('button[type="submit"]')]);
}
try {
  const ctx = await browser.newContext(); const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${BASE}/agents`);
  check("anonym /agents viser demo-agenter og «Logg inn»", (await page.content()).includes("Logg inn for å se") && await page.locator("text=Logg inn").first().isVisible());
  await login(page, A, "feil-passord-123456");
  check("feil passord gir generell feilmelding", page.url().includes("/login?error=1") && (await page.content()).includes("Innloggingen mislyktes"));
  await login(page, A);
  check("innlogging A → /agents med firma A", page.url().endsWith("/agents") && (await page.content()).includes("Syntetisk Firma A (demo)"));
  // Manipulasjon: injiser Bs firma-ID i skjemaet før innsending.
  await page.goto(`${BASE}/agents/new`); // DEV-004: opprettelse via eget skjema
  await page.fill('input[name="name"]', `E2E agent ${run}`);
  await page.fill('input[name="make"]', "Volkswagen");
  await page.fill('input[name="model"]', "Golf");
  await page.evaluate((b) => { for (const [n, v] of [["dealership_id", b], ["active", "true"], ["version", "99"]]) { const i = document.createElement("input"); i.type = "hidden"; i.name = n; i.value = v; document.querySelector('main input[name="name"]').form.appendChild(i); } }, FIRM_B);
  await Promise.all([page.waitForURL(/agents\?msg=saved/), page.click('button:has-text("Lagre")')]);
  check("opprettelse gir «Agenten er lagret»", (await page.content()).includes("Agenten er lagret"));
  const { rows } = await db.query("select dealership_id, active, version from public.search_agents where name = $1", [`E2E agent ${run}`]);
  check("injisert firma-ID/active/version ignorert: agent i firma A, ikke aktiv, versjon 1", rows.length === 1 && rows[0].dealership_id === FIRM_A && rows[0].active === false && rows[0].version === 1);
  await page.reload();
  check("agenten finnes etter reload", (await page.content()).includes(`E2E agent ${run}`));
  if (out) await page.screenshot({ path: `${out}/dev002-agents.png`, fullPage: true });
  await Promise.all([page.waitForURL("**/login"), page.click('button:has-text("Logg ut")')]);
  await page.goto(`${BASE}/agents`);
  check("etter utlogging: ingen lagrede agenter vises", !(await page.content()).includes(`E2E agent ${run}`));
  await login(page, B);
  const bHtml = await page.content();
  check("B ser firma B og ikke As agent", bHtml.includes("Syntetisk Firma B (demo)") && !bHtml.includes(`E2E agent ${run}`));
  await page.goto(`${BASE}/dashboard`);
  check("dashboard med syntetiske annonser virker innlogget", (await page.locator('a[href^="/opportunities/"]').count()) === 24);
  await page.goto(`${BASE}/opportunities/demo-009`);
  check("detaljside (USD) virker innlogget", (await page.content()).includes("41500.00 USD"));
  await Promise.all([page.waitForURL("**/login"), page.click('button:has-text("Logg ut")')]);
  await login(page, L);
  check("bruker uten firma: melding og ingen opprett-skjema", (await page.content()).includes("ikke knyttet til et firma") && (await page.locator('input[name="name"]').count()) === 0);
  await ctx.close();
} finally {
  await db.query("delete from public.search_agents where name like $1", [`E2E agent ${run}%`]);
  await db.query("delete from auth.users where id = any($1::uuid[])", [[A.id, B.id, L.id]]);
  await browser.close(); await db.end();
}
console.log(results.join("\n"));
console.log("sidefeil:", errors.length ? errors : "ingen");

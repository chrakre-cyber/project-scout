// CI-001 trinn 2 — L4 nettleserdel: innlogging/utlogging/sesjon i den UENDREDE appen (cookies via @supabase/ssr, proxy.ts, server actions).
// To moduser (tests/e2e/support/backend.mjs): «emulator» (standard; IKKE Supabase) og «real» (E2E_SUPABASE_MODE=real mot ekte lokal Supabase: GoTrue + PostgREST).
// Sjekker som bare gir mening mot ekte GoTrue (sesjonsrevokering ved utlogging) rapporteres som HOPP i emulatormodus og regnes da ikke som bestått (exit 4 = delvis).
// Ingen trace/video/HAR/storageState; ingen passord eller token skrives ut. Syntetiske brukere (@example.test) med tilfeldige passord opprettes og ryddes bort.
import { spawn, execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { randomBytes, randomUUID } from "node:crypto";
import { connectBackend } from "./support/backend.mjs";
import { launchBrowser } from "./support/browser.mjs";
import { freshEpoch } from "./support/synthetic-epoch.mjs";
import { preflightTargets } from "./support/preflight.mjs";
preflightTargets(); // CI-001-FIX3: avvis manglende/ugyldig/ikke-lokal database og API FØR databaseklienten opprettes (null DB-kall før avslag)

const require = createRequire(import.meta.url);
const { Client } = require(process.env.PG ?? "pg");
const DB = process.env.SUPABASE_TEST_DB_URL;
const PORT = 3110, EMU_PORT = 54398;
const base = `http://localhost:${PORT}`;
const results = [];
const check = (name, ok, extra = "") => { results.push(`${ok ? "OK  " : "FEIL"} ${name}${ok || !extra ? "" : ` — ${extra}`}`); if (!ok) console.error(`FEIL ${name}${extra ? ` — ${extra}` : ""}`); };
const skip = (name, reason) => { results.push(`HOPP ${name} — ${reason}`); console.error(`HOPP ${name} — ${reason}`); };

const db = new Client({ connectionString: DB });
await db.connect();
const run = randomBytes(3).toString("hex");
async function mkUser(label) {
  const id = randomUUID(), email = `${label}-${run}@example.test`, password = randomBytes(18).toString("base64url");
  await db.query(`insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change)
    values ('00000000-0000-0000-0000-000000000000',$1,'authenticated','authenticated',$2,extensions.crypt($3,extensions.gen_salt('bf')),now(),'{"provider":"email"}','{}',now(),now(),'','','','')`, [id, email, password]);
  return { id, email, password };
}
const A = await mkUser("l4-a"), LONER = await mkUser("l4-nofirm");
const firmA = (await db.query("select private.admin_create_dealership($1) id", [`L4 Firma A ${run}`])).rows[0].id;
await db.query("select private.admin_add_member($1,$2)", [A.email, firmA]);
const backend = await connectBackend({ db, dbUrl: DB, users: [A, LONER], port: EMU_PORT, pgModulePath: process.env.PG ?? "pg" });
const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: backend.url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: backend.publishableKey, NEXT_TELEMETRY_DISABLED: "1" };
delete env.SCOUT_SYNTHETIC_FAILURE; delete env.SCOUT_PUBLIC_ID_KEY;
env.SCOUT_ENABLE_LEGACY_ROUTES = "1";
const servers = [];
process.on("exit", () => { for (const s of servers) { try { s.kill("SIGKILL"); } catch { /* stoppet */ } } });

console.log("bygger uendret app mot valgt backend …");
execFileSync("npm", ["run", "build"], { env, stdio: ["ignore", "ignore", "inherit"] });
const srv = spawn(`${process.cwd()}/node_modules/.bin/next`, ["start", "-p", String(PORT)], { cwd: process.cwd(), env: { ...env, SCOUT_SYNTHETIC_EPOCH: freshEpoch() }, stdio: ["ignore", "ignore", "inherit"] });
servers.push(srv);
for (let i = 0; i < 80; i++) { try { const r = await fetch(`${base}/login`); if (r.status < 500) break; } catch { /* venter */ } await new Promise((r) => setTimeout(r, 500)); }

const browser = await launchBrowser();
const problems = [];
const watch = (page) => { page.on("pageerror", (e) => problems.push("pageerror: " + e.message)); page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) problems.push("console: " + m.text()); }); };
const authCookies = async (ctx) => (await ctx.cookies(base)).filter((c) => /^sb-.+-auth-token/.test(c.name));
async function submitLogin(page, email, password) {
  await page.goto(`${base}/login`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  // Server-handlingen avgjør målet: vellykket ⇒ /searches, feil ⇒ /login?error=1. Vent på at adressen faktisk endres (ikke på at «/login» allerede matcher).
  await Promise.all([page.waitForURL((u) => u.pathname !== "/login" || u.searchParams.has("error"), { timeout: 30000 }), page.click('main button[type="submit"]')]);
  await page.waitForLoadState("load");
}
const path = (page) => new URL(page.url()).pathname + new URL(page.url()).search;
const PROTECTED = `${base}/searches/economics-profile`;
// Anonyme brukere sendes fra beskyttede sider til /searches, som viser «Logg inn» i skallet (ikke til /login).
const anonymousLanding = async (page) => new URL(page.url()).pathname === "/searches" && (await page.locator("header").first().innerText().catch(() => "")).includes("Logg inn");
// @supabase/ssr lagrer sesjonen som «base64-<base64url(JSON)>» (kan være delt i .0/.1 …). Hjelpere for å lese/endre den uten å røpe verdier.
const joinValue = (cs) => cs.slice().sort((x, y) => x.name.localeCompare(y.name, "en", { numeric: true })).map((c) => c.value).join("");
const decodeSession = (cs) => { const v = joinValue(cs); return v.startsWith("base64-") ? JSON.parse(Buffer.from(v.slice(7), "base64url").toString()) : JSON.parse(decodeURIComponent(v)); };
const encodeSession = (obj) => `base64-${Buffer.from(JSON.stringify(obj)).toString("base64url")}`;

try {
  // ---- 1 anonym
  const ctx0 = await browser.newContext();
  const p0 = await ctx0.newPage(); watch(p0);
  await p0.goto(PROTECTED);
  check("anonym: beskyttet side sender bort fra siden til /searches som viser «Logg inn», og ingen sesjonscookie settes", (await anonymousLanding(p0)) && (await authCookies(ctx0)).length === 0, path(p0));
  await ctx0.close();

  // ---- 2 feil passord / ukjent bruker
  const ctx1 = await browser.newContext();
  const p1 = await ctx1.newPage(); watch(p1);
  await submitLogin(p1, A.email, `${A.password}x`);
  const wrongText = (await p1.locator('[data-testid="login-error"]').innerText().catch(() => "")).trim();
  const wrongOk = path(p1) === "/login?error=1" && /Innloggingen mislyktes/.test(wrongText) && (await authCookies(ctx1)).length === 0;
  await submitLogin(p1, `finnes-ikke-${run}@example.test`, "Tilfeldig-passord-123");
  const unknownText = (await p1.locator('[data-testid="login-error"]').innerText().catch(() => "")).trim();
  check("feil passord og ukjent bruker: samme generelle feilmelding, ingen sesjonscookie, ingen kontoinformasjon", wrongOk && path(p1) === "/login?error=1" && unknownText === wrongText && !wrongText.includes(A.email), `${path(p1)} «${wrongText}» / «${unknownText}»`);
  await ctx1.close();

  // ---- 3 riktig passord, sesjon, reload
  const ctx2 = await browser.newContext();
  const p2 = await ctx2.newPage(); watch(p2);
  await submitLogin(p2, A.email, A.password);
  const cookies = await authCookies(ctx2);
  const header = (await p2.locator("header").first().innerText().catch(() => "")).replace(/\s+/g, " ");
  check("riktig passord: sendes til /searches og kontoen vises i skallet (e-post og firma)", new URL(p2.url()).pathname === "/searches" && header.includes(A.email) && header.includes(`L4 Firma A ${run}`), `${path(p2)} ${header.slice(0, 120)}`);
  check("sesjonscookie finnes (sb-…-auth-token), Path=/ og SameSite=Lax; passordet ligger ikke i cookien", cookies.length >= 1 && cookies.every((c) => c.path === "/" && c.sameSite === "Lax") && !joinValue(cookies).includes(A.password), JSON.stringify(cookies.map((c) => ({ n: c.name.replace(/auth-token.*/, "auth-token…"), p: c.path, s: c.sameSite }))));
  await p2.reload();
  check("sesjonen overlever reload og ny navigasjon (fortsatt innlogget)", new URL(p2.url()).pathname === "/searches" && (await p2.goto(PROTECTED).then(() => new URL(p2.url()).pathname)) === "/searches/economics-profile", path(p2));

  // ---- 4 utløpt access-token med gyldig refresh-token fornyes
  const before = decodeSession(await authCookies(ctx2));
  const stale = { ...before, expires_at: Math.floor(Date.now() / 1000) - 600, expires_in: 0 };
  const valueStale = encodeSession(stale);
  const names = (await authCookies(ctx2)).map((c) => c.name);
  await ctx2.clearCookies();
  await ctx2.addCookies([{ name: names.sort()[0].replace(/\.\d+$/, ""), value: valueStale, url: base, sameSite: "Lax" }]);
  await p2.goto(PROTECTED);
  const afterCookies = await authCookies(ctx2);
  const after = afterCookies.length ? decodeSession(afterCookies) : null;
  check("utløpt tid i sesjonen + gyldig refresh-token: sesjonen fornyes (fortsatt innlogget, nytt utløp i fremtiden)", new URL(p2.url()).pathname === "/searches/economics-profile" && after !== null && after.expires_at > Math.floor(Date.now() / 1000), `${path(p2)} ${after ? after.expires_at : "ingen cookie"}`);

  // ---- 5 ødelagt cookie
  const good = await authCookies(ctx2);
  await ctx2.clearCookies();
  await ctx2.addCookies([{ name: good[0].name.replace(/\.\d+$/, ""), value: "base64-ikke-en-gyldig-sesjon", url: base, sameSite: "Lax" }]);
  await p2.goto(PROTECTED);
  check("ødelagt sesjonscookie: behandles som utlogget (beskyttet side nektes, «Logg inn» vises), ingen krasj", await anonymousLanding(p2), path(p2));
  await ctx2.clearCookies(); // den bevisst ødelagte cookien skal ikke gi støy (advarsler) i resten av løpet

  // ---- 6 utlogging (+ replay av gammel sesjon)
  const ctx3 = await browser.newContext();
  const p3 = await ctx3.newPage(); watch(p3);
  await submitLogin(p3, A.email, A.password);
  const oldCookies = await ctx3.cookies(base);
  await Promise.all([p3.waitForURL(/\/login/, { timeout: 30000 }), p3.click('button:has-text("Logg ut")')]);
  check("utlogging: sendes til /login og sesjonscookiene er fjernet", new URL(p3.url()).pathname === "/login" && (await authCookies(ctx3)).length === 0, path(p3));
  await p3.goto(PROTECTED);
  check("etter utlogging: beskyttet side nektes (anonym landing med «Logg inn»)", await anonymousLanding(p3), path(p3));
  await ctx3.addCookies(oldCookies.map((c) => ({ name: c.name, value: c.value, url: base, sameSite: "Lax" })));
  await p3.goto(PROTECTED);
  const replayBlocked = await anonymousLanding(p3);
  if (backend.mode === "real") check("gjenbruk av gammel sesjon etter utlogging avvises av GoTrue (sesjonen er revokert server-side)", replayBlocked, path(p3));
  else skip("gjenbruk av gammel sesjon etter utlogging avvises (server-side revokering)", "emulatoren validerer bare JWT-signatur/utløp og har ingen sesjonsrevokering; krever ekte GoTrue");
  await ctx3.close();

  // ---- 7 bruker uten firma
  const ctx4 = await browser.newContext();
  const p4 = await ctx4.newPage(); watch(p4);
  await submitLogin(p4, LONER.email, LONER.password);
  const h4 = (await p4.locator("header").first().innerText().catch(() => "")).replace(/\s+/g, " ");
  const body4 = (await p4.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ");
  check("bruker uten firma: kan logge inn, vises som «ikke knyttet til firma», og ser ingen data fra andre firma", new URL(p4.url()).pathname === "/searches" && h4.includes("ikke knyttet til firma") && !body4.includes(`L4 Firma A ${run}`), `${path(p4)} ${h4.slice(0, 100)}`);
  await ctx4.close();

  check("ingen JavaScript-feil i konsollen under hele flyten", problems.length === 0, problems.slice(0, 3).join(" | "));
  await ctx2.close();
} finally {
  await browser.close().catch(() => {});
  for (const s of servers) s.kill("SIGTERM");
  await backend.cleanup({ firmIds: [firmA], users: [A, LONER] }).catch(() => {});
  await backend.close().catch(() => {});
  await db.end().catch(() => {});
}
console.log(results.join("\n"));
const failed = results.filter((r) => r.startsWith("FEIL")), skipped = results.filter((r) => r.startsWith("HOPP"));
console.log(`\n${results.length - failed.length - skipped.length}/${results.length} sjekker OK${failed.length ? `, ${failed.length} FEIL` : ""}${skipped.length ? `, ${skipped.length} HOPPET (regnes IKKE som bestått — delvis dekning)` : ""} [modus: ${backend.mode}]`);
process.exit(failed.length ? 1 : skipped.length ? 4 : 0);

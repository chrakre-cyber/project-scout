// OFFLINE-HARNESS (CI-001 trinn 1): kjører tests/db/rest-isolation.test.ts og PostgREST-delen av tests/db/auth-gotrue.test.ts mot en EKTE PostgREST-binær
// foran den isolerte PostgreSQL-klyngen (RLS, grants, triggere og constraints er PostgreSQLs egne). Auth (GoTrue) er IKKE ekte: en liten stubb utsteder HS256-tokens for
// passordinnlogging mot auth.users (pgcrypto). Dette er derfor IKKE Supabase og IKKE bevis for GoTrue-oppførsel; det prøver bare HTTP-laget mot tabellene
// (statuskoder, feilkoder, Prefer, filtre, embed, tokenvalidering) før testene kjøres mot ekte stakk. Startes via scripts/test-rest-isolation-offline.sh.
// Krever POSTGREST_BIN (sti til en PostgREST-binær som du selv har lastet ned; scriptet installerer ingenting). Ingen hemmeligheter: tilfeldig, kortlevd test-nøkkel.
import { spawn } from "node:child_process";
import { createHmac, randomBytes } from "node:crypto";
import http from "node:http";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { Client } = require("pg");
const BIN = process.env.POSTGREST_BIN;
const DB = process.env.SUPABASE_TEST_DB_URL;
if (!BIN || !DB) { console.error("Mangler POSTGREST_BIN eller SUPABASE_TEST_DB_URL"); process.exit(2); }
const secret = randomBytes(32).toString("hex");
const PGRST_PORT = 33000 + Math.floor(Math.random() * 1000), PROXY_PORT = 34000 + Math.floor(Math.random() * 1000);

const children = [];
const stop = () => { for (const c of children) { try { c.kill("SIGKILL"); } catch { /* stoppet */ } } };
process.on("exit", stop);

const pg = spawn(BIN, [], { env: { ...process.env, PGRST_DB_URI: DB, PGRST_DB_SCHEMAS: "public", PGRST_DB_ANON_ROLE: "anon", PGRST_JWT_SECRET: secret, PGRST_SERVER_PORT: String(PGRST_PORT), PGRST_SERVER_HOST: "127.0.0.1", PGRST_LOG_LEVEL: "error" }, stdio: ["ignore", "ignore", "inherit"] });
children.push(pg);

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const sign = (user) => { const now = Math.floor(Date.now() / 1000); const h = b64({ alg: "HS256", typ: "JWT" }), p = b64({ aud: "authenticated", role: "authenticated", sub: user.id, email: user.email, iat: now, exp: now + 3600 }); return `${h}.${p}.${createHmac("sha256", secret).update(`${h}.${p}`).digest("base64url")}`; };
const db = new Client({ connectionString: DB });
await db.connect();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const chunks = []; for await (const c of req) chunks.push(c);
  const body = Buffer.concat(chunks);
  if (url.pathname === "/auth/v1/health") { res.writeHead(200); return res.end("{}"); }
  if (url.pathname === "/auth/v1/token" && url.searchParams.get("grant_type") === "password") {
    let b = {}; try { b = JSON.parse(body.toString() || "{}"); } catch { /* tom */ }
    const r = await db.query("select id, email from auth.users where email = $1 and encrypted_password = extensions.crypt($2, encrypted_password)", [String(b.email ?? ""), String(b.password ?? "")]);
    res.writeHead(r.rows.length ? 200 : 400, { "content-type": "application/json" });
    return res.end(JSON.stringify(r.rows.length ? { access_token: sign(r.rows[0]), token_type: "bearer", expires_in: 3600, refresh_token: "stub", user: { id: r.rows[0].id, email: r.rows[0].email } } : { code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials" }));
  }
  if (url.pathname.startsWith("/rest/v1/")) {
    const target = http.request({ host: "127.0.0.1", port: PGRST_PORT, path: url.pathname.replace("/rest/v1", "") + url.search, method: req.method, headers: { ...req.headers, host: `127.0.0.1:${PGRST_PORT}` } }, (pr) => { res.writeHead(pr.statusCode, pr.headers); pr.pipe(res); });
    target.on("error", () => { res.writeHead(502); res.end("{}"); });
    return target.end(body);
  }
  res.writeHead(404); res.end("{}");
});
await new Promise((r) => server.listen(PROXY_PORT, "127.0.0.1", r));

// vent til PostgREST svarer
for (let i = 0; i < 60; i++) { try { const r = await fetch(`http://127.0.0.1:${PGRST_PORT}/`, { headers: { Authorization: "Bearer x" } }); if (r.status) break; } catch { /* venter */ } await new Promise((r) => setTimeout(r, 500)); }

const args = ["vitest", "run", "--config", "vitest.db.config.ts", "tests/db/rest-isolation.test.ts", "tests/db/auth-gotrue.test.ts", "-t", process.env.OFFLINE_FILTER ?? "L6|tokenvalidering i PostgREST", ...(process.env.OFFLINE_VITEST_ARGS ? process.env.OFFLINE_VITEST_ARGS.split(" ") : [])];
const t = spawn("npx", args, { env: { ...process.env, SUPABASE_TEST_URL: `http://127.0.0.1:${PROXY_PORT}`, SUPABASE_TEST_PUBLISHABLE_KEY: "offline-publishable-key-not-secret", SUPABASE_TEST_JWT_SECRET: secret }, stdio: "inherit" });
const code = await new Promise((r) => t.on("exit", r));
stop(); server.close(); await db.end();
process.exit(code ?? 1);

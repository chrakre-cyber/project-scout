// TESTHJELPER — IKKE Supabase. Minimal emulator av akkurat de Auth- og PostgREST-kallene appen gjør, brukt til nettleserkontroller
// (SEARCH-005) i et miljø uten Docker. Alle datakall kjøres mot en ISOLERT testdatabase som rolle `authenticated` med JWT-claims,
// så RLS, rettigheter, constraints og triggere er PostgreSQLs egne. Emulatoren validerer IKKE noe på vegne av appen:
//   * autorisasjon = databasens RLS (emulatoren gir aldri service-role og setter aldri firma);
//   * den støtter kun tabellene og filterne som er listet under, og avviser alt annet (ECON-006c la til dealer_economics_inputs/-profiles).
// Hva dette IKKE beviser: at ekte Supabase Auth/PostgREST oppfører seg likt (GoTrue, JWT-nøkler, PostgREST-feilkoder).
// Bruk bare mot localhost/127.0.0.1. Passord er tilfeldige engangsverdier laget av testen.
import { createHmac, randomUUID } from "node:crypto";
import http from "node:http";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const TABLES = new Set(["dealership_members", "search_drafts", "search_agents", "dealer_economics_inputs", "dealer_economics_profiles"]);
const IDENT = /^[a-z_][a-z0-9_]{0,40}$/;
const b64 = (o) => Buffer.from(typeof o === "string" ? o : JSON.stringify(o)).toString("base64url");

export async function startMiniSupabase({ dbUrl, users, port, pgModulePath }) {
  const host = new URL(dbUrl).hostname;
  if (host !== "127.0.0.1" && host !== "localhost") throw new Error("Nekter å kjøre mot ikke-lokal database");
  const { Pool } = require(pgModulePath);
  const pool = new Pool({ connectionString: dbUrl, max: 4 });
  const secret = randomUUID() + randomUUID();
  const log = [];

  const sign = (user, ttl = 3600) => {
    const now = Math.floor(Date.now() / 1000);
    const head = b64({ alg: "HS256", typ: "JWT" });
    const body = b64({ sub: user.id, email: user.email, role: "authenticated", aud: "authenticated", iat: now, exp: now + ttl });
    const sig = createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url");
    return { token: `${head}.${body}.${sig}`, exp: now + ttl };
  };
  const verify = (token) => {
    const [h, p, s] = String(token ?? "").split(".");
    if (!h || !p || !s) return null;
    const good = createHmac("sha256", secret).update(`${h}.${p}`).digest("base64url");
    if (good !== s) return null;
    const claims = JSON.parse(Buffer.from(p, "base64url").toString());
    return claims.exp > Math.floor(Date.now() / 1000) ? claims : null;
  };
  const session = (user) => {
    const { token, exp } = sign(user);
    return { access_token: token, token_type: "bearer", expires_in: 3600, expires_at: exp, refresh_token: `r-${user.id}`, user: userJson(user) };
  };
  const userJson = (u) => ({ id: u.id, aud: "authenticated", role: "authenticated", email: u.email, email_confirmed_at: new Date().toISOString(), app_metadata: { provider: "email" }, user_metadata: {}, identities: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString() });

  const send = (res, status, body, headers = {}) => {
    res.writeHead(status, { "content-type": "application/json", ...headers });
    res.end(body === undefined ? "" : JSON.stringify(body));
  };
  const readBody = (req) => new Promise((resolve) => { const c = []; req.on("data", (d) => c.push(d)); req.on("end", () => resolve(Buffer.concat(c).toString())); });

  // ---- REST → SQL (kun det appen bruker)
  function splitTop(s) {
    const out = []; let depth = 0, cur = "";
    for (const ch of s) { if (ch === "(") depth++; if (ch === ")") depth--; if (ch === "," && depth === 0) { out.push(cur); cur = ""; } else cur += ch; }
    if (cur) out.push(cur);
    return out.map((x) => x.trim()).filter(Boolean);
  }
  function selectSql(table, select) {
    const cols = [];
    for (const part of splitTop(select || "*")) {
      const m = /^([a-z_]+)\s*\(\s*([a-z_,\s]+)\s*\)$/.exec(part);
      if (m) {
        if (!(table === "dealership_members" && m[1] === "dealerships")) throw new Error(`Ikke støttet embed ${part}`);
        const fields = m[2].split(",").map((f) => f.trim());
        if (!fields.every((f) => IDENT.test(f))) throw new Error("ugyldig embed");
        cols.push(`(select json_build_object(${fields.map((f) => `'${f}', d.${f}`).join(", ")}) from public.dealerships d where d.id = t.dealership_id) as dealerships`);
      } else if (part === "*") cols.push("t.*");
      else if (IDENT.test(part)) cols.push(`t.${part}`);
      else throw new Error(`Ikke støttet kolonne ${part}`);
    }
    return cols.join(", ");
  }
  function whereSql(params, args) {
    const clauses = [];
    for (const [k, v] of params) {
      if (["select", "order", "limit", "offset", "columns", "on_conflict"].includes(k)) continue;
      const m = /^eq\.(.*)$/s.exec(v);
      if (!IDENT.test(k) || !m) throw new Error(`Ikke støttet filter ${k}=${v}`);
      args.push(m[1]);
      clauses.push(`t.${k} = $${args.length}`);
    }
    return clauses.length ? ` where ${clauses.join(" and ")}` : "";
  }
  const valueArg = (v) => (v !== null && typeof v === "object" ? JSON.stringify(v) : v);
  const cast = (k, v) => (v !== null && typeof v === "object" ? "::jsonb" : "");

  async function runRest(req, url, claims, entry) {
    const [, , , table] = url.pathname.split("/");
    if (!TABLES.has(table)) throw Object.assign(new Error(`Ukjent tabell ${table}`), { http: 404 });
    const params = [...url.searchParams.entries()];
    const sel = url.searchParams.get("select") ?? "*";
    const rawBody = req.method === "GET" || req.method === "HEAD" ? "" : await readBody(req);
    const body = rawBody ? JSON.parse(rawBody) : null;
    if (body && typeof body === "object") entry.bodyKeys = Object.keys(body);
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("select set_config('role','authenticated',true), set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: claims.sub, role: "authenticated", email: claims.email })]);
      let rows;
      const args = [];
      if (req.method === "GET") {
        const w = whereSql(params, args);
        const ord = url.searchParams.get("order");
        let orderSql = "";
        if (ord) { const m = /^([a-z_]+)\.(asc|desc)$/.exec(ord); if (!m || !IDENT.test(m[1])) throw new Error("ugyldig order"); orderSql = ` order by t.${m[1]} ${m[2]}`; }
        rows = (await client.query(`select ${selectSql(table, sel)} from public.${table} t${w}${orderSql}`, args)).rows;
      } else if (req.method === "POST") {
        const keys = Object.keys(body);
        if (!keys.length || !keys.every((k) => IDENT.test(k))) throw new Error("ugyldig innsetting");
        keys.forEach((k) => args.push(valueArg(body[k])));
        const ret = selectSql(table, sel);
        rows = (await client.query(`with t as (insert into public.${table} (${keys.join(", ")}) values (${keys.map((k, i) => `$${i + 1}${cast(k, body[k])}`).join(", ")}) returning *) select ${ret} from t`, args)).rows;
      } else if (req.method === "PATCH") {
        const keys = Object.keys(body);
        if (!keys.length || !keys.every((k) => IDENT.test(k))) throw new Error("ugyldig oppdatering");
        keys.forEach((k) => args.push(valueArg(body[k])));
        const w = whereSql(params, args).replaceAll("t.", "");
        const ret = selectSql(table, sel);
        rows = (await client.query(`with t as (update public.${table} set ${keys.map((k, i) => `${k} = $${i + 1}${cast(k, body[k])}`).join(", ")}${w} returning *) select ${ret} from t`, args)).rows;
      } else throw Object.assign(new Error(`Ikke støttet metode ${req.method}`), { http: 405 });
      await client.query("commit");
      return rows;
    } catch (e) {
      await client.query("rollback").catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    try {
      if (url.pathname === "/auth/v1/health") return send(res, 200, { status: "ok" });
      if (url.pathname === "/auth/v1/token") {
        const body = JSON.parse((await readBody(req)) || "{}");
        const grant = url.searchParams.get("grant_type");
        if (grant === "password") {
          const u = users.find((x) => x.email === body.email && x.password === body.password);
          if (!u) return send(res, 400, { code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials" });
          return send(res, 200, session(u));
        }
        if (grant === "refresh_token") {
          const u = users.find((x) => `r-${x.id}` === body.refresh_token);
          return u ? send(res, 200, session(u)) : send(res, 400, { code: 400, error_code: "refresh_token_not_found", msg: "Invalid Refresh Token" });
        }
      }
      if (url.pathname === "/auth/v1/user") {
        const claims = verify((req.headers.authorization ?? "").replace(/^Bearer /i, ""));
        const u = claims && users.find((x) => x.id === claims.sub);
        return u ? send(res, 200, userJson(u)) : send(res, 401, { code: 401, error_code: "bad_jwt", msg: "invalid JWT" });
      }
      if (url.pathname === "/auth/v1/logout") return send(res, 204);
      if (url.pathname.startsWith("/rest/v1/")) {
        const claims = verify((req.headers.authorization ?? "").replace(/^Bearer /i, ""));
        if (!claims) return send(res, 401, { code: "PGRST301", message: "JWT invalid or missing", details: null, hint: null });
        const entry = { method: req.method, path: url.pathname, query: url.search };
        log.push(entry);
        try {
          const rows = await runRest(req, url, claims, entry);
          const object = /vnd\.pgrst\.object\+json/.test(req.headers.accept ?? "");
          if (object) {
            if (rows.length !== 1) return send(res, 406, { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned", details: `The result contains ${rows.length} rows`, hint: null });
            return send(res, req.method === "POST" ? 201 : 200, rows[0]);
          }
          return send(res, req.method === "POST" ? 201 : 200, rows);
        } catch (e) {
          const status = e.http ?? (e.code === "42501" ? 403 : 400);
          entry.error = e.code ?? e.message;
          return send(res, status, { code: e.code ?? "PGRST000", message: e.message, details: e.detail ?? null, hint: e.hint ?? null });
        }
      }
      return send(res, 404, { message: "not found" });
    } catch (e) {
      return send(res, 500, { message: String(e.message ?? e) });
    }
  });
  await new Promise((r) => server.listen(port, "127.0.0.1", r));
  return { url: `http://127.0.0.1:${port}`, log, close: async () => { await new Promise((r) => server.close(r)); await pool.end(); } };
}

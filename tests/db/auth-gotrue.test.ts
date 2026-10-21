/**
 * L4 (API-delen) — innlogging mot EKTE GoTrue og tokenvalidering i EKTE PostgREST (CI-001 trinn 1).
 * Kjøres via `bash scripts/test-db.sh` mot lokal Supabase (krever Auth + PostgREST; i den isolerte klyngen finnes ingen av delene, og testene feiler da
 * i stedet for å hoppes over). Oppsett som databaseeier; alle påstander som vanlig klient (publishable key, ingen service-role-nøkkel). Den lokale JWT-hemmeligheten
 * (SUPABASE_TEST_JWT_SECRET, kun lest fra den kortlevde lokale stakken) brukes BARE til å lage en utløpt token i testprosessen; den skrives aldri ut.
 * Dekker IKKE nettleserdelen (cookies via @supabase/ssr — trinn 2) og ikke hosted.
 */
import { createHmac } from "node:crypto";
import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminDb, assertTarget, cleanup, createFirmWithMember, createUser, env, signIn, type TestUser } from "./harness";

let db: Client;
let a: TestUser, loner: TestUser;
let firmA = "";
const users: TestUser[] = [];
const firms: string[] = [];

const secret = process.env.SUPABASE_TEST_JWT_SECRET ?? "";
const b64 = (o: unknown) => Buffer.from(typeof o === "string" ? o : JSON.stringify(o)).toString("base64url");
const sign = (claims: Record<string, unknown>, key = secret) => {
  const head = b64({ alg: "HS256", typ: "JWT" }), body = b64(claims);
  return `${head}.${body}.${createHmac("sha256", key).update(`${head}.${body}`).digest("base64url")}`;
};

async function http(method: string, path: string, opts: { token?: string; body?: unknown; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { apikey: env.key, ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}), ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}), ...opts.headers };
  const res = await fetch(`${env.url}${path}`, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
  const text = await res.text();
  let json: unknown = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* ikke JSON */ }
  return { status: res.status, json: json as Record<string, unknown> | unknown[] | null, text };
}
const password = (email: string, pw: string) => http("POST", "/auth/v1/token?grant_type=password", { body: { email, password: pw } });
const asObj = (j: unknown) => (j ?? {}) as Record<string, unknown>;

beforeAll(async () => {
  assertTarget();
  db = await adminDb();
  a = await createUser(db, "gotrue-a");
  loner = await createUser(db, "gotrue-nofirm");
  users.push(a, loner);
  firmA = await createFirmWithMember(db, "GoTrue Firma A", a);
  firms.push(firmA);
});
afterAll(async () => { if (db) { await cleanup(db, firms, users); await db.end(); } });

describe("L4 API: passordinnlogging", () => {
  it("riktig passord gir en sesjon (access- og refresh-token, bruker-id), og tokenet gir tilgang til egne data via PostgREST", async () => {
    const r = await password(a.email, a.password);
    expect(r.status).toBe(200);
    const s = asObj(r.json);
    expect(typeof s.access_token).toBe("string");
    expect(typeof s.refresh_token).toBe("string");
    expect(asObj(s.user).id).toBe(a.id);
    const own = await http("GET", "/rest/v1/dealerships?select=id", { token: s.access_token as string });
    expect(own.status).toBe(200);
    expect((own.json as { id: string }[]).map((x) => x.id)).toEqual([firmA]);
  });

  it("feil passord og ukjent bruker gir identisk avvisning (status, feilkode, melding) — ingen informasjon om hvilke kontoer som finnes", async () => {
    const wrong = await password(a.email, `${a.password}x`);
    const unknown = await password(`finnes-ikke-${Date.now()}@example.test`, "Tilfeldig-passord-123");
    expect(wrong.status).toBe(400);
    expect(unknown.status).toBe(wrong.status);
    const w = asObj(wrong.json), u = asObj(unknown.json);
    expect(w.error_code).toBe("invalid_credentials");
    expect(u.error_code).toBe(w.error_code);
    expect(u.msg).toBe(w.msg);
    expect(w.access_token).toBeUndefined();
    expect(wrong.text).not.toContain(a.id);
  });

  it("manglende e-post eller passord gir ingen sesjon", async () => {
    for (const body of [{ email: a.email }, { password: a.password }, { email: "", password: "" }, {}]) {
      const r = await http("POST", "/auth/v1/token?grant_type=password", { body });
      expect(r.status, JSON.stringify(Object.keys(body))).toBeGreaterThanOrEqual(400);
      expect(r.status).toBeLessThan(500);
      expect(asObj(r.json).access_token).toBeUndefined();
    }
  });

  it("åpen registrering er stengt: signup gir ingen sesjon og ingen ny bruker", async () => {
    const email = `signup-${Date.now()}@example.test`;
    const r = await http("POST", "/auth/v1/signup", { body: { email, password: "Tilfeldig-passord-123" } });
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(r.status).toBeLessThan(500);
    expect(asObj(r.json).access_token).toBeUndefined();
    const found = await db.query("select count(*)::int n from auth.users where email = $1", [email]);
    expect(found.rows[0].n).toBe(0);
  });

  it("bruker uten firma kan logge inn, men ser ingen firma", async () => {
    const r = await password(loner.email, loner.password);
    expect(r.status).toBe(200);
    const own = await http("GET", "/rest/v1/dealerships?select=id", { token: asObj(r.json).access_token as string });
    expect(own.status).toBe(200);
    expect(own.json).toEqual([]);
  });
});

describe("L4 API: tokenvalidering i PostgREST", () => {
  it("manglende token, tilfeldig streng og token med forfalsket signatur avvises (401) og gir ingen data", async () => {
    const good = asObj((await password(a.email, a.password)).json).access_token as string;
    const [h, p, sig] = good.split(".");
    const flipped = `${h}.${p}.${sig!.slice(0, -2)}${sig!.endsWith("AA") ? "BB" : "AA"}`;
    const otherSub = b64({ ...JSON.parse(Buffer.from(p!, "base64url").toString()), sub: "00000000-0000-4000-a000-0000000000ff" });
    for (const [what, token] of [["tilfeldig streng", "ikke-en-jwt"], ["endret signatur", flipped], ["endret innhold, original signatur", `${h}.${otherSub}.${sig}`]] as const) {
      const r = await http("GET", "/rest/v1/dealerships?select=id", { token });
      expect(r.status, what).toBe(401);
      expect(Array.isArray(r.json) ? r.json : []).toEqual([]);
    }
    const noAuth = await http("GET", "/rest/v1/dealerships?select=id");
    expect([401, 403]).toContain(noAuth.status); // anon har ingen leserett til firmatabellen
    expect(Array.isArray(noAuth.json) ? noAuth.json : []).toEqual([]);
  });

  it("utløpt token avvises mens samme token med fremtidig utløp godtas (kontroll: det er utløpet, ikke signeringen, som avviser)", async () => {
    expect(secret.length, "SUPABASE_TEST_JWT_SECRET må være satt av scripts/test-db.sh").toBeGreaterThan(10);
    const now = Math.floor(Date.now() / 1000);
    const claims = { aud: "authenticated", role: "authenticated", sub: a.id, email: a.email, iat: now - 7200 };
    const fresh = await http("GET", "/rest/v1/dealerships?select=id", { token: sign({ ...claims, iat: now - 60, exp: now + 3600 }) });
    expect(fresh.status, "kontrolltoken (gyldig utløp) må godtas for at utløpstesten skal bety noe").toBe(200);
    expect((fresh.json as { id: string }[]).map((x) => x.id)).toEqual([firmA]);
    const expired = await http("GET", "/rest/v1/dealerships?select=id", { token: sign({ ...claims, exp: now - 3600 }) });
    expect(expired.status).toBe(401);
    expect(asObj(expired.json).code ?? asObj(expired.json).message).toBeTruthy();
    expect(Array.isArray(expired.json) ? expired.json : []).toEqual([]);
  });

  it("token signert med feil nøkkel avvises (kontroll mot samme claims signert riktig)", async () => {
    const now = Math.floor(Date.now() / 1000);
    const claims = { aud: "authenticated", role: "authenticated", sub: a.id, iat: now - 60, exp: now + 3600 };
    expect((await http("GET", "/rest/v1/dealerships?select=id", { token: sign(claims) })).status).toBe(200);
    const wrongKey = await http("GET", "/rest/v1/dealerships?select=id", { token: sign(claims, `${secret}-feil`) });
    expect(wrongKey.status).toBe(401);
  });
});

describe("L4 API: refresh og utlogging", () => {
  it("refresh gir ny sesjon med fungerende token; ugyldig refresh-token avvises", async () => {
    const s = asObj((await password(a.email, a.password)).json);
    const r = await http("POST", "/auth/v1/token?grant_type=refresh_token", { body: { refresh_token: s.refresh_token } });
    expect(r.status).toBe(200);
    const n = asObj(r.json);
    expect(typeof n.access_token).toBe("string");
    expect(asObj(n.user).id).toBe(a.id);
    const own = await http("GET", "/rest/v1/dealerships?select=id", { token: n.access_token as string });
    expect((own.json as { id: string }[]).map((x) => x.id)).toEqual([firmA]);
    const bad = await http("POST", "/auth/v1/token?grant_type=refresh_token", { body: { refresh_token: "finnes-ikke-123456789" } });
    expect(bad.status).toBe(400);
    expect(asObj(bad.json).access_token).toBeUndefined();
  });

  it("utlogging (global) ugyldiggjør refresh-token: etter logout gir refresh ingen ny sesjon", async () => {
    const s = asObj((await password(a.email, a.password)).json);
    const out = await http("POST", "/auth/v1/logout?scope=global", { token: s.access_token as string });
    expect([200, 204]).toContain(out.status);
    const after = await http("POST", "/auth/v1/token?grant_type=refresh_token", { body: { refresh_token: s.refresh_token } });
    expect(after.status).toBeGreaterThanOrEqual(400);
    expect(asObj(after.json).access_token).toBeUndefined();
  });

  it("supabase-js: signInWithPassword/getUser/signOut fungerer mot ekte Auth (samme vei som appen bruker)", async () => {
    const c = await signIn(a);
    const u = await c.auth.getUser();
    expect(u.data.user?.id).toBe(a.id);
    const { error } = await c.auth.signOut();
    expect(error).toBeNull();
  });
});

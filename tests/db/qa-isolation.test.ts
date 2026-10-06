/**
 * QA-001 / Gate G1 — tenant-/firmaisolasjon, symmetrisk A→B og B→A, uavhengig av DEV-002/004-testene.
 *
 * Alle tilgangspåstander kjøres som ordinære innloggede brukere (Auth + Data API) eller
 * som anon. Oppsett og verifisering av «uendret» skjer som databaseeier. Ingen service-role.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminDb, anonClient, assertLocal, cleanup, createFirmWithMember, createUser, env, READY, signIn, type TestUser } from "./harness";

interface Tenant {
  user: TestUser;
  firm: string;
  client: SupabaseClient;
  pausedId: string;
  activeId: string;
}

let db: Client;
let A: Tenant, B: Tenant;
let loner: TestUser;
const allUsers: TestUser[] = [];

async function tenant(label: string): Promise<Tenant> {
  const user = await createUser(db, `qa-${label}`);
  allUsers.push(user);
  const firm = await createFirmWithMember(db, `QA-iso ${label}`, user);
  const client = await signIn(user);
  const ins = async (name: string, active: boolean) =>
    (await client.from("search_agents").insert({ dealership_id: firm, name: `${label}-${name}`, active, ...READY }).select("id").single()).data!.id as string;
  return { user, firm, client, pausedId: await ins("paused", false), activeId: await ins("active", true) };
}

const snapshot = async (firm: string) =>
  (await db.query("select id, dealership_id, name, active, version, filters, assumptions, updated_at from public.search_agents where dealership_id = $1 order by id", [firm])).rows;

beforeAll(async () => {
  assertLocal();
  db = await adminDb();
  A = await tenant("a");
  B = await tenant("b");
  loner = await createUser(db, "qa-loner");
  allUsers.push(loner);
});
afterAll(async () => {
  if (db) {
    await cleanup(db, [A?.firm, B?.firm].filter(Boolean), allUsers);
    await db.end();
  }
});

describe.each([
  ["A → B", () => [A, B] as const],
  ["B → A", () => [B, A] as const],
])("%s", (_label, pair) => {
  let me: Tenant, other: Tenant;
  let before: Awaited<ReturnType<typeof snapshot>>;
  beforeAll(async () => {
    [me, other] = pair();
    before = await snapshot(other.firm);
  });

  it("leser egne firmaopplysninger, medlemskap og agenter", async () => {
    expect((await me.client.from("dealerships").select("id")).data).toEqual([{ id: me.firm }]);
    expect((await me.client.from("dealership_members").select("user_id, dealership_id")).data).toEqual([{ user_id: me.user.id, dealership_id: me.firm }]);
    const agents = await me.client.from("search_agents").select("id, dealership_id");
    expect(agents.data!.map((r) => r.id).sort()).toEqual([me.activeId, me.pausedId].sort());
    expect(new Set(agents.data!.map((r) => r.dealership_id))).toEqual(new Set([me.firm]));
  });

  it("leser ingenting om det andre firmaet: ID, liste, telling, filtertriks og embeds", async () => {
    expect((await me.client.from("dealerships").select("id").eq("id", other.firm)).data).toEqual([]);
    expect((await me.client.from("search_agents").select("id").eq("id", other.pausedId)).data).toEqual([]);
    expect((await me.client.from("search_agents").select("id").in("id", [other.pausedId, other.activeId])).data).toEqual([]);
    expect((await me.client.from("search_agents").select("id").neq("dealership_id", me.firm)).data).toEqual([]);
    expect((await me.client.from("search_agents").select("id").or(`dealership_id.eq.${other.firm},id.eq.${other.activeId}`)).data).toEqual([]);
    expect((await me.client.from("search_agents").select("id").eq("dealership_id", other.firm).limit(1000)).data).toEqual([]);
    const count = await me.client.from("search_agents").select("*", { count: "exact", head: true });
    expect(count.count).toBe(2);
    const countOther = await me.client.from("search_agents").select("*", { count: "exact", head: true }).eq("dealership_id", other.firm);
    expect(countOther.count).toBe(0);
    // Embeds følger RLS på begge sider
    const viaMembers = await me.client.from("dealership_members").select("dealership_id, dealerships(id, name)");
    expect(viaMembers.data!.map((r) => r.dealership_id)).toEqual([me.firm]);
    const viaFirms = await me.client.from("dealerships").select("id, search_agents(id)");
    expect(viaFirms.data!.map((r) => r.id)).toEqual([me.firm]);
    const viaAgents = await me.client.from("search_agents").select("id, dealerships(id)");
    expect(new Set(viaAgents.data!.map((r) => (r.dealerships as unknown as { id: string }).id))).toEqual(new Set([me.firm]));
  });

  it("kan ikke endre, aktivere eller pause det andre firmaets agenter", async () => {
    const edit = await me.client.from("search_agents").update({ name: "kapret", filters: { make: "X" } }).eq("id", other.pausedId).select("id");
    const activate = await me.client.from("search_agents").update({ active: true }).eq("id", other.pausedId).select("id");
    const pause = await me.client.from("search_agents").update({ active: false }).eq("id", other.activeId).select("id");
    const bulk = await me.client.from("search_agents").update({ active: false }).in("id", [other.pausedId, other.activeId]).select("id");
    for (const r of [edit, activate, pause, bulk]) expect(r.data ?? []).toEqual([]);
    const del = await me.client.from("search_agents").delete().eq("id", other.pausedId);
    expect(del.error?.code).toBe("42501");
  });

  it("kan ikke flytte egen agent til det andre firmaet eller opprette der", async () => {
    expect((await me.client.from("search_agents").update({ dealership_id: other.firm }).eq("id", me.pausedId)).error?.code).toBe("42501");
    for (const active of [false, true]) {
      const res = await me.client.from("search_agents").insert({ dealership_id: other.firm, name: "innbrudd", active, ...READY });
      expect(res.error).not.toBeNull();
      expect(["42501", "23514"]).toContain(res.error?.code); // 23514 for active=true mot fullt firma: se funn F1
    }
    expect((await me.client.from("search_agents").insert(Array.from({ length: 3 }, () => ({ dealership_id: other.firm, name: "batch", ...READY })))).error?.code).toBe("42501");
    expect((await me.client.from("search_agents").upsert({ id: other.pausedId, dealership_id: me.firm, name: "x", ...READY }, { onConflict: "id" })).error).not.toBeNull();
  });

  it("kan ikke endre medlemskap eller firma, og egen agent beholder firmaet", async () => {
    expect((await me.client.from("dealership_members").insert({ user_id: me.user.id, dealership_id: other.firm })).error?.code).toBe("42501");
    expect((await me.client.from("dealership_members").update({ dealership_id: other.firm }).eq("user_id", me.user.id)).error?.code).toBe("42501");
    expect((await me.client.from("dealerships").update({ name: "kapret" }).eq("id", other.firm)).error?.code).toBe("42501");
    expect((await me.client.from("dealerships").delete().eq("id", other.firm)).error?.code).toBe("42501");
    const own = (await db.query("select dealership_id from public.search_agents where id = $1", [me.pausedId])).rows[0];
    expect(own.dealership_id).toBe(me.firm);
  });

  it("det andre firmaets data er byte-for-byte uendret etter alle forsøkene", async () => {
    expect(await snapshot(other.firm)).toEqual(before);
  });
});

describe("manipulasjon av identitet og klientfelt", () => {
  it("endring av user_metadata (selvbetjent) gir ingen tilgang til andre firma", async () => {
    const c = await signIn(A.user);
    const upd = await c.auth.updateUser({ data: { dealership_id: B.firm, dealership_ids: [B.firm], role: "service_role", is_admin: true } });
    expect(upd.error).toBeNull();
    await c.auth.refreshSession(); // nytt token med oppdatert metadata
    expect((await c.from("search_agents").select("id").eq("dealership_id", B.firm)).data).toEqual([]);
    expect((await c.from("dealerships").select("id")).data).toEqual([{ id: A.firm }]);
    expect((await c.from("search_agents").insert({ dealership_id: B.firm, name: "meta", ...READY })).error?.code).toBe("42501");
    const { rows } = await db.query("select count(*)::int n from public.search_agents where name = 'meta'");
    expect(rows[0].n).toBe(0);
  });

  it("forfalsket eller usignert JWT med andre brukers sub avvises", async () => {
    const session = (await A.client.auth.getSession()).data.session!;
    const [h, p, sig] = session.access_token.split(".") as [string, string, string];
    const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const payload = JSON.parse(Buffer.from(p, "base64url").toString());
    const forged = `${h}.${b64({ ...payload, sub: B.user.id })}.${sig}`;
    const none = `${b64({ alg: "none", typ: "JWT" })}.${b64({ ...payload, sub: B.user.id })}.`;
    const call = (token: string) => fetch(`${env.url}/rest/v1/search_agents?select=id`, { headers: { apikey: env.key, Authorization: `Bearer ${token}` } });
    for (const token of [forged, none, `${h}.${p}.${sig.slice(0, -2)}xx`]) {
      const res = await call(token);
      expect(res.status, token.slice(0, 20)).toBe(401);
    }
    expect((await call(session.access_token)).status).toBe(200); // kontroll: ekte token virker
  });

  it("Data API kan ikke nå private skjema eller administrasjonsfunksjoner", async () => {
    const c = await signIn(A.user);
    const priv = c.schema("private" as never);
    const viaSchema = await (priv as unknown as SupabaseClient).rpc("admin_add_member", { p_user_email: A.user.email, p_dealership_id: B.firm });
    expect(viaSchema.error).not.toBeNull();
    expect(viaSchema.error?.code).toBe("PGRST106"); // skjema ikke eksponert
    for (const fn of ["admin_add_member", "admin_create_dealership", "my_dealership_ids", "enforce_active_agent_limit"]) {
      const res = await c.rpc(fn, {});
      expect(res.error, fn).not.toBeNull();
      expect(res.data, fn).toBeNull();
    }
    const { rows } = await db.query("select count(*)::int n from public.dealership_members where user_id = $1 and dealership_id = $2", [A.user.id, B.firm]);
    expect(rows[0].n).toBe(0);
  });

  it("anon: ingen tilgang til tabeller, RPC eller skjema-oversikt", async () => {
    const anon = anonClient();
    for (const t of ["dealerships", "dealership_members", "search_agents"]) {
      expect((await anon.from(t).select("*")).error?.code, t).toBe("42501");
      expect((await anon.from(t).insert({})).error, t).not.toBeNull();
    }
    const spec = await fetch(`${env.url}/rest/v1/`, { headers: { apikey: env.key, Accept: "application/openapi+json" } });
    const text = await spec.text();
    for (const t of ["search_agents", "dealership_members", "dealerships"]) expect(text, t).not.toContain(`"/${t}"`);
  });

  it("bruker uten medlemskap: ingen firmadata, ingen agenter, kan ikke opprette", async () => {
    const c = await signIn(loner);
    for (const t of ["dealerships", "dealership_members", "search_agents"]) {
      const res = await c.from(t).select("*");
      expect(res.error, t).toBeNull();
      expect(res.data, t).toEqual([]);
    }
    for (const firm of [A.firm, B.firm]) {
      expect((await c.from("search_agents").insert({ dealership_id: firm, name: "x", ...READY })).error?.code).toBe("42501");
    }
  });

  it("utlogging ugyldiggjør sesjonen for server-validering (getUser), som appen bruker", async () => {
    const c = await signIn(A.user);
    const token = (await c.auth.getSession()).data.session!.access_token;
    const probe = createClient(env.url, env.key, { auth: { persistSession: false, autoRefreshToken: false } });
    expect((await probe.auth.getUser(token)).error).toBeNull();
    await c.auth.signOut(); // global scope
    expect((await probe.auth.getUser(token)).error).not.toBeNull();
  });
});

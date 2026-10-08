/**
 * DEV-005 — søkekjøringer: RLS/tenant-isolasjon, constraints, statusoverganger, idempotens og samtidighet.
 * Alle brukerpåstander kjøres som ordinære innloggede brukere (Auth + Data API) eller anon. Oppsett/«uendret»-kontroll som databaseeier.
 * Lagring og avslutning av resultater skjer, som i appen, via den betrodde skriveveien (rollen scout_ingest, DEC-029).
 */
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminDb, anonClient, assertLocal, cleanup, connectIngest, createFirmWithMember, createUser, READY, signIn, type TestUser } from "./harness";

interface Tenant { user: TestUser; firm: string; client: SupabaseClient; activeId: string; pausedId: string }

let db: Client;
let ingest: Client;
let closeIngest: () => Promise<void>;
let A: Tenant, B: Tenant;
let loner: TestUser;
const users: TestUser[] = [];
const HASH = "a".repeat(64);
const MSG_RUNS = 'new row violates row-level security policy for table "search_runs"';

async function tenant(label: string): Promise<Tenant> {
  const user = await createUser(db, `sr-${label}`);
  users.push(user);
  const firm = await createFirmWithMember(db, `SR ${label}`, user);
  const client = await signIn(user);
  const ins = async (name: string, active: boolean) =>
    (await client.from("search_agents").insert({ dealership_id: firm, name: `${label}-${name}`, active, ...READY }).select("id").single().then((r) => { if (r.error) throw new Error(JSON.stringify(r.error)); return r; })).data!.id as string;
  return { user, firm, client, activeId: await ins("active", true), pausedId: await ins("paused", false) };
}

const startRun = (t: Tenant, agentId: string, extra: Record<string, unknown> = {}) =>
  t.client.from("search_runs").insert({ agent_id: agentId, request_token: randomUUID(), provider: "synthetic-demo", ...extra })
    .select("id, dealership_id, agent_id, agent_version, status, criteria_snapshot, counts, error_code, started_at, finished_at").single();

const result = (runId: string, rank: number, id = `L-${rank}`, extra: Record<string, unknown> = {}) => ({
  search_run_id: runId, source: "synthetic-demo", source_listing_id: id, content_hash: HASH, rank,
  match_status: "match", unknown_criteria: [], listing_snapshot: { source: "synthetic-demo", sourceListingId: id, make: "Volkswagen" }, ...extra,
});

/** Frisk agent per test der kjøringer skal startes uten å kollidere med «én pågående per agent». */
const freshAgent = async (t: Tenant, active = true) => {
  // Maks 10 aktive per firma (DEC-003): pause tidligere testagenter (eier-oppsett) før en ny aktiveres.
  if (active) await db.query("update public.search_agents set active = false where dealership_id = $1 and name = 'x' and active", [t.firm]);
  return (await t.client.from("search_agents").insert({ dealership_id: t.firm, name: "x", active, ...READY }).select("id").single()).data!.id as string;
};

/** Kall mot den betrodde skriveveien; returnerer feilen i stedet for å kaste, slik at tester kan hevde på den. */
type DbError = Error & { code?: string };
async function trusted(sql: string, params: unknown[]): Promise<{ error: DbError | null }> {
  try {
    await ingest.query(sql, params);
    return { error: null };
  } catch (e) {
    return { error: e as DbError };
  }
}
const store = (t: Tenant, runId: string, rows: object | object[]) =>
  trusted("select private.trusted_store_results($1::uuid, $2::uuid, $3::jsonb)", [t.firm, runId, JSON.stringify(Array.isArray(rows) ? rows : [rows])]);
const complete = (t: Tenant, runId: string, c: unknown) =>
  trusted("select private.trusted_complete_run($1::uuid, $2::uuid, $3::jsonb)", [t.firm, runId, JSON.stringify(c)]);
const fail = (t: Tenant, runId: string, code: string | null) =>
  trusted("select private.trusted_fail_run($1::uuid, $2::uuid, $3::text)", [t.firm, runId, code]);
const counts = (matches: number, needsReview = 0) => ({ matches, needsReview });

beforeAll(async () => {
  assertLocal();
  db = await adminDb();
  ({ ingest, close: closeIngest } = await connectIngest(db));
  A = await tenant("a");
  B = await tenant("b");
  loner = await createUser(db, "sr-loner");
  users.push(loner);
});
afterAll(async () => {
  if (db) {
    await cleanup(db, [A?.firm, B?.firm].filter(Boolean), users);
    await closeIngest?.();
    await db.end();
  }
});

describe("opprett og les egen kjøring", () => {
  it("DB utleder firma, agentversjon, status og kriteriesnapshot; klientens verdier ignoreres/avvises", async () => {
    const agentId = await freshAgent(A);
    const { data, error } = await startRun(A, agentId, { requested_agent_version: 1 });
    expect(error).toBeNull();
    expect(data).toMatchObject({ dealership_id: A.firm, agent_id: agentId, agent_version: 1, status: "running", counts: null, error_code: null, finished_at: null });
    expect(data!.criteria_snapshot).toMatchObject({ schemaVersion: 1, agentName: "x", filters: { make: "Volkswagen" } });
    expect(data!.criteria_snapshot.assumptions.minimumContribution).toEqual({ amountMinor: "3000000", currency: "NOK" });
    // Klienten kan ikke sette utledede kolonner (ingen kolonnerettighet)
    for (const col of ["dealership_id", "status", "criteria_snapshot", "agent_version", "started_at", "finished_at", "counts", "error_code", "id", "rights_profile_id", "rights_profile_version", "expires_at"]) {
      const r = await startRun(A, await freshAgent(A), { [col]: col === "dealership_id" ? B.firm : col === "id" ? randomUUID() : "x" });
      expect(r.error?.code, col).toBe("42501");
    }
    const read = await A.client.from("search_runs").select("id").eq("id", data!.id);
    expect(read.data).toEqual([{ id: data!.id }]);
  });

  it("snapshot er stabil når agenten endres senere", async () => {
    const agentId = await freshAgent(A);
    const { data: run } = await startRun(A, agentId);
    await complete(A, run!.id, counts(0));
    await A.client.from("search_agents").update({ name: "omdøpt", filters: { make: "Audi" } }).eq("id", agentId);
    const { data } = await A.client.from("search_runs").select("criteria_snapshot, agent_version").eq("id", run!.id).single();
    expect(data!.criteria_snapshot).toMatchObject({ agentName: "x", filters: { make: "Volkswagen" } });
    expect(data!.agent_version).toBe(1);
  });
});

describe.each([["A → B", () => [A, B] as const], ["B → A", () => [B, A] as const]])("%s", (_l, pair) => {
  let me: Tenant, other: Tenant;
  let otherRun: string;
  let otherFinishedRun: string;
  beforeAll(async () => {
    [me, other] = pair();
    otherFinishedRun = (await startRun(other, await freshAgent(other))).data!.id;
    await fail(other, otherFinishedRun, "timeout");
    const agent = await freshAgent(other);
    otherRun = (await startRun(other, agent)).data!.id;
    await store(other, otherRun, result(otherRun, 1));
  });

  it("leser ikke det andre firmaets kjøringer eller resultater (ID, liste, telling, filter, embed)", async () => {
    expect((await me.client.from("search_runs").select("id").eq("id", otherRun)).data).toEqual([]);
    expect((await me.client.from("search_runs").select("id").eq("dealership_id", other.firm)).data).toEqual([]);
    expect((await me.client.from("search_runs").select("id").neq("dealership_id", me.firm)).data).toEqual([]);
    expect((await me.client.from("search_run_results").select("id").eq("search_run_id", otherRun)).data).toEqual([]);
    expect((await me.client.from("search_run_results").select("id").eq("dealership_id", other.firm)).data).toEqual([]);
    const cnt = await me.client.from("search_runs").select("*", { count: "exact", head: true }).eq("dealership_id", other.firm);
    expect(cnt.count).toBe(0);
    const emb = await me.client.from("search_agents").select("id, search_runs(id)");
    for (const a of emb.data!) for (const r of (a.search_runs as { id: string }[])) expect(r.id).not.toBe(otherRun);
  });

  it("kan ikke opprette kjøring for det andre firmaets agent; svaret er likt som for ukjent agent", async () => {
    const foreign = await startRun(me, other.activeId);
    const unknown = await startRun(me, randomUUID());
    const foreignPaused = await startRun(me, other.pausedId);
    for (const r of [foreign, unknown, foreignPaused]) {
      expect(r.error?.code).toBe("42501");
      expect(r.error?.message).toBe(MSG_RUNS);
      expect(r.error?.details ?? null).toBeNull();
    }
    // også med forfalsket dealership_id: ingen kolonnerettighet
    expect((await startRun(me, other.activeId, { dealership_id: other.firm })).error?.code).toBe("42501");
    expect((await db.query("select count(*)::int n from public.search_runs where agent_id = $1 and request_token is not null and started_at > now() - interval '1 minute' and id <> $2", [other.activeId, otherRun])).rows[0].n).toBe(0);
  });

  it("kan ikke endre, slette eller flytte det andre firmaets kjøring/resultater", async () => {
    const upd = await me.client.from("search_runs").update({ status: "failed", error_code: "internal" }).eq("id", otherRun).select("id");
    expect(upd.error?.code).toBe("42501");
    expect((await me.client.from("search_runs").delete().eq("id", otherRun)).error?.code).toBe("42501");
    expect((await me.client.from("search_run_results").delete().eq("search_run_id", otherRun)).error?.code).toBe("42501");
    expect((await me.client.from("search_run_results").update({ rank: 9 }).eq("search_run_id", otherRun)).error?.code).toBe("42501");
    // Brukere har ingen INSERT-rett på resultater (DEC-029): fremmed, ukjent og avsluttet kjøring gir identisk svar.
    const attempts = [
      await me.client.from("search_run_results").insert(result(otherRun, 2)),
      await me.client.from("search_run_results").insert(result(randomUUID(), 2)),
      await me.client.from("search_run_results").insert(result(otherFinishedRun, 1)),
    ];
    for (const a of attempts) expect(a.error?.code).toBe("42501");
    expect(new Set(attempts.map((a) => a.error?.message)).size).toBe(1);
    expect((await db.query("select status from public.search_runs where id = $1", [otherRun])).rows[0].status).toBe("running");
    expect((await db.query("select count(*)::int n from public.search_run_results where search_run_id = $1", [otherRun])).rows[0].n).toBe(1);
  });

  it("kan ikke flytte egen kjøring til det andre firmaet (kolonnerettighet og trigger)", async () => {
    const agent = await freshAgent(me);
    const { data } = await startRun(me, agent);
    expect((await me.client.from("search_runs").update({ dealership_id: other.firm }).eq("id", data!.id)).error?.code).toBe("42501");
    expect((await me.client.from("search_runs").update({ agent_id: other.activeId }).eq("id", data!.id)).error?.code).toBe("42501");
    expect((await me.client.from("search_run_results").insert(result(data!.id, 1, "L-1", { dealership_id: other.firm }))).error?.code).toBe("42501");
  });
});

describe("anon og bruker uten medlemskap", () => {
  it("anon har ingen tilgang og skjema avsløres ikke", async () => {
    const anon = anonClient();
    for (const t of ["search_runs", "search_run_results"]) {
      expect((await anon.from(t).select("*")).error?.code, t).toBe("42501");
      expect((await anon.from(t).insert({})).error, t).not.toBeNull();
      expect((await anon.from(t).update({ status: "failed" }).eq("id", randomUUID())).error, t).not.toBeNull();
    }
  });
  it("bruker uten medlemskap ser ingenting og kan ikke starte kjøring", async () => {
    const c = await signIn(loner);
    for (const t of ["search_runs", "search_run_results"]) expect((await c.from(t).select("*")).data, t).toEqual([]);
    const r = await c.from("search_runs").insert({ agent_id: A.activeId, request_token: randomUUID(), provider: "synthetic-demo" });
    expect(r.error?.code).toBe("42501");
    expect(r.error?.message).toBe(MSG_RUNS);
  });
});

describe("kvalifisering av agent", () => {
  it("inaktiv agent avvises", async () => {
    const r = await startRun(A, A.pausedId);
    expect(r.error?.code).toBe("23514");
    expect(r.error?.message).toContain("search_run_agent_inactive");
  });
  it("aktiv agent som ikke oppfyller kravene avvises (tilstanden konstrueres i en rullet-tilbake transaksjon)", async () => {
    const id = await freshAgent(A);
    await db.query("begin");
    try {
      await db.query("alter table public.search_agents drop constraint search_agents_ready_when_active");
      await db.query("update public.search_agents set assumptions = '{}'::jsonb where id = $1", [id]);
      await db.query("select set_config('role', 'authenticated', true), set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: A.user.id, role: "authenticated" })]);
      await db.query("savepoint s");
      await expect(db.query("insert into public.search_runs (agent_id, request_token, provider) values ($1, $2, 'synthetic-demo')", [id, randomUUID()]))
        .rejects.toThrow(/search_run_agent_not_ready/);
    } finally {
      await db.query("rollback");
    }
    expect((await db.query("select count(*)::int n from pg_constraint where conname = 'search_agents_ready_when_active'")).rows[0].n).toBe(1);
    expect((await startRun(A, id)).error).toBeNull(); // uendret agent kan kjøres
  });
  it("utdatert agentversjon avvises; riktig versjon og ingen versjon godtas", async () => {
    const id = await freshAgent(A);
    await A.client.from("search_agents").update({ name: "ny" }).eq("id", id); // versjon 2
    const stale = await startRun(A, id, { requested_agent_version: 1 });
    expect(stale.error?.code).toBe("23514");
    expect(stale.error?.message).toContain("search_run_stale_agent");
    const ok = await startRun(A, id, { requested_agent_version: 2 });
    expect(ok.error).toBeNull();
    expect(ok.data!.agent_version).toBe(2);
  });
});

describe("constraints", () => {
  it("avviser ugyldig provider, ugyldig versjon og manglende token", async () => {
    const id = await freshAgent(A);
    expect((await startRun(A, id, { provider: "mobile.de" })).error?.code).toBe("23514");
    expect((await startRun(A, id, { requested_agent_version: 0 })).error?.code).toBe("23514");
    expect((await A.client.from("search_runs").insert({ agent_id: id, provider: "synthetic-demo" })).error?.code).toBe("23502");
    expect((await A.client.from("search_runs").insert({ agent_id: id, request_token: "ikke-uuid", provider: "synthetic-demo" })).error).not.toBeNull();
  });

  it("resultater: ugyldig hash, rank, status, ukjent-kriterier, snapshot og kilde avvises", async () => {
    const { data: run } = await startRun(A, await freshAgent(A));
    const bad: Record<string, unknown>[] = [
      { content_hash: "xyz" }, { rank: 0 }, { rank: 2001 }, { match_status: "excluded" }, { source: "mobile.de" },
      { match_status: "match", unknown_criteria: ["make"] }, { match_status: "needs_review", unknown_criteria: [] },
      { match_status: "needs_review", unknown_criteria: ["feil"] }, { listing_snapshot: [] }, { listing_snapshot: { source: "synthetic-demo", sourceListingId: "annen" } },
      { listing_snapshot: { blob: "x".repeat(9000), source: "synthetic-demo", sourceListingId: "L-1" } }, { source_listing_id: "" },
    ];
    for (const b of bad) {
      const r = await store(A, run!.id, result(run!.id, 1, "L-1", b));
      expect(r.error, JSON.stringify(b).slice(0, 60)).not.toBeNull();
    }
    expect((await db.query("select count(*)::int n from public.search_run_results where search_run_id = $1", [run!.id])).rows[0].n).toBe(0);
  });

  it("unik rang og unik annonse per kjøring", async () => {
    const { data: run } = await startRun(A, await freshAgent(A));
    expect((await store(A, run!.id, result(run!.id, 1, "L-1"))).error).toBeNull();
    expect((await store(A, run!.id, result(run!.id, 1, "L-2"))).error?.code).toBe("23505");
    expect((await store(A, run!.id, result(run!.id, 2, "L-1"))).error?.code).toBe("23505");
  });
});

describe("statusoverganger", () => {
  it("running → completed med riktige tellere; finished_at settes av DB", async () => {
    const { data: run } = await startRun(A, await freshAgent(A));
    expect((await store(A, run!.id, [result(run!.id, 1), { ...result(run!.id, 2), match_status: "needs_review", unknown_criteria: ["fuel"] }])).error).toBeNull();
    const done = await complete(A, run!.id, { ...counts(1, 1), sourceTotal: 5, fetched: 5, excluded: 3, rejected: 0, duplicates: 0, pages: 1, truncated: false });
    expect(done.error).toBeNull();
    const row = (await db.query("select status, finished_at, counts from public.search_runs where id = $1", [run!.id])).rows[0];
    expect(row.status).toBe("completed");
    expect(row.finished_at).not.toBeNull();
  });

  it("completed avvises ved feil eller manglende tellere (også NULL)", async () => {
    const { data: run } = await startRun(A, await freshAgent(A));
    await store(A, run!.id, result(run!.id, 1));
    for (const c of [counts(0), counts(2), counts(0, 0), {}, { matches: 1 }, { needsReview: 0 }, { matches: "1", needsReview: 0 }]) {
      const r = await complete(A, run!.id, c);
      expect(r.error, JSON.stringify(c)).not.toBeNull();
    }
    expect((await complete(A, run!.id, null)).error).not.toBeNull(); // uten tellere
    expect((await db.query("select status from public.search_runs where id = $1", [run!.id])).rows[0].status).toBe("running");
  });

  it("failed krever gyldig feilkode og ingen tellere er påkrevd; completed kan ikke ha feilkode", async () => {
    const { data: run } = await startRun(A, await freshAgent(A));
    expect((await fail(A, run!.id, null)).error).not.toBeNull();
    expect((await fail(A, run!.id, "hemmelig passord")).error).not.toBeNull();
    // completed med feilkode kan ikke konstrueres via den betrodde veien; heller ikke direkte som eier (trigger)
    await expect(db.query("update public.search_runs set status = 'completed', counts = $2::jsonb, error_code = 'internal' where id = $1", [run!.id, JSON.stringify(counts(0))])).rejects.toThrow();
    expect((await fail(A, run!.id, "timeout")).error).toBeNull();
    expect((await db.query("select status, error_code from public.search_runs where id = $1", [run!.id])).rows[0]).toEqual({ status: "failed", error_code: "timeout" });
  });

  it("avsluttet kjøring er endelig; ingen retur til running; ingen nye resultater; kriterier er uforanderlige", async () => {
    const { data: run } = await startRun(A, await freshAgent(A));
    await fail(A, run!.id, "unavailable");
    // Brukere kan ikke endre kjøringer i det hele tatt; den betrodde veien nekter å røre en avsluttet kjøring
    for (const patch of [{ status: "running" }, { status: "completed", counts: counts(0) }, { error_code: "internal" }]) {
      const r = await A.client.from("search_runs").update(patch).eq("id", run!.id).select("id");
      expect(r.error?.code, JSON.stringify(patch)).toBe("42501");
    }
    expect((await complete(A, run!.id, counts(0))).error).not.toBeNull();
    expect((await fail(A, run!.id, "internal")).error).not.toBeNull();
    expect((await store(A, run!.id, result(run!.id, 1))).error).not.toBeNull();
    // Som eier (omgår RLS): triggeren avviser likevel
    await expect(db.query("update public.search_runs set status = 'running', error_code = null where id = $1", [run!.id])).rejects.toThrow(/search_run_invalid_transition|check/);
    const { data: run2 } = await startRun(A, await freshAgent(A));
    await expect(db.query("update public.search_runs set criteria_snapshot = '{}'::jsonb, status = 'failed', error_code = 'internal' where id = $1", [run2!.id])).rejects.toThrow(/search_run_immutable/);
    await expect(db.query("update public.search_runs set started_at = now() - interval '1 day', status = 'failed', error_code = 'internal' where id = $1", [run2!.id])).rejects.toThrow(/search_run_immutable/);
  });

  it("resultater kan ikke endres eller slettes av bruker (ingen UPDATE/DELETE-rettighet)", async () => {
    const { data: run } = await startRun(A, await freshAgent(A));
    await store(A, run!.id, result(run!.id, 1));
    expect((await A.client.from("search_run_results").update({ rank: 5 }).eq("search_run_id", run!.id)).error?.code).toBe("42501");
    expect((await A.client.from("search_run_results").delete().eq("search_run_id", run!.id)).error?.code).toBe("42501");
    expect((await A.client.from("search_runs").delete().eq("id", run!.id)).error?.code).toBe("42501");
  });

  it("tellerobjektet valideres: ukjente nøkler, negative tall og for store tall avvises", async () => {
    const { data: run } = await startRun(A, await freshAgent(A));
    for (const c of [{ ...counts(0), ekstra: 1 }, { ...counts(0), excluded: -1 }, { ...counts(0), fetched: 1e12 }, { ...counts(0), truncated: "ja" }, { ...counts(0), pages: 1.5 }]) {
      expect((await complete(A, run!.id, c)).error, JSON.stringify(c)).not.toBeNull();
    }
  });
});

describe("idempotens og samtidighet", () => {
  it("samme token for samme agent gir aldri en ny kjøring (replay)", async () => {
    const id = await freshAgent(A);
    const token = randomUUID();
    const first = await A.client.from("search_runs").insert({ agent_id: id, request_token: token, provider: "synthetic-demo" }).select("id").single();
    expect(first.error).toBeNull();
    await fail(A, first.data!.id, "timeout");
    const second = await A.client.from("search_runs").insert({ agent_id: id, request_token: token, provider: "synthetic-demo" });
    expect(second.error?.code).toBe("23505");
    expect(second.error?.message).toContain("search_runs_token_key");
    expect((await db.query("select count(*)::int n from public.search_runs where agent_id = $1", [id])).rows[0].n).toBe(1);
  });

  it("én pågående kjøring per agent: ny start mens en kjører avvises, og er mulig etter avslutning", async () => {
    const id = await freshAgent(A);
    const first = await startRun(A, id);
    const second = await startRun(A, id);
    expect(second.error?.code).toBe("23505");
    expect(second.error?.message).toContain("search_runs_one_running_per_agent");
    await complete(A, first.data!.id, counts(0));
    expect((await startRun(A, id)).error).toBeNull();
  });

  it("20 samtidige starter for samme agent gir nøyaktig én kjøring", async () => {
    const id = await freshAgent(A);
    const results = await Promise.all(Array.from({ length: 20 }, () => startRun(A, id)));
    expect(results.filter((r) => !r.error)).toHaveLength(1);
    for (const r of results.filter((x) => x.error)) expect(r.error!.message).toContain("search_runs_one_running_per_agent");
    expect((await db.query("select count(*)::int n from public.search_runs where agent_id = $1 and status = 'running'", [id])).rows[0].n).toBe(1);
  });

  it("20 samtidige starter med samme token gir nøyaktig én kjøring", async () => {
    const id = await freshAgent(A);
    const token = randomUUID();
    const results = await Promise.all(Array.from({ length: 20 }, () =>
      A.client.from("search_runs").insert({ agent_id: id, request_token: token, provider: "synthetic-demo" }).select("id").single()));
    expect(results.filter((r) => !r.error)).toHaveLength(1);
    expect((await db.query("select count(*)::int n from public.search_runs where agent_id = $1", [id])).rows[0].n).toBe(1);
  });

  it("agenter er uavhengige: parallelle kjøringer for ulike agenter er tillatt", async () => {
    const ids = await Promise.all([freshAgent(A), freshAgent(A), freshAgent(A)]);
    const rs = await Promise.all(ids.map((i) => startRun(A, i)));
    expect(rs.every((r) => !r.error)).toBe(true);
  });

  it("hengende kjøring (>5 min) settes til failed/abandoned ved neste start, og agenten kan kjøres igjen", async () => {
    const id = await freshAgent(A);
    const stuck = await startRun(A, id);
    expect((await startRun(A, id)).error?.code).toBe("23505"); // ikke gammel nok ennå
    // Eier-oppsett: baklengs datering er ellers umulig (started_at er uforanderlig), så triggeren slås av kortvarig.
    await db.query("alter table public.search_runs disable trigger search_runs_before_update");
    try {
      await db.query("update public.search_runs set started_at = now() - interval '6 minutes' where id = $1", [stuck.data!.id]);
    } finally {
      await db.query("alter table public.search_runs enable trigger search_runs_before_update");
    }
    const again = await startRun(A, id);
    expect(again.error).toBeNull();
    const old = (await db.query("select status, error_code, finished_at from public.search_runs where id = $1", [stuck.data!.id])).rows[0];
    expect(old).toMatchObject({ status: "failed", error_code: "abandoned" });
    expect(old.finished_at).not.toBeNull();
  });
});

describe("firmaisolasjon i fremmednøkler", () => {
  it("firma utledes fra agent/kjøring selv om innsenderen oppgir et annet (også som eier)", async () => {
    const { data: run } = await startRun(A, await freshAgent(A));
    const res = await db.query(
      `insert into public.search_run_results (search_run_id, dealership_id, source, source_listing_id, content_hash, rank, match_status, unknown_criteria, listing_snapshot)
       values ($1, $2, 'synthetic-demo', 'L-1', $3, 1, 'match', '[]', '{"source":"synthetic-demo","sourceListingId":"L-1"}') returning dealership_id`, [run!.id, B.firm, HASH]);
    expect(res.rows[0].dealership_id).toBe(A.firm);
    const r2 = await db.query(
      "insert into public.search_runs (dealership_id, agent_id, request_token, provider) values ($1, $2, $3, 'synthetic-demo') returning dealership_id",
      [B.firm, await freshAgent(A), randomUUID()]);
    expect(r2.rows[0].dealership_id).toBe(A.firm);
  });

  it("sammensatt FK fanger feil firma også når triggerne er slått av (siste forsvarslinje)", async () => {
    const { data: run } = await startRun(A, await freshAgent(A));
    await db.query("begin");
    try {
      await db.query("alter table public.search_run_results disable trigger search_run_results_before_insert");
      await db.query("alter table public.search_runs disable trigger search_runs_before_insert");
      await db.query("savepoint s1");
      await expect(db.query(
        `insert into public.search_run_results (search_run_id, dealership_id, source, source_listing_id, content_hash, rank, match_status, unknown_criteria, listing_snapshot, rights_profile_version, expires_at)
         values ($1, $2, 'synthetic-demo', 'L-1', $3, 1, 'match', '[]', '{"source":"synthetic-demo","sourceListingId":"L-1"}', 1, now() + interval '1 day')`, [run!.id, B.firm, HASH])).rejects.toThrow(/foreign key|search_run_results_run_fkey/);
      await db.query("rollback to savepoint s1");
      await expect(db.query(
        `insert into public.search_runs (dealership_id, agent_id, request_token, provider, agent_version, status, criteria_snapshot, started_at, created_at, rights_profile_id, rights_profile_version, expires_at)
         values ($1, $2, $3, 'synthetic-demo', 1, 'running', '{}', now(), now(), (select id from private.provider_rights_profiles where provider = 'synthetic-demo' and version = 1), 1, now() + interval '1 day')`,
        [B.firm, A.activeId, randomUUID()])).rejects.toThrow(/search_runs_agent_fkey/);
    } finally {
      await db.query("rollback");
    }
  });
});

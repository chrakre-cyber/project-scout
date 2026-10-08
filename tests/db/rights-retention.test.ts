/**
 * DEV-005B0 — rettighetsprofiler, retensjon og betrodd skrivevei (DEC-028, DEC-029, FU-005-1).
 * Brukerpåstander kjøres som ordinære innloggede brukere/anon. Lagring og avslutning går via rollen scout_ingest.
 * Tilstander som ellers ikke kan konstrueres (utløpt profil, utløpt kjøring) lages som databaseeier og rulles tilbake.
 */
import { randomBytes, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminDb, anonClient, assertLocal, cleanup, connectIngest, createFirmWithMember, createUser, READY, signIn, type TestUser } from "./harness";

interface Tenant { user: TestUser; firm: string; client: SupabaseClient; activeId: string }
type DbError = Error & { code?: string };

let db: Client;
let ingest: Client;
let closeIngest: () => Promise<void>;
let A: Tenant, B: Tenant;
const users: TestUser[] = [];
const HASH = "b".repeat(64);
const SUFFIX = randomBytes(3).toString("hex");

async function tenant(label: string): Promise<Tenant> {
  const user = await createUser(db, `rr-${label}`);
  users.push(user);
  const firm = await createFirmWithMember(db, `RR ${label}`, user);
  const client = await signIn(user);
  const r = await client.from("search_agents").insert({ dealership_id: firm, name: `${label}-active`, active: true, ...READY }).select("id").single();
  return { user, firm, client, activeId: r.data!.id as string };
}

const freshAgent = async (t: Tenant) => {
  await db.query("update public.search_agents set active = false where dealership_id = $1 and name = 'x' and active", [t.firm]);
  return (await t.client.from("search_agents").insert({ dealership_id: t.firm, name: "x", active: true, ...READY }).select("id").single()).data!.id as string;
};
const startRun = (t: Tenant, agentId: string) =>
  t.client.from("search_runs").insert({ agent_id: agentId, request_token: randomUUID(), provider: "synthetic-demo" })
    .select("id, status, expires_at, started_at, rights_profile_version").single();
/** Ny kjøring på en frisk agent; kaster hvis den ikke kan startes. */
async function newRun(t: Tenant) {
  const r = await startRun(t, await freshAgent(t));
  if (r.error) throw new Error(JSON.stringify(r.error));
  return r.data!;
}

const snap = (id: string, extra: Record<string, unknown> = {}) => ({ source: "synthetic-demo", sourceListingId: id, withheld: [], ...extra });
const row = (rank: number, id = `R-${rank}`, snapshot: Record<string, unknown> = snap(id), extra: Record<string, unknown> = {}) => ({
  source: "synthetic-demo", source_listing_id: id, content_hash: HASH, rank, match_status: "match", unknown_criteria: [], listing_snapshot: snapshot, ...extra,
});

async function trusted(sql: string, params: unknown[]): Promise<{ error: DbError | null; rows: Record<string, unknown>[] }> {
  try {
    return { error: null, rows: (await ingest.query(sql, params)).rows };
  } catch (e) {
    return { error: e as DbError, rows: [] };
  }
}
const store = (t: Tenant, runId: string, rows: object | object[]) =>
  trusted("select private.trusted_store_results($1::uuid, $2::uuid, $3::jsonb)", [t.firm, runId, JSON.stringify(Array.isArray(rows) ? rows : [rows])]);
const complete = (t: Tenant, runId: string, c: unknown) => trusted("select private.trusted_complete_run($1::uuid, $2::uuid, $3::jsonb)", [t.firm, runId, JSON.stringify(c)]);
const fail = (t: Tenant, runId: string, code: string) => trusted("select private.trusted_fail_run($1::uuid, $2::uuid, $3::text)", [t.firm, runId, code]);
const policy = (t: Tenant, runId: string) => trusted("select * from private.trusted_run_policy($1::uuid, $2::uuid)", [t.firm, runId]);
const purge = (batch: number | null = 500) => trusted("select * from private.purge_expired_search_runs($1::integer)", [batch]);

const runStatus = async (id: string) => (await db.query("select status, error_code from public.search_runs where id = $1", [id])).rows[0] as { status: string; error_code: string | null } | undefined;
const resultCount = async (id: string) => (await db.query("select count(*)::int n from public.search_run_results where search_run_id = $1", [id])).rows[0].n as number;

/** Endrer den syntetiske profilen som eier (vakttriggeren slås av kortvarig) og gjenoppretter alltid. */
async function tweakProfile(setSql: string, fn: () => Promise<void>) {
  const before = (await db.query("select * from private.provider_rights_profiles where provider = 'synthetic-demo' and version = 1")).rows[0];
  await db.query("alter table private.provider_rights_profiles disable trigger provider_rights_profiles_guard");
  try {
    await db.query(`update private.provider_rights_profiles set ${setSql} where id = $1`, [before.id]);
    await fn();
  } finally {
    await db.query(
      `update private.provider_rights_profiles set provider = $2, status = $3, effective_from = $4, effective_to = $5, retention_seconds = $6,
         allow_price = $7, allow_specs = $8, allow_text = $9, allow_images = $10, allow_seller_data = $11,
         verified_by = $12, verified_at = $13 where id = $1`,
      [before.id, before.provider, before.status, before.effective_from, before.effective_to, before.retention_seconds,
        before.allow_price, before.allow_specs, before.allow_text, before.allow_images, before.allow_seller_data, before.verified_by, before.verified_at]);
    await db.query("alter table private.provider_rights_profiles enable trigger provider_rights_profiles_guard");
  }
}

/** Gjør en kjøring (og dens resultater) utløpt/gammel som eier. */
async function backdate(runId: string, startedMinutesAgo: number) {
  await db.query("alter table public.search_runs disable trigger search_runs_before_update");
  try {
    await db.query("update public.search_runs set started_at = now() - make_interval(mins => $2), created_at = now() - make_interval(mins => $2), expires_at = now() - interval '1 minute' where id = $1", [runId, startedMinutesAgo]);
    await db.query("update public.search_run_results set expires_at = now() - interval '1 minute' where search_run_id = $1", [runId]);
  } finally {
    await db.query("alter table public.search_runs enable trigger search_runs_before_update");
  }
}

beforeAll(async () => {
  assertLocal();
  db = await adminDb();
  ({ ingest, close: closeIngest } = await connectIngest(db));
  A = await tenant("a");
  B = await tenant("b");
});
afterAll(async () => {
  if (db) {
    await db.query("delete from private.provider_rights_profiles where provider like $1", [`test-${SUFFIX}%`]);
    await cleanup(db, [A?.firm, B?.firm].filter(Boolean), users);
    await closeIngest?.();
    await db.end();
  }
});

describe("forfalskning av autoritative resultater er blokkert (FU-005-1)", () => {
  it("bruker kan starte en kjøring, men ikke lagre resultater eller avslutte den", async () => {
    const run = await newRun(A);
    expect((await A.client.from("search_run_results").insert({ search_run_id: run.id, ...row(1) })).error?.code).toBe("42501");
    for (const patch of [{ status: "completed", counts: { matches: 0, needsReview: 0 } }, { status: "failed", error_code: "internal" }, { counts: { matches: 99, needsReview: 0 } }, { expires_at: "2099-01-01T00:00:00Z" }]) {
      const r = await A.client.from("search_runs").update(patch).eq("id", run.id).select("id");
      expect(r.error?.code, JSON.stringify(patch)).toBe("42501");
    }
    expect(await runStatus(run.id)).toEqual({ status: "running", error_code: null });
    expect(await resultCount(run.id)).toBe(0);
  });

  it("anon kan ikke skrive, og brukerens kall mot de betrodde funksjonene avvises (ikke eksponert og ingen EXECUTE)", async () => {
    const run = await newRun(A);
    const anon = anonClient();
    expect((await anon.from("search_run_results").insert({ search_run_id: run.id, ...row(1) })).error).not.toBeNull();
    for (const fn of ["trusted_store_results", "trusted_complete_run", "trusted_fail_run", "trusted_run_policy", "purge_expired_search_runs"]) {
      const viaApi = await A.client.rpc(fn, {});
      expect(viaApi.error, fn).not.toBeNull();
      const viaSchema = await (A.client.schema("private" as never) as unknown as SupabaseClient).rpc(fn, {});
      expect(viaSchema.error?.code, fn).toBe("PGRST106");
    }
    // Direkte SQL som authenticated (som Data API gjør): ingen EXECUTE
    await db.query("begin");
    try {
      await db.query("select set_config('role', 'authenticated', true), set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: A.user.id, role: "authenticated" })]);
      await db.query("savepoint s");
      await expect(db.query("select private.trusted_complete_run($1::uuid, $2::uuid, '{}'::jsonb)", [A.firm, run.id])).rejects.toThrow(/permission denied/);
      await db.query("rollback to savepoint s");
      await expect(db.query("select * from private.purge_expired_search_runs(1)")).rejects.toThrow(/permission denied/);
    } finally {
      await db.query("rollback");
    }
    expect(await runStatus(run.id)).toEqual({ status: "running", error_code: null });
  });

  it("EXECUTE på de betrodde funksjonene har bare scout_ingest (og eieren); aldri anon, authenticated, service_role eller PUBLIC", async () => {
    const fns = ["trusted_run_policy(uuid, uuid)", "trusted_store_results(uuid, uuid, jsonb)", "trusted_complete_run(uuid, uuid, jsonb)",
      "trusted_fail_run(uuid, uuid, text)", "purge_expired_search_runs(integer)"];
    for (const f of fns) {
      for (const role of ["anon", "authenticated", "service_role", "public"]) {
        expect((await db.query("select has_function_privilege($1, $2, 'EXECUTE') ok", [role, `private.${f}`])).rows[0].ok, `${role} ${f}`).toBe(false);
      }
      expect((await db.query("select has_function_privilege('scout_ingest', $1, 'EXECUTE') ok", [`private.${f}`])).rows[0].ok, f).toBe(true);
    }
  });
});

describe("rollen scout_ingest er begrenset (ikke service-role)", () => {
  it("er ikke superbruker, kan ikke omgå RLS, har ingen rollemedlemskap, og har tidsgrense", async () => {
    const r = (await db.query("select rolsuper, rolbypassrls, rolcreatedb, rolcreaterole, rolinherit, rolreplication from pg_roles where rolname = 'scout_ingest'")).rows[0];
    expect(r).toEqual({ rolsuper: false, rolbypassrls: false, rolcreatedb: false, rolcreaterole: false, rolinherit: false, rolreplication: false });
    expect((await db.query("select count(*)::int n from pg_auth_members m join pg_roles r on r.oid = m.member where r.rolname = 'scout_ingest'")).rows[0].n).toBe(0);
    expect((await ingest.query("show statement_timeout")).rows[0].statement_timeout).toBe("30s");
  });

  it("har ingen tabellrettigheter, og kan ikke kjøre andre private funksjoner", async () => {
    for (const t of ["public.search_runs", "public.search_run_results", "public.search_agents", "public.dealerships", "public.dealership_members", "private.provider_rights_profiles", "auth.users"]) {
      const r = await trusted(`select 1 from ${t} limit 1`, []);
      expect(r.error?.message, t).toMatch(/permission denied/);
    }
    for (const sql of ["select private.admin_create_dealership('x')", "select private.agent_ready('{}'::jsonb, '{}'::jsonb)", "select * from private.rights_profile_in_force('synthetic-demo', now())"]) {
      expect((await trusted(sql, [])).error?.message, sql).toMatch(/permission denied/);
    }
    for (const sql of ["insert into public.search_runs (agent_id) values (gen_random_uuid())", "update public.search_agents set active = false", "delete from public.search_run_results"]) {
      expect((await trusted(sql, [])).error?.message, sql).toMatch(/permission denied/);
    }
  });

  it("firma-ID er en forventning: feil firma gir 'ikke funnet' og rører ingenting", async () => {
    const run = await newRun(A);
    const wrong = { firm: B.firm } as Tenant;
    for (const r of [await store(wrong, run.id, row(1)), await complete(wrong, run.id, { matches: 0, needsReview: 0 }), await fail(wrong, run.id, "internal"), await policy(wrong, run.id)]) {
      expect(r.error?.code).toBe("P0002");
    }
    const unknown = await store(A, randomUUID(), row(1));
    expect(unknown.error?.code).toBe("P0002");
    expect(await runStatus(run.id)).toEqual({ status: "running", error_code: null });
    expect(await resultCount(run.id)).toBe(0);
  });

  it("ugyldig input avvises: ikke-liste, tom liste og for mange rader", async () => {
    const run = await newRun(A);
    for (const payload of ["{}", "[]", JSON.stringify(Array.from({ length: 501 }, (_, i) => row(i + 1)))]) {
      const r = await trusted("select private.trusted_store_results($1::uuid, $2::uuid, $3::jsonb)", [A.firm, run.id, payload]);
      expect(r.error?.code).toBe("22023");
    }
    expect(await resultCount(run.id)).toBe(0);
  });

  it("lagring og avslutning via den betrodde veien virker og gir autoritative, tellerkonsistente rader", async () => {
    const run = await newRun(A);
    const pol = await policy(A, run.id);
    expect(pol.rows[0]).toMatchObject({ profile_version: 1, retention_seconds: 604800, allow_price: true, allow_specs: true, allow_text: false, allow_images: false, allow_seller_data: true });
    expect((await store(A, run.id, [row(1), row(2)])).error).toBeNull();
    expect((await complete(A, run.id, { matches: 2, needsReview: 0 })).error).toBeNull();
    const read = await A.client.from("search_run_results").select("rank, rights_profile_version, expires_at").eq("search_run_id", run.id).order("rank");
    expect(read.data).toHaveLength(2);
    expect(read.data![0]!.rights_profile_version).toBe(1);
  });
});

describe("rettighetsprofil: default-deny ved start", () => {
  it("kjøringen får profilversjon og expires_at = start + profilens retensjon", async () => {
    const run = await newRun(A);
    expect(run.rights_profile_version).toBe(1);
    const secs = (new Date(run.expires_at as string).getTime() - new Date(run.started_at as string).getTime()) / 1000;
    expect(secs).toBe(604800);
  });

  it.each([
    ["profil mangler (ingen verifisert/trukket profil for kilden)", "provider = 'synthetic-demo-x'", /search_run_rights_profile_missing/],
    ["profil er bare utkast", "status = 'draft', verified_by = null, verified_at = null", /search_run_rights_profile_missing/],
    ["profil er utløpt (effective_to passert)", "effective_to = now() - interval '1 second'", /search_run_rights_profile_expired/],
    ["profil er ikke i kraft ennå", "effective_from = now() + interval '1 hour'", /search_run_rights_profile_expired/],
    ["profil er trukket", "status = 'revoked'", /search_run_rights_profile_expired/],
    ["profil tillater ingen lagring (retensjon 0)", "retention_seconds = 0", /search_run_rights_storage_not_allowed/],
  ])("blokkerer start: %s", async (_label, setSql, message) => {
    const agent = await freshAgent(A);
    await tweakProfile(setSql as string, async () => {
      const stale = await startRun(A, agent); // skal feile; ingen bivirkninger
      expect(stale.error?.code).toBe("23514");
      expect(stale.error?.message).toMatch(message as RegExp);
    });
    expect((await db.query("select count(*)::int n from public.search_runs where agent_id = $1", [agent])).rows[0].n).toBe(0);
    expect((await startRun(A, agent)).error).toBeNull(); // profilen er gjenopprettet
  });

  it("en blokkert start har ingen bivirkninger: hengende kjøring blir ikke feilmerket", async () => {
    const agent = await freshAgent(A);
    const first = (await startRun(A, agent)).data!;
    await db.query("alter table public.search_runs disable trigger search_runs_before_update");
    try {
      await db.query("update public.search_runs set started_at = now() - interval '10 minutes' where id = $1", [first.id]);
    } finally {
      await db.query("alter table public.search_runs enable trigger search_runs_before_update");
    }
    await tweakProfile("effective_to = now() - interval '1 second'", async () => {
      expect((await startRun(A, agent)).error?.message).toMatch(/rights_profile_expired/);
    });
    expect((await runStatus(first.id))?.status).toBe("running"); // ikke satt til abandoned av den blokkerte starten
  });

  it("tenantsjekken kommer før rettighetssjekken: fremmed agent gir fortsatt identisk 42501 uten å avsløre profilstatus", async () => {
    await tweakProfile("effective_to = now() - interval '1 second'", async () => {
      const foreign = await startRun(B, A.activeId);
      const unknown = await startRun(B, randomUUID());
      expect(foreign.error?.code).toBe("42501");
      expect(foreign.error?.message).toBe(unknown.error?.message);
    });
  });
});

describe("rettighetsprofil: mens kjøringen pågår", () => {
  it("profilen utløper midt i kjøringen: lagring og fullføring nektes, men feilmerking er mulig", async () => {
    const run = await newRun(A);
    expect((await store(A, run.id, row(1))).error).toBeNull();
    await tweakProfile("effective_to = now() - interval '1 second'", async () => {
      expect((await store(A, run.id, row(2))).error?.message).toMatch(/search_run_rights_profile_expired/);
      expect((await complete(A, run.id, { matches: 1, needsReview: 0 })).error?.message).toMatch(/search_run_rights_profile_expired/);
      expect((await fail(A, run.id, "rights_blocked")).error).toBeNull();
    });
    expect(await runStatus(run.id)).toEqual({ status: "failed", error_code: "rights_blocked" });
  });

  it("kjøringen selv utløper (expires_at passert) før den fullføres: lagring og fullføring nektes", async () => {
    const run = await newRun(A);
    await backdate(run.id, 2);
    expect((await store(A, run.id, row(1))).error?.message).toMatch(/search_run_rights_profile_expired/);
    expect((await complete(A, run.id, { matches: 0, needsReview: 0 })).error?.message).toMatch(/search_run_rights_profile_expired/);
  });

  it("profilen er frosset per kjøring: en ny, strengere versjon påvirker ikke en kjøring som allerede pågår", async () => {
    const run = await newRun(A);
    expect((await policy(A, run.id)).rows[0]).toMatchObject({ profile_version: 1, allow_price: true });
    await tweakProfile("allow_price = false", async () => {
      // Policy leses fra kjøringens egen profil (samme rad her), og databasen håndhever den
      expect((await store(A, run.id, row(1, "R-1", snap("R-1", { price: { stated: "1", currency: "EUR", amountMinor: "100", basis: "unknown" } })))).error?.message).toMatch(/data_type_not_allowed/);
    });
  });
});

describe("rettighetsprofil: tillatte datatyper (fail closed)", () => {
  const priced = { price: { stated: "100", currency: "EUR", amountMinor: "10000", basis: "gross" } };
  const specced = { make: "Volkswagen", model: "Golf", fuel: "petrol" };
  const sellerd = { sellerType: "dealer", sellerCountry: "DE" };

  async function expectStore(setSql: string, snapshot: Record<string, unknown>, ok: boolean, pattern?: RegExp) {
    const run = await newRun(A);
    await tweakProfile(setSql, async () => {
      const r = await store(A, run.id, row(1, "R-1", { ...snap("R-1"), ...snapshot }));
      if (ok) expect(r.error, JSON.stringify(snapshot)).toBeNull();
      else {
        expect(r.error?.message, JSON.stringify(snapshot)).toMatch(pattern ?? /data_type_not_allowed/);
        expect(r.error?.code).toBe("23514");
      }
    });
    expect(await resultCount(run.id)).toBe(ok ? 1 : 0);
  }

  it("pris: bare med allow_price; null er alltid lov", async () => {
    await expectStore("allow_price = false", priced, false);
    await expectStore("allow_price = false", { price: null, withheld: ["price"] }, true);
    await expectStore("allow_price = true", priced, true);
  });
  it("spesifikasjoner: bare med allow_specs; null er alltid lov", async () => {
    await expectStore("allow_specs = false", specced, false);
    await expectStore("allow_specs = false", { make: null, model: null, withheld: ["specs"] }, true);
    await expectStore("allow_specs = true", specced, true);
  });
  it("selgerdata: bare med allow_seller_data; null er alltid lov", async () => {
    await expectStore("allow_seller_data = false", sellerd, false);
    await expectStore("allow_seller_data = false", { sellerType: null, sellerCountry: null }, true);
    await expectStore("allow_seller_data = true", sellerd, true);
  });
  it("tekst og bilder: avvist som standard, tillatt bare når profilen sier det", async () => {
    await expectStore("allow_text = false", { text: "Fin bil, ring 12345678" }, false);
    await expectStore("allow_images = false", { images: ["https://example.test/a.jpg"] }, false);
    await expectStore("allow_text = true", { text: "kort tekst" }, true);
    await expectStore("allow_images = true", { images: ["https://example.test/a.jpg"] }, true);
  });
  it("ukjente felt avvises uansett profil (nye datatyper krever ny migrasjon og profil)", async () => {
    await expectStore("allow_text = true, allow_images = true, allow_price = true, allow_specs = true, allow_seller_data = true", { vin: "WVWZZZ1KZAW000000" }, false);
    await expectStore("allow_text = true", { description: "x" }, false);
  });
});

describe("profiltabellen: versjonering og uforanderlighet", () => {
  const P = `test-${SUFFIX}`;
  const ins = (extra: Record<string, unknown> = {}) => {
    const v = { provider: P, version: 1, status: "draft", effective_from: "2026-01-01T00:00:00Z", effective_to: null, retention_seconds: 1800, source_ref: "testkontrakt", verified_by: null, verified_at: null, ...extra };
    return db.query(
      `insert into private.provider_rights_profiles (provider, version, status, effective_from, effective_to, retention_seconds, source_ref, verified_by, verified_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id`,
      [v.provider, v.version, v.status, v.effective_from, v.effective_to, v.retention_seconds, v.source_ref, v.verified_by, v.verified_at]);
  };
  const verified = { status: "verified", verified_by: "Test", verified_at: "2026-01-01T00:00:00Z" };
  const inForce = async (provider: string, at: string) => (await db.query("select version from private.rights_profile_in_force($1, $2::timestamptz)", [provider, at])).rows;

  it("krever kilde, positiv virkningsperiode, gyldig retensjon og verifisering for status verified", async () => {
    await expect(ins({ provider: `${P}-a`, source_ref: "" })).rejects.toThrow();
    await expect(ins({ provider: `${P}-a`, effective_to: "2025-01-01T00:00:00Z" })).rejects.toThrow();
    await expect(ins({ provider: `${P}-a`, retention_seconds: -1 })).rejects.toThrow();
    await expect(ins({ provider: `${P}-a`, retention_seconds: 315360001 })).rejects.toThrow();
    await expect(ins({ provider: `${P}-a`, status: "verified" })).rejects.toThrow(); // uten verifisert av/tidspunkt
    await expect(ins({ provider: "Ugyldig Navn" })).rejects.toThrow();
    await expect(ins({ provider: `${P}-a`, status: "ukjent" })).rejects.toThrow();
  });

  it("bare utkast og verifiserte profiler i kraft gir en gjeldende profil (default-deny)", async () => {
    const prov = `${P}-b`;
    await ins({ provider: prov, version: 1, effective_from: "2026-01-01T00:00:00Z", effective_to: "2026-06-01T00:00:00Z", ...verified });
    await ins({ provider: prov, version: 2, effective_from: "2026-06-01T00:00:00Z", status: "draft" });
    expect(await inForce(prov, "2026-03-01T00:00:00Z")).toEqual([{ version: 1 }]);
    expect(await inForce(prov, "2025-12-31T23:59:59Z")).toEqual([]);   // før virkningsdato
    expect(await inForce(prov, "2026-06-01T00:00:00Z")).toEqual([]);   // slutt er eksklusiv, v2 er bare utkast
    expect(await inForce("finnes-ikke", "2026-03-01T00:00:00Z")).toEqual([]);
  });

  it("to verifiserte profiler kan ikke overlappe for samme provider; etterfølger uten overlapp går", async () => {
    const prov = `${P}-c`;
    await ins({ provider: prov, version: 1, effective_to: "2026-06-01T00:00:00Z", ...verified });
    await expect(ins({ provider: prov, version: 2, effective_from: "2026-05-01T00:00:00Z", ...verified })).rejects.toThrow(/rights_profile_overlap/);
    await expect(ins({ provider: prov, version: 2, effective_from: "2026-06-01T00:00:00Z", ...verified })).resolves.toBeTruthy();
    // utkast kan overlappe, men kan ikke verifiseres
    const d = await ins({ provider: prov, version: 3, effective_from: "2026-07-01T00:00:00Z" });
    await expect(db.query("update private.provider_rights_profiles set status = 'verified', verified_by = 'T', verified_at = now() where id = $1", [d.rows[0].id])).rejects.toThrow(/rights_profile_overlap/);
    // samme provider+versjon to ganger
    await expect(ins({ provider: prov, version: 1, effective_from: "2030-01-01T00:00:00Z" })).rejects.toThrow(/provider_rights_profiles_version_key/);
  });

  it("en profil er uforanderlig bortsett fra å trekkes tilbake eller få forkortet slutt", async () => {
    const prov = `${P}-d`;
    const id = (await ins({ provider: prov, ...verified })).rows[0].id;
    const upd = (set: string) => db.query(`update private.provider_rights_profiles set ${set} where id = $1`, [id]);
    await expect(upd("retention_seconds = 999999")).rejects.toThrow(/rights_profile_immutable/);
    await expect(upd("allow_text = true")).rejects.toThrow(/rights_profile_immutable/);
    await expect(upd("source_ref = 'annet'")).rejects.toThrow(/rights_profile_immutable/);
    await expect(upd("effective_from = '2025-01-01T00:00:00Z'")).rejects.toThrow(/rights_profile_immutable/);
    await expect(upd("provider = 'annen'")).rejects.toThrow(/rights_profile_immutable/);
    await expect(upd("status = 'draft'")).rejects.toThrow(/rights_profile_immutable/);
    await expect(upd("verified_by = 'Noen andre'")).rejects.toThrow(/rights_profile_immutable/);
    await expect(upd("effective_to = '2027-01-01T00:00:00Z'")).resolves.toBeTruthy();     // forkorte fra åpen slutt
    await expect(upd("effective_to = '2028-01-01T00:00:00Z'")).rejects.toThrow(/rights_profile_immutable/); // ikke forlenge
    await expect(upd("effective_to = null")).rejects.toThrow(/rights_profile_immutable/);
    await expect(upd("status = 'revoked'")).resolves.toBeTruthy();
    await expect(upd("status = 'verified'")).rejects.toThrow(/rights_profile_immutable/); // trukket kan ikke gjenopprettes
    expect(await inForce(prov, "2026-03-01T00:00:00Z")).toEqual([]);
  });

  it("en profil som er brukt av en kjøring kan ikke slettes", async () => {
    await expect(db.query("delete from private.provider_rights_profiles where provider = 'synthetic-demo'")).rejects.toThrow(/foreign key|violates/);
  });

  it("tabellen er lukket for alle utenom eieren: RLS på, ingen rettigheter for anon/authenticated/service_role/PUBLIC", async () => {
    expect((await db.query("select relrowsecurity from pg_class where oid = 'private.provider_rights_profiles'::regclass")).rows[0].relrowsecurity).toBe(true);
    for (const role of ["anon", "authenticated", "service_role", "public"]) {
      for (const priv of ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"]) {
        expect((await db.query("select has_table_privilege($1, 'private.provider_rights_profiles', $2) ok", [role, priv])).rows[0].ok, `${role} ${priv}`).toBe(false);
      }
    }
  });
});

describe("retensjon: utløpte rader er usynlige og kan slettes", () => {
  async function completedRun(t: Tenant, n = 2) {
    const run = await newRun(t);
    expect((await store(t, run.id, Array.from({ length: n }, (_, i) => row(i + 1)))).error).toBeNull();
    expect((await complete(t, run.id, { matches: n, needsReview: 0 })).error).toBeNull();
    return run.id as string;
  }

  it("utløpte kjøringer og resultater er usynlige for eieren umiddelbart (før sletting), andre er upåvirket", async () => {
    const live = await completedRun(A);
    const old = await completedRun(A);
    await backdate(old, 10);
    expect((await A.client.from("search_runs").select("id").eq("id", old)).data).toEqual([]);
    expect((await A.client.from("search_run_results").select("id").eq("search_run_id", old)).data).toEqual([]);
    expect((await A.client.from("search_runs").select("id").eq("id", live)).data).toEqual([{ id: live }]);
    expect((await A.client.from("search_run_results").select("id").eq("search_run_id", live)).data).toHaveLength(2);
    expect(await resultCount(old)).toBe(2); // fortsatt i databasen til purge
    const count = await A.client.from("search_runs").select("*", { count: "exact", head: true }).eq("id", old);
    expect(count.count).toBe(0);
  });

  it("purge sletter utløpte avsluttede kjøringer med resultater, på tvers av firma, og lar resten stå", async () => {
    const expiredA = await completedRun(A);
    const expiredB = await completedRun(B);
    const expiredFailed = (await newRun(A)).id as string;
    await fail(A, expiredFailed, "timeout");
    const liveCompleted = await completedRun(A);
    const liveRunning = (await newRun(B)).id as string;
    const runningExpiredFresh = (await newRun(A)).id as string; // utløpt, men startet nylig: fortsatt «pågår»
    const runningExpiredStuck = (await newRun(B)).id as string; // utløpt og hengende > 5 min: avbrytes, så slettes
    for (const id of [expiredA, expiredB, expiredFailed]) await backdate(id, 10);
    await backdate(runningExpiredFresh, 2);
    await backdate(runningExpiredStuck, 10);

    const res = await purge(500);
    expect(res.error).toBeNull();
    expect(Number(res.rows[0]!.runs_deleted)).toBeGreaterThanOrEqual(4);
    expect(Number(res.rows[0]!.results_deleted)).toBeGreaterThanOrEqual(4);
    for (const gone of [expiredA, expiredB, expiredFailed, runningExpiredStuck]) expect(await runStatus(gone), gone).toBeUndefined();
    for (const gone of [expiredA, expiredB]) expect(await resultCount(gone)).toBe(0);
    for (const kept of [liveCompleted, liveRunning, runningExpiredFresh]) expect(await runStatus(kept), kept).toBeDefined();
    expect(await resultCount(liveCompleted)).toBe(2);
    expect((await runStatus(runningExpiredFresh))?.status).toBe("running");
    // ingen foreldreløse resultater
    expect((await db.query("select count(*)::int n from public.search_run_results x where not exists (select 1 from public.search_runs r where r.id = x.search_run_id)")).rows[0].n).toBe(0);
  });

  it("purge er idempotent, respekterer batch-grensen og ugyldig batch avvises", async () => {
    const ids = [await completedRun(A, 1), await completedRun(A, 1), await completedRun(B, 1)];
    for (const id of ids) await backdate(id, 10);
    let rounds = 0;
    while ((await Promise.all(ids.map(runStatus))).some(Boolean) && rounds++ < 20) {
      const r = await purge(1);
      expect(r.error).toBeNull();
      expect(Number(r.rows[0]!.runs_deleted)).toBeLessThanOrEqual(1);
    }
    expect((await Promise.all(ids.map(runStatus))).every((s) => s === undefined)).toBe(true);
    const again = await purge(500);
    expect(again.error).toBeNull();
    for (const bad of [0, 5001, null]) expect((await purge(bad)).error?.code, String(bad)).toBe("22023");
  });

  it("purge rører ikke agenter, medlemskap eller firma", async () => {
    const id = await completedRun(A);
    await backdate(id, 10);
    const before = (await db.query("select (select count(*) from public.search_agents where dealership_id = any($1::uuid[]))::int a, (select count(*) from public.dealership_members where dealership_id = any($1::uuid[]))::int m", [[A.firm, B.firm]])).rows[0];
    await purge(500);
    const after = (await db.query("select (select count(*) from public.search_agents where dealership_id = any($1::uuid[]))::int a, (select count(*) from public.dealership_members where dealership_id = any($1::uuid[]))::int m", [[A.firm, B.firm]])).rows[0];
    expect(after).toEqual(before);
  });
});

describe("backfill og migrering", () => {
  it("alle eksisterende rader har rettighetsprofil, profilversjon og expires_at etter migreringen", async () => {
    for (const t of ["search_runs", "search_run_results"]) {
      const nulls = (await db.query(`select count(*)::int n from public.${t} where rights_profile_version is null or expires_at is null`)).rows[0].n;
      expect(nulls, t).toBe(0);
    }
    expect((await db.query("select count(*)::int n from public.search_runs r where not exists (select 1 from private.provider_rights_profiles p where p.id = r.rights_profile_id)")).rows[0].n).toBe(0);
  });

  it("synthetic-demo har en eksplisitt, verifisert profil med trygg test-retensjon og uten tekst/bilder", async () => {
    const p = (await db.query("select * from private.provider_rights_profiles where provider = 'synthetic-demo' and version = 1")).rows[0];
    expect(p).toMatchObject({ status: "verified", retention_seconds: 604800, allow_price: true, allow_specs: true, allow_text: false, allow_images: false, allow_seller_data: true, effective_to: null });
    expect(p.source_ref).toMatch(/syntetisk/i);
    expect(p.verified_by).toBeTruthy();
  });
});

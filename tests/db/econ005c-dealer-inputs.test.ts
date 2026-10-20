/**
 * ECON-005c — forhandlerinput og firmaprofil: firmabundet RLS, firmabinding via søket, nøkkel (søk, kandidat, revisjon, schemaversjon), strukturvalidering,
 * uforanderlighet og samsvar med TypeScript-parseren. Samme oppsett som `search-drafts.test.ts`: oppsett som databaseeier; alle tilgangspåstander som rolle
 * `authenticated` (JWT-claims) eller `anon` — aldri service-role. Kjøres mot lokal Supabase eller den isolerte klyngen
 * (`bash scripts/test-db-isolated.sh tests/db/econ005c-dealer-inputs.test.ts`; der finnes verken Auth eller PostgREST, så bevisene gjelder PostgreSQL-motorens RLS,
 * rettigheter, constraints og triggere — ikke HTTP-laget).
 */
import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEMO_CATALOG } from "@/adapters/search-catalog/demo-catalog";
import type { SearchSpecJson } from "@/domain/search-v2/serialization";
import { parseDealerInput, parseDealerProfile } from "@/domain/search-economics";
import { EXAMPLES } from "@/server/search-examples";
import { parseSearchFormValues } from "@/server/search-form";
import { adminDb, assertLocal, cleanup, createFirmWithMember, createUser, type TestUser } from "./harness";
import { dealerInput } from "../fixtures/economics-005c";

let db: Client;
let a: TestUser, b: TestUser, loner: TestUser;
let firmA = "", firmB = "";
let draftA = "", draftB = "";
const users: TestUser[] = [];
const firms: string[] = [];
const CAND = { id: "13:synthetic-demo/ad-1", version: "rev1:" + "a".repeat(64) };
const CTX = { costBasis: "[]", registrationScenario: "passenger", rightsDigest: "c".repeat(64) };

async function as(user: TestUser | null, sql: string, params: unknown[] = [], commit = false) {
  await db.query("begin");
  try {
    await db.query("select set_config('role', $1, true), set_config('request.jwt.claims', $2, true)", [
      user ? "authenticated" : "anon", JSON.stringify(user ? { sub: user.id, role: "authenticated" } : { role: "anon" })]);
    const r = await db.query(sql, params);
    await db.query(commit ? "commit" : "rollback");
    return { ok: true as const, rows: r.rows as Record<string, unknown>[], rowCount: r.rowCount ?? 0 };
  } catch (e) {
    await db.query("rollback");
    const err = e as { code?: string; message?: string };
    return { ok: false as const, code: err.code ?? "", message: err.message ?? "" };
  }
}
const bmw = (): SearchSpecJson => {
  const r = parseSearchFormValues({ ...EXAMPLES.find((e) => e.id === "demo-bmw")!.values() }, DEMO_CATALOG);
  if (!r.ok || !r.json) throw new Error("eksempel ugyldig");
  return r.json;
};

beforeAll(async () => {
  assertLocal();
  db = await adminDb();
  a = await createUser(db, "econ-a"); b = await createUser(db, "econ-b"); loner = await createUser(db, "econ-nomember");
  users.push(a, b, loner);
  firmA = await createFirmWithMember(db, "Econ Firma A", a);
  firmB = await createFirmWithMember(db, "Econ Firma B", b);
  firms.push(firmA, firmB);
  const da = await as(a, "insert into public.search_drafts (name, spec) values ('A-søk', $1::jsonb) returning id", [JSON.stringify(bmw())], true);
  const dbb = await as(b, "insert into public.search_drafts (name, spec) values ('B-søk', $1::jsonb) returning id", [JSON.stringify(bmw())], true);
  if (!da.ok || !dbb.ok) throw new Error("oppsett av søk feilet");
  draftA = da.rows[0]!.id as string; draftB = dbb.rows[0]!.id as string;
});
afterAll(async () => { if (db) { await cleanup(db, firms, users); await db.end(); } });

const ins = (user: TestUser | null, search: string, over: Record<string, unknown> = {}, commit = false) => {
  const v = { search_id: search, candidate_id: CAND.id, candidate_version: CAND.version, input_schema_version: 1, payload: dealerInput(), context: CTX, ...over };
  return as(user, "insert into public.dealer_economics_inputs (search_id, candidate_id, candidate_version, input_schema_version, payload, context) values ($1, $2, $3, $4, $5::jsonb, $6::jsonb) returning *",
    [v.search_id, v.candidate_id, v.candidate_version, v.input_schema_version, JSON.stringify(v.payload), JSON.stringify(v.context)], commit);
};

describe("opprettelse: firma utledes av databasen og søket må tilhøre firmaet", () => {
  it("eget søk: firma fra membership, bekreftelsesbruker og -tid satt av databasen, innhold bevart uendret", async () => {
    const r = await ins(a, draftA);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const row = r.rows[0]!;
    expect(row).toMatchObject({ dealership_id: firmA, search_id: draftA, candidate_id: CAND.id, candidate_version: CAND.version, input_schema_version: 1, confirmed_by: a.id });
    expect(row.payload).toEqual(dealerInput());
    expect(row.context).toEqual(CTX);
    expect(row.confirmed_at).toBeInstanceOf(Date);
  });
  it("klienten kan ikke oppgi firma, bruker, tidspunkt eller id (kolonnerettigheter 42501)", async () => {
    for (const [col, val] of [["dealership_id", `'${firmB}'`], ["confirmed_by", `'${b.id}'`], ["confirmed_at", "now()"], ["id", "gen_random_uuid()"], ["created_at", "now()"]] as const) {
      const r = await as(a, `insert into public.dealer_economics_inputs (search_id, candidate_id, candidate_version, input_schema_version, payload, context, ${col}) values ($1, 'c', 'v', 1, '{"schemaVersion":1}'::jsonb, $2::jsonb, ${val})`, [draftA, JSON.stringify(CTX)]);
      expect(r.ok, col).toBe(false);
      if (!r.ok) expect(r.code, col).toBe("42501");
    }
  });
  it("søk i annet firma og ukjent søk gir samme feil (FK 23503) — ingen lekkasje om fremmede søk", async () => {
    const foreign = await ins(a, draftB);
    const unknown = await ins(a, "99999999-9999-4999-8999-999999999999");
    expect(foreign.ok).toBe(false); expect(unknown.ok).toBe(false);
    if (!foreign.ok && !unknown.ok) { expect(foreign.code).toBe("23503"); expect(unknown.code).toBe("23503"); }
  });
  it("bruker uten medlemskap kan ikke opprette (RLS/trigger), og anon har ingen tilgang (42501)", async () => {
    const l = await ins(loner, draftA);
    expect(l.ok).toBe(false);
    if (!l.ok) expect(l.code).toBe("42501");
    const n = await ins(null, draftA);
    expect(n.ok).toBe(false);
    if (!n.ok) expect(n.code).toBe("42501");
    const s = await as(null, "select * from public.dealer_economics_inputs");
    expect(s.ok).toBe(false);
  });
  it("nøkkelen er unik per (firma, søk, kandidat, revisjon, schemaversjon); ny revisjon eller annen kandidat er egne rader", async () => {
    await db.query("begin");
    await db.query("rollback");
    const first = await ins(a, draftA, {}, true);
    expect(first.ok).toBe(true);
    const dup = await ins(a, draftA);
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.code).toBe("23505");
    expect((await ins(a, draftA, { candidate_version: "rev1:" + "b".repeat(64) }, true)).ok).toBe(true);
    expect((await ins(a, draftA, { candidate_id: "13:synthetic-demo/ad-2" }, true)).ok).toBe(true);
    // samme kandidat og revisjon i firma B (eget søk) er en egen rad
    expect((await ins(b, draftB, {}, true)).ok).toBe(true);
    const mine = await as(a, "select count(*)::int n from public.dealer_economics_inputs");
    expect(mine.ok && mine.rows[0]!.n).toBe(3);
  });
});

describe("firmaisolasjon (RLS)", () => {
  it("hvert firma ser bare sine egne rader; direkte oppslag på andres søk gir ingenting", async () => {
    const ra = await as(a, "select dealership_id from public.dealer_economics_inputs");
    const rb = await as(b, "select dealership_id from public.dealer_economics_inputs");
    expect(ra.ok && ra.rows.every((r) => r.dealership_id === firmA) && ra.rows.length).toBeGreaterThan(0);
    expect(rb.ok && rb.rows.every((r) => r.dealership_id === firmB) && rb.rows.length).toBe(1);
    const peek = await as(a, "select * from public.dealer_economics_inputs where search_id = $1", [draftB]);
    expect(peek.ok && peek.rows).toEqual([]);
    const lone = await as(loner, "select * from public.dealer_economics_inputs");
    expect(lone.ok && lone.rows).toEqual([]);
  });
  it("andre firmaers rader kan ikke endres (0 rader) og ingen kan slette (42501)", async () => {
    const upd = await as(b, "update public.dealer_economics_inputs set payload = '{\"schemaVersion\":1}'::jsonb where search_id = $1", [draftA]);
    expect(upd.ok && upd.rowCount).toBe(0);
    const del = await as(a, "delete from public.dealer_economics_inputs");
    expect(del.ok).toBe(false);
    if (!del.ok) expect(del.code).toBe("42501");
    const trunc = await as(a, "truncate public.dealer_economics_inputs");
    expect(trunc.ok).toBe(false);
  });
  it("firma-id fra klienten kan ikke flytte en rad til et annet firma eller endre nøkkelen (kolonnerettigheter)", async () => {
    for (const col of ["dealership_id", "search_id", "candidate_id", "candidate_version", "input_schema_version", "confirmed_by"]) {
      const val = col === "dealership_id" ? `'${firmB}'` : col === "search_id" ? `'${draftB}'` : col === "input_schema_version" ? "2" : col === "confirmed_by" ? `'${b.id}'` : "'x'";
      const r = await as(a, `update public.dealer_economics_inputs set ${col} = ${val} where search_id = $1`, [draftA]);
      expect(r.ok, col).toBe(false);
      if (!r.ok) expect(r.code, col).toBe("42501");
    }
  });
});

describe("ny bekreftelse og uforanderlighet", () => {
  it("endret innhold = ny bekreftelse: bruker og tidspunkt settes av databasen; uendret innhold beholder dem", async () => {
    const before = await as(a, "select confirmed_at, confirmed_by, updated_at from public.dealer_economics_inputs where search_id = $1 and candidate_id = $2 and candidate_version = $3", [draftA, CAND.id, CAND.version]);
    if (!before.ok) throw new Error("mangler rad");
    await new Promise((r) => setTimeout(r, 15));
    const same = await as(a, "update public.dealer_economics_inputs set payload = payload where search_id = $1 and candidate_id = $2 and candidate_version = $3 returning confirmed_at, confirmed_by", [draftA, CAND.id, CAND.version], true);
    expect(same.ok && same.rows[0]!.confirmed_at).toEqual(before.rows[0]!.confirmed_at);
    const changed = await as(a, "update public.dealer_economics_inputs set payload = $4::jsonb where search_id = $1 and candidate_id = $2 and candidate_version = $3 returning confirmed_at, confirmed_by, payload", [draftA, CAND.id, CAND.version, JSON.stringify(dealerInput({ deduction: "unknown" }))], true);
    expect(changed.ok).toBe(true);
    if (changed.ok) {
      expect(changed.rows[0]!.confirmed_by).toBe(a.id);
      expect((changed.rows[0]!.confirmed_at as Date).getTime()).toBeGreaterThan((before.rows[0]!.confirmed_at as Date).getTime());
      expect((changed.rows[0]!.payload as { deduction: string }).deduction).toBe("unknown");
    }
  });
});

describe("strukturvalidering i databasen", () => {
  const bad: Array<[string, unknown]> = [
    ["ukjent toppnøkkel", { schemaVersion: 1, dealershipId: firmB }], ["ukjent toppnøkkel (listing_claim)", { schemaVersion: 1, listingClaim: {} }], ["feil schemaversjon", { schemaVersion: 2 }],
    ["manglende schemaversjon", { deduction: "unknown" }], ["ikke et objekt", [1]], ["streng", "x"], ["seksjon er ikke objekt", { schemaVersion: 1, propulsion: "diesel" }],
    ["ugyldig fradragsverdi", { schemaVersion: 1, deduction: "yes" }], ["ugyldig mva.-håndtering", { schemaVersion: 1, vatHandling: "registered" }],
    ["tom evidenceRef", { schemaVersion: 1, evidenceRef: "" }], ["evidenceRef ikke tekst", { schemaVersion: 1, evidenceRef: 5 }],
    ["for stor", { schemaVersion: 1, evidenceRef: "x".repeat(50), lineScopes: Object.fromEntries(Array.from({ length: 400 }, (_, i) => [`line-${i}`, { split: { toBorderMinor: "100000000000", afterBorderMinor: "100000000000" } }])) }],
  ];
  it.each(bad)("avviser payload: %s (23514)", async (_n, payload) => {
    const r = await ins(a, draftA, { candidate_id: "bad-" + Math.random().toString(36).slice(2), payload });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("23514");
  });
  it.each([
    ["mangler felt", { costBasis: "[]", registrationScenario: "passenger" }], ["ekstra felt", { ...CTX, extra: 1 }], ["ukjent scenario", { ...CTX, registrationScenario: "truck" }],
    ["avtrykk ikke hex", { ...CTX, rightsDigest: "xyz" }], ["avtrykk feil lengde", { ...CTX, rightsDigest: "c".repeat(63) }], ["kostnadsgrunnlag ikke tekst", { ...CTX, costBasis: [] }],
  ])("avviser kontekst: %s (23514)", async (_n, context) => {
    const r = await ins(a, draftA, { candidate_id: "ctx-" + Math.random().toString(36).slice(2), context });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("23514");
  });
  it.each([["tom kandidat-id", { candidate_id: "" }], ["kandidat-id med styretegn", { candidate_id: "a\nb" }], ["tom revisjon", { candidate_version: "" }], ["schemaversjon 2", { input_schema_version: 2 }]])("avviser nøkkel: %s (23514)", async (_n, over) => {
    const r = await ins(a, draftA, over);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("23514");
  });
  it("samsvar med TypeScript-parseren: alt parseren godtar, godtar databasen (databasen er en grovere strukturgrense); alt databasen avviser av formgrunner avviser parseren", async () => {
    const corpus: unknown[] = [
      dealerInput(), { schemaVersion: 1 }, dealerInput({ deduction: "unknown", vatHandling: "unknown" }), dealerInput({ lineScopes: { transport: "to_border", ins: { split: { toBorderMinor: "1", afterBorderMinor: "2" } } } }),
      dealerInput({ fx: { acquisition: { pair: "EUR/NOK", rate: "11.5", sourceLabel: "Bank", quotedAt: "2026-10-19" } } }), ...bad.map(([, p]) => p),
    ];
    let i = 0;
    for (const p of corpus) {
      const ts = parseDealerInput(p).ok;
      const r = await ins(a, draftA, { candidate_id: `corpus-${i++}`, payload: p });
      if (ts) expect(r.ok, JSON.stringify(p).slice(0, 80)).toBe(true);
      if (!r.ok) expect(ts, JSON.stringify(p).slice(0, 80)).toBe(false);
    }
  });
});

describe("firmaprofil (mva.-håndtering og fradrag; standard ukjent)", () => {
  const prof = (user: TestUser | null, payload: unknown, commit = false) => as(user, "insert into public.dealer_economics_profiles (payload) values ($1::jsonb) returning *", [JSON.stringify(payload)], commit);
  it("firma fra membership, én rad per firma, brukeren registreres; klienten kan ikke oppgi firma", async () => {
    const r = await prof(a, { schemaVersion: 1, vatHandling: "unknown", deduction: "unknown" }, true);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.rows[0]).toMatchObject({ dealership_id: firmA, updated_by: a.id });
    const dup = await prof(a, { schemaVersion: 1 });
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.code).toBe("23505");
    const withFirm = await as(a, "insert into public.dealer_economics_profiles (payload, dealership_id) values ('{\"schemaVersion\":1}'::jsonb, $1)", [firmB]);
    expect(withFirm.ok).toBe(false);
    if (!withFirm.ok) expect(withFirm.code).toBe("42501");
  });
  it.each([[{ schemaVersion: 1, dealershipId: firmB }], [{ schemaVersion: 2 }], [{ schemaVersion: 1, vatHandling: "x" }], [{ schemaVersion: 1, deduction: true }], [[]], [{}]])("ugyldig profil %j avvises (23514)", async (payload) => {
    const r = await prof(b, payload);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("23514");
  });
  it("isolasjon: B ser ikke A sin profil og kan ikke endre den; uten medlemskap og anon avvises; endring registrerer bruker; sletting er ikke mulig", async () => {
    expect((await as(b, "select * from public.dealer_economics_profiles")).ok).toBe(true);
    const peek = await as(b, "select * from public.dealer_economics_profiles where dealership_id = $1", [firmA]);
    expect(peek.ok && peek.rows).toEqual([]);
    const upd = await as(b, "update public.dealer_economics_profiles set payload = '{\"schemaVersion\":1,\"deduction\":\"recoverable\"}'::jsonb where dealership_id = $1", [firmA]);
    expect(upd.ok && upd.rowCount).toBe(0);
    const own = await as(a, "update public.dealer_economics_profiles set payload = '{\"schemaVersion\":1,\"deduction\":\"recoverable\"}'::jsonb returning updated_by, payload", [], true);
    expect(own.ok && own.rows[0]).toMatchObject({ updated_by: a.id, payload: { schemaVersion: 1, deduction: "recoverable" } });
    expect((await prof(loner, { schemaVersion: 1 })).ok).toBe(false);
    expect((await prof(null, { schemaVersion: 1 })).ok).toBe(false);
    const del = await as(a, "delete from public.dealer_economics_profiles");
    expect(del.ok).toBe(false);
    const moveFirm = await as(a, "update public.dealer_economics_profiles set dealership_id = $1", [firmB]);
    expect(moveFirm.ok).toBe(false);
  });
  it("samsvar med TypeScript: parseren godtar ⇒ databasen godtar; databasen avviser ⇒ parseren avviser", async () => {
    const corpus: unknown[] = [{ schemaVersion: 1 }, { schemaVersion: 1, vatHandling: "unknown" }, { schemaVersion: 1, deduction: "recoverable" }, { schemaVersion: 1, dealershipId: firmB }, { schemaVersion: 1, vatHandling: "x" }, { schemaVersion: 3 }, {}, []];
    for (const p of corpus) {
      const ts = parseDealerProfile(p).ok;
      const r = await prof(b, p);
      if (ts) expect(r.ok, JSON.stringify(p)).toBe(true);
      if (!r.ok) expect(ts, JSON.stringify(p)).toBe(false);
    }
  });
});

describe("ingen lagring av avledede resultater", () => {
  it("tabellene har ingen kolonner for beregnede tall, bare nøkkel, innhold, kontekst og revisjonsfelt", async () => {
    const cols = (await db.query("select table_name, array_agg(column_name::text order by column_name) c from information_schema.columns where table_schema = 'public' and table_name in ('dealer_economics_inputs','dealer_economics_profiles') group by 1 order by 1")).rows;
    expect(cols).toEqual([
      { table_name: "dealer_economics_inputs", c: ["candidate_id", "candidate_version", "confirmed_at", "confirmed_by", "context", "created_at", "dealership_id", "id", "input_schema_version", "payload", "search_id", "updated_at"] },
      { table_name: "dealer_economics_profiles", c: ["created_at", "dealership_id", "payload", "updated_at", "updated_by"] },
    ]);
  });
});

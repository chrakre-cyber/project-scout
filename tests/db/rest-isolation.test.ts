/**
 * L6 — firmaskille gjennom EKTE PostgREST med EKTE JWT-er (CI-001 trinn 1). Dekker `search_drafts`, `dealer_economics_inputs` og `dealer_economics_profiles`:
 * tillatte operasjoner i eget firma (POST/GET/PATCH, duplikat) og avvisning på tvers av firma (GET/PATCH/DELETE/POST, falsk `dealership_id`/`search_id`, embed, `anon`,
 * bruker uten firma, forfalsket token). Oppsett (brukere, firma, medlemskap) som databaseeier; påstandene som ordinær bruker via Auth + PostgREST (publishable key,
 * aldri service-role). Hver negativ påstand kontrolleres også i databasen (raden finnes uendret / finnes ikke). Krever lokal Supabase (Auth + PostgREST); i den isolerte
 * klyngen feiler testene i stedet for å hoppes over. Komplementerer `econ005c-dealer-inputs.test.ts`, som bare bruker SET ROLE/claims uten HTTP-laget.
 */
import type { Client } from "pg";
import { appendFileSync } from "node:fs";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DEMO_CATALOG } from "@/adapters/search-catalog/demo-catalog";
import type { SearchSpecJson } from "@/domain/search-v2/serialization";
import { EXAMPLES } from "@/server/search-examples";
import { parseSearchFormValues } from "@/server/search-form";
import { dealerInput } from "../fixtures/economics-005c";
import { adminDb, assertTarget, cleanup, createFirmWithMember, createUser, env, signIn, type TestUser } from "./harness";

type J = Record<string, unknown>;
let db: Client;
let a: TestUser, b: TestUser, loner: TestUser;
let firmA = "", firmB = "";
let tokA = "", tokB = "", tokLoner = "";
let draftA: J, draftB: J, inputA: J, inputB: J;
const users: TestUser[] = [];
const firms: string[] = [];
const CAND = { id: "13:synthetic-demo/rest-1", version: `rev1:${"a".repeat(64)}` };
const CTX = { costBasis: "[]", registrationScenario: "passenger", rightsDigest: "c".repeat(64) };
const PROFILE = { schemaVersion: 1, vatHandling: "unknown", deduction: "unknown" };

const spec = (): SearchSpecJson => {
  const r = parseSearchFormValues({ ...EXAMPLES.find((e) => e.id === "demo-bmw")!.values() }, DEMO_CATALOG);
  if (!r.ok || !r.json) throw new Error("eksempel ugyldig");
  return r.json;
};

// Avgrenset diagnostikk (CI-001): for en test som feiler lagres bare operasjon, tabellnavn, HTTP-status og SQLSTATE/PostgREST-kode i rekkefølge — aldri respons, payload, filterverdier, headere eller URL.
// Skrives til filen i SCOUT_L6_DIAG_FILE (satt av orkestreringen); uten miljøvariabelen skjer ingenting. Endrer ingen påstander.
let trace: string[] = [];
beforeEach(() => { trace = []; });
afterEach((ctx) => {
  const file = process.env.SCOUT_L6_DIAG_FILE;
  const failed = ctx.task.result?.state === "fail" || (ctx.task.result?.errors?.length ?? 0) > 0;
  if (!file || !failed) return;
  const fullName = [ctx.task.suite?.name, ctx.task.name].filter(Boolean).join(" ");
  try { appendFileSync(file, trace.map((t, i) => `L6DIAG\t${fullName}\t${i + 1}\t${t}\n`).join("")); } catch { /* diagnostikk er valgfri */ }
});
const noteTrace = (method: string, path: string, status: number, code: string | undefined) => {
  const table = /^[a-z_]+/.exec(path)?.[0] ?? "-";
  trace.push(`${method}\t${table}\t${status}\t${code && /^[0-9A-Z]{5}$|^PGRST\d{3}$/.test(code) ? code : "-"}`);
};

async function rest(method: string, path: string, token: string | null, body?: unknown, prefer = "return=representation") {
  const headers: Record<string, string> = { apikey: env.key, Prefer: prefer, ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { "Content-Type": "application/json" } : {}) };
  const res = await fetch(`${env.url}/rest/v1/${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let json: unknown = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* ikke JSON */ }
  const code = ((json ?? {}) as J).code as string | undefined;
  noteTrace(method, path, res.status, code);
  return { status: res.status, json, text, rows: Array.isArray(json) ? (json as J[]) : [], code };
}
const tokenOf = async (u: TestUser) => (await (await signIn(u)).auth.getSession()).data.session!.access_token;
const count = async (sql: string, params: unknown[] = []) => (await db.query(sql, params)).rows[0].n as number;
const noTraceOfOther = (text: string, ...ids: string[]) => { for (const id of ids) expect(text).not.toContain(id); };

beforeAll(async () => {
  assertTarget();
  db = await adminDb();
  a = await createUser(db, "rest-a"); b = await createUser(db, "rest-b"); loner = await createUser(db, "rest-nofirm");
  users.push(a, b, loner);
  firmA = await createFirmWithMember(db, "REST Firma A", a);
  firmB = await createFirmWithMember(db, "REST Firma B", b);
  firms.push(firmA, firmB);
  [tokA, tokB, tokLoner] = await Promise.all([tokenOf(a), tokenOf(b), tokenOf(loner)]);
});
afterAll(async () => { if (db) { await cleanup(db, firms, users); await db.end(); } });

describe("L6 search_drafts — eget firma", () => {
  it("POST: firma settes av databasen (ikke klienten); GET viser bare eget firma", async () => {
    const ra = await rest("POST", "search_drafts", tokA, { name: "REST A-søk", spec: spec() });
    const rb = await rest("POST", "search_drafts", tokB, { name: "REST B-søk", spec: spec() });
    expect([ra.status, rb.status]).toEqual([201, 201]);
    draftA = ra.rows[0]!; draftB = rb.rows[0]!;
    expect(draftA.dealership_id).toBe(firmA);
    expect(draftB.dealership_id).toBe(firmB);
    const mine = await rest("GET", "search_drafts?select=id,dealership_id", tokA);
    expect(mine.status).toBe(200);
    expect(mine.rows.length).toBeGreaterThan(0);
    expect(mine.rows.every((r) => r.dealership_id === firmA)).toBe(true);
    noTraceOfOther(mine.text, firmB, draftB.id as string);
  });
  it("PATCH eget søk med riktig base_version lykkes og øker versjonen; utdatert base_version avvises (konflikt)", async () => {
    const ok = await rest("PATCH", `search_drafts?id=eq.${draftA.id}`, tokA, { name: "REST A-søk (endret)", base_version: draftA.version });
    expect(ok.status).toBe(200);
    expect(ok.rows).toHaveLength(1);
    expect(ok.rows[0]!.name).toBe("REST A-søk (endret)");
    expect(ok.rows[0]!.version).toBe((draftA.version as number) + 1);
    const stale = await rest("PATCH", `search_drafts?id=eq.${draftA.id}`, tokA, { name: "utdatert", base_version: draftA.version });
    expect(stale.status).toBeGreaterThanOrEqual(400);
    expect(await count("select count(*)::int n from public.search_drafts where id=$1 and name='utdatert'", [draftA.id])).toBe(0);
    draftA = ok.rows[0]!;
  });
});

describe("L6 search_drafts — på tvers av firma", () => {
  it("B ser ikke As søk (GET med filter, uten filter og som embed) og får ingen spor av dem", async () => {
    const byId = await rest("GET", `search_drafts?id=eq.${draftA.id}`, tokB);
    expect([byId.status, byId.rows]).toEqual([200, []]);
    const all = await rest("GET", "search_drafts?select=*", tokB);
    expect(all.rows.every((r) => r.dealership_id === firmB)).toBe(true);
    noTraceOfOther(all.text, firmA, draftA.id as string);
    const byFirm = await rest("GET", `search_drafts?dealership_id=eq.${firmA}`, tokB);
    expect(byFirm.rows).toEqual([]);
  });
  it("B kan ikke endre eller slette As søk (0 rader / ingen slettegrant), og databasen er uendret", async () => {
    const upd = await rest("PATCH", `search_drafts?id=eq.${draftA.id}`, tokB, { name: "kapret", base_version: draftA.version });
    expect(upd.status).toBe(200);
    expect(upd.rows).toEqual([]);
    for (const [who, tok] of [["B mot A", tokB], ["A mot eget", tokA]] as const) {
      const del = await rest("DELETE", `search_drafts?id=eq.${draftA.id}`, tok);
      expect(del.status, who).toBe(403);
      expect(del.code, who).toBe("42501");
    }
    expect(await count("select count(*)::int n from public.search_drafts where id=$1 and name='REST A-søk (endret)' and dealership_id=$2", [draftA.id, firmA])).toBe(1);
  });
  it("falsk dealership_id (POST og PATCH) avvises av kolonnerettighetene — også mot eget firma — og flytter ikke noe", async () => {
    for (const [what, fid] of [["mot A", firmA], ["eget firma", firmB]] as const) {
      const r = await rest("POST", "search_drafts", tokB, { name: `spoof ${what}`, spec: spec(), dealership_id: fid });
      expect(r.status, what).toBe(403);
      expect(r.code, what).toBe("42501");
    }
    const move = await rest("PATCH", `search_drafts?id=eq.${draftB.id}`, tokB, { dealership_id: firmA, base_version: draftB.version });
    expect([move.status, move.code]).toEqual([403, "42501"]);
    expect(await count("select count(*)::int n from public.search_drafts where name like 'spoof %'")).toBe(0);
    expect(await count("select count(*)::int n from public.search_drafts where id=$1 and dealership_id=$2", [draftB.id, firmB])).toBe(1);
  });
});

describe("L6 dealer_economics_inputs — eget firma", () => {
  it("POST: firma og bekreftende bruker settes av databasen; GET/PATCH egne rader; duplikat gir 409 (23505)", async () => {
    const body = { search_id: draftA.id, candidate_id: CAND.id, candidate_version: CAND.version, input_schema_version: 1, payload: dealerInput(), context: CTX };
    const r = await rest("POST", "dealer_economics_inputs", tokA, body);
    expect(r.status).toBe(201);
    inputA = r.rows[0]!;
    expect(inputA).toMatchObject({ dealership_id: firmA, confirmed_by: a.id, search_id: draftA.id });
    const rb = await rest("POST", "dealer_economics_inputs", tokB, { ...body, search_id: draftB.id });
    expect(rb.status).toBe(201);
    inputB = rb.rows[0]!;
    const dup = await rest("POST", "dealer_economics_inputs", tokA, body);
    expect([dup.status, dup.code]).toEqual([409, "23505"]);
    const get = await rest("GET", "dealer_economics_inputs?select=id,dealership_id", tokA);
    expect(get.rows.every((x) => x.dealership_id === firmA)).toBe(true);
    noTraceOfOther(get.text, firmB, inputB.id as string);
    const upd = await rest("PATCH", `dealer_economics_inputs?id=eq.${inputA.id}`, tokA, { payload: { ...dealerInput(), deduction: "unknown" } });
    expect(upd.status).toBe(200);
    expect(upd.rows).toHaveLength(1);
    expect(upd.rows[0]!.confirmed_by).toBe(a.id);
  });
});

describe("L6 dealer_economics_inputs — på tvers av firma", () => {
  it("B ser ikke As forhandlerinput (filter på id, søk og firma; embed mot søk) og får ingen spor", async () => {
    for (const q of [`id=eq.${inputA.id}`, `search_id=eq.${draftA.id}`, `dealership_id=eq.${firmA}`]) {
      const r = await rest("GET", `dealer_economics_inputs?${q}`, tokB);
      expect([r.status, r.rows], q).toEqual([200, []]);
    }
    const embed = await rest("GET", "dealer_economics_inputs?select=id,search_drafts(name,dealership_id)", tokB);
    expect(embed.status).toBe(200);
    expect(embed.rows.map((x) => x.id)).toEqual([inputB.id]);
    noTraceOfOther(embed.text, firmA, draftA.id as string, inputA.id as string);
  });
  it("B kan ikke endre eller slette As rad; ingen kan slette; databasen er uendret", async () => {
    const before = (await db.query("select payload, confirmed_at from public.dealer_economics_inputs where id=$1", [inputA.id])).rows[0];
    const upd = await rest("PATCH", `dealer_economics_inputs?id=eq.${inputA.id}`, tokB, { payload: { schemaVersion: 1 } });
    expect([upd.status, upd.rows]).toEqual([200, []]);
    for (const tok of [tokB, tokA]) {
      const del = await rest("DELETE", `dealer_economics_inputs?id=eq.${inputA.id}`, tok);
      expect([del.status, del.code]).toEqual([403, "42501"]);
    }
    const after = (await db.query("select payload, confirmed_at from public.dealer_economics_inputs where id=$1", [inputA.id])).rows[0];
    expect(after).toEqual(before);
  });
  it("B kan ikke binde input til As søk (POST med As search_id) eller oppgi firma, og kan ikke flytte nøkkel/firma (PATCH)", async () => {
    const base = { candidate_id: "13:synthetic-demo/rest-2", candidate_version: CAND.version, input_schema_version: 1, payload: dealerInput(), context: CTX };
    const cross = await rest("POST", "dealer_economics_inputs", tokB, { ...base, search_id: draftA.id });
    expect(cross.status).toBeGreaterThanOrEqual(400);
    expect(cross.status).toBeLessThan(500);
    expect(cross.rows).toEqual([]);
    for (const dealership_id of [firmA, firmB]) {
      const spoof = await rest("POST", "dealer_economics_inputs", tokB, { ...base, search_id: draftB.id, dealership_id });
      expect([spoof.status, spoof.code]).toEqual([403, "42501"]);
    }
    for (const patch of [{ dealership_id: firmA }, { search_id: draftA.id }, { candidate_id: "x" }, { confirmed_by: a.id }]) {
      const r = await rest("PATCH", `dealer_economics_inputs?id=eq.${inputB.id}`, tokB, patch);
      expect([r.status, r.code], JSON.stringify(patch)).toEqual([403, "42501"]);
    }
    expect(await count("select count(*)::int n from public.dealer_economics_inputs where candidate_id='13:synthetic-demo/rest-2'")).toBe(0);
    expect(await count("select count(*)::int n from public.dealer_economics_inputs where id=$1 and dealership_id=$2 and search_id=$3", [inputB.id, firmB, draftB.id])).toBe(1);
  });
});

describe("L6 dealer_economics_profiles", () => {
  it("eget firma: POST (firma/bruker settes av databasen), GET, PATCH; duplikat gir 409 (23505)", async () => {
    const ra = await rest("POST", "dealer_economics_profiles", tokA, { payload: PROFILE });
    expect(ra.status).toBe(201);
    expect(ra.rows[0]).toMatchObject({ dealership_id: firmA, updated_by: a.id });
    expect((await rest("POST", "dealer_economics_profiles", tokB, { payload: PROFILE })).status).toBe(201);
    const dup = await rest("POST", "dealer_economics_profiles", tokA, { payload: PROFILE });
    expect([dup.status, dup.code]).toEqual([409, "23505"]);
    const get = await rest("GET", "dealer_economics_profiles", tokA);
    expect(get.rows.map((r) => r.dealership_id)).toEqual([firmA]);
    // Eksplisitt filter på eget firma (slik appen gjør: .eq("dealership_id", …)); forventningen er uendret: 200 og oppdatert rad.
    const upd = await rest("PATCH", `dealer_economics_profiles?dealership_id=eq.${firmA}`, tokA, { payload: { schemaVersion: 1, vatHandling: "unknown", deduction: "recoverable" } });
    expect(upd.status).toBe(200);
    expect(upd.rows).toHaveLength(1);
    expect(upd.rows[0]).toMatchObject({ dealership_id: firmA, updated_by: a.id, payload: { deduction: "recoverable" } });
    expect((await db.query("select payload->>'deduction' d, updated_by from public.dealer_economics_profiles where dealership_id=$1", [firmA])).rows[0]).toEqual({ d: "recoverable", updated_by: a.id });
    expect((await db.query("select payload->>'deduction' d from public.dealer_economics_profiles where dealership_id=$1", [firmB])).rows[0]).toEqual({ d: "unknown" });
  });
  it("på tvers av firma: B ser/endrer ikke As profil; falsk dealership_id avvises; ingen kan slette; databasen er uendret", async () => {
    const snap = async () => (await db.query("select dealership_id, payload, updated_by, created_at, updated_at from public.dealer_economics_profiles where dealership_id = any($1) order by dealership_id", [[firmA, firmB]])).rows;
    const before = (await db.query("select payload, updated_by from public.dealer_economics_profiles where dealership_id=$1", [firmA])).rows[0];
    const bothBefore = await snap();
    expect(bothBefore).toHaveLength(2);
    const peek = await rest("GET", `dealer_economics_profiles?dealership_id=eq.${firmA}`, tokB);
    expect([peek.status, peek.rows]).toEqual([200, []]);
    const all = await rest("GET", "dealer_economics_profiles", tokB);
    expect(all.rows.map((r) => r.dealership_id)).toEqual([firmB]);
    noTraceOfOther(all.text, firmA);
    const upd = await rest("PATCH", `dealer_economics_profiles?dealership_id=eq.${firmA}`, tokB, { payload: { schemaVersion: 1, deduction: "non_recoverable" } });
    expect([upd.status, upd.rows]).toEqual([200, []]);
    for (const dealership_id of [firmA, firmB]) {
      const spoof = await rest("POST", "dealer_economics_profiles", tokB, { payload: PROFILE, dealership_id });
      expect([spoof.status, spoof.code]).toEqual([403, "42501"]);
    }
    // Filter på Bs EGEN rad (ellers ville As rad vært skjult før operasjonen og kolonnerettigheten ikke blitt prøvd); payload forsøker å flytte raden til A.
    const move = await rest("PATCH", `dealer_economics_profiles?dealership_id=eq.${firmB}`, tokB, { dealership_id: firmA });
    expect([move.status, move.code]).toEqual([403, "42501"]);
    for (const tok of [tokB, tokA]) {
      const del = await rest("DELETE", `dealer_economics_profiles?dealership_id=eq.${firmA}`, tok);
      expect([del.status, del.code]).toEqual([403, "42501"]);
    }
    expect((await db.query("select payload, updated_by from public.dealer_economics_profiles where dealership_id=$1", [firmA])).rows[0]).toEqual(before);
    expect(await snap()).toEqual(bothBefore);   // begge firmaenes profiler er helt uendret (inkl. nøkkel og tidsstempler)
  });
});

describe("L6 anon, bruker uten firma og forfalsket token (alle tre tabeller)", () => {
  const TABLES = ["search_drafts", "dealer_economics_inputs", "dealer_economics_profiles"] as const;
  const body = (t: string) => (t === "search_drafts" ? { name: "uten rett", spec: spec() } : t === "dealer_economics_inputs" ? { search_id: draftA.id, candidate_id: "13:x/y", candidate_version: CAND.version, input_schema_version: 1, payload: dealerInput(), context: CTX } : { payload: PROFILE });
  it("anon (bare publishable key) får verken lese eller skrive", async () => {
    for (const t of TABLES) {
      const g = await rest("GET", t, null);
      expect([401, 403], `GET ${t}`).toContain(g.status);
      expect(g.rows).toEqual([]);
      const p = await rest("POST", t, null, body(t));
      expect([401, 403], `POST ${t}`).toContain(p.status);
    }
  });
  it("bruker uten firma ser ingenting og kan ikke opprette noe", async () => {
    for (const t of TABLES) {
      const g = await rest("GET", t, tokLoner);
      expect([g.status, g.rows], `GET ${t}`).toEqual([200, []]);
      const p = await rest("POST", t, tokLoner, body(t));
      expect(p.status, `POST ${t}`).toBeGreaterThanOrEqual(400);
      expect(p.rows).toEqual([]);
    }
    expect(await count("select count(*)::int n from public.search_drafts where name='uten rett'")).toBe(0);
    expect(await count("select count(*)::int n from public.dealer_economics_inputs where candidate_id='13:x/y'")).toBe(0);
  });
  it("forfalsket token (A sitt token med B sin sub, original signatur) avvises før RLS — ingen data fra noen av firmaene", async () => {
    const [h, p, s] = tokA.split(".");
    const claims = JSON.parse(Buffer.from(p!, "base64url").toString()) as J;
    const forged = `${h}.${Buffer.from(JSON.stringify({ ...claims, sub: b.id })).toString("base64url")}.${s}`;
    for (const t of TABLES) {
      const r = await rest("GET", t, forged);
      expect(r.status, t).toBe(401);
      expect(r.rows).toEqual([]);
      noTraceOfOther(r.text, firmA, firmB);
    }
  });
});

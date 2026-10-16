/**
 * SEARCH-005 — lagrede søkeutkast: RLS, rettigheter, strukturvalidering og atomisk konfliktsjekk i databasen.
 *
 * Alle tilgangspåstander kjøres som rolle `authenticated` med JWT-claims (som PostgREST gjør) eller som `anon`; oppsett gjøres
 * som databaseeier. Filen bruker bare direkte databasetilkobling, så den kan kjøres både mot lokal Supabase (`npm run test:db`)
 * og mot den isolerte klyngen (`bash scripts/test-db-isolated.sh tests/db/search-drafts.test.ts`). I den siste finnes verken
 * Auth eller PostgREST: bevis gjelder da PostgreSQL-motorens RLS, rettigheter, constraints og triggere — ikke HTTP-laget.
 * Databasen kontrollerer struktur, ikke katalogtilhørighet; differensialtesten under viser grensen.
 */
import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEMO_CATALOG } from "@/adapters/search-catalog/demo-catalog";
import { specFromJson } from "@/domain/search-v2/serialization";
import type { SearchSpecJson } from "@/domain/search-v2/serialization";
import { EXAMPLES } from "@/server/search-examples";
import { parseSearchFormValues } from "@/server/search-form";
import { adminDb, assertLocal, cleanup, createFirmWithMember, createUser, type TestUser } from "./harness";

let db: Client;
let a: TestUser, b: TestUser, loner: TestUser;
let firmA = "", firmB = "";
const users: TestUser[] = [];
const firms: string[] = [];

beforeAll(async () => {
  assertLocal();
  db = await adminDb();
  a = await createUser(db, "draft-a"); b = await createUser(db, "draft-b"); loner = await createUser(db, "draft-nomember");
  users.push(a, b, loner);
  firmA = await createFirmWithMember(db, "Draft Firma A", a);
  firmB = await createFirmWithMember(db, "Draft Firma B", b);
  firms.push(firmA, firmB);
});
afterAll(async () => {
  if (db) { await cleanup(db, firms, users); await db.end(); }
});

const q = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query(sql, params)).rows as T[];

/** Enkeltkall som ordinær bruker i egen transaksjon. Feil returneres som {code,message}; ellers rader. */
async function as(user: TestUser | null, sql: string, params: unknown[] = [], commit = false) {
  const c = db;
  await c.query("begin");
  try {
    await c.query("select set_config('role', $1, true), set_config('request.jwt.claims', $2, true)", [
      user ? "authenticated" : "anon", JSON.stringify(user ? { sub: user.id, role: "authenticated" } : { role: "anon" })]);
    const r = await c.query(sql, params);
    await c.query(commit ? "commit" : "rollback");
    return { ok: true as const, rows: r.rows as Record<string, unknown>[], rowCount: r.rowCount ?? 0 };
  } catch (e) {
    await c.query("rollback");
    const err = e as { code?: string; message?: string };
    return { ok: false as const, code: err.code ?? "", message: err.message ?? "" };
  }
}

// ---- dokumenter fra den ekte skjemakjeden (ikke håndskrevet JSON)
function docFromExample(id: string): SearchSpecJson {
  const ex = EXAMPLES.find((e) => e.id === id)!;
  const v = ex.values();
  if (id === "gls") { v.exteriorColorsPriority = "nice"; v.plannedRegistration = "unspecified"; }
  const r = parseSearchFormValues(v, DEMO_CATALOG);
  if (!r.ok || !r.json) throw new Error("eksempel ugyldig: " + JSON.stringify(r.errors));
  return r.json;
}
const BMW = () => docFromExample("demo-bmw");
const GLS = () => docFromExample("gls");
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

async function insertDraft(user: TestUser, name: string, spec: unknown) {
  return as(user, "insert into public.search_drafts (name, spec) values ($1, $2::jsonb) returning id, dealership_id, name, version, base_version, created_by, spec", [name, JSON.stringify(spec)], true);
}

describe("opprettelse: firma utledes av databasen", () => {
  it("eget utkast får firma fra membership, versjon 1 og opphav; dokumentet bevares uendret", async () => {
    const doc = BMW();
    const r = await insertDraft(a, "Demo BMW", doc);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const row = r.rows[0]!;
    expect(row.dealership_id).toBe(firmA);
    expect(row.version).toBe(1);
    expect(row.base_version).toBeNull();
    expect(row.created_by).toBe(a.id);
    expect(row.spec).toEqual(doc);
    // bigint-strenger, valuta uten beløp og kostnads-id er bevart av lagringen
    const s = row.spec as SearchSpecJson;
    expect(s.budget.maxTotal).toEqual({ amountMinor: "45000000", currency: "NOK" });
    expect(s.budget.costs[0]).toMatchObject({ id: "transport", currency: "EUR", amountMinor: null, includedInBudget: true });
  });

  it("klienten kan ikke oppgi firma, id, versjon eller opphav (kolonnerettigheter)", async () => {
    for (const col of ["dealership_id", "id", "version", "created_by", "created_at", "updated_at"]) {
      const val = col === "dealership_id" ? firmB : col === "id" || col === "created_by" ? "'00000000-0000-4000-8000-000000000001'" : col === "version" ? "99" : "now()";
      const sql = col === "dealership_id"
        ? "insert into public.search_drafts (name, spec, dealership_id) values ('x', $1::jsonb, $2)"
        : `insert into public.search_drafts (name, spec, ${col}) values ('x', $1::jsonb, ${val})`;
      const r = await as(a, sql, col === "dealership_id" ? [JSON.stringify(BMW()), val] : [JSON.stringify(BMW())]);
      expect(r.ok, col).toBe(false);
      if (!r.ok) expect(r.code, col).toBe("42501");
    }
  });

  it("bruker uten membership kan ikke opprette; anon har ingen tilgang", async () => {
    const r = await insertDraft(loner, "Uten firma", BMW());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("42501");
    const an = await as(null, "select count(*) from public.search_drafts");
    expect(an.ok).toBe(false);
    if (!an.ok) expect(an.code).toBe("42501");
    const ai = await as(null, "insert into public.search_drafts (name, spec) values ('x', $1::jsonb)", [JSON.stringify(BMW())]);
    expect(ai.ok).toBe(false);
    if (!ai.ok) expect(ai.code).toBe("42501");
  });
});

describe("to firmaer: isolasjon", () => {
  let idA = "", idB = "";
  beforeAll(async () => {
    const ra = await insertDraft(a, "Firma A utkast", BMW());
    const rb = await insertDraft(b, "Firma B utkast", GLS());
    if (!ra.ok || !rb.ok) throw new Error("oppsett feilet");
    idA = ra.rows[0]!.id as string; idB = rb.rows[0]!.id as string;
  });

  it("hver bruker ser bare eget firmas utkast", async () => {
    const sa = await as(a, "select id from public.search_drafts");
    const sb = await as(b, "select id from public.search_drafts");
    expect(sa.ok && sb.ok).toBe(true);
    if (!sa.ok || !sb.ok) return;
    expect(sa.rows.map((r) => r.id)).toContain(idA);
    expect(sa.rows.map((r) => r.id)).not.toContain(idB);
    expect(sb.rows.map((r) => r.id)).toContain(idB);
    expect(sb.rows.map((r) => r.id)).not.toContain(idA);
    expect(((await as(a, "select id from public.search_drafts where id = $1", [idB])) as unknown as { rows: unknown[] }).rows).toEqual([]);
  });

  it("fremmed utkast kan ikke endres (heller ikke med riktig base_version) og ikke flyttes til annet firma", async () => {
    const own = await as(b, "select version from public.search_drafts where id = $1", [idB]);
    const ver = (own as unknown as { rows: { version: number }[] }).rows[0]!.version;
    const r = await as(a, "update public.search_drafts set name = 'kapret', base_version = $2 where id = $1 returning id", [idB, ver]);
    expect(r.ok).toBe(true);
    expect((r as unknown as { rowCount: number }).rowCount).toBe(0); // RLS skjuler raden: ingen treff, ingen feil som avslører den
    const mv = await as(a, "update public.search_drafts set dealership_id = $2 where id = $1", [idA, firmB]);
    expect(mv.ok).toBe(false);
    if (!mv.ok) expect(mv.code).toBe("42501");
    expect((await q<{ name: string }>("select name from public.search_drafts where id = $1", [idB]))[0]!.name).toBe("Firma B utkast");
  });

  it("ingen sletting for ordinære brukere", async () => {
    const r = await as(a, "delete from public.search_drafts where id = $1", [idA]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("42501");
  });
});

describe("redigeringsversjon og atomisk konfliktsjekk", () => {
  let id = "";
  beforeAll(async () => {
    const r = await insertDraft(a, "Versjonstest", BMW());
    if (!r.ok) throw new Error("oppsett");
    id = r.rows[0]!.id as string;
  });
  const upd = (user: TestUser, set: string, params: unknown[], commit = true) => as(user, `update public.search_drafts set ${set} where id = $1 returning version, base_version, name, updated_by`, [id, ...params], commit);

  it("riktig base_version gir ny versjon; base_version nullstilles; updated_by settes", async () => {
    const r = await upd(a, "name = $2, base_version = 1", ["Nytt navn"]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.rows[0]).toMatchObject({ version: 2, base_version: null, name: "Nytt navn", updated_by: a.id });
  });

  it("foreldet, fremtidig og utelatt base_version avvises (ingenting overskrives)", async () => {
    for (const set of ["name = 'gammel', base_version = 1", "name = 'fremtid', base_version = 7", "name = 'uten'", "name = 'null', base_version = null"]) {
      const r = await upd(a, set, []);
      expect(r.ok, set).toBe(false);
      if (!r.ok) { expect(r.code, set).toBe("23514"); expect(r.message, set).toContain("search_draft_conflict"); }
    }
    expect((await q<{ name: string; version: number }>("select name, version from public.search_drafts where id = $1", [id]))[0]).toEqual({ name: "Nytt navn", version: 2 });
  });

  it("uendret innhold gir ingen ny versjon", async () => {
    const r = await upd(a, "name = 'Nytt navn', base_version = 2", []);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.rows[0]).toMatchObject({ version: 2 });
  });

  it("versjon kan ikke settes direkte", async () => {
    const r = await upd(a, "version = 50, base_version = 2", []);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("42501");
  });

  it("to samtidige redigeringer: den andre taper og får konflikt (ikke stille overskriving)", async () => {
    const second = await (async () => { const { Client } = await import("pg"); const c = new Client({ connectionString: process.env.SUPABASE_TEST_DB_URL }); await c.connect(); return c; })();
    try {
      const claims = JSON.stringify({ sub: a.id, role: "authenticated" });
      const cur = (await q<{ version: number }>("select version from public.search_drafts where id = $1", [id]))[0]!.version;
      await db.query("begin");
      await db.query("select set_config('role','authenticated',true), set_config('request.jwt.claims',$1,true)", [claims]);
      await second.query("begin");
      await second.query("select set_config('role','authenticated',true), set_config('request.jwt.claims',$1,true)", [claims]);
      // 1: endrer og holder låsen
      await db.query("update public.search_drafts set name = 'vinner', base_version = $2 where id = $1", [id, cur]);
      // 2: oppgir samme (nå foreldede) base_version og venter på låsen
      const loser = second.query("update public.search_drafts set name = 'taper', base_version = $2 where id = $1", [id, cur]).then(() => "ok", (e: { code: string; message: string }) => `${e.code}:${e.message}`);
      await new Promise((r) => setTimeout(r, 300));
      await db.query("commit");
      const outcome = await loser;
      await second.query("rollback");
      expect(outcome).toContain("23514:search_draft_conflict");
      expect((await q<{ name: string; version: number }>("select name, version from public.search_drafts where id = $1", [id]))[0]).toEqual({ name: "vinner", version: cur + 1 });
    } finally {
      await db.query("rollback").catch(() => {});
      await second.end();
    }
  });
});

describe("strukturvalidering i databasen", () => {
  const reject = async (label: string, mutate: (d: SearchSpecJson & Record<string, unknown>) => unknown, expectCode = "23514") => {
    const d = clone(BMW()) as SearchSpecJson & Record<string, unknown>;
    const out = mutate(d);
    const spec = out === undefined ? d : out;
    const r = await insertDraft(a, "Ugyldig", spec);
    expect(r.ok, label).toBe(false);
    if (!r.ok) expect(r.code, `${label}: ${r.message}`).toBe(expectCode);
  };
  const bad: [string, (d: any) => unknown][] = [ // eslint-disable-line @typescript-eslint/no-explicit-any
    ["feil skjema", (d) => { d.schema = "merovo.search-draft"; }],
    ["feil modellversjon", (d) => { d.modelVersion = 2; }],
    ["modellversjon som tekst", (d) => { d.modelVersion = "1"; }],
    ["ukjent toppnøkkel", (d) => { d.extra = 1; }],
    ["manglende nøkkel", (d) => { delete d.equipment; }],
    ["ukjent nøkkel dypt", (d) => { d.requirements.seats = { min: 7, max: 7, unit: "seats", x: 1 }; }],
    ["null som dokument", () => null],
    ["liste som dokument", () => []],
    ["tekst som dokument", () => "x"],
    ["beløp som JSON-tall", (d) => { d.budget.maxTotal.amountMinor = 45000000; }],
    ["beløp med ledende null", (d) => { d.budget.maxTotal.amountMinor = "0450"; }],
    ["budsjett 0", (d) => { d.budget.maxTotal.amountMinor = "0"; }],
    ["beløp over 2^53-1", (d) => { d.budget.maxTotal.amountMinor = "9007199254740992"; }],
    ["budsjett i EUR", (d) => { d.budget.maxTotal.currency = "EUR"; }],
    ["negativt kostnadsbeløp", (d) => { d.budget.costs[0].amountMinor = "-5"; }],
    ["ustøttet kostnadsvaluta", (d) => { d.budget.costs[0].currency = "XXX"; }],
    ["kostnad uten valuta", (d) => { delete d.budget.costs[0].currency; }],
    ["ugyldig kostnads-id", (d) => { d.budget.costs[0].id = "Transport!"; }],
    ["duplikat kostnads-id", (d) => { d.budget.costs.push({ ...d.budget.costs[0], kind: "travel" }); }],
    ["fast kostnadstype to ganger", (d) => { d.budget.costs.push({ ...d.budget.costs[0], id: "transport2" }); }],
    ["ukjent kostnadstype", (d) => { d.budget.costs[0].kind = "tax"; }],
    ["ukjent mva-grunnlag", (d) => { d.budget.costs[0].vatBasis = "maybe"; }],
    ["31 kostnadslinjer", (d) => { for (let i = 0; i < 31; i++) d.budget.costs.push({ id: `c-${String(i).padStart(12, "0")}`, kind: "custom", label: `L${i}`, currency: "NOK", amountMinor: null, vatBasis: null, includedInBudget: false }); }],
    ["avvik over 100 %", (d) => { d.budget.deviationBasisPoints = 10001; }],
    ["avvik som desimal", (d) => { d.budget.deviationBasisPoints = 10.5; }],
    ["ukjent prioritet", (d) => { d.appearance.exteriorColors.priority = "high"; }],
    ["tom fargeliste", (d) => { d.appearance.exteriorColors.values = []; }],
    ["duplikat i fargeliste", (d) => { d.appearance.exteriorColors.values = ["black", "black"]; }],
    ["duplikat utstyr", (d) => { d.equipment = [{ key: "camera_360", priority: "must" }, { key: "camera_360", priority: "nice" }]; }],
    ["utstyr uten prioritet", (d) => { d.equipment = [{ key: "camera_360" }]; }],
    ["ukjent karosseri", (d) => { d.requirements.bodyTypes = ["spaceship"]; }],
    ["duplikat drivstoff", (d) => { d.requirements.fuels = ["diesel", "diesel"]; }],
    ["seter 21", (d) => { d.requirements.seats = { min: 21, max: null, unit: "seats" }; }],
    ["seter feil enhet", (d) => { d.requirements.seats = { min: 7, max: 7, unit: "år" }; }],
    ["min over max", (d) => { d.requirements.modelYear = { min: 2024, max: 2020, unit: "year" }; }],
    ["tomt intervall", (d) => { d.requirements.modelYear = { min: null, max: null, unit: "year" }; }],
    ["km 0", (d) => { d.requirements.maxMileage = { value: 0, unit: "km" }; }],
    ["miles som enhet", (d) => { d.requirements.maxMileage = { value: 5000, unit: "mi" }; }],
    ["måned 13", (d) => { d.requirements.firstRegistration = { from: { precision: "month", year: 2021, month: 13 }, to: null }; }],
    ["30. februar", (d) => { d.requirements.firstRegistration = { from: { precision: "date", year: 2021, month: 2, day: 30 }, to: null }; }],
    ["dato uten dag med dag-felt", (d) => { d.requirements.firstRegistration = { from: { precision: "month", year: 2021, month: 3, day: 1 }, to: null }; }],
    ["fra etter til", (d) => { d.requirements.firstRegistration = { from: { precision: "year", year: 2024 }, to: { precision: "year", year: 2020 } }; }],
    ["modell uten merke", (d) => { d.vehicle.brand = null; }],
    ["variant uten modell", (d) => { d.vehicle.model = null; d.vehicle.variant = "X"; }],
    ["variant med styretegn", (d) => { d.vehicle.variant = "A\nB"; }],
    ["variant med omkringliggende mellomrom", (d) => { d.vehicle.variant = " 330e"; }],
    ["variant over 100 tegn", (d) => { d.vehicle.variant = "x".repeat(101); }],
    ["ugyldig registreringsscenario", (d) => { d.plannedRegistration.requested = "truck"; }],
    ["scenario mangler", (d) => { d.plannedRegistration = {}; }],
  ];
  for (const [label, mutate] of bad) it(`avviser: ${label}`, async () => { await reject(label, mutate); });

  it("avviser ugyldig navn: tomt, bare mellomrom, 121 tegn, styretegn, omkringliggende mellomrom", async () => {
    for (const name of ["", "   ", "x".repeat(121), "a\nb", " a", "a "]) {
      const r = await insertDraft(a, name, BMW());
      expect(r.ok, JSON.stringify(name)).toBe(false);
      if (!r.ok) expect(r.code, JSON.stringify(name)).toBe("23514");
    }
  });

  it("godtar gyldig dokument med eksplisitt 0, ukjent beløp med valuta og tomme lister", async () => {
    const d = clone(BMW());
    d.budget.costs.push({ id: "c-00000000abcd", kind: "custom", label: "Avgift 0", currency: "EUR", amountMinor: "0", vatBasis: "none", includedInBudget: true });
    expect((await insertDraft(a, "Gyldig 0", d)).ok).toBe(true);
    const e = clone(BMW());
    e.budget.maxTotal = null; e.budget.deviationBasisPoints = null; e.budget.costs = [];
    expect((await insertDraft(a, "Uten budsjett", e)).ok).toBe(true); // budsjett kan være usatt i utkast
  });

  it("GRENSE: databasen kontrollerer ikke katalogen — ukjent merke/farge/utstyr lagres hvis strukturen er riktig (serveren avviser)", async () => {
    const d = clone(BMW());
    d.vehicle.brand = "not-in-catalog"; d.vehicle.model = "x";
    expect((await insertDraft(a, "Utenfor katalog", d)).ok).toBe(true);
    expect(specFromJson(d, DEMO_CATALOG).ok).toBe(false); // serveren stopper den før lagring og ved åpning
  });
});

/** Seedet pseudo-tilfeldig tall (mulberry32), slik at differensialtesten er reproduserbar. */
function rng(seed: number) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

describe("differensialtest: domene ↔ database", () => {
  const CATALOG_PATH = /^(vehicle\.(brand|model)|appearance\.\w+\.values\[\d+\]|equipment\[\d+\]\.key)$/;
  it("databasen avviser aldri et dokument domenet godtar, og godtar bare det domenet avviser av KATALOGgrunner (600 mutasjoner)", async () => {
    const rand = rng(20261015);
    const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)]!;
    const bases = [BMW(), GLS(), docFromExample("demo-bmw")];
    bases[1]!.appearance.exteriorColors!.priority = "nice";
    const walk = (o: unknown, path: (string | number)[] = [], out: { path: (string | number)[]; v: unknown }[] = []) => {
      out.push({ path, v: o });
      if (Array.isArray(o)) o.forEach((x, i) => walk(x, [...path, i], out));
      else if (o && typeof o === "object") for (const k of Object.keys(o)) walk((o as Record<string, unknown>)[k], [...path, k], out);
      return out;
    };
    const set = (root: any, path: (string | number)[], v: unknown) => { let c = root; for (const k of path.slice(0, -1)) c = c[k]; c[path[path.length - 1]!] = v; }; // eslint-disable-line @typescript-eslint/no-explicit-any
    const del = (root: any, path: (string | number)[]) => { let c = root; for (const k of path.slice(0, -1)) c = c[k]; if (Array.isArray(c)) c.splice(Number(path[path.length - 1]), 1); else delete c[path[path.length - 1]!]; }; // eslint-disable-line @typescript-eslint/no-explicit-any
    let domainOk = 0, domainBad = 0, dbBadStrict = 0;
    const violations: string[] = [];
    for (let n = 0; n < 600; n++) {
      const doc = clone(pick(bases));
      const nodes = walk(doc).filter((x) => x.path.length > 0);
      const t = pick(nodes);
      const kind = Math.floor(rand() * 6);
      switch (kind) {
        case 0: del(doc, t.path); break;
        case 1: if (t.v && typeof t.v === "object" && !Array.isArray(t.v)) (t.v as Record<string, unknown>).zzz = 1; else set(doc, t.path, { zzz: 1 }); break;
        case 2: set(doc, t.path, typeof t.v === "string" ? 7 : typeof t.v === "number" ? String(t.v) : t.v === null ? "x" : null); break;
        case 3: set(doc, t.path, typeof t.v === "string" ? "zz-invalid" : typeof t.v === "number" ? (t.v as number) + 1.5 : t.v); break;
        case 4: set(doc, t.path, typeof t.v === "number" ? -(t.v as number) - 1 : typeof t.v === "string" ? "" : t.v); break;
        default: break; // uendret (kontrollerer at gyldige dokumenter godtas)
      }
      const dom = specFromJson(doc, DEMO_CATALOG);
      const ins = await as(a, "insert into public.search_drafts (name, spec) values ('diff', $1::jsonb)", [JSON.stringify(doc)]);
      const dbAccepts = ins.ok;
      if (!ins.ok && ins.code !== "23514") { violations.push(`uventet feilkode ${ins.code}: ${ins.message}`); continue; }
      if (dom.ok) { domainOk++; if (!dbAccepts) { dbBadStrict++; violations.push(`DB avviste gyldig: ${JSON.stringify(t.path)} kind ${kind}`); } }
      else {
        domainBad++;
        if (dbAccepts) {
          const structural = dom.issues.filter((i) => !CATALOG_PATH.test(i.path));
          if (structural.length) violations.push(`DB godtok strukturelt ugyldig (${structural.map((i) => `${i.path}:${i.code}`).join(",")}): ${JSON.stringify(t.path)} kind ${kind}`);
        }
      }
    }
    expect(violations).toEqual([]);
    expect(domainOk).toBeGreaterThan(50);   // testen har faktisk gyldige tilfeller
    expect(domainBad).toBeGreaterThan(200); // …og mange ugyldige
    expect(dbBadStrict).toBe(0);
  });
});

describe("utkast er ikke aktive agenter: grensen på ti aktive er urørt", () => {
  it("mange utkast i et firma påvirker ikke aktivering av agenter, og grensen gjelder fortsatt (11. aktivering avvises)", async () => {
    for (let i = 0; i < 12; i++) expect((await insertDraft(b, `Utkast ${i}`, BMW())).ok).toBe(true);
    const READY = {
      filters: { make: "Volkswagen" },
      assumptions: {
        retail: { expectedRetailTotal: { amountMinor: "39990000", currency: "NOK" }, priceBasis: { vat: "included", registrationTaxes: "included" } },
        minimumContribution: { amountMinor: "3000000", currency: "NOK" },
        preparationReserve: { amount: { amountMinor: "1500000", currency: "NOK" }, vatBasis: "ex_vat" },
      },
    };
    const ids: string[] = [];
    for (let i = 0; i < 11; i++) {
      const r = await as(b, "insert into public.search_agents (dealership_id, name, filters, assumptions, active) values ($1, $2, $3::jsonb, $4::jsonb, false) returning id",
        [firmB, `Agent ${i}`, JSON.stringify(READY.filters), JSON.stringify(READY.assumptions)], true);
      expect(r.ok).toBe(true);
      if (r.ok) ids.push(r.rows[0]!.id as string);
    }
    for (let i = 0; i < 10; i++) expect((await as(b, "update public.search_agents set active = true where id = $1", [ids[i]], true)).ok, `aktiver ${i}`).toBe(true);
    const eleventh = await as(b, "update public.search_agents set active = true where id = $1", [ids[10]]);
    expect(eleventh.ok).toBe(false);
    if (!eleventh.ok) expect(eleventh.message).toContain("active_agent_limit");
    await q("delete from public.search_agents where dealership_id = $1", [firmB]);
  });
});

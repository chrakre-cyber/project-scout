/**
 * QA-001 / Gate G1 — paritet mellom domenevalidering (server) og databasen, NULL-sikkerhet og pengegrensen (R5).
 *
 * 1. Differensialtest: 400 seedede agentutkast (grenseverdier) valideres av domenet og sendes
 *    deretter direkte til Data API som ordinær bruker. Databasen skal være enig, både om gyldighet
 *    og om aktivering. En uavhengig kartlegger (ikke draftToDb) lager databaseformatet.
 * 2. NULL i broadSearchConfirmed og andre fraværende felt kan ikke omgå aktiveringskravene.
 * 3. Pengegrensen i tabellform: hva som godtas og avvises i hvert pengefelt.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { activationIssues, validateDraft, type AgentDraft } from "@/domain/agent-validation";
import type { Money } from "@/domain/types";
import { agentFromRow, type AgentRow } from "@/server/agent-records";
import { adminDb, assertLocal, cleanup, createFirmWithMember, createUser, READY, signIn, type TestUser } from "./harness";

const NOW = new Date("2026-10-06T12:00:00Z"); // inneværende år + 1 = 2027
let db: Client;
let user: TestUser;
let firm: string;
let c: SupabaseClient;

beforeAll(async () => {
  assertLocal();
  db = await adminDb();
  user = await createUser(db, "qa-val");
  firm = await createFirmWithMember(db, "QA-val", user);
  c = await signIn(user);
});
afterAll(async () => {
  if (db) {
    await cleanup(db, [firm].filter(Boolean), [user].filter(Boolean));
    await db.end();
  }
});

// ---------------------------------------------------------------------------
// 1. Differensialtest
// ---------------------------------------------------------------------------

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const MAX = Number.MAX_SAFE_INTEGER; // 9007199254740991
/** Hver verdipool har gode verdier (grenser inkludert) og bevisst ugyldige. Ugyldige velges sjelden, slik at mange utkast er gyldige. */
const P = {
  name: { good: ["Agent", "x".repeat(120), " pad ", "'; drop table search_agents; --"], bad: ["", "   ", "x".repeat(121)] },
  make: { good: [null, null, "Volkswagen", "x".repeat(60)], bad: ["x".repeat(61), "", " BMW", "BMW "] },
  model: { good: [null, null, "Golf"], bad: ["x".repeat(61), " Golf"] },
  variant: { good: [null, null, "GTI"], bad: ["x".repeat(61)] },
  year: { good: [null, null, 1900, 2000, 2024, 2027], bad: [1899, 2101, 2020.5, -1, 2028, 2100] },
  km: { good: [null, null, 1, 2_000_000, 100_000], bad: [0, 1.5, 2_000_001, -5] },
  fuels: { good: [[], [], ["petrol"], ["petrol", "diesel"]], bad: [["rocket"], ["petrol", "petrol"]] },
  gear: { good: [[], ["manual"], ["automatic", "manual"]], bad: [["cvt"]] },
  body: { good: [[], ["suv"], ["estate", "sedan"]], bad: [["tank"], ["suv", "suv"]] },
  country: { good: [[], ["DE"], ["DE", "AT"]], bad: [["US"], ["DE", "DE"]] },
  filterMoney: {
    good: [null, null, { amountMinor: 1, currency: "EUR" }, { amountMinor: MAX, currency: "NOK" }, { amountMinor: 3_500_000, currency: "CHF" }],
    bad: [{ amountMinor: 0, currency: "EUR" }, { amountMinor: -5, currency: "EUR" }, { amountMinor: 100, currency: "USD" },
      { amountMinor: MAX + 1, currency: "NOK" }, { amountMinor: 100, currency: "eur" }, { amountMinor: 1.5, currency: "EUR" }],
  },
  nok: {
    good: [null, { amountMinor: 1, currency: "NOK" }, { amountMinor: 39_990_000, currency: "NOK" }, { amountMinor: 3_000_000, currency: "NOK" }, { amountMinor: MAX, currency: "NOK" }],
    bad: [{ amountMinor: 0, currency: "NOK" }, { amountMinor: -1, currency: "NOK" }, { amountMinor: MAX + 1, currency: "NOK" },
      { amountMinor: 1.5, currency: "NOK" }, { amountMinor: 100, currency: "EUR" }],
  },
} as const;
const BAD_RATE = 0.07;

function draftFor(r: () => number): AgentDraft {
  const pick = <T>(a: readonly T[]) => a[Math.floor(r() * a.length)]!;
  const of = <T>(pool: { good: readonly unknown[]; bad: readonly unknown[] }): T => (r() < BAD_RATE ? pick(pool.bad) : pick(pool.good)) as T;
  // Halvparten får komplett økonomi og merke, slik at aktivering faktisk testes
  const complete = r() < 0.5;
  let yearMin = of<number | null>(P.year);
  let yearMax = of<number | null>(P.year);
  if (typeof yearMin === "number" && typeof yearMax === "number" && yearMin > yearMax && r() < 0.9) [yearMin, yearMax] = [yearMax, yearMin];
  const reserve = () => (r() < 0.25 ? { amountMinor: 0, currency: "NOK" } : of<Money | null>(P.nok));
  return {
    name: of<string>(P.name),
    broadSearchConfirmed: r() < 0.5,
    filters: {
      make: complete && r() < 0.5 ? "Volkswagen" : of<string | null>(P.make), model: of<string | null>(P.model), variant: of<string | null>(P.variant),
      yearMin, yearMax, maxMileageKm: of<number | null>(P.km),
      fuels: [...of<string[]>(P.fuels)] as never, transmissions: [...of<string[]>(P.gear)] as never, bodyTypes: [...of<string[]>(P.body)] as never, countryCodes: [...of<string[]>(P.country)],
      maxPrice: of<Money | null>(P.filterMoney),
    },
    assumptions: {
      retail: {
        expectedRetailTotal: complete ? { amountMinor: 39_990_000, currency: "NOK" } : of<Money | null>(P.nok),
        priceBasis: { vat: complete ? "included" : pick([null, "included", "excluded"]), registrationTaxes: complete ? "excluded" : pick([null, "included", "excluded"]) },
      },
      minimumContribution: complete ? { amountMinor: 3_000_000, currency: "NOK" } : of<Money | null>(P.nok),
      preparationReserve: { amount: complete ? { amountMinor: 0, currency: "NOK" } : (reserve() as Money | null), vatBasis: complete ? "ex_vat" : pick([null, "ex_vat", "incl_vat"]) },
    },
  };
}

/** Uavhengig kartlegging til databaseformatet (DEC-020). Bevisst ikke draftToDb. */
function toDbPayload(d: AgentDraft, confirmedEncoding: number) {
  const m = (x: Money | null) => (x === null ? null : { amountMinor: String(x.amountMinor), currency: x.currency });
  const filters: Record<string, unknown> = { ...d.filters, maxPrice: m(d.filters.maxPrice) };
  if (d.broadSearchConfirmed) filters.broadSearchConfirmed = true;
  else if (confirmedEncoding === 0) filters.broadSearchConfirmed = false;
  else if (confirmedEncoding === 1) filters.broadSearchConfirmed = null;
  // encoding 2: nøkkelen utelates helt (det som ga NULL i DEV-004-feilen)
  return {
    name: d.name.trim(),
    filters,
    assumptions: {
      retail: { expectedRetailTotal: m(d.assumptions.retail.expectedRetailTotal), priceBasis: d.assumptions.retail.priceBasis },
      minimumContribution: m(d.assumptions.minimumContribution),
      preparationReserve: { amount: m(d.assumptions.preparationReserve.amount), vatBasis: d.assumptions.preparationReserve.vatBasis },
    },
  };
}

describe("differensialtest: domene mot database (400 utkast)", () => {
  it("databasen er enig med domenet om gyldighet og aktivering; aldri svakere, aldri strengere", async () => {
    const r = rng(20261006);
    const stats = { valid: 0, invalid: 0, ready: 0, notReady: 0, skippedYearGap: 0 };
    const created: string[] = [];
    for (let i = 0; i < 400; i++) {
      const d = draftFor(r);
      const label = `#${i} ${JSON.stringify(d).slice(0, 400)}`;
      const yearGap = [d.filters.yearMin, d.filters.yearMax].some((y) => y !== null && Number.isInteger(y) && y > 2027 && y <= 2100);
      const errors = validateDraft(d, NOW);
      const domainValid = Object.keys(errors).length === 0;

      const res = await c.from("search_agents").insert({ dealership_id: firm, ...toDbPayload(d, i % 3) }).select("id").single();
      const dbAccepted = res.error === null;
      if (res.error) expect(res.error.code, label).toBe("23514"); // aldri annen feilklasse for ugyldig input

      if (yearGap) {
        // Dokumentert forskjell: serveren stopper årsmodell over inneværende år + 1, databasen først ved 2100.
        stats.skippedYearGap++;
        if (res.data) created.push(res.data.id);
        continue;
      }
      expect(dbAccepted, `gyldighet ${label}`).toBe(domainValid);
      if (!res.data) {
        stats.invalid++;
        continue;
      }
      stats.valid++;
      created.push(res.data.id);

      const ready = activationIssues(d, NOW).length === 0;
      const act = await c.from("search_agents").update({ active: true }).eq("id", res.data.id).select("id");
      expect(act.error === null, `aktivering ${label}`).toBe(ready);
      if (act.error) {
        expect(act.error.code, label).toBe("23514");
        stats.notReady++;
      } else {
        stats.ready++;
        await c.from("search_agents").update({ active: false }).eq("id", res.data.id);
      }
    }
    // Testen må faktisk ha truffet alle klasser (ellers er den verdiløs)
    expect(stats.valid).toBeGreaterThan(40);
    expect(stats.invalid).toBeGreaterThan(100);
    expect(stats.ready).toBeGreaterThan(10);
    expect(stats.notReady).toBeGreaterThan(10);
    expect(stats.skippedYearGap).toBeLessThan(100);
    if (process.env.QA_STATS_FILE) (await import("node:fs")).writeFileSync(process.env.QA_STATS_FILE, JSON.stringify(stats));
    // Gjenlesing: alle lagrede agenter kan leses tilbake gjennom domenemappingen uten feil
    const back = await c.from("search_agents").select("id, name, filters, assumptions, active, version, last_success_at").in("id", created.slice(0, 200));
    for (const row of back.data ?? []) expect(() => agentFromRow(row as AgentRow), row.id).not.toThrow();
  }, 280_000);
});

// ---------------------------------------------------------------------------
// 2. NULL / fraværende felt
// ---------------------------------------------------------------------------

describe("NULL i broadSearchConfirmed kan ikke omgå aktiveringskravene (DEV-004-feilen)", () => {
  const broad = { bodyTypes: ["suv"] }; // uten merke, med ett reelt kriterium
  const activate = (filters: Record<string, unknown>) =>
    c.from("search_agents").insert({ dealership_id: firm, name: "null-test", filters, assumptions: READY.assumptions, active: true }).select("id");

  it.each([
    ["nøkkelen mangler", { ...broad }],
    ["JSON null", { ...broad, broadSearchConfirmed: null }],
    ["false", { ...broad, broadSearchConfirmed: false }],
  ])("bredt søk uten bekreftelse (%s) avvises som aktiv", async (_l, filters) => {
    const res = await activate(filters);
    expect(res.error?.code).toBe("23514");
    expect(res.error?.message).toContain("search_agents_ready_when_active");
  });

  it.each([
    ["streng «true»", { ...broad, broadSearchConfirmed: "true" }],
    ["tall 1", { ...broad, broadSearchConfirmed: 1 }],
    ["objekt", { ...broad, broadSearchConfirmed: {} }],
  ])("bekreftelse av feil type (%s) avvises", async (_l, filters) => {
    expect((await activate(filters)).error?.code).toBe("23514");
  });

  it("bekreftet bredt søk med ett kriterium godtas; bekreftet uten kriterium og NULL-kriterier avvises", async () => {
    const ok = await activate({ ...broad, broadSearchConfirmed: true });
    expect(ok.error).toBeNull();
    await c.from("search_agents").update({ active: false }).eq("id", ok.data![0]!.id);
    for (const f of [{ broadSearchConfirmed: true }, { broadSearchConfirmed: true, fuels: [], bodyTypes: null, maxPrice: null },
      { broadSearchConfirmed: true, yearMin: null, yearMax: null, maxMileageKm: null, countryCodes: [] }]) {
      expect((await activate(f)).error?.code, JSON.stringify(f)).toBe("23514");
    }
  });

  it("manglende økonomiforutsetninger (alle varianter av ikke oppgitt) blokkerer aktivering", async () => {
    const base = { make: "Volkswagen" };
    const R = READY.assumptions;
    const variants: [string, Record<string, unknown>][] = [
      ["tom", {}],
      ["uten retail", { ...R, retail: null }],
      ["retail uten pris", { ...R, retail: { ...R.retail, expectedRetailTotal: null } }],
      ["retail uten prisgrunnlag", { ...R, retail: { expectedRetailTotal: R.retail.expectedRetailTotal } }],
      ["bare mva-grunnlag", { ...R, retail: { ...R.retail, priceBasis: { vat: "included" } } }],
      ["uten minimum bidrag", { ...R, minimumContribution: null }],
      ["uten reserve", { ...R, preparationReserve: null }],
      ["reserve uten mva-basis", { ...R, preparationReserve: { amount: R.preparationReserve.amount } }],
      ["reservebeløp mangler", { ...R, preparationReserve: { vatBasis: "ex_vat" } }],
    ];
    for (const [label, a] of variants) {
      const res = await c.from("search_agents").insert({ dealership_id: firm, name: "mangler", filters: base, assumptions: a, active: true });
      expect(res.error?.code, label).toBe("23514");
      expect((await c.from("search_agents").insert({ dealership_id: firm, name: "mangler-utkast", filters: base, assumptions: a })).error, `utkast ${label}`).toBeNull();
    }
  });

  it("reserve 0 kr godtas og leses tilbake som uttrykkelig 0; reserve ikke oppgitt forblir null", async () => {
    const zero = await c.from("search_agents").insert({ dealership_id: firm, name: "r0", filters: { make: "VW" },
      assumptions: { ...READY.assumptions, preparationReserve: { amount: { amountMinor: "0", currency: "NOK" }, vatBasis: "incl_vat" } }, active: true })
      .select("id, name, filters, assumptions, active, version, last_success_at").single();
    expect(zero.error).toBeNull();
    const a = agentFromRow(zero.data as AgentRow);
    expect(a.assumptions.preparationReserve).toEqual({ amount: { amountMinor: 0, currency: "NOK" }, vatBasis: "incl_vat" });
    await c.from("search_agents").update({ active: false }).eq("id", zero.data!.id);
    const unknown = await c.from("search_agents").insert({ dealership_id: firm, name: "r-null", filters: { make: "VW" }, assumptions: {} })
      .select("id, name, filters, assumptions, active, version, last_success_at").single();
    expect(agentFromRow(unknown.data as AgentRow).assumptions.preparationReserve).toEqual({ amount: null, vatBasis: null });
  });
});

// ---------------------------------------------------------------------------
// 3. Pengegrensen (R5 / DEC-020)
// ---------------------------------------------------------------------------

type Field = { name: string; build: (money: unknown) => { filters?: unknown; assumptions?: unknown }; currency: string; allowZero: boolean };
const FIELDS: Field[] = [
  { name: "maxPrice", currency: "EUR", allowZero: false, build: (m) => ({ filters: { make: "VW", maxPrice: m } }) },
  { name: "retail.expectedRetailTotal", currency: "NOK", allowZero: false, build: (m) => ({ assumptions: { retail: { expectedRetailTotal: m } } }) },
  { name: "minimumContribution", currency: "NOK", allowZero: false, build: (m) => ({ assumptions: { minimumContribution: m } }) },
  { name: "preparationReserve.amount", currency: "NOK", allowZero: true, build: (m) => ({ assumptions: { preparationReserve: { amount: m } } }) },
];

describe.each(FIELDS)("pengegrense: $name", (f) => {
  const insert = (money: unknown) =>
    c.from("search_agents").insert({ dealership_id: firm, name: `money-${f.name}`, filters: { make: "VW" }, assumptions: {}, ...f.build(money) } as never).select("id, filters, assumptions").single();
  const m = (amountMinor: unknown, currency = f.currency) => ({ amountMinor, currency });

  it("godtar største trygge verdi (2^53−1) og lagrer den som tekst uten tap", async () => {
    const res = await insert(m("9007199254740991"));
    expect(res.error).toBeNull();
    expect(JSON.stringify(res.data)).toContain('"amountMinor":"9007199254740991"');
    expect(JSON.stringify(res.data)).not.toMatch(/9007199254740991[^"]/);
  });

  it.each([
    ["verdi over grensen (2^53)", "9007199254740992"], ["17 sifre", "99999999999999999"], ["JSON-tall", 100], ["stort JSON-tall", 9007199254740991],
    ["desimal", "1.5"], ["desimal med .00", "100.00"], ["vitenskapelig", "1e3"], ["fortegn +", "+5"], ["negativ", "-1"], ["ledende null", "007"],
    ["mellomrom først", " 5"], ["mellomrom sist", "5 "], ["arabisk-indisk siffer", "٣"], ["tom streng", ""], ["null-tegn", "1\u0000"], ["boolsk", true], ["liste", ["100"]],
  ])("avviser %s", async (_label, amount) => {
    const res = await insert(m(amount));
    expect(res.error, `${JSON.stringify(amount)}`).not.toBeNull();
    expect(["23514", "22P05", "22021"]).toContain(res.error?.code);
  });

  it(f.allowZero ? "godtar 0 (uttrykkelig valg)" : "avviser 0 (kan ikke være et ukjent erstatningsbeløp)", async () => {
    const res = await insert(m("0"));
    expect(res.error === null).toBe(f.allowZero);
    if (!f.allowZero) expect(res.error?.code).toBe("23514");
  });

  it("avviser feil valuta, små bokstaver, ekstra nøkler og manglende nøkler", async () => {
    const wrongCurrency = f.currency === "NOK" ? "EUR" : "USD"; // maxPrice: USD ikke støttet; NOK-felt: EUR ikke tillatt
    for (const bad of [m("100", wrongCurrency), m("100", f.currency.toLowerCase()), m("100", "NOKK"), { ...m("100"), extra: 1 },
      { amountMinor: "100" }, { currency: f.currency }, "100", 100, []]) {
      expect((await insert(bad)).error?.code, JSON.stringify(bad)).toBe("23514");
    }
  });
});

describe("tekst: injeksjon og spesialtegn", () => {
  it("SQL-lignende navn lagres og leses tilbake uendret; null-tegn avvises kontrollert", async () => {
    const name = "'); drop table search_agents; -- \"quoted\" <script>x</script>";
    const ok = await c.from("search_agents").insert({ dealership_id: firm, name }).select("id, name").single();
    expect(ok.data?.name).toBe(name);
    expect((await db.query("select count(*)::int n from public.search_agents")).rows[0].n).toBeGreaterThan(0);
    const nul = await c.from("search_agents").insert({ dealership_id: firm, name: "a\u0000b" });
    expect(nul.error).not.toBeNull();
    const nulJson = await c.from("search_agents").insert({ dealership_id: firm, name: "n", filters: { make: "a\u0000b" } });
    expect(nulJson.error).not.toBeNull();
    expect(["23514", "22P05", "22021"]).toContain(nulJson.error?.code);
  });
});

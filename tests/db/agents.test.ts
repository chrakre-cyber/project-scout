/**
 * DEV-004 mot lokal Supabase som ordinære brukere (ingen service-role):
 * databasen håndhever samme validering og aktiveringskrav som domenet,
 * aktiv/pause/reaktivering, maks 10 aktive og RLS for nye endringsveier.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { activationIssues } from "@/domain/agent-validation";
import { parseAgentForm } from "@/server/agent-form";
import { draftToDb } from "@/server/agent-records";
import { AGENT_SETUPS, toFormData } from "../fixtures/agent-setups";
import { adminDb, assertLocal, cleanup, createFirmWithMember, createUser, READY, signIn, type TestUser } from "./harness";

const NOW = new Date("2026-10-06T12:00:00Z");
let db: Client;
let userA: TestUser, userB: TestUser;
let firmA: string, firmB: string;
let a: SupabaseClient, b: SupabaseClient;

beforeAll(async () => {
  assertLocal();
  db = await adminDb();
  [userA, userB] = [await createUser(db, "dev4-a"), await createUser(db, "dev4-b")];
  firmA = await createFirmWithMember(db, "DEV-004 A", userA);
  firmB = await createFirmWithMember(db, "DEV-004 B", userB);
  [a, b] = [await signIn(userA), await signIn(userB)];
});

afterAll(async () => {
  if (db) {
    await cleanup(db, [firmA, firmB].filter(Boolean), [userA, userB].filter(Boolean));
    await db.end();
  }
});

async function insert(client: SupabaseClient, firm: string, row: Record<string, unknown>) {
  return client.from("search_agents").insert({ dealership_id: firm, ...row }).select("id, version, active").single();
}
const activeCount = async (firm: string) =>
  (await db.query("select count(*)::int n from public.search_agents where dealership_id = $1 and active", [firm])).rows[0].n as number;

describe("10 representative oppsett: databasen er enig med domenet", () => {
  it.each(AGENT_SETUPS.filter((s) => s.valid))("$id $title", async (s) => {
    const draft = parseAgentForm(toFormData(s.form), NOW).draft!;
    const created = await insert(a, firmA, draftToDb(draft));
    expect(created.error).toBeNull();
    expect(created.data).toMatchObject({ active: false, version: 1 });

    const activate = await a.from("search_agents").update({ active: true }).eq("id", created.data!.id).select("active");
    const ready = activationIssues(draft, NOW).length === 0;
    expect(ready).toBe(s.ready);
    if (ready) {
      expect(activate.error).toBeNull();
      expect(activate.data).toEqual([{ active: true }]);
      await a.from("search_agents").update({ active: false }).eq("id", created.data!.id);
    } else {
      expect(activate.error?.code).toBe("23514");
      expect(activate.error?.message).toContain("search_agents_ready_when_active");
    }
  });
});

describe("ugyldige agenter avvises av databasen også ved direkte API-kall", () => {
  const filters: [string, Record<string, unknown>][] = [
    ["år snudd", { yearMin: 2024, yearMax: 2020 }],
    ["år som tekst", { yearMin: "2020" }],
    ["år utenfor", { yearMin: 1899 }],
    ["modell uten merke", { model: "Golf" }],
    ["variant uten modell", { make: "VW", variant: "GTI" }],
    ["tomt merke", { make: "" }],
    ["merke med mellomrom", { make: " BMW" }],
    ["merke over 60 tegn", { make: "x".repeat(61) }],
    ["0 km", { maxMileageKm: 0 }],
    ["desimal-km", { maxMileageKm: 1.5 }],
    ["ukjent drivstoff", { fuels: ["rocket"] }],
    ["duplikat karosseri", { bodyTypes: ["suv", "suv"] }],
    ["ukjent land", { countryCodes: ["US"] }],
    ["pris i USD", { maxPrice: { amountMinor: "100", currency: "USD" } }],
    ["pris som JSON-tall", { maxPrice: { amountMinor: 100, currency: "EUR" } }],
    ["pris 0", { maxPrice: { amountMinor: "0", currency: "EUR" } }],
    ["ukjent filternøkkel", { color: "red" }],
    ["bekreftelse som tekst", { broadSearchConfirmed: "yes" }],
  ];
  it.each(filters)("filters: %s", async (_label, f) => {
    const res = await insert(a, firmA, { name: "Ugyldig", filters: f });
    expect(res.error?.code).toBe("23514");
    expect(res.error?.message).toContain("search_agents_filters_valid");
  });

  const assumptions: [string, Record<string, unknown>][] = [
    ["retail i EUR", { retail: { expectedRetailTotal: { amountMinor: "100", currency: "EUR" } } }],
    ["retail 0", { retail: { expectedRetailTotal: { amountMinor: "0", currency: "NOK" } } }],
    ["ukjent prisgrunnlag", { retail: { priceBasis: { vat: "yes" } } }],
    ["minimum bidrag 0", { minimumContribution: { amountMinor: "0", currency: "NOK" } }],
    ["negativ reserve", { preparationReserve: { amount: { amountMinor: "-1", currency: "NOK" } } }],
    ["ukjent mva.-basis reserve", { preparationReserve: { vatBasis: "x" } }],
    ["ukjent nøkkel", { taxProfile: "x" }],
    ["reserve som tall", { preparationReserve: 15000 }],
  ];
  it.each(assumptions)("assumptions: %s", async (_label, as) => {
    const res = await insert(a, firmA, { name: "Ugyldig", assumptions: as });
    expect(res.error?.code).toBe("23514");
    expect(res.error?.message).toContain("search_agents_assumptions_valid");
  });

  it("reserve 0 kr er gyldig; DEV-002-agenter med tomme forutsetninger er fortsatt gyldige", async () => {
    expect((await insert(a, firmA, { name: "Null reserve", assumptions: { preparationReserve: { amount: { amountMinor: "0", currency: "NOK" }, vatBasis: "ex_vat" } } })).error).toBeNull();
    expect((await insert(a, firmA, { name: "DEV-002-stil", filters: { make: "VW", model: "Golf", yearMin: null, fuels: [], maxPrice: null }, assumptions: {} })).error).toBeNull();
  });
});

describe("aktivering krever komplett agent (R7 / DEC-023)", () => {
  const econ = READY.assumptions;
  it("ufullstendig agent kan ikke settes aktiv, verken ved insert eller update", async () => {
    expect((await insert(a, firmA, { name: "x", active: true, filters: { make: "VW" } })).error?.message).toContain("search_agents_ready_when_active");
    const draft = await insert(a, firmA, { name: "Utkast", filters: { make: "VW" } });
    expect((await a.from("search_agents").update({ active: true }).eq("id", draft.data!.id)).error?.code).toBe("23514");
  });

  it("uten merke: krever bekreftelse OG minst ett kriterium", async () => {
    const unconfirmed = await insert(a, firmA, { name: "u", filters: { bodyTypes: ["suv"] }, assumptions: econ, active: true });
    expect(unconfirmed.error?.code).toBe("23514");
    const open = await insert(a, firmA, { name: "o", filters: { broadSearchConfirmed: true }, assumptions: econ, active: true });
    expect(open.error?.code).toBe("23514");
    const clarified = await insert(a, firmA, { name: "c", filters: { broadSearchConfirmed: true, bodyTypes: ["suv"] }, assumptions: econ, active: true });
    expect(clarified.error).toBeNull();
    await a.from("search_agents").update({ active: false }).eq("id", clarified.data!.id);
  });
});

describe("pause, redigering og reaktivering", () => {
  it("aktiv agent kan ikke redigeres til ufullstendig; pauset kan; reaktivering etter komplettering; versjon øker", async () => {
    const created = await insert(a, firmA, { name: "Syklus", ...READY, active: true });
    const id = created.data!.id;
    expect(created.data).toMatchObject({ active: true, version: 1 });

    const broken = await a.from("search_agents").update({ assumptions: {} }).eq("id", id);
    expect(broken.error?.code).toBe("23514");

    expect((await a.from("search_agents").update({ active: false }).eq("id", id)).error).toBeNull();
    expect((await a.from("search_agents").update({ assumptions: {} }).eq("id", id)).error).toBeNull();
    expect((await a.from("search_agents").update({ active: true }).eq("id", id)).error?.code).toBe("23514");
    expect((await a.from("search_agents").update({ assumptions: READY.assumptions }).eq("id", id)).error).toBeNull();
    expect((await a.from("search_agents").update({ active: true }).eq("id", id)).error).toBeNull();

    const final = await a.from("search_agents").select("active, version, name").eq("id", id).single();
    expect(final.data).toEqual({ active: true, version: 5, name: "Syklus" }); // pause, edit, edit, aktiver = 4 endringer
    await a.from("search_agents").update({ active: false }).eq("id", id);
  });
});

describe("maks 10 aktive: 9 → 10 → 11 og pause frigjør plass", () => {
  it("10. aktivering virker, 11. avvises, pause gir plass", async () => {
    expect(await activeCount(firmB)).toBe(0);
    const ids: string[] = [];
    for (let i = 0; i < 11; i++) ids.push((await insert(b, firmB, { name: `B ${i}`, ...READY })).data!.id);
    for (const id of ids.slice(0, 9)) expect((await b.from("search_agents").update({ active: true }).eq("id", id)).error).toBeNull();
    expect(await activeCount(firmB)).toBe(9);

    expect((await b.from("search_agents").update({ active: true }).eq("id", ids[9]!)).error).toBeNull(); // 9 → 10
    const eleventh = await b.from("search_agents").update({ active: true }).eq("id", ids[10]!);
    expect(eleventh.error?.code).toBe("23514");
    expect(eleventh.error?.message).toContain("active_agent_limit");
    expect(await activeCount(firmB)).toBe(10);

    expect((await b.from("search_agents").update({ active: false }).eq("id", ids[0]!)).error).toBeNull();
    expect((await b.from("search_agents").update({ active: true }).eq("id", ids[10]!)).error).toBeNull();
    expect(await activeCount(firmB)).toBe(10);
  });
});

describe("RLS for redigering, aktivering og pause på tvers av firma", () => {
  it("A kan ikke aktivere, pause eller redigere Bs agent; B er uendret", async () => {
    const target = (await insert(b, firmB, { name: "B-mål", ...READY })).data!.id;
    const before = (await db.query("select active, version, name, filters from public.search_agents where id = $1", [target])).rows[0];

    expect((await a.from("search_agents").update({ active: true }).eq("id", target).select("id")).data).toEqual([]);
    expect((await a.from("search_agents").update({ name: "kapret", filters: { make: "X" } }).eq("id", target).select("id")).data).toEqual([]);
    const activeB = (await db.query("select id from public.search_agents where dealership_id = $1 and active limit 1", [firmB])).rows[0].id;
    expect((await a.from("search_agents").update({ active: false }).eq("id", activeB).select("id")).data).toEqual([]);
    expect((await db.query("select active from public.search_agents where id = $1", [activeB])).rows[0].active).toBe(true);

    const after = (await db.query("select active, version, name, filters from public.search_agents where id = $1", [target])).rows[0];
    expect(after).toEqual(before);
  });

  it("firma-ID kan fortsatt ikke byttes via update, og A ser ikke Bs agenter", async () => {
    const own = (await insert(a, firmA, { name: "Egen" })).data!.id;
    expect((await a.from("search_agents").update({ dealership_id: firmB }).eq("id", own)).error?.code).toBe("42501");
    const seen = await a.from("search_agents").select("dealership_id");
    expect(new Set(seen.data!.map((r) => r.dealership_id))).toEqual(new Set([firmA]));
  });
});

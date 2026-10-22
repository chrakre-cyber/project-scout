/**
 * ECON-006d — små testrester fra avstemmingen, gjennom faktisk visning (previewForDisplay/detailForDisplay, ikke bare kjerne): (1) ukjent rettighetsprofil og ukjent kjøretøyprofil,
 * (2) B1: akseptdato utenfor dokumentert periode, (3) J5: ukjent fradragsstatus ⇒ to scenarioer for økonomisk kost — adskilt fra BEV med ukjent elbilkvalifisering.
 * Forventede beløp er B-Merovo-scenario / fixturekonvensjon (se econ006-reference), ikke produksjonsregler.
 */
import { describe, expect, it } from "vitest";
import { REGISTERED_PROFILES, rightsForSource, type ProviderRightsProfile } from "@/domain/provider-rights";
import type { EconomicsView } from "@/domain/search-economics";
import type { NormalizedListing } from "@/domain/types";
import type { MarketplaceProvider } from "@/providers/marketplace";
import { storedKey } from "@/server/dealer-economics";
import { publicIdFor } from "@/server/public-ids";
import { detailForDisplay, previewForDisplay, type EconomicsContext } from "@/server/search-display";
import { ECON_CASES, FIXTURE_FX } from "./fixtures/econ-golden";
import { FIRM_A, NOW, SEARCH_1, candidateFor, dealerInput, listing, specOf, stored } from "./fixtures/economics-005c";
import { profile } from "./fixtures/rights-profiles";
// @ts-expect-error — rent JS-modul delt med e2e
import { expected } from "./e2e/support/econ006-reference.mjs";

const eur = (i: number, priceEur: string): NormalizedListing => {
  const c = ECON_CASES[i]!, base = listing(), g = c.golden.input;
  return listing({
    sourceListingId: `ad-${i}`,
    price: { ...base.price, stated: { amount: priceEur, currency: "EUR" }, amount: { amountMinor: Math.round(Number(priceEur) * 100), currency: "EUR" }, basis: "net" },
    specs: { ...base.specs, fuel: i === 0 ? "plugin_hybrid" : i === 1 ? "electric" : "diesel", co2: { gramsPerKm: g.co2.gramsPerKm ?? 0, testMethod: "WLTP" }, curbWeightKg: g.norwegianTaxWeight.kg ?? null },
  } as Partial<NormalizedListing>);
};
const fxD = { pair: "EUR/NOK", rate: FIXTURE_FX.rate, sourceLabel: "forhandlerens egen kursnotering (testdata)", quotedAt: "2026-10-19", validUntil: "2026-11-11", validFrom: "2026-10-15", validTo: "2026-11-11" };
/** Fullt forhandlerinput for case i (kjøretøydata fra de gyldne fixturene), med mulighet for overstyring. */
const input = (i: number, over: Parameters<typeof dealerInput>[0] = {}) => {
  const g = ECON_CASES[i]!.golden.input;
  return dealerInput({
    propulsion: { pistonCombustionEngine: g.propulsion.pistonCombustionEngine, externallyChargeable: g.propulsion.externallyChargeable, combustionFuel: g.propulsion.combustionFuel, hybridization: g.propulsion.hybridization as "none" | null, basis: "type_approval" } as never,
    taxWeight: { kg: g.norwegianTaxWeight.kg, basis: "vehicle_register" }, co2: { gramsPerKm: g.co2.gramsPerKm, method: g.co2.method as never },
    firstRegistration: { precision: "month", value: g.firstRegistration.value, basis: "vehicle_register" }, norwegianRegistration: { date: "2026-10-18", kind: "expected" },
    customsDate: { date: "2026-10-20", kind: "expected_scenario" }, fx: { acquisition: fxD, customs: fxD }, transportToBorder: { amount: "8000" }, ...over,
  });
};
const providerOf = (l: NormalizedListing): MarketplaceProvider => ({
  source: "synthetic-demo", search: async () => ({ items: [l], nextPage: null, sourceTotal: 1, truncated: false, fetchedAt: NOW.toISOString(), rejected: [] }), getListing: async () => l,
});
const view = async (i: number, price: string, over: Parameters<typeof dealerInput>[0] = {}, o: { scenario?: "passenger" | "van" | "unspecified"; omit?: Array<keyof ReturnType<typeof input>> } = {}): Promise<EconomicsView> => {
  const l = eur(i, price);
  const spec = specOf([], o.scenario ?? "passenger");
  const cand = candidateFor(l);
  const rights = rightsForSource("synthetic-demo", NOW, REGISTERED_PROFILES);
  const inp = { ...input(i, over) } as Record<string, unknown>;
  for (const k of o.omit ?? []) delete inp[k as string];
  const ctx: EconomicsContext = { dealershipId: FIRM_A, searchId: SEARCH_1, storedInputs: new Map([[storedKey(cand.id, cand.version), stored({ rights, spec, cand, input: inp as never })]]), profile: null };
  const out = await previewForDisplay(spec, { provider: providerOf(l), now: () => NOW, economics: ctx });
  if (!out.ok) throw new Error("kilden feilet");
  return out.items[0]!.economics;
};
const labels = (e: EconomicsView): string[] => (e.status === "scenarios" ? e.landed.kind === "scenarios" ? e.landed.scenarios.map((s) => s.label) : [] : []);
const landedNoks = (e: EconomicsView): string[] => (e.status === "scenarios" && e.landed.kind === "scenarios" ? e.landed.scenarios.map((s) => s.nok) : []);

describe("ukjent profil — rettighetsprofil", () => {
  const l = eur(2, "36500");
  const pid = publicIdFor("synthetic-demo", l.sourceListingId, "synthetic");
  it.each([
    ["ingen registrert profil (kilden kan ikke engang identifiseres: den opake id-en kan ikke utledes)", [] as ProviderRightsProfile[], "not_found"],
    ["profil som ikke er verifisert (utkast)", [profile({ status: "draft" })], "blocked"],
  ] as const)("%s ⇒ ikke vist (%s), uten økonomi eller tall", async (_n, profiles, kind) => {
    const out = await detailForDisplay(specOf(), pid, { provider: providerOf(l), now: () => NOW, profiles });
    expect(out.kind).toBe(kind);
    expect(JSON.stringify(out)).not.toMatch(/\d{3}\s?\d{3}|estimate|landed/i);
    const prev = await previewForDisplay(specOf(), { provider: providerOf(l), now: () => NOW, profiles });
    if (prev.ok) expect(prev.items).toHaveLength(0);
  });
});

describe("ukjent profil — kjøretøy/registreringsscenario", () => {
  it.each(["van", "unspecified"] as const)("planlagt registrering «%s» (støttes ikke) ⇒ ikke beregnet, ingen tall, ingen positivt utfall", async (scenario) => {
    const e = await view(2, "36500", {}, { scenario });
    expect(e.status).toBe("not_calculated");
    if (e.status !== "not_calculated") return;
    expect(e.positiveBudgetEligible).toBe(false);
    expect(e.reasons).toContain("scenario_not_supported");
    expect(e.explanation).toBeNull();
  });
  it("ukjent drivlinje (alle felt ukjent) ⇒ aldri estimat; drivlinje er et manglende, registrerbart felt", async () => {
    const e = await view(2, "36500", { propulsion: { pistonCombustionEngine: null, externallyChargeable: null, combustionFuel: null, hybridization: null, basis: "dealer_entered" } });
    expect(e.status === "estimate" || e.status === "scenarios").toBe(false);
    if (e.status === "unavailable") throw new Error("uventet");
    expect(e.positiveBudgetEligible).toBe(false);
    expect(e.explanation?.missing.map((m) => m.field)).toContain("propulsion");
  });
});

describe("B1 — akseptdato utenfor dokumentert periode gjennom visning", () => {
  it.each([["2027-01-05", "etter"], ["2025-12-31", "før"]])("akseptdato %s (%s 2026) ⇒ ikke estimat; årsaken vises; mva.-avhengige summer er ikke beregnet", async (date) => {
    const e = await view(2, "36500", { customsDate: { date, kind: "expected_scenario" } });
    if (e.status === "unavailable") throw new Error("uventet");
    expect(e.status === "estimate" || e.status === "scenarios").toBe(false);
    expect(e.positiveBudgetEligible).toBe(false);
    const all = JSON.stringify(e);
    expect(all).toContain("customs_acceptance_date_outside_documented_period");
    expect(all).not.toContain(String(expected("diesel").cash)); // ingen tall fra et punktestimat
    if (e.status === "not_calculated") expect(e.reasons.length).toBeGreaterThan(0);
  });
  it("kontroll: samme input med dato i perioden gir estimat (så avslaget skyldes datoen)", async () => {
    const e = await view(2, "36500", {});
    expect(e.status).toBe("estimate");
  });
});

describe("J5 — ukjent fradragsstatus ⇒ to scenarioer, adskilt fra BEV med ukjent elbilkvalifisering", () => {
  it("diesel med fradrag «ukjent» (uttrykkelig): kontantbehov er ÉN verdi, økonomisk kost er to scenarioer merket med fradragsstatus — ikke elbilfritak", async () => {
    const e = await view(2, "36500", { deduction: "unknown" });
    expect(e.status).toBe("scenarios");
    if (e.status !== "scenarios") return;
    const x = expected("diesel");
    expect(e.cash).toEqual({ kind: "value", nok: String(x.cash) });
    expect(landedNoks(e).sort()).toEqual([String(x.cash - x.vat), String(x.cash)].sort());
    const ls = labels(e);
    expect(ls).toHaveLength(2);
    expect(ls.some((t) => /fradragsberettiget/.test(t) && !/ikke/.test(t))).toBe(true);
    expect(ls.some((t) => /ikke fradragsberettiget/.test(t))).toBe(true);
    expect(ls.join(" ")).not.toMatch(/elbilfritak/i);
    expect(e.positiveBudgetEligible).toBe(false);
    expect(e.explanation?.missing.map((m) => m.field)).toContain("deduction");
    expect(e.explanation?.missing.some((m) => m.field === "ev_qualification")).toBe(false);
  });
  it("diesel uten fradragsstatus i det hele tatt (utelatt): samme to scenarioer (ukjent er ukjent)", async () => {
    const e = await view(2, "36500", {}, { omit: ["deduction"] });
    expect(e.status).toBe("scenarios");
    expect(labels(e).join(" ")).toMatch(/fradragsberettiget/);
  });
  it("BEV med KJENT fradragsstatus og ukjent elbilkvalifisering: scenarioene gjelder elbilfritak, ikke fradrag", async () => {
    const e = await view(1, "32460.50", { deduction: "non_recoverable" });
    expect(e.status).toBe("scenarios");
    if (e.status !== "scenarios") return;
    const x = expected("bev");
    expect(landedNoks(e).sort()).toEqual([String(x.cashWithExemption), String(x.cash)].sort());
    const t = labels(e).join(" ");
    expect(t).toMatch(/elbilfritak/i);
    expect(t).not.toMatch(/fradragsberettiget/);
    expect(e.explanation?.missing.map((m) => m.field)).toContain("ev_qualification");
    expect(e.explanation?.missing.map((m) => m.field)).not.toContain("deduction");
  });
  it("BEV med BEGGE ukjente: fire kombinasjoner, hver merket med både elbilfritak og fradragsstatus; kontantbehov er to scenarioer (bare elbilfritak)", async () => {
    const e = await view(1, "32460.50", { deduction: "unknown" });
    expect(e.status).toBe("scenarios");
    if (e.status !== "scenarios" || e.landed.kind !== "scenarios" || e.cash.kind !== "scenarios") throw new Error("forventet scenarioer");
    expect(e.landed.scenarios).toHaveLength(4);
    expect(e.cash.scenarios).toHaveLength(2);
    for (const s of e.landed.scenarios) { expect(s.label).toMatch(/elbilfritak/i); expect(s.label).toMatch(/fradragsberettiget/); }
    expect(new Set(e.landed.scenarios.map((s) => s.label)).size).toBe(4);
    expect(e.positiveBudgetEligible).toBe(false);
  });
});

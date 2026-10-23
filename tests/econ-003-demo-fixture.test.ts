/**
 * ECON-003-2 (demo) — syntetiske demoforutsetninger for den kuraterte BMW iX3-demoen, og guardrailene rundt dem.
 *
 * Tall her er håndregnet fra demo-INPUTENE, ikke kopiert fra motoren (demokurs 11,50, 2 260 kg, BEV, 03/2024, transport 8 000, netto EUR 36 950):
 *   kjøpesum 36 950 × 11,50 = 424 925 ; tollverdi 424 925 + 8 000 = 432 925 ; engangsavgift 18 058 (= (2 260−500)×12,71×0,70 = 15 658 + vrakpant 2 400; 31 mnd ⇒ 30 %) ;
 *   mva. MED elbilfritak 25 % × (432 925 − 300 000) = 33 231,25 ⇒ 33 231 ; UTEN fritak 25 % × 432 925 = 108 231,25 ⇒ 108 231 ;
 *   total med fritak 424 925 + 8 000 + 18 058 + 33 231 = 484 214 ; uten fritak 424 925 + 8 000 + 18 058 + 108 231 = 559 214.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DEMO_CATALOG } from "@/adapters/search-catalog/demo-catalog";
import { AcquisitionSummary } from "@/components/search/AcquisitionSummary";
import { EconomicsNote } from "@/components/search/EconomicsNote";
import { ResultCard } from "@/components/search/ResultCard";
import { REGISTERED_PROFILES, rightsForSource, type ProviderRightsProfile } from "@/domain/provider-rights";
import { DEMO_INPUTS_NOTE, parseDealerInput, toAcquisitionSummary } from "@/domain/search-economics";
import type { NormalizedListing } from "@/domain/types";
import type { MarketplaceProvider } from "@/providers/marketplace";
import { syntheticRawListings } from "@/providers/marketplace/synthetic/fixtures";
import { SyntheticMarketplaceProvider } from "@/providers/marketplace/synthetic/provider";
import { storedKey } from "@/server/dealer-economics";
import { DEMO_FX_NOK_PER_EUR, demoDealerInput, demoStoredInput, isCuratedDemoVehicle } from "@/server/demo-economics";
import { assessEconomics } from "@/server/search-economics";
import { EXAMPLES } from "@/server/search-examples";
import { parseSearchFormValues } from "@/server/search-form";
import { previewForDisplay, type DisplayItem, type EconomicsContext } from "@/server/search-display";
import { FIRM_A, SEARCH_1, candidateFor, dealerInput, listing, specOf, stored } from "./fixtures/economics-005c";
import { profile } from "./fixtures/rights-profiles";

/** Råpostens observasjon er 2026-10-12T18:00Z og den syntetiske profilen lagrer i 7 dager ⇒ klokken må ligge innenfor (i drift fornyes demoens observasjonstider, ECON-006e). */
const NOW = new Date("2026-10-14T12:00:00Z");
const synth = (now = NOW) => new SyntheticMarketplaceProvider({ records: syntheticRawListings, now: () => now });
const demoSpec = () => {
  const r = parseSearchFormValues({ ...EXAMPLES.find((e) => e.id === "demo-ix3")!.values() }, DEMO_CATALOG, { newCostId: () => "000000000001" });
  if (!r.ok || !r.spec) throw new Error(JSON.stringify(r.errors));
  return r.spec;
};
const rightsNow = rightsForSource("synthetic-demo", NOW, REGISTERED_PROFILES);
const html = (i: DisplayItem) => renderToStaticMarkup(createElement(ResultCard, { item: i, draftId: "d1", version: 1 }));
const text = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/g, " ").replace(/\s+/g, " ");
const SPEC_COST_FIELDS = ["total", "amount"];
const scen = (i: DisplayItem) => { const s = toAcquisitionSummary(i.economics); return s.state === "scenarios" ? Object.fromEntries(s.scenarios.map((c) => [c.id, c.amountNok])) : null; };

async function items(ctx?: EconomicsContext, now = NOW) {
  const out = await previewForDisplay(demoSpec(), { provider: synth(now), now: () => now, economics: ctx });
  if (!out.ok) throw new Error("demo feilet");
  return out.items;
}
/** Annonser som viser et beløp (estimat/delsum/scenarier) — ikke «nedre grense 0» uten kontekst. */
const top = (all: DisplayItem[]) => all.filter((i) => { const st = toAcquisitionSummary(i.economics).state; return st !== "unavailable" && st !== "hidden"; });

describe("1–2. den kuraterte demoen får demoforutsetninger, og tallene kommer fra den ekte motoren", () => {
  it("uten forhandlerkontekst: nøyaktig én annonse (dix3-001) beregnes; resten er «ikke beregnet»", async () => {
    const all = await items();
    const computed = top(all);
    expect(computed).toHaveLength(1);
    expect(all.filter((i) => i.economics.status === "not_calculated").length).toBe(all.length - 1);
    expect(computed[0]!.listing.title).toMatchObject({ state: "value", value: { make: "BMW", model: "iX3", variant: "Inspiring" } });
  });

  it("motorens scenarier: 484 214 kr med elbilfritak og 559 214 kr uten — kjøpesum 424 925, engangsavgift 18 058, transport 8 000, mva. ulik per scenario", async () => {
    const i = top(await items())[0]!;
    expect(scen(i)).toEqual({ with_exemption__basis_customs_value: "484214", no_exemption: "559214" });
    const s = toAcquisitionSummary(i.economics);
    if (s.state !== "scenarios") throw new Error("forventet scenarier");
    expect(Object.fromEntries(s.lines.map((l) => [l.id, l.amountNok]))).toEqual({ purchase: "424925", registration_tax: "18058", vat: null, transport: "8000" });
    expect(s.lines.find((l) => l.id === "purchase")!.original).toEqual({ amount: "36950", currency: "EUR" });
    expect(s.fx.map((f) => [f.role, f.rate])).toEqual([["acquisition", "11.5"], ["customs", "11.5"]]); // to adskilte roller
    expect(s.demoInputs).toBe(true);
  });

  it("tallene kommer fra motoren: samme demoinput med en annen kurs gir andre, motorberegnede totaler (ingenting er hardkodet)", async () => {
    // kurs 12,00: kjøpesum 443 400 ; tollverdi 451 400 ; mva. med fritak 25 % × 151 400 = 37 850 ; uten 25 % × 451 400 = 112 850 ; avgift 18 058 ; transport 8 000
    //   total med fritak 443 400 + 8 000 + 18 058 + 37 850 = 507 308 ; uten fritak 443 400 + 8 000 + 18 058 + 112 850 = 582 308
    const l = (await synth().getListing("dix3-001"))!;
    const cand = candidateFor(l);
    const base = demoStoredInput({ dealershipId: FIRM_A, searchId: SEARCH_1, candidate: cand, spec: demoSpec(), rights: rightsNow, now: NOW });
    const fx = base.input.fx!;
    const changed = { ...base, input: { ...base.input, fx: { acquisition: { ...fx.acquisition!, rate: "12.00" }, customs: { ...fx.customs!, rate: "12.00" } } } };
    const a = assessEconomics({ dealershipId: FIRM_A, searchId: SEARCH_1, listing: l, candidate: cand, spec: demoSpec(), stored: changed, profile: null, now: NOW });
    if (a.kind !== "assessed" || a.display.overall === "unavailable") throw new Error("forventet beregnet");
    const cash = a.display.cash;
    expect(cash.kind).toBe("scenarios");
    const totals = cash.kind === "scenarios" ? Object.fromEntries(cash.scenarios.map((c) => [c.id, c.valueNok.toString()])) : {};
    expect(totals).toEqual({ with_exemption__basis_customs_value: "507308", no_exemption: "582308" });
  });

  it("demoinputene er gyldige for den vanlige parseren, og kursen er den dokumenterte demokursen (docs/tax/demo-series.json)", () => {
    const parsed = parseDealerInput(demoDealerInput(NOW));
    expect(parsed.ok).toBe(true);
    const doc = readFileSync("docs/tax/demo-series.json", "utf8");
    expect(doc).toContain(`"fxNokPerEur": "${DEMO_FX_NOK_PER_EUR} (SYNTETISK`);
  });

  it("elbilfritak og fradrag/mva.-håndtering er IKKE antatt: fixturen utelater dem, og usikkerheten vises som scenariospenn", async () => {
    const input = demoDealerInput(NOW);
    for (const k of ["deduction", "vatHandling", "lineScopes", "evidenceRef"]) expect(input).not.toHaveProperty(k);
    expect(JSON.stringify(input)).not.toMatch(/exemption|elbilfritak/i);
    const i = top(await items())[0]!;
    const c = text(html(i));
    expect(c).toMatch(/Estimert total til Norge: 484 214 kr – 559 214 kr|Estimert total til Norge: 484 214 – 559 214 kr/);
    expect(c).toContain("Totalen avhenger av om elbilfritaket gjelder. Det er ikke bekreftet.");
    expect(c).not.toMatch(/Estimert total til Norge: 484 214 kr inkl/); // aldri ett tall som skjuler usikkerheten
  });
});

describe("3. ingen hardkodede utdata i UI eller fixture", () => {
  const files = (dir: string): string[] => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(n) ? [p] : []; });
  it("ingen kilde under src/ inneholder demoens beregnede totaler, mva., kjøpesum eller engangsavgift som tallkonstanter", () => {
    const OUTPUTS = ["484214", "559214", "424925", "33231", "108231", "18058", "435558", "445558", "510558", "520558", "394000", "23500", "25500"];
    for (const f of files("src")) {
      const t = readFileSync(f, "utf8").replace(/[ _ ]/g, "");
      for (const o of OUTPUTS) expect(t, `${f} inneholder ${o}`).not.toContain(o);
    }
  });
  it("fixturen er rene inputs: ingen total/avgift/mva.-felter, og bare de avtalte beløpene (transport 8 000, forsikring 0)", () => {
    const input = demoDealerInput(NOW);
    // nøyaktig disse INPUT-nøklene — en ny nøkkel (f.eks. et ferdig beløp) bryter testen
    expect(Object.keys(input).sort()).toEqual(["climateGas", "co2", "customsDate", "firstRegistration", "foreignVat", "fx", "insurance", "loadingHandling", "propulsion", "registrationFee", "schemaVersion", "taxWeight", "transportAfterBorder", "transportToBorder"]);
    expect(input.transportToBorder).toEqual({ amount: "8000" });
    expect(input.insurance).toEqual({ amount: "0" });
    expect(input.taxWeight).toEqual({ kg: 2260, basis: "dealer_entered" });
    expect(input.co2).toEqual({ gramsPerKm: 0, method: "wltp_combined" });
    expect(SPEC_COST_FIELDS.length).toBeGreaterThan(0);
  });
});

describe("4–5. andre kjøretøy og ekte kilder arver aldri demoforutsetninger (fail closed)", () => {
  it("andre syntetiske iX3-annonser uten fixture forblir «ikke beregnet» (dix3-002 … dix3-010) og får ingen demomerking", async () => {
    const all = await items();
    for (const i of all) {
      if (top([i]).length === 1) continue; // dix3-001
      expect(toAcquisitionSummary(i.economics).state).toBe("unavailable");
      expect(html(i)).not.toContain("Demo-estimat");
      expect(html(i)).not.toContain('data-testid="acq-total"');
    }
    // også med forhandlerkontekst (uten egen input) får ingen annen annonse et beløp
    const ctxAll = await items({ dealershipId: FIRM_A, searchId: SEARCH_1, storedInputs: new Map(), profile: null });
    expect(top(ctxAll)).toHaveLength(1);
  });

  it("isCuratedDemoVehicle er strengt: avvik i kilde, id, proveniens, miljø, pris, modell eller registrering gir ingen demoforutsetninger", async () => {
    const l = (await synth().getListing("dix3-001"))!;
    expect(isCuratedDemoVehicle(l, rightsNow)).toBe(true);
    const mut = (over: Partial<NormalizedListing>) => ({ ...l, ...over }) as NormalizedListing;
    expect(isCuratedDemoVehicle(mut({ source: "mobile-sandbox" }), rightsNow)).toBe(false);
    expect(isCuratedDemoVehicle(mut({ sourceListingId: "dix3-002" }), rightsNow)).toBe(false);
    expect(isCuratedDemoVehicle(mut({ provenance: { kind: "provider", description: "x", normalizationNotes: [] } as unknown as NormalizedListing["provenance"] }), rightsNow)).toBe(false);
    expect(isCuratedDemoVehicle(mut({ price: { ...l.price!, stated: { amount: "37950", currency: "EUR" } } }), rightsNow)).toBe(false);
    expect(isCuratedDemoVehicle(mut({ price: { ...l.price!, basis: "gross" } }), rightsNow)).toBe(false);
    expect(isCuratedDemoVehicle(mut({ specs: { ...l.specs, model: "iX1" } }), rightsNow)).toBe(false);
    expect(isCuratedDemoVehicle(mut({ specs: { ...l.specs, firstRegistration: { precision: "month", year: 2023, month: 3 } } }), rightsNow)).toBe(false);
    expect(isCuratedDemoVehicle(mut({ specs: { ...l.specs, firstRegistration: null } }), rightsNow)).toBe(false);
    // rettigheter: ikke i kraft eller ikke syntetisk miljø ⇒ aldri
    expect(isCuratedDemoVehicle(l, rightsForSource("synthetic-demo", NOW, []))).toBe(false);
    const sandbox = profile({ providerId: "synthetic-demo", environment: "sandbox", providerName: "Test" });
    expect(isCuratedDemoVehicle(l, rightsForSource("synthetic-demo", NOW, [sandbox]))).toBe(false);
  });

  it("en annonse som ser ut som demobilen men kommer fra en leverandør/sandbox får ikke demoforutsetninger (full pipeline)", async () => {
    const l = (await synth().getListing("dix3-001"))!;
    const spoof: NormalizedListing = { ...l, source: "test-provider", provenance: { ...l.provenance } };
    const sandbox: ProviderRightsProfile = profile({
      providerId: "test-provider", environment: "sandbox", providerName: "Testleverandør",
      derivedEconomics: { allow: { price: true, registration: true, specs: true }, display: true }, storage: { ...profile().storage, retentionSeconds: 604_800 },
    });
    const provider: MarketplaceProvider = { source: "test-provider", search: async () => ({ items: [spoof], nextPage: null, sourceTotal: 1, truncated: false, fetchedAt: NOW.toISOString(), rejected: [] }), getListing: async () => spoof };
    const out = await previewForDisplay(specOf(), { provider, now: () => NOW, profiles: [sandbox], publicIdKey: "test-key-0123456789abcdef", economics: { dealershipId: FIRM_A, searchId: SEARCH_1, storedInputs: new Map(), profile: null } });
    if (!out.ok) throw new Error("kilden feilet");
    for (const i of out.items) {
      expect(["not_calculated", "unavailable"]).toContain(i.economics.status);
      expect(html(i)).not.toContain("Demo-estimat");
      expect(JSON.stringify(i.economics)).not.toContain(DEMO_INPUTS_NOTE);
    }
  });
});

describe("6. den vanlige forhandlerveien er uendret og autoritativ", () => {
  const ctxWith = async (input: Parameters<typeof dealerInput>[0] | "stale", now = NOW): Promise<EconomicsContext> => {
    const l = (await synth(now).getListing("dix3-001"))!;
    const cand = candidateFor(l);
    const spec = demoSpec();
    const base = stored({ rights: rightsNow, spec, cand, input: dealerInput(input === "stale" ? {} : input), confirmedAt: now.toISOString() });
    const s = input === "stale" ? { ...base, binding: { ...base.binding, candidateVersion: "rev1:endret" } } : base;
    return { dealershipId: FIRM_A, searchId: SEARCH_1, storedInputs: new Map([[storedKey(cand.id, cand.version), s]]), profile: null };
  };

  it("forhandlerens egen input for dix3-001 brukes (ikke demo): ingen demomerking, status «i bruk», og tallene følger forhandlerens input", async () => {
    const fa = { pair: "EUR/NOK", rate: "10.66", sourceLabel: "Forhandler", effectiveAt: "2026-10-14", quotedAt: "2026-10-14", validUntil: "2026-10-31" };
    const fc = { pair: "EUR/NOK", rate: "10.66", sourceLabel: "Forhandler", quotedAt: "2026-10-13", validFrom: "2026-10-13", validTo: "2026-10-31" };
    const ctx = await ctxWith({
      propulsion: { pistonCombustionEngine: false, externallyChargeable: true, combustionFuel: null, hybridization: null, basis: "type_approval" },
      taxWeight: { kg: 2260, basis: "vehicle_register" }, co2: { gramsPerKm: 0, method: "wltp_combined" }, firstRegistration: { precision: "month", value: "2024-03", basis: "vehicle_register" },
      fx: { acquisition: fa, customs: fc }, customsDate: { date: "2026-10-14", kind: "expected_scenario" }, transportToBorder: { amount: "8000" },
    });
    const i = top(await items(ctx))[0]!;
    const e = i.economics;
    expect(e.status === "scenarios" || e.status === "estimate").toBe(true);
    if (e.status === "unavailable" || e.status === "not_calculated") throw new Error("beregnet");
    expect(e.dealerInput).toEqual({ state: "in_use" });
    expect(html(i)).not.toContain("Demo-estimat");
    expect(JSON.stringify(e.notes)).not.toContain(DEMO_INPUTS_NOTE);
    // kjøpesum 36 950 × 10,66 = 393 887 (forhandlerens kurs), ikke demokursens 424 925
    const s = toAcquisitionSummary(e);
    expect(s.state === "scenarios" || s.state === "estimate" ? s.lines.find((l) => l.id === "purchase")!.amountNok : null).toBe("393887");
  });

  it("forhandlerens foreldede input erstattes ikke av demo: «må bekreftes på nytt», ingen tall", async () => {
    const i = (await items(await ctxWith("stale"))).find((x) => x.economics.status !== "unavailable" && "dealerInput" in x.economics && x.economics.dealerInput.state === "needs_reconfirmation");
    expect(i).toBeDefined();
    expect(toAcquisitionSummary(i!.economics).state).toBe("unavailable"); // ingen demo-erstatning og ingen beløp
    expect(html(i!)).not.toContain("Demo-estimat");
    expect(JSON.stringify(i!.economics)).not.toContain(DEMO_INPUTS_NOTE);
  });

  it("med forhandlerkontekst uten egen input får den kuraterte bilen fortsatt demoforutsetninger; andre annonser forblir «ikke beregnet»", async () => {
    const all = await items({ dealershipId: FIRM_A, searchId: SEARCH_1, storedInputs: new Map(), profile: null });
    expect(top(all)).toHaveLength(1);
    expect(top(all)[0]!.economics).toMatchObject({ dealerInput: { state: "demo_fixture" } });
  });

  it("generisk annonse (ikke demoen) uten forhandlerkontekst: uendret «ingen forhandlerkontekst»", async () => {
    const out = await previewForDisplay(specOf(), {
      provider: { source: "synthetic-demo", search: async () => ({ items: [listing()], nextPage: null, sourceTotal: 1, truncated: false, fetchedAt: "2026-10-20T10:00:00Z", rejected: [] }), getListing: async () => listing() },
      now: () => new Date("2026-10-20T10:00:00Z"),
    });
    if (!out.ok) throw new Error("x");
    expect(out.items[0]!.economics).toMatchObject({ status: "not_calculated", reasons: ["no_dealer_context"] });
  });

  it("PILOT-003: observasjonsalder utløper ikke den kuraterte demoen, men en utløpt avgiftsprofil feiler fortsatt lukket (ingen foreldet demoestimat)", async () => {
    const late = new Date("2026-10-30T12:00:00Z"); // observasjonen (12.10.) + 7 dager er passert — demoens egen policy (curated_public_demo_static) gjelder
    expect(top(await items(undefined, late))).toHaveLength(1);
    const expiredTax = new Date("2027-01-15T12:00:00Z"); // utenfor avgiftsprofilens dokumenterte periode (slutt 2026-12-31)
    const all = await items(undefined, expiredTax);
    expect(top(all)).toHaveLength(0);
    const i = all.find((x) => x.economics.status === "not_calculated" && x.listing.title.state === "value" && x.listing.title.value.model === "iX3");
    expect(i).toBeDefined();
    expect(text(html(i!))).not.toMatch(/Estimert total til Norge/);
  });
});

describe("sammendraget lister bare det som faktisk påvirker totalen", () => {
  it("fradragsstatus og mva.-håndtering påvirker ikke brutto utlegg og vises ikke som «mangler»; et beregnet demoestimat har ingen «mangler»-liste", async () => {
    const i = top(await items())[0]!;
    const s = toAcquisitionSummary(i.economics);
    if (s.state !== "scenarios") throw new Error("forventet scenarier");
    expect(s.missing).not.toContain("deduction");
    expect(s.missing).not.toContain("vat_handling");
    const full = renderToStaticMarkup(createElement(AcquisitionSummary, { summary: s, formHref: "/f" }));
    expect(full).not.toContain("Dette mangler for å beregne");
    expect(full).not.toContain("Fradragsstatus");
    // heller ikke i «ikke beregnet»-tilstanden (ingen input): bilens tekniske data og kurs vises, ikke fradrag/mva.-håndtering
    const none = toAcquisitionSummary((await items(undefined, NOW)).find((x) => toAcquisitionSummary(x.economics).state === "unavailable")!.economics);
    if (none.state === "unavailable") { expect(none.missing).not.toContain("deduction"); expect(none.missing).not.toContain("vat_handling"); }
  });
});

/** Forhandlerens EGEN fullstendige input for en EUR/BEV-annonse (datoer relative til NOW). */
const ownInput = () => dealerInput({
  propulsion: { pistonCombustionEngine: false, externallyChargeable: true, combustionFuel: null, hybridization: null, basis: "type_approval" },
  taxWeight: { kg: 2260, basis: "vehicle_register" }, co2: { gramsPerKm: 0, method: "wltp_combined" }, firstRegistration: { precision: "month", value: "2024-03", basis: "vehicle_register" },
  fx: {
    acquisition: { pair: "EUR/NOK", rate: "10.66", sourceLabel: "Forhandlerens bank", effectiveAt: "2026-10-14", quotedAt: "2026-10-14", validUntil: "2026-10-31" },
    customs: { pair: "EUR/NOK", rate: "10.66", sourceLabel: "Forhandlerens bank", quotedAt: "2026-10-13", validFrom: "2026-10-13", validTo: "2026-10-31" },
  },
  customsDate: { date: "2026-10-14", kind: "expected_scenario" }, transportToBorder: { amount: "8000" },
  foreignVat: { treatment: "excluded_documented", evidence: "dealer_entered" }, // forhandlerens egen påstand (samme art som demoens, men uten demomerking)
});
const withOwn = async (id: string): Promise<DisplayItem> => {
  const l = (await synth().getListing(id))!;
  const cand = candidateFor(l);
  const ctx: EconomicsContext = { dealershipId: FIRM_A, searchId: SEARCH_1, storedInputs: new Map([[storedKey(cand.id, cand.version), stored({ rights: rightsNow, spec: demoSpec(), cand, input: ownInput(), confirmedAt: NOW.toISOString() })]]), profile: null };
  const all = await items(ctx);
  const hit = all.find((i) => i.economics.status !== "unavailable" && i.economics.status !== "not_calculated" && "dealerInput" in i.economics && i.economics.dealerInput.state === "in_use");
  if (!hit) throw new Error(`ingen beregnet ${id}`);
  return hit;
};
const explainText = (i: DisplayItem) => text(renderToStaticMarkup(createElement(EconomicsNote, { economics: i.economics, dealerFormHref: "/f" })));
const DEALER_WORDING = /forhandleroppgitt|oppgitt av forhandler/i;

describe("etiketter: demoens antakelser er syntetiske, forhandlerens egne er forhandleroppgitt", () => {
  it("1. BMW iX3-demoen: forklaringen kaller antakelsene «syntetiske demoantakelser» — ingen steder «forhandleroppgitt»/«oppgitt av forhandler»", async () => {
    const i = top(await items())[0]!;
    const e = i.economics;
    if (e.status === "unavailable" || e.status === "not_calculated" || e.explanation === null) throw new Error("forventet beregnet");
    // modellen (kilden til etikettene): demonøkler, ingen forhandlernøkler
    expect(e.explanation.demoInputs).toBe(true);
    expect(e.explanation.basisSummary).toBe("demo_assumptions");
    expect(e.explanation.breakdown.some((r) => r.basis === "dealer_entered")).toBe(false);
    expect(e.explanation.breakdown.filter((r) => r.basis === "demo_assumption").map((r) => r.id)).toEqual(expect.arrayContaining(["transport_to_border", "insurance"]));
    expect(e.explanation.assumptions.fx.map((f) => f.sourceKind)).toEqual(["demo_assumption", "demo_assumption"]);
    expect(e.explanation.uncertainty.map((u) => u.code)).toContain("foreign_vat_exclusion_demo_assumed");
    expect(e.explanation.uncertainty.map((u) => u.code)).not.toContain("foreign_vat_exclusion_dealer_stated");
    // visningen
    const t = explainText(i);
    expect(t).toContain("Syntetisk demoantakelse");
    expect(t).toContain("Beløpene bygger på annonsepris og syntetiske demoantakelser.");
    expect(t).toContain("Utenlandsk mva. er en syntetisk demoantakelse.");
    expect(t).toContain("Opplysninger som er annonsepåstander eller syntetiske demoantakelser");
    expect(t).toMatch(/Kurs for kjøpesum:\s*EUR\/NOK 11\.5 — Syntetisk demokurs — ikke en markedskurs/);
    expect(t).toMatch(/Tollkurs:\s*EUR\/NOK 11\.5 — Syntetisk demokurs — ikke en markedskurs/);
    expect(t).not.toMatch(DEALER_WORDING);
    expect(t).toContain("syntetiske demoforutsetninger — ikke bekreftede forhandleropplysninger");
    // sammendraget (kort/detalj) har samme kilde
    const sum = text(renderToStaticMarkup(createElement(AcquisitionSummary, { summary: toAcquisitionSummary(i.economics), formHref: "/f" })));
    expect(sum).not.toMatch(DEALER_WORDING);
    expect(sum).toContain("Syntetisk demokurs — ikke en markedskurs");
  });

  it("tall og scenarier er uendret av etikettendringen (kun merking)", async () => {
    const i = top(await items())[0]!;
    expect(scen(i)).toEqual({ with_exemption__basis_customs_value: "484214", no_exemption: "559214" });
  });

  it("2. forhandlerens egen input (samme iX3-annonse): forklaringen sier fortsatt «forhandleroppgitt» — uten noe demoord", async () => {
    const i = await withOwn("dix3-001");
    const e = i.economics;
    if (e.status === "unavailable" || e.status === "not_calculated" || e.explanation === null) throw new Error("forventet beregnet");
    expect(e.explanation).not.toHaveProperty("demoInputs");
    expect(JSON.stringify(e)).not.toMatch(/demo_assumption|demo_economics_inputs|demo_fixture|demoInputs/);
    expect(e.explanation.breakdown.some((r) => r.basis === "dealer_entered")).toBe(true);
    expect(e.explanation.assumptions.fx.map((f) => f.sourceKind)).toEqual(["dealer_entered", "dealer_entered"]);
    const t = explainText(i);
    expect(t).toContain("Oppgitt av forhandler");
    expect(t).toContain("Forhandleroppgitt kurs — estimat");
    expect(t).toContain("Utenlandsk mva. er oppgitt av forhandler.");
    expect(t).toContain("Beløpene bygger på forhandleroppgitte opplysninger.");
    expect(t).toContain("Opplysninger som er påstander eller forhandleroppgitt");
    expect(t).not.toMatch(/demoantakelse|demokurs|Demo-estimat/i);
  });

  it("3. andre syntetiske annonser (dix3-002) med forhandlerens input arver aldri demoordlyden", async () => {
    const i = await withOwn("dix3-002");
    const e = i.economics;
    if (e.status === "unavailable" || e.status === "not_calculated" || e.explanation === null) throw new Error("forventet beregnet");
    expect(JSON.stringify(e)).not.toMatch(/demo_assumption|demo_economics_inputs|demo_fixture|demoInputs/);
    const t = explainText(i);
    expect(t).toContain("Oppgitt av forhandler");
    expect(t).toContain("Forhandleroppgitt kurs — estimat");
    expect(t).not.toMatch(/demoantakelse|demokurs|Demo-estimat/i);
    expect(html(i)).not.toContain("Demo-estimat");
  });

  it("3b. generisk syntetisk annonse og diesel med forhandlerinput: dealerordlyd, ingen demonøkler; ingen annonse uten demofixtur får demoordlyd", async () => {
    const l = listing();
    const cand = candidateFor(l);
    const map = new Map([[storedKey(cand.id, cand.version), stored({ rights: rightsForSource("synthetic-demo", new Date("2026-10-20T10:00:00Z"), REGISTERED_PROFILES), spec: specOf(), cand, input: dealerInput({}) })]]);
    const out = await previewForDisplay(specOf(), {
      provider: { source: "synthetic-demo", search: async () => ({ items: [l], nextPage: null, sourceTotal: 1, truncated: false, fetchedAt: "2026-10-20T10:00:00Z", rejected: [] }), getListing: async () => l },
      now: () => new Date("2026-10-20T10:00:00Z"), economics: { dealershipId: FIRM_A, searchId: SEARCH_1, storedInputs: map, profile: null },
    });
    if (!out.ok) throw new Error("x");
    const e = out.items[0]!.economics;
    if (e.status === "unavailable" || e.status === "not_calculated" || e.explanation === null) throw new Error("forventet beregnet");
    expect(JSON.stringify(e)).not.toMatch(/demo_assumption|demo_economics_inputs|demo_fixture|demoInputs/);
    expect(explainText(out.items[0]!)).toContain("Oppgitt av forhandler");
    // alle andre demoannonser uten fixtur: ingen demoordlyd noe sted
    for (const x of (await items()).filter((y) => top([y]).length === 0)) expect(JSON.stringify(x.economics)).not.toMatch(/demo_assumption|demo_economics_inputs|demoInputs/);
  });
});

describe("7. syntetisk/demo-merking er synlig", () => {
  it("kortet viser «Demo-estimat», demomerkingen og budsjettnotisen — kort og uten stor ansvarsfraskrivelse", async () => {
    const i = top(await items())[0]!;
    const h = html(i);
    expect(h).toContain('data-testid="acq-demo"');
    expect(text(h)).toContain("Demo-estimat");
    expect(text(h)).toMatch(/Syntetiske demodata/);
    expect(text(h)).toContain("Budsjettvurdering er ikke gjort.");
    const frag = /<div class="mt-2 border-t[^>]*data-testid="acq-summary"[\s\S]*?<\/div>/.exec(h)?.[0] ?? "";
    expect(text(frag).length).toBeLessThan(420); // kompakt
  });
  it("detaljflaten viser Demo-estimat-merke og en kort demonotis, begge kurser, og den forhandlerrettede statuslinjen sier at dette ikke er bekreftede forhandleropplysninger", async () => {
    const i = top(await items())[0]!;
    const full = renderToStaticMarkup(createElement(AcquisitionSummary, { summary: toAcquisitionSummary(i.economics), formHref: "/f" }));
    expect(full).toContain('data-testid="acq-demo"');
    expect(text(full)).toContain("Demo-estimat: bilens tekniske data, kurs og transport er syntetiske demoforutsetninger, ikke fra en leverandør.");
    expect(full).toContain('data-fx-role="acquisition"');
    expect(full).toContain('data-fx-role="customs"');
    expect(text(full)).toMatch(/Kurs for kjøpesum:\s*EUR\/NOK 11\.5 — Syntetisk demokurs — ikke en markedskurs/);
    expect(text(full)).not.toContain("Forhandleroppgitt kurs");
    const legacy = renderToStaticMarkup(createElement((await import("@/components/search/EconomicsNote")).EconomicsNote, { economics: i.economics }));
    expect(text(legacy)).toContain("syntetiske demoforutsetninger — ikke bekreftede forhandleropplysninger");
    expect(text(legacy)).not.toContain("Beregnet med bekreftede forhandleropplysninger.");
  });
});

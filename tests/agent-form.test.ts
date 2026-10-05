/** Skjematolking og validering (server-side) med grenseverdier. */
import { describe, expect, it } from "vitest";
import { activationIssues } from "@/domain/agent-validation";
import { agentToFormValues, parseAgentForm } from "@/server/agent-form";
import { agentFromRow, draftToDb } from "@/server/agent-records";
import { toFormData } from "./fixtures/agent-setups";

const NOW = new Date("2026-10-06T12:00:00Z");
const parse = (fields: Record<string, string | string[]>) => parseAgentForm(toFormData(fields), NOW);

describe("tomt betyr «alle» eller «ikke oppgitt», aldri 0", () => {
  it("bare navn gir gyldig utkast med null/tomme lister", () => {
    const { draft, errors } = parse({ name: "Utkast" });
    expect(errors).toEqual({});
    expect(draft!.filters).toMatchObject({ make: null, yearMin: null, maxMileageKm: null, fuels: [], maxPrice: null });
    expect(draft!.assumptions).toEqual({
      retail: { expectedRetailTotal: null, priceBasis: { vat: null, registrationTaxes: null } },
      minimumContribution: null,
      preparationReserve: { amount: null, vatBasis: null },
    });
    expect(draft!.broadSearchConfirmed).toBe(false);
  });

  it("reserve 0 er et uttrykkelig valg; minimum bidrag 0 avvises", () => {
    const ok = parse({ name: "x", reserveAmount: "0,00" });
    expect(ok.draft!.assumptions.preparationReserve.amount).toEqual({ amountMinor: 0, currency: "NOK" });
    expect(parse({ name: "x", minimumContribution: "0" }).errors.minimumContribution).toMatch(/større enn 0/);
    expect(parse({ name: "x", retailAmount: "0" }).errors.retailAmount).toBeDefined();
  });
});

describe("tall og beløp", () => {
  it("godtar norsk format og regner eksakt til øre", () => {
    const { draft } = parse({ name: "x", retailAmount: "1 250,50", minimumContribution: "30 000", maxPriceAmount: "35000.5", maxPriceCurrency: "EUR" });
    expect(draft!.assumptions.retail.expectedRetailTotal).toEqual({ amountMinor: 125_050, currency: "NOK" });
    expect(draft!.assumptions.minimumContribution).toEqual({ amountMinor: 3_000_000, currency: "NOK" });
    expect(draft!.filters.maxPrice).toEqual({ amountMinor: 3_500_050, currency: "EUR" });
  });

  it("avviser tre desimaler, negative tall, tekst og beløp over 2^53-1 øre", () => {
    expect(parse({ name: "x", retailAmount: "10,005" }).errors.retailAmount).toBeDefined();
    expect(parse({ name: "x", retailAmount: "-5" }).errors.retailAmount).toBeDefined();
    expect(parse({ name: "x", minimumContribution: "mye" }).errors.minimumContribution).toBeDefined();
    expect(parse({ name: "x", retailAmount: "90071992547409,91" }).errors).toEqual({});
    expect(parse({ name: "x", retailAmount: "90071992547409,92" }).errors.retailAmount).toMatch(/for stort/);
  });

  it("årsgrenser: 1900 og inneværende år + 1 godtas, utenfor avvises", () => {
    expect(parse({ name: "x", yearMin: "1900", yearMax: "2027" }).errors).toEqual({});
    expect(parse({ name: "x", yearMin: "1899" }).errors.yearMin).toBeDefined();
    expect(parse({ name: "x", yearMax: "2028" }).errors.yearMax).toBeDefined();
    expect(parse({ name: "x", yearMin: "2021", yearMax: "2020" }).errors.yearMax).toMatch(/før fra-år/);
    expect(parse({ name: "x", yearMin: "2020,5" }).errors.yearMin).toBeDefined();
  });

  it("kilometer: 1 og 2 000 000 godtas, 0 og over avvises", () => {
    expect(parse({ name: "x", maxMileageKm: "1" }).errors).toEqual({});
    expect(parse({ name: "x", maxMileageKm: "2 000 000" }).errors).toEqual({});
    expect(parse({ name: "x", maxMileageKm: "0" }).errors.maxMileageKm).toBeDefined();
    expect(parse({ name: "x", maxMileageKm: "2000001" }).errors.maxMileageKm).toBeDefined();
  });

  it("maks annonsepris krever støttet valuta og regnes aldri om", () => {
    expect(parse({ name: "x", maxPriceAmount: "100" }).errors.maxPrice).toMatch(/valuta/);
    expect(parse({ name: "x", maxPriceAmount: "100", maxPriceCurrency: "USD" }).errors.maxPrice).toBeDefined();
    expect(parse({ name: "x", maxPriceAmount: "100", maxPriceCurrency: "SEK" }).draft!.filters.maxPrice).toEqual({ amountMinor: 10_000, currency: "SEK" });
  });
});

describe("tekst, valg og manipulasjon", () => {
  it("navn 1–120 tegn; merke/modell/variant maks 60 og avhengige", () => {
    expect(parse({ name: "  " }).errors.name).toBeDefined();
    expect(parse({ name: "x".repeat(120) }).errors).toEqual({});
    expect(parse({ name: "x".repeat(121) }).errors.name).toBeDefined();
    expect(parse({ name: "x", make: "y".repeat(61) }).errors.make).toBeDefined();
    expect(parse({ name: "x", model: "Golf" }).errors.model).toMatch(/krever merke/);
    expect(parse({ name: "x", make: "VW", variant: "GTI" }).errors.variant).toMatch(/krever modell/);
  });

  it("ukjente eller dupliserte valg avvises / slås sammen, ukjent radioverdi avvises", () => {
    expect(parse({ name: "x", fuels: ["petrol", "rocket"] }).errors.fuels).toBeDefined();
    expect(parse({ name: "x", countryCodes: ["US"] }).errors.countryCodes).toBeDefined();
    expect(parse({ name: "x", bodyTypes: ["suv", "suv"] }).draft!.filters.bodyTypes).toEqual(["suv"]);
    expect(parse({ name: "x", retailVat: "maybe" }).errors.retailVat).toBeDefined();
  });

  it("ignorerer firma-ID, active, version og andre ukjente felt", () => {
    const { draft } = parse({ name: "x", dealership_id: "firma-b", active: "true", version: "99", last_success_at: "2026-01-01" });
    expect(JSON.stringify(draftToDb(draft!))).not.toMatch(/firma-b|dealership|"active"|"version"|last_success/);
  });

  it("bekreftelse av bredt søk lagres ikke når merke er satt", () => {
    expect(parse({ name: "x", make: "BMW", broadSearchConfirmed: "on" }).draft!.broadSearchConfirmed).toBe(false);
    expect(parse({ name: "x", broadSearchConfirmed: "on" }).draft!.broadSearchConfirmed).toBe(true);
  });
});

describe("lagring og gjenlesing", () => {
  it("skjema → database → agent → skjema gir samme verdier", () => {
    const fields = {
      name: "Rundtur", make: "Volvo", model: "XC60", variant: "", yearMin: "2021", yearMax: "", maxMileageKm: "80000",
      fuels: ["plugin_hybrid"], transmissions: [], bodyTypes: ["suv"], countryCodes: ["DE", "SE"],
      maxPriceAmount: "45000,50", maxPriceCurrency: "EUR", broadSearchConfirmed: "", retailAmount: "529900",
      retailVat: "included", retailRegistrationTaxes: "excluded", minimumContribution: "40000", reserveAmount: "0", reserveVatBasis: "ex_vat",
    };
    const { draft } = parse(fields);
    const row = { id: "a1", ...JSON.parse(JSON.stringify(draftToDb(draft!))), active: false, version: 1, last_success_at: null };
    const agent = agentFromRow(row);
    expect(agentToFormValues(agent)).toEqual(fields);
    expect(activationIssues({ ...draft! }, NOW)).toEqual([]);
  });

  it("agenter lagret i DEV-002 (manglende nøkler) leses som «alle»/«ikke oppgitt»", () => {
    const legacy = agentFromRow({
      id: "a", name: "Gammel", active: false, version: 1, last_success_at: null, assumptions: {},
      filters: { make: "Volkswagen", model: "Golf", yearMin: null, yearMax: null, maxMileageKm: null, fuels: [], transmissions: [], bodyTypes: [], countryCodes: [], maxPrice: null },
    });
    expect(legacy.filters.variant).toBeNull();
    expect(legacy.broadSearchConfirmed).toBe(false);
    expect(legacy.assumptions.preparationReserve).toEqual({ amount: null, vatBasis: null });
    expect(activationIssues({ name: legacy.name, filters: legacy.filters, broadSearchConfirmed: false, assumptions: legacy.assumptions }, NOW).length).toBeGreaterThan(0);
  });
});

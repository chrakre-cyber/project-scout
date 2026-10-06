/** Domenematching (DEC-027): hvert kriterium, ukjent/null, ustøttet valuta, miles, «alle». */
import { describe, expect, it } from "vitest";
import { evaluateListing } from "@/domain/matching";
import type { AgentFilters, NormalizedListing } from "@/domain/types";
import { EMPTY_QUERY } from "@/providers/marketplace/synthetic/provider";

const F = (o: Partial<AgentFilters> = {}): AgentFilters => ({ ...EMPTY_QUERY, ...o });

const base: NormalizedListing = {
  source: "synthetic-demo", sourceListingId: "x1", originalUrl: null, sourceModifiedAt: null,
  firstSeenAt: "2026-10-01T00:00:00Z", lastSeenAt: "2026-10-01T00:00:00Z",
  price: { stated: { amount: "20000", currency: "EUR" }, amount: { amountMinor: 2_000_000, currency: "EUR" }, basis: "unknown", basisEvidence: null, vat: { statedRateBasisPoints: null, reclaimableClaim: "unknown", evidence: [], origin: "none" } },
  specs: {
    make: "Volkswagen", model: "Golf", variant: "GTI Performance", firstRegistration: { precision: "date", year: 2020, month: 3, day: 1 },
    mileage: { value: 50_000, unit: "km" }, fuel: "petrol", transmission: "manual", bodyType: "hatchback",
    powerKw: null, co2: null, curbWeightKg: null, color: null,
  },
  text: null, seller: { type: "dealer", countryCode: "DE", city: null },
  provenance: { kind: "synthetic", description: "test", normalizationNotes: [] },
};
const L = (specs: Partial<NormalizedListing["specs"]> = {}, rest: Partial<NormalizedListing> = {}): NormalizedListing => ({ ...base, ...rest, specs: { ...base.specs, ...specs } });
const status = (f: AgentFilters, l = base) => evaluateListing(f, l).status;

describe("evaluateListing", () => {
  it("tomme kriterier («alle») gir treff", () => expect(status(F())).toBe("match"));
  it("kun merke", () => {
    expect(status(F({ make: "volkswagen" }))).toBe("match");
    expect(status(F({ make: "Audi" }))).toBe("excluded");
  });
  it("merke + modell", () => {
    expect(status(F({ make: "Volkswagen", model: "GOLF" }))).toBe("match");
    expect(status(F({ make: "Volkswagen", model: "Polo" }))).toBe("excluded");
  });
  it("variant er delstreng; ukjent variant → må kontrolleres", () => {
    expect(status(F({ make: "Volkswagen", model: "Golf", variant: "gti" }))).toBe("match");
    expect(status(F({ make: "Volkswagen", model: "Golf", variant: "R-Line" }))).toBe("excluded");
    expect(evaluateListing(F({ variant: "gti" }), L({ variant: null })).unknown).toEqual(["variant"]);
  });
  it("årsmodell min/maks og ukjent førsteregistrering", () => {
    expect(status(F({ yearMin: 2020 }))).toBe("match");
    expect(status(F({ yearMin: 2021 }))).toBe("excluded");
    expect(status(F({ yearMax: 2019 }))).toBe("excluded");
    expect(status(F({ yearMin: 2018, yearMax: 2020 }))).toBe("match");
    expect(status(F({ yearMin: 2018 }), L({ firstRegistration: null }))).toBe("needs_review");
  });
  it("kjørelengde, inkl. miles (eksakt) og ukjent", () => {
    expect(status(F({ maxMileageKm: 50_000 }))).toBe("match");
    expect(status(F({ maxMileageKm: 49_999 }))).toBe("excluded");
    const mi = L({ mileage: { value: 50_000, unit: "mi" } }); // 80 467,2 km
    expect(status(F({ maxMileageKm: 80_467 }), mi)).toBe("excluded");
    expect(status(F({ maxMileageKm: 80_468 }), mi)).toBe("match");
    expect(status(F({ maxMileageKm: 100 }), L({ mileage: null }))).toBe("needs_review");
  });
  it("drivstoff, girkasse, karosseri, land", () => {
    expect(status(F({ fuels: ["petrol", "diesel"] }))).toBe("match");
    expect(status(F({ fuels: ["diesel"] }))).toBe("excluded");
    expect(status(F({ transmissions: ["automatic"] }))).toBe("excluded");
    expect(status(F({ bodyTypes: ["hatchback"] }))).toBe("match");
    expect(status(F({ countryCodes: ["DE", "AT"] }))).toBe("match");
    expect(status(F({ countryCodes: ["NL"] }))).toBe("excluded");
    expect(status(F({ fuels: ["petrol"] }), L({ fuel: null }))).toBe("needs_review");
    expect(status(F({ countryCodes: ["DE"] }), { ...base, seller: null })).toBe("needs_review");
  });
  it("makspris: samme valuta sammenlignes; annen/ustøttet valuta og manglende pris er ukjent, aldri 0", () => {
    const max = { amountMinor: 2_000_000, currency: "EUR" };
    expect(status(F({ maxPrice: max }))).toBe("match");
    expect(status(F({ maxPrice: { ...max, amountMinor: 1_999_999 } }))).toBe("excluded");
    expect(status(F({ maxPrice: { amountMinor: 99_999_999, currency: "NOK" } }))).toBe("needs_review"); // ingen omregning
    expect(status(F({ maxPrice: max }), { ...base, price: base.price && { ...base.price, amount: null, stated: { amount: "20000", currency: "HUF" } } })).toBe("needs_review");
    expect(status(F({ maxPrice: max }), { ...base, price: null })).toBe("needs_review");
  });
  it("kjent avvik slår ukjent: excluded selv om annet er ukjent", () => {
    const ev = evaluateListing(F({ make: "Audi", fuels: ["petrol"] }), L({ fuel: null }));
    expect(ev.status).toBe("excluded");
    expect(ev.excludedBy).toEqual(["make"]);
    expect(ev.unknown).toEqual(["fuel"]);
  });
  it("er deterministisk og endrer ikke input", () => {
    const f = F({ make: "Volkswagen", yearMin: 2019 });
    const copy = structuredClone(base);
    expect(evaluateListing(f, base)).toEqual(evaluateListing(f, base));
    expect(base).toEqual(copy);
  });
});

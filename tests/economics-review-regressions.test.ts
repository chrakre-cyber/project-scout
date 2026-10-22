import { describe, expect, it } from "vitest";
import { calculateEconomics, UNCONFIRMED_HALF_UP, type EconomicsInput, type EconomicsConfig } from "@/domain/economics";
/** Fixture-/testforutsetning: utenlandsk mva. er dokumentert utelukket fra prisen (T88). Uten denne er tollverdiens pris en nedre grense. */
const FV = { treatment: "excluded_documented", evidence: "invoice_or_contract" } as const;

const zero = { amount: "0", basis: "quoted" } as const;
const na = { state: "not_applicable", basis: "test assumption" } as const;
const base: EconomicsInput = {
  price: { currency: "NOK", advertisedNet: "350000", priceBasis: "net", use: "advertised", evidence: "quote_document", foreignVat: FV },
  fx: {}, transportToBorder: zero, transportAfterBorder: na, loadingHandling: na, insurance: zero,
  vatHandling: { value: "registered_reports_in_vat_return", source: { kind: "dealer_profile" } },
  customsDate: { date: "2026-10-18", kind: "actual_acceptance" },
  taxInput: {
    vehicleClass: "passenger_car_m1",
    propulsion: { pistonCombustionEngine: false, externallyChargeable: true, combustionFuel: null, hybridization: null, evidence: "type_approval" },
    norwegianTaxWeight: { kg: 2185, basis: "vehicle_register" },
    co2: { gramsPerKm: null, method: "unspecified" },
    firstRegistration: { precision: "day", value: "2023-08-01" },
    norwegianRegistration: { date: "2026-10-18", kind: "actual" },
  },
  deduction: { value: "non_recoverable", source: { kind: "dealer_profile" } },
  evQualification: { batteryOnlyPropulsion: true, externallyChargeableBattery: true, passengerVehicle: true, notPreviouslyRegisteredInNorway: true }, evThresholdBasis: "customs_value",
  charges: { climateGas: na, registrationFee: na, customsDuty: na },
  asOf: "2026-10-18",
};
const ALL_TRUE = { batteryOnlyPropulsion: true, externallyChargeableBattery: true, passengerVehicle: true, notPreviouslyRegisteredInNorway: true } as const;
const EV_APPLIES = { evQualification: ALL_TRUE, evThresholdBasis: "customs_value" } as const;
const EV_NOT = { evQualification: { ...ALL_TRUE, batteryOnlyPropulsion: false }, evThresholdBasis: undefined } as const;
const EV_UNKNOWN = { evQualification: undefined, evThresholdBasis: undefined } as const;
const config: EconomicsConfig = { rounding: UNCONFIRMED_HALF_UP };
const approved: EconomicsConfig = {
  rounding: { mode: "half_up", status: "approved" },
  profile: { vatRulesApproved: true, roundingApproved: true, customsFxRuleApproved: true, deductionRuleApproved: true },
};
const diesel: EconomicsInput = {
  ...base,
  price: { ...base.price, advertisedNet: "100000" }, evQualification: undefined, evThresholdBasis: undefined,
  taxInput: {
    ...base.taxInput,
    propulsion: { pistonCombustionEngine: true, externallyChargeable: false, combustionFuel: "diesel", hybridization: "none", evidence: "type_approval" },
    norwegianTaxWeight: { kg: 1976, basis: "vehicle_register" },
    co2: { gramsPerKm: 179, method: "wltp_combined" },
    firstRegistration: { precision: "day", value: "2023-11-01" },
  },
};

describe("ECON-004 independent review regressions (original)", () => {
  it("unknown propulsion must not create a lower bound higher than an admissible BEV total", () => {
    const possible = calculateEconomics(base, config);
    expect(possible.importCashRequirement.kind).toBe("value");
    const unknown = calculateEconomics({
      ...base,
      taxInput: { ...base.taxInput, propulsion: { ...base.taxInput.propulsion, pistonCombustionEngine: null, externallyChargeable: null } },
    }, config);
    if (unknown.importCashRequirement.kind === "lower_bound" && possible.importCashRequirement.kind === "value") {
      expect(unknown.importCashRequirement.lowerBoundNok).toBeLessThanOrEqual(possible.importCashRequirement.valueNok);
    }
    expect(unknown.importVat.ev.qualification).not.toBe("not_applicable_vehicle");
  });

  it("unresolved rounding of other charges must not produce a single value total", () => {
    const r = calculateEconomics({ ...diesel, charges: { ...diesel.charges, otherKnown: [{ label: "test charge", amount: "2.5", basis: "quoted" }] } }, config);
    expect(r.status).toBe("incomplete");
    expect(r.roundingTies.length).toBeGreaterThan(0);
    expect(r.importCashRequirement.kind).not.toBe("value");
    expect(r.estimatedLandedCost.kind).not.toBe("value");
  });

  it("explicit assumed_default amounts must remain estimates even if rule flags are approved", () => {
    const r = calculateEconomics({ ...diesel, transportToBorder: { amount: "8000", basis: "assumed_default" }, insurance: { amount: "0", basis: "assumed_default" } }, approved);
    expect(r.status).not.toBe("validated");
    expect(r.estimateReasons.length).toBeGreaterThan(0);
  });

  it("a quote marked as fixture by its source must not bypass the fixture opt-in", () => {
    const q = { pair: "EUR/NOK", rate: "10.6709", source: { kind: "fixture" as const }, effectiveAt: "2026-10-18", quotedAt: "2026-10-18" };
    const r = calculateEconomics({ ...diesel, price: { ...diesel.price, currency: "EUR", advertisedNet: "10000" }, fx: { acquisition: q, customs: q } }, approved);
    expect(r.status).toBe("blocked");
    expect(r.blockers.some((b) => b.code === "invalid_fx_quote")).toBe(true);
  });
});

/**
 * Rettingsrunde etter uavhengig review (f12d44a): skjerpede forventninger med literaler. Verifisert uavhengig:
 * 350 000 + 25 % × (350 000 − 300 000) = 362 500; 100 000 + 25 000 + 333 723 = 458 723 (+ 2/3 for 2,5); full mva. 350 000 → 87 500.
 */
describe("rettingsrunde: nedre grenser, avrundingsusikkerhet, standardantakelser og fixture-proveniens", () => {
  const unknownPropulsion = (over: Partial<EconomicsInput> = {}): EconomicsInput => ({
    ...base, ...over,
    taxInput: { ...base.taxInput, propulsion: { ...base.taxInput.propulsion, pistonCombustionEngine: null, externallyChargeable: null } },
  });
  it("1. ukjent drivlinje bevarer fritaksusikkerheten: nedre grense bygger på laveste mulige mva. og er ≤ mulig BEV-total (379 248)", () => {
    const r = calculateEconomics(unknownPropulsion(), config);
    expect(r.importVat.ev.qualification).toBe("unresolved");
    expect(r.importVat.scenarios.map((s) => [s.id, s.valueNok])).toEqual([["no_exemption", 87500n], ["with_exemption__basis_customs_value", 12500n]]);
    expect(r.importCashRequirement).toMatchObject({ kind: "lower_bound", lowerBoundNok: 362500n });
    expect(r.estimatedLandedCost).toMatchObject({ kind: "lower_bound", lowerBoundNok: 362500n });
    expect(r.incompleteReasons).toContain("ev_qualification_unresolved");
    const possible = calculateEconomics(base, config).importCashRequirement;
    expect(possible).toEqual({ kind: "value", valueNok: 379248n });
    expect(362500n).toBeLessThanOrEqual(379248n);
  });
  it("1b. ukjent drivlinje og ukjent fritak (standard): samme trygge nedre grense; uttrykkelig not_applicable gir full mva. som forutsatt", () => {
    expect(calculateEconomics(unknownPropulsion({ ...EV_UNKNOWN }), config).importCashRequirement).toMatchObject({ kind: "lower_bound", lowerBoundNok: 362500n });
    expect(calculateEconomics(unknownPropulsion({ ...EV_NOT }), config).importCashRequirement).toMatchObject({ kind: "lower_bound", lowerBoundNok: 437500n });
  });
  it("2. avrundingslikhet i øvrige kostnader: totalfeltene er nedre grense (laveste kandidat), ikke value; kandidatene vises", () => {
    const r = calculateEconomics({ ...diesel, charges: { ...diesel.charges, otherKnown: [{ label: "x", amount: "2.5", basis: "quoted" }] } }, config);
    expect(r.status).toBe("incomplete");
    expect(r.roundingTies.join(" ")).toContain("3 (half_up) / 2 (half_even)");
    expect(r.importCashRequirement).toMatchObject({ kind: "lower_bound", lowerBoundNok: 458725n });
    expect(r.estimatedLandedCost).toMatchObject({ kind: "lower_bound", lowerBoundNok: 458725n });
    expect((r.importCashRequirement as { missing: string[] }).missing).toContain("rounding_tie_unresolved");
  });
  it("2b. uten likhet (2,4 → 2; 2,6 → 3) er totalen fortsatt entydig", () => {
    for (const [amt, n] of [["2.4", 458725n], ["2.6", 458726n]] as const) {
      const r = calculateEconomics({ ...diesel, charges: { ...diesel.charges, otherKnown: [{ label: "x", amount: amt, basis: "quoted" }] } }, config);
      expect(r.importCashRequirement).toEqual({ kind: "value", valueNok: n });
    }
  });
  it("3. assumed_default er estimatgrunnlag uansett kilde: transport, forsikring og øvrige poster; validated kun uten slike antakelser", () => {
    for (const over of [
      { transportToBorder: { amount: "8000", basis: "assumed_default" } },
      { insurance: { amount: "0", basis: "assumed_default" } },
      { charges: { ...diesel.charges, registrationFee: { amount: "0", basis: "assumed_default" } } },
      { charges: { ...diesel.charges, otherKnown: [{ label: "x", amount: "0", basis: "assumed_default" }] } },
    ] as Array<Partial<EconomicsInput>>) {
      const r = calculateEconomics({ ...diesel, ...over }, approved);
      expect(r.status).toBe("estimate");
      expect(r.estimateReasons).toContain("assumed_default_amount");
    }
    const clean = calculateEconomics(diesel, approved);
    expect(clean.estimateReasons).toEqual([]);
    expect(clean.status).toBe("validated"); // kontrollcase: syntetisk godkjent konfigurasjon, ingen antakelser
  });
  it("4. fixture-proveniens: source.kind = fixture uten fixtureOnly avvises uten testflagg; fixtureOnly alene avvises også; manglende source avvises", () => {
    const mk = (extra: Record<string, unknown>) => ({ pair: "EUR/NOK", rate: "10.6709", effectiveAt: "2026-10-18", quotedAt: "2026-10-18", validFrom: "2026-10-15", validTo: "2026-11-11", suspension: "not_suspended_confirmed", ...extra }) as never;
    const run = (q: unknown, cfg: EconomicsConfig) => calculateEconomics({ ...diesel, customsDate: { date: "2026-10-20", kind: "actual_acceptance" }, price: { ...diesel.price, currency: "EUR", advertisedNet: "10000" }, fx: { acquisition: q as never, customs: q as never } }, cfg);
    for (const q of [mk({ source: { kind: "fixture" } }), mk({ source: { kind: "fixture" }, fixtureOnly: false }), mk({ source: { kind: "bank" }, fixtureOnly: true })]) {
      const r = run(q, approved);
      expect(r.status).toBe("blocked");
      expect(r.blockers.every((b) => b.code === "invalid_fx_quote")).toBe(true);
      expect(run(q, { ...approved, allowFixtureFxQuotes: true }).status).not.toBe("blocked");
    }
    expect(run(mk({}), approved).status).toBe("blocked");
    expect(run(mk({ source: { kind: "bank" } }), approved).status).toBe("validated"); // kontroll: ikke-fixture-kurs med datoer
  });
});

describe("rettingsrunde: gyldighet av nedre grenser (egenskap)", () => {
  const minOf = (t: { kind: string } & Record<string, unknown>): bigint | null =>
    t.kind === "value" ? (t.valueNok as bigint) : t.kind === "scenarios" ? (t.scenarios as Array<{ valueNok: bigint }>).reduce((m, s) => (s.valueNok < m ? s.valueNok : m), (t.scenarios as Array<{ valueNok: bigint }>)[0]!.valueNok)
      : t.kind === "lower_bound" ? (t.lowerBoundNok as bigint) : null;
  const known = (over: Partial<EconomicsInput>): EconomicsInput => ({ ...base, ...over });
  const withPower = (pe: boolean | null, ec: boolean | null, fuel: "diesel" | null, hyb: "none" | null): Partial<EconomicsInput> => ({
    taxInput: { ...base.taxInput, propulsion: { ...base.taxInput.propulsion, pistonCombustionEngine: pe, externallyChargeable: ec, combustionFuel: fuel, hybridization: hyb }, co2: { gramsPerKm: pe === false ? null : 179, method: pe === false ? "unspecified" : "wltp_combined" } },
  });
  it("hver nedre grense er ≤ minste verdi blant mulige utfyllinger av det ukjente (kontant og kost)", () => {
    const unknownPower = withPower(null, null, null, null);
    const variants: Array<[string, Partial<EconomicsInput>, Array<Partial<EconomicsInput>>]> = [
      ["drivlinje × fritak", { ...unknownPower, ...EV_UNKNOWN }, [{ ...withPower(false, false, null, null), ...EV_APPLIES }, { ...withPower(false, false, null, null), ...EV_NOT }, { ...withPower(true, false, "diesel", "none"), ...EV_UNKNOWN }]],
      ["forsikring", { insurance: undefined }, [{ insurance: zero }, { insurance: { amount: "5000", basis: "quoted" } }]],
      ["transport", { transportToBorder: "unknown" }, [{ transportToBorder: zero }, { transportToBorder: { amount: "20000", basis: "quoted" } }]],
      ["øvrige avgifter", { charges: undefined }, [{ charges: { climateGas: na, registrationFee: na, customsDuty: na } }, { charges: { climateGas: { amount: "900", basis: "quoted" }, registrationFee: na, customsDuty: na } }]],
      ["transport etter innførselsstedet", { transportAfterBorder: { state: "unknown" } }, [{ transportAfterBorder: na }, { transportAfterBorder: { amount: "4000", basis: "quoted" } }]],
      ["lasting/håndtering (i tollverdien)", { loadingHandling: { state: "unknown" } }, [{ loadingHandling: na }, { loadingHandling: { amount: "1500", basis: "quoted" } }]],
      ["elbilfritak: kvalifikasjon uavklart", { ...EV_UNKNOWN }, [{ ...EV_APPLIES }, { ...EV_NOT }]],
      ["elbilfritak: målegrunnlag uavklart", { evQualification: ALL_TRUE, evThresholdBasis: "undocumented_import_type" }, [{ ...EV_APPLIES }]],
      ["fradragsstatus", { deduction: undefined }, [{ deduction: { value: "recoverable", source: { kind: "dealer_profile" } } }, { deduction: { value: "non_recoverable", source: { kind: "dealer_profile" } } }]],
    ];
    let checked = 0;
    for (const [label, unknownOver, fills] of variants) {
      const u = calculateEconomics(known(unknownOver), config);
      for (const fill of fills) {
        const f = calculateEconomics(known({ ...EV_APPLIES, ...fill }), config);
        for (const [a, b] of [[u.importCashRequirement, f.importCashRequirement], [u.estimatedLandedCost, f.estimatedLandedCost]] as const) {
          const lb = minOf(a as never), fv = minOf(b as never);
          if (a.kind === "lower_bound" && fv !== null) { checked++; expect(lb! <= fv, `${label}: ${lb} ≤ ${fv}`).toBe(true); }
        }
      }
    }
    expect(checked).toBeGreaterThanOrEqual(26); // ikke-tomhetsvern (observert antall sammenligninger med lower_bound)
  });
});

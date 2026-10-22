/**
 * ECON-006c — kontroll av referanseverdiene som nettleserforløpene (tests/e2e/econ006.e2e.mjs) bruker. Verdiene er B-Merovo-scenario / fixturekonvensjon, ikke produksjonsregler.
 * (1) avgiftene i e2e-referansen er de samme som de gyldne fixturenes (CASE-001/-002/-003); (2) kjøpesum/mva. regnet med eksakt BigInt-aritmetikk i e2e-referansen stemmer med
 * økonomikjernen for demoannonsenes priser; (3) kjøretøydataene e2e legger inn gir de gyldne fixturenes avgift.
 */
import { describe, expect, it } from "vitest";
import { calculateEconomics, UNCONFIRMED_HALF_UP, type EconomicsInput, type FxQuote } from "@/domain/economics";
import { ECON_CASES, FIXTURE_FX, MEROVO_DEFAULT_EXPECTED } from "./fixtures/econ-golden";
// @ts-expect-error — rent JS-modul (ingen typer) delt med e2e-skriptet
import { EV_EXEMPTION_NOK, FX_RATE, LISTINGS, TAX_NOK, TRANSPORT_NOK, expected, nok } from "./e2e/support/econ006-reference.mjs";

const FV = { treatment: "excluded_documented", evidence: "invoice_or_contract" } as const;
const EXCL = { state: "excluded_by_scenario", reason: "e2e" } as const;
const fxq = (rate: string): FxQuote => ({ pair: "EUR/NOK", rate, source: { kind: "fixture" }, effectiveAt: null, quotedAt: null, fixtureOnly: true, validFrom: "2026-10-15", validTo: "2026-11-30" });
const ALL_TRUE = { batteryOnlyPropulsion: true, externallyChargeableBattery: true, passengerVehicle: true, notPreviouslyRegisteredInNorway: true } as const;
const input = (caseIdx: number, priceEur: string, ev: boolean): EconomicsInput => ({
  price: { currency: "EUR", advertisedNet: priceEur, priceBasis: "net", use: "advertised", evidence: "listing_claim", foreignVat: FV },
  fx: { acquisition: fxq(FX_RATE), customs: fxq(FX_RATE) },
  transportToBorder: { amount: String(TRANSPORT_NOK), basis: "dealer_entered" }, transportAfterBorder: EXCL, loadingHandling: EXCL, insurance: { amount: "0", basis: "dealer_entered" },
  customsDate: { date: "2026-10-20", kind: "expected_scenario" }, vatHandling: { value: "registered_reports_in_vat_return", source: { kind: "dealer_entered" } },
  taxInput: ECON_CASES[caseIdx]!.golden.input, deduction: { value: "non_recoverable", source: { kind: "dealer_entered" } },
  ...(ev ? { evQualification: ALL_TRUE, evThresholdBasis: "customs_value" as const } : {}),
  charges: { climateGas: EXCL, registrationFee: EXCL, customsDuty: EXCL }, asOf: "2026-10-18",
});
const calc = (i: EconomicsInput) => calculateEconomics(i, { rounding: UNCONFIRMED_HALF_UP, allowFixtureFxQuotes: true });
const cash = (r: ReturnType<typeof calc>) => (r.importCashRequirement.kind === "value" ? r.importCashRequirement.valueNok : null);

describe("e2e-referanse (fixturekonvensjon, ikke produksjonsregel)", () => {
  it("avgiftene er de gyldne fixturenes", () => {
    expect(BigInt(TAX_NOK.diesel)).toBe(BigInt(MEROVO_DEFAULT_EXPECTED["CASE-003"].totalRegistrationTaxesNok));
    expect(BigInt(TAX_NOK.phev)).toBe(BigInt(MEROVO_DEFAULT_EXPECTED["CASE-001"].totalRegistrationTaxesNok));
    expect(BigInt(TAX_NOK.bev)).toBe(BigInt(MEROVO_DEFAULT_EXPECTED["CASE-002"].totalRegistrationTaxesNok));
    expect(FX_RATE).toBe(FIXTURE_FX.rate);
    expect(EV_EXEMPTION_NOK).toBe(ECON_CASES[1]!.vatExemptionNok);
  });
  it.each([["diesel", 2], ["phev", 0], ["diesel3", 2], ["missing", 2]] as const)("%s: kjøpesum, mva. og brutto utlegg fra eksakt BigInt-aritmetikk = kjernen", (kind, idx) => {
    const r = calc(input(idx, LISTINGS[kind].priceEur, false));
    const x = expected(kind);
    expect(r.acquisition.acquisitionUsedNok).toBe(x.purchase);
    expect(r.importVat.valueNok).toBe(x.vat);
    expect(r.tax.totalRegistrationTaxesNok).toBe(x.tax);
    expect(cash(r)).toBe(x.cash);
  });
  it("diesel2: avrundingslikhet (U-013 uavklart) ⇒ kjernen gir nedre grense = halvt-opp-verdien minus 1, ikke punktestimat", () => {
    const x = expected("diesel2");
    expect(x.vatTie).toBe(true);
    const r = calc(input(2, LISTINGS.diesel2.priceEur, false));
    expect(r.importCashRequirement.kind).toBe("lower_bound");
    if (r.importCashRequirement.kind === "lower_bound") expect(r.importCashRequirement.lowerBoundNok).toBe(x.lowerBoundCash);
    for (const k of ["diesel", "phev", "diesel3", "missing", "bev"]) expect(expected(k).vatTie, k).toBe(false);
  });
  it("BEV: to scenarier (med/uten elbilfritak) = kjernen med og uten EV-kvalifisering", () => {
    const x = expected("bev");
    const withEx = calc(input(1, LISTINGS.bev.priceEur, true));
    const without = calc(input(1, LISTINGS.bev.priceEur, false));
    expect(without.importCashRequirement.kind).toBe("scenarios");
    if (without.importCashRequirement.kind !== "scenarios") throw new Error("forventet scenarier");
    const vals = without.importCashRequirement.scenarios.map((s) => s.valueNok).sort((a, b) => (a < b ? -1 : 1));
    expect(vals).toEqual([x.cashWithExemption, x.cash]);
    expect(cash(withEx)).toBe(x.cashWithExemption);
  });
  it("tallformat i e2e: mellomrom som tusenskille og «kr»", () => {
    expect(nok(830583n)).toBe("830 583 kr");
    expect(nok(1097958n)).toBe("1 097 958 kr");
  });
});

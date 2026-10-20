/**
 * ECON-004 B1 — gyldighetsvakt: akseptdato utenfor den dokumenterte perioden (2026) ⇒ `incomplete` med tydelig årsak, uavhengig av valuta, kursfallback og eksplisitt toll.
 * Mva.-avhengige beløp er `not_calculated` (eksisterende kontrakt), aldri estimat eller nedre grense for det aktuelle året. Godkjenner ikke tollkursregimet før 3.9.2026
 * (eget restpunkt: varsel). Økonomiflaggene er false i registeret; «approved»-konfigurasjonen er en syntetisk kontroll av at vakten ikke kan omgås.
 */
import { describe, expect, it } from "vitest";
import { calculateEconomics, UNCONFIRMED_HALF_UP, type EconomicsConfig, type EconomicsInput, type FxQuote } from "@/domain/economics";
import { isWithinDocumentedPeriod } from "@/domain/economics/validity";
import { ECON_CASES } from "./fixtures/econ-golden";

const FV = { treatment: "excluded_documented", evidence: "invoice_or_contract" } as const;
const na = { state: "not_applicable", basis: "test" } as const;
const zero = { amount: "0", basis: "quoted" } as const;
const DOCUMENTED = { ...ECON_CASES[2]!.golden.input, norwegianTaxWeight: { kg: 1976, basis: "vehicle_register" as const }, firstRegistration: { precision: "day" as const, value: "2023-11-15" } };
const unconfirmed: EconomicsConfig = { rounding: UNCONFIRMED_HALF_UP };
const approved: EconomicsConfig = { rounding: { mode: "half_up", status: "approved" }, profile: { vatRulesApproved: true, roundingApproved: true, customsFxRuleApproved: true, deductionRuleApproved: true } };
const base = (date: string | null, kind: "actual_acceptance" | "expected_scenario" = "actual_acceptance", over: Partial<EconomicsInput> = {}): EconomicsInput => ({
  price: { currency: "NOK", advertisedNet: "100000", priceBasis: "net", use: "advertised", evidence: "dealer_entered", foreignVat: FV }, fx: {}, taxInput: DOCUMENTED,
  ...(date === null ? {} : { customsDate: { date, kind } }), transportToBorder: { amount: "8000", basis: "quoted" }, transportAfterBorder: na, loadingHandling: na, insurance: zero,
  deduction: { value: "non_recoverable", source: { kind: "dealer_profile" } }, vatHandling: { value: "registered_reports_in_vat_return", source: { kind: "dealer_profile" } },
  charges: { climateGas: na, registrationFee: na }, asOf: "2026-10-20", ...over,
});
const REASON = "customs_acceptance_date_outside_documented_period";
const fxq = (over: Partial<FxQuote> = {}): FxQuote => ({ pair: "EUR/NOK", rate: "10.6709", source: { kind: "bank", ref: "test" }, effectiveAt: "2026-10-15", quotedAt: "2026-10-15", ...over });
const official = (validFrom: string, validTo: string): FxQuote => ({ pair: "EUR/NOK", raw: { rate: "10,817", unit: 1 }, source: { kind: "official_customs", ref: "test" }, effectiveAt: null, quotedAt: "2026-10-19", validFrom, validTo, suspension: "not_suspended_confirmed" });
const eur = (date: string, fx: EconomicsInput["fx"], over: Partial<EconomicsInput> = {}) => base(date, "actual_acceptance", { price: { currency: "EUR", advertisedNet: "10000", priceBasis: "net", use: "advertised", evidence: "dealer_entered", foreignVat: FV }, fx, ...over });

describe("B1: årsgrensene (inklusive 2026-01-01 og 2026-12-31)", () => {
  it.each([["2025-12-31", false], ["2026-01-01", true], ["2026-06-15", true], ["2026-12-31", true], ["2027-01-01", false]] as const)("%s ⇒ innenfor perioden: %s", (d, inside) => {
    expect(isWithinDocumentedPeriod(d)).toBe(inside);
    const r = calculateEconomics(base(d), approved);
    expect(r.incompleteReasons.includes(REASON)).toBe(!inside);
    expect(r.status === "incomplete").toBe(!inside);
    expect(r.importVat.status === "not_calculated").toBe(!inside);
  });
});

describe("B1: utenfor perioden — incomplete med årsak og ikke-beregnet for berørte beløp", () => {
  it.each(["2025-12-31", "2027-01-01", "2027-02-01", "2025-06-01"])("%s: status, årsak, mva. og totaler", (d) => {
    for (const cfgs of [unconfirmed, approved]) {
      const r = calculateEconomics(base(d), cfgs);
      expect(r.status).toBe("incomplete");
      expect(r.incompleteReasons).toContain(REASON);
      expect(r.importVat).toMatchObject({ status: "not_calculated", valueNok: null, scenarios: [] });
      expect(r.importVat.reasons.join(" ")).toContain("utenfor den dokumenterte perioden 2026");
      expect(r.importVatSettlement).toMatchObject({ status: "not_calculated", rows: [] });
      expect(r.importCashRequirement).toMatchObject({ kind: "not_calculated" });
      expect(r.estimatedLandedCost).toMatchObject({ kind: "not_calculated" });
      expect(r.importVatBaseNok).toBeNull();
      expect(r.status).not.toBe("validated");
    }
  });
  it("forventet (scenario-)dato utenfor perioden behandles likt", () => {
    const r = calculateEconomics(base("2027-03-01", "expected_scenario"), approved);
    expect(r.status).toBe("incomplete");
    expect(r.importVat.status).toBe("not_calculated");
  });
  it("uavhengig av eksplisitt toll (ingen, ikke-aktuell, 0, > 0): fortsatt incomplete og ikke-beregnet; oppgitt toll vises, men gir ikke mva.-grunnlag", () => {
    for (const customsDuty of [undefined, na, zero, { amount: "1000", basis: "quoted" as const }]) {
      const r = calculateEconomics(base("2027-01-05", "actual_acceptance", { charges: { climateGas: na, registrationFee: na, ...(customsDuty ? { customsDuty } : {}) } }), approved);
      expect(r.status).toBe("incomplete");
      expect(r.importVat.status).toBe("not_calculated");
      expect(r.importVatBaseNok).toBeNull();
      expect(r.importCashRequirement.kind).toBe("not_calculated");
    }
  });
  it("uavhengig av valuta og kursgren: NOK, EUR med direkte tollkurs, EUR med anskaffelseskurs som fallback, EUR uten tollkurs", () => {
    const acq = fxq();
    const cases: Array<[string, EconomicsInput]> = [
      ["NOK", base("2027-01-05")],
      ["EUR direkte tollkurs", eur("2027-01-05", { acquisition: acq, customs: official("2026-12-30", "2027-01-12") })],
      ["EUR fallback", eur("2027-01-05", { acquisition: acq, customsFallback: "use_acquisition_rate_assumed" })],
      ["EUR uten tollkurs", eur("2027-01-05", { acquisition: acq })],
    ];
    for (const [name, i] of cases) {
      const r = calculateEconomics(i, approved);
      expect(r.incompleteReasons, name).toContain(REASON);
      expect(r.status, name).toBe("incomplete");
      expect(r.importVat.status, name).toBe("not_calculated");
      expect(r.importCashRequirement.kind, name).toBe("not_calculated");
      expect(r.estimatedLandedCost.kind, name).toBe("not_calculated");
    }
  });
  it("beregningen kan ikke omgås med godkjent profil, forhandleroppgitt fradragsstatus eller kjent mva.-håndtering", () => {
    const r = calculateEconomics(base("2027-01-05", "actual_acceptance", { deduction: { value: "recoverable", source: { kind: "dealer_entered" } } }), approved);
    expect(r.status).toBe("incomplete");
    expect(r.importCashRequirement.kind).toBe("not_calculated");
  });
  it("ukjent akseptdato er uendret (egen årsak, ikke «utenfor periode»)", () => {
    const r = calculateEconomics(base(null), unconfirmed);
    expect(r.incompleteReasons).toContain("customs_acceptance_date_unknown");
    expect(r.incompleteReasons).not.toContain(REASON);
  });
});

describe("B1: støttede 2026-tilfeller er uendret", () => {
  it("NOK 2026-10-20: tollverdi 108 000, mva. 27 000, kontant og landed som før; validated med syntetisk godkjent profil, estimat uten", () => {
    const u = calculateEconomics(base("2026-10-20"), unconfirmed);
    expect(u.status).toBe("estimate");
    expect(u.customsValueNok).toBe(108000n);
    expect(u.importVat).toMatchObject({ status: "calculated", valueNok: 27000n });
    expect(u.importCashRequirement.kind).toBe("value");
    expect(u.incompleteReasons).not.toContain(REASON);
    expect(calculateEconomics(base("2026-10-20"), approved).status).toBe("validated");
  });
  it("årsgrensene 2026-01-01 og 2026-12-31 gir samme beløp som midt i året", () => {
    const mid = calculateEconomics(base("2026-06-15"), approved);
    for (const d of ["2026-01-01", "2026-12-31"]) {
      const r = calculateEconomics(base(d), approved);
      expect(r.importVat.valueNok).toBe(mid.importVat.valueNok);
      expect(r.importCashRequirement).toEqual(mid.importCashRequirement);
      expect(r.estimatedLandedCost).toEqual(mid.estimatedLandedCost);
      expect(r.status).toBe(mid.status);
    }
  });
  it("EUR i 2026 med tollkurs: som før (ingen årsak til «utenfor periode»)", () => {
    const r = calculateEconomics(eur("2026-10-20", { acquisition: fxq(), customs: official("2026-10-15", "2026-10-28") }), unconfirmed);
    expect(r.incompleteReasons).not.toContain(REASON);
    // 10 000 EUR × 10,817 = 108 170 + 8 000 transport ⇒ mva. 29 042,5 er avrundingslikhet ⇒ nedre grense (som før B1), ikke ikke-beregnet
    expect(r.importVat.status).toBe("lower_bound");
    expect(r.importVat.valueNok).toBe(29042n);
    expect(r.importCashRequirement.kind).toBe("lower_bound");
  });
});

describe("B1: tollkursregimet før 3.9.2026 er et eget restpunkt (varsel, ingen godkjenning)", () => {
  it("2026 før 3.9: gyldig i perioden, men varsel om at regimet bare er lest i veiledning; fra 3.9 uten varsel", () => {
    const acq = fxq();
    const early = calculateEconomics(eur("2026-08-20", { acquisition: acq, customs: official("2026-08-18", "2026-08-31") }), unconfirmed);
    expect(early.incompleteReasons).not.toContain(REASON);
    expect(early.warnings.join(" ")).toContain("før 2026-09-03");
    expect(early.estimateReasons).toContain("customs_fx_rule_unconfirmed");
    const late = calculateEconomics(eur("2026-09-03", { acquisition: acq, customs: official("2026-09-01", "2026-09-14") }), unconfirmed);
    expect(late.warnings.join(" ")).not.toContain("før 2026-09-03");
    // NOK har ingen tollkurs ⇒ ingen kursvarsel
    expect(calculateEconomics(base("2026-08-20"), unconfirmed).warnings.join(" ")).not.toContain("før 2026-09-03");
  });
});

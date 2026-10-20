import { describe, expect, it } from "vitest";
import { calculateEconomics, type EconomicsInput, type EconomicsConfig } from "@/domain/economics";
import { ECON_CASES } from "./fixtures/econ-golden";

const na = { state: "not_applicable", basis: "test" } as const;
const cfg: EconomicsConfig = {
  rounding: { mode: "half_up", status: "approved" },
  profile: { vatRulesApproved: true, roundingApproved: true, customsFxRuleApproved: true, deductionRuleApproved: true },
};
function input(paidSeparatelyFromPrice: boolean | null, recov: "recoverable" | "non_recoverable" = "non_recoverable"): EconomicsInput {
  return {
    price: { currency: "NOK", advertisedNet: "100000", priceBasis: "net", use: "advertised", evidence: "quote_document", foreignVat: { treatment: "excluded_documented", evidence: "invoice_or_contract" } },
    fx: {}, taxInput: ECON_CASES[2]!.golden.input,
    customsDate: { date: "2026-10-18", kind: "actual_acceptance" }, asOf: "2026-10-20",
    transportToBorder: { amount: "8000", basis: "quoted" }, transportAfterBorder: na,
    loadingHandling: na, insurance: { amount: "0", basis: "quoted" },
    charges: { climateGas: na, registrationFee: na },
    deduction: { value: recov, source: { kind: "dealer_profile" } },
    vatHandling: { value: "registered_reports_in_vat_return", source: { kind: "dealer_profile" } },
    commission: [{ role: "purchase_commission", amount: { amount: "3000", basis: "quoted" }, paidSeparatelyFromPrice, deductionConditionsMet: true }],
  };
}
const lower = (t: ReturnType<typeof calculateEconomics>["importCashRequirement"]): bigint => {
  if (t.kind === "value") return t.valueNok;
  if (t.kind === "lower_bound") return t.lowerBoundNok;
  throw new Error("test requires value or lower_bound");
};
describe("unknown commission price inclusion must preserve safe lower bounds", () => {
  it.each(["non_recoverable", "recoverable"] as const)("does not exceed any completion: %s", (recov) => {
    const u = calculateEconomics(input(null, recov), cfg);
    const included = calculateEconomics(input(false, recov), cfg);
    const separate = calculateEconomics(input(true, recov), cfg);
    expect(u.status).toBe("incomplete");
    expect(included.importVat.valueNok).toBe(26250n);
    expect(separate.importVat.valueNok).toBe(27000n);
    expect(u.importVat.valueNok! <= included.importVat.valueNok!).toBe(true);
    for (const f of [included, separate]) {
      expect(lower(u.importCashRequirement) <= lower(f.importCashRequirement)).toBe(true);
      expect(lower(u.estimatedLandedCost) <= lower(f.estimatedLandedCost)).toBe(true);
    }
  });
});

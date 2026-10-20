/**
 * ECON-005a — uavhengige regresjonstester fra review av e1c6ad0 (kopiert uendret bortsett fra fjernede ubrukte importer/konstanter). Ingen endring av `classifyBudget`/økonomiflagg.
 * Registerprofilen er uendret (alle flagg false); «approved»-konfigurasjonen er en syntetisk kontroll av at bare `validated` kan gi positiv budsjettstatus. Literaler er håndregnet.
 */
import { describe, expect, it } from "vitest";
import { calculateEconomics, type EconomicsConfig, type EconomicsInput, type EconomicsResult } from "@/domain/economics";
import { classifyBudget } from "@/domain/search-v2/budget";
import { emptySpec } from "@/domain/search-v2/factory";
import type { CostLine, SearchSpec } from "@/domain/search-v2/types";
import { toCostAssessment, type MapperInput } from "@/domain/search-economics";
import { ECON_CASES } from "./fixtures/econ-golden";

const FV = { treatment: "excluded_documented", evidence: "invoice_or_contract" } as const;
const na = { state: "not_applicable", basis: "test" } as const;
const zero = { amount: "0", basis: "quoted" } as const;
const DOCUMENTED = { ...ECON_CASES[2]!.golden.input, norwegianTaxWeight: { kg: 1976, basis: "vehicle_register" as const }, firstRegistration: { precision: "day" as const, value: "2023-11-15" } };
const approved: EconomicsConfig = { rounding: { mode: "half_up", status: "approved" }, profile: { vatRulesApproved: true, roundingApproved: true, customsFxRuleApproved: true, deductionRuleApproved: true } };
const NOW = "2026-10-20T10:00:00Z";
const CAND = { id: "cand-1", version: "rev-1" } as const;
const OPEN = { label: "rights_profile", untilExclusive: null } as const;

/** NOK 100 000 + transport 8 000: tollverdi 108 000, mva. 27 000, brutto 468 723 (diesel, avgift 333 723). Registerprofil ⇒ estimate; godkjent syntetisk profil ⇒ validated. */
const econ = (over: Partial<EconomicsInput> = {}): EconomicsInput => ({
  price: { currency: "NOK", advertisedNet: "100000", priceBasis: "net", use: "advertised", evidence: "dealer_entered", foreignVat: FV }, fx: {}, taxInput: DOCUMENTED,
  customsDate: { date: "2026-10-20", kind: "actual_acceptance" }, transportToBorder: { amount: "8000", basis: "quoted" }, transportAfterBorder: na, loadingHandling: na, insurance: zero,
  deduction: { value: "non_recoverable", source: { kind: "dealer_profile" } }, vatHandling: { value: "registered_reports_in_vat_return", source: { kind: "dealer_profile" } },
  charges: { climateGas: na, registrationFee: na }, asOf: "2026-10-20", ...over,
});
const line = (id: string, kind: CostLine["kind"], amountMinor: bigint | null, over: Partial<CostLine> = {}): CostLine => ({ id, kind, label: `linje ${id}`, currency: "NOK", amountMinor, vatBasis: "incl", includedInBudget: true, ...over });
const specOf = (costs: CostLine[] = [], over: Partial<SearchSpec["budget"]> = {}, scenario: SearchSpec["plannedRegistration"]["requested"] = "passenger"): SearchSpec =>
  ({ ...emptySpec(), budget: { maxTotalNokMinor: 100_000_000n, deviationBasisPoints: null, costs, ...over }, plannedRegistration: { requested: scenario } });
const map = (result: EconomicsResult, spec: SearchSpec, over: Partial<MapperInput> = {}) =>
  toCostAssessment({ result, spec, candidate: CAND, now: NOW, profileRef: "NO-OTA-2026-A-PB@test+econ", rightsLimit: OPEN, sourceDataLimit: OPEN, ...over });
const run = (i: EconomicsInput, c: EconomicsConfig) => calculateEconomics(i, c);
describe("odd integer half-tie has no lower supported candidate", () => {
  it.each(["transport", "insurance"] as const)("rejects %s 1.50 NOK mapped to 1 NOK", (kind) => {
    const amount = { amount: "1", basis: "quoted" } as const;
    const result = run(econ(kind === "transport" ? { transportToBorder: amount } : { insurance: amount }), approved);
    expect(result.status).toBe("validated");
    const spec = specOf([line("t", kind, 150n)]);
    const outcome = map(result, spec, { lineScopes: { t: "to_border" } });
    // half-up(1.50)=2 and half-even(1.50)=2; 1 cannot cover this line.
    expect(outcome.lines[0]!.treatment).toBe("unsupported");
    expect(outcome.class).not.toBe("complete_validated");
    expect(classifyBudget(spec, CAND, outcome.assessment, NOW).status).toBe("not_calculated");
  });
});


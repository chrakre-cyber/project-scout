/**
 * ECON-005a retting (review e1c6ad0, P2-1/P2-2): `excl` mva. holdes uavklart, og komponentdekning krever nøyaktig støttet avrunding (ingen 99-øre-toleranse).
 * Kjernen kjøres ekte; «approved» er syntetisk og prøver bare porten. Forventede komponenter er håndregnet (nærmeste krone: <50 øre ned, >50 opp, 50 øre = tie).
 */
import { describe, expect, it } from "vitest";
import { calculateEconomics, UNCONFIRMED_HALF_UP, type EconomicsConfig, type EconomicsInput } from "@/domain/economics";
import { classifyBudget } from "@/domain/search-v2/budget";
import { emptySpec } from "@/domain/search-v2/factory";
import type { CostLine, SearchSpec } from "@/domain/search-v2/types";
import { toCostAssessment, treatCostLines, type LineScope } from "@/domain/search-economics";
import { ECON_CASES } from "./fixtures/econ-golden";

const FV = { treatment: "excluded_documented", evidence: "invoice_or_contract" } as const;
const na = { state: "not_applicable", basis: "test" } as const;
const q = (amount: string) => ({ amount, basis: "quoted" }) as const;
const DOCUMENTED = { ...ECON_CASES[2]!.golden.input, norwegianTaxWeight: { kg: 1976, basis: "vehicle_register" as const }, firstRegistration: { precision: "day" as const, value: "2023-11-15" } };
const flags = { vatRulesApproved: true, roundingApproved: true, customsFxRuleApproved: true, deductionRuleApproved: true };
const cfgs: Record<string, EconomicsConfig> = {
  unconfirmed: { rounding: UNCONFIRMED_HALF_UP },
  half_up: { rounding: { mode: "half_up", status: "approved" }, profile: flags },
  half_even: { rounding: { mode: "half_even", status: "approved" }, profile: flags },
};
const NOW = "2026-10-20T10:00:00Z";
const CAND = { id: "cand-1", version: "rev-1" } as const;
const OPEN = { label: "rights_profile", untilExclusive: null } as const;
const econ = (over: Partial<EconomicsInput> = {}): EconomicsInput => ({
  price: { currency: "NOK", advertisedNet: "100000", priceBasis: "net", use: "advertised", evidence: "dealer_entered", foreignVat: FV }, fx: {}, taxInput: DOCUMENTED,
  customsDate: { date: "2026-10-20", kind: "actual_acceptance" }, transportToBorder: q("8000"), transportAfterBorder: na, loadingHandling: na, insurance: q("0"),
  deduction: { value: "non_recoverable", source: { kind: "dealer_profile" } }, vatHandling: { value: "registered_reports_in_vat_return", source: { kind: "dealer_profile" } },
  charges: { climateGas: na, registrationFee: na }, asOf: "2026-10-20", ...over,
});
const base = econ;
const line = (id: string, kind: CostLine["kind"], amountMinor: bigint | null, over: Partial<CostLine> = {}): CostLine => ({ id, kind, label: `linje ${id}`, currency: "NOK", amountMinor, vatBasis: "incl", includedInBudget: true, ...over });
const specOf = (costs: CostLine[]): SearchSpec => ({ ...emptySpec(), budget: { maxTotalNokMinor: 100_000_000n, deviationBasisPoints: null, costs }, plannedRegistration: { requested: "passenger" } });
const map = (i: EconomicsInput, c: EconomicsConfig, s: SearchSpec, scopes: Record<string, LineScope>) =>
  toCostAssessment({ result: calculateEconomics(i, c), spec: s, candidate: CAND, now: NOW, profileRef: "NO-OTA-2026-A-PB@test+econ", rightsLimit: OPEN, sourceDataLimit: OPEN, lineScopes: scopes });

// [kroner, øre, komponent kjernen faktisk gir per policy (observert og håndkontrollert; uavklart policy viser her samme verdi som half_even på tie, mens totalen er nedre grense). Dekning aksepterer begge tie-kandidater.]
const GRID: Array<[string, bigint, Record<string, bigint>]> = [
  ["0.49", 49n, { unconfirmed: 0n, half_up: 0n, half_even: 0n }],
  ["0.50", 50n, { unconfirmed: 0n, half_up: 1n, half_even: 0n }],
  ["0.51", 51n, { unconfirmed: 1n, half_up: 1n, half_even: 1n }],
  ["0.99", 99n, { unconfirmed: 1n, half_up: 1n, half_even: 1n }],
  ["1.50", 150n, { unconfirmed: 2n, half_up: 2n, half_even: 2n }],
  ["2.50", 250n, { unconfirmed: 2n, half_up: 3n, half_even: 2n }],
  ["8000", 800_000n, { unconfirmed: 8000n, half_up: 8000n, half_even: 8000n }],
];

describe("P2-2: dekning krever støttet avrunding (ingen 99-øre-toleranse)", () => {
  for (const [name, cfg] of Object.entries(cfgs)) {
    for (const [nok, ore, expected] of GRID) {
      it(`transport til grensen ${nok} NOK under ${name}: kjernen gir ${expected[name]} og linjen er dekket; feil komponent er det ikke`, () => {
        const r = calculateEconomics(base({ transportToBorder: q(nok) }), cfg);
        expect(r.transportToBorderNok).toBe(expected[name]);
        const s = specOf([line("t", "transport", ore)]);
        expect(treatCostLines(s, r, { t: "to_border" })[0]).toMatchObject({ treatment: "mapped_to_input", counted: false });
        // samme linje mot en komponent som ikke er en støttet avrunding av beløpet
        const wrong = calculateEconomics(base({ transportToBorder: q(String(Number(ore) / 100 + 3)) }), cfg);
        expect(treatCostLines(s, wrong, { t: "to_border" })[0]).toMatchObject({ treatment: "unsupported", reason: "mapped_component_missing", counted: false });
      });
      it(`forsikring ${nok} NOK under ${name}: bekreftet dekning bare ved støttet avrunding`, () => {
        const r = calculateEconomics(base({ insurance: q(nok) }), cfg);
        expect(r.insuranceNok).toBe(expected[name]);
        const s = specOf([line("i", "insurance", ore)]);
        expect(treatCostLines(s, r, { i: "to_border" })[0]).toMatchObject({ treatment: "mapped_to_input", counted: false });
      });
    }
  }
  it("komponent som avrundes OPP i kjernen dekker ikke et lavere øre-beløp og omvendt (0,49 mot 1; 0,51 mot 0; 0,99 mot 0)", () => {
    const zero = calculateEconomics(base({ transportToBorder: q("0") }), cfgs.half_up!);
    const one = calculateEconomics(base({ transportToBorder: q("1") }), cfgs.half_up!);
    for (const ore of [51n, 99n, 100n, 150n]) expect(treatCostLines(specOf([line("t", "transport", ore)]), zero, { t: "to_border" })[0]).toMatchObject({ treatment: "unsupported", reason: "mapped_component_missing" });
    expect(treatCostLines(specOf([line("t", "transport", 49n)]), one, { t: "to_border" })[0]).toMatchObject({ treatment: "unsupported", reason: "mapped_component_missing" });
    expect(treatCostLines(specOf([line("t", "transport", 0n)]), one, { t: "to_border" })[0]).toMatchObject({ treatment: "unsupported", reason: "mapped_component_missing" });
  });
  it("komponent større enn linjens beløp er ikke eksplisitt mapping (summert/ukjent opphav) ⇒ uavklart", () => {
    const r = calculateEconomics(base({ transportToBorder: q("8000") }), cfgs.half_up!);
    expect(treatCostLines(specOf([line("t", "transport", 500_000n)]), r, { t: "to_border" })[0]).toMatchObject({ treatment: "unsupported", reason: "mapped_component_missing" });
  });
  it("ukjent komponent (null) dekker aldri, heller ikke linje på 0 øre", () => {
    const r = calculateEconomics(base({ insurance: { state: "unknown" } as never }), cfgs.half_up!);
    expect(r.insuranceNok).toBeNull();
    expect(treatCostLines(specOf([line("i", "insurance", 0n)]), r, { i: "to_border" })[0]).toMatchObject({ treatment: "unsupported", reason: "mapped_component_missing" });
  });
  it("split: begge deler må dekkes av sin egen komponent; 0,99/0,49-del kan ikke skjules i 0", () => {
    const r = calculateEconomics(base({ transportToBorder: q("8000.49"), transportAfterBorder: q("0.99") }), cfgs.half_up!);
    expect([r.transportToBorderNok, r.transportAfterBorderNok]).toEqual([8000n, 1n]);
    const s = specOf([line("t", "transport", 800_148n)]);
    expect(treatCostLines(s, r, { t: { split: { toBorderMinor: 800_049n, afterBorderMinor: 99n } } })[0]).toMatchObject({ treatment: "mapped_to_input" });
    // delene byttet om ⇒ ikke dekket
    expect(treatCostLines(s, r, { t: { split: { toBorderMinor: 99n, afterBorderMinor: 800_049n } } })[0]).toMatchObject({ treatment: "unsupported", reason: "mapped_component_missing" });
    const noAfter = calculateEconomics(base({ transportToBorder: q("8000.49"), transportAfterBorder: q("0") }), cfgs.half_up!);
    expect(treatCostLines(s, noAfter, { t: { split: { toBorderMinor: 800_049n, afterBorderMinor: 99n } } })[0]).toMatchObject({ treatment: "unsupported", reason: "mapped_component_missing" });
    expect(treatCostLines(s, r, { t: { split: { toBorderMinor: 800_049n, afterBorderMinor: 98n } } })[0]).toMatchObject({ reason: "split_sum_mismatch" });
  });
  it("end-to-end med godkjent syntetisk profil: dekket 0,99-linje er complete_validated, udekket er ikke (positivkontroll + regresjon)", () => {
    const ok = map(base({ transportToBorder: q("0.99") }), cfgs.half_up!, specOf([line("t", "transport", 99n)]), { t: "to_border" });
    expect(ok.class).toBe("complete_validated");
    expect(classifyBudget(specOf([line("t", "transport", 99n)]), CAND, ok.assessment, NOW).status).not.toBe("not_calculated");
    const bad = map(base({ transportToBorder: q("0") }), cfgs.half_up!, specOf([line("t", "transport", 99n)]), { t: "to_border" });
    expect(bad.class).toBe("incomplete");
    expect(classifyBudget(specOf([line("t", "transport", 99n)]), CAND, bad.assessment, NOW).status).toBe("not_calculated");
  });
});

describe("P2-1: vatBasis=excl er uavklart uten brutto budsjettbeløp", () => {
  const r = calculateEconomics(base(), cfgs.half_up!);
  for (const kind of ["custom", "preparation", "conversion", "approval", "travel"] as const) {
    it(`${kind} excl: unsupported, beløp bevart, ikke i total, ikke dekket`, () => {
      const s = specOf([line("x", kind, 100_000n, { vatBasis: "excl" })]);
      expect(treatCostLines(s, r)[0]).toMatchObject({ treatment: "unsupported", reason: "vat_basis_excl_gross_unknown", counted: false, amountMinor: 100_000n });
      const o = map(base(), cfgs.half_up!, s, {});
      expect(o.class).toBe("incomplete");
      expect(o.assessment?.coveredCostLineIds ?? []).not.toContain("x");
      expect(classifyBudget(s, CAND, o.assessment, NOW).status).toBe("not_calculated");
    });
  }
  it("transport og forsikring excl forblir uavklart selv med bekreftet omfang som ellers dekkes", () => {
    const st = specOf([line("t", "transport", 800_000n, { vatBasis: "excl" })]);
    expect(treatCostLines(st, r, { t: "to_border" })[0]).toMatchObject({ treatment: "unsupported", reason: "vat_basis_excl_gross_unknown", counted: false });
    const si = specOf([line("i", "insurance", 0n, { vatBasis: "excl" })]);
    expect(treatCostLines(si, r, { i: "to_border" })[0]).toMatchObject({ treatment: "unsupported", reason: "vat_basis_excl_gross_unknown" });
    expect(treatCostLines(si, r, { i: "other" })[0]).toMatchObject({ treatment: "unsupported", reason: "vat_basis_excl_gross_unknown" });
    for (const s of [st, si]) expect(classifyBudget(s, CAND, map(base(), cfgs.half_up!, s, { t: "to_border", i: "to_border" }).assessment, NOW).status).toBe("not_calculated");
  });
  it("excl-linje blir ikke avklart av en annen, dekket linje i samme spec; incl og none påvirkes ikke (positivkontroll)", () => {
    const s = specOf([line("a", "custom", 100_000n), line("b", "custom", 50_000n, { vatBasis: "none" }), line("x", "custom", 100_000n, { vatBasis: "excl" })]);
    const o = map(base(), cfgs.half_up!, s, {});
    expect(o.class).toBe("incomplete");
    const s2 = specOf([line("a", "custom", 100_000n), line("b", "custom", 50_000n, { vatBasis: "none" })]);
    const o2 = map(base(), cfgs.half_up!, s2, {});
    expect(o2.class).toBe("complete_validated");
    expect(o2.assessment?.totalMinor).toBe(46_872_300n + 150_000n);
  });
  it("excl-linje som er utelatt fra budsjettet (includedInBudget=false) blokkerer ikke", () => {
    const s = specOf([line("x", "custom", 100_000n, { vatBasis: "excl", includedInBudget: false })]);
    expect(treatCostLines(s, r)[0]).toMatchObject({ treatment: "not_included" });
    expect(map(base(), cfgs.half_up!, s, {}).class).toBe("complete_validated");
  });
});

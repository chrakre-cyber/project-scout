/**
 * ECON-004 runde 34 FIX2 (review av 33d2fb9): avrundingslikhet i provisjonsfradrag. Et avrundet fradrag virker motsatt av et tillegg: LAVESTE kandidat gir høyere tollverdi og
 * mva. og er derfor ikke en trygg nedre grense. Invariant: nedre grense for mva., brutto total og økonomisk kost overstiger aldri noen støttet policyfullføring
 * (uttrykkelig half_up eller half_even; for uavklart fradragsadgang også hvert mulig utfall av adgangen). Ingen policy er godkjent; «approved»-konfigurasjonene er syntetiske
 * sammenligninger. Literaler er håndregnet.
 */
import { describe, expect, it } from "vitest";
import { calculateEconomics, UNCONFIRMED_HALF_UP, type EconomicsConfig, type EconomicsInput, type EconomicsResult, type Total } from "@/domain/economics";
import { ECON_CASES } from "./fixtures/econ-golden";

const FV = { treatment: "excluded_documented", evidence: "invoice_or_contract" } as const;
const na = { state: "not_applicable", basis: "test" } as const;
const zero = { amount: "0", basis: "quoted" } as const;
const DOCUMENTED = { ...ECON_CASES[2]!.golden.input, norwegianTaxWeight: { kg: 1976, basis: "vehicle_register" as const }, firstRegistration: { precision: "day" as const, value: "2023-11-15" } };
const PROFILE = { vatRulesApproved: true, roundingApproved: true, customsFxRuleApproved: true, deductionRuleApproved: true } as const;
const unconfirmed: EconomicsConfig = { rounding: UNCONFIRMED_HALF_UP };
const halfUp: EconomicsConfig = { rounding: { mode: "half_up", status: "approved" }, profile: PROFILE };
const halfEven: EconomicsConfig = { rounding: { mode: "half_even", status: "approved" }, profile: PROFILE };
const money = (s: string) => ({ amount: s, basis: "quoted" as const });
const base = (price: string, commission: EconomicsInput["commission"], recov: "recoverable" | "non_recoverable" = "non_recoverable"): EconomicsInput => ({
  price: { currency: "NOK", advertisedNet: price, priceBasis: "net", use: "advertised", evidence: "dealer_entered", foreignVat: FV }, fx: {}, taxInput: DOCUMENTED,
  customsDate: { date: "2026-10-20", kind: "actual_acceptance" }, transportToBorder: { amount: "8000", basis: "quoted" }, transportAfterBorder: na, loadingHandling: na, insurance: zero,
  deduction: { value: recov, source: { kind: "dealer_profile" } }, vatHandling: { value: "registered_reports_in_vat_return", source: { kind: "dealer_profile" } },
  charges: { climateGas: na, registrationFee: na }, asOf: "2026-10-19", commission,
});
type Cm = NonNullable<EconomicsInput["commission"]>[number];
const inPrice = (amount: string, cond?: boolean | null, role: Cm["role"] = "purchase_commission"): Cm => ({ role, amount: money(amount), paidSeparatelyFromPrice: false, ...(cond === undefined ? {} : { deductionConditionsMet: cond }) });
const separate = (amount: string, role: Cm["role"]): Cm => ({ role, amount: money(amount), paidSeparatelyFromPrice: true });
const run = (i: EconomicsInput, c: EconomicsConfig) => calculateEconomics(i, c);
const lowerOf = (t: Total): bigint | null => (t.kind === "value" ? t.valueNok : t.kind === "lower_bound" ? t.lowerBoundNok : t.kind === "scenarios" ? t.scenarios.reduce((m, s) => (s.valueNok < m ? s.valueNok : m), t.scenarios[0]!.valueNok) : null);
const vatOf = (r: EconomicsResult) => r.importVat.valueNok;

describe("reviewens reproduksjon: tre innkjøpsprovisjoner à 2,5 NOK i prisen, vilkår bekreftet (kjøpesum 100 001, transport 8 000)", () => {
  const i = base("100001", [inPrice("2.5", true), inPrice("2.5", true), inPrice("2.5", true)]);
  it("støttede fullføringer: half_up fradrag 9 ⇒ tollverdi 107 992, mva. 26 998, brutto 468 722; half_even fradrag 6 ⇒ 107 995, 26 999, 468 723", () => {
    const up = run(i, halfUp);
    const even = run(i, halfEven);
    expect([up.customsValueNok, vatOf(up), lowerOf(up.importCashRequirement)]).toEqual([107992n, 26998n, 468722n]);
    expect([even.customsValueNok, vatOf(even), lowerOf(even.importCashRequirement)]).toEqual([107995n, 26999n, 468723n]);
  });
  it("uavklart policy: nedre grense for mva., brutto og økonomisk kost er den laveste fullføringen (26 998 / 468 722), ikke høyere", () => {
    const u = run(i, unconfirmed);
    expect(u.importVat.status).toBe("lower_bound");
    expect(vatOf(u)).toBe(26998n);
    expect(u.importCashRequirement).toMatchObject({ kind: "lower_bound", lowerBoundNok: 468722n });
    expect(u.estimatedLandedCost).toMatchObject({ kind: "lower_bound", lowerBoundNok: 468722n });
    expect(u.roundingTies.filter((t) => t.includes("provisjon"))).toHaveLength(3);
    expect(u.status).not.toBe("validated");
    for (const k of [run(i, halfUp), run(i, halfEven)]) {
      expect(vatOf(u)! <= vatOf(k)!).toBe(true);
      expect(lowerOf(u.importCashRequirement)! <= lowerOf(k.importCashRequirement)!).toBe(true);
      expect(lowerOf(u.estimatedLandedCost)! <= lowerOf(k.estimatedLandedCost)!).toBe(true);
    }
  });
});

describe("invariant: nedre grense ≤ enhver støttet fullføring (flere samtidige provisjoner; bekreftet og uavklart fradragsadgang; begge fradragsstatuser)", () => {
  type Spec = { name: string; price: string; items: Array<{ amount: string; kind: "confirmed" | "unresolved" | "unknown_role" | "sales_in_price" | "sales_separate" | "purchase_separate" }> };
  const SPECS: Spec[] = [
    { name: "3 × 2,5 bekreftet", price: "100001", items: [{ amount: "2.5", kind: "confirmed" }, { amount: "2.5", kind: "confirmed" }, { amount: "2.5", kind: "confirmed" }] },
    { name: "3 × 2,5 uavklart", price: "100001", items: [{ amount: "2.5", kind: "unresolved" }, { amount: "2.5", kind: "unresolved" }, { amount: "2.5", kind: "unresolved" }] },
    { name: "blandet bekreftet/uavklart/ukjent rolle", price: "100003", items: [{ amount: "0.5", kind: "confirmed" }, { amount: "1.5", kind: "unresolved" }, { amount: "2.5", kind: "unknown_role" }, { amount: "3.5", kind: "confirmed" }] },
    { name: "fradrag med likhet + separat salgs-/innkjøpsprovisjon med likhet", price: "100001", items: [{ amount: "2.5", kind: "confirmed" }, { amount: "0.5", kind: "sales_separate" }, { amount: "1.5", kind: "purchase_separate" }, { amount: "2.5", kind: "sales_in_price" }, { amount: "4.5", kind: "unresolved" }] },
    { name: "uten likhet i fradragene (kontroll)", price: "100001", items: [{ amount: "2.4", kind: "confirmed" }, { amount: "2.6", kind: "unresolved" }] },
  ];
  const build = (s: Spec, resolve?: (idx: number) => boolean): Cm[] => s.items.map((it, idx) => {
    switch (it.kind) {
      case "confirmed": return inPrice(it.amount, true);
      case "unresolved": return resolve ? inPrice(it.amount, resolve(idx)) : inPrice(it.amount);
      case "unknown_role": return resolve ? (resolve(idx) ? inPrice(it.amount, true, "purchase_commission") : inPrice(it.amount, false, "purchase_commission")) : inPrice(it.amount, undefined, "unknown");
      case "sales_in_price": return inPrice(it.amount, undefined, "sales_or_brokerage_commission");
      case "sales_separate": return separate(it.amount, "sales_or_brokerage_commission");
      case "purchase_separate": return separate(it.amount, "purchase_commission");
    }
  });
  /** Alle støttede fullføringer: hver uavklart post blir «skilt ut» eller «ikke skilt ut», under begge uttrykkelige policyer. */
  const completions = (s: Spec, recov: "recoverable" | "non_recoverable"): EconomicsResult[] => {
    const open = s.items.map((it, idx) => (it.kind === "unresolved" || it.kind === "unknown_role" ? idx : -1)).filter((x) => x >= 0);
    const out: EconomicsResult[] = [];
    for (let mask = 0; mask < 1 << open.length; mask++) {
      const resolve = (idx: number) => ((mask >> open.indexOf(idx)) & 1) === 1;
      for (const cfg of [halfUp, halfEven]) out.push(run(base(s.price, build(s, resolve), recov), cfg));
    }
    return out;
  };
  it.each(SPECS.flatMap((s) => (["non_recoverable", "recoverable"] as const).map((r) => [s.name, r, s] as const)))("%s (%s)", (_n, recov, s) => {
    const u = run(base(s.price, build(s), recov), unconfirmed);
    const ks = completions(s, recov);
    expect(u.status).not.toBe("validated");
    for (const k of ks) {
      expect(k.importVat.valueNok, "fullføring skal være entydig").not.toBeNull();
      expect(vatOf(u)! <= vatOf(k)!, `mva. ${vatOf(u)} ≤ ${vatOf(k)}`).toBe(true);
      expect(lowerOf(u.importCashRequirement)! <= lowerOf(k.importCashRequirement)!, `brutto ${lowerOf(u.importCashRequirement)} ≤ ${lowerOf(k.importCashRequirement)}`).toBe(true);
      expect(lowerOf(u.estimatedLandedCost)! <= lowerOf(k.estimatedLandedCost)!, `økonomisk kost ${lowerOf(u.estimatedLandedCost)} ≤ ${lowerOf(k.estimatedLandedCost)}`).toBe(true);
    }
  });
  it("nedre grensen er ikke bare lav: i reviewens tilfelle er den lik den laveste fullføringen (tett)", () => {
    const s = SPECS[0]!;
    const u = run(base(s.price, build(s)), unconfirmed);
    const lowest = completions(s, "non_recoverable").reduce((m, k) => (vatOf(k)! < m ? vatOf(k)! : m), 10n ** 12n);
    expect(vatOf(u)).toBe(lowest);
  });
  it("fradraget overstiger ikke kjøpesummen under laveste kandidat: ingen falsk blokkering når bare den høyeste kandidaten ville overskride", () => {
    // kjøpesum 5; fradrag 4,5 ⇒ half_up 5 / half_even 4, begge ≤ 5: lovlig. Høyeste fradrag (5) gir laveste tollverdi 0 + 8 000 transport.
    const r = run(base("5", [inPrice("4.5", true)]), unconfirmed);
    expect(r.blockers).toEqual([]);
    expect(r.customsValueNok).toBe(8000n); // 5 − 5 (høyeste fradrag) + 8 000
  });
});

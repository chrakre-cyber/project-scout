/**
 * ECON-004 FIX3 (konsolidert review av dc97f04): ukjent `paidSeparatelyFromPrice` må bevare muligheten for at provisjonen er en innkjøpsprovisjon som allerede ligger i kjøpesummen
 * og kan skilles ut av tollverdien. Nedre grenser (mva., brutto total, økonomisk kost) er den laveste støttede fullføringen: provisjonen er da allerede i prisen (ingen tilleggskostnad)
 * og skilt ut (laveste tollverdi). Invariant: nedre grense ≤ enhver støttet fullføring — alle utfall av ukjent betaling, ukjent rolle, uavklarte fradragsvilkår, flere samtidige poster,
 * begge fradragsstatuser og begge uttrykkelige avrundingspolicyer. Ingen policy er godkjent; «approved»-konfigurasjonene er syntetiske sammenligninger. Literaler er håndregnet.
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
type Cm = NonNullable<EconomicsInput["commission"]>[number];
type Role = Cm["role"];
const base = (price: string, commission: Cm[], recov: "recoverable" | "non_recoverable"): EconomicsInput => ({
  price: { currency: "NOK", advertisedNet: price, priceBasis: "net", use: "advertised", evidence: "dealer_entered", foreignVat: FV }, fx: {}, taxInput: DOCUMENTED,
  customsDate: { date: "2026-10-20", kind: "actual_acceptance" }, transportToBorder: { amount: "8000", basis: "quoted" }, transportAfterBorder: na, loadingHandling: na, insurance: zero,
  deduction: { value: recov, source: { kind: "dealer_profile" } }, vatHandling: { value: "registered_reports_in_vat_return", source: { kind: "dealer_profile" } },
  charges: { climateGas: na, registrationFee: na }, asOf: "2026-10-19", commission,
});
const item = (role: Role, paid: boolean | null, cond: boolean | null | undefined, amount: string): Cm => ({ role, amount: { amount, basis: "quoted" }, paidSeparatelyFromPrice: paid, ...(cond === undefined ? {} : { deductionConditionsMet: cond }) });
const lowerOf = (t: Total): bigint | null => (t.kind === "value" ? t.valueNok : t.kind === "lower_bound" ? t.lowerBoundNok : t.kind === "scenarios" ? t.scenarios.reduce((m, s) => (s.valueNok < m ? s.valueNok : m), t.scenarios[0]!.valueNok) : null);
const run = (i: EconomicsInput, c: EconomicsConfig) => calculateEconomics(i, c);

/** Alle støttede fullføringer av ett element: ukjent rolle ⇒ innkjøps-/salgsprovisjon; ukjent betaling ⇒ separat/i prisen; uavklart vilkår ⇒ oppfylt/ikke oppfylt. */
const completionsOf = (c: Cm): Cm[] => {
  const roles: Role[] = c.role === "unknown" ? ["purchase_commission", "sales_or_brokerage_commission"] : [c.role];
  const paids: boolean[] = c.paidSeparatelyFromPrice === null ? [true, false] : [c.paidSeparatelyFromPrice];
  const conds: Array<boolean | undefined> = c.deductionConditionsMet === undefined || c.deductionConditionsMet === null ? [true, false] : [c.deductionConditionsMet];
  return roles.flatMap((role) => paids.flatMap((paidSeparatelyFromPrice) => conds.map((deductionConditionsMet) => ({ ...c, role, paidSeparatelyFromPrice, ...(deductionConditionsMet === undefined ? {} : { deductionConditionsMet }) }))));
};
const product = <T,>(lists: T[][]): T[][] => lists.reduce<T[][]>((acc, l) => acc.flatMap((a) => l.map((x) => [...a, x])), [[]]);
/** Kontrollerer invarianten for en kombinasjon av poster; returnerer første brudd eller null. */
function violation(price: string, items: Cm[], recov: "recoverable" | "non_recoverable"): string | null {
  const u = run(base(price, items, recov), unconfirmed);
  for (const combo of product(items.map(completionsOf))) {
    for (const [name, cfg] of [["half_up", halfUp], ["half_even", halfEven]] as const) {
      const k = run(base(price, combo, recov), cfg);
      const checks: Array<[string, bigint | null, bigint | null]> = [
        ["mva.", u.importVat.valueNok, k.importVat.valueNok], ["brutto", lowerOf(u.importCashRequirement), lowerOf(k.importCashRequirement)], ["økonomisk kost", lowerOf(u.estimatedLandedCost), lowerOf(k.estimatedLandedCost)],
      ];
      for (const [what, lo, hi] of checks) if (lo === null || hi === null || lo > hi) return `${what}: nedre grense ${lo} > fullføring ${hi} (${name}) — ${JSON.stringify(combo)}`;
    }
  }
  return null;
}

describe("reviewens funn: ukjent betalingsmåte for innkjøpsprovisjon (vilkår bekreftet)", () => {
  const i = (paid: boolean | null, recov: "recoverable" | "non_recoverable" = "non_recoverable") => base("100000", [item("purchase_commission", paid, true, "3000")], recov);
  it("tall: ukjent ⇒ mva. 26 250 / brutto 467 973 / økonomisk kost 467 973 (før: 27 000 / 468 723 / 468 723); i prisen 26 250 / 467 973; separat 27 000 / 471 723", () => {
    const u = run(i(null), halfUp);
    const inPrice = run(i(false), halfUp);
    const sep = run(i(true), halfUp);
    expect([inPrice.importVat.valueNok, lowerOf(inPrice.importCashRequirement)]).toEqual([26250n, 467973n]);
    expect([sep.importVat.valueNok, lowerOf(sep.importCashRequirement)]).toEqual([27000n, 471723n]);
    expect(u.status).toBe("incomplete");
    expect(u.importVat).toMatchObject({ status: "lower_bound", valueNok: 26250n });
    expect(u.importCashRequirement).toMatchObject({ kind: "lower_bound", lowerBoundNok: 467973n });
    expect(u.estimatedLandedCost).toMatchObject({ kind: "lower_bound", lowerBoundNok: 467973n });
    expect(u.incompleteReasons).toContain("commission_price_inclusion_unknown");
  });
  it("recoverable: mva.-grensen er også riktig (26 250), økonomisk kost er uten mva.", () => {
    const u = run(i(null, "recoverable"), halfUp);
    expect(u.importVat.valueNok).toBe(26250n);
    expect(lowerOf(u.importCashRequirement)).toBe(467973n);
  });
  it("salgsprovisjon med ukjent betaling kan ikke skilles ut: grensen er uendret (27 000), ukjent beholdes", () => {
    const u = run(base("100000", [item("sales_or_brokerage_commission", null, undefined, "3000")], "non_recoverable"), halfUp);
    expect(u.importVat.valueNok).toBe(27000n);
    expect(u.importVat.status).toBe("lower_bound");
  });
  it("vilkår oppgitt ikke oppfylt: ingen mulig utskilling, grensen er 27 000; ukjent rolle med vilkår = true: utskilling fortsatt mulig (26 250)", () => {
    expect(run(base("100000", [item("purchase_commission", null, false, "3000")], "non_recoverable"), halfUp).importVat.valueNok).toBe(27000n);
    expect(run(base("100000", [item("unknown", null, true, "3000")], "non_recoverable"), halfUp).importVat.valueNok).toBe(26250n);
    expect(run(base("100000", [item("unknown", null, undefined, "3000")], "non_recoverable"), halfUp).importVat.valueNok).toBe(26250n);
  });
  it("ukjent betaling er aldri validated og dobbelttelles ikke: brutto-grensen inneholder ikke 3 000-kostnaden", () => {
    const u = run(i(null), halfUp);
    expect(u.status).not.toBe("validated");
    expect(lowerOf(u.importCashRequirement)).toBe(lowerOf(run(i(false), halfUp).importCashRequirement));
  });
  it("beløp større enn kjøpesummen blokkeres også når betalingsmåten er ukjent", () => {
    const r = run(base("5", [item("purchase_commission", null, true, "100")], "non_recoverable"), halfUp);
    expect(r.status).toBe("blocked");
    expect(r.blockers.map((b) => b.code)).toEqual(["invalid_classification"]);
  });
});

describe("invariant: nedre grense ≤ enhver støttet fullføring (mva., brutto total, økonomisk kost)", () => {
  const ROLES: Role[] = ["purchase_commission", "sales_or_brokerage_commission", "unknown"];
  const PAIDS: Array<boolean | null> = [true, false, null];
  const CONDS: Array<boolean | null | undefined> = [undefined, true, false];
  const singles = (amount: string) => ROLES.flatMap((r) => PAIDS.flatMap((p) => CONDS.map((c) => item(r, p, c, amount))));
  it.each([["3000"], ["2.5"], ["0.5"], ["3000.5"]])("ett element, alle kombinasjoner (rolle × betaling × vilkår), beløp %s, begge fradragsstatuser", (amount) => {
    for (const recov of ["non_recoverable", "recoverable"] as const) {
      for (const it1 of singles(amount)) expect(violation("100001", [it1], recov), `${JSON.stringify(it1)} ${recov}`).toBeNull();
    }
  });
  it("to samtidige elementer: alle 27 × 27 kombinasjoner (3 000 og likhetsbeløp 2,5), begge fradragsstatuser", () => {
    for (const [a, b] of [["3000", "1500"], ["2.5", "2.5"]] as const) {
      for (const recov of ["non_recoverable", "recoverable"] as const) {
        for (const x of singles(a)) for (const y of singles(b)) {
          const v = violation("100001", [x, y], recov);
          if (v) throw new Error(`${a}/${b} ${recov}: ${v}`);
        }
      }
    }
  });
  it("tre samtidige elementer med avrundingslikhet (deterministisk utvalg på 400 kombinasjoner), begge fradragsstatuser", () => {
    const pool = singles("2.5");
    let seed = 12345;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed; };
    for (let n = 0; n < 400; n++) {
      const items = [pool[rnd() % pool.length]!, pool[rnd() % pool.length]!, pool[rnd() % pool.length]!];
      for (const recov of ["non_recoverable", "recoverable"] as const) {
        const v = violation("100003", items, recov);
        if (v) throw new Error(`${recov}: ${v}`);
      }
    }
  });
});

describe("samtidige ukjente av ulike typer (provisjonsbetaling, betalingskostnadens art, utenlandsk mva.-dokumentasjon)", () => {
  it("nedre grense ≤ alle kombinasjoner av fullføringer, begge policyer og fradragsstatuser", () => {
    for (const recov of ["non_recoverable", "recoverable"] as const) {
      const mk = (paid: boolean | null, nature: "separate_payment_cost" | "included_in_goods_price" | "unknown", fvDocumented: boolean): EconomicsInput => ({
        ...base("100001", [item("purchase_commission", paid, true, "2.5")], recov),
        paymentCosts: [{ label: "g", amount: { amount: "1200.5", basis: "quoted" }, nature }],
        price: { currency: "NOK", advertisedNet: "100001", priceBasis: "net", use: "advertised", evidence: "dealer_entered", ...(fvDocumented ? { foreignVat: FV } : {}) },
      });
      const u = run(mk(null, "unknown", false), unconfirmed);
      expect(u.status).toBe("incomplete");
      for (const paid of [true, false]) for (const nature of ["separate_payment_cost", "included_in_goods_price"] as const) for (const [name, cfg] of [["half_up", halfUp], ["half_even", halfEven]] as const) {
        const k = run(mk(paid, nature, true), cfg);
        for (const [what, lo, hi] of [["mva.", u.importVat.valueNok, k.importVat.valueNok], ["brutto", lowerOf(u.importCashRequirement), lowerOf(k.importCashRequirement)], ["økonomisk kost", lowerOf(u.estimatedLandedCost), lowerOf(k.estimatedLandedCost)]] as const) {
          expect(lo !== null && hi !== null && lo <= hi, `${recov} ${paid} ${nature} ${name} ${what}: ${lo} ≤ ${hi}`).toBe(true);
        }
      }
    }
  });
});

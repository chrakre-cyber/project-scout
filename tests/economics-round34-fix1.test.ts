/**
 * ECON-004 runde 34 FIX1 (uavhengig review av afdc9f0): (P2-1) rasjonale beløp i resultatfeltene, (P2-2) provisjon som allerede inngår i prisen.
 * Ingen ny juridisk avrundingsregel: desimalbeløp avrundes med den eksisterende, uttrykkelige policyen (likhet ⇒ nedre grense). Literaler er håndregnet.
 * Økonomiflaggene i registeret er false; «approved»-konfigurasjonen brukes bare som syntetisk kontroll av valideringsporten.
 */
import { describe, expect, it } from "vitest";
import { calculateEconomics, UNCONFIRMED_HALF_UP, type EconomicsConfig, type EconomicsInput, type EconomicsResult, type Total } from "@/domain/economics";
import { ECON_CASES } from "./fixtures/econ-golden";

const FV = { treatment: "excluded_documented", evidence: "invoice_or_contract" } as const;
const na = { state: "not_applicable", basis: "test" } as const;
const zero = { amount: "0", basis: "quoted" } as const;
const DOCUMENTED = { ...ECON_CASES[2]!.golden.input, norwegianTaxWeight: { kg: 1976, basis: "vehicle_register" as const }, firstRegistration: { precision: "day" as const, value: "2023-11-15" } };
const approved: EconomicsConfig = { rounding: { mode: "half_up", status: "approved" }, profile: { vatRulesApproved: true, roundingApproved: true, customsFxRuleApproved: true, deductionRuleApproved: true } };
const unconfirmed: EconomicsConfig = { rounding: UNCONFIRMED_HALF_UP };
/** NOK 100 000 + transport 8 000: tollverdi 108 000, mva. 27 000. Med godkjent syntetisk profil er dette `validated` (kontrollcase). */
const base = (over: Partial<EconomicsInput> = {}): EconomicsInput => ({
  price: { currency: "NOK", advertisedNet: "100000", priceBasis: "net", use: "advertised", evidence: "dealer_entered", foreignVat: FV }, fx: {}, taxInput: DOCUMENTED,
  customsDate: { date: "2026-10-20", kind: "actual_acceptance" }, transportToBorder: { amount: "8000", basis: "quoted" }, transportAfterBorder: na, loadingHandling: na, insurance: zero,
  deduction: { value: "non_recoverable", source: { kind: "dealer_profile" } }, vatHandling: { value: "registered_reports_in_vat_return", source: { kind: "dealer_profile" } },
  charges: { climateGas: na, registrationFee: na }, asOf: "2026-10-19", ...over,
});
const run = (i: EconomicsInput, c: EconomicsConfig = approved) => calculateEconomics(i, c);
const money = (s: string) => ({ amount: s, basis: "quoted" as const });
const val = (t: Total) => (t.kind === "value" ? t.valueNok : undefined);
const lowerOf = (t: Total): bigint | null => (t.kind === "value" ? t.valueNok : t.kind === "lower_bound" ? t.lowerBoundNok : t.kind === "scenarios" ? t.scenarios.reduce((m, s) => (s.valueNok < m ? s.valueNok : m), t.scenarios[0]!.valueNok) : null);
/** 25 % av heltallsgrunnlaget, avrundet half-up (kun kontrollregning for utvalgte tall uten likhet i testen). */
const vat25 = (baseNok: bigint) => (baseNok * 25n * 2n + 100n) / 200n;

describe("kontrollcase: basisinputen er validated med syntetisk godkjent profil (så feilene under ikke skyldes at porten er stengt)", () => {
  it("tollverdi 108 000, mva. 27 000, validated", () => {
    const r = run(base());
    expect(r.customsValueNok).toBe(108000n);
    expect(r.importVat.valueNok).toBe(27000n);
    expect(r.status).toBe("validated");
    expect(run(base(), unconfirmed).status).toBe("estimate");
  });
});

describe("P2-1: beløpsfeltene i resultatet er hele NOK og samsvarer med grunnlaget mva. regnes av", () => {
  const sales = (amt: string) => ({ commission: [{ role: "sales_or_brokerage_commission" as const, amount: money(amt), paidSeparatelyFromPrice: true }] });
  it("salgsprovisjon 3,1 NOK: avrundet til 3 (eksisterende policy); tollverdi og grunnlag er 108 003, ikke 1 080 031", () => {
    const r = run(base(sales("3.1")));
    expect(r.commissionInCustomsValueNok).toBe(3n);
    expect(r.customsValueNok).toBe(108003n);
    expect(r.importVatBaseNok).toBe(108003n);
    expect(r.importVat.valueNok).toBe(vat25(108003n)); // 27 000,75 → 27 001
    expect(r.importVat.valueNok).toBe(27001n);
  });
  it("kostnaden og tollverdien bruker samme avrundede beløp (kontant = basis + 3 + mva.-endring), ingen dobbelttelling", () => {
    const b = run(base());
    const r = run(base(sales("3.1")));
    expect(val(r.importCashRequirement)).toBe(val(b.importCashRequirement)! + 3n + 1n);
  });
  it("eksplisitt toll 2,4: customsDuty.nok = 2 og grunnlaget 108 002 (ikke 12 / 540 012); mva. 25 % av 108 002 = 27 000,5 er likhet", () => {
    const i = base({ charges: { climateGas: na, registrationFee: na, customsDuty: money("2.4") } });
    const r = run(i, unconfirmed);
    expect(r.customsDuty).toEqual({ nok: 2n, basis: "explicit" });
    expect(r.importVatBaseNok).toBe(108002n);
    expect(r.importVat.status).toBe("lower_bound"); // avrundingslikhet i mva.: uavklart policy ⇒ nedre grense
    expect(r.roundingTies.join(" ")).toContain("import-mva");
    const a = run(i); // godkjent policy (syntetisk): half_up
    expect(a.importVat.valueNok).toBe(27001n);
    expect(a.status).toBe("validated");
  });
  it("klimagassavgift 2,4 og importLevies 2,4 i grunnlaget: begge avrundes til 2; grunnlag 108 004; kostnaden teller de samme 4 kronene", () => {
    const i = base({ charges: { climateGas: money("2.4"), climateGasVatBase: "in_base", registrationFee: na, importLevies: [{ label: "x", amount: "2.4", basis: "quoted", vatBase: "in_base" }] } });
    const r = run(i);
    expect(r.importVatBaseNok).toBe(108004n);
    expect(r.importVat.valueNok).toBe(27001n); // 27 001,0
    const b = run(base());
    expect(val(r.importCashRequirement)).toBe(val(b.importCashRequirement)! + 4n + 1n);
  });
  it("utenfor grunnlaget (outside_base) avrundes også til hele NOK i kostnaden; grunnlaget er uendret", () => {
    const r = run(base({ charges: { climateGas: money("2.4"), climateGasVatBase: "outside_base", registrationFee: na } }));
    expect(r.importVatBaseNok).toBe(108000n);
    expect(val(r.importCashRequirement)).toBe(val(run(base()).importCashRequirement)! + 2n);
  });
  it("likhet i provisjonsbeløp (3,5) følger eksisterende likhetshåndtering: nedre grense og kandidater, aldri validated", () => {
    const r = run(base(sales("3.5")), unconfirmed);
    expect(r.roundingTies.join(" ")).toMatch(/provisjon.*4 \(half_up\)/);
    expect(r.importCashRequirement.kind).toBe("lower_bound");
    expect(r.status).not.toBe("validated");
  });
  it("invariant: viste beløpsfelt er heltall som henger sammen (grunnlag − tollverdi = toll + importavgifter i grunnlaget; tollverdi − basis = provisjon)", () => {
    for (const [c, d, l] of [["3.1", "2.4", "1.2"], ["0.4", "0.4", "0.4"], ["999.9", "10.2", "7.7"]] as const) {
      const r = run(base({ ...sales(c), charges: { climateGas: na, registrationFee: na, customsDuty: money(d), importLevies: [{ label: "x", amount: l, basis: "quoted", vatBase: "in_base" }] } }));
      expect(r.customsValueNok! - 108000n, c).toBe(r.commissionInCustomsValueNok);
      expect(r.importVatBaseNok! - r.customsValueNok!, c).toBe(r.customsDuty.nok! + BigInt(Math.round(Number(l))));
    }
  });
});

describe("P2-2: provisjon som allerede inngår i prisen — uavklart grunnlag er aldri validated og høyeste beløp er aldri en «nedre grense»", () => {
  const inPrice = (role: "purchase_commission" | "sales_or_brokerage_commission" | "unknown", cond?: boolean | null, amt = "3000") => ({
    commission: [{ role, amount: money(amt), paidSeparatelyFromPrice: false, ...(cond === undefined ? {} : { deductionConditionsMet: cond }) }],
  });
  it("innkjøpsprovisjon i prisen, vilkår ikke oppgitt: uavklart ⇒ nedre grense = laveste mulige tollverdi (105 000 → 26 250), incomplete, ikke validated", () => {
    const r = run(base(inPrice("purchase_commission")));
    expect(r.status).toBe("incomplete");
    expect(r.incompleteReasons).toContain("commission_in_price_deduction_unresolved");
    expect(r.customsValueNok).toBeNull();
    expect(r.importVat.status).toBe("lower_bound");
    expect(r.importVat.valueNok).toBe(26250n); // laveste mulige; ikke 27 000
    expect(r.importCashRequirement.kind).toBe("lower_bound");
  });
  it("nedre grensen overstiger ingen mulig fullføring (vilkår oppfylt 105 000 / ikke oppfylt 108 000)", () => {
    const u = run(base(inPrice("purchase_commission")));
    for (const cond of [true, false]) {
      const k = run(base(inPrice("purchase_commission", cond)));
      for (const pick of [(x: EconomicsResult) => x.importCashRequirement, (x: EconomicsResult) => x.estimatedLandedCost] as const) {
        expect(lowerOf(pick(u))! <= lowerOf(pick(k))!, `cond=${cond}`).toBe(true);
      }
    }
  });
  it("vilkår bekreftet: innkjøpsprovisjonen skilles ut av tollverdien (105 000 → 26 250); anskaffelseskostnaden er uendret (bare mva. −750), merket som ubekreftet vilkår", () => {
    const r = run(base(inPrice("purchase_commission", true)));
    expect(r.customsValueNok).toBe(105000n);
    expect(r.importVat.valueNok).toBe(26250n);
    expect(r.acquisition.acquisitionUsedNok).toBe(100000n);
    expect(val(r.importCashRequirement)).toBe(val(run(base()).importCashRequirement)! - 750n);
    expect(r.estimateReasons).toContain("purchase_commission_deduction_unverified");
    expect(r.status).toBe("estimate");
  });
  it("vilkår ikke oppfylt: ingen utskilling, løst (108 000, validated med syntetisk profil)", () => {
    const r = run(base(inPrice("purchase_commission", false)));
    expect(r.customsValueNok).toBe(108000n);
    expect(r.status).toBe("validated");
  });
  it("ukjent rolle i prisen: uavklart (105 000 er laveste mulige); «vilkår oppfylt» er ikke nok uten kjent rolle; «vilkår ikke oppfylt» løser", () => {
    for (const cond of [undefined, null, true] as const) {
      const r = run(base(inPrice("unknown", cond)));
      expect(r.status, String(cond)).toBe("incomplete");
      expect(r.importVat.valueNok, String(cond)).toBe(26250n);
      expect(r.importVat.status, String(cond)).toBe("lower_bound");
    }
    expect(run(base(inPrice("unknown", false))).status).toBe("validated");
  });
  it("salgs-/meglerprovisjon i prisen er løst og ikke fradragsberettiget fra tollverdien (108 000)", () => {
    const r = run(base(inPrice("sales_or_brokerage_commission")));
    expect(r.customsValueNok).toBe(108000n);
    expect(r.status).toBe("validated");
  });
  it("desimalbeløp som skilles ut avrundes (3 000,4 → 3 000); beløp større enn prisen blokkeres", () => {
    expect(run(base(inPrice("purchase_commission", true, "3000.4"))).customsValueNok).toBe(105000n);
    const big = run(base(inPrice("purchase_commission", true, "100001")));
    expect(big.status).toBe("blocked");
    expect(big.blockers.map((b) => b.code)).toEqual(["invalid_classification"]);
    expect(run(base(inPrice("purchase_commission", "ja" as never))).blockers.map((b) => b.code)).toEqual(["invalid_classification"]);
  });
});

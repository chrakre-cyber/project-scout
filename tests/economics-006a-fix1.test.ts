/**
 * ECON-006a-FIX1 (review av f39bac8, tre P2): (1) øre i søkekostnader vises eksakt, (2) kjente kostnadsposter bevares i nedbrytningen uavhengig av totalens art,
 * (3) faktisk grunnlag og antakelsestilstand per rad og samsvar med dokumentasjonstelleren. Tallene er testinput (fixturekonvensjon), ikke produksjonsregler.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EconomicsNote } from "@/components/search/EconomicsNote";
import { calculateEconomics, UNCONFIRMED_HALF_UP, type EconomicsConfig, type EconomicsInput } from "@/domain/economics";
import { explainEconomics, toEconomicsDisplayStatus, toEconomicsView, type Explanation, type MappingOutcome } from "@/domain/search-economics";
import { formatNokExact } from "@/lib/search-labels";
import { ECON_CASES } from "./fixtures/econ-golden";

const EXCL = { state: "excluded_by_scenario", reason: "test" } as const;
const NA = { state: "not_applicable", basis: "test" } as const;
const FV = { treatment: "excluded_documented", evidence: "invoice_or_contract" } as const;
const input = (over: Partial<EconomicsInput> = {}): EconomicsInput => ({
  fx: {},
  price: { currency: "NOK", advertisedNet: "100000", priceBasis: "net", use: "advertised", evidence: "dealer_entered", foreignVat: FV },
  transportToBorder: { amount: "8000", basis: "dealer_entered" }, transportAfterBorder: EXCL, insurance: { amount: "0", basis: "dealer_entered" }, loadingHandling: EXCL,
  customsDate: { date: "2026-10-20", kind: "actual_acceptance" }, taxInput: ECON_CASES[2]!.golden.input,
  deduction: { value: "non_recoverable", source: { kind: "dealer_entered" } }, vatHandling: { value: "registered_reports_in_vat_return", source: { kind: "dealer_entered" } },
  charges: { climateGas: EXCL, registrationFee: EXCL, customsDuty: EXCL }, asOf: "2026-10-20", ...over,
});
const cfg: EconomicsConfig = { rounding: UNCONFIRMED_HALF_UP };
const calc = (over: Partial<EconomicsInput> = {}) => calculateEconomics(input(over), cfg);
const explain = (over: Partial<EconomicsInput> = {}): Explanation => explainEconomics({ result: calc(over), outcome: null, notes: [] });
/** eksakt sum av desimalstrenger i øre-/tusendels-skala uten flyttall */
const sumExact = (xs: string[]): string => {
  const scale = 3, u = 10n ** BigInt(scale);
  const t = xs.reduce((a, x) => { const [i = "0", f = ""] = x.split("."); return a + BigInt(i) * u + BigInt(f.padEnd(scale, "0")); }, 0n);
  const w = t / u, f = (t % u).toString().padStart(scale, "0").replace(/0+$/, "");
  return f ? `${w}.${f}` : `${w}`;
};
const grossRows = (e: Explanation) => e.breakdown.filter((r) => r.inGrossOutlay && r.amountNok !== null);

describe("P2-1: eksakt visning av øre uten flyttall og uten ny avrunding", () => {
  it.each([["0.01", "0,01 kr"], ["0.50", "0,50 kr"], ["1.50", "1,50 kr"], ["1000.99", "1 000,99 kr"], ["1000", "1 000 kr"], ["0", "0 kr"], ["1234567.5", "1 234 567,50 kr"], ["-0.5", "-0,50 kr"], ["0.125", "0,125 kr"]])("%s ⇒ %s", (i, o) => {
    expect(formatNokExact(i)).toBe(o);
  });
  it.each(["", "abc", "1,50", "1.", ".5", "1e3", "NaN", "1 000"])("ugyldig streng «%s» ⇒ ukjent beløp (ikke 0)", (i) => {
    expect(formatNokExact(i)).toBe("ukjent beløp");
  });
  const view = (amountMinor: bigint | null) => {
    const outcome: MappingOutcome = { class: "incomplete", assessment: null, lines: [{ id: "c", kind: "custom", label: "Valgt tillegg", amountMinor, treatment: amountMinor === null ? "unknown_amount" : "added_to_total", counted: amountMinor !== null, reason: null }], reasons: [], validUntil: null, bindingLimit: null };
    const result = calc();
    return toEconomicsView(toEconomicsDisplayStatus({ result, outcome, rights: { canDerive: true, canDisplay: true } }), { state: "in_use" }, [], { result, outcome });
  };
  const lines = (amountMinor: bigint | null) => renderToStaticMarkup(createElement(EconomicsNote, { economics: view(amountMinor) })).split('data-testid="economics-lines"')[1]!.split("</section>")[0]!;
  it.each([[1n, "0,01 kr"], [50n, "0,50 kr"], [150n, "1,50 kr"], [100_099n, "1 000,99 kr"], [100_000n, "1 000 kr"]])("søkelinje på %s øre vises som %s", (m, t) => {
    const h = lines(m);
    expect(h).toContain(t);
    expect(h).not.toContain("ukjent beløp");
  });
  it("søkelinje med ukjent beløp vises uten beløp (ikke som 0)", () => {
    const h = lines(null);
    expect(h).not.toMatch(/0,00|\b0 kr/);
  });
  it("modellen bærer øre eksakt som streng, uten bigint", () => {
    const m = view(150n);
    if (m.status === "unavailable" || m.explanation === null) throw new Error("forventet forklaring");
    expect(m.explanation.searchCosts.rows[0]!.amountNok).toBe("1.50");
    expect(m.explanation.searchCosts.countedNok).toBe("1.50");
  });
});

describe("P2-2: kjente kostnadsposter bevares uavhengig av totalens art", () => {
  const fee = { climateGas: EXCL, registrationFee: { amount: "1000", basis: "dealer_entered" as const }, customsDuty: EXCL };
  it("ukjent transport (nedre grense): registreringsgebyret finnes som egen rad; transporten er ukjent (null)", () => {
    const r = calc({ transportToBorder: undefined, charges: fee });
    expect(r.importCashRequirement.kind).toBe("lower_bound");
    const e = explainEconomics({ result: r, outcome: null, notes: [] });
    expect(e.breakdown.find((x) => x.id === "registration_fee")).toMatchObject({ amountNok: "1000", state: "known", basis: "dealer_entered", inGrossOutlay: true });
    expect(e.breakdown.find((x) => x.id === "transport_to_border")).toMatchObject({ state: "unknown", amountNok: null });
    if (r.importCashRequirement.kind === "lower_bound") {
      // nedre grensen = summen av de kjente radene i brutto utlegg (mva.-raden bærer nedre grense) — ingen post mangler og ingen er dobbelttalt
      expect(sumExact(grossRows(e).map((x) => x.amountNok!))).toBe(r.importCashRequirement.lowerBoundNok.toString());
    }
  });
  it("ukjent fradrag (scenarier): gebyr og øvrige poster bevares; mva. er ukjent i raden (ett scenario trekkes ikke fra et annet)", () => {
    const r = calc({ deduction: undefined, charges: fee });
    expect(r.importCashRequirement.kind === "value" || r.importCashRequirement.kind === "scenarios").toBe(true);
    const e = explainEconomics({ result: r, outcome: null, notes: [] });
    expect(e.breakdown.find((x) => x.id === "registration_fee")?.amountNok).toBe("1000");
    expect(e.breakdown.filter((x) => x.id === "other_rounding")).toEqual([]);
    expect(e.breakdown.some((x) => x.amountNok === "-1000")).toBe(false);
  });
  it("hver støttet tilleggskomponent får egen rad, og summen av rader = brutto utlegg (ingen dobbelttelling)", () => {
    const r = calc({
      charges: {
        climateGas: { amount: "3000", basis: "quoted" }, climateGasVatBase: "in_base", registrationFee: { amount: "1000", basis: "dealer_entered" }, customsDuty: { amount: "2000", basis: "quoted" },
        importLevies: [{ label: "Importavgift X", amount: "400", basis: "dealer_entered", vatBase: "outside_base" }], otherKnown: [{ label: "Fraktforsikring Y", amount: "250", basis: "dealer_entered" }],
      },
      commission: [{ role: "sales_or_brokerage_commission", paidSeparatelyFromPrice: true, amount: { amount: "700", basis: "quoted" } }],
      paymentCosts: [{ label: "Bank", amount: { amount: "90", basis: "dealer_entered" }, nature: "separate_payment_cost" }, { label: "I prisen", amount: { amount: "999", basis: "dealer_entered" }, nature: "included_in_goods_price" }],
    });
    const e = explainEconomics({ result: r, outcome: null, notes: [] });
    const ids = e.breakdown.filter((x) => x.inGrossOutlay).map((x) => x.id);
    for (const id of ["climate_gas", "registration_fee", "customs_duty", "import_levy", "other_known", "commission_separate", "payment_cost"]) expect(ids.filter((x) => x === id)).toHaveLength(1);
    // tollavgiften er en kostnad i utlegget og står ikke i tillegg som memo
    expect(e.breakdown.filter((x) => x.id === "customs_duty")).toHaveLength(1);
    expect(e.breakdown.find((x) => x.id === "customs_duty")).toMatchObject({ inGrossOutlay: true, amountNok: "2000", basis: "document" });
    // betalingskostnad som allerede er i prisen telles ikke
    expect(e.breakdown.some((x) => x.amountNok === "999")).toBe(false);
    expect(e.breakdown.find((x) => x.id === "import_levy")?.label).toBe("Importavgift X");
    if (r.importCashRequirement.kind === "value") expect(sumExact(grossRows(e).map((x) => x.amountNok!))).toBe(r.importCashRequirement.valueNok.toString());
    else throw new Error(`forventet verdi, fikk ${r.importCashRequirement.kind} ${JSON.stringify(r.incompleteReasons)} ${JSON.stringify(r.blockers)} ${JSON.stringify((r.importCashRequirement as {missing?: string[]}).missing)}`);
  });
  it("tollavgift 0 etter ordinær sats forblir et beregningsgrunnlag (memo), ikke en kostnadsrad", () => {
    const e = explain({ charges: { climateGas: EXCL, registrationFee: EXCL } });
    expect(e.breakdown.find((x) => x.id === "customs_duty")).toMatchObject({ inGrossOutlay: false, basis: "ordinary_rate_unapproved" });
  });
  it("øre i øvrige poster: kjernen avrunder summen én gang; differansen vises som egen rad og summen går opp", () => {
    const r = calc({ charges: { climateGas: EXCL, customsDuty: EXCL, registrationFee: { amount: "1000.40", basis: "dealer_entered" }, otherKnown: [{ label: "Gebyr", amount: "0.40", basis: "dealer_entered" }] } });
    const e = explainEconomics({ result: r, outcome: null, notes: [] });
    expect(e.breakdown.find((x) => x.id === "registration_fee")?.amountNok).toBe("1000.4");
    expect(e.breakdown.find((x) => x.id === "other_rounding")).toMatchObject({ amountNok: "0.2", state: "known", basis: "computed" });
    if (r.importCashRequirement.kind === "value") expect(sumExact(grossRows(e).map((x) => x.amountNok!))).toBe(r.importCashRequirement.valueNok.toString());
    else throw new Error("forventet verdi");
  });
  it("ukjent post rekonstrueres ikke: ukjent gebyr er en ukjent rad (null) uten differanse, og transport/forsikring forblir ukjente", () => {
    const e = explain({ transportToBorder: undefined, insurance: undefined, charges: { climateGas: EXCL, customsDuty: EXCL, registrationFee: { state: "unknown" } } });
    expect(e.breakdown.find((x) => x.id === "registration_fee")).toMatchObject({ state: "unknown", amountNok: null });
    expect(e.breakdown.some((x) => x.id === "other_rounding")).toBe(false);
    for (const id of ["transport_to_border", "insurance"]) expect(e.breakdown.find((x) => x.id === id)).toMatchObject({ state: "unknown", amountNok: null });
  });
});

describe("P2-3: faktisk grunnlag og antakelsestilstand per rad; teller i samsvar", () => {
  const rowsOf = (over: Partial<EconomicsInput>) => { const e = explain(over); return { e, r: (id: string) => e.breakdown.find((x) => x.id === id)! }; };
  it.each([
    ["dealer_entered", "known", "dealer_entered"], ["quoted", "known", "document"], ["assumed_default", "assumed", "assumed"], ["scenario_assumption", "assumed", "assumed"],
  ] as const)("forsikring, transport etter grensen og lasting med basis %s ⇒ %s / %s", (basis, state, rb) => {
    const { r } = rowsOf({ insurance: { amount: "500", basis }, transportAfterBorder: { amount: "600", basis }, loadingHandling: { amount: "700", basis } });
    for (const [id, n] of [["insurance", "500"], ["transport_after_border", "600"], ["loading_handling", "700"]] as const) expect(r(id)).toMatchObject({ state, basis: rb, amountNok: n });
  });
  it("eksplisitt scenarioekskludering og ikke relevant skilles fra kjente beløp", () => {
    const { r } = rowsOf({ transportAfterBorder: EXCL, loadingHandling: NA });
    expect(r("transport_after_border")).toMatchObject({ state: "excluded_by_scenario", amountNok: "0", basis: "assumed" });
    expect(r("loading_handling")).toMatchObject({ state: "not_applicable", amountNok: "0" });
  });
  it("ukjent forsikring/lasting/transport etter grensen ⇒ ukjent, null", () => {
    const { r } = rowsOf({ insurance: undefined, loadingHandling: { state: "unknown" }, transportAfterBorder: undefined });
    for (const id of ["insurance", "loading_handling", "transport_after_border"]) expect(r(id)).toMatchObject({ state: "unknown", amountNok: null, basis: "unresolved" });
  });
  it("teller i samsvar med radene: antatte, utelatte og ikke-relevante poster er ikke «kjente kostnadsposter»; bare dokumentbaserte kjente teller som dokumentert", () => {
    const { e } = rowsOf({
      insurance: { amount: "500", basis: "assumed_default" }, transportAfterBorder: { amount: "600", basis: "quoted" }, loadingHandling: NA,
      charges: { climateGas: EXCL, customsDuty: EXCL, registrationFee: { amount: "1000", basis: "quoted" } },
    });
    const COST = new Set(["purchase", "transport_to_border", "transport_after_border", "insurance", "loading_handling", "climate_gas", "registration_fee", "import_levy", "other_known", "commission_separate", "payment_cost", "customs_duty"]);
    const known = e.breakdown.filter((x) => COST.has(x.id) && x.state === "known");
    expect(e.coverage.knownCostItems).toBe(known.length);
    expect(e.coverage.documented).toBe(known.filter((x) => x.basis === "document").length);
    expect(e.coverage.documented).toBe(2); // transport etter grensen + registreringsgebyr
    expect(e.breakdown.find((x) => x.id === "insurance")?.state).toBe("assumed");
    expect(e.basisSummary).toBe("partly_documented");
  });
  it("kun antatte beløp teller ikke som dokumentert eller som kjent kostnadspost", () => {
    const { e } = rowsOf({ insurance: { amount: "500", basis: "assumed_default" }, transportToBorder: { amount: "8000", basis: "assumed_default" } });
    expect(e.coverage.documented).toBe(0);
    expect(e.breakdown.filter((x) => x.state === "known" && ["insurance", "transport_to_border"].includes(x.id))).toEqual([]);
  });
});

describe("kjernen er uendret i verdi: metadata endrer ingen total", () => {
  it("totaler, status og årsaker er identiske med og uten ekstrapostene (kjent verdi)", () => {
    const r = calc({ charges: { climateGas: EXCL, customsDuty: EXCL, registrationFee: { amount: "1000", basis: "quoted" } } });
    const base = calc();
    expect(r.importCashRequirement.kind === "value" && base.importCashRequirement.kind === "value" ? r.importCashRequirement.valueNok - base.importCashRequirement.valueNok : null).toBe(1000n);
    expect(r.costMeta.othersNok).toBe(1000n);
  });
});

describe("FIX2 (re-review av 853c1d8): scenarioekskludering, ikke relevant, ukjent og oppgitt 0 holdes adskilt for klimagassavgift og registreringsgebyr", () => {
  const COST = new Set(["purchase", "transport_to_border", "transport_after_border", "insurance", "loading_handling", "climate_gas", "registration_fee", "import_levy", "other_known", "commission_separate", "payment_cost", "customs_duty"]);
  const cases = [
    ["excluded_by_scenario", EXCL, { state: "excluded_by_scenario", amountNok: "0", basis: "assumed" }],
    ["not_applicable", NA, { state: "not_applicable", amountNok: "0", basis: "stated_input" }],
    ["unknown", { state: "unknown" } as const, { state: "unknown", amountNok: null, basis: "unresolved" }],
    ["oppgitt beløp 0", { amount: "0", basis: "dealer_entered" } as const, { state: "known", amountNok: "0", basis: "dealer_entered" }],
    ["dokumentert beløp 0", { amount: "0", basis: "quoted" } as const, { state: "known", amountNok: "0", basis: "document" }],
  ] as const;
  for (const id of ["climate_gas", "registration_fee"] as const) {
    for (const [name, charge, expected] of cases) {
      it(`${id} ${name}: rad og teller`, () => {
        const charges = id === "climate_gas" ? { climateGas: charge, registrationFee: EXCL, customsDuty: EXCL } : { climateGas: EXCL, registrationFee: charge, customsDuty: EXCL };
        const r = calc({ charges });
        const e = explainEconomics({ result: r, outcome: null, notes: [] });
        const rows = e.breakdown.filter((x) => x.id === id);
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ ...expected, inGrossOutlay: true });
        // telleren: bare faktisk oppgitte/beregnede poster er «kjente kostnadsposter»; ekskludert/ikke relevant/ukjent er det ikke
        const known = e.breakdown.filter((x) => COST.has(x.id) && x.state === "known");
        expect(e.coverage.knownCostItems).toBe(known.length);
        expect(known.some((x) => x.id === id)).toBe(expected.state === "known");
        expect(e.coverage.documented).toBe(known.filter((x) => x.basis === "document").length);
        // beregningsbeløp er uendret av metadataene: 0 for alle fire (ukjent gir nedre grense)
        const base = calc();
        if (expected.state !== "unknown" && r.importCashRequirement.kind === "value" && base.importCashRequirement.kind === "value") expect(r.importCashRequirement.valueNok).toBe(base.importCashRequirement.valueNok);
      });
    }
  }
  it("standardoppsettet (begge scenarioekskludert) har ingen kjente tilleggsposter og teller dem ikke", () => {
    const e = explain();
    for (const id of ["climate_gas", "registration_fee"]) expect(e.breakdown.find((x) => x.id === id)).toMatchObject({ state: "excluded_by_scenario", basis: "assumed" });
    expect(e.breakdown.filter((x) => x.state === "known" && x.basis === "stated_input" && x.amountNok === "0")).toEqual([]);
    expect(e.coverage.knownCostItems).toBe(e.breakdown.filter((x) => COST.has(x.id) && x.state === "known").length);
  });
  it("tollavgift: scenarioekskludert vises som utelatt etter scenario (memo), ikke som oppgitt; ikke relevant forblir ikke relevant", () => {
    const ex = explain().breakdown.find((x) => x.id === "customs_duty");
    expect(ex).toMatchObject({ state: "excluded_by_scenario", basis: "assumed", inGrossOutlay: false });
    const na = explain({ charges: { climateGas: EXCL, registrationFee: EXCL, customsDuty: NA } }).breakdown.find((x) => x.id === "customs_duty");
    expect(na).toMatchObject({ state: "not_applicable", inGrossOutlay: false });
  });
  it("tollavgift oppgitt som beløp 0 er en kjent kostnadsrad", () => {
    const e = explain({ charges: { climateGas: EXCL, registrationFee: EXCL, customsDuty: { amount: "0", basis: "dealer_entered" } } });
    expect(e.breakdown.find((x) => x.id === "customs_duty")).toMatchObject({ state: "known", amountNok: "0", basis: "dealer_entered", inGrossOutlay: true });
  });
});

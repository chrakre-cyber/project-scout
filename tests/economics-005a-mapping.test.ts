/**
 * ECON-005a — rene mapperfunksjoner `EconomicsResult` → `CostAssessment` og visningsstatus (src/domain/search-economics). Ingen DB, UI, provider eller endring av `classifyBudget`/økonomiflagg.
 * Registerprofilen er uendret (alle flagg false); «approved»-konfigurasjonen er en syntetisk kontroll av at bare `validated` kan gi positiv budsjettstatus. Literaler er håndregnet.
 */
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { calculateEconomics, UNCONFIRMED_HALF_UP, type EconomicsConfig, type EconomicsInput, type EconomicsResult } from "@/domain/economics";
import { combineAssessment, classifyBudget } from "@/domain/search-v2/budget";
import { emptySpec } from "@/domain/search-v2/factory";
import type { CostLine, SearchSpec, VehicleEvaluation } from "@/domain/search-v2/types";
import { computeValidUntil, toCostAssessment, toEconomicsDisplayStatus, treatCostLines, type LineScope, type MapperInput } from "@/domain/search-economics";
import { ECON_CASES } from "./fixtures/econ-golden";

const FV = { treatment: "excluded_documented", evidence: "invoice_or_contract" } as const;
const na = { state: "not_applicable", basis: "test" } as const;
const zero = { amount: "0", basis: "quoted" } as const;
const DOCUMENTED = { ...ECON_CASES[2]!.golden.input, norwegianTaxWeight: { kg: 1976, basis: "vehicle_register" as const }, firstRegistration: { precision: "day" as const, value: "2023-11-15" } };
const registry: EconomicsConfig = { rounding: UNCONFIRMED_HALF_UP };
const approved: EconomicsConfig = { rounding: { mode: "half_up", status: "approved" }, profile: { vatRulesApproved: true, roundingApproved: true, customsFxRuleApproved: true, deductionRuleApproved: true } };
const NOW = "2026-10-20T10:00:00Z";
const CAND = { id: "cand-1", version: "rev-1" } as const;
const OPEN = { label: "rights_profile", untilExclusive: null } as const;
const MATCH = { status: "match", criteria: [], excludedBy: [], unknownMust: [], wishes: { fulfilled: [], notFulfilled: [], unknown: [] } } as unknown as VehicleEvaluation;

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

describe("statusmatrise: økonomi → CostAssessment → classifyBudget", () => {
  it("validated (bare syntetisk godkjent profil) og alle linjer behandlet ⇒ complete_validated; totalen = kontantbehov (468 723 kr) i øre", () => {
    const r = run(econ(), approved);
    expect(r.status).toBe("validated");
    const o = map(r, specOf());
    expect(o.class).toBe("complete_validated");
    expect(o.assessment).toMatchObject({ status: "complete_validated", totalMinor: 46_872_300n, currency: "NOK", registrationScenario: "passenger", candidateId: "cand-1", candidateVersion: "rev-1" });
    expect(classifyBudget(specOf(), CAND, o.assessment, NOW).status).toBe("within_budget");
  });
  it("estimate (registerprofilen) ⇒ unvalidated ⇒ not_calculated, aldri positiv", () => {
    const r = run(econ(), registry);
    expect(r.status).toBe("estimate");
    const o = map(r, specOf());
    expect(o.class).toBe("unvalidated");
    expect(o.assessment!.status).toBe("unvalidated");
    expect(classifyBudget(specOf(), CAND, o.assessment, NOW)).toMatchObject({ status: "not_calculated", reason: "assessment_not_validated" });
  });
  it("nedre grense og scenarier ⇒ incomplete (total = laveste kjente), not_calculated med årsak", () => {
    const lb = run(econ({ commission: [{ role: "unknown", amount: { amount: "3000", basis: "quoted" }, paidSeparatelyFromPrice: true }] }), approved);
    expect(lb.importCashRequirement.kind).toBe("lower_bound");
    const o = map(lb, specOf());
    expect(o.class).toBe("incomplete");
    expect(classifyBudget(specOf(), CAND, o.assessment, NOW)).toMatchObject({ status: "not_calculated", reason: "assessment_incomplete" });
    const sc = run(econ({ deduction: undefined }), approved);
    expect(sc.importCashRequirement.kind).not.toBe("not_calculated");
    expect(map(sc, specOf()).class).toBe("incomplete");
  });
  it("blokkert, ikke beregnet (B1: akseptdato utenfor 2026), varebil og uspesifisert scenario ⇒ ingen vurdering (null ⇒ no_assessment)", () => {
    const blocked = run(econ({ price: { currency: "nok", advertisedNet: "1", priceBasis: "net", use: "advertised", evidence: "dealer_entered" } }), registry);
    expect(blocked.status).toBe("blocked");
    for (const [r, s, reason] of [
      [blocked, specOf(), "economics_blocked"],
      [run(econ({ customsDate: { date: "2027-02-01", kind: "actual_acceptance" } }), approved), specOf(), "cash_requirement_not_calculated"],
      [run(econ(), approved), specOf([], {}, "van"), "scenario_not_supported_by_economics"],
      [run(econ(), approved), specOf([], {}, "unspecified"), "scenario_unspecified"],
    ] as const) {
      const o = map(r, s);
      expect(o.class).toBe("not_calculated");
      expect(o.assessment).toBeNull();
      expect(o.reasons).toContain(reason);
      expect(classifyBudget(s, CAND, o.assessment, NOW).status).toBe("not_calculated");
    }
  });
  it("kandidat, revisjon og kostnadsgrunnlag er bevart; en annen revisjon/endret kostnadslinje gir not_calculated", () => {
    const s = specOf([line("x", "preparation", 500_000n)]);
    const o = map(run(econ(), approved), s);
    expect(o.assessment).toMatchObject({ candidateId: "cand-1", candidateVersion: "rev-1" });
    expect(o.assessment!.costBasis).toBe(JSON.stringify([["x", "preparation", "NOK", "500000", "incl"]]));
    expect(classifyBudget(s, { id: "cand-1", version: "rev-2" }, o.assessment, NOW).reason).toBe("candidate_version_mismatch");
    expect(classifyBudget(s, { id: "cand-2", version: "rev-1" }, o.assessment, NOW).reason).toBe("candidate_mismatch");
    expect(classifyBudget(specOf([line("x", "preparation", 600_000n)]), CAND, o.assessment, NOW).reason).toBe("cost_basis_changed");
  });
});

describe("ingen positive utfall fra usikkerhet (egenskapstest over et rutenett av input)", () => {
  const variants: Array<[string, Partial<EconomicsInput>]> = [
    ["rent", {}],
    ["ukjent akseptdato", { customsDate: undefined }],
    ["akseptdato 2027", { customsDate: { date: "2027-01-05", kind: "actual_acceptance" } }],
    ["akseptdato 2025", { customsDate: { date: "2025-12-31", kind: "actual_acceptance" } }],
    ["forventet dato", { customsDate: { date: "2026-10-25", kind: "expected_scenario" } }],
    ["ukjent transport", { transportToBorder: "unknown" }],
    ["ukjent forsikring", { insurance: undefined }],
    ["ukjent fradrag", { deduction: undefined }],
    ["ukjent mva.-håndtering", { vatHandling: null }],
    ["udokumentert utenlandsk mva.", { price: { currency: "NOK", advertisedNet: "100000", priceBasis: "net", use: "advertised", evidence: "quote_document" } }],
    ["ukjent provisjonsrolle", { commission: [{ role: "unknown", amount: { amount: "3000", basis: "quoted" }, paidSeparatelyFromPrice: true }] }],
    ["ukjent provisjonsbetaling", { commission: [{ role: "purchase_commission", amount: { amount: "3000", basis: "quoted" }, paidSeparatelyFromPrice: null, deductionConditionsMet: true }] }],
    ["uavklart fradragsvilkår", { commission: [{ role: "purchase_commission", amount: { amount: "3000", basis: "quoted" }, paidSeparatelyFromPrice: false }] }],
    ["ukjent betalingskostnad", { paymentCosts: [{ label: "g", amount: { amount: "1200", basis: "quoted" }, nature: "unknown" }] }],
    ["ukjent toll", { charges: { climateGas: na, registrationFee: na, customsDuty: { state: "unknown" } } }],
    ["uklassifisert importavgift", { charges: { climateGas: na, registrationFee: na, importLevies: [{ label: "x", amount: "500", basis: "quoted", vatBase: "unknown" }] } }],
    ["transport etter grensen ukjent", { transportAfterBorder: { state: "unknown" } }],
    ["assumed default transport", { transportToBorder: { amount: "8000", basis: "assumed_default" } }],
  ];
  const specs: Array<[string, SearchSpec]> = [
    ["uten linjer", specOf()],
    ["med ukjent beløp", specOf([line("t", "transport", null)])],
    ["med ubekreftet transport", specOf([line("t", "transport", 800_000n)])],
    ["med utenlandsk valuta", specOf([line("p", "preparation", 100n, { currency: "EUR" })])],
    ["med ukjent mva.-grunnlag", specOf([line("p", "preparation", 100n, { vatBasis: null })])],
  ];
  it("registerprofilen: aldri complete_validated, aldri positiv budsjettstatus eller fullt treff, selv med et enormt budsjett", () => {
    for (const [vn, over] of variants) for (const [sn, s] of specs) {
      const spec = { ...s, budget: { ...s.budget, maxTotalNokMinor: 10n ** 15n } };
      const o = map(run(econ(over), registry), spec);
      expect(o.class, `${vn}/${sn}`).not.toBe("complete_validated");
      const b = classifyBudget(spec, CAND, o.assessment, NOW);
      expect(["within_budget", "within_deviation"].includes(b.status), `${vn}/${sn}`).toBe(false);
      expect(combineAssessment(MATCH, b).isFullHit, `${vn}/${sn}`).toBe(false);
    }
  });
  it("med syntetisk godkjent profil: positiv status bare når økonomikjernen er validated, kontantbehovet er en verdi og alle linjer er behandlet", () => {
    let positives = 0;
    for (const [vn, over] of variants) for (const [sn, s] of specs) {
      const spec = { ...s, budget: { ...s.budget, maxTotalNokMinor: 10n ** 15n } };
      const r = run(econ(over), approved);
      const o = map(r, spec);
      const b = classifyBudget(spec, CAND, o.assessment, NOW);
      const positive = ["within_budget", "within_deviation"].includes(b.status);
      if (positive) positives++;
      expect(positive, `${vn}/${sn}`).toBe(r.status === "validated" && r.importCashRequirement.kind === "value" && spec.budget.costs.every((l) => !["unknown_amount", "unsupported", "unmapped_unknown_scope"].includes(treatCostLines(spec, r)[spec.budget.costs.indexOf(l)]!.treatment)));
    }
    expect(positives).toBeGreaterThan(0); // kontroll: porten er ikke bare stengt
  });
  it("visningsstatus: bare validated er positiv-berettiget; estimat, nedre grense, scenarier, ukjent og ikke beregnet er aldri det", () => {
    for (const [vn, over] of variants) for (const cfg of [registry, approved]) {
      const r = run(econ(over), cfg);
      const o = map(r, specOf());
      const d = toEconomicsDisplayStatus({ result: r, outcome: o, rights: { canDerive: true, canDisplay: true } });
      if (d.overall === "unavailable") throw new Error("uventet");
      expect(d.positiveBudgetEligible, vn).toBe(d.overall === "validated");
      if (cfg === registry) expect(d.overall, vn).not.toBe("validated");
    }
  });
});

describe("kostnadslinjer: eksplisitt behandling, ingen forsvinner, ingen blir 0, ingen dobbelttelling", () => {
  const r = run(econ({ transportToBorder: "unknown", insurance: undefined }), registry); // økonomikjernen har ingen transport-/forsikringskomponent
  const full = run(econ(), approved); // transport 8 000 i kjernen
  it("hver linje får nøyaktig én behandling (antall inn = antall ut)", () => {
    const costs = [line("a", "transport", 800_000n), line("b", "insurance", 50_000n), line("c", "preparation", 100_000n), line("d", "custom", null), line("e", "travel", 1n, { currency: "EUR" }), line("f", "approval", 1n, { vatBasis: null }), line("g", "conversion", 5n, { includedInBudget: false })];
    const out = treatCostLines(specOf(costs), r);
    expect(out.map((l) => l.id)).toEqual(["a", "b", "c", "d", "e", "f", "g"]);
    expect(out.map((l) => l.treatment)).toEqual(["unmapped_unknown_scope", "unmapped_unknown_scope", "added_to_total", "unknown_amount", "unsupported", "unsupported", "not_included"]);
    expect(out.every((l) => l.kind && l.label)).toBe(true);
  });
  it("ubekreftet transport-/forsikringslinje tolkes ikke automatisk: telles som kostnad av ukjent omfang bare når kjernen ikke har tilsvarende komponent; ellers listes den uten å telles (mulig overlapp)", () => {
    const s = specOf([line("a", "transport", 800_000n), line("b", "insurance", 50_000n)]);
    const noComp = treatCostLines(s, r);
    expect(noComp.map((l) => [l.counted, l.reason])).toEqual([[true, "scope_unconfirmed"], [true, "scope_unconfirmed"]]);
    const withComp = treatCostLines(s, full);
    expect(withComp.map((l) => [l.treatment, l.counted, l.reason])).toEqual([["unmapped_unknown_scope", false, "scope_unconfirmed_possible_overlap"], ["unmapped_unknown_scope", true, "scope_unconfirmed"]]);
    // total = kontantbehov + telte linjer; aldri mer
    const o = map(r, s);
    expect(o.assessment!.totalMinor).toBe(lowerCash(r) * 100n + 850_000n);
    expect(o.class).toBe("incomplete");
    expect(o.assessment!.coveredCostLineIds).toEqual([]);
  });
  it("bekreftet omfang mappes til kjernens komponent og telles ikke på nytt; split må summere til linjens beløp", () => {
    const scopes: Record<string, LineScope> = { a: "to_border", b: "to_border" };
    const s = specOf([line("a", "transport", 800_000n), line("b", "insurance", 0n)]);
    const out = treatCostLines(s, full, scopes);
    expect(out.map((l) => [l.treatment, l.counted])).toEqual([["mapped_to_input", false], ["mapped_to_input", false]]);
    const o = map(full, s, { lineScopes: scopes });
    expect(o.class).toBe("complete_validated");
    expect(o.assessment!.totalMinor).toBe(46_872_300n); // uendret: linjene ligger allerede i kontantbehovet
    expect(o.assessment!.coveredCostLineIds).toEqual(["a", "b"]);
    const split = specOf([line("a", "transport", 1_000_000n)]);
    expect(treatCostLines(split, full, { a: { split: { toBorderMinor: 800_000n, afterBorderMinor: 200_000n } } })[0]!.reason).toBe("mapped_component_missing"); // etter grensen er 0 i kjernen
    expect(treatCostLines(split, full, { a: { split: { toBorderMinor: 800_000n, afterBorderMinor: 100_000n } } })[0]!.reason).toBe("split_sum_mismatch");
  });
  it("bekreftet omfang uten tilsvarende komponent i kjernen, og ugyldig omfang for typen, er unsupported (ikke stille antatt)", () => {
    const s = specOf([line("a", "transport", 800_000n)]);
    expect(treatCostLines(s, r, { a: "to_border" })[0]).toMatchObject({ treatment: "unsupported", reason: "mapped_component_missing", counted: false });
    expect(treatCostLines(s, full, { a: "other" })[0]).toMatchObject({ treatment: "unsupported", reason: "scope_not_valid_for_kind" });
    expect(treatCostLines(specOf([line("b", "insurance", 5n)]), full, { b: "after_border" })[0]).toMatchObject({ treatment: "unsupported", reason: "scope_not_valid_for_kind" });
  });
  it("ukjent beløp, utenlandsk valuta og ukjent mva.-grunnlag: ikke i total, ikke dekket, resultat incomplete; aldri 0", () => {
    for (const l of [line("u", "preparation", null), line("v", "preparation", 100n, { currency: "EUR" }), line("w", "preparation", 100n, { vatBasis: null })]) {
      const s = specOf([l]);
      const o = map(full, s);
      expect(o.class).toBe("incomplete");
      expect(o.assessment!.coveredCostLineIds).toEqual([]);
      expect(o.assessment!.totalMinor).toBe(46_872_300n);
      expect(o.lines).toHaveLength(1);
      expect(o.reasons.join(" ")).toContain(l.id);
      expect(classifyBudget(s, CAND, o.assessment, NOW).status).toBe("not_calculated");
    }
  });
  it("øvrige linjer legges til totalen én gang og ligger utenfor tollverdi/mva.-grunnlag; ikke-inkluderte linjer er synlige men utenfor", () => {
    const s = specOf([line("p", "preparation", 100_000n), line("q", "custom", 250_000n), line("n", "approval", 777n, { includedInBudget: false })]);
    const o = map(full, s);
    expect(o.assessment!.totalMinor).toBe(46_872_300n + 350_000n);
    expect(o.assessment!.coveredCostLineIds).toEqual(["p", "q"]);
    expect(o.lines.find((l) => l.id === "n")).toMatchObject({ treatment: "not_included", counted: false });
    expect(o.class).toBe("complete_validated");
    expect(full.customsValueNok).toBe(108000n);
  });
});
const lowerCash = (x: EconomicsResult): bigint => { const t = x.importCashRequirement; if (t.kind === "value") return t.valueNok; if (t.kind === "lower_bound") return t.lowerBoundNok; throw new Error("ingen kontantverdi"); };

describe("validUntil = minimum av alle gyldighetsgrenser (plan P3)", () => {
  const r = run(econ(), approved);
  const vu = (over: Partial<MapperInput> = {}) => computeValidUntil({ result: r, now: NOW, rightsLimit: OPEN, sourceDataLimit: OPEN, ...over });
  it("uten andre grenser: det tekniske taket now + 24 t", () => {
    expect(vu()).toMatchObject({ validUntil: "2026-10-21T10:00:00.000Z", binding: "technical_cap_24h" });
  });
  it("rettighetsprofilens utløp, kildedata, øvrige grenser og tollkursens validTo (+1 døgn) kan hver for seg bli bindende; aldri lengre enn noen grense", () => {
    expect(vu({ rightsLimit: { label: "rights_profile", untilExclusive: "2026-10-20T18:00:00Z" } })).toMatchObject({ validUntil: "2026-10-20T18:00:00.000Z", binding: "rights_profile" });
    expect(vu({ sourceDataLimit: { label: "source_data", untilExclusive: "2026-10-20T12:00:00Z" } })).toMatchObject({ binding: "source_data", validUntil: "2026-10-20T12:00:00.000Z" });
    expect(vu({ extraLimits: [{ label: "dealer_confirmation", untilExclusive: "2026-10-20T11:00:00Z" }, { label: "tax_profile", untilExclusive: "2026-10-20T15:00:00Z" }] })).toMatchObject({ binding: "dealer_confirmation" });
    const withFx = { ...r, fx: { ...r.fx, customs: { ...r.fx.customs, validTo: "2026-10-20" } } } as EconomicsResult;
    expect(computeValidUntil({ result: withFx, now: NOW, rightsLimit: OPEN, sourceDataLimit: OPEN })).toMatchObject({ validUntil: "2026-10-21T00:00:00.000Z", binding: "customs_fx_validTo" });
  });
  it("beregningsprofilens dokumenterte periode (eksklusiv slutt 2027-01-01) begrenser sent i 2026", () => {
    expect(computeValidUntil({ result: r, now: "2026-12-31T12:00:00Z", rightsLimit: OPEN, sourceDataLimit: OPEN })).toMatchObject({ validUntil: "2027-01-01T00:00:00.000Z", binding: "documented_rule_period" });
  });
  it("utløpt (≤ now) ⇒ ingen vurdering (stale), ikke en gammel total; uleselig grense ⇒ ikke beregnet (ikke «ingen grense»)", () => {
    const stale = map(r, specOf(), { rightsLimit: { label: "rights_profile", untilExclusive: "2026-10-20T10:00:00Z" } });
    expect(stale.class).toBe("stale");
    expect(stale.assessment).toBeNull();
    const bad = map(r, specOf(), { extraLimits: [{ label: "dealer_confirmation", untilExclusive: "i går" }] });
    expect(bad.class).toBe("not_calculated");
    expect(bad.reasons.join(" ")).toContain("dealer_confirmation");
    expect(map(r, specOf(), { now: "ikke-en-dato" }).assessment).toBeNull();
  });
  it("assessment.validUntil er minimum, og classifyBudget behandler den som foreldet fra og med grensen", () => {
    const o = map(r, specOf(), { rightsLimit: { label: "rights_profile", untilExclusive: "2026-10-20T10:30:00Z" } });
    expect(o.assessment!.validUntil).toBe("2026-10-20T10:30:00.000Z");
    expect(classifyBudget(specOf(), CAND, o.assessment, "2026-10-20T10:29:59Z").status).toBe("within_budget");
    expect(classifyBudget(specOf(), CAND, o.assessment, "2026-10-20T10:30:00Z").reason).toBe("assessment_stale");
  });
});

describe("visningsstatus og rettigheter", () => {
  const rights = { canDerive: true, canDisplay: true };
  it("uten avledet bruk eller visningsrett: unavailable(rights_not_granted), uten tall (ikke 0, ikke skjult)", () => {
    const r = run(econ(), approved);
    for (const rt of [{ canDerive: false, canDisplay: true }, { canDerive: true, canDisplay: false }, { canDerive: false, canDisplay: false }]) {
      const d = toEconomicsDisplayStatus({ result: r, outcome: map(r, specOf()), rights: rt });
      expect(d).toEqual({ overall: "unavailable", reason: "rights_not_granted", labelKey: "rights_not_granted", positiveBudgetEligible: false });
    }
  });
  it("estimat, nedre grense, ikke beregnet og validated får faste nøkler og riktig totalform", () => {
    const est = run(econ(), registry);
    const d1 = toEconomicsDisplayStatus({ result: est, outcome: map(est, specOf()), rights });
    expect(d1).toMatchObject({ overall: "estimate", labelKey: "estimate_not_validated", cash: { kind: "value", valueNok: 468723n }, positiveBudgetEligible: false });
    const lb = run(econ({ commission: [{ role: "unknown", amount: { amount: "3000", basis: "quoted" }, paidSeparatelyFromPrice: true }] }), registry);
    const d2 = toEconomicsDisplayStatus({ result: lb, outcome: map(lb, specOf()), rights });
    expect(d2).toMatchObject({ overall: "incomplete", labelKey: "incomplete_lower_bound", cash: { kind: "lower_bound" }, positiveBudgetEligible: false });
    const out = run(econ({ customsDate: { date: "2027-02-01", kind: "actual_acceptance" } }), registry);
    const d3 = toEconomicsDisplayStatus({ result: out, outcome: map(out, specOf()), rights });
    expect(d3).toMatchObject({ overall: "not_calculated", labelKey: "not_calculated", cash: { kind: "not_calculated" }, landed: { kind: "not_calculated" }, positiveBudgetEligible: false });
    const ok = run(econ(), approved);
    expect(toEconomicsDisplayStatus({ result: ok, outcome: map(ok, specOf()), rights })).toMatchObject({ overall: "validated", labelKey: "validated", positiveBudgetEligible: true });
    expect(toEconomicsDisplayStatus({ result: null, outcome: null, rights })).toMatchObject({ overall: "not_calculated", positiveBudgetEligible: false });
  });
  it("ukjent fradragsstatus gir to merkede scenarier i økonomisk kost, ikke ett tall", () => {
    const r = run(econ({ deduction: undefined }), registry);
    const d = toEconomicsDisplayStatus({ result: r, outcome: map(r, specOf()), rights });
    if (d.overall === "unavailable") throw new Error("uventet");
    expect(d.landed.kind).toBe("scenarios");
    expect(d.positiveBudgetEligible).toBe(false);
  });
  it("kostnadslinjene følger med visningsstatusen (ingen forsvinner)", () => {
    const r = run(econ(), registry);
    const s = specOf([line("a", "transport", 800_000n), line("c", "preparation", null)]);
    const d = toEconomicsDisplayStatus({ result: r, outcome: map(r, s), rights });
    if (d.overall === "unavailable") throw new Error("uventet");
    expect(d.lines.map((l) => l.id)).toEqual(["a", "c"]);
  });
});

describe("arkitektur: ren domenekode uten float, I/O eller andre lag", () => {
  it("src/domain/search-economics importerer bare @/domain og relative filer, og bruker ikke float/klokke", () => {
    const dir = "src/domain/search-economics";
    for (const f of readdirSync(dir)) {
      const src = readFileSync(`${dir}/${f}`, "utf8");
      expect(src, f).not.toMatch(/Math\.(round|floor|ceil|trunc)|parseFloat|Number\(|toFixed|Date\.now\(|new Date\(\)/);
      expect(src, f).not.toMatch(/from "(?!@\/domain\/|\.\/)[^"]+"/);
    }
  });
});

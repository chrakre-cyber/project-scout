/**
 * ECON-006a — forklaringsmodell og skrivebeskyttet forklaring. Alle forventede tall er B-Merovo-scenario / fixturekonvensjon fra `econ-golden` (kjøpesum og kurs er testinput; U-013
 * halvt-opp er fixturekonvensjon, IKKE produksjonsregel). Ingenting her er validert eller bekreftet mot offisiell kilde, og ingen mobile.de-respons er brukt.
 * Skillet bevares: offisielle observasjoner (ikke brukt her), historisk oppgitte tall (A-stated, ikke brukt som forventning) og syntetiske scenarioer (disse testene).
 */
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EconomicsNote } from "@/components/search/EconomicsNote";
import { calculateEconomics, UNCONFIRMED_HALF_UP, type EconomicsConfig, type EconomicsInput, type FxQuote } from "@/domain/economics";
import { REGISTERED_PROFILES, rightsForSource, type ProviderRightsProfile } from "@/domain/provider-rights";
import { explainEconomics, fieldOfCode, uncertaintyCategory, toEconomicsView, type EconomicsView, type Explanation } from "@/domain/search-economics";
import type { NormalizedListing } from "@/domain/types";
import type { MarketplaceProvider } from "@/providers/marketplace";
import * as L from "@/lib/search-labels";
import { storedKey } from "@/server/dealer-economics";
import { previewForDisplay, type EconomicsContext } from "@/server/search-display";
import { ECON_CASES, FIXTURE_FX, FX_ROLES_SCENARIO, MEROVO_DEFAULT_EXPECTED } from "./fixtures/econ-golden";
import { FIRM_A, NOW, SEARCH_1, candidateFor, dealerInput, listing, specOf, stored } from "./fixtures/economics-005c";
import { profile } from "./fixtures/rights-profiles";

// ------------------------------------------------------------------ kjerneoppsett (lokal kopi av mønsteret i economics-core.test.ts)
const FV = { treatment: "excluded_documented", evidence: "invoice_or_contract" } as const;
const EXCL = { state: "excluded_by_scenario", reason: "fixture" } as const;
const fxq = (rate: string, over: Partial<FxQuote> = {}): FxQuote => ({ pair: "EUR/NOK", rate, source: { kind: "fixture" }, effectiveAt: null, quotedAt: null, fixtureOnly: true, validFrom: "2026-10-15", validTo: "2026-11-11", ...over });
const ALL_TRUE = { batteryOnlyPropulsion: true, externallyChargeableBattery: true, passengerVehicle: true, notPreviouslyRegisteredInNorway: true } as const;
const NOT_EV = { ...ALL_TRUE, batteryOnlyPropulsion: false } as const;
const cfg = (over: Partial<EconomicsConfig> = {}): EconomicsConfig => ({ rounding: UNCONFIRMED_HALF_UP, allowFixtureFxQuotes: true, ...over });
const fixtureInput = (i: number, over: Partial<EconomicsInput> = {}): EconomicsInput => ({
  price: { currency: "EUR", advertisedNet: String(ECON_CASES[i]!.advertisedNetPriceEur), priceBasis: "net", use: "advertised", evidence: "listing_claim", foreignVat: FV },
  fx: { acquisition: fxq(FIXTURE_FX.rate), customs: fxq(FIXTURE_FX.rate) },
  transportToBorder: { amount: "8000", basis: "dealer_entered" }, transportAfterBorder: EXCL, loadingHandling: EXCL, insurance: { amount: "0", basis: "scenario_assumption" },
  customsDate: { date: "2026-10-20", kind: "expected_scenario" }, vatHandling: { value: "registered_reports_in_vat_return", source: { kind: "dealer_entered" } },
  taxInput: ECON_CASES[i]!.golden.input, deduction: { value: "non_recoverable", source: { kind: "dealer_entered" } },
  ...(i === 1 ? { evQualification: ALL_TRUE, evThresholdBasis: "customs_value" as const } : { evQualification: NOT_EV, evThresholdBasis: undefined }),
  charges: { climateGas: EXCL, registrationFee: EXCL, customsDuty: EXCL }, asOf: "2026-10-18", ...over,
});
const ids = ["CASE-001", "CASE-002", "CASE-003"] as const;
const explainCore = (i: number, over: Partial<EconomicsInput> = {}, c: Partial<EconomicsConfig> = {}): Explanation =>
  explainEconomics({ result: calculateEconomics(fixtureInput(i, over), cfg(c)), outcome: null, notes: [] });
const rowOf = (e: Explanation, id: string) => e.breakdown.find((r) => r.id === id)!;
const nok = (e: Explanation, id: string) => rowOf(e, id).amountNok;

describe("avstemming: nedbrytningen summerer til brutto utlegg (B-Merovo-scenario / fixturekonvensjon, ikke produksjonsregel)", () => {
  for (const i of [0, 1, 2]) {
    for (const state of ["recoverable", "non_recoverable"] as const) {
      it(`${ids[i]} ${state}: rader = MEROVO_DEFAULT_EXPECTED, ingen «øvrige poster»`, () => {
        const x = MEROVO_DEFAULT_EXPECTED[ids[i]!];
        const e = explainCore(i, { transportToBorder: undefined, deduction: { value: state, source: { kind: "dealer_entered" } } }, { transportDefaultNok: "8000" });
        expect(nok(e, "customs_value")).toBe(String(x.customsValueNok));
        expect(nok(e, "import_vat")).toBe(String(x.importVatNok));
        expect(BigInt(nok(e, "one_off_tax")!) + BigInt(nok(e, "scrappage_deposit")!)).toBe(BigInt(x.totalRegistrationTaxesNok));
        const gross = e.breakdown.filter((r) => r.inGrossOutlay).reduce((t, r) => t + BigInt(r.amountNok!), 0n);
        expect(gross).toBe(BigInt(x.importCashRequirementNok));
        expect(e.breakdown.some((r) => r.id === "other_rounding")).toBe(false);
        expect(rowOf(e, "transport_to_border")).toMatchObject({ state: "assumed", basis: "assumed", amountNok: "8000" });
        // beregningsgrunnlag summeres ikke inn i brutto utlegg
        for (const id of ["customs_value", "customs_duty", "import_vat_base"]) expect(rowOf(e, id).inGrossOutlay).toBe(false);
      });
    }
  }
  it("ukjent fradrag: brutto utlegg uendret, mva.-posten er fortsatt kjent i utlegget (scenarioene ligger i landed-visningen, ikke i nedbrytningen)", () => {
    for (const i of [0, 1, 2]) {
      const r = calculateEconomics(fixtureInput(i, { transportToBorder: undefined, deduction: undefined }), cfg({ transportDefaultNok: "8000" }));
      expect(r.estimatedLandedCost.kind).toBe("scenarios");
      const e = explainEconomics({ result: r, outcome: null, notes: [] });
      expect(e.assumptions.vatRecoverability.value).toBe("unknown");
      expect(e.uncertainty.some((u) => u.code === "unresolved_vat_recoverability" || u.code === "vat_recoverability")).toBe(true);
      expect(e.missing.map((m) => m.field)).toContain("deduction");
    }
  });
  it("kursroller (syntetisk tollkurs 10,7000): kursene vises per rolle med kildetype «fixture» og ikke som offisiell kurs", () => {
    const x = FX_ROLES_SCENARIO.expected;
    const e = explainCore(2, { fx: { acquisition: fxq(FX_ROLES_SCENARIO.acquisitionFxRate), customs: fxq(FX_ROLES_SCENARIO.customsFxRate) } });
    expect(nok(e, "purchase")).toBe(String(x.acquisitionUsedNok));
    expect(nok(e, "customs_value")).toBe(String(x.customsValueNok));
    expect(nok(e, "import_vat")).toBe(String(x.importVatNok));
    expect(rowOf(e, "purchase").original).toEqual({ amount: String(ECON_CASES[2]!.advertisedNetPriceEur), currency: "EUR" });
    const byRole = Object.fromEntries(e.assumptions.fx.map((f) => [f.role, f]));
    expect(byRole.acquisition).toMatchObject({ rate: "10.6709", sourceKind: "fixture" });
    expect(byRole.customs).toMatchObject({ rate: "10.7", sourceKind: "fixture" });
    expect(L.FX_SOURCE_LABEL.fixture).toBe("Testkurs — ikke en offisiell kurs");
    expect(e.assumptions.rulesApprovedForValidation).toBe(false);
  });
  it("kjent registreringsgebyr er en egen rad (ikke en rekonstruert differanse)", () => {
    const e = explainCore(2, { charges: { climateGas: EXCL, registrationFee: { amount: "1000", basis: "quoted" }, customsDuty: EXCL } });
    const gross = e.breakdown.filter((r) => r.inGrossOutlay).reduce((t, r) => t + BigInt(r.amountNok!), 0n);
    const base = explainCore(2).breakdown.filter((r) => r.inGrossOutlay).reduce((t, r) => t + BigInt(r.amountNok!), 0n);
    expect(gross - base).toBe(1000n);
    expect(rowOf(e, "registration_fee")).toMatchObject({ state: "known", amountNok: "1000", basis: "document", inGrossOutlay: true });
  });
  it("ukjent post blir null/unknown — aldri 0", () => {
    const e = explainCore(2, { transportToBorder: undefined, insurance: undefined });
    for (const id of ["transport_to_border", "insurance"]) expect(rowOf(e, id)).toMatchObject({ state: "unknown", amountNok: null, basis: "unresolved" });
    expect(JSON.stringify(e.breakdown.filter((r) => r.state === "unknown").map((r) => r.amountNok))).not.toMatch(/"0"/);
  });
});

describe("dokumentasjonsdekning og grunnlagsetiketter: ingen tillitsscore, ingen statistisk eller juridisk antydning", () => {
  it("annonsepåstand er aldri dokumentasjon; teller bare dokumentbaserte kjente kostnadsposter", () => {
    const e = explainCore(2);
    expect(e.basisSummary).toBe("dealer_stated");
    expect(e.coverage.documented).toBe(0);
    const q = explainCore(2, { transportToBorder: { amount: "8000", basis: "quoted" } });
    expect(rowOf(q, "transport_to_border").basis).toBe("document");
    expect(q.coverage.documented).toBe(1);
    expect(q.basisSummary).toBe("partly_documented");
    expect(q.coverage.documented).toBeLessThanOrEqual(q.coverage.knownCostItems);
  });
  it("modellen har ingen score/prosent/tillitsfelt; teller er heltall", () => {
    const e = explainCore(2, { transportToBorder: { amount: "8000", basis: "quoted" } });
    expect(Object.keys(e).sort()).toEqual(["assumptions", "basisSummary", "breakdown", "coverage", "grossOutlayIsNotCashAtBorder", "missing", "searchCosts", "uncertainty"]);
    expect(Object.keys(e.coverage).sort()).toEqual(["documented", "knownCostItems"]);
    expect(Number.isInteger(e.coverage.documented) && Number.isInteger(e.coverage.knownCostItems)).toBe(true);
    expect(JSON.stringify(e)).not.toMatch(/confidence|score|percent|probab|sikkerhet|godkjent/i);
  });
  it("tellertekst og forbehold bruker ikke språk om sikkerhet, riktighet eller godkjenning", () => {
    const texts = [L.coverageText(1, 3), ...Object.values(L.BASIS_SUMMARY_LABEL)];
    for (const t of texts) expect(t).not.toMatch(/sikker|trygg|godkjent|garanti|riktig|nøyaktig|pålitelig|\d\s?%|prosent|score/i);
    // grunnlagsetikettene kan nevne «ikke godkjent» (regelstatus), men aldri love sikkerhet eller riktighet
    for (const t of Object.values(L.BASIS_LABEL)) expect(t).not.toMatch(/sikker|trygg|garanti|riktig|nøyaktig|pålitelig|\d\s?%|prosent|score/i);
    // forbeholdet fornekter uttrykkelig at telleren sier noe om riktighet, sikkerhet eller godkjenning
    expect(L.COVERAGE_DISCLAIMER).toMatch(/ikke/);
    expect(L.COVERAGE_DISCLAIMER).toMatch(/riktige/);
    expect(L.coverageText(1, 3)).toMatch(/1/);
    expect(L.coverageText(1, 3)).toMatch(/3/);
  });
  it("grunnlagsetikettene er faste: alle BasisKey har en tekst", () => {
    for (const k of ["listing_claim", "dealer_entered", "document", "assumed", "stated_input", "engine_estimate", "computed", "ordinary_rate_unapproved", "unresolved"]) expect(L.BASIS_LABEL[k as keyof typeof L.BASIS_LABEL]).toBeTruthy();
  });
});

describe("mangler → inputfelt, usikkerhetskategorier", () => {
  it("kjernekoder for manglende opplysning føres til riktig inputfelt", () => {
    expect(["ev_qualification_unresolved", "commission_role_unknown", "payment_cost_nature_unknown"].map((c) => fieldOfCode(c))).toEqual(["ev_qualification", "commission", "payment_costs"]);
  });
  it("EV-kvalifisering, provisjon, betalingskostnader og avgifter kan ikke registreres (collectable=false); øvrige kan", () => {
    const r = calculateEconomics(fixtureInput(1, { evQualification: undefined, evThresholdBasis: undefined, transportToBorder: undefined, deduction: undefined }), cfg());
    const e = explainEconomics({ result: r, outcome: null, notes: [] });
    const m = Object.fromEntries(e.missing.map((x) => [x.field, x.collectable]));
    expect(m.ev_qualification).toBe(false);
    expect(m.deduction).toBe(true);
    expect(m.transport_to_border).toBe(true);
  });
  it("kategorier: regel / inputgrunnlag / forutsetning / mangler / ikke innsamlet", () => {
    expect(uncertaintyCategory("vat_rules_unapproved", "estimate")).toBe("rule");
    expect(uncertaintyCategory("purchase_price_listing_claim", "estimate")).toBe("input_basis");
    expect(uncertaintyCategory("transport_default_assumed", "estimate")).toBe("assumption");
    expect(uncertaintyCategory("transport_unknown", "incomplete")).toBe("missing");
    expect(uncertaintyCategory("commission_not_collected", "note")).toBe("not_collected");
  });
});

// ------------------------------------------------------------------ pipeline (ekte rettighetsgrense, registerprofil, alle økonomiflagg false)
const eurListing = (i: number, over: Partial<NormalizedListing> = {}): NormalizedListing => {
  const c = ECON_CASES[i]!;
  const spec = c.golden.input;
  const base = listing();
  return listing({
    price: { ...base.price, stated: { amount: String(c.advertisedNetPriceEur), currency: "EUR" }, amount: { amountMinor: c.advertisedNetPriceEur * 100, currency: "EUR" }, basis: "net" },
    specs: { ...base.specs, fuel: i === 0 ? "plugin_hybrid" : i === 1 ? "electric" : "diesel", co2: { gramsPerKm: spec.co2.gramsPerKm ?? 0, testMethod: "WLTP" }, curbWeightKg: spec.norwegianTaxWeight.kg ?? null },
    ...over,
  } as Partial<NormalizedListing>);
};
const fxD = (rate: string) => ({ pair: "EUR/NOK", rate, sourceLabel: "forhandlerens egen kursnotering (testdata)", quotedAt: "2026-10-19", validUntil: "2026-11-11", validFrom: "2026-10-15", validTo: "2026-11-11" });
const inputFor = (i: number) => {
  const g = ECON_CASES[i]!.golden.input;
  return dealerInput({
    propulsion: { pistonCombustionEngine: g.propulsion.pistonCombustionEngine, externallyChargeable: g.propulsion.externallyChargeable, combustionFuel: g.propulsion.combustionFuel, hybridization: g.propulsion.hybridization as "none" | null, basis: "type_approval" } as never,
    taxWeight: { kg: g.norwegianTaxWeight.kg, basis: "vehicle_register" }, co2: { gramsPerKm: g.co2.gramsPerKm, method: g.co2.method as never },
    firstRegistration: { precision: "month", value: g.firstRegistration.value, basis: "vehicle_register" },
    norwegianRegistration: { date: "2026-10-18", kind: "expected" },
    fx: { acquisition: fxD(FIXTURE_FX.rate), customs: fxD(FIXTURE_FX.rate) },
    transportToBorder: { amount: "8000" },
  });
};
const providerOf = (ls: NormalizedListing[]): MarketplaceProvider => ({
  source: "synthetic-demo",
  search: async () => ({ items: ls, nextPage: null, sourceTotal: ls.length, truncated: false, fetchedAt: NOW.toISOString(), rejected: [] }),
  getListing: async (id) => ls.find((l) => l.sourceListingId === id) ?? null,
});
const runCase = async (i: number, over: Parameters<typeof dealerInput>[0] = {}, profiles?: readonly ProviderRightsProfile[]) => {
  const l = eurListing(i);
  const spec = specOf();
  const cand = candidateFor(l);
  const rights = rightsForSource("synthetic-demo", NOW, profiles ?? REGISTERED_PROFILES);
  const ctx: EconomicsContext = { dealershipId: FIRM_A, searchId: SEARCH_1, storedInputs: new Map([[storedKey(cand.id, cand.version), stored({ rights, spec, cand, input: { ...inputFor(i), ...over } })]]), profile: null };
  const out = await previewForDisplay(spec, { provider: providerOf([l]), now: () => NOW, profiles, economics: ctx });
  if (!out.ok) throw new Error("kilden feilet");
  return out.items[0]!.economics;
};
const sumGross = (e: Explanation) => e.breakdown.filter((r) => r.inGrossOutlay).reduce((t, r) => t + BigInt(r.amountNok!), 0n);

describe("gjennom rettighetsgrensen med demodata (diesel, PHEV, BEV) — forventninger fra fixturene, ikke produksjonsregler", () => {
  it("CASE-003 diesel: estimat 858 087, nedbrytningen avstemmer, kursene er forhandleroppgitt med kilde og dato", async () => {
    const e = await runCase(2);
    expect(e.status).toBe("estimate");
    if (e.status !== "estimate" || e.explanation === null) throw new Error("forventet estimat med forklaring");
    expect(e.landed).toEqual({ kind: "value", nok: String(MEROVO_DEFAULT_EXPECTED["CASE-003"].landedNonRecoverableNok) });
    expect(sumGross(e.explanation)).toBe(BigInt(MEROVO_DEFAULT_EXPECTED["CASE-003"].importCashRequirementNok));
    expect(nok(e.explanation, "import_vat")).toBe(String(MEROVO_DEFAULT_EXPECTED["CASE-003"].importVatNok));
    expect(e.explanation.assumptions.fx.map((f) => f.sourceKind)).toEqual(["dealer_entered", "dealer_entered"]);
    expect(e.explanation.assumptions.fx[0]).toMatchObject({ sourceLabel: "forhandlerens egen kursnotering (testdata)", quotedAt: "2026-10-19" });
    expect(e.explanation.assumptions.rulesApprovedForValidation).toBe(false);
    expect(e.explanation.uncertainty.some((u) => u.category === "rule")).toBe(true);
    expect(e.explanation.grossOutlayIsNotCashAtBorder).toBe(true);
    expect(e.positiveBudgetEligible).toBe(false);
  });
  it("CASE-001 PHEV: estimat 3 900 629 med avstemt nedbrytning", async () => {
    const e = await runCase(0);
    if (e.status !== "estimate" || e.explanation === null) throw new Error("forventet estimat med forklaring");
    expect(e.landed).toEqual({ kind: "value", nok: "3900629" });
    expect(sumGross(e.explanation)).toBe(3900629n);
    expect(e.explanation.missing).toEqual([]);
  });
  it("CASE-002 BEV: EV-kvalifisering er ikke innsamlet ⇒ to merkede scenarioer, ikke et enkelt tall; mangelen kan ikke registreres", async () => {
    const e = await runCase(1);
    expect(e.status).toBe("scenarios");
    if (e.status !== "scenarios" || e.explanation === null) throw new Error("forventet scenarioer med forklaring");
    expect(e.explanation.missing).toContainEqual({ field: "ev_qualification", collectable: false });
    expect(e.positiveBudgetEligible).toBe(false);
    expect(JSON.stringify(e)).toContain("485077");
    expect(JSON.stringify(e)).toContain("410077");
  });
  it("forklaringen er JSON-sikker (ingen bigint), og utfallet er ikke et positivt budsjettutfall", async () => {
    for (const i of [0, 1, 2]) {
      const e = await runCase(i);
      expect(() => JSON.stringify(e)).not.toThrow();
      expect(e.positiveBudgetEligible).toBe(false);
    }
  });
  it("rettighetsvakt: manglende visningsrett ⇒ ensartet «unavailable» uten forklaring, rader eller tall", async () => {
    const p = profile({ storage: { ...profile().storage, retentionSeconds: 604_800 }, derivedEconomics: { allow: { price: true, registration: true, specs: true }, display: false } });
    const e = await runCase(2, {}, [p]);
    expect(e).toEqual({ status: "unavailable", labelKey: "rights_not_granted", positiveBudgetEligible: false });
    expect(JSON.stringify(e)).not.toMatch(/explanation|breakdown|858087/);
  });
  it("uten kontekst/forhandlerinput: ingen forklaring med tall (ikke beregnet)", async () => {
    const l = eurListing(2);
    const out = await previewForDisplay(specOf(), { provider: providerOf([l]), now: () => NOW });
    if (!out.ok) throw new Error("kilden feilet");
    const e = out.items[0]!.economics;
    expect(JSON.stringify(e)).not.toMatch(/858087|breakdown/);
  });
});

// ------------------------------------------------------------------ visning (ren statisk markup)
const html = (e: EconomicsView, compact = false) => renderToStaticMarkup(createElement(EconomicsNote, { economics: e, compact }));
describe("visning: hovedmerking, usikkerhet, brutto utlegg ≠ kontantbetaling, ikke rådgivning erstatter ikke forklaring", () => {
  it("estimat (uten sammendrag): «Estimat», brutto utlegg og kostnad etter mva.-fradrag, forklaring av brutto utlegg, rader, forutsetninger, usikkerhet og dekning", async () => {
    const h = html(await runCase(2));
    expect(h).toContain("Estimat");
    expect(h).not.toContain("ikke validert");
    for (const id of ["economics-sums", "economics-gross-explain", "economics-cost-explain", "economics-breakdown", "economics-assumptions", "economics-uncertainty", "economics-not-advice"]) expect(h).toContain(`data-testid="${id}"`);
    expect(h).toContain(L.GROSS_OUTLAY_EXPLAIN);
    expect(L.GROSS_OUTLAY_EXPLAIN).toMatch(/ikke nødvendigvis/i);
    expect(L.GROSS_OUTLAY_EXPLAIN).toMatch(/kontant/i);
    expect(h).toContain(L.RULES_NOT_APPROVED);
    expect(h).toContain(L.COVERAGE_DISCLAIMER);
  });
  it("«Ikke rådgivning» erstatter ikke forklaring av usikkerhet: begge finnes, og uavhengig av hverandre", async () => {
    const h = html(await runCase(2));
    expect(h).toContain(L.ECONOMICS_NOT_ADVICE);
    expect(h).toContain('data-testid="economics-uncertainty"');
    expect(L.ECONOMICS_NOT_ADVICE).not.toBe(L.ECONOMICS_UNCERTAINTY_INTRO);
  });
  it("scenarier: merket som scenarier, ikke et enkelt tall; manglende felt som ikke kan registreres sies ærlig, uten skjema", async () => {
    const h = html(await runCase(1));
    expect(h).toContain('data-testid="economics-scenarios"');
    expect(h).toContain('data-testid="economics-missing-fields"');
    expect(h).toContain(L.NOT_COLLECTABLE_TEXT);
    expect(h).not.toContain('data-testid="economics-form-unavailable"');
  });
  it("forhandlerskjema-merknad vises bare når et mangelfelt faktisk kan registreres", async () => {
    const e = await runCase(2, { transportToBorder: undefined });
    const h = html(e);
    if (e.status === "unavailable") throw new Error("forventet tall-/forklaringsvisning");
    expect(e.explanation?.missing).toContainEqual({ field: "transport_to_border", collectable: true });
    expect(h).toContain('data-testid="economics-form-unavailable"');
  });
  it("kompakt visning viser ingen nedbrytning; utilgjengelig viser ingen tall", async () => {
    expect(html(await runCase(2), true)).not.toContain("economics-breakdown");
    const u = html({ status: "unavailable", labelKey: "rights_not_granted", positiveBudgetEligible: false } as EconomicsView);
    expect(u).not.toMatch(/\d{3}/);
  });
  it("ikke beregnet: «Ikke beregnet», uten nedre grense eller tall", () => {
    const nc = { kind: "not_calculated" as const, reasons: ["no_result"] };
    const v = toEconomicsView(
      { overall: "not_calculated", labelKey: "not_calculated", cash: nc, landed: nc, estimateReasons: [], incompleteReasons: [], reasons: ["no_result"], lines: [], positiveBudgetEligible: false },
      { state: "none" }, [],
    );
    expect(v.status).toBe("not_calculated");
    expect(html(v)).toContain("Ikke beregnet");
  });
});

describe("arkitektur: forklaringen er ren, ikke lagret og bruker ikke de forbudte operasjonene", () => {
  const src = readFileSync("src/domain/search-economics/explain.ts", "utf8");
  it("importerer bare domene, ingen server/UI/IO og ingen forbudte tallfunksjoner", () => {
    for (const m of src.matchAll(/from "([^"]+)"/g)) expect(m[1]!.startsWith("@/domain/") || m[1]!.startsWith("./")).toBe(true);
    expect(src).not.toMatch(/Math\.(round|floor|ceil|trunc)|parseFloat|Number\(|toFixed|Date\.now\(|new Date\(\)/);
  });
  it("forklaringen lagres ikke: ingen skriving i serverlagene som bygger visningen", () => {
    const s = readFileSync("src/server/economics-view.ts", "utf8");
    expect(s).not.toMatch(/\.insert\(|\.upsert\(|\.update\(|writeFile|localStorage/);
  });
});

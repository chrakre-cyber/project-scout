/**
 * ECON-004 — landed-cost-kjernen. Forventede tall er uavhengig håndregnet/kontrollert (Python Decimal) eller hentet fra ECON-003-fixturene; ingen
 * forventning er justert for å passe koden. Fixture-kurs brukes bare med `allowFixtureFxQuotes` (test). Ingen regel her er godkjent produksjonsregel.
 */
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { calculateEconomics, REGISTRY_ECONOMICS_PROFILE, UNCONFIRMED_HALF_UP, type EconomicsConfig, type EconomicsInput, type EconomicsProfile, type FxQuote } from "@/domain/economics";
import { ECON_CASES, FIXTURE_FX, FX_ROLES_SCENARIO, MEROVO_DEFAULT_EXPECTED } from "./fixtures/econ-golden";
import { NO_OTA_2026_A_PB, type TaxInput } from "@/domain/tax";

const fxq = (rate: string, over: Partial<FxQuote> = {}): FxQuote => ({ pair: "EUR/NOK", rate, source: { kind: "fixture" }, effectiveAt: null, quotedAt: null, fixtureOnly: true, ...over });
const cfg = (over: Partial<EconomicsConfig> = {}): EconomicsConfig => ({ rounding: UNCONFIRMED_HALF_UP, allowFixtureFxQuotes: true, ...over });
const EXCL = { state: "excluded_by_scenario", reason: "fixture" } as const;
const zeroIns = { amount: "0", basis: "scenario_assumption" } as const;
const fixtureInput = (i: number, over: Partial<EconomicsInput> = {}): EconomicsInput => ({
  price: { currency: "EUR", advertisedNet: String(ECON_CASES[i]!.advertisedNetPriceEur), priceBasis: "net", use: "advertised", evidence: "listing_claim" },
  fx: { acquisition: fxq(FIXTURE_FX.rate), customs: fxq(FIXTURE_FX.rate) },
  transport: { amount: "8000", basis: "dealer_entered" }, insurance: zeroIns,
  taxInput: ECON_CASES[i]!.golden.input,
  deduction: { value: "non_recoverable", source: { kind: "dealer_entered" } },
  evExemption: i === 1 ? "applies" : "not_applicable",
  charges: { climateGas: EXCL, registrationFee: EXCL, customsDuty: EXCL },
  asOf: "2026-10-18",
  ...over,
});
/** NOK-pris + diesel-avgiften fra CASE-003: isolerer mva./avrunding fra kursomregning. */
const nokInput = (price: string, over: Partial<EconomicsInput> = {}): EconomicsInput => ({
  ...fixtureInput(2), price: { currency: "NOK", advertisedNet: price, priceBasis: "net", use: "advertised", evidence: "dealer_entered" }, fx: {}, ...over,
});
const val = (t: { kind: string; valueNok?: bigint | null }) => (t.kind === "value" ? t.valueNok : undefined);

describe("regresjon mot ECON-003 (fixtureforutsetninger, aldri validert)", () => {
  const ids = ["CASE-001", "CASE-002", "CASE-003"] as const;
  it.each([0, 1, 2])("B-standard (transport 8 000, begge kurser = fixturekurs) reproduserer ECON-001 §7.B — case %i", (i) => {
    const e = MEROVO_DEFAULT_EXPECTED[ids[i]!];
    for (const [state, landed] of [["recoverable", e.landedRecoverableNok], ["non_recoverable", e.landedNonRecoverableNok]] as const) {
      const r = calculateEconomics(fixtureInput(i, { transport: undefined, deduction: { value: state, source: { kind: "dealer_entered" } } }), cfg({ transportDefaultNok: "8000" }));
      expect(r.customsValueNok).toBe(BigInt(e.customsValueNok));
      expect(r.importVat.valueNok).toBe(BigInt(e.importVatNok));
      expect(r.tax.totalRegistrationTaxesNok).toBe(BigInt(e.totalRegistrationTaxesNok));
      expect(val(r.importCashRequirement)).toBe(BigInt(e.importCashRequirementNok));
      expect(val(r.estimatedLandedCost)).toBe(BigInt(landed));
      expect(r.status).toBe("estimate");
      expect(r.estimateReasons).toEqual(expect.arrayContaining(["transport_default_assumed", "tax_estimate", "vat_rules_unapproved", "rounding_unconfirmed", "amount_scenario_assumption", "charges_excluded_by_scenario"]));
    }
  });
  it("kursroller: tollkursen styrer mva./kontant, anskaffelseskursen styrer kjøpesummen; recoverable påvirkes ikke av tollkursen", () => {
    const x = FX_ROLES_SCENARIO.expected;
    const mk = (state: "recoverable" | "non_recoverable") =>
      calculateEconomics(fixtureInput(2, { fx: { acquisition: fxq(FX_ROLES_SCENARIO.acquisitionFxRate), customs: fxq(FX_ROLES_SCENARIO.customsFxRate) }, deduction: { value: state, source: { kind: "dealer_entered" } } }), cfg());
    const nr = mk("non_recoverable");
    expect(nr.acquisition.acquisitionUsedNok).toBe(BigInt(x.acquisitionUsedNok));
    expect(nr.customsValueNok).toBe(BigInt(x.customsValueNok));
    expect(nr.importVat.valueNok).toBe(BigInt(x.importVatNok));
    expect(val(nr.importCashRequirement)).toBe(BigInt(x.importCashRequirementNok));
    expect(val(nr.estimatedLandedCost)).toBe(BigInt(x.landedNonRecoverableNok));
    expect(val(mk("recoverable").estimatedLandedCost)).toBe(BigInt(x.landedRecoverableNok));
    expect(nr.fx.acquisition.rate).toBe("10.6709");
    expect(nr.fx.customs.rate).toBe("10.7");
  });
  it("A-reproduksjon: transport 0 gir kjøpesum, mva. og total fra ECON-001 §7 (CASE-003: 411 491 / 102 873 / 848 087)", () => {
    const r = calculateEconomics(fixtureInput(2, { transport: { amount: "0", basis: "dealer_entered" } }), cfg());
    expect(r.acquisition.acquisitionUsedNok).toBe(411491n);
    expect(r.importVat.valueNok).toBe(102873n);
    expect(val(r.importCashRequirement)).toBe(848087n - 0n);
  });
});

describe("kontantbehov vs økonomisk kost; ukjent fradrag", () => {
  it("unknown (standard): ingen enkeltstående landed cost; to merkede scenarioer; kontantbehov uavhengig av fradrag", () => {
    const r = calculateEconomics(fixtureInput(2, { deduction: undefined }), cfg());
    expect(r.vatRecoverability).toMatchObject({ value: "unknown", accepted: false });
    expect(r.estimatedLandedCost).toMatchObject({ kind: "scenarios", valueNok: null });
    const ids = (r.estimatedLandedCost as { scenarios: Array<{ id: string; valueNok: bigint }> }).scenarios;
    expect(ids.map((s) => [s.id, s.valueNok])).toEqual([["if_recoverable", 753214n], ["if_non_recoverable", 858087n]]);
    expect(val(r.importCashRequirement)).toBe(858087n);
    expect(r.status).toBe("incomplete");
    expect(r.incompleteReasons).toContain("unresolved_vat_recoverability");
  });
  it("annonsetekst eller antakelse som fradragskilde ignoreres (ingen fradragsrett utledes)", () => {
    for (const kind of ["listing_claim", "assumed"] as const) {
      const r = calculateEconomics(fixtureInput(2, { deduction: { value: "recoverable", source: { kind } } }), cfg());
      expect(r.vatRecoverability.accepted).toBe(false);
      expect(r.estimatedLandedCost.kind).toBe("scenarios");
      expect(r.warnings.join(" ")).toContain("godtas ikke");
    }
  });
  it("dealer_profile godtas uten dealer_stated-årsak; uttrykkelig unknown-verdi forblir ukjent", () => {
    const r = calculateEconomics(fixtureInput(2, { deduction: { value: "recoverable", source: { kind: "dealer_profile" } } }), cfg());
    expect(r.estimateReasons).not.toContain("deduction_status_dealer_stated");
    expect(r.estimateReasons).toContain("deduction_rule_unapproved");
    expect(calculateEconomics(fixtureInput(2, { deduction: { value: "unknown", source: { kind: "dealer_entered" } } }), cfg()).estimatedLandedCost.kind).toBe("scenarios");
  });
});

describe("transport og forsikring: én gang, bare i kostnadssum og avgiftsgrunnlag med merking", () => {
  it("transport 0 / 8 000 / 12 345: kontantbehov øker med transport + 25 % mva. (avrundet), ikke mer", () => {
    const base = calculateEconomics(nokInput("100000", { transport: { amount: "0", basis: "dealer_entered" } }), cfg());
    expect(val(base.importCashRequirement)).toBe(100000n + 25000n + 333723n);
    const t = calculateEconomics(nokInput("100000", { transport: { amount: "12345", basis: "quoted" } }), cfg());
    // mva. 25 % × 112 345 = 28 086,25 → 28 086
    expect(t.importVat.valueNok).toBe(28086n);
    expect(val(t.importCashRequirement)).toBe(100000n + 12345n + 28086n + 333723n);
    expect(val(t.estimatedLandedCost)).toBe(100000n + 12345n + 28086n + 333723n);
  });
  it("transport uten oppgave og uten produktstandard ⇒ ufullstendig nedre grense, aldri 0", () => {
    const r = calculateEconomics(nokInput("100000", { transport: undefined }), cfg());
    expect(r.transportNok).toBeNull();
    expect(r.importCashRequirement.kind).toBe("lower_bound");
    expect(r.status).toBe("incomplete");
  });
  it("transport = \"unknown\" overstyrer produktstandard; produktstandard er merket assumed_default", () => {
    expect(calculateEconomics(nokInput("100000", { transport: "unknown" }), cfg({ transportDefaultNok: "8000" })).importCashRequirement.kind).toBe("lower_bound");
    const d = calculateEconomics(nokInput("100000", { transport: undefined }), cfg({ transportDefaultNok: "8000" }));
    expect(d.transportBasis).toBe("assumed_default");
    expect(d.estimateReasons).toContain("transport_default_assumed");
  });
  it("ukjent forsikring (standard) gir nedre grense for mva. og totaler; 0 kun som uttrykkelig scenarioantakelse", () => {
    const r = calculateEconomics(nokInput("100000", { insurance: undefined }), cfg());
    expect(r.insuranceNok).toBeNull();
    expect(r.customsValueNok).toBeNull();
    expect(r.importVat.status).toBe("lower_bound");
    expect(r.importCashRequirement).toMatchObject({ kind: "lower_bound", lowerBoundNok: 100000n + 8000n + 27000n + 333723n });
    expect(r.incompleteReasons).toContain("insurance_unknown");
    const ins = calculateEconomics(nokInput("100000", { insurance: { amount: "1000", basis: "quoted" } }), cfg());
    expect(ins.customsValueNok).toBe(109000n);
    expect(ins.importVat.valueNok).toBe(27250n);
    expect(val(ins.importCashRequirement)).toBe(100000n + 8000n + 1000n + 27250n + 333723n);
  });
});

describe("kjøpsgrunnlag og ugyldig input", () => {
  it("gross-only/unknown gir ufullstendig uten kjøpesum; netto antas aldri fra bruttoannonse", () => {
    for (const basis of ["gross", "unknown"] as const) {
      const r = calculateEconomics(fixtureInput(2, { price: { currency: "EUR", advertisedGross: "48000", priceBasis: basis, use: "advertised", evidence: "listing_claim" } }), cfg());
      expect(r.acquisition.purchaseBasisResolved).toBe(false);
      expect(r.acquisition.acquisitionUsedNok).toBeNull();
      expect(r.acquisition.advertisedGross).toBe("48000");
      expect(r.importCashRequirement.kind).toBe("lower_bound");
      expect(r.status).toBe("incomplete");
    }
  });
  it("annonsert, forhandlerjustert og brukt holdes adskilt; dealer_adjusted krever beløp", () => {
    const p = { currency: "EUR", advertisedNet: "40000", advertisedGross: "50000", dealerAdjusted: "38562", priceBasis: "net", use: "dealer_adjusted", evidence: "quote_document" } as const;
    const r = calculateEconomics(fixtureInput(2, { price: p }), cfg());
    expect(r.acquisition).toMatchObject({ advertisedNet: "40000", advertisedGross: "50000", dealerAdjusted: "38562", used: { amount: "38562", selected: "dealer_adjusted", basis: "dealer_adjusted" } });
    expect(r.acquisition.acquisitionUsedNok).toBe(411491n);
    expect(r.estimateReasons).not.toContain("purchase_price_listing_claim");
    const miss = calculateEconomics(fixtureInput(2, { price: { ...p, dealerAdjusted: null } }), cfg());
    expect(miss.status).toBe("blocked");
    expect(miss.blockers[0]!.code).toBe("dealer_adjusted_missing");
  });
  it.each([["-1"], ["0"], ["abc"], ["1e5"], ["1,5"], [" 5"], ["+5"], [""], ["1000000001"], ["123456789012345678"]])("ugyldig/ekstremt prisbeløp «%s» ⇒ blokkert uten totaler", (v) => {
    const r = calculateEconomics(nokInput(v), cfg());
    expect(r.status).toBe("blocked");
    expect(r.importCashRequirement.kind).toBe("not_calculated");
    expect(r.estimatedLandedCost.kind).toBe("not_calculated");
  });
  it("ugyldig valuta, dato, transportbeløp, tall (NaN/Infinity/number) og charges blokkerer", () => {
    expect(calculateEconomics(fixtureInput(2, { price: { currency: "eur", advertisedNet: "1", priceBasis: "net", use: "advertised", evidence: "dealer_entered" } }), cfg()).blockers[0]!.code).toBe("invalid_currency");
    expect(calculateEconomics(nokInput("1000", { asOf: "2026-02-30" }), cfg()).blockers.map((b) => b.code)).toContain("invalid_date");
    expect(calculateEconomics(nokInput("1000", { transport: { amount: "-5", basis: "quoted" } }), cfg()).status).toBe("blocked");
    expect(calculateEconomics(nokInput("1000", { transport: { amount: Number.NaN as unknown as string, basis: "quoted" } }), cfg()).status).toBe("blocked");
    expect(calculateEconomics(nokInput("1000", { transport: { amount: 5 as unknown as string, basis: "quoted" } }), cfg()).status).toBe("blocked");
    expect(calculateEconomics(nokInput("1000", { transport: { amount: "5", basis: "guess" as never } }), cfg()).status).toBe("blocked");
    expect(calculateEconomics(nokInput("1000", { charges: { otherKnown: [{ label: "x", amount: "-1", basis: "quoted" }] } }), cfg()).status).toBe("blocked");
    expect(calculateEconomics(nokInput("1000", { transport: { amount: "1000000001", basis: "quoted" } }), cfg()).blockers[0]!.code).toBe("amount_out_of_range");
  });
  it("beløp ved grensen (1 000 000 000) regnes eksakt uten tap", () => {
    const r = calculateEconomics(nokInput("1000000000", { transport: { amount: "0", basis: "quoted" } }), cfg());
    expect(r.importVat.valueNok).toBe(250000000n);
    expect(r.acquisition.acquisitionUsedNok).toBe(1000000000n);
  });
});

describe("kursroller og proveniens", () => {
  it("fixturekurs avvises uten testflagg (ingen fixture-kurs som produksjonsstandard)", () => {
    const r = calculateEconomics(fixtureInput(2), { rounding: UNCONFIRMED_HALF_UP });
    expect(r.status).toBe("blocked");
    expect(r.blockers.map((b) => b.code)).toEqual(["invalid_fx_quote", "invalid_fx_quote"]);
  });
  it("manglende tollkurs er aldri stilltiende lik anskaffelseskurs: ufullstendig; uttrykkelig fallback ⇒ estimat med merking", () => {
    const noCustoms = calculateEconomics(fixtureInput(2, { fx: { acquisition: fxq("10.6709") } }), cfg());
    expect(noCustoms.status).toBe("incomplete");
    expect(noCustoms.incompleteReasons).toContain("customs_fx_missing");
    expect(noCustoms.fx.customs.status).toBe("not_calculated");
    expect(noCustoms.importVat.status).toBe("not_calculated");
    expect(noCustoms.acquisition.acquisitionUsedNok).toBe(411491n);
    const fb = calculateEconomics(fixtureInput(2, { fx: { acquisition: fxq("10.6709"), customsFallback: "use_acquisition_rate_assumed" } }), cfg());
    expect(fb.fx.customs.status).toBe("assumed_from_acquisition");
    expect(fb.estimateReasons).toContain("customs_fx_fallback_acquisition_rate");
    expect(fb.importVat.valueNok).toBe(104873n);
  });
  it("manglende anskaffelseskurs ⇒ ingen kjøpesum og ingen total; kurs med feil par, utløpt, fremtidig, ugyldig dato eller grense blokkeres", () => {
    expect(calculateEconomics(fixtureInput(2, { fx: { customs: fxq("10.6709") } }), cfg()).acquisition.acquisitionUsedNok).toBeNull();
    const bad = (q: FxQuote) => calculateEconomics(fixtureInput(2, { fx: { acquisition: q, customs: fxq("10.6709") } }), cfg()).blockers.map((b) => b.code);
    expect(bad(fxq("10.6709", { pair: "USD/NOK" }))).toEqual(["invalid_fx_quote"]);
    expect(bad(fxq("10.6709", { validUntil: "2026-10-17" }))).toEqual(["invalid_fx_quote"]);
    expect(bad(fxq("10.6709", { effectiveAt: "2026-10-19" }))).toEqual(["invalid_fx_quote"]);
    expect(bad(fxq("10.6709", { effectiveAt: "2026-13-01" }))).toEqual(["invalid_fx_quote"]);
    expect(bad(fxq("0"))).toEqual(["invalid_fx_quote"]);
    expect(bad(fxq("-1"))).toEqual(["invalid_fx_quote"]);
    expect(bad(fxq("1000001"))).toEqual(["invalid_fx_quote"]);
  });
  it("datoer og kilde følger rollene; manglende datoer gir estimatårsak; NOK trenger ingen kurs", () => {
    const q = (rate: string, kind: FxQuote["source"]["kind"]) => fxq(rate, { source: { kind, ref: "r" }, effectiveAt: "2026-10-01", quotedAt: "2026-10-17" });
    const r = calculateEconomics(fixtureInput(2, { fx: { acquisition: q("10.6709", "bank"), customs: q("10.7", "official_customs") } }), cfg());
    expect(r.fx.acquisition).toMatchObject({ status: "used", source: { kind: "bank" }, effectiveAt: "2026-10-01", quotedAt: "2026-10-17" });
    expect(r.fx.customs).toMatchObject({ source: { kind: "official_customs" }, rate: "10.7" });
    expect(r.estimateReasons).not.toContain("fx_dates_missing");
    expect(calculateEconomics(fixtureInput(2), cfg()).estimateReasons).toContain("fx_dates_missing");
    expect(calculateEconomics(nokInput("1000"), cfg()).fx.acquisition.status).toBe("not_needed");
  });
});

describe("elbilfritak (R-IMP-VAT-003, ubekreftet) og avrunding (U-013, ubekreftet)", () => {
  const ev = (price: string, evExemption: EconomicsInput["evExemption"]) =>
    calculateEconomics({ ...fixtureInput(1), price: { currency: "NOK", advertisedNet: price, priceBasis: "net", use: "advertised", evidence: "dealer_entered" }, fx: {}, transport: { amount: "0", basis: "quoted" }, evExemption }, cfg());
  it("kalkulatorobservasjon: 350 000 → 12 500; 300 000 → 0; 299 999 → 0", () => {
    expect(ev("350000", "applies").importVat.valueNok).toBe(12500n);
    expect(ev("300000", "applies").importVat.valueNok).toBe(0n);
    expect(ev("299999", "applies").importVat.valueNok).toBe(0n);
  });
  it("uten fritak: full 25 %; kontantbehov = pris + mva. + avgift (16 748)", () => {
    const r = ev("350000", "not_applicable");
    expect(r.importVat.valueNok).toBe(87500n);
    expect(val(r.importCashRequirement)).toBe(350000n + 87500n + 16748n);
    expect(ev("350000", "applies").estimateReasons).toContain("ev_exemption_assumed");
  });
  it("ukjent anvendelse (standard): to merkede mva.-/kontantscenarier, ingen enkeltverdi; cross-produkt med fradragsstatus", () => {
    const r = ev("350000", undefined);
    expect(r.importVat).toMatchObject({ status: "scenarios", valueNok: null, evExemption: "unknown" });
    expect(r.importVat.scenarios.map((s) => [s.id, s.valueNok])).toEqual([["no_exemption", 87500n], ["with_exemption", 12500n]]);
    expect(r.importCashRequirement).toMatchObject({ kind: "scenarios", valueNok: null });
    expect(r.status).toBe("incomplete");
    expect(r.incompleteReasons).toContain("ev_exemption_unresolved");
    const u = calculateEconomics({ ...fixtureInput(1), price: { currency: "NOK", advertisedNet: "350000", priceBasis: "net", use: "advertised", evidence: "dealer_entered" }, fx: {}, transport: { amount: "0", basis: "quoted" }, evExemption: undefined, deduction: undefined }, cfg());
    expect((u.estimatedLandedCost as { scenarios: unknown[] }).scenarios).toHaveLength(4);
  });
  it("fritak gjelder bare elbil; diesel/PHEV får ingen fritaksscenario selv om 'applies' oppgis", () => {
    const r = calculateEconomics(nokInput("350000", { evExemption: "applies", transport: { amount: "0", basis: "quoted" } }), cfg());
    expect(r.importVat).toMatchObject({ valueNok: 87500n, evExemption: "not_applicable_vehicle" });
  });
  it("avrundingsgrenser: 300 001 → 0,25 → 0; 300 003 → 0,75 → 1; 300 002 → 0,5 er LIKHET ⇒ nedre grense og uavklart (ikke stilltiende half-up)", () => {
    expect(ev("300001", "applies").importVat.valueNok).toBe(0n);
    expect(ev("300003", "applies").importVat.valueNok).toBe(1n);
    const t = ev("300002", "applies");
    expect(t.importVat.status).toBe("lower_bound");
    expect(t.importVat.valueNok).toBe(0n);
    expect(t.roundingTies[0]).toContain("1 (half_up) / 0 (half_even)");
    expect(t.importCashRequirement.kind).toBe("lower_bound");
    expect(t.incompleteReasons).toContain("rounding_tie_unresolved");
    expect(t.status).toBe("incomplete");
  });
  it("kjøpesum x,5 (tie) ved kursomregning: EUR 1 × 0.5 ⇒ likhet; x,4999 avrundes ned, x,5001 opp", () => {
    const mk = (rate: string) => calculateEconomics(fixtureInput(2, { price: { currency: "EUR", advertisedNet: "1000", priceBasis: "net", use: "advertised", evidence: "dealer_entered" }, fx: { acquisition: fxq(rate), customs: fxq("10") } }), cfg());
    expect(mk("10.4999").acquisition.acquisitionUsedNok).toBe(10500n); // 10 499,9
    expect(mk("10.4995").acquisition.acquisitionUsedNok).toBe(10500n); // 10 499,5 ⇒ likhet
    expect(mk("10.4995").importCashRequirement.kind).toBe("lower_bound");
    expect(mk("10.4994").acquisition.acquisitionUsedNok).toBe(10499n);
    expect(mk("10.4994").status).not.toBe("blocked");
  });
});

describe("videreføring av avgiftsmotorens usikkerhet; validated er uoppnåelig uten godkjenninger", () => {
  it("avgiftsestimat ⇒ estimatårsaker videreføres; aldri validated", () => {
    const r = calculateEconomics(fixtureInput(2), cfg());
    expect(r.tax).toMatchObject({ status: "estimate", engineStatus: "calculated_unverified", vehicleProfile: "PB-DIE" });
    expect(r.tax.estimateReasons.length).toBeGreaterThan(0);
    expect(r.estimateReasons).toContain("tax_estimate");
    expect(r.estimateReasons).not.toContain("tax_profile_not_approved"); // 2026-profilen er godkjent; usikkerheten ligger i inputen (udokumentert vekt)
    expect(r.status).not.toBe("validated");
  });
  it("ikke-godkjent avgiftsprofil videreføres som egen estimatårsak", () => {
    const unapproved = { ...NO_OTA_2026_A_PB, approval: { ...NO_OTA_2026_A_PB.approval, approved: false } };
    const r = calculateEconomics(fixtureInput(2), cfg({ taxProfile: unapproved }));
    expect(r.estimateReasons).toContain("tax_profile_not_approved");
    expect(r.tax.status).toBe("estimate");
  });
  it("blokkert avgiftsgrunnlag (bensin / ikke støttet) ⇒ ingen avgift i summen: nedre grense, ufullstendig", () => {
    const petrol: TaxInput = { ...ECON_CASES[2]!.golden.input, propulsion: { ...ECON_CASES[2]!.golden.input.propulsion, combustionFuel: "petrol" } };
    const r = calculateEconomics(fixtureInput(2, { taxInput: petrol }), cfg());
    expect(r.tax.status).toBe("blocked");
    expect(r.tax.totalRegistrationTaxesNok).toBeNull();
    expect(r.tax.blockers).toContain("vehicle_profile_unsupported");
    expect(r.importCashRequirement).toMatchObject({ kind: "lower_bound" });
    expect((r.importCashRequirement as { missing: string[] }).missing).toContain("total_registration_taxes");
    expect(r.status).toBe("incomplete");
    expect(r.incompleteReasons).toContain("tax_blocked");
  });
  it("ukjente øvrige avgifter/gebyrer (standard) ⇒ nedre grense; klimagass, tollavgift o.l. er aldri antatt 0", () => {
    const r = calculateEconomics(fixtureInput(2, { charges: undefined }), cfg());
    expect(r.importCashRequirement.kind).toBe("lower_bound");
    expect((r.importCashRequirement as { missing: string[] }).missing).toEqual(expect.arrayContaining(["charges.climateGas", "charges.registrationFee", "charges.customsDuty"]));
    expect(r.status).toBe("incomplete");
  });
  it("kjente øvrige kostnader legges til én gang; tollavgift > 0 er uavklart mot mva.-grunnlaget", () => {
    const r = calculateEconomics(fixtureInput(2, { charges: { climateGas: EXCL, registrationFee: { amount: "1000", basis: "quoted" }, customsDuty: EXCL, otherKnown: [{ label: "x", amount: "500", basis: "dealer_entered" }] } }), cfg());
    expect(val(r.importCashRequirement)).toBe(858087n - 8000n + 8000n + 1500n);
    const d = calculateEconomics(fixtureInput(2, { charges: { climateGas: EXCL, registrationFee: EXCL, customsDuty: { amount: "2000", basis: "quoted" } } }), cfg());
    expect(d.incompleteReasons).toContain("customs_duty_vat_base_unresolved");
  });
  it("med alle godkjenningsflagg satt og ellers ren input kan statusen bli validated — men aldri med dagens register", () => {
    expect(REGISTRY_ECONOMICS_PROFILE).toEqual({ vatRulesApproved: false, roundingApproved: false, customsFxRuleApproved: false, deductionRuleApproved: false });
    const all: EconomicsProfile = { vatRulesApproved: true, roundingApproved: true, customsFxRuleApproved: true, deductionRuleApproved: true };
    const clean = fixtureInput(2, { price: { currency: "NOK", advertisedNet: "100000", priceBasis: "net", use: "advertised", evidence: "dealer_entered" }, fx: {}, deduction: { value: "non_recoverable", source: { kind: "dealer_profile" } }, charges: { climateGas: { state: "not_applicable", basis: "x" }, registrationFee: { amount: "0", basis: "quoted" }, customsDuty: { state: "not_applicable", basis: "x" } } });
    // avgiftsmotoren gir fortsatt estimat (udokumentert vekt) ⇒ selv med alle økonomiflagg er resultatet ikke validert
    const r = calculateEconomics(clean, cfg({ profile: all, rounding: { mode: "half_up", status: "approved" } }));
    expect(r.status).toBe("estimate");
    expect(r.estimateReasons).toContain("tax_estimate");
    expect(calculateEconomics(clean, cfg()).status).toBe("estimate");
  });
});

describe("determinisme og arkitektur", () => {
  it("samme input gir identisk resultat og input muteres ikke", () => {
    const i = fixtureInput(2);
    const snapshot = JSON.stringify(i);
    const a = calculateEconomics(i, cfg());
    const b = calculateEconomics(i, cfg());
    expect(JSON.stringify(a, (_k, v) => (typeof v === "bigint" ? v.toString() : v))).toBe(JSON.stringify(b, (_k, v) => (typeof v === "bigint" ? v.toString() : v)));
    expect(JSON.stringify(i)).toBe(snapshot);
  });
  it("kjernen bruker ikke float-aritmetikk eller UI/DB/provider/server-importer", () => {
    const dir = "src/domain/economics";
    for (const f of readdirSync(dir)) {
      const src = readFileSync(`${dir}/${f}`, "utf8");
      expect(src, f).not.toMatch(/Math\.(round|floor|ceil|trunc)|parseFloat|Number\(|toFixed|\bNumber\.parse/);
      expect(src, f).not.toMatch(/from "(?!@\/domain\/tax"|\.\/|node:)[^"]+"/);
    }
  });
});

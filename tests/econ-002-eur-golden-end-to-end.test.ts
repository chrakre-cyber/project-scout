/**
 * ECON-002 (revalidering 2026-10-23) — de tre EUR-referansecasene gjennom PRODUKSJONSMOTORENE (`calculateNorwegianVehicleTax` + `calculateEconomics`),
 * ikke testorakelet i `fixtures/econ-arithmetic.ts`. Transport 0 og ingen Merovo-standarder, slik at resultatet er sammenlignbart med de oppgitte
 * Skatteetaten-tallene (Avgift / Innkjøp / MVA / Sum).
 *
 * Forventede mellomverdier er håndregnet fra satstabellene (docs/tax/rules.json, profil NO-OTA-2026-A-PB) og EUR × 10,6709 — IKKE kopiert fra motorens output.
 * Kjøredato er alltid eksplisitt (aldri systemklokke). 10,6709 er et FIXTURE-INPUT (ikke offisiell kurs); de oppgitte sluttallene er `stated_not_documented`
 * (ingen skjermbilder for EUR-casene; tax-delen har klasse 1-belegg for NOK-kjøringene 18.10.2026, se reviews/ECON-002.md §31).
 */
import { describe, expect, it } from "vitest";
import { calculateEconomics, UNCONFIRMED_HALF_UP, type EconomicsInput, type FxQuote } from "@/domain/economics";
import { calculateNorwegianVehicleTax, NO_OTA_2026_A_PB, type TaxInput } from "@/domain/tax";
import { ECON_CASES, FIXTURE_FX } from "./fixtures/econ-golden";

const ALL_TRUE = { batteryOnlyPropulsion: true, externallyChargeableBattery: true, passengerVehicle: true, notPreviouslyRegisteredInNorway: true } as const;
const FV = { treatment: "excluded_documented", evidence: "invoice_or_contract" } as const;
const EXCL = { state: "excluded_by_scenario", reason: "ECON-002 referanse: Skatteetatens kalkulator har ingen slik post" } as const;
const REG_DATE = "2026-10-18"; // norsk registreringsdato brukt i kalkulatorreferansene (brukerbekreftet, docs/tax/golden-runs/2026-10-18/REGISTRERING.md)

/** Normaliserte første-registreringsdatoer fra oppdraget (dag-presisjon; kilden oppgir bare måned). */
const FIRST_REG = ["2026-09-01", "2023-08-01", "2023-11-01"] as const;
/** Bruttopris fra annonsene (utenlandsk mva. inkludert). Brukes bare til å vise at motoren ikke utleder netto fra brutto. */
const GROSS_EUR = ["299900", "40890", "45889"] as const;

const fx = (rate: string, over: Partial<FxQuote> = {}): FxQuote => ({ pair: "EUR/NOK", rate, source: { kind: "fixture" }, effectiveAt: null, quotedAt: null, fixtureOnly: true, validFrom: "2026-10-15", validTo: "2026-11-11", ...over });
const taxInputOf = (i: number, over: Partial<TaxInput> = {}): TaxInput => ({ ...ECON_CASES[i]!.golden.input, firstRegistration: { precision: "day", value: FIRST_REG[i]! }, norwegianRegistration: { date: REG_DATE, kind: "expected" }, ...over });
const inputOf = (i: number, over: Partial<EconomicsInput> = {}): EconomicsInput => ({
  price: { currency: "EUR", advertisedNet: String(ECON_CASES[i]!.advertisedNetPriceEur), advertisedGross: GROSS_EUR[i]!, priceBasis: "net", use: "advertised", evidence: "listing_claim", foreignVat: FV },
  fx: { acquisition: fx(FIXTURE_FX.rate), customs: fx(FIXTURE_FX.rate) },
  transportToBorder: { amount: "0", basis: "dealer_entered" }, insurance: { amount: "0", basis: "scenario_assumption" }, transportAfterBorder: EXCL, loadingHandling: EXCL,
  customsDate: { date: "2026-10-20", kind: "expected_scenario" },
  taxInput: taxInputOf(i),
  deduction: { value: "non_recoverable", source: { kind: "dealer_entered" } },
  vatHandling: { value: "registered_reports_in_vat_return", source: { kind: "dealer_entered" } },
  evQualification: i === 1 ? ALL_TRUE : { ...ALL_TRUE, batteryOnlyPropulsion: false }, evThresholdBasis: i === 1 ? "customs_value" : undefined,
  charges: { climateGas: EXCL, registrationFee: EXCL, customsDuty: EXCL },
  asOf: REG_DATE,
  ...over,
});
const run = (i: number, over: Partial<EconomicsInput> = {}) => calculateEconomics(inputOf(i, over), { rounding: UNCONFIRMED_HALF_UP, allowFixtureFxQuotes: true });
const taxOf = (i: number, over: Partial<TaxInput> = {}) => calculateNorwegianVehicleTax(taxInputOf(i, over));
const kr = (t: { kind: string; valueNok?: bigint | null }) => (t.kind === "value" ? t.valueNok : undefined);

/**
 * Håndregnet forklaring per case (NOK; desimaler som strenger der avgiften ikke er avrundet).
 *  CASE-001: (2610−500)×12,71 = 26 818,10; (2610−1200)×260 = 366 600; CO₂ 140 g/km = 100×800 + 40×1600 = 144 000; sum 537 418,10; bruksfradrag 2 % (1 mnd) → ×0,98 = 526 669,738; + vrakpant 2 400 = 529 069,738 → 529 069.
 *  CASE-002: (2185−500)×12,71 = 21 416,35; ingen CO₂-/forbrenningskomponent (BEV); bruksfradrag 33 % (38 mnd) → ×0,67 = 14 348,9545; + 2 400 = 16 748,9545 → 16 748.
 *  CASE-003: (1976−500)×12,71 = 18 759,96; (1976−1200)×260 = 201 760; CO₂ 179 g/km = 100×800 + 50×1600 + 29×3200 = 252 800; sum 473 319,96; bruksfradrag 30 % (35 mnd) → ×0,70 = 331 323,972; + 2 400 = 333 723,972 → 333 723.
 *  Kjøp: 252 017 × 10,6709 = 2 689 248,2053; 34 361 × 10,6709 = 366 662,7949; 38 562 × 10,6709 = 411 491,2458.
 *  MVA (25 %): 672 312,00; (366 663 − 300 000) × 25 % = 16 665,75; 102 872,75.
 */
const EXPECT = [
  { id: "CASE-001", profile: "PB-PHEV", components: { general_weight: "26818.1", combustion_weight: "366600", co2: "144000" }, pre: "537418.1", pct: 2, months: 1, oneOff: "526669.738", total: "529069.738", avgift: 529069n, purchaseRaw: "2689248.2053", purchase: 2689248n, vat: 672312n, vatRaw: "672312.0000", sum: 3890629n },
  { id: "CASE-002", profile: "PB-BEV", components: { general_weight: "21416.35" }, pre: "21416.35", pct: 33, months: 38, oneOff: "14348.9545", total: "16748.9545", avgift: 16748n, purchaseRaw: "366662.7949", purchase: 366663n, vat: 16666n, vatRaw: "16665.7500", sum: 400077n },
  { id: "CASE-003", profile: "PB-DIE", components: { general_weight: "18759.96", combustion_weight: "201760", co2: "252800" }, pre: "473319.96", pct: 30, months: 35, oneOff: "331323.972", total: "333723.972", avgift: 333723n, purchaseRaw: "411491.2458", purchase: 411491n, vat: 102873n, vatRaw: "102872.7500", sum: 848087n },
] as const;

describe.each([0, 1, 2])("EUR-referansecase %i gjennom produksjonsmotorene (transport 0)", (i) => {
  const e = EXPECT[i]!;

  it("avgiftsmotoren: komponenter, bruksfradrag, vrakpant og sluttavrunding forklarer Avgift-tallet", () => {
    const t = taxOf(i);
    expect(ECON_CASES[i]!.id).toBe(e.id);
    expect(t.status).toBe("calculated_unverified"); // vekten er forhandleroppgitt/«temporary reference» ⇒ aldri approved
    expect(t.profile).toMatchObject({ id: "NO-OTA-2026-A-PB", validFrom: "2026-01-01", approved: true });
    expect(t.validation).toMatchObject({ status: "estimate_not_approved", vehicleProfile: e.profile, inputResolution: "estimate", estimateReasons: ["weight_dealer_entered_undocumented"] });
    expect(Object.fromEntries(t.components.map((c) => [c.id, c.amountExact]))).toEqual(e.components);
    expect(t.preDeductionExact).toBe(e.pre);
    expect(t.ageDeduction).toMatchObject({ percent: e.pct, ageCompletedMonths: e.months, workingFirstRegistration: FIRST_REG[i], workingDateDerived: false, norwegianRegistrationDate: REG_DATE, twentyYearRule: false });
    expect(t.scrappageDeposit).toMatchObject({ amountNok: 2400, reducedByAgeDeduction: false }); // vrakpant reduseres ikke av bruksfradrag
    expect(t.oneOffTaxExact).toBe(e.oneOff);
    expect(t.totalRegistrationTaxesExact).toBe(e.total);
    expect(t.finalClaim).toMatchObject({ ruleRef: "R-OTA-014", oneOffTaxNok: Number(e.avgift) - 2400, scrappageDepositNok: 2400, totalRegistrationTaxesNok: Number(e.avgift) });
    expect(t.monthSensitivity).toBeNull(); // dag-presisjon ⇒ ingen månedsfølsomhet
  });

  it("landed-cost-kjernen: EUR netto × anskaffelseskurs → kjøp; tollverdi → MVA-grunnlag → MVA; Avgift; Sum — alle trinn inspiserbare", () => {
    const r = run(i);
    expect(r.status).toBe("estimate"); // aldri validated: fixturekurs, mva./avrundingsregler ikke godkjent (registerprofil)
    expect(r.blockers).toEqual([]);
    expect(r.acquisition).toMatchObject({ purchaseBasisResolved: true, acquisitionUsedRaw: e.purchaseRaw, acquisitionUsedNok: e.purchase });
    expect(r.acquisition.used).toMatchObject({ currency: "EUR", amount: String(ECON_CASES[i]!.advertisedNetPriceEur), basis: "net_claimed", evidence: "listing_claim" });
    expect(r.fx.acquisition).toMatchObject({ status: "used", rate: "10.6709", pair: "EUR/NOK" });
    expect(r.fx.customs).toMatchObject({ status: "used", rate: "10.6709", pair: "EUR/NOK" });
    expect(r.transportToBorderNok).toBe(0n);
    expect(r.customsValueNok).toBe(e.purchase);
    expect(r.importVatBaseNok).toBe(e.purchase); // engangsavgiften er ikke del av innførselsgrunnlaget (mval. § 4-11); tollavgift 0 er eksplisitt scenariovalg
    expect(r.importVat.valueNok).toBe(e.vat);
    expect(r.importVat.scenarios.map((s) => s.raw)).toEqual([e.vatRaw]);
    expect(r.tax).toMatchObject({ status: "estimate", vehicleProfile: e.profile, totalRegistrationTaxesNok: e.avgift, scrappageDepositNok: 2400n });
    expect(kr(r.importCashRequirement)).toBe(e.sum);
    expect(e.purchase + e.avgift + e.vat).toBe(e.sum); // identitet: Innkjøp + Avgift + MVA = Sum
    expect(r.roundingTies).toEqual([]);
    expect(r.estimateReasons).toEqual(expect.arrayContaining(["tax_estimate", "vat_rules_unapproved", "rounding_unconfirmed", "customs_fx_rule_unconfirmed", "purchase_price_listing_claim"]));
  });

  it("brutto annonsepris brukes aldri som kjøpsgrunnlag og netto utledes aldri fra brutto", () => {
    const grossOnly = run(i, { price: { currency: "EUR", advertisedGross: GROSS_EUR[i]!, advertisedNet: null, priceBasis: "gross", use: "advertised", evidence: "listing_claim", foreignVat: FV } });
    expect(grossOnly.acquisition.purchaseBasisResolved).toBe(false);
    expect(grossOnly.acquisition.acquisitionUsedNok).toBeNull();
    expect(grossOnly.importCashRequirement.kind).not.toBe("value");
    expect(grossOnly.customsValueNok).toBeNull();
    // datasjekk (ikke motorlogikk): oppgitt netto er brutto/1,19 avrundet — motoren gjør ikke denne utledningen selv
    expect(Math.round(Number(GROSS_EUR[i]) / 1.19)).toBe(ECON_CASES[i]!.advertisedNetPriceEur);
  });
});

describe("anskaffelseskurs og tollkurs er adskilte roller", () => {
  it("CASE-001 med tollkurs 10,6000 (syntetisk): kjøp følger anskaffelseskursen, tollverdi/MVA følger tollkursen; avgiften er upåvirket", () => {
    // 252 017 × 10,6 = 2 671 380,2 → 2 671 380; MVA 25 % = 667 845,00 (ingen likhet); Sum = 2 689 248 + 529 069 + 667 845
    const r = run(0, { fx: { acquisition: fx("10.6709"), customs: fx("10.6000") } });
    expect(r.acquisition.acquisitionUsedNok).toBe(2689248n);
    expect(r.customsValueNok).toBe(2671380n);
    expect(r.importVat.valueNok).toBe(667845n);
    expect(r.tax.totalRegistrationTaxesNok).toBe(529069n);
    expect(kr(r.importCashRequirement)).toBe(3886162n);
    expect(r.fx.acquisition.rate).toBe("10.6709");
    expect(r.fx.customs.rate).toBe("10.6");
  });

  it("manglende tollkurs brukes aldri stilltiende som anskaffelseskurs: standard = ikke beregnet; uttrykkelig fallback = antatt og nedgradert", () => {
    const none = run(2, { fx: { acquisition: fx("10.6709") } });
    expect(none.fx.customs.status).toBe("not_calculated");
    expect(none.customsValueNok).toBeNull();
    expect(none.importVat.status).toBe("not_calculated");
    expect(none.importCashRequirement.kind).not.toBe("value");
    const assumed = run(2, { fx: { acquisition: fx("10.6709"), customsFallback: "use_acquisition_rate_assumed" } });
    expect(assumed.fx.customs.status).toBe("assumed_from_acquisition");
    expect(assumed.estimateReasons).toContain("customs_fx_fallback_acquisition_rate");
    expect(assumed.importVat.valueNok).toBe(102873n);
  });
});

describe("ukjent forblir ukjent; ugyldig profil/dato feiler trygt", () => {
  it("manglende CO₂ (CASE-003) gir ingen avgift og ingen sum — ikke 0", () => {
    const t = taxOf(2, { co2: { gramsPerKm: null, method: "wltp_combined" } });
    expect(t.status).toBe("blocked");
    expect(t.blocked.map((b) => b.code)).toContain("co2_missing");
    expect(t.finalClaim).toBeNull();
    expect(t.totalRegistrationTaxesExact).toBeNull();
    const r = run(2, { taxInput: taxInputOf(2, { co2: { gramsPerKm: null, method: "wltp_combined" } }) });
    expect(r.tax.status).toBe("blocked");
    expect(r.tax.totalRegistrationTaxesNok).toBeNull();
    expect(r.importCashRequirement.kind).not.toBe("value");
  });

  it("manglende vekt (CASE-001) gir ingen avgift — vekt 0 er ikke en standard", () => {
    const t = taxOf(0, { norwegianTaxWeight: { kg: null, basis: "dealer_entered" } });
    expect(t.status).toBe("blocked");
    expect(t.blocked.map((b) => b.code)).toContain("tax_weight_missing");
    expect(t.finalClaim).toBeNull();
  });

  it("ukjent fradragsrett (standard) gir to merkede scenarier, ingen enkeltkost", () => {
    const r = run(1, { deduction: undefined });
    expect(r.vatRecoverability).toMatchObject({ value: "unknown", accepted: false });
    expect(r.estimatedLandedCost.kind).toBe("scenarios");
    expect(kr(r.importCashRequirement)).toBe(400077n); // brutto utlegg er uavhengig av fradragsrett
  });

  it.each([
    ["utløpt: registrering etter intern sperre 2026-12-31", "2027-01-01"],
    ["før profilens startdato 2026-01-01", "2025-12-31"],
  ])("avgiftsprofil %s blokkerer — ingen beløp", (_label, date) => {
    for (const i of [0, 1, 2]) {
      const t = taxOf(i, { norwegianRegistration: { date, kind: "expected" } });
      expect(t.status, `${ECON_CASES[i]!.id} ${date}`).toBe("blocked");
      expect(t.finalClaim).toBeNull();
      expect(t.blocked.map((b) => b.code).some((c) => ["profile_internal_limit_exceeded", "profile_not_valid_for_date", "no_profile_for_date", "norwegian_registration_before_first_registration"].includes(c))).toBe(true);
      const r = run(i, { taxInput: taxInputOf(i, { norwegianRegistration: { date, kind: "expected" } }) });
      expect(r.tax.status).toBe("blocked");
      expect(r.importCashRequirement.kind).not.toBe("value");
    }
    expect(NO_OTA_2026_A_PB.validFrom).toBe("2026-01-01");
    expect(NO_OTA_2026_A_PB.internalSafetyLimit.date).toBe("2026-12-31");
  });
});

describe("effektiv dato og kvantifiserte følsomheter (ingen skjult tilpasning)", () => {
  it("bruksfradraget er datostyrt: CASE-003 går fra 30 % (35 mnd) til 33 % (36 mnd) ved registrering 2026-11-01; Avgift 333 723 → 319 524 (−14 199)", () => {
    // 473 319,96 × 0,67 = 317 124,3732; + 2 400 = 319 524,3732 → 319 524
    const before = taxOf(2, { norwegianRegistration: { date: "2026-10-31", kind: "expected" } });
    const after = taxOf(2, { norwegianRegistration: { date: "2026-11-01", kind: "expected" } });
    expect(before.ageDeduction).toMatchObject({ percent: 30, ageCompletedMonths: 35 });
    expect(after.ageDeduction).toMatchObject({ percent: 33, ageCompletedMonths: 36 });
    expect(before.finalClaim?.totalRegistrationTaxesNok).toBe(333723);
    expect(after.finalClaim?.totalRegistrationTaxesNok).toBe(319524);
  });

  it("månedspresisjon gir samme sluttbeløp som normalisert dag 1 når fradragstrinnet ikke endres (CASE-001: 2026-09 vs 2026-09-01)", () => {
    const month = taxOf(0, { firstRegistration: { precision: "month", value: "2026-09" } });
    expect(month.finalClaim?.totalRegistrationTaxesNok).toBe(529069);
    expect(month.ageDeduction).toMatchObject({ workingFirstRegistration: "2026-09-01", workingDateDerived: true });
  });

  it("vektfølsomhet CASE-003: annonsevekt 2 015 kg i stedet for avgiftsvekt 1 976 kg gir +7 445 i Avgift — vektbasis er avgjørende, derfor estimat", () => {
    // (2015−500)×12,71 = 19 255,65; (2015−1200)×260 = 211 900; CO₂ 252 800; sum 483 955,65 × 0,70 = 338 768,955; + 2 400 = 341 168,955 → 341 168 (333 723 + 7 445)
    const t = taxOf(2, { norwegianTaxWeight: { kg: 2015, basis: "dealer_entered" } });
    expect(t.finalClaim?.totalRegistrationTaxesNok).toBe(341168);
    expect(341168 - 333723).toBe(7445);
    // marginalt: 39 kg × (12,71 + 260) × 0,70 = 7 444,98
    expect(Math.round(39 * (12.71 + 260) * 0.7 * 100) / 100).toBe(7444.98);
  });
});

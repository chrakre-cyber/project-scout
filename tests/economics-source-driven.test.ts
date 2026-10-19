/**
 * ECON-004 rettingsrunde etter kildepakken (T53–T69): mva-håndtering skilt fra fradragsrett, akseptdato og kursens gyldighetsperiode, råkurs/enhet,
 * transport før/etter innførselsstedet, elbilfritakets kvalifikasjon og målegrunnlag. Literaler er uavhengig regnet (Python Decimal). Ingen regel er godkjent:
 * økonomiflaggene er false i registeret, og tester med godkjent profil er syntetiske kontrolltilfeller.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { calculateEconomics, REGISTRY_ECONOMICS_PROFILE, UNCONFIRMED_HALF_UP, type EconomicsConfig, type EconomicsInput, type EconomicsProfile, type FxQuote } from "@/domain/economics";
import { ECON_CASES } from "./fixtures/econ-golden";

const na = { state: "not_applicable", basis: "test" } as const;
const zero = { amount: "0", basis: "quoted" } as const;
const ALL_TRUE = { batteryOnlyPropulsion: true, externallyChargeableBattery: true, passengerVehicle: true, notPreviouslyRegisteredInNorway: true } as const;
const DIESEL = ECON_CASES[2]!.golden.input; // CASE-003 testinput (avgift 333 723, estimat)
const BEV = ECON_CASES[1]!.golden.input; // CASE-002 testinput (avgift 16 748, estimat)
const cfg = (over: Partial<EconomicsConfig> = {}): EconomicsConfig => ({ rounding: UNCONFIRMED_HALF_UP, ...over });
const ALL_APPROVED: EconomicsProfile = { vatRulesApproved: true, roundingApproved: true, customsFxRuleApproved: true, deductionRuleApproved: true };
const approvedCfg = cfg({ profile: ALL_APPROVED, rounding: { mode: "half_up", status: "approved" } });
const bank = (rate: string, over: Partial<FxQuote> = {}): FxQuote => ({ pair: "EUR/NOK", rate, source: { kind: "bank", ref: "test" }, effectiveAt: "2026-10-15", quotedAt: "2026-10-15", ...over });
const official = (over: Partial<FxQuote> = {}): FxQuote => ({
  pair: "EUR/NOK", raw: { rate: "10,817", unit: 1 }, source: { kind: "official_customs", ref: "T55" }, effectiveAt: null, quotedAt: "2026-10-19",
  validFrom: "2026-10-15", validTo: "2026-10-28", suspension: "not_suspended_confirmed", ...over,
});
const nokIn = (price: string, over: Partial<EconomicsInput> = {}): EconomicsInput => ({
  price: { currency: "NOK", advertisedNet: price, priceBasis: "net", use: "advertised", evidence: "dealer_entered" }, fx: {}, taxInput: DIESEL,
  transportToBorder: { amount: "8000", basis: "quoted" }, transportAfterBorder: na, loadingHandling: na, insurance: zero,
  deduction: { value: "non_recoverable", source: { kind: "dealer_profile" } }, vatHandling: { value: "registered_reports_in_vat_return", source: { kind: "dealer_profile" } },
  charges: { climateGas: na, registrationFee: na, customsDuty: na }, asOf: "2026-10-19", ...over,
});
const eurIn = (over: Partial<EconomicsInput> = {}): EconomicsInput => ({
  ...nokIn("1"), price: { currency: "EUR", advertisedNet: "38562", priceBasis: "net", use: "advertised", evidence: "dealer_entered" },
  fx: { acquisition: bank("10.6709"), customs: official() }, customsDate: { date: "2026-10-20", kind: "actual_acceptance" }, ...over,
});
const val = (t: { kind: string; valueNok?: bigint | null }) => (t.kind === "value" ? t.valueNok : undefined);
const codes = (r: { blockers: Array<{ code: string }> }) => r.blockers.map((b) => b.code);

describe("1. mva-håndtering er skilt fra fradragsrett (T56, T63 § 8-1); brutto uendret", () => {
  const gross = (over: Partial<EconomicsInput>) => calculateEconomics(nokIn("100000", over), cfg());
  it("ukjent håndtering (standard) gir merkede scenarier for begge kanaler og gjør resultatet ufullstendig; beløpet og bruttoen er uendret", () => {
    const known = gross({});
    const unknown = gross({ vatHandling: null });
    expect(unknown.importVatSettlement.status).toBe("scenarios");
    expect(unknown.importVatSettlement.rows.map((r) => [r.handling, r.vatNok, r.paidToCustomsAtImportNok, r.reportedInVatReturnNok])).toEqual([
      ["registered_reports_in_vat_return", 27000n, 0n, 27000n], ["not_registered_pays_at_import", 27000n, 27000n, 0n]]);
    expect(unknown.status).toBe("incomplete");
    expect(unknown.incompleteReasons).toContain("vat_handling_unknown");
    expect(unknown.importCashRequirement).toEqual(known.importCashRequirement); // 100 000 + 8 000 + 27 000 + 333 723 = 468 723
    expect(val(known.importCashRequirement)).toBe(468723n);
  });
  it("registrert + fradrag: mva. rapporteres i mva-meldingen (ikke ved grensen), og er fortsatt med i brutto, men ikke i økonomisk kost", () => {
    const r = gross({ deduction: { value: "recoverable", source: { kind: "dealer_profile" } } });
    expect(r.importVatSettlement).toMatchObject({ status: "known", rows: [{ handling: "registered_reports_in_vat_return", paidToCustomsAtImportNok: 0n, reportedInVatReturnNok: 27000n }] });
    expect(val(r.importCashRequirement)).toBe(468723n);
    expect(val(r.estimatedLandedCost)).toBe(441723n);
  });
  it("registrert uten fradrag, og ikke registrert: kanalen følger håndteringen, ikke fradragsretten", () => {
    const reg = gross({});
    expect(reg.importVatSettlement.rows[0]).toMatchObject({ paidToCustomsAtImportNok: 0n, reportedInVatReturnNok: 27000n });
    const notReg = gross({ vatHandling: { value: "not_registered_pays_at_import", source: { kind: "dealer_entered" } } });
    expect(notReg.importVatSettlement.rows[0]).toMatchObject({ paidToCustomsAtImportNok: 27000n, reportedInVatReturnNok: 0n });
    expect(val(notReg.importCashRequirement)).toBe(val(reg.importCashRequirement));
  });
  it("fradragsrett uten registrering er selvmotsigende (mval. § 8-1) og blokkeres", () => {
    const r = gross({ vatHandling: { value: "not_registered_pays_at_import", source: { kind: "dealer_entered" } }, deduction: { value: "recoverable", source: { kind: "dealer_entered" } } });
    expect(r.status).toBe("blocked");
    expect(codes(r)).toEqual(["inconsistent_vat_status"]);
  });
  it("håndtering utledes aldri av fradragsstatus, annonse eller «forhandler»: kilder utenom dealer_entered/dealer_profile ignoreres med advarsel", () => {
    for (const kind of ["listing_claim", "assumed"] as const) {
      const r = gross({ vatHandling: { value: "registered_reports_in_vat_return", source: { kind } } });
      expect(r.importVatSettlement.handling.accepted).toBe(false);
      expect(r.importVatSettlement.status).toBe("scenarios");
      expect(r.warnings.join(" ")).toContain("mva-håndtering ignorert");
    }
    const onlyDeduction = gross({ vatHandling: null, deduction: { value: "recoverable", source: { kind: "dealer_entered" } } });
    expect(onlyDeduction.importVatSettlement.rows).toHaveLength(2);
  });
  it("brutto er ikke «kontant ved grensen»: resultatet har ingen slik post, og mva.-kanalen oppgir bare mva.-beløpet", () => {
    const r = gross({});
    expect(Object.keys(r).some((k) => /^cashAt(Border|Import)|^cashAtThe/i.test(k))).toBe(false);
    expect(Object.keys(r.importVatSettlement.rows[0]!)).toEqual(["vatScenarioId", "handling", "vatNok", "paidToCustomsAtImportNok", "reportedInVatReturnNok", "lowerBound"]);
  });
});

describe("2. tollkurs: akseptdato, gyldighetsperiode, fremtidige perioder, suspensjon", () => {
  it("faktisk akseptdato innenfor perioden: kursen brukes; datoene holdes adskilt; ingen estimatårsak for datoen", () => {
    const r = calculateEconomics(eurIn({ taxInput: { ...DIESEL, norwegianRegistration: { date: "2026-12-01", kind: "expected", defaulted: false } } }), cfg());
    expect(r.dates).toEqual({
      asOf: "2026-10-19", customsAcceptance: { date: "2026-10-20", kind: "actual_acceptance", rateValidOnDate: true }, norwegianRegistration: { date: "2026-12-01", kind: "expected" },
    });
    expect(r.estimateReasons).not.toContain("customs_acceptance_date_expected");
    expect(r.fx.customs).toMatchObject({ status: "used", rate: "10.817", validFrom: "2026-10-15", validTo: "2026-10-28", suspension: "not_suspended_confirmed" });
    // 38 562 × 10,817 = 417 125,154 → 417 125 (uavhengig regnet); tollverdi + 8 000 → 425 125; mva. 106 281,25 → 106 281
    expect(r.customsValueNok).toBe(425125n);
    expect(r.importVat.valueNok).toBe(106281n);
  });
  it("forventet scenariodato er ikke faktisk: estimat med egen årsak; ukjent dato er ufullstendig og aldri «verifisert»", () => {
    const exp = calculateEconomics(eurIn({ customsDate: { date: "2026-10-20", kind: "expected_scenario" } }), cfg());
    expect(exp.estimateReasons).toContain("customs_acceptance_date_expected");
    expect(exp.dates.customsAcceptance.kind).toBe("expected_scenario");
    const unk = calculateEconomics(eurIn({ customsDate: undefined }), cfg());
    expect(unk.status).toBe("incomplete");
    expect(unk.incompleteReasons).toContain("customs_acceptance_date_unknown");
    expect(unk.dates.customsAcceptance).toEqual({ date: null, kind: "unknown", rateValidOnDate: null });
    expect(calculateEconomics(eurIn({ customsDate: { date: null, kind: "actual_acceptance" } }), cfg()).blockers[0]!.code).toBe("invalid_date");
    expect(calculateEconomics(eurIn({ customsDate: { date: "2026-02-30", kind: "expected_scenario" } }), cfg()).blockers[0]!.code).toBe("invalid_date");
  });
  it("akseptdato utenfor kursperioden blokkeres; forhåndspublisert fremtidig periode (etter beregningsdatoen) er tillatt", () => {
    const outside = calculateEconomics(eurIn({ customsDate: { date: "2026-10-29", kind: "actual_acceptance" } }), cfg());
    expect(outside.status).toBe("blocked");
    expect(outside.blockers[0]!.message).toContain("dekker ikke akseptdatoen");
    const future = calculateEconomics(eurIn({
      fx: { acquisition: bank("10.6709"), customs: official({ raw: { rate: "10,695", unit: 1 }, validFrom: "2026-10-29", validTo: "2026-11-11" }) }, customsDate: { date: "2026-11-02", kind: "expected_scenario" },
    }), cfg());
    expect(future.status).not.toBe("blocked");
    expect(future.fx.customs.rate).toBe("10.695");
    expect(future.dates.customsAcceptance.rateValidOnDate).toBe(true);
    // grenser: f.o.m. og t.o.m. er inkludert
    for (const d of ["2026-10-15", "2026-10-28"]) expect(calculateEconomics(eurIn({ customsDate: { date: d, kind: "actual_acceptance" } }), cfg()).status).not.toBe("blocked");
    expect(calculateEconomics(eurIn({ customsDate: { date: "2026-10-14", kind: "actual_acceptance" } }), cfg()).status).toBe("blocked");
  });
  it("manglende periode gir ufullstendig; ugyldig periode blokkeres; beregningsdato i perioden er ikke krav for tollkurs", () => {
    const noPeriod = calculateEconomics(eurIn({ fx: { acquisition: bank("10.6709"), customs: official({ validFrom: null, validTo: null }) } }), cfg());
    expect(noPeriod.incompleteReasons).toContain("customs_fx_period_missing");
    expect(noPeriod.dates.customsAcceptance.rateValidOnDate).toBeNull();
    expect(calculateEconomics(eurIn({ fx: { acquisition: bank("10.6709"), customs: official({ validFrom: "2026-10-28", validTo: "2026-10-15" }) } }), cfg()).status).toBe("blocked");
  });
  it("suspensjon: ukjent (standard) er estimat og ikke kontrollert; bekreftet ikke suspendert gir ingen årsak; suspendert kurs brukes ikke", () => {
    const unk = calculateEconomics(eurIn({ fx: { acquisition: bank("10.6709"), customs: official({ suspension: undefined }) } }), cfg());
    expect(unk.estimateReasons).toContain("customs_fx_suspension_unverified");
    expect(unk.fx.customs.suspension).toBe("unknown");
    expect(calculateEconomics(eurIn(), cfg()).estimateReasons).not.toContain("customs_fx_suspension_unverified");
    const sus = calculateEconomics(eurIn({ fx: { acquisition: bank("10.6709"), customs: official({ suspension: "suspended" }) } }), cfg());
    expect(sus.status).toBe("incomplete");
    expect(sus.incompleteReasons).toContain("customs_fx_suspended");
    expect(sus.fx.customs).toMatchObject({ status: "not_calculated", rate: null });
    expect(sus.importVat.status).toBe("not_calculated");
  });
  it("anskaffelseskursen (betalingskurs) er adskilt: tollkursens periode og akseptdato påvirker den ikke, og den styrer bare kjøpesummen", () => {
    const r = calculateEconomics(eurIn(), cfg());
    expect(r.acquisition.acquisitionUsedNok).toBe(411491n); // 38 562 × 10,6709 = 411 491,25
    expect(r.fx.acquisition.rate).toBe("10.6709");
    expect(r.fx.customs.rate).toBe("10.817");
  });
});

describe("3. råkurs og omregningsenhet normaliseres nøyaktig én gang; råverdien beholdes", () => {
  const withCustoms = (customs: FxQuote, price = "10000", ccy = "EUR") => calculateEconomics(eurIn({ price: { currency: ccy, advertisedNet: price, priceBasis: "net", use: "advertised", evidence: "dealer_entered" }, fx: { acquisition: bank("1", { pair: `${ccy}/NOK` }), customs: { ...customs, pair: `${ccy}/NOK` } } }), cfg());
  it("enhet 1: desimalkomma → eksakt punktumform; enhet 100: delt på 100 én gang", () => {
    const eur = withCustoms(official());
    expect(eur.fx.customs).toMatchObject({ rate: "10.817", raw: { rate: "10,817", unit: 1 } });
    const sek = withCustoms(official({ raw: { rate: "95,550", unit: 100 } }), "10000", "SEK");
    expect(sek.fx.customs).toMatchObject({ rate: "0.9555", raw: { rate: "95,550", unit: 100 } });
    expect(sek.customsValueNok).toBe(9555n + 8000n); // 10 000 × 0,9555 = 9 555 (uavhengig regnet) + transport til grensen
    const jpy = withCustoms(official({ raw: { rate: "6,059", unit: 100 } }), "1000000", "JPY");
    expect(jpy.fx.customs.rate).toBe("0.06059");
    expect(jpy.customsValueNok).toBe(60590n + 8000n);
  });
  it("åtte desimaler i råkurs / 100 beholdes eksakt (ingen avkorting til 8 desimaler)", () => {
    const r = withCustoms(official({ raw: { rate: "10.12345678", unit: 100 } }), "10000", "SEK");
    expect(r.fx.customs.rate).toBe("0.1012345678");
  });
  it("normalisert kurs alene er fortsatt gyldig; oppgis begge må de stemme (ingen dobbel normalisering)", () => {
    const normalizedOnly = withCustoms({ ...official(), raw: undefined, rate: "0.9555" }, "10000", "SEK");
    expect(normalizedOnly.fx.customs).toMatchObject({ rate: "0.9555", raw: null });
    expect(withCustoms(official({ raw: { rate: "95,550", unit: 100 }, rate: "0.9555" }), "10000", "SEK").status).not.toBe("blocked");
    const wrong = withCustoms(official({ raw: { rate: "95,550", unit: 100 }, rate: "95.55" }), "10000", "SEK"); // ville gitt 100× feil hvis enheten ble hoppet over
    expect(wrong.status).toBe("blocked");
    expect(wrong.blockers[0]!.message).toContain("ikke konsistente");
  });
  it("ugyldig råkurs, enhet, tusenskille og manglende kurs blokkeres", () => {
    for (const q of [official({ raw: { rate: "1 142,960", unit: 100 } }), official({ raw: { rate: "abc", unit: 1 } }), official({ raw: { rate: "10,817", unit: 10 as never } }), official({ raw: { rate: "-1", unit: 1 } }), official({ raw: undefined })]) {
      expect(withCustoms(q).status, JSON.stringify(q.raw)).toBe("blocked");
    }
  });
});

describe("4. transport til/etter innførselsstedet, forsikring og lasting/håndtering: hver post én gang, bare riktige poster i tollverdien", () => {
  const split = nokIn("100000", { transportToBorder: { amount: "8000", basis: "quoted" }, transportAfterBorder: { amount: "3000", basis: "quoted" }, insurance: { amount: "200", basis: "quoted" }, loadingHandling: { amount: "500", basis: "quoted" } });
  it("tollverdi/mva.-grunnlag = pris + transport til grensen + forsikring + lasting; transport etter grensen er bare kostnad (regnet uavhengig: 108 700 → 27 175; total 472 598)", () => {
    const r = calculateEconomics(split, cfg());
    expect(r.customsValueNok).toBe(108700n);
    expect(r.importVat.valueNok).toBe(27175n);
    expect(val(r.importCashRequirement)).toBe(472598n);
    expect(val(r.estimatedLandedCost)).toBe(472598n);
    expect([r.transportToBorderNok, r.transportAfterBorderNok, r.insuranceNok, r.loadingHandlingNok]).toEqual([8000n, 3000n, 200n, 500n]);
  });
  it("ingen dobbelttelling: å endre transport etter grensen med 3 000 endrer totalene med nøyaktig 3 000 og mva./tollverdi med 0", () => {
    const withAfter = calculateEconomics(split, cfg());
    const noAfter = calculateEconomics({ ...split, transportAfterBorder: zero }, cfg());
    expect(val(withAfter.importCashRequirement)! - val(noAfter.importCashRequirement)!).toBe(3000n);
    expect(val(withAfter.estimatedLandedCost)! - val(noAfter.estimatedLandedCost)!).toBe(3000n);
    expect(withAfter.importVat.valueNok).toBe(noAfter.importVat.valueNok);
    expect(withAfter.customsValueNok).toBe(noAfter.customsValueNok);
    // 1 000 øker tollverdien (til grensen) med 1 000 og totalen med 1 000 + 250 mva.
    const moreToBorder = calculateEconomics({ ...split, transportToBorder: { amount: "9000", basis: "quoted" } }, cfg());
    expect(moreToBorder.customsValueNok! - withAfter.customsValueNok!).toBe(1000n);
    expect(val(moreToBorder.importCashRequirement)! - val(withAfter.importCashRequirement)!).toBe(1250n);
  });
  it("manglende beløp blir aldri 0: transport etter grensen, lasting/håndtering og transport til grensen uten produktantakelse gir nedre grense/ufullstendig", () => {
    const after = calculateEconomics({ ...split, transportAfterBorder: undefined }, cfg());
    expect(after.importCashRequirement).toMatchObject({ kind: "lower_bound", lowerBoundNok: 469598n });
    expect(after.incompleteReasons).toContain("transport_after_border_unknown");
    const lh = calculateEconomics({ ...split, loadingHandling: undefined }, cfg());
    expect(lh.customsValueNok).toBeNull();
    expect(lh.importVat.status).toBe("lower_bound");
    expect(lh.incompleteReasons).toContain("loading_handling_unknown");
    const tb = calculateEconomics({ ...split, transportToBorder: undefined }, cfg());
    expect(tb.transportToBorderNok).toBeNull();
    expect(tb.importVat.status).toBe("not_calculated");
  });
  it("8 000 finnes bare som uttrykkelig konfigurert produktantakelse for transport TIL grensen: merket, ikke sjablong, ikke brukt på transport etter grensen, aldri null-fallback", () => {
    const d = calculateEconomics({ ...split, transportToBorder: undefined }, cfg({ transportDefaultNok: "8000" }));
    expect(d.transportToBorderNok).toBe(8000n);
    expect(d.transportToBorderBasis).toBe("assumed_default");
    expect(d.estimateReasons).toContain("transport_default_assumed");
    expect(d.customsValueNok).toBe(108700n);
    expect(calculateEconomics({ ...split, transportToBorder: undefined, transportAfterBorder: undefined }, cfg({ transportDefaultNok: "8000" })).transportAfterBorderNok).toBeNull();
    expect(calculateEconomics({ ...split, transportToBorder: "unknown" }, cfg({ transportDefaultNok: "8000" })).transportToBorderNok).toBeNull();
    expect(calculateEconomics(split, approvedCfg).status).not.toBe("validated"); // fortsatt estimat/ufullstendig via andre årsaker (tax_estimate)
    expect(calculateEconomics({ ...split, transportToBorder: undefined }, { ...approvedCfg, transportDefaultNok: "8000" }).estimateReasons).toContain("transport_default_assumed");
  });
});

describe("5. elbilfritak: kvalifikasjon og målegrunnlag er adskilt fra avgiftsmotorens drivlinjeklassifisering", () => {
  const ev = (price: string, over: Partial<EconomicsInput> = {}) => calculateEconomics(nokIn(price, { taxInput: BEV, transportToBorder: zero, ...over }), cfg());
  it("alle kriterier + kjent elbil i avgiftsmotoren + uttrykkelig målegrunnlag ⇒ én mva.-verdi, merket som påstand/antakelse; under, på og over grensen", () => {
    for (const [price, vat] of [["299999", 0n], ["300000", 0n], ["300001", 0n], ["300003", 1n], ["350000", 12500n]] as const) {
      const r = ev(price, { evQualification: ALL_TRUE, evThresholdBasis: "customs_value" });
      expect(r.importVat.valueNok, price).toBe(vat);
      expect(r.estimateReasons).toEqual(expect.arrayContaining(["ev_qualification_stated", "ev_threshold_basis_assumed"]));
    }
  });
  it("målegrunnlaget velges ikke av kjernen: uten grunnlag gir kvalifisert elbil to scenarier og ufullstendig resultat (295 000 + 8 000: tollverdi → 750, kjøretøypris → 2 000)", () => {
    const r = ev("295000", { transportToBorder: { amount: "8000", basis: "quoted" }, evQualification: ALL_TRUE });
    expect(r.importVat.status).toBe("scenarios");
    expect(r.importVat.scenarios.map((s) => [s.id, s.valueNok])).toEqual([["with_exemption__basis_customs_value", 750n], ["with_exemption__basis_vehicle_price", 2000n]]);
    expect(r.importVat.valueNok).toBeNull();
    expect(r.status).toBe("incomplete");
    expect(r.incompleteReasons).toContain("ev_threshold_basis_unresolved");
    expect(r.importCashRequirement).toMatchObject({ kind: "scenarios", valueNok: null });
    const price = ev("295000", { transportToBorder: { amount: "8000", basis: "quoted" }, evQualification: ALL_TRUE, evThresholdBasis: "vehicle_price_only" });
    expect(price.importVat.valueNok).toBe(2000n);
    // over grensen er begge grunnlag like: 350 000 + 8 000 → 14 500
    const over = ev("350000", { transportToBorder: { amount: "8000", basis: "quoted" }, evQualification: ALL_TRUE });
    expect(over.importVat.scenarios.map((s) => s.valueNok)).toEqual([14500n, 14500n]);
  });
  it("kvalifikasjon: hvert kriterium som er false utelukker; null/manglende er uavklart (scenario + full mva.-variant); alle true uten kjent drivlinje er fortsatt uavklart", () => {
    for (const k of Object.keys(ALL_TRUE) as Array<keyof typeof ALL_TRUE>) {
      expect(ev("350000", { evQualification: { ...ALL_TRUE, [k]: false } }).importVat.ev.qualification, k).toBe("does_not_qualify");
      const unk = ev("350000", { evQualification: { ...ALL_TRUE, [k]: null }, evThresholdBasis: "customs_value" });
      expect(unk.importVat.ev.qualification, k).toBe("unresolved");
      expect(unk.importVat.scenarios.map((s) => s.id)).toEqual(["no_exemption", "with_exemption__basis_customs_value"]);
      expect(unk.incompleteReasons).toContain("ev_qualification_unresolved");
    }
    const noEngine = ev("350000", { evQualification: ALL_TRUE, evThresholdBasis: "customs_value", taxInput: { ...BEV, propulsion: { ...BEV.propulsion, pistonCombustionEngine: null, externallyChargeable: null } } });
    expect(noEngine.importVat.ev).toMatchObject({ qualification: "unresolved", engineClassification: null });
  });
  it("drivlinjeklassifisering ≠ kvalifikasjon: motoren sier bev (ingen stempelmotor) også for brenselcelle, men «bare elektrisitet fra ladbar batteripakke» er false ⇒ ikke kvalifisert", () => {
    const fuelCell = ev("350000", { evQualification: { ...ALL_TRUE, batteryOnlyPropulsion: false, externallyChargeableBattery: false } });
    expect(fuelCell.importVat.ev).toMatchObject({ qualification: "does_not_qualify", engineClassification: "bev" });
    expect(fuelCell.importVat.valueNok).toBe(87500n);
    // uten kriterier gir motorens «bev» ingen fritak
    const noCriteria = ev("350000");
    expect(noCriteria.importVat.ev.qualification).toBe("unresolved");
    expect(noCriteria.status).toBe("incomplete");
  });
});

describe("6. avrunding (U-013) er uendret åpen; ingen flagg er satt; validated krever alle forutsetninger", () => {
  it("registerprofilen har alle flagg false og de fire økonomiflaggene kan ikke gi validated uten uttrykkelig godkjenning", () => {
    expect(REGISTRY_ECONOMICS_PROFILE).toEqual({ vatRulesApproved: false, roundingApproved: false, customsFxRuleApproved: false, deductionRuleApproved: false });
    const r = calculateEconomics(eurIn({ taxInput: { ...DIESEL, norwegianTaxWeight: { kg: 1976, basis: "vehicle_register" }, firstRegistration: { precision: "day", value: "2023-11-15" } } }), cfg());
    expect(r.status).not.toBe("validated");
    expect(r.estimateReasons).toEqual(expect.arrayContaining(["vat_rules_unapproved", "rounding_unconfirmed", "customs_fx_rule_unconfirmed", "deduction_rule_unapproved"]));
  });
  it("syntetisk kontroll: med alle flagg true og alle opplysninger oppgitt kan statusen bli validated; fjernes én av dem (dato, suspensjon, håndtering) faller den tilbake", () => {
    const documented = { ...DIESEL, norwegianTaxWeight: { kg: 1976, basis: "vehicle_register" as const }, firstRegistration: { precision: "day" as const, value: "2023-11-15" } };
    const full = eurIn({ taxInput: documented });
    expect(calculateEconomics(full, approvedCfg).status).toBe("validated");
    expect(calculateEconomics({ ...full, customsDate: undefined }, approvedCfg).status).toBe("incomplete");
    expect(calculateEconomics({ ...full, customsDate: { date: "2026-10-20", kind: "expected_scenario" } }, approvedCfg).status).toBe("estimate");
    expect(calculateEconomics({ ...full, fx: { acquisition: bank("10.6709"), customs: official({ suspension: "unknown" }) } }, approvedCfg).status).toBe("estimate");
    expect(calculateEconomics({ ...full, vatHandling: null }, approvedCfg).status).toBe("incomplete");
  });
  it("likhet i mva.-avrunding gir fortsatt nedre grense og kandidater (ingen half-up antatt)", () => {
    const r = calculateEconomics(nokIn("300002", { taxInput: BEV, transportToBorder: zero, evQualification: ALL_TRUE, evThresholdBasis: "customs_value" }), cfg());
    expect(r.importVat.status).toBe("lower_bound");
    expect(r.roundingTies[0]).toContain("1 (half_up) / 0 (half_even)");
  });
});

describe("7. kildearkivet (T53–T69) er uendret og registeret peker på det", () => {
  const dir = "docs/tax/primarkilder/econ004";
  const manifest = JSON.parse(readFileSync(`${dir}/PACK-MANIFEST.json`, "utf8")) as { files: Array<{ path: string; bytes: number; sha256: string }> };
  const local = (p: string) => (p === "acquisition.json" ? "ACQUISITION.json" : p === "CLAUDE_INSTRUCTIONS.md" ? "PACK-CLAUDE_INSTRUCTIONS.md" : p === "LES-MEG.md" ? "PACK-LES-MEG.md" : p === "docs/tax/primarkilder/MANIFEST.md" ? "PACK-MANIFEST.md" : p.split("/").pop()!);
  it("alle 43 manifestoppføringer stemmer på størrelse og SHA-256", () => {
    expect(manifest.files).toHaveLength(43);
    for (const f of manifest.files) {
      const b = readFileSync(`${dir}/${local(f.path)}`);
      expect(b.length, f.path).toBe(f.bytes);
      expect(createHash("sha256").update(b).digest("hex"), f.path).toBe(f.sha256);
    }
  });
  it("kildeposter for pakken har repoFile + hash, og gjenbrukte ID-er (T23, T24, T35, T36) peker på samme dokument", () => {
    const reg = JSON.parse(readFileSync("docs/tax/sources.json", "utf8")) as { sources: Array<{ id: string; repoFile?: string; packageSha256?: string; evidenceLevel: string; url: string }> };
    const ids = ["T23", "T24", "T35", "T36", ...Array.from({ length: 17 }, (_, i) => `T${53 + i}`).filter((id) => id !== "T61")];
    for (const id of ids) {
      const s = reg.sources.find((x) => x.id === id)!;
      expect(s, id).toBeTruthy();
      expect(s.evidenceLevel, id).toBe("E1");
      expect(existsSync(s.repoFile!), id).toBe(true);
      expect(createHash("sha256").update(readFileSync(s.repoFile!)).digest("hex"), id).toBe(s.packageSha256);
    }
  });
});

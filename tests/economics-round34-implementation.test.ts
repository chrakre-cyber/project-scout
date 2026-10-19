/**
 * ECON-004 implementeringsrunde 34 (kildevurdering 6): elbilgrensens målegrunnlag, ordinær tollsats, avgifter ved innførsel (§ 4-11), provisjon, betalingskostnader og
 * utenlandsk mva. i prisen. Dette er IKKE parametergodkjenning: økonomiflaggene er false i registeret, og `validated` er ikke nåbart med registerprofilen.
 * Literaler er håndregnet (se kommentarer); ECON-003-fixturene og avrundingspolicyen er uendret.
 */
import { describe, expect, it } from "vitest";
import { calculateEconomics, REGISTRY_ECONOMICS_PROFILE, UNCONFIRMED_HALF_UP, type EconomicsConfig, type EconomicsInput, type EconomicsProfile, type EconomicsResult, type Total } from "@/domain/economics";
import { ordinaryDutyCoverage } from "@/domain/economics/customs-tariff";
import { ECON_CASES } from "./fixtures/econ-golden";

const FV = { treatment: "excluded_documented", evidence: "invoice_or_contract" } as const;
const na = { state: "not_applicable", basis: "test" } as const;
const zero = { amount: "0", basis: "quoted" } as const;
const ALL_TRUE = { batteryOnlyPropulsion: true, externallyChargeableBattery: true, passengerVehicle: true, notPreviouslyRegisteredInNorway: true } as const;
const DIESEL = ECON_CASES[2]!.golden.input; // avgift 333 723 (estimat)
const BEV = ECON_CASES[1]!.golden.input;
const cfg = (over: Partial<EconomicsConfig> = {}): EconomicsConfig => ({ rounding: UNCONFIRMED_HALF_UP, ...over });
const ALL_APPROVED: EconomicsProfile = { vatRulesApproved: true, roundingApproved: true, customsFxRuleApproved: true, deductionRuleApproved: true };
/** NOK-pris, diesel, aksept 2026-10-20 (faktisk); tollavgift utelatt ⇒ ordinær sats 0 bare når tilfellet dekkes. Tollverdi 108 000, mva. 27 000, kontant 468 723. */
const base = (over: Partial<EconomicsInput> = {}): EconomicsInput => ({
  price: { currency: "NOK", advertisedNet: "100000", priceBasis: "net", use: "advertised", evidence: "dealer_entered", foreignVat: FV }, fx: {}, taxInput: DIESEL,
  customsDate: { date: "2026-10-20", kind: "actual_acceptance" },
  transportToBorder: { amount: "8000", basis: "quoted" }, transportAfterBorder: na, loadingHandling: na, insurance: zero,
  deduction: { value: "non_recoverable", source: { kind: "dealer_profile" } }, vatHandling: { value: "registered_reports_in_vat_return", source: { kind: "dealer_profile" } },
  charges: { climateGas: na, registrationFee: na }, asOf: "2026-10-19", ...over,
});
const withCharges = (c: NonNullable<EconomicsInput["charges"]>): Partial<EconomicsInput> => ({ charges: { climateGas: na, registrationFee: na, ...c } });
const run = (i: EconomicsInput, c: EconomicsConfig = cfg()) => calculateEconomics(i, c);
const val = (t: Total) => (t.kind === "value" ? t.valueNok : undefined);
const lowerOf = (t: Total): bigint | null => (t.kind === "value" ? t.valueNok : t.kind === "lower_bound" ? t.lowerBoundNok : t.kind === "scenarios" ? t.scenarios.reduce((m, s) => (s.valueNok < m ? s.valueNok : m), t.scenarios[0]!.valueNok) : null);
const missingOf = (t: Total) => (t.kind === "lower_bound" ? t.missing : []);
const ev = (price: string, over: Partial<EconomicsInput> = {}) => run(base({ price: { currency: "NOK", advertisedNet: price, priceBasis: "net", use: "advertised", evidence: "dealer_entered", foreignVat: FV }, taxInput: BEV, evQualification: ALL_TRUE, ...over }));

describe("1. elbilgrensen måles mot tollverdi (R-IMP-VAT-004 E1P); komponenter uten dekning er merket", () => {
  it("standard: bilpris + frakt + forsikring; avgift bare av overskytende del (295 000 + 8 000 → 750; Tolletatens eksempel 305 000 → 1 250)", () => {
    const r = ev("295000");
    expect(r.importVat).toMatchObject({ status: "calculated", valueNok: 750n, ev: { qualification: "qualifies", thresholdBasis: "customs_value" } });
    expect(r.importVat.scenarios.map((s) => s.id)).toEqual(["with_exemption__basis_customs_value"]);
    expect(ev("297000").importVat.valueNok).toBe(1250n); // 297 000 + 8 000 = 305 000 → 25 % × 5 000
    expect(r.estimateReasons).not.toContain("ev_threshold_components_unconfirmed");
  });
  it("lasting/håndtering og salgsprovisjon i målt beløp har ikke dekning ordrett ⇒ estimatårsak (ikke uttrykt som regel)", () => {
    // 295 000 + 4 000 + 1 000 + 2 000 (lasting) = 302 000 → (302 000 − 300 000) × 25 % = 500
    const r = ev("295000", { transportToBorder: { amount: "4000", basis: "quoted" }, insurance: { amount: "1000", basis: "quoted" }, loadingHandling: { amount: "2000", basis: "quoted" } });
    expect(r.importVat.valueNok).toBe(500n);
    expect(r.estimateReasons).toContain("ev_threshold_components_unconfirmed");
    expect(r.warnings.join(" ")).toMatch(/privatpersoner.*registrert importør/);
    const s = ev("295000", { commission: [{ role: "sales_or_brokerage_commission", amount: { amount: "1000", basis: "quoted" }, paidSeparatelyFromPrice: true }] });
    expect(s.importVat.valueNok).toBe(1000n); // 295 000 + 8 000 + 1 000 = 304 000 → 1 000
    expect(s.estimateReasons).toContain("ev_threshold_components_unconfirmed");
  });
  it("kjøretøypris alene er fjernet som alternativ og velges ikke stille; ikke-ordinær innførsel gir nedre grense", () => {
    const old = ev("295000", { evThresholdBasis: "vehicle_price_only" as never });
    expect(old.status).toBe("blocked");
    const nd = ev("295000", { evThresholdBasis: "undocumented_import_type" });
    expect(nd.importVat.status).toBe("lower_bound");
    expect(nd.incompleteReasons).toContain("ev_threshold_basis_not_documented_for_import_type");
    expect(missingOf(nd.importCashRequirement)).toContain("ev_threshold_basis_not_documented");
  });
});

describe("2. ordinær tollsats 0 bare der klassifisering og tariffgyldighet dekker tilfellet", () => {
  it("dekket (personbil, kjent drivlinje, aksept i 2026): sats 0 med eksplisitt grunnlag, estimat inntil godkjenning; ikke validated", () => {
    const r = run(base());
    expect(r.customsDuty).toEqual({ nok: 0n, basis: "ordinary_rate_tariff_2026" });
    expect(r.importVatBaseNok).toBe(108000n);
    expect(r.estimateReasons).toContain("customs_duty_ordinary_rate_unapproved");
    expect(r.warnings.join(" ")).toContain("Tolltariffen 2026");
    expect(r.status).not.toBe("validated");
    expect(run(base(), cfg({ profile: ALL_APPROVED, rounding: { mode: "half_up", status: "approved" } })).estimateReasons).not.toContain("customs_duty_ordinary_rate_unapproved");
    expect(REGISTRY_ECONOMICS_PROFILE).toEqual({ vatRulesApproved: false, roundingApproved: false, customsFxRuleApproved: false, deductionRuleApproved: false });
  });
  it.each([
    ["akseptdato ukjent", { customsDate: undefined }],
    ["akseptdato utenfor tariffutgaven (2027)", { customsDate: { date: "2027-01-05", kind: "actual_acceptance" as const } }],
    ["kjøretøyklasse ikke personbil", { taxInput: { ...DIESEL, vehicleClass: "van_n1" } }],
    ["drivlinje ukjent", { taxInput: { ...DIESEL, propulsion: { ...DIESEL.propulsion, pistonCombustionEngine: null, externallyChargeable: null } } }],
  ] as Array<[string, Partial<EconomicsInput>]>)("ikke dekket: %s ⇒ tollavgift ukjent (aldri 0), mva.-grunnlaget og totalene er nedre grenser", (_l, over) => {
    const r = run(base(over));
    expect(r.customsDuty).toEqual({ nok: null, basis: "unknown" });
    expect(r.importVat.status).toBe("lower_bound");
    expect(missingOf(r.importCashRequirement)).toContain("charges.customsDuty");
    expect(r.importCashRequirement.kind).toBe("lower_bound");
    expect(r.warnings.join(" ")).toMatch(/tollavgift ukjent: ordinær sats 0 brukes ikke/);
    expect(r.estimateReasons).not.toContain("customs_duty_ordinary_rate_unapproved");
  });
  it("eksplisitt ukjent forblir ukjent selv når tilfellet dekkes; eksplisitt 0 og ikke-aktuell er oppgitt av kallet", () => {
    expect(run(base(withCharges({ customsDuty: { state: "unknown" } }))).customsDuty).toEqual({ nok: null, basis: "unknown" });
    expect(run(base(withCharges({ customsDuty: zero }))).customsDuty).toEqual({ nok: 0n, basis: "explicit" });
    expect(run(base(withCharges({ customsDuty: na }))).customsDuty).toEqual({ nok: 0n, basis: "stated_not_applicable" });
  });
  it("eksplisitt tollavgift > 0 inngår i mva.-grunnlaget og i kostnaden (én gang), og avviket fra ordinær sats varsles", () => {
    // grunnlag 108 000 + 1 000 = 109 000 → 27 250; kontant 468 723 + 1 000 + 250
    const r = run(base(withCharges({ customsDuty: { amount: "1000", basis: "quoted" } })));
    expect(r.importVatBaseNok).toBe(109000n);
    expect(r.importVat.valueNok).toBe(27250n);
    expect(val(r.importCashRequirement)).toBe(468723n + 1000n + 250n);
    expect(r.warnings.join(" ")).toContain("avviker fra ordinær sats 0");
    expect(r.incompleteReasons).not.toContain("customs_duty_vat_base_unresolved");
    // elbil: tollavgiften er ikke del av det beløpet grensen måles mot, men er del av grunnlaget: (304 000 − 300 000) × 25 % = 1 000 (uten toll 750)
    const e = ev("295000", withCharges({ customsDuty: { amount: "1000", basis: "quoted" } }));
    expect(e.importVat.valueNok).toBe(1000n);
  });
  it("dekningsfunksjonen er ren og avgrenset til tariffutgaven", () => {
    expect(ordinaryDutyCoverage({ vehicleClass: "passenger_car_m1", powertrain: "bev", acceptanceDate: "2026-01-01" }).covered).toBe(true);
    expect(ordinaryDutyCoverage({ vehicleClass: "passenger_car_m1", powertrain: "bev", acceptanceDate: "2025-12-31" }).covered).toBe(false);
    expect(ordinaryDutyCoverage({ vehicleClass: "passenger_car_m1", powertrain: null, acceptanceDate: "2026-06-01" }).covered).toBe(false);
  });
});

describe("3. avgifter ved innførsel (§ 4-11) vurderes hver for seg; engangsavgift og registreringsgebyr utenfor", () => {
  it("engangsavgift utenfor grunnlaget: grunnlaget er 108 000 uansett avgiftsbeløp (diesel 333 723 / BEV 16 748)", () => {
    const d = run(base());
    const b = run(base({ taxInput: BEV }));
    expect(d.tax.oneOffTaxNok).not.toBe(b.tax.oneOffTaxNok);
    expect(d.importVatBaseNok).toBe(108000n);
    expect(b.importVatBaseNok).toBe(108000n);
    expect(d.importVat.valueNok).toBe(27000n);
  });
  it("registreringsgebyr er kostnad, aldri importavgift: grunnlag og mva. uendret, kontant +5 000", () => {
    const r = run(base(withCharges({ registrationFee: { amount: "5000", basis: "quoted" } })));
    expect(r.importVatBaseNok).toBe(108000n);
    expect(r.importVat.valueNok).toBe(27000n);
    expect(val(r.importCashRequirement)).toBe(468723n + 5000n);
  });
  it("importavgift klassifisert «i grunnlaget» øker grunnlaget (5 000 → mva. +1 250); «utenfor» er bare kostnad; uklassifisert er ukjent (nedre grense)", () => {
    const lv = (vatBase: "in_base" | "outside_base" | "unknown") => run(base(withCharges({ importLevies: [{ label: "avgift X", amount: "5000", basis: "quoted", vatBase }] })));
    expect(lv("in_base").importVatBaseNok).toBe(113000n);
    expect(val(lv("in_base").importCashRequirement)).toBe(468723n + 5000n + 1250n);
    expect(lv("outside_base").importVatBaseNok).toBe(108000n);
    expect(val(lv("outside_base").importCashRequirement)).toBe(468723n + 5000n);
    const u = lv("unknown");
    expect(u.importVat.status).toBe("lower_bound");
    expect(u.incompleteReasons).toContain("vat_base_charge_unclassified");
    expect(lowerOf(u.importCashRequirement)).toBe(468723n + 5000n);
    expect(run(base(withCharges({ importLevies: [{ label: "x", amount: "1", basis: "quoted", vatBase: "maybe" as never }] }))).blockers.map((b) => b.code)).toEqual(["invalid_classification"]);
  });
  it("klimagassavgift er ikke låst utenfor: > 0 uten klassifisering er ukjent, ellers følger klassifiseringen (900 i grunnlaget → +225 mva.)", () => {
    const cg = (v?: "in_base" | "outside_base" | "unknown") => run(base({ charges: { climateGas: { amount: "900", basis: "quoted" }, registrationFee: na, ...(v ? { climateGasVatBase: v } : {}) } }));
    expect(cg().incompleteReasons).toContain("vat_base_charge_unclassified");
    expect(cg("in_base").importVatBaseNok).toBe(108900n);
    expect(val(cg("in_base").importCashRequirement)).toBe(468723n + 900n + 225n);
    expect(cg("outside_base").importVatBaseNok).toBe(108000n);
    expect(run(base({ charges: { climateGas: na, registrationFee: na } })).incompleteReasons).not.toContain("vat_base_charge_unclassified");
  });
});

describe("4. provisjon: innkjøps- og salgs-/meglerprovisjon behandles ulikt; ukjent rolle forblir ukjent", () => {
  const cm = (role: "purchase_commission" | "sales_or_brokerage_commission" | "unknown", sep: boolean | null = true) => ({ role, amount: { amount: "3000", basis: "quoted" as const }, paidSeparatelyFromPrice: sep });
  it("salgs-/meglerprovisjon betalt i tillegg legges til tollverdien (111 000 → mva. 27 750) og kostnaden telles én gang", () => {
    const r = run(base({ commission: [cm("sales_or_brokerage_commission")] }));
    expect(r.customsValueNok).toBe(111000n);
    expect(r.commissionInCustomsValueNok).toBe(3000n);
    expect(r.importVat.valueNok).toBe(27750n);
    expect(val(r.importCashRequirement)).toBe(468723n + 3000n + 750n);
  });
  it("innkjøpsprovisjon er kostnad, ikke tollverdi (tollverdi 108 000, mva. 27 000, kontant +3 000)", () => {
    const r = run(base({ commission: [cm("purchase_commission")] }));
    expect(r.customsValueNok).toBe(108000n);
    expect(r.commissionInCustomsValueNok).toBe(0n);
    expect(val(r.importCashRequirement)).toBe(468723n + 3000n);
  });
  it("ukjent rolle: kostnaden tas med, men tollverdien og mva. er nedre grenser og resultatet er ufullstendig (ingen generell behandling)", () => {
    const r = run(base({ commission: [cm("unknown")] }));
    expect(r.customsValueNok).toBeNull();
    expect(r.importVat.status).toBe("lower_bound");
    expect(r.importVat.valueNok).toBe(27000n);
    expect(r.incompleteReasons).toContain("commission_role_unknown");
    expect(lowerOf(r.importCashRequirement)).toBe(468723n + 3000n);
  });
  it("allerede i prisen ⇒ ingenting legges til; ukjent om betalt i tillegg ⇒ ukjent; ugyldig rolle blokkeres", () => {
    expect(val(run(base({ commission: [cm("sales_or_brokerage_commission", false)] })).importCashRequirement)).toBe(468723n);
    const w = run(base({ commission: [cm("purchase_commission", false)] }));
    expect(w.warnings.join(" ")).toContain("trekkes ikke ut");
    const n = run(base({ commission: [cm("sales_or_brokerage_commission", null)] }));
    expect(n.incompleteReasons).toContain("commission_price_inclusion_unknown");
    expect(missingOf(n.importCashRequirement)).toContain("commission[0]");
    expect(run(base({ commission: [{ ...cm("unknown"), role: "agent" as never }] })).blockers.map((b) => b.code)).toEqual(["invalid_classification"]);
  });
});

describe("5. bank-/valutagebyr: selvstendig betalingskostnad skilles fra beløp som inngår i vareprisen", () => {
  const pc = (nature: "separate_payment_cost" | "included_in_goods_price" | "unknown") => ({ label: "valutagebyr", amount: { amount: "1200", basis: "quoted" as const }, nature });
  it("selvstendig kostnad: i kostnaden (+1 200), ikke i tollverdien eller mva.-grunnlaget", () => {
    const r = run(base({ paymentCosts: [pc("separate_payment_cost")] }));
    expect(r.customsValueNok).toBe(108000n);
    expect(r.importVat.valueNok).toBe(27000n);
    expect(val(r.importCashRequirement)).toBe(468723n + 1200n);
  });
  it("inngår i vareprisen: ikke lagt til en gang til (varsel); ukjent art: ikke lagt til, nedre grense, ufullstendig", () => {
    const inc = run(base({ paymentCosts: [pc("included_in_goods_price")] }));
    expect(val(inc.importCashRequirement)).toBe(468723n);
    expect(inc.warnings.join(" ")).toContain("er allerede i prisen");
    const u = run(base({ paymentCosts: [pc("unknown")] }));
    expect(u.incompleteReasons).toContain("payment_cost_nature_unknown");
    expect(u.customsValueNok).toBeNull();
    expect(missingOf(u.importCashRequirement)).toContain("paymentCosts[0]");
    expect(run(base({ paymentCosts: [{ ...pc("unknown"), nature: "all" as never }] })).blockers.map((b) => b.code)).toEqual(["invalid_classification"]);
  });
});

describe("6. utenlandsk mva. i prisen: refusjon/mva.-fri pris utledes ikke av annonsetekst eller en oppgitt nettopris alene", () => {
  const withFv = (foreignVat: EconomicsInput["price"]["foreignVat"]) => base({ price: { currency: "NOK", advertisedNet: "100000", priceBasis: "net", use: "advertised", evidence: "quote_document", ...(foreignVat ? { foreignVat } : {}) } });
  it("oppgitt nettopris uten dokumentasjon ⇒ tollverdiens pris er en nedre grense (ufullstendig), ikke et løst grunnlag", () => {
    const r = run(withFv(undefined));
    expect(r.incompleteReasons).toContain("foreign_vat_exclusion_undocumented");
    expect(r.customsValueNok).toBeNull();
    expect(r.importVat.status).toBe("lower_bound");
    expect(r.importVat.valueNok).toBe(27000n); // nedre grense: beregnet på den oppgitte netto
    expect(missingOf(r.importCashRequirement)).toContain("customs_value_components");
    expect(r.status).toBe("incomplete");
  });
  it("«ubekreftet» og annonsepåstand som bevis aksepteres ikke (annonsepåstand gir varsel)", () => {
    expect(run(withFv({ treatment: "unconfirmed", evidence: "invoice_or_contract" })).incompleteReasons).toContain("foreign_vat_exclusion_undocumented");
    const l = run(withFv({ treatment: "excluded_documented", evidence: "listing_claim" }));
    expect(l.incompleteReasons).toContain("foreign_vat_exclusion_undocumented");
    expect(l.warnings.join(" ")).toContain("annonsepåstand");
  });
  it("dokumentert (faktura/kontrakt) ⇒ løst; forhandlerens egen påstand ⇒ løst men merket som forhandleroppgitt", () => {
    const d = run(withFv({ treatment: "excluded_documented", evidence: "invoice_or_contract" }));
    expect(d.customsValueNok).toBe(108000n);
    expect(d.incompleteReasons).not.toContain("foreign_vat_exclusion_undocumented");
    expect(d.estimateReasons).not.toContain("foreign_vat_exclusion_dealer_stated");
    const e = run(withFv({ treatment: "excluded_documented", evidence: "dealer_entered" }));
    expect(e.customsValueNok).toBe(108000n);
    expect(e.estimateReasons).toContain("foreign_vat_exclusion_dealer_stated");
  });
  it("forhandlerjustert pris krever samme behandling; ugyldig verdi blokkeres; brutto-pris er fortsatt uløst", () => {
    const adj = base({ price: { currency: "NOK", advertisedNet: "100000", dealerAdjusted: "95000", priceBasis: "net", use: "dealer_adjusted", evidence: "dealer_entered" } });
    expect(run(adj).incompleteReasons).toContain("foreign_vat_exclusion_undocumented");
    expect(run({ ...adj, price: { ...adj.price, foreignVat: FV } }).customsValueNok).toBe(103000n);
    expect(run(withFv({ treatment: "yes" as never, evidence: "invoice_or_contract" })).blockers.map((b) => b.code)).toEqual(["invalid_classification"]);
    const gross = run(base({ price: { currency: "NOK", advertisedGross: "125000", priceBasis: "gross", use: "advertised", evidence: "listing_claim", foreignVat: FV } }));
    expect(gross.incompleteReasons).toContain("purchase_basis_gross_only");
    expect(gross.acquisition.purchaseBasisResolved).toBe(false);
  });
});

describe("7. nedre grenser er aldri høyere enn noen fullført utfall (nye ukjente)", () => {
  const completions: Array<[string, Partial<EconomicsInput>, Array<Partial<EconomicsInput>>]> = [
    ["provisjonsrolle", { commission: [{ role: "unknown", amount: { amount: "3000", basis: "quoted" }, paidSeparatelyFromPrice: true }] },
      (["purchase_commission", "sales_or_brokerage_commission"] as const).map((role) => ({ commission: [{ role, amount: { amount: "3000", basis: "quoted" as const }, paidSeparatelyFromPrice: true }] }))],
    ["provisjon betalt i tillegg?", { commission: [{ role: "sales_or_brokerage_commission", amount: { amount: "3000", basis: "quoted" }, paidSeparatelyFromPrice: null }] },
      ([true, false] as const).map((s) => ({ commission: [{ role: "sales_or_brokerage_commission" as const, amount: { amount: "3000", basis: "quoted" as const }, paidSeparatelyFromPrice: s }] }))],
    ["betalingskostnadens art", { paymentCosts: [{ label: "g", amount: { amount: "1200", basis: "quoted" }, nature: "unknown" }] },
      (["separate_payment_cost", "included_in_goods_price"] as const).map((nature) => ({ paymentCosts: [{ label: "g", amount: { amount: "1200", basis: "quoted" as const }, nature }] }))],
    ["klimagassavgift i grunnlaget?", { charges: { climateGas: { amount: "900", basis: "quoted" }, registrationFee: na } },
      (["in_base", "outside_base"] as const).map((v) => ({ charges: { climateGas: { amount: "900", basis: "quoted" as const }, climateGasVatBase: v, registrationFee: na } }))],
    ["tollavgift", { customsDate: undefined }, [{ customsDate: { date: "2026-10-20", kind: "actual_acceptance" as const } }, { customsDate: { date: "2026-10-20", kind: "actual_acceptance" as const }, ...withCharges({ customsDuty: { amount: "2000", basis: "quoted" } }) }]],
    ["utenlandsk mva. i prisen", { price: { currency: "NOK", advertisedNet: "100000", priceBasis: "net", use: "advertised", evidence: "quote_document" } }, [{}]],
  ];
  it.each(completions)("%s", (_l, unknown, fills) => {
    const u = run(base(unknown));
    for (const f of fills) {
      const k = run(base(f));
      for (const pick of [(r: EconomicsResult) => r.importCashRequirement, (r: EconomicsResult) => r.estimatedLandedCost] as const) {
        expect(u.importCashRequirement.kind === "lower_bound" || u.importCashRequirement.kind === "scenarios", `${_l}: ukjent ⇒ ikke eksakt`).toBe(true);
        const lo = lowerOf(pick(u))!;
        const hi = lowerOf(pick(k))!;
        expect(lo <= hi, `${_l}: nedre grense ${lo} må være ≤ ${hi}`).toBe(true);
      }
    }
  });
});

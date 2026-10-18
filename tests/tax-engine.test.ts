/**
 * ECON-002: deterministisk norsk engangsavgift (gruppe a, personbil 2026). Testene prøver regler, grenser og blokkering — de gyldne
 * casene er valideringsreferanser, aldri kilder til satser. Avrundingsregelen mangler kilde (U-010) og testes som åpen.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { calculateNorwegianVehicleTax, classifyPowertrain, lookupDeduction, NO_OTA_2026_A_PB, DEDUCTION_STEPS_2026, type TaxInput, type TaxProfile } from "@/domain/tax";
import { add, ceilInt, dec, decInt, floorInt, mul, roundHalfUpInt, toExactString } from "@/domain/tax/decimal";
import { GOLDEN_CASES } from "./fixtures/tax-golden";

const ROOT = join(__dirname, "..");
const json = (f: string) => JSON.parse(readFileSync(join(ROOT, "docs/tax", f), "utf8"));
const table = DEDUCTION_STEPS_2026;

const ice = (over: Partial<TaxInput> = {}): TaxInput => ({
  vehicleClass: "passenger_car_m1",
  propulsion: { pistonCombustionEngine: true, externallyChargeable: false, evidence: "type_approval" },
  norwegianTaxWeight: { kg: 1976, basis: "eu_type_approval_minimum_mass" },
  co2: { gramsPerKm: 179, method: "wltp_combined" },
  firstRegistration: { precision: "day", value: "2023-11-01" },
  norwegianRegistration: { date: "2026-04-30", kind: "expected" },
  ...over,
});
const codes = (r: ReturnType<typeof calculateNorwegianVehicleTax>) => r.blocked.map((b) => b.code);

describe("eksakt desimalaritmetikk (ingen float)", () => {
  it("12,71 × 1 685 er nøyaktig 21 416,35 (binær float gir støy)", () => {
    expect(toExactString(mul(decInt(1685), dec("12.71")))).toBe("21416.35");
    expect(0.1 + 0.2).not.toBe(0.3); // float ville ikke holdt
    expect(toExactString(add(dec("0.1"), dec("0.2")))).toBe("0.3");
  });
  it("floor / ceil / halvt opp er uavhengige og deterministiske, også for negative tall", () => {
    const x = dec("526669.738");
    expect([floorInt(x), ceilInt(x), roundHalfUpInt(x)]).toEqual([526669n, 526670n, 526670n]);
    expect([floorInt(dec("2.5")), roundHalfUpInt(dec("2.5")), roundHalfUpInt(dec("-2.5")), floorInt(dec("-0.5")), ceilInt(dec("-0.5"))]).toEqual([2n, 3n, -3n, -1n, 0n]);
    expect(() => dec("1e3")).toThrow();
  });
});

describe("kilde-belagte parametere stemmer med docs/tax (ingen parallell regelmodell)", () => {
  const rules = json("rules.json").rules as Array<{ id: string; datedParameters?: Array<Record<string, unknown>> }>;
  interface Dp { id: string; thresholdKg?: number; rate?: number; group: string; from: string; to: string | null; evidence: string; bandSemantics?: string; bands?: Array<{ fromGramKm: number; toGramKm: number | null; rate: number }> }
  const dp = (id: string) => rules.flatMap((r) => r.datedParameters ?? []).find((d) => d.id === id) as unknown as Dp;
  const P = NO_OTA_2026_A_PB.parameters;
  it("vekt og CO2 = rules.json datedParameters", () => {
    expect(dp(P.generalWeight.paramRef)).toMatchObject({ thresholdKg: P.generalWeight.thresholdKg, rate: Number(P.generalWeight.ratePerKg), group: "a", from: "2026-01-01", to: NO_OTA_2026_A_PB.validTo, evidence: "E1" });
    expect(dp(P.combustionWeight.paramRef)).toMatchObject({ thresholdKg: P.combustionWeight.thresholdKg, rate: Number(P.combustionWeight.ratePerKg), group: "a", from: "2026-01-01", to: NO_OTA_2026_A_PB.validTo, evidence: "E1" });
    const bands = dp(P.co2ParamRef).bands!;
    expect(dp(P.co2ParamRef).bandSemantics).toBe("marginal");
    expect(P.co2Bands.map((b) => Number(b.ratePerGramKm))).toEqual(bands.map((b) => b.rate));
    expect(P.co2Bands.map((b) => b.toGramKm)).toEqual(bands.map((b) => b.toGramKm));
  });
  it("bruksfradragstabellen = T07-transkripsjonen (41 trinn, stigende) og vrakpant 2 400", () => {
    const t7 = json("bruksfradrag-tabell-T07.json").steps.map((s: { ageMonths: number; percent: number }) => ({ ageMonths: s.ageMonths, percent: s.percent }));
    expect(table).toEqual(t7);
    expect(table).toHaveLength(41);
    expect(table.at(-1)).toEqual({ ageMonths: 240, percent: 100 });
    expect(P.scrappageDepositNok).toBe(2400);
  });
  it("kildefilene i docs/tax/primarkilder har registrert SHA-256 og E1-nivå", () => {
    const sources = json("sources.json").sources as Array<{ id: string; evidenceLevel: string; repoFile?: string; packageSha256?: string }>;
    for (const id of NO_OTA_2026_A_PB.sources) {
      const s = sources.find((x) => x.id === id)!;
      expect(s.evidenceLevel, id).toBe("E1");
      expect(createHash("sha256").update(readFileSync(join(ROOT, s.repoFile!))).digest("hex"), id).toBe(s.packageSha256);
    }
  });
  it("profilen er ikke godkjent og ingen parameter er godkjent i foundationStatus", () => {
    expect(NO_OTA_2026_A_PB.approval.approved).toBe(false);
    expect(json("rules.json").foundationStatus).toMatchObject({ status: "REVIEW", approvedParameters: 0, class1References: 0 });
  });
});

describe("drivlinje avgjøres av tekniske data, ikke merkenavn", () => {
  it("klassifiserer BEV / PHEV / ICE og krever kjente felt", () => {
    const p = (piston: boolean | null, chg: boolean | null) => ({ pistonCombustionEngine: piston, externallyChargeable: chg, evidence: "type_approval" as const });
    expect(classifyPowertrain(p(false, true))).toBe("bev");
    expect(classifyPowertrain(p(true, true))).toBe("phev");
    expect(classifyPowertrain(p(true, false))).toBe("ice");
    expect(classifyPowertrain(p(null, false))).toBeNull();
    expect(classifyPowertrain(p(true, null))).toBeNull();
  });
  it("annonsepåstand om drivlinje og ukjent drivlinje blokkerer", () => {
    expect(codes(calculateNorwegianVehicleTax(ice({ propulsion: { pistonCombustionEngine: false, externallyChargeable: false, evidence: "listing_claim" } })))).toContain("propulsion_evidence_insufficient");
    const unk = calculateNorwegianVehicleTax(ice({ propulsion: { pistonCombustionEngine: null, externallyChargeable: null, evidence: "type_approval" } }));
    expect(codes(unk)).toContain("propulsion_unknown");
    expect(unk.missingInputs).toContain("propulsion");
  });
  it("drivstoff (bensin/diesel) og merkenavn er ikke en del av avgiftsinput og endrer aldri resultatet", () => {
    const withLabel = (label: string) => ({ ...ice(), fuelLabel: label, marketingName: "e-tron" }) as unknown as TaxInput;
    expect(calculateNorwegianVehicleTax(withLabel("petrol"))).toEqual(calculateNorwegianVehicleTax(withLabel("diesel")));
    expect(calculateNorwegianVehicleTax(withLabel("petrol"))).toEqual(calculateNorwegianVehicleTax(ice()));
  });
  it("ikke-støttet kjøretøyklasse blokkeres", () => {
    expect(codes(calculateNorwegianVehicleTax(ice({ vehicleClass: "van_class_2" })))).toContain("vehicle_class_unsupported");
  });
});

describe("vektkomponenter: EV får bare generell, forbrenningsmotor får tillegg", () => {
  const ev = (kg: number): TaxInput => ice({ propulsion: { pistonCombustionEngine: false, externallyChargeable: false, evidence: "type_approval" }, norwegianTaxWeight: { kg, basis: "vehicle_register" }, co2: { gramsPerKm: null, method: "wltp_combined" } });
  it("EV 2 185 kg: bare (2185−500)×12,71 = 21 416,35; ingen 260-komponent og ingen CO₂", () => {
    const r = calculateNorwegianVehicleTax(ev(2185));
    expect(r.components.map((c) => c.id)).toEqual(["general_weight"]);
    expect(r.components[0]!.amountExact).toBe("21416.35");
    expect(r.preDeductionExact).toBe("21416.35");
  });
  it("samme vekt som ICE gir tillegg (2185−1200)×260 = 256 100 og CO₂", () => {
    const r = calculateNorwegianVehicleTax(ice({ norwegianTaxWeight: { kg: 2185, basis: "vehicle_register" } }));
    expect(r.components.map((c) => [c.id, c.amountExact])).toEqual([["general_weight", "21416.35"], ["combustion_weight", "256100"], ["co2", "252800"]]);
  });
  it("terskler: 500 og 1 200 kg gir 0 i hver komponent; én kg over gir én sats", () => {
    const amount = (kg: number, id: string, input = ice) => calculateNorwegianVehicleTax(input({ norwegianTaxWeight: { kg, basis: "vehicle_register" }, co2: { gramsPerKm: 0, method: "wltp_combined" } })).components.find((c) => c.id === id)!.amountExact;
    expect(amount(500, "general_weight")).toBe("0");
    expect(amount(501, "general_weight")).toBe("12.71");
    expect(amount(1200, "combustion_weight")).toBe("0");
    expect(amount(1201, "combustion_weight")).toBe("260");
    expect(amount(300, "general_weight")).toBe("0");
  });
  it("ugyldig vekt blokkeres; ukjent vekt gir missing input", () => {
    const miss = calculateNorwegianVehicleTax(ice({ norwegianTaxWeight: { kg: null, basis: "unverified" } }));
    expect(codes(miss)).toContain("tax_weight_missing");
    expect(miss.missingInputs).toContain("norwegianTaxWeight.kg");
    for (const kg of [0, -5, 1976.5, 25000]) expect(codes(calculateNorwegianVehicleTax(ice({ norwegianTaxWeight: { kg, basis: "vehicle_register" } }))), String(kg)).toContain("tax_weight_invalid");
  });
  it("uverifisert vektgrunnlag gir advarsel, ikke blokkering", () => {
    const r = calculateNorwegianVehicleTax(ice({ norwegianTaxWeight: { kg: 1976, basis: "reference_listing" } }));
    expect(r.status).toBe("calculated_unverified");
    expect(r.warnings.map((w) => w.code)).toContain("weight_basis_not_verified");
  });
});

describe("CO₂: marginale bånd (T40) og målegrunnlag (§ 3-1)", () => {
  const co2 = (g: number) => Number(calculateNorwegianVehicleTax(ice({ norwegianTaxWeight: { kg: 500, basis: "vehicle_register" }, co2: { gramsPerKm: g, method: "wltp_combined" }, firstRegistration: { precision: "none", value: null } })).components.find((c) => c.id === "co2")!.amountExact);
  it("båndgrenser 0/100/101/150/151/225/226", () => {
    expect([0, 100, 101, 150, 151, 225, 226, 300].map(co2)).toEqual([0, 80000, 81600, 160000, 163200, 400000, 405000, 775000]);
  });
  it("er progressive, ikke flat sats: 179 g/km = 80 000 + 80 000 + 29×3 200 (ikke 179×3 200)", () => {
    expect(co2(179)).toBe(252800);
    expect(co2(179)).not.toBe(179 * 3200);
  });
  it("PHEV må bruke «vektet kombinert»; vanlig ICE kan ikke bruke det; mangler/ugyldig blokkeres", () => {
    const phev = (method: TaxInput["co2"]["method"], g: number | null = 140): TaxInput => ice({ propulsion: { pistonCombustionEngine: true, externallyChargeable: true, evidence: "type_approval" }, co2: { gramsPerKm: g, method } });
    expect(calculateNorwegianVehicleTax(phev("wltp_weighted_combined")).status).toBe("calculated_unverified");
    expect(codes(calculateNorwegianVehicleTax(phev("wltp_combined")))).toContain("phev_requires_weighted_combined_co2");
    expect(codes(calculateNorwegianVehicleTax(ice({ co2: { gramsPerKm: 150, method: "wltp_weighted_combined" } })))).toContain("co2_field_mismatch");
    expect(codes(calculateNorwegianVehicleTax(ice({ co2: { gramsPerKm: null, method: "wltp_combined" } })))).toContain("co2_missing");
    expect(codes(calculateNorwegianVehicleTax(ice({ co2: { gramsPerKm: 12.5, method: "wltp_combined" } })))).toContain("co2_invalid");
  });
  it("PHEV beholder ICE-komponentene (§ 3: stempeldrevet forbrenningsmotor) og har ingen vektfradrag", () => {
    const r = calculateNorwegianVehicleTax(ice({ propulsion: { pistonCombustionEngine: true, externallyChargeable: true, evidence: "type_approval" }, co2: { gramsPerKm: 140, method: "wltp_weighted_combined" } }));
    expect(r.powertrain).toBe("phev");
    expect(r.components.map((c) => c.id)).toEqual(["general_weight", "combustion_weight", "co2"]);
  });
  it("NEDC, egenvekt/10 og ukjent metode før 1.9.2018 blokkeres (avrunding av omregnet CO₂ uten kilde); ukjent metode etter støttes som WLTP", () => {
    expect(codes(calculateNorwegianVehicleTax(ice({ co2: { gramsPerKm: 150, method: "nedc" } })))).toContain("co2_nedc_unsupported");
    expect(codes(calculateNorwegianVehicleTax(ice({ co2: { gramsPerKm: null, method: "not_wltp_or_nedc_approved" } })))).toContain("co2_fallback_unsupported");
    expect(codes(calculateNorwegianVehicleTax(ice({ firstRegistration: { precision: "day", value: "2018-08-31" }, co2: { gramsPerKm: 150, method: "unspecified" } })))).toContain("co2_nedc_unsupported");
    expect(calculateNorwegianVehicleTax(ice({ firstRegistration: { precision: "day", value: "2018-09-01" }, co2: { gramsPerKm: 150, method: "unspecified" } })).status).toBe("calculated_unverified");
    expect(calculateNorwegianVehicleTax(ice({ firstRegistration: { precision: "none", value: null }, co2: { gramsPerKm: 150, method: "unspecified" } })).status).toBe("calculated_unverified");
  });
});

describe("bruksfradrag: dato til dato, trinngrenser", () => {
  const pct = (first: string, nor: string) => lookupDeduction(table, first, nor).percent;
  it("2 år 6 måneder fra 2023-11-01 nås 2026-05-01 (26 % → 30 %); 3 år 2026-11-01 (30 % → 33 %)", () => {
    expect([pct("2023-11-01", "2026-04-30"), pct("2023-11-01", "2026-05-01"), pct("2023-11-01", "2026-10-31"), pct("2023-11-01", "2026-11-01")]).toEqual([26, 30, 30, 33]);
  });
  it("første trinn: 1 måned fra 2026-09-01 nås 2026-10-01; samme dag = 0 %", () => {
    expect([pct("2026-09-01", "2026-09-01"), pct("2026-09-01", "2026-09-30"), pct("2026-09-01", "2026-10-01"), pct("2026-09-01", "2026-10-31"), pct("2026-09-01", "2026-11-01")]).toEqual([0, 0, 2, 2, 4]);
  });
  it("hele år: rundskrivets eksempel 15. januar → ett-års fradrag 15. januar året etter", () => {
    expect([pct("2025-01-15", "2026-01-14"), pct("2025-01-15", "2026-01-15")]).toEqual([18, 19]);
  });
  it("20-årsregelen: 100 % fra 1. januar i året det har gått 20 år, ikke på fødselsdagen", () => {
    const r1 = lookupDeduction(table, "2006-06-15", "2025-12-31");
    expect(r1.percent).toBe(98);
    expect(r1.twentyYearRule).toBe(false);
    const r2 = lookupDeduction(table, "2006-06-15", "2026-01-01");
    expect([r2.percent, r2.twentyYearRule]).toEqual([100, true]);
    expect(lookupDeduction(table, "2006-12-31", "2026-01-01").percent).toBe(100);
  });
  it("kortere målmåned (dag 29–31): to kandidater; ulikt trinn ⇒ ambiguous (kilden er taus)", () => {
    expect(lookupDeduction(table, "2023-01-31", "2023-02-27")).toMatchObject({ percent: 0, ambiguous: false });
    expect(lookupDeduction(table, "2023-01-31", "2023-02-28")).toMatchObject({ ambiguous: true });
    expect(lookupDeduction(table, "2023-01-31", "2023-03-01")).toMatchObject({ percent: 2, ambiguous: false });
    expect(lookupDeduction(table, "2024-02-29", "2025-02-28").ambiguous).toBe(true);
    expect(lookupDeduction(table, "2024-02-29", "2025-03-01").ambiguous).toBe(false);
    const r = calculateNorwegianVehicleTax(ice({ firstRegistration: { precision: "day", value: "2026-01-31" }, norwegianRegistration: { date: "2026-02-28", kind: "expected" } }));
    expect(codes(r)).toEqual(["age_step_boundary_ambiguous"]);
    expect(r.status).toBe("blocked");
  });
  it("norsk registrering før første registrering kaster/ blokkeres", () => {
    expect(() => lookupDeduction(table, "2026-09-01", "2026-08-31")).toThrow();
    expect(codes(calculateNorwegianVehicleTax(ice({ firstRegistration: { precision: "day", value: "2026-09-01" }, norwegianRegistration: { date: "2026-08-31", kind: "expected" } })))).toContain("norwegian_registration_before_first_registration");
  });
  it("ny motorvogn (ikke registrert i utlandet): 0 % og advarsel", () => {
    const r = calculateNorwegianVehicleTax(ice({ firstRegistration: { precision: "none", value: null } }));
    expect(r.ageDeduction?.percent).toBe(0);
    expect(r.warnings.map((w) => w.code)).toContain("new_vehicle_no_deduction");
  });
});

describe("registreringspresisjon (ECON-001 §4.1)", () => {
  it("bare år ⇒ blokkert; ingen 1. januar antas, ingen avgift vises", () => {
    const r = calculateNorwegianVehicleTax(ice({ firstRegistration: { precision: "year", value: "2023" } }));
    expect(r.status).toBe("blocked");
    expect(codes(r)).toEqual(["registration_precision_insufficient"]);
    expect(r.totalRegistrationTaxesExact).toBeNull();
    expect(r.totalIntegerBounds).toBeNull();
    expect(r.ageDeduction).toBeNull();
  });
  it("manglende/ukjent første registrering og ugyldig verdi blokkeres", () => {
    expect(codes(calculateNorwegianVehicleTax(ice({ firstRegistration: { precision: "unknown", value: null } })))).toEqual(["first_registration_missing"]);
    expect(codes(calculateNorwegianVehicleTax(ice({ firstRegistration: { precision: "month", value: "2023-13" } })))).toEqual(["first_registration_invalid"]);
    expect(codes(calculateNorwegianVehicleTax(ice({ firstRegistration: { precision: "day", value: "2023-02-30" } })))).toEqual(["first_registration_invalid"]);
  });
  it("måned + år ⇒ arbeidsdato første dag, bevart som avledet, med følsomhet mot siste dag", () => {
    const r = calculateNorwegianVehicleTax(ice({ firstRegistration: { precision: "month", value: "2026-09" }, norwegianRegistration: { date: "2026-10-18", kind: "expected", defaulted: true } }));
    expect(r.ageDeduction).toMatchObject({ workingFirstRegistration: "2026-09-01", workingDateDerived: true, percent: 2 });
    expect(r.monthSensitivity).toMatchObject({ alternativeWorkingDate: "2026-09-30", alternativeDeductionPercent: 0 });
    expect(r.warnings.map((w) => w.code)).toEqual(expect.arrayContaining(["month_precision_sensitivity", "norwegian_registration_defaulted"]));
  });
  it("manglende eller ugyldig norsk registreringsdato blokkeres", () => {
    expect(codes(calculateNorwegianVehicleTax(ice({ norwegianRegistration: { date: null, kind: "expected" } })))).toContain("norwegian_registration_missing");
    expect(codes(calculateNorwegianVehicleTax(ice({ norwegianRegistration: { date: "2026-02-30", kind: "expected" } })))).toContain("norwegian_registration_invalid");
  });
});

describe("profilens gyldighet (styrende hendelse = norsk registrering)", () => {
  it("før 2026-01-01 og etter 2026-12-31 finnes ingen profil ⇒ blokkert (ikke 2026-satser)", () => {
    for (const d of ["2025-12-31", "2027-01-01"]) {
      const r = calculateNorwegianVehicleTax(ice({ norwegianRegistration: { date: d, kind: "expected" } }));
      expect(r.status, d).toBe("blocked");
      expect(codes(r), d).toEqual(["no_profile_for_date"]);
    }
    expect(calculateNorwegianVehicleTax(ice({ norwegianRegistration: { date: "2026-01-01", kind: "expected" } })).status).toBe("calculated_unverified");
    expect(calculateNorwegianVehicleTax(ice({ norwegianRegistration: { date: "2026-12-31", kind: "expected" } })).status).toBe("calculated_unverified");
  });
  it("uttrykkelig utløpt profil blokkeres med egen årsak", () => {
    const expired: TaxProfile = { ...NO_OTA_2026_A_PB, validTo: "2026-06-30" };
    const r = calculateNorwegianVehicleTax(ice({ norwegianRegistration: { date: "2026-07-01", kind: "expected" } }), expired);
    expect(codes(r)).toEqual(["profile_not_valid_for_date"]);
  });
  it("etter satsoversiktens dato (2026-05-01) følger en advarsel om uverifiserte senere endringer", () => {
    const before = calculateNorwegianVehicleTax(ice({ norwegianRegistration: { date: "2026-05-01", kind: "expected" } }));
    const after = calculateNorwegianVehicleTax(ice({ norwegianRegistration: { date: "2026-05-02", kind: "expected" } }));
    expect(before.warnings.map((w) => w.code)).not.toContain("rates_verified_as_of");
    expect(after.warnings.map((w) => w.code)).toContain("rates_verified_as_of");
  });
});

describe("gyldige tilfeller er aldri «godkjent»; avrunding er åpen (U-010)", () => {
  it("status er calculated_unverified, profilen ikke godkjent, åpne punkter følger resultatet", () => {
    const r = calculateNorwegianVehicleTax(GOLDEN_CASES[2]!.input);
    expect(r.status).toBe("calculated_unverified");
    expect(r.evidence).toMatchObject({ parameterEvidenceLevel: "E1", profileApproved: false });
    expect(r.evidence!.openItems.join(" ")).toMatch(/U-010/);
    expect(r.rounded).toBeNull();
  });
  it("vrakpant er separat, 2 400 og reduseres ikke av bruksfradrag; oneOff + vrakpant = total", () => {
    const r = calculateNorwegianVehicleTax(GOLDEN_CASES[2]!.input);
    expect(r.scrappageDeposit).toEqual({ amountNok: 2400, ruleRef: "R-IMP-OTH-001", reducedByAgeDeduction: false });
    expect(toExactString(add(dec(r.oneOffTaxExact!), decInt(2400)))).toBe(r.totalRegistrationTaxesExact);
  });
  it("heltallsgrenser (én sluttavrunding) og eksplisitt policy er adskilt og merket uten kilde", () => {
    const r = calculateNorwegianVehicleTax(GOLDEN_CASES[2]!.input, undefined, { rounding: "floor_whole_nok" });
    expect(r.totalIntegerBounds).toEqual({ lower: 333723, upper: 333724, assumption: "single_final_whole_nok_rounding" });
    expect(r.rounded).toEqual({ policy: "floor_whole_nok", evidence: "none_in_sources", oneOffTaxNok: 331323, totalRegistrationTaxesNok: 333723 });
  });
  it("deterministisk: samme input to ganger gir identisk resultat og inputen muteres ikke", () => {
    const input = JSON.parse(JSON.stringify(GOLDEN_CASES[0]!.input)) as TaxInput;
    const snapshot = JSON.stringify(input);
    expect(calculateNorwegianVehicleTax(input)).toEqual(calculateNorwegianVehicleTax(input));
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});

describe("gyldne caser (validering mot offisielle verdier; ikke regelkilde)", () => {
  const EXPECTED = { "CASE-001": 529069, "CASE-002": 16748, "CASE-003": 333723 } as const;
  const EXACT = { "CASE-001": "529069.738", "CASE-002": "16748.9545", "CASE-003": "333723.972" } as const;
  it("de forventede offisielle verdiene er låst", () => {
    expect(Object.fromEntries(GOLDEN_CASES.map((c) => [c.id, c.expectedTotalNok]))).toEqual(EXPECTED);
  });
  for (const c of GOLDEN_CASES) {
    it(`${c.id} ${c.label}: eksakt desimal fra kilde-belagte regler; hele kroner = offisielt beløp`, () => {
      const r = calculateNorwegianVehicleTax(c.input);
      expect(r.status).toBe("calculated_unverified");
      expect(r.totalRegistrationTaxesExact).toBe(EXACT[c.id as keyof typeof EXACT]);
      expect(r.totalIntegerBounds!.lower).toBe(c.expectedTotalNok); // heltallsdelen er det offisielle beløpet
    });
  }
  it("komponentene: CASE-001 PHEV, CASE-002 EV (ingen 260), CASE-003 diesel", () => {
    const comp = (id: string) => Object.fromEntries(calculateNorwegianVehicleTax(GOLDEN_CASES.find((c) => c.id === id)!.input).components.map((x) => [x.id, x.amountExact]));
    expect(comp("CASE-001")).toEqual({ general_weight: "26818.1", combustion_weight: "366600", co2: "144000" });
    expect(comp("CASE-002")).toEqual({ general_weight: "21416.35" });
    expect(comp("CASE-003")).toEqual({ general_weight: "18759.96", combustion_weight: "201760", co2: "252800" });
  });
  it("bruksfradrag per case ved beregningsdato 2026-10-18: 2 %, 33 %, 30 %", () => {
    expect(GOLDEN_CASES.map((c) => calculateNorwegianVehicleTax(c.input).ageDeduction!.percent)).toEqual([2, 33, 30]);
  });
  it("VALIDERINGSOBSERVASJON (ikke regel): avrunding ned av engangsavgiften gir de offisielle beløpene, nærmeste krone gir ingen — kilden er ikke funnet", () => {
    const floor = GOLDEN_CASES.map((c) => calculateNorwegianVehicleTax(c.input, undefined, { rounding: "floor_whole_nok" }).rounded!.totalRegistrationTaxesNok);
    const near = GOLDEN_CASES.map((c) => calculateNorwegianVehicleTax(c.input, undefined, { rounding: "half_up_whole_nok" }).rounded!.totalRegistrationTaxesNok);
    expect(floor).toEqual([529069, 16748, 333723]);
    expect(near).toEqual([529070, 16749, 333724]);
    // Motoren velger ikke noen policy selv: uten uttrykkelig valg finnes ingen avrundet verdi.
    expect(calculateNorwegianVehicleTax(GOLDEN_CASES[0]!.input).rounded).toBeNull();
  });
  it("CASE-001 måned-presisjon: siste dag i september ville gitt 0 % og høyere avgift (følsomhet vist)", () => {
    const r = calculateNorwegianVehicleTax(GOLDEN_CASES[0]!.input);
    expect(r.monthSensitivity).toMatchObject({ alternativeDeductionPercent: 0, alternativeTotalRegistrationTaxesExact: "539818.1" });
  });
  it("om kalkulatorkjøringen var 2026-10-01 eller 2026-11-01 (trinngrenser) endres fradragene — viser at kjøredato må dokumenteres", () => {
    const at = (c: number, d: string) => calculateNorwegianVehicleTax({ ...GOLDEN_CASES[c]!.input, norwegianRegistration: { date: d, kind: "expected" } }).ageDeduction!.percent;
    expect([at(0, "2026-09-30"), at(0, "2026-10-01"), at(0, "2026-11-01")]).toEqual([0, 2, 4]);
    expect([at(2, "2026-10-31"), at(2, "2026-11-01")]).toEqual([30, 33]);
  });
});

describe("domenekode for avgift er uavhengig og uten float", () => {
  it("src/domain/tax importerer bare lokale filer og bruker ikke Math.round/toFixed/parseFloat", () => {
    const dir = join(ROOT, "src/domain/tax");
    for (const f of ["age-deduction", "calculate", "dates", "decimal", "index", "profile-no-2026-a", "types"]) {
      const text = readFileSync(join(dir, `${f}.ts`), "utf8");
      for (const m of text.matchAll(/from\s+["']([^"']+)["']/g)) expect(m[1]!.startsWith("."), `${f} → ${m[1]}`).toBe(true);
      // Månedsaritmetikk i dates.ts bruker heltalls-Math.floor; pengeberegning (calculate/decimal) bruker ingen Math-avrunding.
      if (["calculate", "decimal"].includes(f)) expect(text, f).not.toMatch(/Math\.(round|floor|ceil)/);
      expect(text, f).not.toMatch(/toFixed|parseFloat|Number\(\s*["'`]?\d+\.\d/);
      expect(text, f).not.toMatch(/fetch\(|process\.env|Date\.now|new Date/);
    }
  });
});

/**
 * Gyldne caser (ECON-001 §7, oppgitt av Christian, manuelt validert mot Skatteetatens kalkulator; skjermbilder/kjøredato er IKKE levert).
 * Bruk: VALIDERINGSREFERANSE/regresjon — aldri regelkilde eller kalibreringsmål. Forventede heltall endres aldri.
 * Beregningsdato (norsk registreringsdato) = 2026-10-18 etter oppdraget ECON-002; den er ikke dokumentert fra kalkulatorkjøringene.
 */
import type { TaxInput } from "@/domain/tax";

/** Dokumentasjon som kreves før et golden case kan bli klasse 1-referanse (se reviews/ECON-002.md §6). */
export const DOCUMENTATION_CHECKLIST = [
  "vehicleIdentification", // merke/modell/variant/motor (ikke VIN)
  "firstRegistrationDate", // dato (dag), ikke bare måned
  "norwegianRegistrationDateUsed", // datoen kalkulatoren fikk som norsk registreringsdato
  "calculatorRunDate", // faktisk kjøredato for kalkulatoren
  "calculatorVersionOrUrl", // side/versjon/URL og tidspunkt vist i utskriften
  "taxWeightAndDefinition", // kg + hva kalkulatoren/typegodkjenningen kalte det
  "co2ValueAndMethod", // g/km + WLTP/«vektet kombinert»
  "powertrainEvidence", // typegodkjenning/register: forbrenningsmotor? ladbar?
  "inputScreenshot",
  "resultScreenshot", // inkl. delposter hvis kalkulatoren viser dem
  "resultBreakdown", // avgift, vrakpant, bruksfradrag-prosent slik kalkulatoren viser dem
] as const;
export type ChecklistKey = (typeof DOCUMENTATION_CHECKLIST)[number];
export type ChecklistStatus = "missing" | "partial" | "provided";

export interface GoldenCase {
  id: string;
  label: string;
  /** Inputen motoren kjøres med. `norwegianRegistration` er FASTSATT TESTDATO (2026-10-18), ikke dokumentasjon på kalkulatorkjøringen. */
  input: TaxInput;
  /** Offisiell «Avgift» inkl. vrakpant (NOK). */
  expectedTotalNok: number;
  /** Status per dokumentasjonspunkt (ECON-001 §7 er eneste kilde; ingen skjermbilder levert). */
  documentation: Record<ChecklistKey, ChecklistStatus>;
}

export const TEST_DATE = "2026-10-18";
const NOR = { date: TEST_DATE, kind: "expected" as const, defaulted: true };
const DOC: Record<ChecklistKey, ChecklistStatus> = {
  vehicleIdentification: "partial", // bare modellnavn i ECON-001 §7
  firstRegistrationDate: "partial", // bare måned (arbeidsdato 1. i måneden)
  norwegianRegistrationDateUsed: "missing",
  calculatorRunDate: "missing",
  calculatorVersionOrUrl: "missing",
  taxWeightAndDefinition: "partial", // verdi oppgitt («ref.»), definisjon ukjent
  co2ValueAndMethod: "partial", // verdi og WLTP oppgitt; felt (kombinert/vektet) ikke bekreftet
  powertrainEvidence: "missing",
  inputScreenshot: "missing",
  resultScreenshot: "missing",
  resultBreakdown: "missing",
};

/** Punkter som ikke er «provided» — må leveres før klasse 1. */
export function missingDocumentation(c: GoldenCase): ChecklistKey[] {
  return DOCUMENTATION_CHECKLIST.filter((k) => c.documentation[k] !== "provided");
}

export const GOLDEN_CASES: readonly GoldenCase[] = [
  {
    id: "CASE-001",
    label: "Lamborghini Urus PHEV",
    expectedTotalNok: 529069,
    input: {
      vehicleClass: "passenger_car_m1",
      propulsion: { pistonCombustionEngine: true, externallyChargeable: true, evidence: "dealer_entered" },
      norwegianTaxWeight: { kg: 2610, basis: "dealer_entered" },
      co2: { gramsPerKm: 140, method: "wltp_weighted_combined" },
      firstRegistration: { precision: "month", value: "2026-09" },
      norwegianRegistration: NOR,
    },
    documentation: { ...DOC },
  },
  {
    id: "CASE-002",
    label: "BMW iX3 EV",
    expectedTotalNok: 16748,
    input: {
      vehicleClass: "passenger_car_m1",
      propulsion: { pistonCombustionEngine: false, externallyChargeable: true, evidence: "dealer_entered" },
      norwegianTaxWeight: { kg: 2185, basis: "dealer_entered" },
      co2: { gramsPerKm: 0, method: "wltp_combined" },
      firstRegistration: { precision: "month", value: "2023-08" },
      norwegianRegistration: NOR,
    },
    documentation: { ...DOC },
  },
  {
    id: "CASE-003",
    label: "Mercedes E 400 d 4MATIC Estate",
    expectedTotalNok: 333723,
    input: {
      vehicleClass: "passenger_car_m1",
      propulsion: { pistonCombustionEngine: true, externallyChargeable: false, evidence: "dealer_entered" },
      norwegianTaxWeight: { kg: 1976, basis: "dealer_entered" },
      co2: { gramsPerKm: 179, method: "wltp_combined" },
      firstRegistration: { precision: "month", value: "2023-11" },
      norwegianRegistration: NOR,
    },
    documentation: { ...DOC },
  },
];

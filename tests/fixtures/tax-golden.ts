/**
 * Gyldne caser (ECON-001 §7, oppgitt av Christian, manuelt validert mot Skatteetatens kalkulator; skjermbilder/kjøredato er IKKE levert).
 * Bruk: VALIDERINGSREFERANSE/regresjon — aldri regelkilde eller kalibreringsmål. Forventede heltall endres aldri.
 * Beregningsdato (norsk registreringsdato) = 2026-10-18 etter oppdraget ECON-002; den er ikke dokumentert fra kalkulatorkjøringene.
 */
import type { TaxInput } from "@/domain/tax";

export interface GoldenCase {
  id: string;
  label: string;
  input: TaxInput;
  /** Offisiell «Avgift» inkl. vrakpant (NOK). */
  expectedTotalNok: number;
}

const NOR = { date: "2026-10-18", kind: "expected" as const, defaulted: true };

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
  },
];

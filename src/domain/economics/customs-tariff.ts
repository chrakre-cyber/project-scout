/**
 * Ordinær tollavgiftssats for personbil (ECON-004, runde 34). Ren domenekode.
 * Kildebelegg (ikke godkjenning): Tolltariffen 2026, posisjon 87.03, PDF-side 501–502 (trykt 87-2/87-3), kolonnen «Ordinær» (T83, docs/tax/sources.json).
 * Alle underposisjoner for personbil (bensin, diesel, ikke-ladbar og ladbar hybrid, elektrisk, ellers; nye og brukte) har ordinær sats 0.
 * Gyldighet: utgaven er «gjeldende fra 1. januar 2026». Endringer i tolltariffen etter 1.1.2026 er IKKE kontrollert (T86), og klassifisering av det konkrete
 * kjøretøyet, sanksjoner, særtiltak og uvanlige kjøretøy/prosedyrer er ikke vurdert. Dekning her er derfor et kildebelegg, ikke en godkjent parameter.
 */
import type { TaxPowertrain } from "@/domain/tax";

export const ORDINARY_DUTY_EDITION = {
  edition: "Tolltariffen 2026",
  position: "87.03",
  validFromIso: "2026-01-01",
  validYear: 2026,
  ordinaryRatePct: 0,
  sourceRef: "T83 (Tolltariffen 2026, PDF-side 501–502)",
  amendmentsAfterEditionChecked: false,
} as const;

/** Personbilklassen kjernen støtter (avgiftsgruppe a, M1). Andre klasser (f.eks. varebil, 87.04) er ikke lest utover første tariffside og er ikke dekket. */
const COVERED_VEHICLE_CLASS = "passenger_car_m1";

export type OrdinaryDutyCoverage =
  | { covered: true; ratePct: 0; edition: typeof ORDINARY_DUTY_EDITION }
  | { covered: false; reason: string };

/**
 * Dekker det dokumenterte tariffbelegget tilfellet? Krever kjent personbilklasse, kjent drivlinjeklassifisering og en kjent (faktisk eller forventet)
 * akseptdato i tariffutgavens år. Ellers er tollavgiften ukjent — aldri antatt 0.
 */
export function ordinaryDutyCoverage(i: { vehicleClass: unknown; powertrain: TaxPowertrain | null; acceptanceDate: string | null }): OrdinaryDutyCoverage {
  if (i.vehicleClass !== COVERED_VEHICLE_CLASS) return { covered: false, reason: "kjøretøyklassen er ikke personbil (87.03) som tariffbelegget dekker" };
  if (i.powertrain === null) return { covered: false, reason: "drivlinjeklassifiseringen er ukjent, så tariffposten kan ikke bestemmes" };
  if (i.acceptanceDate === null) return { covered: false, reason: "akseptdatoen er ukjent, så tariffutgavens gyldighet kan ikke bekreftes" };
  if (i.acceptanceDate.slice(0, 4) !== String(ORDINARY_DUTY_EDITION.validYear)) return { covered: false, reason: `akseptdatoen ${i.acceptanceDate} er utenfor tariffutgaven ${ORDINARY_DUTY_EDITION.edition}` };
  return { covered: true, ratePct: 0, edition: ORDINARY_DUTY_EDITION };
}

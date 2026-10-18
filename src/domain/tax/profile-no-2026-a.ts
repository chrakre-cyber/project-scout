/**
 * Avgiftsprofil NO-OTA-2026-A-PB: engangsavgift 2026, avgiftsgruppe a, personbil (M1). Gjenbruker `docs/tax/rules.json`
 * (datedParameters DP-WEIGHT-GEN-A-2026, DP-WEIGHT-A-2026, DP-CO2-A-2026) — ingen egen regelmodell. En test sammenligner tallene her
 * med rules.json. Parametrene er E1 (lest i kildepakken, ECON-002) men IKKE godkjent (`approved: false`): godkjenning krever
 * eksplisitt parameterApproval og klasse 1-referanser (docs/tax/rules.json foundationStatus).
 */
export interface Co2Band {
  /** Eksklusiv nedre grense (g/km). */
  fromGramKm: number;
  /** Øvre grense (g/km); null = uten øvre grense. */
  toGramKm: number | null;
  /** kr per g/km for grammene i dette intervallet (marginalt/progressivt, T40). */
  ratePerGramKm: string;
}

export interface DeductionStep {
  ageMonths: number;
  percent: number;
}

export interface TaxProfile {
  id: string;
  version: string;
  taxGroup: "a";
  vehicleClass: "passenger_car_m1";
  /** Styrende hendelse: første gangs registrering i Norge (forskrift § 1-2 nr. 1). */
  governingEvent: "first_norwegian_registration";
  validFrom: string;
  /** Konservativ: budsjettårets omfang (kilden oppgir ingen eksplisitt sluttdato). */
  validTo: string;
  /** Dato for satsoversikten (T40) satsene er verifisert mot; senere endringer er ikke kontrollert. */
  ratesVerifiedAsOf: string;
  parameters: {
    generalWeight: { thresholdKg: number; ratePerKg: string; ruleRef: string; paramRef: string };
    combustionWeight: { thresholdKg: number; ratePerKg: string; ruleRef: string; paramRef: string };
    co2Bands: readonly Co2Band[];
    co2RuleRef: string;
    co2ParamRef: string;
    scrappageDepositNok: number;
    scrappageRuleRef: string;
  };
  deductionTable: readonly DeductionStep[];
  /** Brukes når registrering skjer 20 år eller mer etter første registrering (1. januar-regelen, forskrift § 3-3). */
  deductionRuleRef: string;
  sources: readonly string[];
  approval: { approved: boolean; reason: string };
  openItems: readonly string[];
}

/** T42 / forskrift § 3-3 (41 trinn; siste trinn 20 år = 100 % styres av 1. januar-regelen). */
export const DEDUCTION_STEPS_2026: readonly DeductionStep[] = [
  [1, 2], [2, 4], [3, 6], [4, 8], [5, 10], [6, 12], [7, 14], [8, 15], [9, 16], [10, 17], [11, 18], [12, 19], [14, 20], [16, 21],
  [18, 22], [20, 23], [22, 24], [24, 26], [30, 30], [36, 33], [42, 37], [48, 40], [54, 44], [60, 50], [66, 54], [72, 58], [78, 62],
  [84, 66], [90, 70], [96, 74], [102, 78], [108, 82], [120, 90], [132, 91], [144, 92], [156, 93], [168, 94], [180, 95], [192, 96],
  [216, 98], [240, 100],
].map(([ageMonths, percent]) => ({ ageMonths: ageMonths!, percent: percent! }));

export const NO_OTA_2026_A_PB: TaxProfile = {
  id: "NO-OTA-2026-A-PB",
  version: "ECON-002/1",
  taxGroup: "a",
  vehicleClass: "passenger_car_m1",
  governingEvent: "first_norwegian_registration",
  validFrom: "2026-01-01",
  validTo: "2026-12-31",
  ratesVerifiedAsOf: "2026-05-01",
  parameters: {
    generalWeight: { thresholdKg: 500, ratePerKg: "12.71", ruleRef: "R-OTA-001", paramRef: "DP-WEIGHT-GEN-A-2026" },
    combustionWeight: { thresholdKg: 1200, ratePerKg: "260", ruleRef: "R-OTA-001", paramRef: "DP-WEIGHT-A-2026" },
    co2Bands: [
      { fromGramKm: 0, toGramKm: 100, ratePerGramKm: "800" },
      { fromGramKm: 100, toGramKm: 150, ratePerGramKm: "1600" },
      { fromGramKm: 150, toGramKm: 225, ratePerGramKm: "3200" },
      { fromGramKm: 225, toGramKm: null, ratePerGramKm: "5000" },
    ],
    co2RuleRef: "R-OTA-002",
    co2ParamRef: "DP-CO2-A-2026",
    scrappageDepositNok: 2400,
    scrappageRuleRef: "R-IMP-OTH-001",
  },
  deductionTable: DEDUCTION_STEPS_2026,
  deductionRuleRef: "R-OTA-010",
  sources: ["T03", "T05", "T40", "T41", "T42"],
  approval: {
    approved: false,
    reason: "Ingen eksplisitt parameterApproval og ingen klasse 1-referanser (docs/tax/rules.json foundationStatus).",
  },
  openItems: [
    "U-010: avrunding av engangsavgiften er ikke omtalt i noen lest kilde",
    "U-011: endelig vedtatt stortingsvedtak ikke lest; satser verifisert mot Finansdepartementets oversikt (2026-05-01) og forslag",
    "U-009: månedstrinn i bruksfradrag og dag-overflyt (dag 29–31) er ikke spesifisert",
    "Gruppe a-endringer etter 2026-05-01 er ikke kontrollert",
    "Vrakpant er ikke redusert av bruksfradrag — støttet av forslag (T41 § 4) og rundskriv 3.4, ikke av endelig vedtakstekst",
  ],
};

export const TAX_PROFILES: readonly TaxProfile[] = [NO_OTA_2026_A_PB];

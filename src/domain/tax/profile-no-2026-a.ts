/**
 * Avgiftsprofil NO-OTA-2026-A-PB: engangsavgift 2026, avgiftsgruppe a, personbil (M1). Gjenbruker `docs/tax/rules.json`
 * (datedParameters DP-WEIGHT-GEN-A-2026, DP-WEIGHT-A-2026, DP-CO2-A-2026; avrunding R-OTA-014) — ingen egen regelmodell. En test sammenligner
 * tallene her med rules.json. Parametrene er kilde-belagt (E1/E1P; stortingsvedtaket FOR-2025-12-18-2755 lest) men IKKE godkjent
 * (`approved: false`): godkjenning krever eksplisitt parameterApproval og klasse 1-referanser (docs/tax/rules.json foundationStatus).
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
  /** KILDEDOKUMENTERT startdato (T41 § 1: «Fra 1. januar 2026»; T03 13.1). */
  validFrom: string;
  /** KILDEDOKUMENTERT sluttdato; null = kildene oppgir ingen (de 2026-satsene vi har lest har ingen oppgitt opphørsdato). */
  documentedValidTo: string | null;
  /** INTERN sikkerhetssperre, ikke en kildedokumentert opphørsdato: etter denne datoen regner motoren ikke uten ny kildekontroll. */
  internalSafetyLimit: { date: string; kind: "internal_guard"; basis: string };
  /** Kildedokumentert periode slik Lovdata merker vedtaket («Budsjettåret 2026»); ikke en eksplisitt sluttdato. */
  documentedPeriodLabel: string;
  /** Hentedato for den konsoliderte vedtaksteksten satsene er verifisert mot; senere endringer er ikke kontrollert. */
  ratesVerifiedAsOf: string;
  parameters: {
    generalWeight: { thresholdKg: number; ratePerKg: string; ruleRef: string; paramRef: string };
    combustionWeight: { thresholdKg: number; ratePerKg: string; ruleRef: string; paramRef: string };
    co2Bands: readonly Co2Band[];
    co2RuleRef: string;
    co2ParamRef: string;
    scrappageDepositNok: number;
    scrappageRuleRef: string;
    /** Skattebetalingsforskriften § 10-4-4: avrund ned til hele kroner — bare det samlede kravet (R-OTA-014, E1P); mellomledd avrundes ikke (U-012). */
    rounding: { ruleRef: string; scope: "final_claim"; direction: "down"; unit: "whole_nok"; basis: string };
  };
  deductionTable: readonly DeductionStep[];
  /** Brukes når registrering skjer 20 år eller mer etter første registrering (1. januar-regelen, forskrift § 3-3). */
  deductionRuleRef: string;
  sources: readonly string[];
  /** `class1References`: antall klasse 1-referanser (docs/tax/references.json) som dekker profilen. 3 i dag (PHEV, EV, diesel). */
  approval: { approved: boolean; class1References: number; reason: string };
  /** Regelnivå (docs/tax/rules.json evidenceLevel) per regel profilen anvender; en test holder dem lik registeret. */
  ruleEvidence: Readonly<Record<string, "E1" | "E1P">>;
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
  documentedValidTo: null,
  internalSafetyLimit: {
    date: "2026-12-31",
    kind: "internal_guard",
    basis: "Vedtaket er «for 2026» og merket «Budsjettåret 2026» (Lovdata), men teksten har ingen eksplisitt sluttdato. Sperren hindrer at 2026-satser stilltiende brukes for 2027 uten ny kildekontroll.",
  },
  documentedPeriodLabel: "Budsjettåret 2026",
  ratesVerifiedAsOf: "2026-10-18",
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
    rounding: { ruleRef: "R-OTA-014", scope: "final_claim", direction: "down", unit: "whole_nok", basis: "skattebetalingsforskriften § 10-4-4 (T46); håndbok (T45)" },
  },
  deductionTable: DEDUCTION_STEPS_2026,
  deductionRuleRef: "R-OTA-010",
  sources: ["T03", "T05", "T40", "T42", "T43", "T44", "T45", "T46", "T47", "T48", "T49"],
  ruleEvidence: {
    "R-OTA-001": "E1",
    "R-OTA-002": "E1", // avgrenset: gruppe a, WLTP, hele g/km (NEDC/egenvekt-10 = R-OTA-015, blokkert)
    "R-OTA-005": "E1",
    "R-OTA-007": "E1",
    "R-OTA-010": "E1", // avgrenset: trinndato finnes; dag 29–31 = R-OTA-016 (U-009), blokkert i vinduet
    "R-IMP-OTH-001": "E1",
    "R-OTA-014": "E1P",
  },
  approval: {
    approved: false,
    class1References: 3,
    reason: "Ingen eksplisitt parameterApproval. Tre klasse 1-referanser (PHEV, EV og diesel, 18.10.2026) er registrert; klasse 1 er ikke godkjenning, og R-OTA-014 er E1P (docs/tax/rules.json foundationStatus).",
  },
  openItems: [
    "U-012: avrunding av mellomledd er ikke omtalt i noen kilde; motoren avrunder bare sluttkravet",
    "R-OTA-014 er E1P: skattebetalingsforskriften § 10-4-4 nevner ikke engangsavgift uttrykkelig (anvendelsen følger av skattebetalingsloven § 1-1 (2) i, § 10-40 (1) c og forskriften § 10-4-1 d)",
    "U-009 / R-OTA-016: trinndato som ikke finnes i målmåneden (dag 29–31) er ikke spesifisert; blokkert i vinduet",
    "20 år eller eldre: § 3-3-setningen om minimumsavgift er ikke utledet (R-OTA-011); motoren blokkerer (twenty_year_minimum_unresolved) og gir ikke sluttkrav",
    "R-OTA-015: NEDC, egenvekt/10 og desimal-CO₂ er blokkert (avrunding av desimaler mangler kilde)",
    "PHEV: anvendelsen hviler på det tekniske vilkåret i § 3 og på forskrift § 3-1 (E1-tekst); forutsetter dokumentert stempeldrevet motor og ekstern lading per kjøretøy",
    "Ingen eksplisitt sluttdato for 2026-satsene (intern sikkerhetssperre); endringer etter hentedato 2026-10-18 og lov 19 juni 2026 nr. 41 er ikke kontrollert",
    "Ingen parameter er godkjent og ingen klasse 1-referanse finnes",
  ],

};

export const TAX_PROFILES: readonly TaxProfile[] = [NO_OTA_2026_A_PB];

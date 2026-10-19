/**
 * Normalisert avgiftsinput og -resultat for norsk engangsavgift (ECON-002). Bare avgiftsdata: ingen valuta, kurs, transport,
 * leverandør, annonse, UI eller benchmark. Input utledes oppstrøms fra dokumenterte tekniske data, aldri fra markedsføringsnavn.
 */
export type RegistrationPrecision = "day" | "month" | "year" | "none" | "unknown";

export interface FirstRegistrationInput {
  /** `none` = ikke registrert i utlandet før norsk registrering (ny motorvogn, forskrift § 3-2). */
  precision: RegistrationPrecision;
  /** «YYYY-MM-DD» | «YYYY-MM» | «YYYY» (etter presisjon). Ukjent/mangler ⇒ null. */
  value: string | null;
}

export interface NorwegianRegistrationInput {
  /** Forventet eller faktisk dato for første gangs registrering i Norge (styrende hendelse, forskrift § 1-2 nr. 1). */
  date: string | null;
  kind: "expected" | "actual";
  /** true når datoen er standardverdien (beregningsdato), ikke oppgitt av forhandleren (`assumed-default`). */
  defaulted?: boolean;
}

export type PropulsionEvidence = "type_approval" | "vehicle_register" | "dealer_entered" | "listing_claim";

/** Teknisk drivlinjegrunnlag. «Elbil», «hybrid» e.l. fra annonsetekst er ikke et grunnlag (`listing_claim` blokkerer). */
export interface PropulsionInput {
  /** Stempeldrevet forbrenningsmotor (stortingsvedtaket § 3). null = ukjent. */
  pistonCombustionEngine: boolean | null;
  /** Kan lades fra ekstern kilde (ladbar hybrid). null = ukjent. */
  externallyChargeable: boolean | null;
  evidence: PropulsionEvidence;
}

/**
 * Grunnlaget for avgiftsvekten. Policy (2026-10-19, beslutning av Christian): det er DOKUMENTERT GRUNNLAG, ikke inntastingsmåten, som avgjør.
 * `eu_type_approval_minimum_mass` / `vehicle_register`: verdi med dokumentert grunnlag i typegodkjenning (minimumsvekt) eller kjøretøyregister, også når den er
 * lagt inn manuelt. `dealer_entered`: forhandleroppgitt vekt UTEN dokumentert grunnlag ⇒ estimat. `reference_listing` / `unverified` ⇒ estimat.
 */
export type WeightBasis = "eu_type_approval_minimum_mass" | "vehicle_register" | "dealer_entered" | "reference_listing" | "unverified";

export type Co2Method =
  | "wltp_combined"
  | "wltp_weighted_combined"
  | "epa_nrcan"
  | "nedc"
  | "not_wltp_or_nedc_approved"
  | "unspecified";

export interface TaxInput {
  /** Bare «passenger_car_m1» (avgiftsgruppe a, personbil) støttes. */
  vehicleClass: string;
  propulsion: PropulsionInput;
  norwegianTaxWeight: { kg: number | null; basis: WeightBasis };
  co2: { gramsPerKm: number | null; method: Co2Method };
  firstRegistration: FirstRegistrationInput;
  norwegianRegistration: NorwegianRegistrationInput;
}

export type TaxPowertrain = "bev" | "phev" | "ice";

export type BlockCode =
  | "vehicle_class_unsupported"
  | "propulsion_unknown"
  | "propulsion_evidence_insufficient"
  | "tax_weight_missing"
  | "tax_weight_invalid"
  | "co2_missing"
  | "co2_invalid"
  | "co2_field_mismatch"
  | "co2_nedc_unsupported"
  | "co2_fallback_unsupported"
  | "phev_requires_weighted_combined_co2"
  | "first_registration_missing"
  | "registration_precision_insufficient"
  | "first_registration_invalid"
  | "norwegian_registration_missing"
  | "norwegian_registration_invalid"
  | "norwegian_registration_before_first_registration"
  | "age_step_boundary_ambiguous"
  | "twenty_year_minimum_unresolved"
  | "no_profile_for_date"
  | "profile_not_valid_for_date"
  | "profile_internal_limit_exceeded";

export interface Blocker {
  code: BlockCode;
  message: string;
  /** Kun `age_step_boundary_ambiguous`: hvilket trinn og de to kandidatdatoene kilden ikke skiller mellom (U-009). */
  detail?: { stepMonths: number; clampedDate: string; rolledDate: string; norwegianDate: string; viaMonthPrecisionAlternative: boolean };
}

export type WarningCode =
  | "rates_verified_as_of"
  | "norwegian_registration_defaulted"
  | "weight_basis_not_verified"
  | "propulsion_dealer_entered"
  | "month_precision_sensitivity"
  | "new_vehicle_no_deduction";

export interface Warning {
  code: WarningCode;
  message: string;
}

export interface TaxComponent {
  id: "general_weight" | "combustion_weight" | "co2";
  label: string;
  /** Beregningsgrunnlag i klartekst, f.eks. «(2185 − 500) kg × 12.71 kr/kg». */
  basis: string;
  /** Eksakt desimalstreng i NOK. */
  amountExact: string;
  ruleRef: string;
  /** Satt når komponenten hviler på et uverifisert/udokumentert input (vekt): beregningen er beholdt, men beløpet er et estimat. */
  estimate?: { reasons: EstimateReason[] };
}

export interface AgeDeductionResult {
  percent: number;
  /** Alder (dato til dato) i hele måneder ved norsk registrering; null ved ny motorvogn. */
  ageCompletedMonths: number | null;
  stepLabel: string | null;
  /** Arbeidsdato for første registrering (avledet første dag i måneden hvis presisjon = month). */
  workingFirstRegistration: string | null;
  workingDateDerived: boolean;
  norwegianRegistrationDate: string;
  norwegianRegistrationKind: "expected" | "actual";
  twentyYearRule: boolean;
}

export interface MonthSensitivity {
  alternativeWorkingDate: string;
  alternativeDeductionPercent: number;
  alternativeTotalRegistrationTaxesExact: string;
  alternativeTotalRegistrationTaxesNok: number;
  message: string;
}

export interface ProfileRef {
  id: string;
  version: string;
  taxGroup: "a";
  /** Kildedokumentert startdato. */
  validFrom: string;
  documentedPeriodLabel: string;
  /** Kildedokumentert sluttdato; null = ikke oppgitt i kildene. */
  documentedValidTo: string | null;
  /** Intern sperre (ikke kildedokumentert opphør). */
  internalSafetyLimit: { date: string; kind: "internal_guard" };
  ratesVerifiedAsOf: string;
  approved: boolean;
}

/**
 * Valgt oppførsel som kilden IKKE uttrykkelig beskriver (implementasjonskonklusjon, ikke kildebelagt regel). Skilt fra `assumptions`
 * slik at det er tydelig hva som er kilde og hva som er motorens egen slutning.
 */
export interface ImplementationConclusion {
  code: "month_steps_same_anniversary_rule" | "overflow_dates_outside_window_monotonic" | "no_intermediate_rounding";
  statement: string;
  sourceStatus: "not_expressly_described";
}

/**
 * Valideringsstatus som ALLTID følger et beregnet beløp (`finalClaim` og `validation`). `estimate_not_approved` betyr: regnet etter
 * kilde-belagte regler, men IKKE godkjent og ikke validert mot klasse 1-referanse — må ikke presenteres som godkjent/validert avgift.
 * `approved` kan bare oppstå når profilen er godkjent OG har klasse 1-referanse OG alle anvendte regler er E1 (ikke tilfelle i dag).
 */
/** Årsaker til at et beløp er et estimat selv om regelprofilen er godkjent (kvalitet/entydighet i inputene, ikke regelgrunnlaget). */
export type EstimateReason = "weight_reference_only" | "weight_dealer_entered_undocumented" | "first_registration_date_sensitive";

export interface ValidationStatus {
  /** `approved` krever BÅDE godkjent regelprofil (+ klasse 1, E1) OG entydig, verifisert input (`inputResolution = "resolved"`). */
  status: "estimate_not_approved" | "approved";
  /** Regelprofilen (satser/regler) er godkjent. Signalet er skilt fra `inputResolution`: en godkjent profil gjør ikke et estimat til et godkjent beløp. */
  profileApproved: boolean;
  /** `resolved`: ingen kjent inputusikkerhet som endrer kravet. `estimate`: se `estimateReasons`; punktbeløpet er ikke et godkjent sluttkrav. */
  inputResolution: "resolved" | "estimate";
  estimateReasons: EstimateReason[];
  class1References: number;
  weakestRuleEvidence: "E1" | "E1P";
  appliedRules: Array<{ ruleRef: string; evidence: "E1" | "E1P" }>;
}

export interface TaxResult {
  /**
   * `calculated_unverified`: regnet eksakt etter kilde-belagte regler, men IKKE godkjent (se `validation`). `calculated` forutsetter at
   * profilen er godkjent, har klasse 1-referanse og at alle anvendte regler er E1 — det er ikke tilfelle i dag, og en vellykket beregning
   * alene gir aldri `calculated`.
   */
  status: "blocked" | "calculated" | "calculated_unverified";
  profile: ProfileRef | null;
  powertrain: TaxPowertrain | null;
  components: TaxComponent[];
  preDeductionExact: string | null;
  ageDeduction: AgeDeductionResult | null;
  oneOffTaxExact: string | null;
  scrappageDeposit: { amountNok: number; ruleRef: string; reducedByAgeDeduction: false } | null;
  totalRegistrationTaxesExact: string | null;
  /**
   * Det samlede kravet avrundet ned til hele kroner (skattebetalingsforskriften § 10-4-4; R-OTA-014, E1). Bare sluttbeløpet avrundes;
   * komponenter og prosentfradrag er eksakte desimaler (U-012). Vrakpantavgiften er et helt tall, så floor(total) = floor(avgift) + vrakpant.
   */
  finalClaim: { ruleRef: "R-OTA-014"; basis: "skattebetalingsforskriften § 10-4-4: ned til nærmeste hele krone"; evidence: "E1" | "E1P"; oneOffTaxNok: number; scrappageDepositNok: number; totalRegistrationTaxesNok: number; validation: ValidationStatus } | null;
  /** Samme valideringsstatus på toppnivå (null når blokkert). */
  validation: ValidationStatus | null;
  monthSensitivity: MonthSensitivity | null;
  evidence: {
    /** Svakeste regelnivå blant reglene som faktisk er anvendt (ikke «E1» uten videre). */
    parameterEvidenceLevel: "E1" | "E1P";
    profileApproved: boolean;
    openItems: string[];
  } | null;
  missingInputs: string[];
  blocked: Blocker[];
  warnings: Warning[];
  implementationConclusions: ImplementationConclusion[];
}

/**
 * Landed-cost-kjernen (ECON-004): typer. Ren domenekode — ingen I/O, UI, DB, provider eller nettverk. Avgiften kommer fra avgiftsmotoren (ECON-002).
 * Beløp i NOK er hele kroner (bigint); kjøpspris og kurs er desimalstrenger. Alt som er uavklart i kildene er uttrykt som status/årsak, ikke som antatt regel.
 */
import type { TaxInput, TaxPowertrain, TaxProfile } from "@/domain/tax";
import type { RoundingPolicy } from "./rational";

export type VatRecoverability = "recoverable" | "non_recoverable" | "unknown";
/** Hvordan import-mva. oppgjøres (adskilt fra fradragsrett): registrert virksomhet rapporterer i mva-meldingen; ikke registrert betaler ved innførsel (T56). */
export type VatHandling = "registered_reports_in_vat_return" | "not_registered_pays_at_import" | "unknown";
/** Hele kroner som desimalstreng («8000»). */
export type AmountBasis = "dealer_entered" | "quoted" | "assumed_default" | "scenario_assumption";
export interface AmountInput { amount: string; basis: AmountBasis }

export interface FxQuote {
  /** «EUR/NOK». Må samsvare med annonsens valuta. */
  pair: string;
  /** Normalisert kurs: NOK per 1 enhet kildevaluta (desimalstreng). Oppgi enten `rate` eller `raw`; oppgis begge må de stemme. */
  rate?: string;
  /** Råkurs slik den er publisert (Tolletaten: NOK per `unit` enheter, desimalkomma, enhet 1 eller 100). Normaliseres nøyaktig én gang (raw.rate / unit); råverdien beholdes i resultatet. */
  raw?: { rate: string; unit: 1 | 100 };
  source: { kind: "official_customs" | "bank" | "dealer_entered" | "fixture"; ref?: string };
  /** Anskaffelseskurs: datoen kursen gjelder for (ISO). */
  effectiveAt: string | null;
  /** Når kursen ble hentet/notert (ISO-dato). */
  quotedAt: string | null;
  /** Anskaffelseskurs: siste dato kursen er gyldig. Brukes ikke for tollkurs (bruk `validFrom`/`validTo`). */
  validUntil?: string | null;
  /** Tollkurs: Tolletatens gyldighetsperiode (f.o.m./t.o.m., ISO). Fremtidige, forhåndspubliserte perioder er tillatt. */
  validFrom?: string | null;
  validTo?: string | null;
  /** Tollkurs: suspensjon etter vareførselsforskriften § 6-12-1 (2). Standard `unknown` (ikke kontrollert). */
  suspension?: "not_suspended_confirmed" | "suspended" | "unknown";
  /** true: testkurs. Avvises som produksjonskurs med mindre `allowFixtureFxQuotes` er satt (kun test). `source.kind = fixture` avvises uansett dette feltet. */
  fixtureOnly?: boolean;
}

/** Dato for aksept av tolldeklarasjonen (tollavgiftsloven § 2-2 via vareførselsforskriften § 6-12-1 (3)). Skilt fra beregningsdato og norsk registreringsdato. */
export interface CustomsAcceptanceDate {
  date: string | null;
  /** `actual_acceptance`: faktisk akseptdato oppgitt. `expected_scenario`: forventet dato (scenario). `unknown`: ikke oppgitt. Ingen av dem er verifisert av kjernen. */
  kind: "actual_acceptance" | "expected_scenario" | "unknown";
}

export interface PriceInput {
  /** ISO 4217-kode for annonsens valuta. */
  currency: string;
  advertisedGross?: string | null;
  advertisedNet?: string | null;
  /** Hva annonsen oppgir. `gross`/`unknown` gir ikke et løst kjøpsgrunnlag; netto eksportpris antas aldri fra annonsetekst. */
  priceBasis: "net" | "gross" | "unknown";
  /** Forhandlerjustert (forventet) pris; lagres adskilt fra annonseprisen. */
  dealerAdjusted?: string | null;
  /** Hvilken pris beregningen bruker. */
  use: "advertised" | "dealer_adjusted";
  /** Bevis for prisen: annonsepåstand er ikke bekreftet kjøpsgrunnlag. */
  evidence: "listing_claim" | "quote_document" | "dealer_entered";
  /**
   * Utenlandsk mva. i prisen (T88, vareførselshåndboken § 6-11): den er ikke del av tollverdiens pris når kjøperen ikke endelig belastes den, men kjøperen må
   * sannsynliggjøre det ved overgang til fri disponering. En annonsepåstand eller en oppgitt nettopris alene utleder aldri dette. Standard `unconfirmed`.
   */
  foreignVat?: ForeignVatInput;
}
export interface ForeignVatInput {
  /** `excluded_documented`: kjøperen belastes ikke utenlandsk mva. og kan dokumentere det. Aksepteres bare med bevis som ikke er en annonsepåstand. */
  treatment: "excluded_documented" | "unconfirmed";
  evidence: "invoice_or_contract" | "dealer_entered" | "listing_claim";
}

export interface DeductionStatus {
  value: VatRecoverability;
  /** Bare `dealer_entered`/`dealer_profile` godtas. Annonsetekst eller antakelse ignoreres (⇒ unknown). Utledes aldri av at brukeren er forhandler. */
  source: { kind: "dealer_entered" | "dealer_profile" | "listing_claim" | "assumed"; by?: string; at?: string };
}

export interface VatHandlingInput {
  value: VatHandling;
  /** Bare `dealer_entered`/`dealer_profile` godtas. Utledes aldri av annonse eller av ordet «forhandler». */
  source: { kind: "dealer_entered" | "dealer_profile" | "listing_claim" | "assumed"; by?: string; at?: string };
}

/**
 * Elbilfritakets kvalifikasjonskrav (mval. § 6-8 (1) via § 7-1 (1); T57, T62): personkjøretøy (FMVA § 1-3-1) som bare bruker elektrisitet fra en
 * batteripakke som kan lades fra ekstern kilde, nytt eller brukt og ikke tidligere registrert i Norge. Hver verdi er en påstand; `null` = ukjent.
 * Skilt fra avgiftsmotorens drivlinjeklassifisering (engangsavgift).
 */
export interface EvQualificationInput {
  batteryOnlyPropulsion: boolean | null;
  externallyChargeableBattery: boolean | null;
  passengerVehicle: boolean | null;
  notPreviouslyRegisteredInNorway: boolean | null;
}
/**
 * Hva 300 000-grensen måles mot ved innførsel. Dokumentert for ordinær innførsel (R-IMP-VAT-004, E1P; T81 + mval. § 4-11): bilpris + frakt + forsikring = tollverdi.
 * `customs_value` er standard. `undocumented_import_type`: innførselen er ikke ordinær (f.eks. gjeninnførsel); målegrunnlaget er ikke dokumentert og resultatet blir en nedre grense.
 * Kjøretøypris alene er ikke lenger et regelalternativ.
 */
export type EvThresholdBasis = "customs_value" | "undocumented_import_type";

/** Om et beløp inngår i mva.-grunnlaget ved innførsel (mval. § 4-11: tollavgift og andre avgifter som beregnes ved innførsel). `unknown` ⇒ grunnlaget er en nedre grense. */
export type VatBaseTreatment = "in_base" | "outside_base" | "unknown";

/** Mellommannens vederlag (vareførselsloven § 6-10 (1) a nr. 1, § 6-11 (1) e; T87/T88). Innkjøpsprovisjon og salgs-/meglerprovisjon behandles ulikt; ukjent rolle forblir ukjent. */
export interface CommissionInput {
  role: "purchase_commission" | "sales_or_brokerage_commission" | "unknown";
  /** NOK; desimaler tillatt og avrundes til hele NOK med den uttrykkelige avrundingspolicyen (samme tall i kostnad og tollverdi). */
  amount: AmountInput;
  /** true: betalt i tillegg til varens pris. false: allerede inkludert i prisen. null: ukjent. */
  paidSeparatelyFromPrice: boolean | null;
  /**
   * Bare når `paidSeparatelyFromPrice = false`: er vilkårene i vareførselsloven § 6-11 (1) e oppfylt for å skille innkjøpsprovisjon ut av tollverdien (T88: «pålagt kjøperen
   * og inkludert i prisen»)? `true` (og rolle `purchase_commission`) skiller beløpet ut (anskaffelseskostnaden er uendret; estimat inntil vilkårene er verifisert).
   * `false`: ingen utskilling. Utelatt/`null`/ukjent rolle: uavklart ⇒ tollverdi og mva. er nedre grenser (laveste mulige tollverdi), aldri validated.
   */
  deductionConditionsMet?: boolean | null;
}

/** Betalingskostnader (bank-/valutagebyr o.l.). Ingen generell behandling: selvstendig kostnad skilles fra beløp som inngår i vareprisen. */
export interface PaymentCostInput {
  label: string;
  /** NOK; desimaler avrundes til hele NOK med den uttrykkelige policyen. */
  amount: AmountInput;
  /** `separate_payment_cost`: selvstendig kostnad (ikke et tillegg etter § 6-10, utenfor tollverdi). `included_in_goods_price`: del av vederlaget til selger, allerede i prisen. `unknown`: ukjent. */
  nature: "separate_payment_cost" | "included_in_goods_price" | "unknown";
}

export type ChargeState =
  | AmountInput
  | { state: "not_applicable"; basis: string }
  | { state: "excluded_by_scenario"; reason: string }
  | { state: "unknown" };

export interface EconomicsProfile {
  /** R-IMP-VAT-001/-002 (E1P/E1X): mva.-sats, tollverdigrunnlag og transport/forsikring. */
  vatRulesApproved: boolean;
  /** U-013: avrundingsregel for mva./kursomregning. */
  roundingApproved: boolean;
  /** U-008: tollkursens kilde, dato og syklus. */
  customsFxRuleApproved: boolean;
  /** R-DED-001 (E1P): fradragsrett for innførselsmva. på personbil til videresalg. */
  deductionRuleApproved: boolean;
}
/** Registerstatus: ingen av disse er godkjent (ingen uttrykkelig beslutning). Resultatet kan derfor ikke bli `validated`. */
export const REGISTRY_ECONOMICS_PROFILE: EconomicsProfile = { vatRulesApproved: false, roundingApproved: false, customsFxRuleApproved: false, deductionRuleApproved: false };

export interface EconomicsConfig {
  rounding: RoundingPolicy;
  /**
   * Uttrykkelig valgt PRODUKTANTAKELSE for transport TIL innførselsstedet når forhandleren ikke oppgir beløp (ECON-001 §4.4; `assumed-default`).
   * Ikke en rettslig sjablong (Tolletatens sjablonger gjelder bare biler på egne hjul, T64) og aldri en automatisk 0 når beløp mangler.
   */
  transportDefaultNok?: string;
  /** Bare for tester: tillat fixture-kurser. Aldri produksjonsstandard. */
  allowFixtureFxQuotes?: boolean;
  profile?: EconomicsProfile;
  taxProfile?: TaxProfile;
}

export interface EconomicsInput {
  price: PriceInput;
  fx: {
    acquisition?: FxQuote | null;
    customs?: FxQuote | null;
    /** Når tollkurs mangler: `not_calculated` (standard) eller bruk anskaffelseskursen som uttrykkelig antakelse (nedgraderer til estimat). */
    customsFallback?: "not_calculated" | "use_acquisition_rate_assumed";
  };
  /** Akseptdato for tolldeklarasjonen; styrer ordinær tollkurs. undefined ⇒ `unknown`. Adskilt fra `asOf` og norsk registreringsdato. */
  customsDate?: CustomsAcceptanceDate;
  /** Transport TIL innførselsstedet (inngår i tollverdien, vareførselsloven § 6-10 (1) e). undefined ⇒ produktantakelse fra config, ellers ukjent; `"unknown"` ⇒ ukjent. */
  transportToBorder?: AmountInput | "unknown";
  /** Transport ETTER innførselsstedet (kostnad, ikke i tollverdien). undefined/`unknown` ⇒ ukjent (aldri 0). */
  transportAfterBorder?: ChargeState;
  /** Forsikring til innførselsstedet (inngår i tollverdien). undefined/`"unknown"` ⇒ ukjent. */
  insurance?: AmountInput | "unknown";
  /** Lasting og håndtering forbundet med transporten (vareførselsloven § 6-10 (1) f; inngår i tollverdien). undefined/`unknown` ⇒ ukjent. */
  loadingHandling?: ChargeState;
  taxInput: TaxInput;
  /** Standard `unknown`. Styrer bare permanent økonomisk kost, aldri import-mva.-beløpet. */
  deduction?: DeductionStatus | null;
  /** Standard `unknown`. Styrer bare hvordan import-mva. oppgjøres (kanal), aldri beløpet eller fradragsretten. */
  vatHandling?: VatHandlingInput | null;
  /** Standard: kvalifikasjon uavklart. Skilt fra avgiftsmotorens drivlinjeklassifisering. */
  evQualification?: EvQualificationInput;
  /** Standard `customs_value` (dokumentert for ordinær innførsel, R-IMP-VAT-004 E1P). */
  evThresholdBasis?: EvThresholdBasis;
  /** Provisjon til mellommann. Utelatt ⇒ ingen mellommann oppgitt. */
  commission?: CommissionInput[];
  /** Bank-/valutagebyr o.l. Utelatt ⇒ ingen oppgitt. */
  paymentCosts?: PaymentCostInput[];
  charges?: {
    climateGas?: ChargeState;
    /** Om klimagassavgiften er en avgift som beregnes ved innførsel (§ 4-11) er ikke dokumentert: standard `unknown` (kun relevant når beløpet er > 0). */
    climateGasVatBase?: VatBaseTreatment;
    /** Statens vegvesens registreringsgebyr: ikke en importavgift, aldri i mva.-grunnlaget ved innførsel. */
    registrationFee?: ChargeState;
    /**
     * Tollavgift. Utelatt ⇒ ordinær sats 0 (Tolltariffen 2026, T83) bare når kjøretøyklassifisering og tariffutgavens gyldighet dekker tilfellet; ellers ukjent (aldri 0).
     * Eksplisitt beløp > 0 inngår i mva.-grunnlaget (mval. § 4-11). Eksplisitt `unknown` forblir ukjent.
     */
    customsDuty?: ChargeState;
    /** Andre avgifter som oppstår ved innførsel (§ 4-11); må klassifiseres. `unknown` ⇒ mva.-grunnlaget er en nedre grense. */
    importLevies?: Array<{ label: string; amount: string; basis: AmountBasis; vatBase: VatBaseTreatment }>;
    /** Øvrige kostnader som ikke er importavgifter (utenfor mva.-grunnlaget). */
    otherKnown?: Array<{ label: string; amount: string; basis: AmountBasis }>;
  };
  /** Beregningsdato (ISO). Ikke akseptdato for deklarasjonen og ikke norsk registreringsdato. */
  asOf: string;
}

export type BlockCode =
  | "invalid_currency" | "invalid_amount" | "amount_out_of_range" | "invalid_date" | "invalid_fx_quote" | "dealer_adjusted_missing"
  | "inconsistent_vat_status" | "inconsistent_ev_qualification" | "invalid_classification";

export interface EconBlocker { code: BlockCode; message: string; field?: string }

export type Total =
  | { kind: "value"; valueNok: bigint }
  | { kind: "lower_bound"; lowerBoundNok: bigint; missing: string[] }
  | { kind: "scenarios"; valueNok: null; scenarios: Array<{ id: string; label: string; valueNok: bigint }> }
  | { kind: "not_calculated"; reasons: string[] };

export type EstimateReason =
  | "tax_estimate" | "tax_profile_not_approved" | "vat_rules_unapproved" | "rounding_unconfirmed" | "customs_fx_rule_unconfirmed"
  | "customs_fx_fallback_acquisition_rate" | "transport_default_assumed" | "amount_scenario_assumption" | "charges_excluded_by_scenario"
  | "purchase_price_listing_claim" | "deduction_status_dealer_stated" | "deduction_rule_unapproved" | "ev_qualification_stated" | "fx_dates_missing"
  | "assumed_default_amount" | "customs_acceptance_date_expected" | "customs_fx_suspension_unverified"
  | "customs_duty_ordinary_rate_unapproved" | "ev_threshold_components_unconfirmed" | "foreign_vat_exclusion_dealer_stated" | "purchase_commission_deduction_unverified";

export interface TaxLine {
  /** `approved` = avgiftsmotoren ga `calculated`; `estimate` = `calculated_unverified`; `blocked` = ingen avgift. */
  status: "approved" | "estimate" | "blocked";
  engineStatus: string;
  oneOffTaxNok: bigint | null;
  scrappageDepositNok: bigint | null;
  totalRegistrationTaxesNok: bigint | null;
  vehicleProfile: string | null;
  estimateReasons: string[];
  blockers: string[];
}

export interface FxRoleResult {
  status: "used" | "not_needed" | "not_calculated" | "assumed_from_acquisition";
  /** Normalisert NOK per 1 enhet (eksakt desimalstreng). */
  rate: string | null;
  /** Råverdi og enhet slik de ble oppgitt (proveniens); null når bare normalisert kurs ble oppgitt. */
  raw: { rate: string; unit: 1 | 100 } | null;
  pair: string | null;
  source: FxQuote["source"] | null;
  effectiveAt: string | null;
  quotedAt: string | null;
  /** Tollkurs: gyldighetsperiode og suspensjonsstatus slik oppgitt. */
  validFrom: string | null;
  validTo: string | null;
  suspension: "not_suspended_confirmed" | "suspended" | "unknown" | null;
  reason?: string;
}

export type VatScenarioId = "single" | "no_exemption" | "with_exemption__basis_customs_value";

/** Forklaringsmetadata (ECON-006a-FIX1): hvordan en post ble oppgitt. Ingen regel; samme verdier som kjernen allerede brukte. */
export type AmountMeta = { kind: "amount"; basis: AmountBasis } | { kind: "not_applicable" } | { kind: "excluded_by_scenario" } | { kind: "unknown" };
export interface OtherCostItem {
  id: "climate_gas" | "registration_fee" | "import_levy" | "other_known" | "commission_separate" | "payment_cost" | "customs_duty";
  label: string | null;
  /** Eksakt desimalstreng slik kjernen la den til øvrige kostnader (ikke avrundet). */
  amount: string;
  basis: AmountBasis;
}
export interface CostMeta {
  transportAfterBorder: AmountMeta; insurance: AmountMeta; loadingHandling: AmountMeta;
  /** Hvordan klimagassavgift, registreringsgebyr og tollavgift ble oppgitt (beløp / scenarioekskludert / ikke relevant / ukjent). `customsDuty` er null når ikke oppgitt (ordinær sats). */
  climateGas: AmountMeta; registrationFee: AmountMeta; customsDuty: AmountMeta | null;
  /** Kjente poster som inngår i øvrige kostnader. */
  otherItems: OtherCostItem[];
  /** Øvrige kostnader slik de inngår i totalene (avrundet én gang etter eksisterende policy); null når ikke beregnet. */
  othersNok: bigint | null;
}

export interface EconomicsResult {
  /** `validated` er bare mulig når alle grunnlag er godkjent (ikke tilfelle i registeret). `estimate` = alt kan regnes, men ikke validert. `incomplete` = delsummer. `blocked` = ugyldig input. */
  status: "blocked" | "incomplete" | "estimate" | "validated";
  blockers: EconBlocker[];
  /** Tre adskilte datoer. Ingen er verifisert av kjernen. */
  dates: {
    asOf: string | null;
    customsAcceptance: { date: string | null; kind: CustomsAcceptanceDate["kind"]; rateValidOnDate: boolean | null };
    norwegianRegistration: { date: string | null; kind: string | null };
  };
  /** Lagres adskilt: annonsert, forhandlerjustert og brukt kjøpsgrunnlag. */
  acquisition: {
    advertisedGross: string | null; advertisedNet: string | null; dealerAdjusted: string | null;
    used: { amount: string | null; currency: string; selected: "advertised" | "dealer_adjusted"; basis: "net_claimed" | "gross_only" | "unknown" | "dealer_adjusted"; evidence: PriceInput["evidence"] };
    purchaseBasisResolved: boolean;
    acquisitionUsedNok: bigint | null;
    acquisitionUsedRaw: string | null;
  };
  fx: { acquisition: FxRoleResult; customs: FxRoleResult };
  /** Transport til innførselsstedet (i tollverdien) og etter innførselsstedet (bare kostnad) holdes adskilt og telles én gang. */
  transportToBorderNok: bigint | null;
  transportToBorderBasis: AmountBasis | "unknown" | null;
  transportAfterBorderNok: bigint | null;
  insuranceNok: bigint | null;
  loadingHandlingNok: bigint | null;
  /** Salgs-/meglerprovisjon som er lagt til tollverdien (vareførselsloven § 6-10 (1) a nr. 1). Innkjøpsprovisjon og ukjent rolle er aldri inkludert. */
  commissionInCustomsValueNok: bigint | null;
  customsValueNok: bigint | null;
  /** Tollavgift i mva.-grunnlaget. `basis`: `ordinary_rate_tariff_2026` = sats 0 fra tolltariffen (T83) fordi klassifisering og gyldighet dekker tilfellet; `explicit` = oppgitt beløp. */
  customsDuty: { nok: bigint | null; basis: "ordinary_rate_tariff_2026" | "explicit" | "stated_not_applicable" | "unknown" };
  /** Beregningsgrunnlag for import-mva. før elbilfritak (tollverdi + tollavgift + avgifter som beregnes ved innførsel); null når ikke beregnet. Nedre grense når `importVat.status` er `lower_bound`. */
  importVatBaseNok: bigint | null;
  /** Mva. per scenario. `unresolved` ved avrundingslikhet (U-013). */
  importVat: {
    status: "calculated" | "lower_bound" | "scenarios" | "not_calculated";
    valueNok: bigint | null;
    scenarios: Array<{ id: VatScenarioId; valueNok: bigint | null; raw: string }>;
    ev: { qualification: "qualifies" | "does_not_qualify" | "unresolved" | "not_applicable_vehicle"; thresholdBasis: EvThresholdBasis | null; engineClassification: TaxPowertrain | null };
    reasons: string[];
  };
  /** Betalingskanal for import-mva. (adskilt fra fradragsrett). Kun mva.-beløpet; ingen tidspunkter og ingen likviditetsmodell. */
  importVatSettlement: {
    /** `known` bare når håndteringen er oppgitt av godkjent kilde. Ukjent håndtering gir alltid `scenarios` (også når bare ett scenario er forenlig med akseptert fradragsrett). */
    status: "known" | "scenarios" | "not_calculated";
    handling: { value: VatHandling; accepted: boolean; source: VatHandlingInput["source"] | null };
    /** Kanaler som er utelatt fordi de motsier akseptert fradragsstatus (registrering er ikke bekreftet av dette). */
    excludedScenarios: Array<{ handling: "registered_reports_in_vat_return" | "not_registered_pays_at_import"; reason: string }>;
    rows: Array<{
      vatScenarioId: VatScenarioId;
      handling: "registered_reports_in_vat_return" | "not_registered_pays_at_import";
      vatNok: bigint;
      /** Mva. som betales til Tolletaten ved innførsel (ikke total kontant ved grensen). */
      paidToCustomsAtImportNok: bigint;
      /** Mva. som beregnes og rapporteres i mva-meldingen (betalingsfrist og netting mot fradrag er ikke modellert). */
      reportedInVatReturnNok: bigint;
      lowerBound: boolean;
    }>;
  };
  tax: TaxLine;
  costMeta: CostMeta;
  /**
   * BRUTTO utlegg: kjøpesum + transport + forsikring + lasting/håndtering + import-mva. + registreringsavgifter + øvrige kjente poster, uavhengig av fradragsrett,
   * betalingskanal og betalingstidspunkt. Er IKKE «kontant ved grensen» og ikke et betalingsprogram: kjøpesum, transport, mva. og registreringsavgifter har ulike
   * betalingstidspunkter, og mva-registrerte rapporterer import-mva. i mva-meldingen (T56). Se `importVatSettlement`.
   */
  importCashRequirement: Total;
  estimatedLandedCost: Total;
  vatRecoverability: { value: VatRecoverability; accepted: boolean; source: DeductionStatus["source"] | null };
  estimateReasons: EstimateReason[];
  incompleteReasons: string[];
  warnings: string[];
  roundingTies: string[];
}

/**
 * Landed-cost-kjernen (ECON-004): typer. Ren domenekode — ingen I/O, UI, DB, provider eller nettverk. Avgiften kommer fra avgiftsmotoren (ECON-002).
 * Beløp i NOK er hele kroner (bigint); kjøpspris og kurs er desimalstrenger. Alt som er uavklart i kildene er uttrykt som status/årsak, ikke som antatt regel.
 */
import type { TaxInput, TaxProfile } from "@/domain/tax";
import type { RoundingPolicy } from "./rational";

export type VatRecoverability = "recoverable" | "non_recoverable" | "unknown";
/** Hele kroner som desimalstreng («8000»). */
export type AmountBasis = "dealer_entered" | "quoted" | "assumed_default" | "scenario_assumption";
export interface AmountInput { amount: string; basis: AmountBasis }

export interface FxQuote {
  /** «EUR/NOK». Må samsvare med annonsens valuta. */
  pair: string;
  /** NOK per enhet kildevaluta, desimalstreng. */
  rate: string;
  source: { kind: "official_customs" | "bank" | "dealer_entered" | "fixture"; ref?: string };
  /** Datoen kursen gjelder for (ISO). Kreves for et fullstendig resultat; hvilken dato som styrer tollkursen er uavklart (U-008). */
  effectiveAt: string | null;
  /** Når kursen ble hentet/notert (ISO-dato). */
  quotedAt: string | null;
  validUntil?: string | null;
  /** true: testkurs. Avvises som produksjonskurs med mindre `allowFixtureFxQuotes` er satt (kun test). */
  fixtureOnly?: boolean;
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
}

export interface DeductionStatus {
  value: VatRecoverability;
  /** Bare `dealer_entered`/`dealer_profile` godtas. Annonsetekst eller antakelse ignoreres (⇒ unknown). Utledes aldri av at brukeren er forhandler. */
  source: { kind: "dealer_entered" | "dealer_profile" | "listing_claim" | "assumed"; by?: string; at?: string };
}

export type EvExemptionInput = "applies" | "not_applicable" | "unknown";
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
  /** Produktstandard for transport til norsk grense når forhandleren ikke oppgir (ECON-001 §4.4; `assumed-default`). */
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
  /** undefined ⇒ produktstandard (`assumed-default`); `"unknown"` ⇒ ukjent (resultatet er ufullstendig). */
  transport?: AmountInput | "unknown";
  /** undefined/`"unknown"` ⇒ ukjent forsikring til innførselssted (resultatet er ufullstendig). */
  insurance?: AmountInput | "unknown";
  taxInput: TaxInput;
  /** Standard `unknown`. Styrer bare permanent økonomisk kost, aldri import-mva.-beløpet eller kontantbehovet. */
  deduction?: DeductionStatus | null;
  /** Gjelder bare elbil. Standard `unknown` (anvendelse ved innførsel er uavklart, R-IMP-VAT-003). */
  evExemption?: EvExemptionInput;
  charges?: { climateGas?: ChargeState; registrationFee?: ChargeState; customsDuty?: ChargeState; otherKnown?: Array<{ label: string; amount: string; basis: AmountBasis }> };
  /** Beregningsdato (ISO). */
  asOf: string;
}

export type BlockCode =
  | "invalid_currency" | "invalid_amount" | "amount_out_of_range" | "invalid_date" | "invalid_fx_quote" | "dealer_adjusted_missing";

export interface EconBlocker { code: BlockCode; message: string; field?: string }

export type Total =
  | { kind: "value"; valueNok: bigint }
  | { kind: "lower_bound"; lowerBoundNok: bigint; missing: string[] }
  | { kind: "scenarios"; valueNok: null; scenarios: Array<{ id: string; label: string; valueNok: bigint }> }
  | { kind: "not_calculated"; reasons: string[] };

export type EstimateReason =
  | "tax_estimate" | "tax_profile_not_approved" | "vat_rules_unapproved" | "rounding_unconfirmed" | "customs_fx_rule_unconfirmed"
  | "customs_fx_fallback_acquisition_rate" | "transport_default_assumed" | "amount_scenario_assumption" | "charges_excluded_by_scenario"
  | "purchase_price_listing_claim" | "deduction_status_dealer_stated" | "deduction_rule_unapproved" | "ev_exemption_assumed" | "fx_dates_missing" | "assumed_default_amount";

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
  rate: string | null;
  pair: string | null;
  source: FxQuote["source"] | null;
  effectiveAt: string | null;
  quotedAt: string | null;
  reason?: string;
}

export interface EconomicsResult {
  /** `validated` er bare mulig når alle grunnlag er godkjent (ikke tilfelle i registeret). `estimate` = alt kan regnes, men ikke validert. `incomplete` = delsummer. `blocked` = ugyldig input. */
  status: "blocked" | "incomplete" | "estimate" | "validated";
  blockers: EconBlocker[];
  /** Lagres adskilt: annonsert, forhandlerjustert og brukt kjøpsgrunnlag. */
  acquisition: {
    advertisedGross: string | null; advertisedNet: string | null; dealerAdjusted: string | null;
    used: { amount: string | null; currency: string; selected: "advertised" | "dealer_adjusted"; basis: "net_claimed" | "gross_only" | "unknown" | "dealer_adjusted"; evidence: PriceInput["evidence"] };
    purchaseBasisResolved: boolean;
    acquisitionUsedNok: bigint | null;
    acquisitionUsedRaw: string | null;
  };
  fx: { acquisition: FxRoleResult; customs: FxRoleResult };
  transportNok: bigint | null;
  transportBasis: AmountBasis | "unknown" | null;
  insuranceNok: bigint | null;
  customsValueNok: bigint | null;
  /** Mva. per elbil-fritaksscenario; ett scenario i alle andre tilfeller. `unresolved` ved avrundingslikhet (U-013). */
  importVat: {
    status: "calculated" | "lower_bound" | "scenarios" | "not_calculated";
    valueNok: bigint | null;
    scenarios: Array<{ id: "no_exemption" | "with_exemption" | "single"; valueNok: bigint | null; raw: string }>;
    evExemption: EvExemptionInput | "not_applicable_vehicle";
    reasons: string[];
  };
  tax: TaxLine;
  importCashRequirement: Total;
  estimatedLandedCost: Total;
  vatRecoverability: { value: VatRecoverability; accepted: boolean; source: DeductionStatus["source"] | null };
  estimateReasons: EstimateReason[];
  incompleteReasons: string[];
  warnings: string[];
  roundingTies: string[];
}

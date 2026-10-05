/**
 * Domenetyper for Project Scout.
 *
 * Dette laget er uavhengig av UI, providers, n8n og LLM (CLAUDE.md pkt. 2).
 * Kost-, avgifts-, bidrags- og scoreberegninger kommer i egne oppgaver
 * (DEV-007 – DEV-010).
 *
 * Annonsefeltene beskriver hva kilden/annonsen OPPGIR. Project Scouts egne
 * vurderinger (skatteprofil, fradragsrett, kalkyle) hører hjemme i kalkyler
 * og ligger aldri på annonsen.
 *
 * Konvensjon: ukjent verdi er `null`, aldri 0, tom streng eller en gjettet verdi.
 */

/** ISO 4217-valutakode, f.eks. "EUR" eller "NOK". */
export type CurrencyCode = string;

/**
 * Pengebeløp som heltall i minste valutaenhet (øre, cent) + eksplisitt valuta.
 * Ingen binær flyttallsregning for økonomi (DATABASE_SCHEMA, DEC-017).
 */
export interface Money {
  amountMinor: number;
  currency: CurrencyCode;
}

/** Om annonseprisen inkluderer mva. Ukjent må forbli ukjent. */
export type PriceBasis = "gross" | "net" | "unknown";

/** Påstand i annonsen: oppgitt, uttrykkelig avkreftet eller ikke avklart. */
export type ClaimValue = "claimed" | "denied" | "unknown";

/**
 * Mva.-opplysninger slik kilden oppgir dem — ikke Scouts vurdering.
 * En påstand om at mva. kan trekkes fra («MwSt. ausweisbar») gir ikke norsk
 * fradragsrett eller rett til netto eksportpris (PRODUCT_SPEC §7).
 */
export interface SourceVatStatement {
  /** Oppgitt mva.-sats i basispunkter (1900 = 19 %), eller null. */
  statedRateBasisPoints: number | null;
  /** Påstand om at utenlandsk mva. kan vises/trekkes fra separat. */
  reclaimableClaim: ClaimValue;
  /** Korte ordrette belegg fra kilden. Tom liste når ingenting er oppgitt. */
  evidence: string[];
  /** Hvor opplysningene kom fra («VAT-opphav», MOBILE_DE_INTEGRATION). */
  origin: "structured_field" | "listing_text" | "none";
}

export interface ListingPrice {
  /** Beløpet nøyaktig slik kilden oppga det (desimalstreng + valutakode). Bevares alltid. */
  stated: { amount: string; currency: CurrencyCode };
  /**
   * Beløpet i minste enhet. `null` når valutaen ikke støttes av appen;
   * da regnes det ikke om og det gjettes ikke på desimaler.
   */
  amount: Money | null;
  /** Brutto/netto bare med eksplisitt belegg, ellers "unknown". */
  basis: PriceBasis;
  /** Kort ordrett belegg fra kilden for prisgrunnlaget, eller null. */
  basisEvidence: string | null;
  vat: SourceVatStatement;
}

/** Førsteregistrering med kildens presisjon; ingen oppdiktet dag/måned. */
export type FirstRegistration =
  | { precision: "date"; year: number; month: number; day: number }
  | { precision: "month"; year: number; month: number }
  | { precision: "year"; year: number };

export type Fuel = "petrol" | "diesel" | "electric" | "hybrid" | "plugin_hybrid" | "other";
export type Transmission = "manual" | "automatic";
export type BodyType = "sedan" | "estate" | "suv" | "hatchback" | "coupe" | "convertible" | "van" | "other";

export interface Mileage {
  value: number;
  unit: "km" | "mi";
}

export interface Co2Emission {
  gramsPerKm: number;
  /** Testmetode, f.eks. "WLTP" eller "NEDC". Ikke omregn mellom metoder. */
  testMethod: "WLTP" | "NEDC" | "unknown";
}

export interface VehicleSpecs {
  make: string;
  model: string;
  variant: string | null;
  firstRegistration: FirstRegistration | null;
  mileage: Mileage | null;
  fuel: Fuel | null;
  transmission: Transmission | null;
  bodyType: BodyType | null;
  powerKw: number | null;
  co2: Co2Emission | null;
  curbWeightKg: number | null;
  color: string | null;
}

export type SellerType = "dealer" | "private" | "unknown";

export interface SellerInfo {
  type: SellerType;
  /** ISO 3166-1 alpha-2. */
  countryCode: string | null;
  city: string | null;
}

/** Hvor dataene kommer fra. Syntetiske data skal alltid merkes som det. */
export interface Provenance {
  kind: "synthetic" | "provider";
  /** Fritekst om opphav, f.eks. "syntetisk demo-fixture DEV-001". */
  description: string;
  /** Felt normaliseringen satte til null/unknown, med grunn. Tom liste hvis ingen. */
  normalizationNotes: string[];
}

/**
 * Normalisert annonse iht. Marketplace-kontrakten i ARCHITECTURE.md.
 * Provider-laget (DEV-003) skal returnere denne formen.
 */
export interface NormalizedListing {
  source: string;
  sourceListingId: string;
  /** Godkjent URL til originalannonsen, eller null (alltid null i demo). */
  originalUrl: string | null;
  sourceModifiedAt: string | null;
  /**
   * Når Scout først observerte annonsen (UTC ISO 8601). Ikke kildens
   * opprettelsesdato. For ekte kilder settes dette av ingestion (DEV-005).
   */
  firstSeenAt: string;
  /** Når Scout sist observerte annonsen hos kilden (UTC ISO 8601), ≥ firstSeenAt. */
  lastSeenAt: string;
  /** `null` når annonsen ikke oppgir pris. Aldri 0 som erstatning. */
  price: ListingPrice | null;
  specs: VehicleSpecs;
  text: string | null;
  seller: SellerInfo | null;
  provenance: Provenance;
}

/**
 * Strukturerte agentfiltre (PRODUCT_SPEC §4). `null` / tom liste betyr «alle»
 * (ingen begrensning) — ikke «ukjent». Se DEC-023 for brede filtre.
 */
export interface AgentFilters {
  make: string | null;
  model: string | null;
  /** Variant/utstyrsnivå; krever modell. Delstreng uten hensyn til store/små bokstaver. */
  variant: string | null;
  yearMin: number | null;
  yearMax: number | null;
  maxMileageKm: number | null;
  fuels: Fuel[];
  transmissions: Transmission[];
  bodyTypes: BodyType[];
  countryCodes: string[];
  /** Maks annonsepris i valgt valuta. Sammenlignes bare mot annonser i samme valuta (DEC-018). */
  maxPrice: Money | null;
}

/** Om et beløp inkluderer en avgift/mva. `null` = ikke oppgitt (blokkerer aktivering). */
export type InclusionBasis = "included" | "excluded";

/**
 * Forhandlerens forventede norske sluttkundepris med eksplisitt prisgrunnlag
 * (IMPORT_ENGINE_SPEC «Inputs»). Lagret retail betyr ikke beregnet margin.
 */
export interface RetailAssumption {
  expectedRetailTotal: Money | null;
  priceBasis: { vat: InclusionBasis | null; registrationTaxes: InclusionBasis | null };
}

/** Klargjøringsreserve med mva.-basis. 0 kr er et gyldig, uttrykkelig valg; `null` = ikke oppgitt. */
export interface PreparationReserve {
  amount: Money | null;
  vatBasis: "ex_vat" | "incl_vat" | null;
}

/** Økonomiforutsetninger i NOK. `null` = ikke oppgitt, aldri 0 som erstatning. */
export interface AgentAssumptions {
  retail: RetailAssumption;
  /** Minimum ønsket bidrag (T i OPPORTUNITY_SCORE), må være > 0 for aktivering. */
  minimumContribution: Money | null;
  preparationReserve: PreparationReserve;
}

export type AgentStatus = "active" | "paused";

export interface SearchAgent {
  id: string;
  name: string;
  status: AgentStatus;
  filters: AgentFilters;
  /** Brukeren har uttrykkelig bekreftet søk uten merke (DEC-023). */
  broadSearchConfirmed: boolean;
  assumptions: AgentAssumptions;
  version: number;
  /** Siste vellykkede søk mot kilde, null hvis aldri kjørt. */
  lastSuccessAt: string | null;
}

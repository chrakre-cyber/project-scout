/**
 * Domenetyper for Project Scout.
 *
 * Dette laget er uavhengig av UI, providers, n8n og LLM (CLAUDE.md pkt. 2).
 * Det inneholder bare typer i DEV-001; kost-, avgifts-, bidrags- og
 * scoreberegninger kommer i egne oppgaver (DEV-007 – DEV-010).
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

export interface ListingPrice {
  amount: Money;
  basis: PriceBasis;
  /** Kort ordrett belegg fra kilden for prisgrunnlaget, eller null. */
  basisEvidence: string | null;
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
  /** Når Scout først observerte annonsen (UTC ISO 8601). Ikke kildens opprettelsesdato. */
  firstSeenAt: string;
  price: ListingPrice;
  specs: VehicleSpecs;
  text: string | null;
  seller: SellerInfo | null;
  provenance: Provenance;
}

/** Strukturerte agentfiltre (PRODUCT_SPEC §4). Utelatt filter = ikke satt. */
export interface AgentFilters {
  make: string | null;
  model: string | null;
  yearMin: number | null;
  yearMax: number | null;
  maxMileageKm: number | null;
  fuels: Fuel[];
  transmissions: Transmission[];
  bodyTypes: BodyType[];
  countryCodes: string[];
  maxPrice: Money | null;
}

/** Forhandlerens forventede norske sluttkundepris med eksplisitt grunnlag. */
export interface RetailAssumption {
  expectedRetailTotal: Money;
  /** Beskrivelse av hva prisen inkluderer (mva., registreringsavgifter). */
  priceBasisDescription: string;
}

export interface AgentAssumptions {
  retail: RetailAssumption | null;
  minimumContribution: Money | null;
  preparationReserve: Money | null;
}

export type AgentStatus = "active" | "paused";

export interface SearchAgent {
  id: string;
  name: string;
  status: AgentStatus;
  filters: AgentFilters;
  assumptions: AgentAssumptions;
  version: number;
  /** Siste vellykkede søk mot kilde, null hvis aldri kjørt. */
  lastSuccessAt: string | null;
}

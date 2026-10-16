/**
 * Eksplisitte feiltyper fra ARCHITECTURE.md. Autentisering/forbidden stopper
 * og vises som blokkering; bare transiente feil kan få begrenset retry.
 */
export const MARKETPLACE_ERROR_CODES = [
  "authentication", "forbidden", "rate_limit", "invalid_query", "timeout", "unavailable", "malformed_data",
] as const;

export type MarketplaceErrorCode = (typeof MARKETPLACE_ERROR_CODES)[number];

const RETRYABLE: ReadonlySet<MarketplaceErrorCode> = new Set(["rate_limit", "timeout", "unavailable"]);

export class MarketplaceError extends Error {
  readonly code: MarketplaceErrorCode;
  readonly retryable: boolean;

  constructor(code: MarketplaceErrorCode, message: string) {
    super(message);
    this.name = "MarketplaceError";
    this.code = code;
    this.retryable = RETRYABLE.has(code);
  }
}

export function isMarketplaceErrorCode(value: string): value is MarketplaceErrorCode {
  return (MARKETPLACE_ERROR_CODES as readonly string[]).includes(value);
}

/** Norsk tekst for UI. Ingen tekniske detaljer eller secrets. */
export const MARKETPLACE_ERROR_LABEL: Record<MarketplaceErrorCode, string> = {
  authentication: "Kilden avviste innloggingen. Søk er stoppet.",
  forbidden: "Kilden nekter tilgang. Søk er stoppet.",
  rate_limit: "Kildens kvote er brukt opp. Prøves igjen senere.",
  invalid_query: "Søket ble avvist som ugyldig.",
  timeout: "Kilden svarte ikke i tide.",
  unavailable: "Kilden er utilgjengelig.",
  malformed_data: "Kilden returnerte data som ikke kunne leses.",
};

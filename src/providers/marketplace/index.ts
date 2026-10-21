/**
 * Inngangspunkt for serverkode som trenger annonser. UI og domene kjenner bare
 * `MarketplaceProvider`-kontrakten; hvilken provider som brukes avgjøres her.
 * En ekte provider (DEV-006) erstatter den syntetiske uten endring i UI.
 */
import { isMarketplaceErrorCode } from "./errors";
import { SyntheticMarketplaceProvider } from "./synthetic/provider";
import type { MarketplaceProvider } from "./types";

let cached: MarketplaceProvider | null = null;

export function getMarketplaceProvider(): MarketplaceProvider {
  // Kun for demo/kontroll av feilvisning: simulerer kildefeil uten nettverk.
  const simulated = process.env.SCOUT_SYNTHETIC_FAILURE;
  if (simulated && isMarketplaceErrorCode(simulated)) return new SyntheticMarketplaceProvider({ failAll: simulated });
  if (cached) return cached;
  // Ugyldig datasettepoke (SCOUT_SYNTHETIC_EPOCH) gir en provider som feiler lukket; den mellomlagres ikke.
  const provider = new SyntheticMarketplaceProvider();
  if (provider.usable) cached = provider;
  return provider;
}

export { MarketplaceError, MARKETPLACE_ERROR_LABEL } from "./errors";
export type { MarketplaceProvider, SearchPage, SearchQuery, SearchWindow } from "./types";
export { EMPTY_QUERY, syntheticDatasetLabel } from "./synthetic/provider";

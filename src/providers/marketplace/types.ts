/**
 * MarketplaceProvider-kontrakten (ARCHITECTURE.md «Marketplace-kontrakt»).
 *
 * En provider søker og henter annonser og normaliserer dem til Project Scouts
 * interne modell. Den bestemmer aldri salgspris, avgifter, margin, score eller
 * annonseanalyse — det skjer i domene- og serverlaget.
 */
import type { AgentFilters, NormalizedListing } from "@/domain/types";

/** Strukturerte søkekriterier. Samme form som agentens filtre. */
export type SearchQuery = AgentFilters;

export interface SearchWindow {
  /** Bare annonser endret hos kilden fra og med dette tidspunktet (UTC ISO 8601). */
  modifiedSince?: string;
  /** 1-basert side. Standard 1. */
  page?: number;
  /** Antall per side, 1–100. Standard 20. */
  pageSize?: number;
}

/** En kildepost som ikke kunne normaliseres. Resten av siden leveres likevel. */
export interface RejectedListing {
  sourceListingId: string | null;
  code: "malformed_data";
  reason: string;
}

export interface SearchPage {
  items: NormalizedListing[];
  /** Neste side, eller null når det ikke finnes flere tilgjengelige sider. */
  nextPage: number | null;
  /** Antall treff kilden oppgir, også utover det som kan hentes. */
  sourceTotal: number;
  /** true når kilden har flere treff enn den lar oss hente (f.eks. 2 000-grense). */
  truncated: boolean;
  fetchedAt: string;
  /** Utvidelse av kontrakten: poster på denne siden som ble avvist ved normalisering. */
  rejected: RejectedListing[];
}

export interface MarketplaceProvider {
  /** Kildenavn som lagres på annonsene, f.eks. "synthetic-demo". */
  readonly source: string;
  search(query: SearchQuery, window: SearchWindow): Promise<SearchPage>;
  /** null når annonsen ikke finnes (tilsvarer 404). */
  getListing(sourceListingId: string): Promise<NormalizedListing | null>;
}

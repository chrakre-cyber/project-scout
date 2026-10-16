/**
 * Rene hjelpere for søkekjøringer (DEV-005): rekkefølge, resultatsnapshot, tellere og kanonisk JSON.
 * Ingen I/O. Hashing og lagring skjer i serverlaget.
 */
import type { AgentFilters, NormalizedListing } from "./types";
import { evaluateListing, type Criterion, type MatchEvaluation } from "./matching";

export type SearchRunStatus = "running" | "completed" | "failed";

export const SEARCH_RUN_ERROR_CODES = [
  "authentication", "forbidden", "rate_limit", "invalid_query", "timeout", "unavailable", "malformed_data", "abandoned", "internal", "rights_blocked",
] as const;
export type SearchRunErrorCode = (typeof SEARCH_RUN_ERROR_CODES)[number];

/** Minimalt, lagret utdrag av annonsen (ingen annonsetekst, selgerby eller proveniensnotater). Se DEC-026. */
export interface ResultSnapshot {
  source: string;
  sourceListingId: string;
  sourceModifiedAt: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  /** `null` når annonsen ikke oppgir det, eller når rettighetsprofilen ikke tillater lagring (se `withheld`). */
  make: string | null;
  model: string | null;
  variant: string | null;
  firstRegistration: NormalizedListing["specs"]["firstRegistration"];
  mileage: NormalizedListing["specs"]["mileage"];
  fuel: NormalizedListing["specs"]["fuel"];
  transmission: NormalizedListing["specs"]["transmission"];
  bodyType: NormalizedListing["specs"]["bodyType"];
  sellerType: "dealer" | "private" | "unknown" | null;
  sellerCountry: string | null;
  /** Prisen slik kilden oppga den. `amountMinor` er null for ustøttet valuta (ingen omregning). */
  price: { stated: string; currency: string; amountMinor: string | null; basis: "gross" | "net" | "unknown" } | null;
  /** Alltid satt: syntetiske data skal kunne merkes også i historikken. */
  provenanceKind: "synthetic" | "provider";
  /** Hva rettighetsprofilen holdt tilbake fra lagring (DEC-028). Tom liste = alt som ble hentet er lagret. */
  withheld: ("price" | "specs" | "seller")[];
}

export function projectSnapshot(l: NormalizedListing): ResultSnapshot {
  const p = l.price;
  return {
    source: l.source,
    sourceListingId: l.sourceListingId,
    sourceModifiedAt: l.sourceModifiedAt,
    firstSeenAt: l.firstSeenAt,
    lastSeenAt: l.lastSeenAt,
    make: l.specs.make,
    model: l.specs.model,
    variant: l.specs.variant,
    firstRegistration: l.specs.firstRegistration,
    mileage: l.specs.mileage,
    fuel: l.specs.fuel,
    transmission: l.specs.transmission,
    bodyType: l.specs.bodyType,
    sellerType: l.seller?.type ?? null,
    sellerCountry: l.seller?.countryCode ?? null,
    // Beløp som tekst (DEC-020): stabilt og uten presisjonstap i JSON.
    price: p === null ? null : { stated: p.stated.amount, currency: p.stated.currency, amountMinor: p.amount === null ? null : String(p.amount.amountMinor), basis: p.basis },
    provenanceKind: l.provenance.kind,
    withheld: [],
  };
}

/** JSON med sorterte nøkler, slik at samme innhold alltid gir samme tekst (og hash). */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}

export interface PlannedResult {
  listing: NormalizedListing;
  status: "match" | "needs_review";
  unknown: Criterion[];
  /** 1-basert plassering i kjøringen. */
  rank: number;
}

export interface EvaluationSummary {
  planned: PlannedResult[];
  excluded: number;
  duplicates: number;
}

/**
 * Vurderer annonser mot kriteriene, fjerner duplikater på (source, sourceListingId) (første forekomst beholdes),
 * og rangerer deterministisk: bekreftede treff før «må kontrolleres», deretter nyest først-sett, deretter kilde-ID.
 */
export function evaluateAndRank(filters: AgentFilters, listings: readonly NormalizedListing[]): EvaluationSummary {
  const seen = new Set<string>();
  let duplicates = 0;
  let excluded = 0;
  const kept: { listing: NormalizedListing; ev: MatchEvaluation }[] = [];
  for (const listing of listings) {
    const key = `${listing.source}\u0000${listing.sourceListingId}`;
    if (seen.has(key)) {
      duplicates++;
      continue;
    }
    seen.add(key);
    const ev = evaluateListing(filters, listing);
    if (ev.status === "excluded") excluded++;
    else kept.push({ listing, ev });
  }
  kept.sort((a, b) => {
    const sa = a.ev.status === "match" ? 0 : 1;
    const sb = b.ev.status === "match" ? 0 : 1;
    if (sa !== sb) return sa - sb;
    if (a.listing.firstSeenAt !== b.listing.firstSeenAt) return a.listing.firstSeenAt < b.listing.firstSeenAt ? 1 : -1;
    return a.listing.sourceListingId < b.listing.sourceListingId ? -1 : a.listing.sourceListingId > b.listing.sourceListingId ? 1 : 0;
  });
  const planned = kept.map((k, i) => ({ listing: k.listing, status: k.ev.status as "match" | "needs_review", unknown: k.ev.unknown, rank: i + 1 }));
  return { planned, excluded, duplicates };
}

export interface RunCounts {
  sourceTotal: number;
  fetched: number;
  matches: number;
  needsReview: number;
  excluded: number;
  rejected: number;
  duplicates: number;
  pages: number;
  truncated: boolean;
}

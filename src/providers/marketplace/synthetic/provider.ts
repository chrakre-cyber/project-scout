/**
 * Syntetisk MarketplaceProvider. Ingen nettverk, ingen secrets.
 *
 * - Flere råposter med samme ID er revisjoner; siste revisjon (modifiedAt) innen
 *   `asOf` gjelder. Identiske duplikater slås sammen. Motstridende poster med
 *   samme ID og endringstid avvises som malformed_data.
 * - Søk: deterministisk rekkefølge (kilde-ID), 1-basert paginering og
 *   resultatgrense (`resultCap`, standard 2 000 som mobile.de-dokumentasjonen
 *   beskriver). Over grensen markeres siden `truncated`.
 * - Filtre: ukjent verdi ekskluderes ikke (kan ikke avgjøres her; hardfilter
 *   og needs_review hører til DEV-010). Ingen valutaomregning: pris i annen
 *   eller ustøttet valuta behandles som ukjent mot prisfilteret.
 * - Feil simuleres med `failures`/`failAll`.
 */
import { MarketplaceError, type MarketplaceErrorCode } from "../errors";
import type { MarketplaceProvider, RejectedListing, SearchPage, SearchQuery, SearchWindow } from "../types";
import { evaluateListing } from "@/domain/matching";
import type { NormalizedListing } from "@/domain/types";
import { syntheticRawListings } from "./fixtures";
import { normalizeSyntheticListing, SYNTHETIC_SOURCE } from "./normalize";
import type { SyntheticRawListing } from "./raw";

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const DEFAULT_RESULT_CAP = 2_000;

type Entry = { id: string; listing: NormalizedListing } | { id: string; rejected: RejectedListing };

export interface SyntheticProviderOptions {
  records?: readonly SyntheticRawListing[];
  resultCap?: number;
  /** Se kilden slik den var på dette tidspunktet (ISO 8601). Standard: alle revisjoner. */
  asOf?: string;
  now?: () => Date;
  /** Feil per kall i rekkefølge; null = vellykket kall. */
  failures?: { search?: (MarketplaceErrorCode | null)[]; getListing?: (MarketplaceErrorCode | null)[] };
  /** Alle kall feiler med denne koden. */
  failAll?: MarketplaceErrorCode;
}

export class SyntheticMarketplaceProvider implements MarketplaceProvider {
  readonly source = SYNTHETIC_SOURCE;
  private readonly entries: Entry[];
  private readonly byId: Map<string, Entry>;
  private readonly resultCap: number;
  private readonly now: () => Date;
  private readonly options: SyntheticProviderOptions;
  private calls = { search: 0, getListing: 0 };

  constructor(options: SyntheticProviderOptions = {}) {
    this.options = options;
    this.resultCap = options.resultCap ?? DEFAULT_RESULT_CAP;
    this.now = options.now ?? (() => new Date());
    this.entries = resolve(options.records ?? syntheticRawListings, options.asOf);
    this.byId = new Map(this.entries.map((e) => [e.id, e]));
  }

  async search(query: SearchQuery, window: SearchWindow): Promise<SearchPage> {
    this.maybeFail("search");
    const page = window.page ?? 1;
    const pageSize = window.pageSize ?? DEFAULT_PAGE_SIZE;
    if (!Number.isInteger(page) || page < 1) throw new MarketplaceError("invalid_query", "page må være et heltall ≥ 1");
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
      throw new MarketplaceError("invalid_query", `pageSize må være 1–${MAX_PAGE_SIZE}`);
    }
    const since = window.modifiedSince === undefined ? null : Date.parse(window.modifiedSince);
    if (since !== null && Number.isNaN(since)) throw new MarketplaceError("invalid_query", "modifiedSince er ugyldig");
    validateQuery(query);

    // Avviste poster kan ikke filtreres; de leveres på sin plass som `rejected`.
    const matching = this.entries.filter((e) => !("listing" in e) || (matchesQuery(e.listing, query) && modifiedSinceOk(e.listing, since)));
    const available = matching.slice(0, this.resultCap);
    const start = (page - 1) * pageSize;
    const slice = available.slice(start, start + pageSize);

    return {
      items: slice.flatMap((e) => ("listing" in e ? [e.listing] : [])),
      rejected: slice.flatMap((e) => ("rejected" in e ? [e.rejected] : [])),
      nextPage: start + pageSize < available.length ? page + 1 : null,
      sourceTotal: matching.length,
      truncated: matching.length > this.resultCap,
      fetchedAt: this.now().toISOString(),
    };
  }

  async getListing(sourceListingId: string): Promise<NormalizedListing | null> {
    this.maybeFail("getListing");
    const entry = this.byId.get(sourceListingId);
    if (!entry) return null;
    if ("rejected" in entry) throw new MarketplaceError("malformed_data", `Annonse ${sourceListingId}: ${entry.rejected.reason}`);
    return entry.listing;
  }

  private maybeFail(op: "search" | "getListing") {
    const n = this.calls[op]++;
    const code = this.options.failAll ?? this.options.failures?.[op]?.[n] ?? null;
    if (code) throw new MarketplaceError(code, `Simulert feil (${code}) i syntetisk provider`);
  }
}

function resolve(records: readonly SyntheticRawListing[], asOf: string | undefined): Entry[] {
  const asOfMs = asOf === undefined ? Infinity : Date.parse(asOf);
  const groups = new Map<string, SyntheticRawListing[]>();
  const entries: Entry[] = [];
  for (const raw of records) {
    const id = typeof raw?.id === "string" ? raw.id.trim() : "";
    if (!id) {
      entries.push({ id: "", rejected: { sourceListingId: null, code: "malformed_data", reason: "mangler kilde-ID" } });
      continue;
    }
    if (raw.modifiedAt != null && Date.parse(raw.modifiedAt) > asOfMs) continue;
    groups.set(id, [...(groups.get(id) ?? []), raw]);
  }
  for (const [id, revisions] of groups) {
    const t = (r: SyntheticRawListing) => (r.modifiedAt == null ? -Infinity : Date.parse(r.modifiedAt));
    const latestTime = Math.max(...revisions.map(t));
    const latest = revisions.filter((r) => t(r) === latestTime);
    const distinct = new Set(latest.map((r) => JSON.stringify(r)));
    if (distinct.size > 1) {
      entries.push({ id, rejected: { sourceListingId: id, code: "malformed_data", reason: "motstridende poster med samme ID og endringstid" } });
      continue;
    }
    const result = normalizeSyntheticListing(latest[0]!);
    entries.push(result.ok
      ? { id, listing: result.listing }
      : { id, rejected: { sourceListingId: result.sourceListingId, code: "malformed_data", reason: result.reason } });
  }
  return entries.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

function validateQuery(q: SearchQuery) {
  const int = (v: number | null, name: string) => {
    if (v !== null && (!Number.isInteger(v) || v < 0)) throw new MarketplaceError("invalid_query", `${name} må være et heltall ≥ 0`);
  };
  int(q.yearMin, "yearMin");
  int(q.yearMax, "yearMax");
  int(q.maxMileageKm, "maxMileageKm");
  if (q.yearMin !== null && q.yearMax !== null && q.yearMin > q.yearMax) {
    throw new MarketplaceError("invalid_query", "yearMin er større enn yearMax");
  }
  if (q.maxPrice !== null && (!Number.isInteger(q.maxPrice.amountMinor) || q.maxPrice.amountMinor <= 0)) {
    throw new MarketplaceError("invalid_query", "maxPrice må være positiv");
  }
}

function modifiedSinceOk(l: NormalizedListing, since: number | null): boolean {
  // Ukjent endringstid tas med: vi kan ikke vite at annonsen er uendret.
  return since === null || l.sourceModifiedAt === null || Date.parse(l.sourceModifiedAt) >= since;
}

/**
 * Grovt forhåndsfilter slik et kilde-API ville gjort. Reglene ligger i domenelaget (evaluateListing): kjent avvik
 * ekskluderes, ukjent verdi beholdes. Den autoritative vurderingen (match / må kontrolleres) gjøres av domenet.
 */
export function matchesQuery(l: NormalizedListing, q: SearchQuery): boolean {
  return evaluateListing(q, l).status !== "excluded";
}

export const EMPTY_QUERY: SearchQuery = {
  make: null, model: null, variant: null, yearMin: null, yearMax: null, maxMileageKm: null,
  fuels: [], transmissions: [], bodyTypes: [], countryCodes: [], maxPrice: null,
};

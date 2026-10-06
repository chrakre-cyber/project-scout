/**
 * Søkepipeline for en kjøring (DEV-005): henter sider fra en MarketplaceProvider, validerer svaret,
 * lar domenet vurdere og rangere, og produserer rader klare til lagring. Ingen database, ingen UI.
 *
 * Provideren injiseres, slik at tester bruker falske providere og en ekte provider (DEV-006) kan byttes inn.
 * Feil blir alltid en kode fra SEARCH_RUN_ERROR_CODES — aldri rå feiltekst (kan inneholde hemmeligheter).
 */
import { createHash } from "node:crypto";
import { evaluateAndRank, canonicalJson, projectSnapshot, type ResultSnapshot, type RunCounts, type SearchRunErrorCode } from "@/domain/search-run";
import type { Criterion } from "@/domain/matching";
import type { AgentFilters, NormalizedListing } from "@/domain/types";
import { MarketplaceError } from "@/providers/marketplace/errors";
import type { MarketplaceProvider, SearchPage } from "@/providers/marketplace/types";

/** Må samsvare med rank-sjekken i databasen (1–2000). */
export const MAX_STORED_RESULTS = 2_000;

export interface PipelineOptions {
  /** Tidsgrense per providerkall. */
  timeoutMs?: number;
  pageSize?: number;
  /** Øvre grense for antall sider (hindrer uendelig løkke mot en provider som ikke avslutter). */
  maxPages?: number;
  /** Totalt antall forsøk per side for forbigående feil (rate_limit/timeout/unavailable). */
  maxAttempts?: number;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

export interface ResultRow {
  sourceListingId: string;
  source: string;
  contentHash: string;
  rank: number;
  matchStatus: "match" | "needs_review";
  unknownCriteria: Criterion[];
  snapshot: ResultSnapshot;
}

export type PipelineOutcome =
  | { ok: true; rows: ResultRow[]; counts: RunCounts }
  | { ok: false; errorCode: SearchRunErrorCode };

const DEFAULTS = { timeoutMs: 10_000, pageSize: 100, maxPages: 30, maxAttempts: 3 };

class PipelineError extends Error {
  constructor(readonly code: SearchRunErrorCode) {
    super(code);
  }
}

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function runSearchPipeline(
  provider: MarketplaceProvider,
  filters: AgentFilters,
  options: PipelineOptions = {},
): Promise<PipelineOutcome> {
  const o = { ...DEFAULTS, ...options };
  const sleep = options.sleep ?? realSleep;
  const random = options.random ?? Math.random;
  try {
    const listings: NormalizedListing[] = [];
    let rejected = 0;
    let sourceTotal = 0;
    let truncated = false;
    let pages = 0;
    let page: number | null = 1;
    while (page !== null) {
      if (pages >= o.maxPages) {
        truncated = true;
        break;
      }
      const current: number = page;
      const result = await fetchPage(provider, filters, current, o, sleep, random);
      validatePage(result, provider.source, current);
      pages++;
      sourceTotal = result.sourceTotal;
      truncated = truncated || result.truncated;
      rejected += result.rejected.length;
      listings.push(...result.items);
      page = result.nextPage;
    }

    const evaluated = evaluateAndRank(filters, listings);
    const kept = evaluated.planned.slice(0, MAX_STORED_RESULTS);
    if (kept.length < evaluated.planned.length) truncated = true;
    const rows: ResultRow[] = kept.map((p) => {
      const snapshot = projectSnapshot(p.listing);
      return {
        sourceListingId: p.listing.sourceListingId,
        source: p.listing.source,
        contentHash: createHash("sha256").update(canonicalJson(snapshot)).digest("hex"),
        rank: p.rank,
        matchStatus: p.status,
        unknownCriteria: p.unknown,
        snapshot,
      };
    });
    const matches = rows.filter((r) => r.matchStatus === "match").length;
    return {
      ok: true,
      rows,
      counts: {
        sourceTotal, fetched: listings.length, matches, needsReview: rows.length - matches,
        excluded: evaluated.excluded, rejected, duplicates: evaluated.duplicates, pages, truncated,
      },
    };
  } catch (e) {
    return { ok: false, errorCode: toErrorCode(e) };
  }
}

function toErrorCode(e: unknown): SearchRunErrorCode {
  if (e instanceof PipelineError) return e.code;
  if (e instanceof MarketplaceError) return e.code;
  return "internal"; // ukjent feil: ingen tekst videre
}

async function fetchPage(
  provider: MarketplaceProvider, filters: AgentFilters, page: number,
  o: typeof DEFAULTS, sleep: (ms: number) => Promise<void>, random: () => number,
): Promise<SearchPage> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await withTimeout(provider.search(filters, { page, pageSize: o.pageSize }), o.timeoutMs);
    } catch (e) {
      const retryable = e instanceof MarketplaceError && e.retryable;
      if (!retryable || attempt >= o.maxAttempts) throw e;
      await sleep(200 * 2 ** (attempt - 1) + Math.floor(random() * 100)); // eksponentiell backoff + jitter
    }
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new MarketplaceError("timeout", "providerkall tidsavbrutt")), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

const isNonNegInt = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;

/** Provideren er ikke betrodd i form: alt vi lagrer eller teller på må være kontrollert. */
function validatePage(p: SearchPage, source: string, page: number): void {
  const bad = () => new PipelineError("malformed_data");
  if (typeof p !== "object" || p === null || !Array.isArray(p.items) || !Array.isArray(p.rejected)) throw bad();
  if (!isNonNegInt(p.sourceTotal) || typeof p.truncated !== "boolean") throw bad();
  if (p.nextPage !== null && (!Number.isSafeInteger(p.nextPage) || p.nextPage <= page)) throw bad();
  for (const l of p.items) {
    if (typeof l !== "object" || l === null) throw bad();
    if (l.source !== source) throw bad();
    if (typeof l.sourceListingId !== "string" || l.sourceListingId.length < 1 || l.sourceListingId.length > 200) throw bad();
    if (typeof l.firstSeenAt !== "string" || typeof l.lastSeenAt !== "string" || typeof l.specs !== "object" || l.specs === null) throw bad();
    if (typeof l.specs.make !== "string" || typeof l.specs.model !== "string") throw bad();
  }
}

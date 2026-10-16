/**
 * Visningsgrensen for `/searches` (DATA-002A). Dette er den ENESTE modulen som både kjenner provideren/rå annonse og bygger UI-modellen.
 * Sider og komponenter under `/searches` får bare `DisplayItem` (felt-tilstander fra `applyDisplayPolicy`, vurdering og ukjent-notater
 * uten kildeverdier). Rå annonse (`NormalizedListing`), kandidat, kildens proveniensfritekst og `sourceValue` forlater aldri denne modulen.
 * Vurderingen (evaluering/forklaring) er uavhengig av visningsretten: den bygger på kriterie-id, status og årsakskoder, ikke på verdier.
 */
import type { DisplayableListing, DisplayPolicy } from "@/domain/display-policy";
import { applyDisplayPolicy, policyForSource } from "@/domain/display-policy";
import type { CandidateAssessment, SearchSpec } from "@/domain/search-v2/types";
import { MarketplaceError, getMarketplaceProvider } from "@/providers/marketplace";
import type { MarketplaceProvider } from "@/providers/marketplace";
import { assessListing, previewSearch } from "./search-preview";
import type { PreviewItem, PreviewOutcome } from "./search-preview";

export interface DisplayItem {
  listing: DisplayableListing;
  assessment: CandidateAssessment;
  /** Hvilke kandidatfelt kilden ikke kunne oppgi (felt-id + årsakskode). Aldri kildens verdi. */
  unknowns: { field: string; code: string }[];
}

export type DisplayPreviewOutcome =
  | (Omit<Extract<PreviewOutcome, { ok: true }>, "items"> & { items: DisplayItem[] })
  | Extract<PreviewOutcome, { ok: false }>;

export type DisplayDetailOutcome =
  | { kind: "ok"; item: DisplayItem }
  | { kind: "not_found" }
  | { kind: "source_error" }
  | { kind: "not_assessable" };

export interface DisplayOptions {
  provider?: MarketplaceProvider;
  now?: () => Date;
  policyFor?: (source: string) => DisplayPolicy;
}

/** Projiserer en rå, vurdert annonse til en visningstrygg modell. Eksportert for tester. */
export function toDisplayItem(item: PreviewItem, policy: DisplayPolicy, now: Date): DisplayItem {
  return {
    listing: applyDisplayPolicy(item.listing, policy, now),
    assessment: item.assessment,
    unknowns: item.meta.explanations.map((e) => ({ field: String(e.field), code: e.code })),
  };
}

export async function previewForDisplay(spec: SearchSpec, opts: DisplayOptions = {}): Promise<DisplayPreviewOutcome> {
  const now = opts.now ?? (() => new Date());
  const policyFor = opts.policyFor ?? policyForSource;
  const outcome = await previewSearch(spec, opts.provider ?? getMarketplaceProvider(), now);
  if (!outcome.ok) return outcome;
  const t = now();
  return { ...outcome, items: outcome.items.map((i) => toDisplayItem(i, policyFor(i.listing.source), t)) };
}

export async function detailForDisplay(spec: SearchSpec, listingId: string, opts: DisplayOptions = {}): Promise<DisplayDetailOutcome> {
  const now = opts.now ?? (() => new Date());
  const policyFor = opts.policyFor ?? policyForSource;
  let listing = null;
  try { listing = await (opts.provider ?? getMarketplaceProvider()).getListing(listingId); } catch (e) {
    if (!(e instanceof MarketplaceError)) throw e;
    return { kind: "source_error" };
  }
  if (!listing) return { kind: "not_found" };
  const item = assessListing(spec, listing, now);
  if (!item) return { kind: "not_assessable" };
  return { kind: "ok", item: toDisplayItem(item, policyFor(listing.source), now()) };
}

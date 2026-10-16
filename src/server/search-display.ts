/**
 * Visningsgrensen for `/searches` (DATA-002A). Dette er den ENESTE modulen som både kjenner provideren/rå annonse og bygger UI-modellen.
 * Sider og komponenter under `/searches` får bare `DisplayItem` (felt-tilstander fra `applyDisplayPolicy`, vurdering og ukjent-notater
 * uten kildeverdier). Rå annonse (`NormalizedListing`), kandidat, kildens proveniensfritekst og `sourceValue` forlater aldri denne modulen.
 * Vurderingen (evaluering/forklaring) er uavhengig av visningsretten: den bygger på kriterie-id, status og årsakskoder, ikke på verdier.
 */
import type { DisplayableListing, DisplayPolicy } from "@/domain/display-policy";
import { applyDisplayPolicy } from "@/domain/display-policy";
import { REGISTERED_PROFILES, matchingRights, policyForSource, restrictForMatching, rightsForSource } from "@/domain/provider-rights";
import type { ProviderRightsProfile } from "@/domain/provider-rights";
import type { CandidateAssessment, SearchSpec } from "@/domain/search-v2/types";
import { MarketplaceError, getMarketplaceProvider } from "@/providers/marketplace";
import type { MarketplaceProvider } from "@/providers/marketplace";
import type { NormalizedListing } from "@/domain/types";
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
  /** Rettighetsprofiler (standard: de registrerte; i dag bare den syntetiske). */
  profiles?: readonly ProviderRightsProfile[];
  /** Overstyrer visningspolicyen (tester). Matching styres fortsatt av profilene. */
  policyFor?: (source: string, now: Date) => DisplayPolicy;
}

/** Forbehandling før vurdering: bruker profilens *matching*-rettigheter (adskilt fra visning). Ukjent/utløpt/trukket kilde ⇒ ingenting kan brukes. */
function matchingPrepare(profiles: readonly ProviderRightsProfile[], now: () => Date) {
  return (listing: NormalizedListing) => restrictForMatching(listing, matchingRights(rightsForSource(listing.source, now(), profiles))).listing;
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
  const profiles = opts.profiles ?? REGISTERED_PROFILES;
  const policyFor = opts.policyFor ?? ((source: string, at: Date) => policyForSource(source, at, profiles));
  const outcome = await previewSearch(spec, opts.provider ?? getMarketplaceProvider(), now, matchingPrepare(profiles, now));
  if (!outcome.ok) return outcome;
  const t = now();
  return { ...outcome, items: outcome.items.map((i) => toDisplayItem(i, policyFor(i.listing.source, t), t)) };
}

export async function detailForDisplay(spec: SearchSpec, listingId: string, opts: DisplayOptions = {}): Promise<DisplayDetailOutcome> {
  const now = opts.now ?? (() => new Date());
  const profiles = opts.profiles ?? REGISTERED_PROFILES;
  const policyFor = opts.policyFor ?? ((source: string, at: Date) => policyForSource(source, at, profiles));
  let listing = null;
  try { listing = await (opts.provider ?? getMarketplaceProvider()).getListing(listingId); } catch (e) {
    if (!(e instanceof MarketplaceError)) throw e;
    return { kind: "source_error" };
  }
  if (!listing) return { kind: "not_found" };
  const item = assessListing(spec, listing, now, matchingPrepare(profiles, now));
  if (!item) return { kind: "not_assessable" };
  return { kind: "ok", item: toDisplayItem(item, policyFor(listing.source, now()), now()) };
}

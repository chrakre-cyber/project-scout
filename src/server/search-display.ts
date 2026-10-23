/**
 * Visningsgrensen for `/searches` (DATA-002A) og det eneste stedet proveniens og rettighetsprofil møter UI-modellen (DATA-002C).
 * Sider og komponenter får bare `DisplayItem` (felt-tilstander fra `applyDisplayPolicy`, vurdering og ukjent-notater uten kildeverdier).
 * Rå annonse, kandidat, leverandørens annonse-id og `InternalProvenance` forlater aldri denne modulen: proveniens brukes her til å
 * FEILE LUKKET (ukjent/endret/utløpt/trukket profil, utløpte kildedata) og til å lage den opake offentlige id-en.
 */
import { demoEnrichmentFor, demoMediaFor, type ListingEnrichment, type ListingMedia } from "@/server/demo-media";
import type { DisplayableListing, DisplayPolicy } from "@/domain/display-policy";
import { applyDisplayPolicy } from "@/domain/display-policy";
import { buildProvenance, evaluateProvenance } from "@/domain/provenance";
import type { InternalProvenance, ProvenanceStatus } from "@/domain/provenance";
import { matchingRights, policyForSource, restrictForMatching, rightsForSource } from "@/domain/provider-rights";
import type { ProviderRightsProfile, ResolvedRights } from "@/domain/provider-rights";
import type { DealerProfileV1, EconomicsView, StoredDealerInput } from "@/domain/search-economics";
import type { CandidateAssessment, SearchSpec } from "@/domain/search-v2/types";
import type { NormalizedListing } from "@/domain/types";
import { EMPTY_QUERY, MarketplaceError, getMarketplaceProvider } from "@/providers/marketplace";
import type { MarketplaceProvider } from "@/providers/marketplace";
import { storedKey } from "./dealer-economics";
import { toDisplayEconomics, toDisplayEconomicsWithoutContext } from "./economics-view";
import { PublicIdKeyMissingError, profileDigest, publicIdFor } from "./public-ids";
import { handleFor } from "./result-handles";
import { loadRuntimeProfiles } from "./rights-runtime";
import type { ProviderResultHandle } from "@/domain/result-handle";
import { assessEconomics } from "./search-economics";
import { assessListing, previewSearch } from "./search-preview";
import type { PreviewItem, PreviewOutcome } from "./search-preview";

export interface DisplayItem {
  listing: DisplayableListing;
  assessment: CandidateAssessment;
  /** Hvilke kandidatfelt kilden ikke kunne oppgi (felt-id + årsakskode). Aldri kildens verdi. */
  unknowns: { field: string; code: string }[];
  /**
   * Avledet økonomi (ECON-005d) som ferdig visningsmodell: status, fast etikettnøkkel, beløp som tekst og koder. Passerer rettighetsgrensen (beregnings- og visningsrett,
   * visningsrett for pris); aldri kjerneresultat, forhandlerinput eller annonseverdier. Gir aldri budsjettutfall; lagres ikke.
   */
  economics: EconomicsView;
  /** DEMO-RESULTS-001: lokale demo-bilder (aldri leverandørmedia); `null` = ingen bilder. */
  media: ListingMedia | null;
  /** DEMO-RESULTS-001: demoberiket info (ikke søkekriterier); `null` = ingen. */
  enrichment: ListingEnrichment | null;
}

/** Forhandlerkontekst for økonomivisning. Firma og søk kommer fra serverens validerte sesjon/utkast — aldri fra klienten. Lest fra firmabundet lagring av kalleren. */
export interface EconomicsContext {
  dealershipId: string;
  searchId: string;
  /** Bekreftet forhandlerinput for søket, indeksert med `storedKey(kandidat-id, revisjon)`. */
  storedInputs: ReadonlyMap<string, StoredDealerInput>;
  profile: DealerProfileV1 | null;
}

/** Server-internt: visningsmodell + proveniens. Eksporteres bare for tester og fremtidig lagring; UI får aldri denne typen. */
export interface InternalItem { display: DisplayItem; provenance: InternalProvenance; /** DATA-002D: minimal, typet referanse (ingen rå leverandør-id eller nyttelast). */ handle: ProviderResultHandle }

type PreviewOk = Extract<PreviewOutcome, { ok: true }>;
export type DisplayPreviewOutcome =
  | (Omit<PreviewOk, "items" | "coverage"> & { items: DisplayItem[]; coverage: PreviewOk["coverage"] & { withheldByProvenance: number } })
  | Extract<PreviewOutcome, { ok: false }>;

export type DisplayDetailOutcome =
  | { kind: "ok"; item: DisplayItem }
  | { kind: "not_found" }
  | { kind: "blocked"; reason: Exclude<ProvenanceStatus, "valid"> }
  | { kind: "source_error" }
  | { kind: "not_assessable" };

export interface DisplayOptions {
  provider?: MarketplaceProvider;
  now?: () => Date;
  /** Rettighetsprofiler. Standard: lastes ved kjøring fra den autoritative tabellen (DATA-002D) + syntetiske kodeprofiler; uten databasevei er det bare den syntetiske. */
  profiles?: readonly ProviderRightsProfile[];
  /** Overstyrer visningspolicyen (tester). Matching og proveniens styres fortsatt av profilene. */
  policyFor?: (source: string, now: Date) => DisplayPolicy;
  /** Verdi av SCOUT_PUBLIC_ID_KEY (injiserbar i tester). */
  publicIdKey?: string;
  /** ECON-005d: forhandlerkontekst. Uten kontekst vises økonomi som «ikke beregnet» (ingen oppslag, ingen tall). */
  economics?: EconomicsContext;
  correlationId?: string;
}

/** Forbehandling før vurdering: bruker profilens *matching*-rettigheter (adskilt fra visning). Ukjent/utløpt/trukket kilde ⇒ ingenting kan brukes. */
function matchingPrepare(profiles: readonly ProviderRightsProfile[], now: () => Date) {
  return (listing: NormalizedListing) => restrictForMatching(listing, matchingRights(rightsForSource(listing.source, now(), profiles))).listing;
}

/** Projiserer en rå, vurdert annonse til en visningstrygg modell. Eksportert for tester. */
export function toDisplayItem(item: PreviewItem, policy: DisplayPolicy, now: Date, publicId: string, economics: EconomicsView): DisplayItem {
  return {
    economics,
    media: demoMediaFor(item.listing),
    enrichment: demoEnrichmentFor(item.listing),
    listing: applyDisplayPolicy(item.listing, policy, now, { publicId }),
    assessment: item.assessment,
    unknowns: item.meta.explanations.map((e) => ({ field: String(e.field), code: e.code })),
  };
}

/**
 * Bygger visningsmodell og proveniens for en vurdert annonse, og evaluerer proveniensen. Gir `null` med årsak hvis annonsen ikke kan vises
 * (ingen profil i kraft, id-nøkkel mangler, endret/utløpt/trukket profil, utløpte kildedata) — feiler lukket.
 */
function internalItem(item: PreviewItem, o: Required<Pick<DisplayOptions, "profiles">> & DisplayOptions, now: Date, spec: SearchSpec): { ok: true; value: InternalItem } | { ok: false; reason: Exclude<ProvenanceStatus, "valid"> } {
  const source = item.listing.source;
  const rights = rightsForSource(source, now, o.profiles);
  if (!rights.inForce) return { ok: false, reason: rights.reason === "revoked" ? "rights_revoked" : rights.reason === "expired" ? "rights_expired" : "rights_unknown" };
  let publicId: string;
  try { publicId = publicIdFor(source, item.listing.sourceListingId, rights.profile.environment, o.publicIdKey); }
  catch (e) { if (e instanceof PublicIdKeyMissingError) return { ok: false, reason: "rights_unknown" }; throw e; }
  const provenance = buildProvenance({
    listing: item.listing, publicId, profile: rights.profile, profileDigest: profileDigest(rights.profile), retrievedAt: new Date(item.retrievedAt),
    schemaVersion: `${item.meta.mapping.sourceId}@${item.meta.mapping.version}`, correlationId: o.correlationId ?? null,
  });
  const status = evaluateProvenance(provenance, { profiles: o.profiles, now, digestOf: profileDigest });
  if (status !== "valid") return { ok: false, reason: status };
  const policy = (o.policyFor ?? ((s: string, at: Date) => policyForSource(s, at, o.profiles)))(source, now);
  // ECON-005d: økonomi vurderes først ETTER at rettigheter og proveniens er gyldige, og vises bare gjennom rettighets- og feltvisningsgrensen.
  const ec = o.economics;
  const economics = ec === undefined ? toDisplayEconomicsWithoutContext(rights, policy) : toDisplayEconomics(assessEconomics({
    dealershipId: ec.dealershipId, searchId: ec.searchId, listing: item.listing, candidate: item.candidate, spec,
    stored: ec.storedInputs.get(storedKey(item.candidate.id, item.candidate.version)) ?? null, profile: ec.profile, profiles: o.profiles, now,
  }), policy);
  return { ok: true, value: { display: toDisplayItem(item, policy, now, publicId, economics), provenance, handle: handleFor(provenance) } };
}

/** Server-internt: som `previewForDisplay`, men med proveniens. UI bruker aldri denne. */
export async function previewInternal(spec: SearchSpec, opts: DisplayOptions = {}): Promise<
  { ok: true; items: InternalItem[]; outcome: PreviewOk; withheldByProvenance: number } | Extract<PreviewOutcome, { ok: false }>
> {
  const now = opts.now ?? (() => new Date());
  const profiles = opts.profiles ?? await loadRuntimeProfiles();
  const outcome = await previewSearch(spec, opts.provider ?? getMarketplaceProvider(), now, matchingPrepare(profiles, now));
  if (!outcome.ok) return outcome;
  const t = now();
  const items: InternalItem[] = [];
  let withheld = 0;
  for (const i of outcome.items) {
    const r = internalItem(i, { ...opts, profiles }, t, spec);
    if (r.ok) items.push(r.value); else withheld++;
  }
  return { ok: true, items, outcome, withheldByProvenance: withheld };
}

export async function previewForDisplay(spec: SearchSpec, opts: DisplayOptions = {}): Promise<DisplayPreviewOutcome> {
  const r = await previewInternal(spec, opts);
  if (!r.ok) return r;
  // Tellerne skal bare gjelde det som faktisk kan vises: annonser som feilet lukket telles ikke som treff.
  const count = (st: string) => r.items.filter((i) => i.display.assessment.vehicle.status === st).length;
  return {
    ...r.outcome,
    items: r.items.map((i) => i.display),
    counts: { match: count("match"), needsReview: count("needs_review"), excluded: count("excluded") },
    coverage: { ...r.outcome.coverage, withheldByProvenance: r.withheldByProvenance },
  };
}

/** Miljø for en leverandør ut fra høyeste registrerte profilversjon (også når ingen profil er i kraft), ellers null (ukjent leverandør). */
const environmentOf = (source: string, profiles: readonly ProviderRightsProfile[]) =>
  [...profiles].filter((p) => p.providerId === source).sort((a, b) => b.version - a.version)[0]?.environment ?? null;

/**
 * Finner en annonse ut fra den opake id-en ved å gå gjennom leverandørens sider (id-en er enveis). Dyrt for ekte leverandører
 * (kvote); erstattes av en lagret, tenant-avgrenset handle-tabell før ekte data — se DATA-002C. Ukjent leverandør (ingen profil i det hele tatt)
 * kan ikke gi en id og hoppes over; en leverandør med trukket/utløpt profil kan identifiseres, slik at avslaget får riktig årsak.
 */
const MAX_RESOLVE_PAGES = 30;
async function resolvePublicId(provider: MarketplaceProvider, publicId: string, o: Required<Pick<DisplayOptions, "profiles">> & DisplayOptions):
  Promise<{ listing: NormalizedListing; fetchedAt: string } | null> {
  for (let page: number | null = 1, n = 0; page !== null && n < MAX_RESOLVE_PAGES; n++) {
    const current: number = page;
    const res = await provider.search(EMPTY_QUERY, { page: current, pageSize: 100 });
    if (!Array.isArray(res.items) || (res.nextPage !== null && (!Number.isSafeInteger(res.nextPage) || res.nextPage <= current))) throw new MarketplaceError("malformed_data", "ugyldig side");
    for (const l of res.items) {
      const env = environmentOf(l.source, o.profiles);
      if (env === null) continue;
      let id: string;
      try { id = publicIdFor(l.source, l.sourceListingId, env, o.publicIdKey); } catch (e) { if (e instanceof PublicIdKeyMissingError) continue; throw e; }
      if (id === publicId) return { listing: l, fetchedAt: res.fetchedAt };
    }
    page = res.nextPage;
  }
  return null;
}

/** Server-internt: som `detailForDisplay`, men med kandidatidentiteten og de gjeldende rettighetene (bare til forhandlerinput-flyten; UI får aldri disse). */
export type DealerTarget =
  | { kind: "ok"; item: DisplayItem; candidate: { id: string; version: string }; rights: ResolvedRights }
  | Exclude<DisplayDetailOutcome, { kind: "ok" }>;

export async function resolveDealerTarget(spec: SearchSpec, publicId: string, opts: DisplayOptions = {}): Promise<DealerTarget> {
  const now = opts.now ?? (() => new Date());
  const profiles = opts.profiles ?? await loadRuntimeProfiles();
  const o = { ...opts, profiles };
  let found: { listing: NormalizedListing; fetchedAt: string } | null = null;
  try { found = await resolvePublicId(opts.provider ?? getMarketplaceProvider(), publicId, o); } catch (e) {
    if (!(e instanceof MarketplaceError)) throw e;
    return { kind: "source_error" };
  }
  if (!found) return { kind: "not_found" };
  // Rettigheter først: ukjent/ikke i kraft/trukket/utløpt gir et avslag MED årsak (ikke «ikke funnet» og aldri «ukjent»).
  const rights = rightsForSource(found.listing.source, now(), profiles);
  if (!rights.inForce) return { kind: "blocked", reason: rights.reason === "revoked" ? "rights_revoked" : rights.reason === "expired" ? "rights_expired" : "rights_unknown" };
  const item = assessListing(spec, found.listing, now, matchingPrepare(profiles, now), found.fetchedAt);
  if (!item) return { kind: "not_assessable" };
  const r = internalItem(item, o, now(), spec);
  if (!r.ok) return { kind: "blocked", reason: r.reason };
  return { kind: "ok", item: r.value.display, candidate: { id: item.candidate.id, version: item.candidate.version }, rights };
}

export async function detailForDisplay(spec: SearchSpec, publicId: string, opts: DisplayOptions = {}): Promise<DisplayDetailOutcome> {
  const t = await resolveDealerTarget(spec, publicId, opts);
  return t.kind === "ok" ? { kind: "ok", item: t.item } : t;
}

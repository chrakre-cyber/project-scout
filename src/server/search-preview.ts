/**
 * Manuell forhåndsvisning av et lagret søk mot den syntetiske demokilden (SEARCH-005).
 *
 * Kjeden: provider (alle tilgjengelige sider, innen dokumentert grense) → kandidatadapter (SEARCH-004) →
 * `evaluateCandidate` (SEARCH-002) → `classifyBudget` uten kostnadsvurdering → `combineAssessment`.
 *  - Ingen hardfilter før vurderingen: provideren får et tomt søk, så et ønske blir aldri et filter og ukjente biler utelates ikke.
 *  - Ingen kostnadsvurdering finnes (avgiftsmotor er ikke bygget). Budsjettstatus er derfor alltid «ikke beregnet»; ingen
 *    kandidat kan bli «fullt treff». Annonsepris er aldri total innkjøpskostnad til Norge.
 *  - Resultatet beregnes for forespørselen og lagres ikke. Ingen live kilde, ingen nettverk, ingen kildeutdrag i søket.
 *  - Provider og klokke injiseres (tester kan simulere kildefeil og avkorting).
 */
import { buildCandidateAdapter } from "@/adapters/search-candidate/candidate";
import type { CandidateAdapter, CandidateMeta } from "@/adapters/search-candidate/candidate";
import { SYNTHETIC_SOURCE_CAPABILITIES } from "@/adapters/search-candidate/capabilities";
import { SYNTHETIC_MAPPING_DATA } from "@/adapters/search-candidate/synthetic-mapping-data";
import { DEMO_CATALOG } from "@/adapters/search-catalog/demo-catalog";
import { classifyBudget, combineAssessment } from "@/domain/search-v2/budget";
import { criteriaSourceCannotSupply, evaluateCandidate } from "@/domain/search-v2/evaluation";
import type { BudgetClassification, CandidateAssessment, CandidateV2, CriterionId, SearchSpec } from "@/domain/search-v2/types";
import type { NormalizedListing } from "@/domain/types";
import { EMPTY_QUERY, MarketplaceError, MARKETPLACE_ERROR_LABEL } from "@/providers/marketplace";
import type { MarketplaceProvider } from "@/providers/marketplace";
import type { MarketplaceErrorCode } from "@/providers/marketplace/errors";

/** Samme sidegrense som søkepipelinen (DEV-005): 30 sider à 100. Over grensen markeres resultatet som avkortet. */
export const PREVIEW_MAX_PAGES = 30;
export const PREVIEW_PAGE_SIZE = 100;

/** Forbehandling før vurdering (matchingretten); null = annonsen kan ikke vurderes. */
export type PrepareListing = (listing: NormalizedListing) => NormalizedListing | null;

export interface PreviewItem {
  listing: NormalizedListing;
  /** Når annonsen ble hentet fra kilden (sidens `fetchedAt`). Server-internt; brukes til proveniens (DATA-002C). */
  retrievedAt: string;
  candidate: CandidateV2;
  meta: CandidateMeta;
  assessment: CandidateAssessment;
}

export interface PreviewCoverage {
  /** Annonser hentet fra kilden og vurdert. */
  evaluated: number;
  /** Antall treff kilden oppgir (kan være flere enn hentet). */
  sourceTotal: number;
  pages: number;
  /** true når bare deler av kilden er hentet (sidegrense eller kildens egen grense). */
  truncated: boolean;
  /** Kilde-poster som ikke kunne normaliseres og derfor ikke er vurdert. */
  rejectedBySource: number;
  /** Annonser som ikke kunne gjøres om til kandidat og derfor ikke er vurdert. */
  notAdapted: number;
}

export type PreviewOutcome =
  | {
    ok: true;
    /** Alle vurderte annonser i kildens rekkefølge, gruppert etter kravstatus. */
    items: PreviewItem[];
    counts: { match: number; needsReview: number; excluded: number };
    coverage: PreviewCoverage;
    /** Kriterier i søket som demokilden ikke kan levere (alle biler får «ikke oppgitt»). */
    sourceCannotSupply: CriterionId[];
    /** Budsjettgrense i øre når budsjett er satt (grense, ikke bekreftet treff). */
    budget: BudgetClassification | null;
  }
  | { ok: false; code: MarketplaceErrorCode | "internal"; message: string };

let cachedAdapter: CandidateAdapter | null = null;
function adapter(): CandidateAdapter {
  if (cachedAdapter) return cachedAdapter;
  const built = buildCandidateAdapter(SYNTHETIC_MAPPING_DATA, DEMO_CATALOG);
  if (!built.ok) throw new Error("Kandidatmappingen er ugyldig mot demokatalogen");
  cachedAdapter = built.adapter;
  return cachedAdapter;
}

/** Vurderer én annonse mot søket (samme regler som i listen). `null` når annonsen ikke kan gjøres om til kandidat. */
export function assessListing(spec: SearchSpec, listing: NormalizedListing, now: () => Date = () => new Date(), prepare?: PrepareListing, retrievedAt?: string): PreviewItem | null {
  // DATA-002B: `prepare` fjerner det som ikke kan brukes til matching (egen rett, adskilt fra visning); null = uvurderbar.
  const prepared = prepare ? prepare(listing) : listing;
  if (prepared === null) return null;
  const r = adapter().adapt(prepared);
  if (!r.ok) return null;
  const vehicle = evaluateCandidate(spec, r.candidate);
  const budget = classifyBudget(spec, { id: r.candidate.id, version: r.candidate.version }, null, now().toISOString());
  // `listing` er den opprinnelige (rå) annonsen; visningsretten avgjøres separat av `applyDisplayPolicy`.
  return { listing, retrievedAt: retrievedAt ?? now().toISOString(), candidate: r.candidate, meta: r.meta, assessment: combineAssessment(vehicle, budget) };
}

export async function previewSearch(spec: SearchSpec, provider: MarketplaceProvider, now: () => Date = () => new Date(), prepare?: PrepareListing): Promise<PreviewOutcome> {
  try {
    const listings: NormalizedListing[] = [];
    const fetchedAt: string[] = [];
    let sourceTotal = 0, rejected = 0, pages = 0;
    let truncated = false;
    let page: number | null = 1;
    while (page !== null) {
      if (pages >= PREVIEW_MAX_PAGES) { truncated = true; break; }
      const current: number = page;
      const result = await provider.search(EMPTY_QUERY, { page: current, pageSize: PREVIEW_PAGE_SIZE });
      if (typeof result !== "object" || result === null || !Array.isArray(result.items) || !Array.isArray(result.rejected)
        || !Number.isSafeInteger(result.sourceTotal) || typeof result.truncated !== "boolean"
        || (result.nextPage !== null && (!Number.isSafeInteger(result.nextPage) || result.nextPage <= current))) {
        throw new MarketplaceError("malformed_data", "ugyldig side");
      }
      pages++;
      sourceTotal = result.sourceTotal;
      truncated = truncated || result.truncated;
      rejected += result.rejected.length;
      listings.push(...result.items);
      for (let n = 0; n < result.items.length; n++) fetchedAt.push(result.fetchedAt);
      page = result.nextPage;
    }

    const nowIso = now().toISOString();
    const items: PreviewItem[] = [];
    let notAdapted = 0;
    for (const [idx, listing] of listings.entries()) {
      const item = assessListing(spec, listing, now, prepare, fetchedAt[idx]);
      if (item) items.push(item); else notAdapted++;
    }
    const count = (s: string) => items.filter((i) => i.assessment.vehicle.status === s).length;
    return {
      ok: true,
      items,
      counts: { match: count("match"), needsReview: count("needs_review"), excluded: count("excluded") },
      coverage: { evaluated: items.length, sourceTotal, pages, truncated, rejectedBySource: rejected, notAdapted },
      sourceCannotSupply: criteriaSourceCannotSupply(spec, SYNTHETIC_SOURCE_CAPABILITIES),
      budget: items[0]?.assessment.budget ?? classifyBudget(spec, { id: "-", version: "-" }, null, nowIso),
    };
  } catch (e) {
    if (e instanceof MarketplaceError) return { ok: false, code: e.code, message: MARKETPLACE_ERROR_LABEL[e.code] };
    return { ok: false, code: "internal", message: "Forhåndsvisningen kunne ikke gjennomføres." };
  }
}

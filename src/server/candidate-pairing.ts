/**
 * ECON-005c (retting): kontrollert kobling mellom annonse og kandidat (id + revisjon) FØR en forhandlerbekreftelse kan brukes.
 *
 * `assessEconomics` får både annonse og kandidat. Uten kontroll kan en bekreftelse for annonse A (riktig kandidat-id) kombineres med pris/spesifikasjoner fra annonse B. Her
 * utledes kandidatens identitet og revisjon PÅ NYTT fra den aktuelle annonsen med samme kandidatadapter og samme forbehandling som søkepipelinen (`assessListing`: matchingretten
 * via `restrictForMatching`), og må være lik den oppgitte kandidaten:
 *  - id: `candidateId(source, sourceListingId)` (lengdeprefikset, kanonisk);
 *  - revisjon: SHA-256 over annonsens innhold + mappingens id/versjon (adapterens kontrakt) — ikke en uavhengig oppgitt streng.
 * Dette er kandidatdannelsens (matching) vei, ikke økonomisk bruk av kildefelt: kontrollen sammenligner bare id og revisjon og leverer aldri feltverdier videre til økonomien.
 * Kilder uten registrert mapping (alt unntatt den syntetiske demokilden) kan ikke verifiseres og avvises (lukket). Rent; ingen I/O.
 */
import { buildCandidateAdapter, candidateId } from "@/adapters/search-candidate/candidate";
import type { CandidateAdapter } from "@/adapters/search-candidate/candidate";
import { SYNTHETIC_MAPPING_DATA } from "@/adapters/search-candidate/synthetic-mapping-data";
import { DEMO_CATALOG } from "@/adapters/search-catalog/demo-catalog";
import { matchingRights, restrictForMatching } from "@/domain/provider-rights";
import type { ResolvedRights } from "@/domain/provider-rights";
import type { NormalizedListing } from "@/domain/types";

export type PairingVerdict =
  | { ok: true }
  | { ok: false; reason: "identity_mismatch" | "revision_mismatch" | "not_adaptable" | "mapping_unavailable" };

let cached: CandidateAdapter | null | undefined;
/** Kandidatadapteren for den registrerte (syntetiske) kilden; `null` hvis mappingen er ugyldig. */
export function registeredCandidateAdapter(): CandidateAdapter | null {
  if (cached !== undefined) return cached;
  const built = buildCandidateAdapter(SYNTHETIC_MAPPING_DATA, DEMO_CATALOG);
  cached = built.ok ? built.adapter : null;
  return cached;
}

export function verifyCandidatePair(a: { listing: NormalizedListing; candidate: { id: string; version: string }; rights: ResolvedRights; adapter?: CandidateAdapter | null }): PairingVerdict {
  // 1. Kanonisk identitet (leser bare kilde og annonse-id).
  if (typeof a.candidate.id !== "string" || a.candidate.id !== candidateId(a.listing.source, a.listing.sourceListingId)) return { ok: false, reason: "identity_mismatch" };
  const adapter = a.adapter === undefined ? registeredCandidateAdapter() : a.adapter;
  if (adapter === null) return { ok: false, reason: "mapping_unavailable" };
  // 2. Revisjon: samme forbehandling som pipelinen (matchingretten), deretter adapterens egen revisjon.
  const prepared = restrictForMatching(a.listing, matchingRights(a.rights)).listing;
  if (prepared === null) return { ok: false, reason: "not_adaptable" };
  const r = adapter.adapt(prepared);
  if (!r.ok) return { ok: false, reason: "not_adaptable" };
  if (r.candidate.id !== a.candidate.id) return { ok: false, reason: "identity_mismatch" };
  if (typeof a.candidate.version !== "string" || r.candidate.version !== a.candidate.version) return { ok: false, reason: "revision_mismatch" };
  return { ok: true };
}

/**
 * Stabil, minimal referanse til et leverandørresultat (DATA-002D). Rent domene: ingen I/O, ingen kryptografi (hash injiseres).
 *
 * Handlen lar produktkode peke på et resultat uten å kjenne leverandørens rå id eller nyttelast. Den bærer BARE: leverandør (Merovos egen
 * nøkkel), miljø, opak resultat-id (`m1_…`, enveis HMAC fra DATA-002C), en proveniensreferanse, rettighetsprofil@versjon med avtrykk, og
 * hentetidspunkt. Den bærer aldri leverandørens annonse-id, kilde-URL, tekst, pris eller andre annonsedata; `parseResultHandle` avviser alt
 * som ikke er nøyaktig disse feltene, slik at rå verdier ikke kan smugles inn.
 *
 * `provenanceRef` er et avtrykk av proveniensens identitetsfelt (ikke en lagret id): endres leverandør, resultat-id, rettighetsprofil, hentetid
 * eller skjemaversjon, endres referansen, og `verifyHandle` avslører misforholdet.
 */
import type { InternalProvenance } from "./provenance";
import type { ProviderEnvironment } from "./provider-rights";

export const RESULT_ID_PATTERN = /^m1_[A-Za-z0-9_-]{24}$/;
export const PROVENANCE_REF_PATTERN = /^pv1_[0-9a-f]{32}$/;
const PROVIDER_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
/** Gyldige miljønavn (samme sett som `ProviderEnvironment`). */
const ENVIRONMENTS: readonly string[] = ["synthetic", "sandbox", "live"]; // ingen live-leverandør er koblet til
const DIGEST_PATTERN = /^[0-9a-f]{64}$/;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

export interface ProviderResultHandle {
  readonly version: 1;
  readonly providerId: string;
  readonly environment: ProviderEnvironment;
  /** Opak Merovo-id (samme som `listingId` i visningsmodellen). */
  readonly resultId: string;
  readonly provenanceRef: string;
  readonly rights: { readonly profileId: string; readonly version: number; readonly digest: string };
  /** ISO 8601 UTC. */
  readonly retrievedAt: string;
}

/** SHA-256 (hex) av en streng — injiseres av serveren. */
export type HashFn = (input: string) => string;

/** Avtrykk av proveniensens identitet. Inneholder ikke leverandørens rå annonse-id (resultat-id er allerede enveis av den). */
export function provenanceReference(p: InternalProvenance, hash: HashFn): string {
  const canonical = ["pv1", p.providerId, p.environment, p.publicId, p.rightsProfile.id, String(p.rightsProfile.version), p.rightsProfile.digest, p.retrievedAt, p.schemaVersion]
    .map((s) => `${s.length}:${s}`).join("|");
  return `pv1_${hash(canonical).slice(0, 32)}`;
}

export function createResultHandle(p: InternalProvenance, hash: HashFn): ProviderResultHandle {
  return Object.freeze({
    version: 1,
    providerId: p.providerId,
    environment: p.environment,
    resultId: p.publicId,
    provenanceRef: provenanceReference(p, hash),
    rights: Object.freeze({ profileId: p.rightsProfile.id, version: p.rightsProfile.version, digest: p.rightsProfile.digest }),
    retrievedAt: p.retrievedAt,
  });
}

export type HandleParseIssue =
  | "not_object" | "unknown_keys" | "version" | "provider_id" | "environment" | "result_id" | "provenance_ref" | "rights" | "retrieved_at";
export type HandleParseResult = { ok: true; handle: ProviderResultHandle } | { ok: false; issue: HandleParseIssue };

const isRecord = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const sameKeys = (o: Record<string, unknown>, keys: readonly string[]) => Object.keys(o).sort().join() === [...keys].sort().join();

/** Streng validering av ukjent input (f.eks. deserialisert). Ingen delvis tolkning; ukjente nøkler avvises. */
export function parseResultHandle(input: unknown): HandleParseResult {
  if (!isRecord(input)) return { ok: false, issue: "not_object" };
  if (!sameKeys(input, ["version", "providerId", "environment", "resultId", "provenanceRef", "rights", "retrievedAt"])) return { ok: false, issue: "unknown_keys" };
  if (input.version !== 1) return { ok: false, issue: "version" };
  if (typeof input.providerId !== "string" || !PROVIDER_ID_PATTERN.test(input.providerId)) return { ok: false, issue: "provider_id" };
  if (typeof input.environment !== "string" || !ENVIRONMENTS.includes(input.environment)) return { ok: false, issue: "environment" };
  if (typeof input.resultId !== "string" || !RESULT_ID_PATTERN.test(input.resultId)) return { ok: false, issue: "result_id" };
  if (typeof input.provenanceRef !== "string" || !PROVENANCE_REF_PATTERN.test(input.provenanceRef)) return { ok: false, issue: "provenance_ref" };
  const r = input.rights;
  if (!isRecord(r) || !sameKeys(r, ["profileId", "version", "digest"])) return { ok: false, issue: "rights" };
  if (typeof r.version !== "number" || !Number.isSafeInteger(r.version) || r.version < 1 || typeof r.digest !== "string" || !DIGEST_PATTERN.test(r.digest)
      || r.profileId !== `${input.providerId}@${r.version}`) return { ok: false, issue: "rights" };
  if (typeof input.retrievedAt !== "string" || !ISO_UTC.test(input.retrievedAt) || !Number.isFinite(Date.parse(input.retrievedAt))) return { ok: false, issue: "retrieved_at" };
  return { ok: true, handle: Object.freeze({
    version: 1, providerId: input.providerId, environment: input.environment as ProviderEnvironment, resultId: input.resultId, provenanceRef: input.provenanceRef,
    rights: Object.freeze({ profileId: r.profileId as string, version: r.version, digest: r.digest }), retrievedAt: input.retrievedAt,
  }) };
}

export type HandleMismatch = "provider_mismatch" | "result_id_mismatch" | "rights_mismatch" | "provenance_mismatch";

/** Hører handlen til denne proveniensen? `null` = ja. Rekkefølge: leverandør/miljø → resultat-id → rettighetsprofil → proveniensreferanse (fanger resten). */
export function verifyHandle(h: ProviderResultHandle, p: InternalProvenance, hash: HashFn): HandleMismatch | null {
  if (h.providerId !== p.providerId || h.environment !== p.environment) return "provider_mismatch";
  if (h.resultId !== p.publicId) return "result_id_mismatch";
  if (h.rights.profileId !== p.rightsProfile.id || h.rights.version !== p.rightsProfile.version || h.rights.digest !== p.rightsProfile.digest) return "rights_mismatch";
  if (h.provenanceRef !== provenanceReference(p, hash) || h.retrievedAt !== p.retrievedAt) return "provenance_mismatch";
  return null;
}

/**
 * Resultat-handles og samlet tilgangsvurdering på serversiden (DATA-002D). Binder kryptografi (SHA-256/HMAC) til de rene domenefunksjonene.
 * Handlen og vurderingen er serverinterne hjelpere; UI får fortsatt bare `DisplayItem` (DATA-002A) og ser aldri proveniens eller leverandørens id.
 */
import { createHash } from "node:crypto";
import type { InternalProvenance } from "@/domain/provenance";
import type { AccessContext, ResultAccessDecision } from "@/domain/result-access";
import { evaluateResultAccess } from "@/domain/result-access";
import type { ProviderResultHandle } from "@/domain/result-handle";
import { createResultHandle } from "@/domain/result-handle";
import type { RuntimeRights } from "@/domain/rights-runtime";
import { PublicIdKeyMissingError, derivePublicId, profileDigest, publicIdKey } from "./public-ids";

export const sha256Hex = (s: string): string => createHash("sha256").update(s).digest("hex");

export const handleFor = (p: InternalProvenance): ProviderResultHandle => createResultHandle(p, sha256Hex);

/** Vurdering med server-bundne avtrykksfunksjoner. */
export function accessFor(handle: ProviderResultHandle, provenance: InternalProvenance, rights: RuntimeRights, now: Date, geographyCountry: string | null, listingAvailable?: boolean): ResultAccessDecision {
  const ctx: AccessContext = { rights, now, digestOf: profileDigest, hash: sha256Hex, geographyCountry, listingAvailable };
  return evaluateResultAccess(handle, provenance, ctx);
}

export type HandleMappingResult = "ok" | "opaque_mapping_missing" | "opaque_id_mismatch";

/**
 * Bekrefter at handlens opake resultat-id faktisk er Merovos id for (leverandør, leverandørens id). Leverandørens id gis kun inn her, på serveren, og
 * returneres aldri. Mangler id-nøkkelen for sandbox/live ⇒ `opaque_mapping_missing` (lukket), aldri et gjetningsfallback.
 */
export function verifyHandleMapping(handle: ProviderResultHandle, providerListingId: string, configuredKey?: string): HandleMappingResult {
  let key: string;
  try { key = publicIdKey(handle.environment, configuredKey); }
  catch (e) { if (e instanceof PublicIdKeyMissingError) return "opaque_mapping_missing"; throw e; }
  return derivePublicId(handle.providerId, providerListingId, key) === handle.resultId ? "ok" : "opaque_id_mismatch";
}

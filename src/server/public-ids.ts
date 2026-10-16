/**
 * Opak Merovo-id for annonser i URL-er (DATA-002C) og avtrykk av rettighetsprofiler. Server-modul.
 *
 * Offentlig id = «m1_» + base64url av de første 18 byte av HMAC-SHA256(nøkkel, «m1|lengde:leverandør|leverandørens id» (lengdeprefiks hindrer kollisjon via sammensetning)). Enveis: verken leverandør
 * eller leverandørens id er kodet inn, og to leverandører med samme lokale id får ulike id-er. Nøkkelen er `SCOUT_PUBLIC_ID_KEY`
 * (server-only, valgfri). Uten nøkkel brukes en innebygd, IKKE-hemmelig pepper — kun for syntetiske kilder; for sandbox/live uten nøkkel
 * feiler id-generering LUKKET.
 */
import { createHash, createHmac } from "node:crypto";
import { canonicalPermissions } from "@/domain/provenance";
import type { ProviderEnvironment, ProviderRightsProfile } from "@/domain/provider-rights";

const SYNTHETIC_PEPPER = "merovo-public-id-pepper-v1/ikke-hemmelig/kun-syntetiske-kilder";

export class PublicIdKeyMissingError extends Error {
  constructor() { super("SCOUT_PUBLIC_ID_KEY mangler: opake id-er kan ikke lages for sandbox- og produksjonskilder"); this.name = "PublicIdKeyMissingError"; }
}

/** Nøkkelen å bruke for et miljø. `configured` er verdien av SCOUT_PUBLIC_ID_KEY (injiserbar i tester). */
export function publicIdKey(environment: ProviderEnvironment, configured: string | undefined = process.env.SCOUT_PUBLIC_ID_KEY): string {
  if (configured && configured.length >= 16) return configured;
  if (environment === "synthetic") return SYNTHETIC_PEPPER;
  throw new PublicIdKeyMissingError();
}

export function derivePublicId(providerId: string, providerListingId: string, key: string): string {
  const mac = createHmac("sha256", key).update(`m1|${providerId.length}:${providerId}|${providerListingId}`).digest();
  return `m1_${mac.subarray(0, 18).toString("base64url")}`;
}

export function publicIdFor(providerId: string, providerListingId: string, environment: ProviderEnvironment, configured?: string): string {
  return derivePublicId(providerId, providerListingId, publicIdKey(environment, configured));
}

/** SHA-256 (hex) av profilens semantiske rettigheter. */
export const profileDigest = (p: ProviderRightsProfile): string => createHash("sha256").update(canonicalPermissions(p)).digest("hex");

/**
 * Proveniens for leverandørannonser (DATA-002C). Rent domene: ingen I/O, ingen UI, ingen provider.
 *
 * `InternalProvenance` er SERVERINTERN: den bærer blant annet leverandørens egen annonse-id og aldri går til UI. Det som kan vises
 * (kilde/attribusjon) bestemmes utelukkende av `applyDisplayPolicy` (DATA-002A); denne modulen skaper ingen ny vei forbi
 * `DisplayableListing`. Proveniens svarer på: hvor kom annonsen fra, når ble den hentet, under hvilken rettighetsprofil og -versjon,
 * når utløper kildedataene, og hvilken kilde-URL/attribusjon som følger med (hvis tillatt).
 *
 * `evaluateProvenance` feiler LUKKET: ukjent, endret, utløpt eller trukket rettighetsprofil og utløpte kildedata gir aldri «ukjent»
 * eller en stille erstatning — de gir et eget avslag. Leverandørens annonse-id er ikke globalt unik: identiteten er (leverandør, id).
 */
import type { ProviderEnvironment, ProviderRightsProfile } from "./provider-rights";
import { resolveRights, retentionExpiresAt, revokedVersionAtOrAfter } from "./provider-rights";
import type { NormalizedListing } from "./types";

/** Hvor lenge ikke-lagret (transient) kildedata regnes ferske. Gjelder profiler uten persistent lagring (retensjon 0). */
export const TRANSIENT_FRESH_MS = 5 * 60 * 1000;

export interface InternalProvenance {
  /** Opak Merovo-id som brukes i URL-er; koder verken leverandør eller leverandørens id. */
  publicId: string;
  providerId: string;
  environment: ProviderEnvironment;
  /** Leverandørens egen id (unik bare innen leverandøren). Aldri til UI. */
  providerListingId: string;
  rightsProfile: { id: string; version: number; /** SHA-256 av profilens semantiske rettigheter ved hentingen. */ digest: string };
  retrievedAt: string;
  /** Når kildedata (som lagret kopi) utløper: min(retrievedAt + retensjon, profilens slutt); null = ingen lagring (kun transient visning). */
  sourceExpiresAt: string | null;
  /** Normaliserings-/mappingversjon (kilde@versjon). */
  schemaVersion: string;
  /** Kilde-URL/dypelenke — kun satt når profilen tillater visning av kilde-URL. */
  sourceUrlRef: string | null;
  attribution: { required: boolean; text: string | null };
  /** Valgfri forespørsels-/batch-id for revisjonsspor. */
  correlationId: string | null;
}

export type ProvenanceStatus =
  | "valid"
  | "source_expired"
  | "rights_expired"
  | "rights_revoked"
  | "rights_unknown"
  | "rights_changed"
  | "unavailable";

/** Kanonisk tekst av profilens semantiske rettigheter (alt som kan endre hva som er tillatt). Avtrykket brukes til å oppdage endring på plass. */
export function canonicalPermissions(p: ProviderRightsProfile): string {
  const sorted = (o: object) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : 1)));
  return JSON.stringify({
    providerId: p.providerId, environment: p.environment, version: p.version, validFrom: p.validFrom, sourceRef: p.sourceRef,
    display: sorted(p.display), matching: sorted(p.matching),
    storage: { retentionSeconds: p.storage.retentionSeconds, cacheSeconds: p.storage.cacheSeconds, historyRetentionSeconds: p.storage.historyRetentionSeconds, storable: sorted(p.storage.storable) },
    usage: sorted(p.usage), geography: { unrestricted: p.geography.unrestricted, countries: [...p.geography.countries].sort() },
    attribution: p.attribution, deepLinkRequired: p.deepLinkRequired, onRevocation: p.onRevocation, providerName: p.providerName,
    derivedEconomics: { allow: sorted(p.derivedEconomics.allow), display: p.derivedEconomics.display },
  });
}

export interface BuildInput {
  listing: NormalizedListing;
  publicId: string;
  /** Profilen som gjelder ved hentingen (må være i kraft). */
  profile: ProviderRightsProfile;
  /** SHA-256 (hex) av `canonicalPermissions(profile)`; beregnes av kalleren. */
  profileDigest: string;
  retrievedAt: Date;
  schemaVersion: string;
  correlationId?: string | null;
}

export function buildProvenance(i: BuildInput): InternalProvenance {
  const { profile: p, listing } = i;
  return {
    publicId: i.publicId,
    providerId: p.providerId,
    environment: p.environment,
    providerListingId: listing.sourceListingId,
    rightsProfile: { id: `${p.providerId}@${p.version}`, version: p.version, digest: i.profileDigest },
    retrievedAt: i.retrievedAt.toISOString(),
    sourceExpiresAt: retentionExpiresAt(p, i.retrievedAt)?.toISOString() ?? null,
    schemaVersion: i.schemaVersion,
    sourceUrlRef: p.display.source_url ? listing.originalUrl : null,
    attribution: { required: p.attribution.required, text: p.attribution.text },
    correlationId: i.correlationId ?? null,
  };
}

export interface EvaluateContext {
  profiles: readonly ProviderRightsProfile[];
  now: Date;
  /** Samme avtrykksfunksjon som ved bygging (SHA-256 av `canonicalPermissions`). */
  digestOf: (p: ProviderRightsProfile) => string;
  /** Satt til false når annonsen ikke lenger finnes hos kilden (fremtidige lagrede resultater). */
  listingAvailable?: boolean;
}

/** Rekkefølge: rettigheter (ukjent/endret/trukket/utløpt) → kildedata utløpt → utilgjengelig → gyldig. Alt annet enn `valid` skal behandles som avslag. */
export function evaluateProvenance(prov: InternalProvenance, ctx: EvaluateContext): ProvenanceStatus {
  const profile = ctx.profiles.find((p) => p.providerId === prov.providerId && p.version === prov.rightsProfile.version);
  if (!profile) return "rights_unknown";
  if (revokedVersionAtOrAfter(prov.providerId, prov.rightsProfile.version, ctx.profiles) !== null) return "rights_revoked"; // en trukket versjon (≥ den resultatet ble hentet under) nekter også eldre resultater (DATA-002D-2)
  if (ctx.digestOf(profile) !== prov.rightsProfile.digest) return "rights_changed";
  const r = resolveRights(profile.providerId, [profile], ctx.now);
  if (!r.inForce) {
    if (r.reason === "revoked") return "rights_revoked";
    if (r.reason === "expired") return "rights_expired";
    return "rights_unknown";
  }
  const t = ctx.now.getTime();
  const retrieved = Date.parse(prov.retrievedAt);
  if (!Number.isFinite(t) || !Number.isFinite(retrieved) || retrieved > t) return "source_expired"; // ugyldig/fremtidig hentetid er ikke troverdig
  if (prov.sourceExpiresAt !== null) { if (!(t < Date.parse(prov.sourceExpiresAt))) return "source_expired"; }
  else if (t - retrieved > TRANSIENT_FRESH_MS) return "source_expired";
  if (ctx.listingAvailable === false) return "unavailable";
  return "valid";
}

/**
 * Samlet rettighetsvurdering for ett leverandørresultat (DATA-002D). Rent domene.
 *
 * Svarer på ett sted: kan resultatet vises, hvilke felt (pris, bilder, selger), kan det lenkes til kilden, kan/hvor lenge kan det lagres,
 * må det oppdateres før visning, og er det gyldig for geografien. Bygger på eksisterende `resolveRights` (default-deny), `evaluateProvenance`
 * og profilens egne felt — det innfører ingen ny regeltolkning. Alt er FEIL LUKKET: utfallet har alle evner `false` og en årsak med mindre
 * hver kontroll uttrykkelig er bestått. Ukjent er aldri tillatt.
 *
 * Ikke representert i modellen (og derfor ikke vurdert, ikke antatt tillatt): publikum/«kun profesjonelle brukere». Se reviews/DATA-002D.md.
 */
import type { InternalProvenance } from "./provenance";
import { TRANSIENT_FRESH_MS, evaluateProvenance } from "./provenance";
import type { FieldRights, ProviderRightsProfile } from "./provider-rights";
import { geographyAllows, noRights, retentionExpiresAt } from "./provider-rights";
import type { HashFn, ProviderResultHandle } from "./result-handle";
import { verifyHandle } from "./result-handle";
import type { RuntimeRights } from "./rights-runtime";
import { resolveRuntimeRights } from "./rights-runtime";

export type AccessDenialReason =
  | "provider_mismatch" | "result_id_mismatch" | "rights_mismatch" | "provenance_mismatch"          // handle ↔ proveniens
  | "unknown_provider" | "not_verified" | "revoked" | "not_started" | "expired" | "invalid_profile" // rettighetsprofilen
  | "rights_changed"                                                                                // profilen er endret/erstattet siden hentingen
  | "retention_exceeded" | "transient_data_stale" | "unavailable"                                    // kildedata
  | "geography_not_allowed";

export interface ResultAccessDecision {
  /** Overordnet: kan resultatet brukes/vises i det hele tatt? `false` ⇒ ALLE evner under er `false`. */
  readonly canDisplay: boolean;
  readonly reason: AccessDenialReason | null;
  /** Visningsrett per felt (kun sann når `canDisplay`). */
  readonly fields: FieldRights;
  readonly canShowPrice: boolean;
  readonly canShowImages: boolean;
  readonly canShowSellerInfo: boolean;
  /** Kilde-URL kan vises/lenkes (profilens visningsrett til `source_url` og en kilde-URL finnes i proveniensen). */
  readonly canLinkToSource: boolean;
  readonly deepLinkRequired: boolean;
  readonly attribution: { readonly required: boolean; readonly text: string | null };
  /** Persistent lagring tillatt (retensjon > 0 og profilen i kraft). */
  readonly mayRetain: boolean;
  readonly retentionSeconds: number;
  /** Når en lagret kopi senest må slettes/skjules (ISO), ellers null. */
  readonly retainUntil: string | null;
  readonly storable: Readonly<{ price: boolean; specs: boolean; text: boolean; images: boolean; sellerData: boolean }>;
  /** Må kildedata hentes på nytt før de vises? (Se tolkning i reviews/DATA-002D.md §3.) */
  readonly mustRefreshBeforeDisplay: boolean;
  /** Tidspunkt (ISO) etter hvilket data ikke lenger kan vises uten ny henting, ellers null. */
  readonly refreshAfter: string | null;
  /** Geografi er vurdert og tillatt for den oppgitte konteksten. */
  readonly geographyAllowed: boolean;
}

const NO_STORABLE = Object.freeze({ price: false, specs: false, text: false, images: false, sellerData: false });

/** Avslag: alle evner false. */
export function deniedAccess(reason: AccessDenialReason): ResultAccessDecision {
  return Object.freeze({
    canDisplay: false, reason, fields: Object.freeze(noRights()), canShowPrice: false, canShowImages: false, canShowSellerInfo: false,
    canLinkToSource: false, deepLinkRequired: false, attribution: Object.freeze({ required: false, text: null }), mayRetain: false, retentionSeconds: 0, retainUntil: null,
    storable: NO_STORABLE, mustRefreshBeforeDisplay: false, refreshAfter: null, geographyAllowed: false,
  });
}

export interface AccessContext {
  rights: RuntimeRights;
  now: Date;
  /** Same avtrykksfunksjon som ved bygging av proveniensen (SHA-256 av `canonicalPermissions`). */
  digestOf: (p: ProviderRightsProfile) => string;
  /** Injisert SHA-256 for proveniensreferansen. */
  hash: HashFn;
  /**
   * Landet vurderingen gjelder for. Modellen spesifiserer ikke om profilens landliste gjelder forhandlerens marked, annonsens opprinnelse eller brukeren;
   * kalleren oppgir det landet som skal sjekkes. `null` (ukjent) nektes når leverandøren har geografibegrensning.
   */
  geographyCountry: string | null;
  /** Satt til false når annonsen ikke lenger finnes hos kilden. */
  listingAvailable?: boolean;
}

/** Profilens `cacheSeconds` = 0 betyr at kildedata ikke kan serveres fra cache: de må oppdateres når de er eldre enn det transiente vinduet. */
function refreshPolicy(profile: ProviderRightsProfile, retrievedAt: Date, now: Date): { must: boolean; after: Date } {
  const windowMs = profile.storage.cacheSeconds > 0 ? profile.storage.cacheSeconds * 1000 : TRANSIENT_FRESH_MS;
  const after = new Date(retrievedAt.getTime() + windowMs);
  return { must: !(now.getTime() < after.getTime()), after };
}

/** Samlet vurdering. Rekkefølge: handle↔proveniens → profil i kraft → profilen er den handlen ble hentet under → kildedata → geografi → evner. */
export function evaluateResultAccess(handle: ProviderResultHandle, provenance: InternalProvenance, ctx: AccessContext): ResultAccessDecision {
  const mismatch = verifyHandle(handle, provenance, ctx.hash);
  if (mismatch !== null) return deniedAccess(mismatch);

  const rights = resolveRuntimeRights(ctx.rights, handle.providerId, ctx.now);
  if (!rights.inForce) return deniedAccess(rights.reason);
  const profile = rights.profile;
  // Resultatet må være hentet under den profilversjonen/det avtrykket som gjelder nå; ellers er det ikke vurdert mot dagens rettigheter.
  if (profile.version !== handle.rights.version || ctx.digestOf(profile) !== handle.rights.digest || profile.environment !== handle.environment) return deniedAccess("rights_changed");

  const status = evaluateProvenance(provenance, { profiles: ctx.rights.profiles, now: ctx.now, digestOf: ctx.digestOf, listingAvailable: ctx.listingAvailable });
  if (status !== "valid") {
    if (status === "source_expired") return deniedAccess(profile.storage.retentionSeconds > 0 ? "retention_exceeded" : "transient_data_stale");
    return deniedAccess(status === "rights_unknown" ? "unknown_provider" : status === "rights_revoked" ? "revoked" : status === "rights_expired" ? "expired" : status === "rights_changed" ? "rights_changed" : "unavailable");
  }

  if (!geographyAllows(profile, ctx.geographyCountry)) return deniedAccess("geography_not_allowed");

  const d = profile.display;
  const retrievedAt = new Date(provenance.retrievedAt);
  const refresh = refreshPolicy(profile, retrievedAt, ctx.now);
  const retainUntil = retentionExpiresAt(profile, retrievedAt);
  return Object.freeze({
    canDisplay: true,
    reason: null,
    fields: Object.freeze({ ...d }),
    canShowPrice: d.price === true,
    canShowImages: d.images === true,
    canShowSellerInfo: d.seller_identity === true || d.seller_location === true,
    canLinkToSource: d.source_url === true && provenance.sourceUrlRef !== null,
    deepLinkRequired: profile.deepLinkRequired,
    attribution: Object.freeze({ required: profile.attribution.required, text: profile.attribution.text }),
    mayRetain: profile.storage.retentionSeconds > 0,
    retentionSeconds: profile.storage.retentionSeconds,
    retainUntil: retainUntil?.toISOString() ?? null,
    storable: Object.freeze({ ...profile.storage.storable }),
    mustRefreshBeforeDisplay: refresh.must,
    refreshAfter: refresh.after.toISOString(),
    geographyAllowed: true,
  });
}

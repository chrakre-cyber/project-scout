/**
 * Leverandørens rettighetsprofil — ÉN modell for lagring, visning og bruk (DATA-002B). Rent domene: ingen I/O, ingen provider, ingen UI.
 *
 * Speiler `private.provider_rights_profiles` (DEV-005B0 + migrasjon 20261016090000). Lagringsretten (`retentionSeconds`, `storable`) er
 * den eksisterende DEC-028-modellen; denne modulen legger til visningsrett per felt, *bruk til matching* som egen rett, cache/historikk,
 * gjenbruk, geografi, attribusjon, dypelenke og tilbakekallingsoppførsel. Alt er default-deny: ukjent leverandør, ikke verifisert,
 * trukket, ikke begynt, utløpt eller ugyldig profil gir INGEN rettigheter. Ingenting her antar at en leverandør har gitt noe.
 *
 * «Kan vises» og «kan brukes til matching» er separate rettigheter: en profil kan tillate det ene uten det andre. Ingen universell antakelse.
 */
import type { DisplayFieldKey, DisplayPolicy } from "./display-policy";
import { SYNTHETIC_ATTRIBUTION, denyAllPolicy } from "./display-policy";
import type { NormalizedListing } from "./types";

export const RIGHTS_FIELD_KEYS = [
  "title", "price", "mileage", "registration", "specs", "text", "seller_identity", "seller_location", "images", "provider_identity", "source_url", "listing_id", "listing_dates",
] as const;
export type RightsFieldKey = (typeof RIGHTS_FIELD_KEYS)[number];
export type FieldRights = Readonly<Record<RightsFieldKey, boolean>>;

/**
 * Kildefelt som kan inngå i avledet økonomiberegning (ECON-005b). Egen rett, adskilt fra visning og matching: price (innkjøpspris), registration
 * (første registrering) og specs (drivstoff/CO₂/vekt m.m.). Øvrige felt (tittel, km, tekst, selger, bilder …) brukes ikke i økonomiberegningen.
 */
export const ECONOMICS_FIELD_KEYS = ["price", "registration", "specs"] as const;
export type EconomicsFieldKey = (typeof ECONOMICS_FIELD_KEYS)[number];
export type EconomicsFieldRights = Readonly<Record<EconomicsFieldKey, boolean>>;
export const noEconomicsRights = (): EconomicsFieldRights => Object.fromEntries(ECONOMICS_FIELD_KEYS.map((k) => [k, false])) as Record<EconomicsFieldKey, boolean>;

export type ProviderEnvironment = "synthetic" | "sandbox" | "live"; // ingen live-leverandør er registrert eller koblet til
export type ProfileStatus = "draft" | "verified" | "revoked";

export interface ProviderRightsProfile {
  providerId: string;
  environment: ProviderEnvironment;
  /** Profilversjon (følger alle resultater fra leverandøren). */
  version: number;
  status: ProfileStatus;
  /** ISO 8601 UTC. `validUntil` er eksklusiv; null = ingen slutt. */
  validFrom: string;
  validUntil: string | null;
  /** Avtale/dokument profilen bygger på (CLAUDE.md pkt. 5). */
  sourceRef: string;
  verifiedBy: string | null;
  verifiedAt: string | null;
  providerName: string | null;
  /** Hvilke felt som kan VISES. */
  display: FieldRights;
  /** Hvilke felt som kan BRUKES INTERNT til matching/vurdering (uavhengig av visning). */
  matching: FieldRights;
  storage: {
    /** 0 = ingen persistent lagring. */
    retentionSeconds: number;
    cacheSeconds: number;
    /** Hvor lenge historiske versjoner kan beholdes; ≤ retentionSeconds. 0 = ingen historikk. */
    historyRetentionSeconds: number;
    /** Datatyper som kan lagres (DEV-005B0). */
    storable: { price: boolean; specs: boolean; text: boolean; images: boolean; sellerData: boolean };
  };
  usage: {
    /** Samme hentede annonse kan deles mellom flere kunder. */
    multiCustomerReuse: boolean;
    /** Samme annonse kan vurderes mot flere forhandleres søk. */
    reEvaluation: boolean;
    alerts: boolean;
  };
  geography: { unrestricted: boolean; countries: readonly string[] };
  attribution: { required: boolean; text: string | null };
  deepLinkRequired: boolean;
  onRevocation: "hide_and_purge" | "hide_only";
  /**
   * Avledet økonomi (ECON-005b): `allow` = hvilke kildefelt som kan brukes som input til beregning (landed cost); `display` = separat rett til å
   * VISE det avledede resultatet. Begge default nei. `display` krever at minst ett felt er tillatt. Lagres ikke i v1 (beregnes ved visning).
   */
  derivedEconomics: { allow: EconomicsFieldRights; display: boolean };
}

export const noRights = (): FieldRights => Object.fromEntries(RIGHTS_FIELD_KEYS.map((k) => [k, false])) as Record<RightsFieldKey, boolean>;
export const allRights = (): FieldRights => Object.fromEntries(RIGHTS_FIELD_KEYS.map((k) => [k, true])) as Record<RightsFieldKey, boolean>;

const MAX_SECONDS = 315_360_000;
const ISO2 = /^[A-Z]{2}$/;

/** Struktur- og konsistenssjekk som speiler databasens constraints. Tom liste = gyldig. */
export function validateProfile(p: ProviderRightsProfile): string[] {
  const issues: string[] = [];
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(p.providerId)) issues.push("providerId");
  if (!["synthetic", "sandbox", "live"].includes(p.environment)) issues.push("environment"); // ingen live-profil finnes i kode
  if (!Number.isSafeInteger(p.version) || p.version < 1) issues.push("version");
  if (!["draft", "verified", "revoked"].includes(p.status)) issues.push("status");
  const from = Date.parse(p.validFrom), to = p.validUntil === null ? null : Date.parse(p.validUntil);
  if (!Number.isFinite(from)) issues.push("validFrom");
  if (to !== null && (!Number.isFinite(to) || !(to > from))) issues.push("validUntil");
  if (p.sourceRef.length < 1 || p.sourceRef.length > 500) issues.push("sourceRef");
  const secs = [p.storage.retentionSeconds, p.storage.cacheSeconds, p.storage.historyRetentionSeconds];
  if (secs.some((s) => !Number.isSafeInteger(s) || s < 0 || s > MAX_SECONDS)) issues.push("seconds");
  if (p.storage.historyRetentionSeconds > p.storage.retentionSeconds) issues.push("history>retention");
  for (const [name, m] of [["display", p.display], ["matching", p.matching]] as const) {
    const keys = Object.keys(m).sort();
    if (keys.join() !== [...RIGHTS_FIELD_KEYS].sort().join() || Object.values(m).some((v) => typeof v !== "boolean")) issues.push(name);
  }
  const de = p.derivedEconomics as ProviderRightsProfile["derivedEconomics"] | undefined;
  if (!de || typeof de.display !== "boolean" || !de.allow || Object.keys(de.allow).sort().join() !== [...ECONOMICS_FIELD_KEYS].sort().join()
      || Object.values(de.allow).some((v) => typeof v !== "boolean") || (de.display && !Object.values(de.allow).some((v) => v === true))) issues.push("derivedEconomics");
  if (p.geography.unrestricted && p.geography.countries.length > 0) issues.push("geography");
  if (p.geography.countries.some((c) => !ISO2.test(c))) issues.push("countries");
  if (p.status === "verified") {
    if (!p.verifiedBy || !p.verifiedAt) issues.push("verification");
    if (p.attribution.required && !(p.attribution.text && p.attribution.text.length >= 1 && p.attribution.text.length <= 300)) issues.push("attribution");
    if (p.environment !== "synthetic" && !p.providerName) issues.push("providerName");
  }
  return issues;
}

export type RightsDenialReason = "unknown_provider" | "not_verified" | "revoked" | "not_started" | "expired" | "invalid_profile";

export type ResolvedRights =
  | { inForce: true; profile: ProviderRightsProfile }
  | { inForce: false; reason: RightsDenialReason; providerId: string; /** 0 når ingen profil finnes. */ profileVersion: number };

function stateOf(p: ProviderRightsProfile, now: Date): "in_force" | Exclude<RightsDenialReason, "unknown_provider"> {
  if (validateProfile(p).length > 0) return "invalid_profile";
  if (p.status === "revoked") return "revoked";
  if (p.status !== "verified") return "not_verified";
  const t = now.getTime();
  if (!Number.isFinite(t) || t < Date.parse(p.validFrom)) return "not_started";
  if (p.validUntil !== null && !(t < Date.parse(p.validUntil))) return "expired";
  return "in_force";
}

/** Profilen som gjelder for leverandøren nå (høyeste versjon i kraft), ellers avslag med årsak. Default-deny. */
export function resolveRights(providerId: string, profiles: readonly ProviderRightsProfile[], now: Date): ResolvedRights {
  const mine = profiles.filter((p) => p.providerId === providerId).sort((a, b) => b.version - a.version);
  if (mine.length === 0) return { inForce: false, reason: "unknown_provider", providerId, profileVersion: 0 };
  const active = mine.find((p) => stateOf(p, now) === "in_force");
  if (active) return { inForce: true, profile: active };
  const top = mine[0]!;
  return { inForce: false, reason: stateOf(top, now) as RightsDenialReason, providerId, profileVersion: top.version };
}

export const canDisplay = (r: ResolvedRights, key: RightsFieldKey): boolean => r.inForce && r.profile.display[key] === true;
export const canMatch = (r: ResolvedRights, key: RightsFieldKey): boolean => r.inForce && r.profile.matching[key] === true;
/** Kan de oppgitte kildefeltene brukes som input til avledet økonomiberegning? Tom liste, ukjent felt, ett felt uten rett eller profil ikke i kraft ⇒ nei. */
export const canDeriveEconomics = (r: ResolvedRights, fields: readonly string[]): boolean =>
  r.inForce && fields.length > 0 && fields.every((f) => (ECONOMICS_FIELD_KEYS as readonly string[]).includes(f) && r.profile.derivedEconomics.allow[f as EconomicsFieldKey] === true);

/**
 * Kan det avledede resultatet VISES? Krever (1) beregningsrett for alle brukte felt, (2) egen visningsrett for avledet økonomi og (3) gjeldende
 * visningsrett (`display`) for hvert rå kildefelt visningen avslører (`reveals`, f.eks. `price` når annonseprisen kan leses ut av resultatet).
 */
export const canDisplayEconomics = (r: ResolvedRights, fields: readonly string[], reveals: readonly string[] = []): boolean =>
  canDeriveEconomics(r, fields) && r.inForce && r.profile.derivedEconomics.display === true
  && reveals.every((k) => (RIGHTS_FIELD_KEYS as readonly string[]).includes(k) && r.profile.display[k as RightsFieldKey] === true);

export type EconomicsDenialReason = RightsDenialReason | "no_fields" | "field_not_granted" | "display_not_granted" | "reveal_not_granted";
/** Samlet beslutning med årsak (første avslag). `reason: null` ⇒ både beregning og visning er tillatt. */
export function economicsDecision(r: ResolvedRights, fields: readonly string[], reveals: readonly string[] = []): { derive: boolean; display: boolean; reason: EconomicsDenialReason | null } {
  if (!r.inForce) return { derive: false, display: false, reason: r.reason };
  if (fields.length === 0) return { derive: false, display: false, reason: "no_fields" };
  if (!canDeriveEconomics(r, fields)) return { derive: false, display: false, reason: "field_not_granted" };
  if (!r.profile.derivedEconomics.display) return { derive: true, display: false, reason: "display_not_granted" };
  if (!canDisplayEconomics(r, fields, reveals)) return { derive: true, display: false, reason: "reveal_not_granted" };
  return { derive: true, display: true, reason: null };
}

export const matchingRights = (r: ResolvedRights): FieldRights => (r.inForce ? r.profile.matching : noRights());

/** Profil → visningspolicy (DATA-002A-grensen). Ikke i kraft ⇒ deny-all med profilversjonen (0 om ingen profil). */
export function toDisplayPolicy(r: ResolvedRights): DisplayPolicy {
  if (!r.inForce) return { ...denyAllPolicy(r.providerId), profileVersion: r.profileVersion };
  const p = r.profile;
  const d = p.display;
  const allow: Record<DisplayFieldKey, boolean> = {
    title: d.title, price: d.price, mileage: d.mileage, registration: d.registration, specs: d.specs, text: d.text,
    sellerType: d.seller_identity, sellerLocation: d.seller_location, listingDates: d.listing_dates,
    providerName: d.provider_identity, sourceUrl: d.source_url, providerListingId: d.listing_id,
  };
  return Object.freeze({
    profileId: p.providerId,
    profileVersion: p.version,
    environment: p.environment === "live" ? "production" : p.environment, // ingen live-profil er registrert
    effectiveFrom: p.validFrom,
    effectiveTo: p.validUntil,
    attribution: p.attribution.text ?? "",
    providerName: p.providerName ?? "",
    allow: Object.freeze(allow),
  }) as DisplayPolicy;
}

/**
 * Fjerner fra en annonse det som IKKE kan brukes til matching (uten å vise noe): feltet blir ukjent (null) i vurderingen, aldri oppdiktet.
 * Tittel (merke/modell) er påkrevd for å kunne vurdere annonsen i det hele tatt; nektes den, returneres `listing: null` (uvurderbar).
 * `listing_id`, `provider_identity`, `source_url` og `images` styrer ikke vurderingen (identitet/proveniens/bilder brukes ikke til matching).
 */
export function restrictForMatching(listing: NormalizedListing, matching: FieldRights): { listing: NormalizedListing | null; unusable: RightsFieldKey[] } {
  const unusable = RIGHTS_FIELD_KEYS.filter((k) => !matching[k] && !["listing_id", "provider_identity", "source_url", "images"].includes(k));
  if (!matching.title) return { listing: null, unusable };
  const specs = { ...listing.specs };
  if (!matching.mileage) specs.mileage = null;
  if (!matching.registration) specs.firstRegistration = null;
  if (!matching.specs) { specs.fuel = null; specs.transmission = null; specs.bodyType = null; specs.powerKw = null; specs.co2 = null; specs.curbWeightKg = null; specs.color = null; }
  return {
    listing: {
      ...listing,
      specs,
      price: matching.price ? listing.price : null,
      text: matching.text ? listing.text : null,
      seller: matching.seller_identity || matching.seller_location
        ? { type: matching.seller_identity ? listing.seller?.type ?? "unknown" : "unknown", countryCode: matching.seller_location ? listing.seller?.countryCode ?? null : null, city: matching.seller_location ? listing.seller?.city ?? null : null }
        : null,
      sourceModifiedAt: matching.listing_dates ? listing.sourceModifiedAt : null,
    },
    unusable,
  };
}

/** Når et lagret resultat utløper: hentetid + retensjon, kappet ved profilens slutt. null = ingen persistent lagring tillatt. */
export function retentionExpiresAt(profile: ProviderRightsProfile, retrievedAt: Date): Date | null {
  if (profile.storage.retentionSeconds <= 0) return null;
  const end = retrievedAt.getTime() + profile.storage.retentionSeconds * 1000;
  const cap = profile.validUntil === null ? Infinity : Date.parse(profile.validUntil);
  return new Date(Math.min(end, cap));
}

/** Er et lagret resultat fortsatt tillatt synlig? Krever at profilen er i kraft (DEC-028: trukket/utløpt skjuler umiddelbart) og at retensjonen ikke er nådd. */
export function isWithinRetention(profile: ProviderRightsProfile, retrievedAt: Date, now: Date): boolean {
  if (stateOf(profile, now) !== "in_force") return false;
  const exp = retentionExpiresAt(profile, retrievedAt);
  return exp !== null && now.getTime() < exp.getTime();
}

/** Geografi: ukjent land tillates aldri når leverandøren har begrensninger. */
export function geographyAllows(profile: ProviderRightsProfile, countryCode: string | null): boolean {
  if (profile.geography.unrestricted) return true;
  return countryCode !== null && profile.geography.countries.includes(countryCode);
}

// ---------------------------------------------------------------- profiler som finnes i kode

/**
 * `synthetic-demo` v1 — speiler den backfylte DB-raden (migrasjon 20261016090000). Oppdiktede annonser; ingen tredjepartsrettigheter.
 * Ingen leverandørprofil for en ekte kilde finnes eller er registrert.
 */
export const SYNTHETIC_RIGHTS_PROFILE: ProviderRightsProfile = Object.freeze({
  providerId: "synthetic-demo",
  environment: "synthetic",
  version: 1,
  status: "verified",
  validFrom: "2026-10-01T00:00:00Z",
  validUntil: null,
  sourceRef: "Intern syntetisk demokilde (DEV-003/DEV-005A): ingen ekte annonser og ingen eksterne vilkår.",
  verifiedBy: "DEV-005B0 (intern profil for syntetiske data)",
  verifiedAt: "2026-10-08T00:00:00Z",
  providerName: "Syntetisk demokilde",
  display: Object.freeze({ ...allRights(), images: false }),
  matching: Object.freeze({ ...allRights(), images: false }),
  storage: Object.freeze({ retentionSeconds: 604_800, cacheSeconds: 0, historyRetentionSeconds: 0, storable: Object.freeze({ price: true, specs: true, text: false, images: false, sellerData: true }) }),
  usage: Object.freeze({ multiCustomerReuse: true, reEvaluation: true, alerts: false }),
  geography: Object.freeze({ unrestricted: true, countries: Object.freeze([]) as readonly string[] }),
  attribution: Object.freeze({ required: true, text: SYNTHETIC_ATTRIBUTION }),
  deepLinkRequired: false,
  onRevocation: "hide_and_purge",
  // ECON-005b: eksplisitt tillatelse bare for den syntetiske demoen (speiler DB-raden). Ingen sandbox-/live-profil får dette automatisk.
  derivedEconomics: Object.freeze({ allow: Object.freeze({ price: true, registration: true, specs: true }), display: true }),
}) as ProviderRightsProfile;

/** Profilene som er registrert i kjøretiden i dag: bare den syntetiske. Ekte profiler lastes først når en leverandør er godkjent og verifisert. */
export const REGISTERED_PROFILES: readonly ProviderRightsProfile[] = Object.freeze([SYNTHETIC_RIGHTS_PROFILE]);

export const rightsForSource = (source: string, now: Date, profiles: readonly ProviderRightsProfile[] = REGISTERED_PROFILES): ResolvedRights =>
  resolveRights(source, profiles, now);

/** Visningspolicy for en kilde nå. Ukjent/utløpt/trukket kilde ⇒ deny-all. */
export const policyForSource = (source: string, now: Date = new Date(), profiles: readonly ProviderRightsProfile[] = REGISTERED_PROFILES): DisplayPolicy =>
  toDisplayPolicy(rightsForSource(source, now, profiles));

/** Den syntetiske visningspolicyen (avledet av profilen, ikke et eget regelverk). */
export const SYNTHETIC_DISPLAY_POLICY: DisplayPolicy = toDisplayPolicy({ inForce: true, profile: SYNTHETIC_RIGHTS_PROFILE });

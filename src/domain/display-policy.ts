/**
 * Håndheving av visningsrettigheter (DATA-002A). Rent domenelag: ingen I/O, ingen UI, ingen provider.
 *
 * `NormalizedListing` er en rå/normalisert leverandørannonse og skal ALDRI vises direkte. All visning går via
 * `DisplayableListing`, som bygges av `applyDisplayPolicy` ut fra en `DisplayPolicy` (rettighetsprofil for visning).
 * Hvert felt er en `Field` med fire adskilte tilstander:
 *   value       kjent og tillatt vist
 *   unknown     tillatt, men leverandøren oppgir det ikke (vises som «ikke oppgitt»)
 *   withheld    ikke tillatt vist (profilen). Gjelder også når verdien ikke finnes: fraværet avsløres ikke.
 *   unavailable tillatt, men kunne ikke hentes (f.eks. detaljkall feilet); meldes av kalleren
 * Default-deny: profil utenfor virkningsperioden og ukjent kilde gir `withheld` på alt. Et forbudt felt leses aldri fra den
 * rå annonsen (lat evaluering), verdier klones (ingen aliasing mot rå objekter), og ingenting erstattes med oppdiktede data.
 * Kun syntetisk profil finnes i dag; ekte leverandørprofiler kommer i DATA-002B.
 */
import type {
  BodyType, FirstRegistration, Fuel, ListingPrice, Mileage, NormalizedListing, SellerType, Transmission,
} from "./types";

export const DISPLAY_FIELD_KEYS = [
  "title", "price", "mileage", "registration", "specs", "text", "sellerType", "sellerLocation", "listingDates", "providerName", "sourceUrl",
] as const;
export type DisplayFieldKey = (typeof DISPLAY_FIELD_KEYS)[number];

export type Field<T> =
  | { state: "value"; value: T }
  | { state: "unknown" }
  | { state: "withheld" }
  | { state: "unavailable" };

export type DisplayEnvironment = "synthetic" | "sandbox" | "production" | "unverified";

export interface DisplayPolicy {
  profileId: string;
  profileVersion: number;
  environment: DisplayEnvironment;
  /** ISO 8601 UTC; null = åpen. Utenfor perioden er alt `withheld`. */
  effectiveFrom: string | null;
  effectiveTo: string | null;
  /** Påkrevd kildehenvisning som alltid vises sammen med resultatet. */
  attribution: string;
  /** Navn på kilden slik det kan vises når `providerName` er tillatt. */
  providerName: string;
  allow: Readonly<Record<DisplayFieldKey, boolean>>;
}

export interface DisplayableListing {
  /** Intern nøkkel for navigasjon. Ingen annonseverdi. */
  listingId: string;
  attribution: string;
  policy: { profileId: string; profileVersion: number; environment: DisplayEnvironment; inEffect: boolean };
  title: Field<{ make: string; model: string; variant: string | null }>;
  price: Field<ListingPrice>;
  mileage: Field<Mileage>;
  registration: Field<FirstRegistration>;
  /** Tekniske spesifikasjoner (alle styres av nøkkelen `specs`). */
  specs: {
    fuel: Field<Fuel>;
    transmission: Field<Transmission>;
    bodyType: Field<BodyType>;
    powerKw: Field<number>;
    color: Field<string>;
  };
  text: Field<string>;
  sellerType: Field<SellerType>;
  sellerLocation: Field<{ countryCode: string | null; city: string | null }>;
  listingDates: Field<{ sourceModifiedAt: string }>;
  providerName: Field<string>;
  sourceUrl: Field<string>;
}

export interface ApplyOptions {
  /** Felt som er tillatt, men som ikke kunne hentes nå (f.eks. detaljkall feilet). */
  unavailable?: readonly DisplayFieldKey[];
}

export const SYNTHETIC_ATTRIBUTION = "Syntetiske demodata – ikke ekte leverandørdata";
const ALL_ALLOWED = Object.fromEntries(DISPLAY_FIELD_KEYS.map((k) => [k, true])) as Record<DisplayFieldKey, boolean>;
const ALL_DENIED = Object.fromEntries(DISPLAY_FIELD_KEYS.map((k) => [k, false])) as Record<DisplayFieldKey, boolean>;

/** Syntetisk demokilde: oppdiktede annonser; alt kan vises. Ingen tredjepartsrettigheter berøres. */
export const SYNTHETIC_DISPLAY_POLICY: DisplayPolicy = Object.freeze({
  profileId: "synthetic-demo",
  profileVersion: 2,
  environment: "synthetic",
  effectiveFrom: null,
  effectiveTo: null,
  attribution: SYNTHETIC_ATTRIBUTION,
  providerName: "Syntetisk demokilde",
  allow: Object.freeze({ ...ALL_ALLOWED }),
});

/** Standard for kilder uten verifisert visningsprofil: ingenting kan vises (default-deny). */
export function denyAllPolicy(source: string): DisplayPolicy {
  return {
    profileId: `deny:${source}`,
    profileVersion: 0,
    environment: "unverified",
    effectiveFrom: null,
    effectiveTo: null,
    attribution: "Kilde uten verifisert visningsprofil",
    providerName: "",
    allow: { ...ALL_DENIED },
  };
}

/** Bygger en policy ut fra en base og et sett tillatte felt (alle andre nektes). Brukes av tester og senere profilinnlasting. */
export function policyAllowing(base: DisplayPolicy, allowed: readonly DisplayFieldKey[]): DisplayPolicy {
  return { ...base, allow: { ...ALL_DENIED, ...Object.fromEntries(allowed.map((k) => [k, true])) } as Record<DisplayFieldKey, boolean> };
}

/** Hvilken visningsprofil gjelder for en kilde. Ukjent kilde ⇒ default-deny. */
export function policyForSource(source: string): DisplayPolicy {
  return source === SYNTHETIC_DISPLAY_POLICY.profileId ? SYNTHETIC_DISPLAY_POLICY : denyAllPolicy(source);
}

export function policyInEffect(policy: DisplayPolicy, now: Date): boolean {
  const t = now.getTime();
  if (!Number.isFinite(t)) return false;
  if (policy.effectiveFrom !== null && !(t >= Date.parse(policy.effectiveFrom))) return false;
  if (policy.effectiveTo !== null && !(t < Date.parse(policy.effectiveTo))) return false;
  return true;
}

/** Dypkopi (annonseverdier er JSON-trygge: tekst, tall, enkle objekter). */
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/**
 * Projiserer en rå annonse til det som kan vises. Ren funksjon. Rå felt leses bare for felt som policyen tillater
 * (og bare når profilen gjelder), slik at forbudte verdier aldri berøres.
 */
export function applyDisplayPolicy(listing: NormalizedListing, policy: DisplayPolicy, now: Date, opts: ApplyOptions = {}): DisplayableListing {
  const inEffect = policyInEffect(policy, now);
  const unavailable = new Set(opts.unavailable ?? []);
  function field<T>(key: DisplayFieldKey, read: () => T | null): Field<T> {
    if (!inEffect || policy.allow[key] !== true) return { state: "withheld" };
    if (unavailable.has(key)) return { state: "unavailable" };
    const v = read();
    return v === null || v === undefined ? { state: "unknown" } : { state: "value", value: clone(v) };
  }
  const spec = <T>(read: () => T | null): Field<T> => field("specs", read);
  return {
    listingId: listing.sourceListingId,
    attribution: policy.attribution,
    policy: { profileId: policy.profileId, profileVersion: policy.profileVersion, environment: policy.environment, inEffect },
    title: field("title", () => ({ make: listing.specs.make, model: listing.specs.model, variant: listing.specs.variant })),
    price: field("price", () => listing.price),
    mileage: field("mileage", () => listing.specs.mileage),
    registration: field("registration", () => listing.specs.firstRegistration),
    specs: {
      fuel: spec(() => listing.specs.fuel),
      transmission: spec(() => listing.specs.transmission),
      bodyType: spec(() => listing.specs.bodyType),
      powerKw: spec(() => listing.specs.powerKw),
      color: spec(() => listing.specs.color),
    },
    text: field("text", () => listing.text),
    sellerType: field("sellerType", () => (listing.seller && listing.seller.type !== "unknown" ? listing.seller.type : null)),
    sellerLocation: field("sellerLocation", () => (listing.seller && (listing.seller.countryCode !== null || listing.seller.city !== null)
      ? { countryCode: listing.seller.countryCode, city: listing.seller.city } : null)),
    listingDates: field("listingDates", () => (listing.sourceModifiedAt !== null ? { sourceModifiedAt: listing.sourceModifiedAt } : null)),
    providerName: field("providerName", () => (policy.providerName === "" ? null : policy.providerName)),
    sourceUrl: field("sourceUrl", () => listing.originalUrl),
  };
}

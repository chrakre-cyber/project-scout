/**
 * Hardfilter mellom en agents kriterier og en normalisert annonse (OPPORTUNITY_SCORE «Før score»).
 *
 * - Kjent avvik fra et satt kriterium gir `excluded`.
 * - Ukjent verdi for et satt kriterium gir `needs_review` (aldri automatisk treff, aldri skjult).
 * - Ellers `match`. Kriterier som ikke er satt («alle») påvirker ikke utfallet.
 *
 * Rent og deterministisk: ingen I/O, ingen valutaomregning (DEC-018) og ingen avhengighet til UI, provider eller database.
 * Provideren kan forhåndsfiltrere (grovt, som en kilde-API), men dette er den autoritative vurderingen (DEC-027).
 */
import type { AgentFilters, NormalizedListing } from "./types";

export type MatchStatus = "match" | "needs_review" | "excluded";

export const CRITERIA = ["make", "model", "variant", "year", "mileage", "fuel", "transmission", "bodyType", "country", "price"] as const;
export type Criterion = (typeof CRITERIA)[number];

export interface MatchEvaluation {
  status: MatchStatus;
  /** Kriterier annonsen kjent bryter. Fylt bare ved `excluded`. */
  excludedBy: Criterion[];
  /** Kriterier som ikke kan avgjøres fordi annonsen mangler verdien (eller ikke kan sammenlignes). */
  unknown: Criterion[];
}

/** 1 mile = 1,609344 km (eksakt definisjon). Heltallsregning (mikro-km), ingen avrunding. */
const KM_PER_MILE_MICRO = 1_609_344;

/** Sammenligning uten hensyn til store/små bokstaver. Deterministisk (ingen locale-avhengighet). */
const fold = (s: string) => s.normalize("NFC").toLowerCase();

type Verdict = "ok" | "mismatch" | "unknown";

export function evaluateListing(f: AgentFilters, l: NormalizedListing): MatchEvaluation {
  const verdicts: Partial<Record<Criterion, Verdict>> = {};
  const s = l.specs;

  if (f.make !== null) verdicts.make = fold(s.make) === fold(f.make) ? "ok" : "mismatch";
  if (f.model !== null) verdicts.model = fold(s.model) === fold(f.model) ? "ok" : "mismatch";
  if (f.variant !== null) {
    verdicts.variant = s.variant === null ? "unknown" : fold(s.variant).includes(fold(f.variant)) ? "ok" : "mismatch";
  }

  if (f.yearMin !== null || f.yearMax !== null) {
    const year = s.firstRegistration?.year ?? null;
    if (year === null) verdicts.year = "unknown";
    else verdicts.year = (f.yearMin === null || year >= f.yearMin) && (f.yearMax === null || year <= f.yearMax) ? "ok" : "mismatch";
  }

  if (f.maxMileageKm !== null) {
    if (s.mileage === null) verdicts.mileage = "unknown";
    else {
      const micro = s.mileage.unit === "km" ? s.mileage.value * 1_000_000 : s.mileage.value * KM_PER_MILE_MICRO;
      verdicts.mileage = micro <= f.maxMileageKm * 1_000_000 ? "ok" : "mismatch";
    }
  }

  const oneOf = <T>(value: T | null, allowed: readonly T[]): Verdict => (value === null ? "unknown" : allowed.includes(value) ? "ok" : "mismatch");
  if (f.fuels.length) verdicts.fuel = oneOf(s.fuel, f.fuels);
  if (f.transmissions.length) verdicts.transmission = oneOf(s.transmission, f.transmissions);
  if (f.bodyTypes.length) verdicts.bodyType = oneOf(s.bodyType, f.bodyTypes);
  if (f.countryCodes.length) verdicts.country = oneOf(l.seller?.countryCode ?? null, f.countryCodes);

  if (f.maxPrice !== null) {
    // Bare samme valuta kan sammenlignes. Annen valuta, ustøttet valuta (amount null) eller ingen pris er ukjent.
    const amount = l.price?.amount ?? null;
    if (amount === null || amount.currency !== f.maxPrice.currency) verdicts.price = "unknown";
    else verdicts.price = amount.amountMinor <= f.maxPrice.amountMinor ? "ok" : "mismatch";
  }

  const excludedBy = CRITERIA.filter((c) => verdicts[c] === "mismatch");
  const unknown = CRITERIA.filter((c) => verdicts[c] === "unknown");
  if (excludedBy.length) return { status: "excluded", excludedBy, unknown };
  if (unknown.length) return { status: "needs_review", excludedBy: [], unknown };
  return { status: "match", excludedBy: [], unknown: [] };
}

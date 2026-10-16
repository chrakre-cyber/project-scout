/**
 * Normalisering: syntetisk råpost → NormalizedListing.
 *
 * Regler (CLAUDE.md pkt. 3–4, ARCHITECTURE «Marketplace-kontrakt»):
 * - Ukjent eller ugyldig verdi blir null/unknown og noteres, aldri 0 eller gjettet.
 * - Brutto/netto settes bare med eksplisitt belegg. Mva.-opplysninger utleder
 *   aldri prisgrunnlag eller fradragsrett.
 * - Ustøttet valuta: beløpet bevares som tekst, `amount` er null.
 * - Poster som ikke kan identifiseres eller har ugyldig struktur avvises
 *   (malformed_data) uten å påvirke andre poster.
 */
import { isCurrencyCodeFormat, toMoney, minorDigits, parseDecimalToMinor } from "@/domain/currency";
import type {
  BodyType, ClaimValue, FirstRegistration, Fuel, ListingPrice, NormalizedListing, SourceVatStatement, Transmission,
} from "@/domain/types";
import type { SyntheticRawListing } from "./raw";

export const SYNTHETIC_SOURCE = "synthetic-demo";

export type NormalizeResult =
  | { ok: true; listing: NormalizedListing }
  | { ok: false; sourceListingId: string | null; reason: string };

const FUEL: Record<string, Fuel> = {
  PETROL: "petrol", DIESEL: "diesel", ELECTRIC: "electric", HYBRID: "hybrid", PLUGIN_HYBRID: "plugin_hybrid", OTHER: "other",
};
const GEARBOX: Record<string, Transmission> = { MANUAL: "manual", AUTOMATIC: "automatic" };
const BODY: Record<string, BodyType> = {
  SEDAN: "sedan", ESTATE: "estate", SUV: "suv", HATCHBACK: "hatchback", COUPE: "coupe",
  CONVERTIBLE: "convertible", VAN: "van", OTHER: "other",
};

class Rejected extends Error {}

export function normalizeSyntheticListing(raw: SyntheticRawListing): NormalizeResult {
  const id = typeof raw?.id === "string" && raw.id.trim() !== "" ? raw.id.trim() : null;
  try {
    if (!id) throw new Rejected("mangler kilde-ID");
    return { ok: true, listing: build(id, raw) };
  } catch (e) {
    if (e instanceof Rejected) return { ok: false, sourceListingId: id, reason: e.message };
    throw e;
  }
}

function build(id: string, raw: SyntheticRawListing): NormalizedListing {
  const notes: string[] = [];
  const v = raw.vehicle ?? {};

  const make = text(v.make);
  const model = text(v.model);
  if (!make || !model) throw new Rejected("mangler merke eller modell");

  const firstSeenAt = isoTimestamp(raw.observed?.firstSeenAt);
  const lastSeenAt = isoTimestamp(raw.observed?.lastSeenAt);
  if (!firstSeenAt || !lastSeenAt) throw new Rejected("ugyldig observasjonstidspunkt");
  if (lastSeenAt < firstSeenAt) throw new Rejected("lastSeenAt er før firstSeenAt");

  let sourceModifiedAt: string | null = null;
  if (raw.modifiedAt != null) {
    sourceModifiedAt = isoTimestamp(raw.modifiedAt);
    if (!sourceModifiedAt) notes.push("modifiedAt ugyldig → null");
  }

  return {
    source: SYNTHETIC_SOURCE,
    sourceListingId: id,
    // Syntetiske poster har aldri originalannonse. Ingen oppdiktede lenker.
    originalUrl: null,
    sourceModifiedAt,
    firstSeenAt,
    lastSeenAt,
    price: price(raw.price, text(raw.description), notes),
    specs: {
      make,
      model,
      variant: text(v.variant),
      firstRegistration: firstRegistration(v.firstRegistration, notes),
      mileage: mileage(v.mileage, notes),
      fuel: code(v.fuel, FUEL, "fuel", notes),
      transmission: code(v.gearbox, GEARBOX, "gearbox", notes),
      bodyType: code(v.body, BODY, "body", notes),
      powerKw: positive(v.powerKw, "powerKw", notes),
      co2: co2(v.co2, notes),
      curbWeightKg: positive(v.weightKg, "weightKg", notes),
      color: text(v.color),
    },
    text: text(raw.description),
    seller: seller(raw.seller, notes),
    provenance: {
      kind: "synthetic",
      description: "Syntetisk demo-fixture (DEV-003). Ikke en ekte annonse og ikke data fra en markedsplass.",
      normalizationNotes: notes,
    },
  };
}

function price(raw: SyntheticRawListing["price"], listingText: string | null, notes: string[]): ListingPrice | null {
  if (raw == null) return null;
  const currency = typeof raw.currency === "string" ? raw.currency.trim().toUpperCase() : "";
  if (!isCurrencyCodeFormat(currency)) throw new Rejected(`ugyldig valutakode «${raw.currency}»`);
  const amount = typeof raw.amount === "string" ? raw.amount.trim() : "";
  if (/^0+(\.0+)?$/.test(amount)) {
    // 0 er ikke en pris (ofte «pris på forespørsel»). Ukjent, ikke 0.
    notes.push("pris 0 → ikke oppgitt");
    return null;
  }
  // Formatkontroll uavhengig av støtte: samme regel som for støttede valutaer, men uten desimalgrense.
  if (parseDecimalToMinor(amount, amount.split(".")[1]?.length ?? 0) === null) {
    throw new Rejected(`ugyldig prisbeløp «${raw.amount}»`);
  }

  const money = toMoney(amount, currency);
  if (money === null) {
    if (minorDigits(currency) === null) notes.push(`valuta ${currency} støttes ikke → beløp vises som oppgitt, ikke omregnet`);
    else throw new Rejected(`prisbeløp «${amount}» har flere desimaler enn ${currency} tillater`);
  }

  const evidence = text(raw.typeEvidence);
  let basis: ListingPrice["basis"] = "unknown";
  if (raw.type === "GROSS" || raw.type === "NET") {
    if (evidence) basis = raw.type === "GROSS" ? "gross" : "net";
    else notes.push(`prisgrunnlag ${raw.type} uten belegg → unknown`);
  }

  return {
    stated: { amount, currency },
    amount: money,
    basis,
    basisEvidence: basis === "unknown" ? null : evidence,
    vat: vat(raw.vat, listingText, notes),
  };
}

function vat(
  raw: NonNullable<SyntheticRawListing["price"]>["vat"], listingText: string | null, notes: string[],
): SourceVatStatement {
  let evidence = (raw?.evidence ?? []).map((e) => text(e)).filter((e): e is string => e !== null);
  if (raw?.origin === "TEXT") {
    // Belegg fra annonseteksten må stå ordrett i teksten; ellers er det ikke belegg.
    const found = evidence.filter((e) => listingText?.includes(e));
    if (found.length < evidence.length) notes.push("mva.-belegg finnes ikke i annonseteksten → forkastet");
    evidence = found;
  }
  let statedRateBasisPoints: number | null = null;
  if (raw?.rate != null) {
    const bp = /^\d{1,2}(\.\d{1,2})?$/.test(raw.rate) ? parseDecimalToMinor(raw.rate, 2) : null;
    if (bp === null) notes.push(`mva.-sats «${raw.rate}» ugyldig → null`);
    else statedRateBasisPoints = bp;
  }
  const reclaimableClaim: ClaimValue = raw?.reclaimable === true ? "claimed" : raw?.reclaimable === false ? "denied" : "unknown";
  const hasStatement = statedRateBasisPoints !== null || reclaimableClaim !== "unknown";
  if (hasStatement && evidence.length === 0) {
    // Mva.-påstander uten belegg kan ikke vises som annonsens opplysning.
    notes.push("mva.-opplysning uten belegg → ukjent");
    return { statedRateBasisPoints: null, reclaimableClaim: "unknown", evidence: [], origin: "none" };
  }
  const origin = !hasStatement ? "none" : raw?.origin === "FIELD" ? "structured_field" : raw?.origin === "TEXT" ? "listing_text" : "none";
  return { statedRateBasisPoints, reclaimableClaim, evidence: hasStatement ? evidence : [], origin };
}

function firstRegistration(value: string | null | undefined, notes: string[]): FirstRegistration | null {
  if (value == null) return null;
  const m = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(value.trim());
  if (m) {
    const year = Number(m[1]);
    const month = m[2] ? Number(m[2]) : null;
    const day = m[3] ? Number(m[3]) : null;
    const validMonth = month === null || (month >= 1 && month <= 12);
    const validDay = day === null || (month !== null && day >= 1 && day <= daysInMonth(year, month));
    if (year >= 1900 && year <= 2100 && validMonth && validDay) {
      if (day !== null && month !== null) return { precision: "date", year, month, day };
      if (month !== null) return { precision: "month", year, month };
      return { precision: "year", year };
    }
  }
  notes.push(`førsteregistrering «${value}» ugyldig → null`);
  return null;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function mileage(raw: SyntheticRawListing["vehicle"]["mileage"], notes: string[]) {
  if (raw == null) return null;
  if (!Number.isInteger(raw.value) || raw.value < 0 || (raw.unit !== "KM" && raw.unit !== "MI")) {
    notes.push("kilometerstand ugyldig → null");
    return null;
  }
  // Behold kildens enhet. Ingen stille omregning.
  return { value: raw.value, unit: raw.unit === "KM" ? ("km" as const) : ("mi" as const) };
}

function co2(raw: SyntheticRawListing["vehicle"]["co2"], notes: string[]) {
  if (raw == null) return null;
  if (!Number.isFinite(raw.gramsPerKm) || raw.gramsPerKm < 0) {
    notes.push("CO2 ugyldig → null");
    return null;
  }
  const method = raw.method === "WLTP" || raw.method === "NEDC" ? raw.method : "unknown";
  if (raw.method != null && method === "unknown") notes.push(`CO2-testmetode «${raw.method}» ukjent → unknown`);
  return { gramsPerKm: raw.gramsPerKm, testMethod: method } as const;
}

function seller(raw: SyntheticRawListing["seller"], notes: string[]) {
  if (raw == null) return null;
  let countryCode: string | null = null;
  if (raw.country != null) {
    if (/^[A-Z]{2}$/.test(raw.country)) countryCode = raw.country;
    else notes.push(`landkode «${raw.country}» ugyldig → null`);
  }
  const type = raw.type === "DEALER" ? "dealer" : raw.type === "PRIVATE" ? "private" : "unknown";
  return { type, countryCode, city: text(raw.city) } as const;
}

function code<T>(value: string | null | undefined, map: Record<string, T>, field: string, notes: string[]): T | null {
  if (value == null) return null;
  if (Object.hasOwn(map, value)) return map[value]!;
  notes.push(`${field} «${value}» ukjent kode → null`);
  return null;
}

/** 0 er ikke en gyldig verdi for effekt eller vekt; 0 eller negativt behandles som ukjent. */
function positive(value: number | null | undefined, field: string, notes: string[]): number | null {
  if (value == null) return null;
  if (Number.isFinite(value) && value > 0) return value;
  notes.push(`${field} ${value} ugyldig → null`);
  return null;
}

function text(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t === "" ? null : t;
}

function isoTimestamp(value: string | null | undefined): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?Z$/.test(value)) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

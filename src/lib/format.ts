/**
 * Visningsformatering (nb-NO, Europe/Oslo). Kun presentasjon — ingen
 * økonomiske beregninger. `null` vises som «ikke oppgitt».
 */
import { minorDigits, minorToDecimalString } from "@/domain/currency";
import type {
  BodyType, FirstRegistration, Fuel, ListingPrice, Mileage, Money, PriceBasis, SellerType, SourceVatStatement, Transmission,
} from "@/domain/types";

export const NOT_STATED = "ikke oppgitt";

export const UNSUPPORTED_CURRENCY_NOTE = "valuta støttes ikke — vist som oppgitt, ikke omregnet";

/**
 * Formaterer et beløp. Kaster aldri: ustøttet valuta vises som heltall i
 * minste enhet med valutakode i stedet for å gjette desimaler (R1).
 */
export function formatMoney(money: Money | null): string {
  if (!money) return NOT_STATED;
  const digits = minorDigits(money.currency);
  if (digits === null) return `${money.amountMinor} (minste enhet) ${money.currency}`;
  // Eksakt desimalstreng (ingen flyttallsdivisjon); Intl formaterer strengen uten avrundingsfeil.
  const major = minorToDecimalString(money.amountMinor, digits) as `${number}`;
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: money.currency,
    maximumFractionDigits: money.amountMinor % 10 ** digits === 0 ? 0 : digits,
    minimumFractionDigits: 0,
  }).format(major);
}

const dateTime = new Intl.DateTimeFormat("nb-NO", {
  timeZone: "Europe/Oslo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
});

export function formatDateTime(iso: string | null): string {
  if (!iso) return NOT_STATED;
  return dateTime.format(new Date(iso));
}

export function formatFirstRegistration(reg: FirstRegistration | null): string {
  if (!reg) return NOT_STATED;
  const mm = (n: number) => String(n).padStart(2, "0");
  switch (reg.precision) {
    case "date": return `${mm(reg.day)}.${mm(reg.month)}.${reg.year}`;
    case "month": return `${mm(reg.month)}.${reg.year} (kun måned oppgitt)`;
    case "year": return `${reg.year} (kun år oppgitt)`;
  }
}

/** Viser kildens enhet. Miles konverteres ikke stille til km. */
export function formatMileage(m: Mileage | null): string {
  if (!m) return NOT_STATED;
  const n = new Intl.NumberFormat("nb-NO").format(m.value);
  return m.unit === "km" ? `${n} km` : `${n} miles (kildens enhet)`;
}

export function formatNumber(n: number | null, unit: string): string {
  if (n === null) return NOT_STATED;
  return `${new Intl.NumberFormat("nb-NO").format(n)} ${unit}`;
}

const PRICE_BASIS_LABEL: Record<PriceBasis, string> = {
  gross: "oppgitt som brutto i annonsen — ikke kontrollert",
  net: "oppgitt som netto i annonsen — ikke kontrollert",
  unknown: "prisgrunnlag ukjent",
};

/**
 * Prisgrunnlag vises bare som kjent når det finnes eksplisitt belegg.
 * Brutto/netto uten belegg vises som ukjent i stedet for å antas.
 */
export function formatPriceBasis(price: ListingPrice | null): string {
  if (!price || price.basis === "unknown" || !price.basisEvidence) return PRICE_BASIS_LABEL.unknown;
  return PRICE_BASIS_LABEL[price.basis];
}

/** Annonsepris for visning. Ustøttet valuta vises ordrett med valutakode. */
export function formatListingPrice(price: ListingPrice | null): { text: string; note: string | null } {
  if (!price) return { text: "Pris ikke oppgitt", note: null };
  if (price.amount) return { text: formatMoney(price.amount), note: null };
  return { text: `${price.stated.amount} ${price.stated.currency}`, note: UNSUPPORTED_CURRENCY_NOTE };
}

/** Mva.-opplysninger slik annonsen oppgir dem. Ikke en vurdering av fradragsrett. */
export function formatVatStatement(vat: SourceVatStatement | null): string {
  if (!vat || vat.origin === "none") return "ingen mva.-opplysninger i annonsen";
  const parts: string[] = [];
  if (vat.statedRateBasisPoints !== null) {
    parts.push(`oppgitt sats ${new Intl.NumberFormat("nb-NO").format(vat.statedRateBasisPoints / 100)} %`);
  }
  if (vat.reclaimableClaim === "claimed") parts.push("annonsen oppgir at mva. kan trekkes fra");
  if (vat.reclaimableClaim === "denied") parts.push("annonsen oppgir at mva. ikke kan trekkes fra");
  const origin = vat.origin === "structured_field" ? "strukturert felt" : "annonsetekst";
  return `${parts.join("; ")} (kilde: ${origin}; ikke kontrollert)`;
}

export const FUEL_LABEL: Record<Fuel, string> = {
  petrol: "Bensin", diesel: "Diesel", electric: "Elektrisk", hybrid: "Hybrid",
  plugin_hybrid: "Ladbar hybrid", other: "Annet",
};

export const TRANSMISSION_LABEL: Record<Transmission, string> = { manual: "Manuell", automatic: "Automat" };

export const BODY_LABEL: Record<BodyType, string> = {
  sedan: "Sedan", estate: "Stasjonsvogn", suv: "SUV", hatchback: "Kombi (hatchback)", coupe: "Kupé",
  convertible: "Cabriolet", van: "Varebil/MPV", other: "Annet",
};

export const SELLER_LABEL: Record<SellerType, string> = {
  dealer: "Forhandler", private: "Privat", unknown: "Ukjent selgertype",
};

export function labelOrNotStated<K extends string>(map: Record<K, string>, key: K | null): string {
  return key === null ? NOT_STATED : map[key];
}

/** Prisgrunnlag for forventet salgspris. Ukjent vises som «ikke oppgitt». */
export function formatRetailBasis(basis: { vat: "included" | "excluded" | null; registrationTaxes: "included" | "excluded" | null }): string {
  const part = (v: "included" | "excluded" | null, what: string) =>
    v === null ? `${what}: ${NOT_STATED}` : `${v === "included" ? "inkl." : "ekskl."} ${what}`;
  return `${part(basis.vat, "mva.")}, ${part(basis.registrationTaxes, "registreringsavgifter")}`;
}

/** Klargjøringsreserve med mva.-basis. 0 kr vises som 0 kr (uttrykkelig valg), null som «ikke oppgitt». */
export function formatReserve(r: { amount: Money | null; vatBasis: "ex_vat" | "incl_vat" | null }): string {
  if (r.amount === null) return NOT_STATED;
  const amount = r.amount.amountMinor === 0 ? "0 kr" : formatMoney(r.amount);
  const basis = r.vatBasis === null ? `mva.-basis ${NOT_STATED}` : r.vatBasis === "ex_vat" ? "eks. mva." : "inkl. mva.";
  return `${amount} (${basis})`;
}

export const RUN_STATUS_LABEL = { running: "Pågår", completed: "Fullført", failed: "Feilet" } as const;

/** Trygge, forklarende tekster for lagret feilkode. Aldri rå feiltekst fra kilde eller database. */
export const RUN_ERROR_LABEL: Record<string, string> = {
  authentication: "Kilden avviste innloggingen. Søket ble stoppet.",
  forbidden: "Kilden nekter tilgang. Søket ble stoppet.",
  rate_limit: "Kildens kvote er brukt opp. Prøv igjen senere.",
  invalid_query: "Kilden avviste søket som ugyldig.",
  timeout: "Kilden svarte ikke i tide. Prøv igjen.",
  unavailable: "Kilden er utilgjengelig. Prøv igjen senere.",
  malformed_data: "Kilden returnerte data som ikke kunne leses.",
  abandoned: "Kjøringen ble ikke fullført og er avbrutt.",
  internal: "Kjøringen feilet internt. Prøv igjen.",
};

export const CRITERION_LABEL: Record<string, string> = {
  make: "merke", model: "modell", variant: "variant", year: "årsmodell", mileage: "kjørelengde", fuel: "drivstoff",
  transmission: "girkasse", bodyType: "karosseri", country: "land", price: "pris",
};

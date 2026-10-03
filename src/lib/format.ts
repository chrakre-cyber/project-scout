/**
 * Visningsformatering (nb-NO, Europe/Oslo). Kun presentasjon — ingen
 * økonomiske beregninger. `null` vises som «ikke oppgitt».
 */
import type {
  BodyType, FirstRegistration, Fuel, Mileage, Money, PriceBasis, SellerType, Transmission,
} from "@/domain/types";

export const NOT_STATED = "ikke oppgitt";

/** Antall desimaler i minste enhet. Ukjent valuta gir feil fremfor gjetning. */
const MINOR_UNIT_DIGITS: Record<string, number> = { NOK: 2, EUR: 2, SEK: 2, DKK: 2, CHF: 2, GBP: 2, PLN: 2 };

export function formatMoney(money: Money | null): string {
  if (!money) return NOT_STATED;
  const digits = MINOR_UNIT_DIGITS[money.currency];
  if (digits === undefined) throw new Error(`Ukjent valuta for visning: ${money.currency}`);
  // Heltallsdivisjon i visning er trygt: beløpet lagres eksakt i minste enhet.
  const major = money.amountMinor / 10 ** digits;
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

export const PRICE_BASIS_LABEL: Record<PriceBasis, string> = {
  gross: "brutto (inkl. utenlandsk mva. iflg. annonsen)",
  net: "netto (iflg. annonsen — ikke kontrollert)",
  unknown: "prisgrunnlag ukjent",
};

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

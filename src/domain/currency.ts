/**
 * Valutaer og pengeparsing. Rent og deterministisk — ingen FX eller nettverk.
 *
 * Appen støtter et uttrykkelig sett valutaer. For andre valutaer finnes ingen
 * avtalt minste enhet, så beløpet beholdes som kildens tekst i stedet for å
 * gjette desimaler (DEV-001 review R1, DEC-018).
 */
import type { CurrencyCode, Money } from "./types";

/** ISO 4217 minste enhet (antall desimaler) for valutaer appen støtter. */
const SUPPORTED_MINOR_DIGITS: Readonly<Record<string, number>> = {
  NOK: 2, EUR: 2, SEK: 2, DKK: 2, CHF: 2, GBP: 2, PLN: 2,
};

export function minorDigits(currency: CurrencyCode): number | null {
  return Object.hasOwn(SUPPORTED_MINOR_DIGITS, currency) ? SUPPORTED_MINOR_DIGITS[currency]! : null;
}

export function isSupportedCurrency(currency: CurrencyCode): boolean {
  return minorDigits(currency) !== null;
}

/** Gyldig formet ISO 4217-kode (tre store bokstaver), uavhengig av støtte. */
export function isCurrencyCodeFormat(code: string): boolean {
  return /^[A-Z]{3}$/.test(code);
}

/**
 * Gjør en positiv desimalstreng («32490», «32490.5») om til heltall i minste
 * enhet med strengaritmetikk, uten flyttall. Returnerer null ved ugyldig
 * format, for mange desimaler, 0 eller beløp utenfor trygt heltall.
 */
export function parseDecimalToMinor(value: string, digits: number): number | null {
  const m = /^(\d+)(?:\.(\d+))?$/.exec(value);
  if (!m) return null;
  const whole = m[1]!;
  const frac = m[2] ?? "";
  if (frac.length > digits) return null;
  const minor = BigInt(whole + frac.padEnd(digits, "0"));
  if (minor <= 0n || minor > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return Number(minor);
}

/** Bygger Money for støttet valuta, ellers null. */
export function toMoney(amount: string, currency: CurrencyCode): Money | null {
  const digits = minorDigits(currency);
  if (digits === null) return null;
  const amountMinor = parseDecimalToMinor(amount, digits);
  return amountMinor === null ? null : { amountMinor, currency };
}

/**
 * Pengeformat ved databasegrensen (DEC-020, DEV-001 review R5).
 *
 * I Postgres/JSONB og over PostgREST er `amountMinor` en heltallsstreng, ikke et
 * JSON-tall, fordi JSON-tall over 2^53 mister presisjon i JavaScript uten feil.
 * Databasen avviser verdier over 2^53-1 (CHECK), og konverteringen her feiler
 * eksplisitt i stedet for å runde stille.
 */
export interface MoneyDb {
  amountMinor: string;
  currency: string;
}

export class MoneyBoundaryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyBoundaryError";
  }
}

export function moneyToDb(money: Money): MoneyDb {
  if (!Number.isSafeInteger(money.amountMinor) || money.amountMinor <= 0) {
    throw new MoneyBoundaryError(`amountMinor må være et positivt trygt heltall, fikk ${money.amountMinor}`);
  }
  if (!isCurrencyCodeFormat(money.currency)) throw new MoneyBoundaryError(`ugyldig valutakode ${money.currency}`);
  return { amountMinor: String(money.amountMinor), currency: money.currency };
}

export function moneyFromDb(value: unknown): Money {
  if (typeof value !== "object" || value === null) throw new MoneyBoundaryError("penger mangler eller er ikke et objekt");
  const { amountMinor, currency } = value as Record<string, unknown>;
  if (typeof amountMinor !== "string" || !/^[1-9]\d{0,15}$/.test(amountMinor)) {
    throw new MoneyBoundaryError(`amountMinor må være en heltallsstreng, fikk ${JSON.stringify(amountMinor)}`);
  }
  const big = BigInt(amountMinor);
  if (big > BigInt(Number.MAX_SAFE_INTEGER)) throw new MoneyBoundaryError(`amountMinor ${amountMinor} er større enn 2^53-1`);
  if (typeof currency !== "string" || !isCurrencyCodeFormat(currency)) throw new MoneyBoundaryError("ugyldig valutakode");
  return { amountMinor: Number(big), currency };
}

/** Eksakt desimalstreng fra minste enhet, uten flyttall: 9007199254740991, 2 → "90071992547409.91". */
export function minorToDecimalString(amountMinor: number, digits: number): string {
  if (!Number.isSafeInteger(amountMinor)) throw new MoneyBoundaryError(`ikke et trygt heltall: ${amountMinor}`);
  const s = String(Math.abs(amountMinor)).padStart(digits + 1, "0");
  const sign = amountMinor < 0 ? "-" : "";
  return digits === 0 ? sign + s : `${sign}${s.slice(0, -digits)}.${s.slice(-digits)}`;
}

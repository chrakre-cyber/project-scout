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

/**
 * Eksakt desimalaritmetikk for avgiftsberegning (ECON-002). Ingen binær float: verdien er `units / 10^scale` med BigInt.
 * Ingen avrunding skjer her før kallet uttrykkelig ber om det (`floorInt`, `ceilInt`, `roundHalfUpInt`).
 */
export interface Dec {
  readonly units: bigint;
  readonly scale: number;
}

const TEN = 10n;
const pow10 = (n: number): bigint => TEN ** BigInt(n);

/** Ikke-negativ eller negativ desimalstreng («12.71», «260», «-5.5»). Kaster ved annet format (ingen stille gjetting). */
export function dec(text: string): Dec {
  const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(text);
  if (!m) throw new Error(`ugyldig desimaltall: ${JSON.stringify(text)}`);
  const frac = m[3] ?? "";
  const units = BigInt(m[2]! + frac);
  return { units: m[1] ? -units : units, scale: frac.length };
}

export function decInt(n: number | bigint): Dec {
  if (typeof n === "number" && !Number.isSafeInteger(n)) throw new Error(`ikke et trygt heltall: ${n}`);
  return { units: BigInt(n), scale: 0 };
}

const toScale = (a: Dec, scale: number): bigint => a.units * pow10(scale - a.scale);

export function add(a: Dec, b: Dec): Dec {
  const scale = Math.max(a.scale, b.scale);
  return { units: toScale(a, scale) + toScale(b, scale), scale };
}

export function mul(a: Dec, b: Dec): Dec {
  return { units: a.units * b.units, scale: a.scale + b.scale };
}

export function cmp(a: Dec, b: Dec): -1 | 0 | 1 {
  const scale = Math.max(a.scale, b.scale);
  const x = toScale(a, scale);
  const y = toScale(b, scale);
  return x < y ? -1 : x > y ? 1 : 0;
}

export const ZERO: Dec = { units: 0n, scale: 0 };

export function max0(a: Dec): Dec {
  return a.units < 0n ? ZERO : a;
}

export function min(a: Dec, b: Dec): Dec {
  return cmp(a, b) <= 0 ? a : b;
}

export function sub(a: Dec, b: Dec): Dec {
  return add(a, { units: -b.units, scale: b.scale });
}

/** Største heltall ≤ verdien (rund ned mot −∞). */
export function floorInt(a: Dec): bigint {
  const d = pow10(a.scale);
  const q = a.units / d;
  return a.units % d !== 0n && a.units < 0n ? q - 1n : q;
}

/** Minste heltall ≥ verdien. */
export function ceilInt(a: Dec): bigint {
  const d = pow10(a.scale);
  const q = a.units / d;
  return a.units % d !== 0n && a.units > 0n ? q + 1n : q;
}

/** Nærmeste heltall; likhet (x,5) rundes bort fra null. Brukes bare når kallet eksplisitt ber om det. */
export function roundHalfUpInt(a: Dec): bigint {
  const d = pow10(a.scale);
  const half = d / 2n;
  return a.units >= 0n ? (a.units + half) / d : -((-a.units + half) / d);
}

/** Eksakt tekstform uten etterfølgende nuller («526669.738», «537418.1», «2400»). */
export function toExactString(a: Dec): string {
  const neg = a.units < 0n;
  const abs = neg ? -a.units : a.units;
  const s = abs.toString().padStart(a.scale + 1, "0");
  const whole = a.scale === 0 ? s : s.slice(0, -a.scale);
  const frac = a.scale === 0 ? "" : s.slice(-a.scale).replace(/0+$/, "");
  return `${neg ? "-" : ""}${whole}${frac ? `.${frac}` : ""}`;
}

export function toSafeNumber(n: bigint): number {
  if (n > BigInt(Number.MAX_SAFE_INTEGER) || n < BigInt(Number.MIN_SAFE_INTEGER)) throw new Error("utenfor trygt heltall");
  return Number(n);
}

/**
 * Eksakt desimalregning for økonomikjernen (ECON-004): rasjonale tall med bigint, ingen binær float.
 * Avrunding er alltid en uttrykkelig `RoundingPolicy`; ingen policy er godkjent som produksjonsregel (U-013 åpent).
 */
export interface Rat { readonly n: bigint; readonly d: bigint }

/** Teknisk skranke (ikke en skatteregel): beløp i kildevaluta/NOK. */
export const MAX_AMOUNT = 1_000_000_000n;
/** Teknisk skranke for kurs (NOK per enhet). */
export const MIN_RATE: Rat = { n: 1n, d: 1_000_000n };
export const MAX_RATE: Rat = { n: 1_000_000n, d: 1n };
const MAX_DECIMALS = 8;

const gcd = (a: bigint, b: bigint): bigint => { while (b) [a, b] = [b, a % b]; return a < 0n ? -a : a; };
export const norm = (r: Rat): Rat => { const g = gcd(r.n, r.d) || 1n; return { n: r.n / g, d: r.d / g }; };

/** Ikke-negativ desimalstreng («34361», «10.6709») ⇒ rasjonalt tall; ellers null. Ingen eksponent, ingen tusenskilletegn, ingen fortegn. */
export function parseDecimal(s: unknown): Rat | null {
  if (typeof s !== "string") return null;
  const m = new RegExp(`^(\\d{1,15})(?:\\.(\\d{1,${MAX_DECIMALS}}))?$`).exec(s);
  if (!m) return null;
  const frac = m[2] ?? "";
  return norm({ n: BigInt(m[1]! + frac), d: 10n ** BigInt(frac.length) });
}
/** Rå publisert kurs (f.eks. Tolletatens «1142,960»): desimalkomma eller -punktum, ingen tusenskille, ingen fortegn. */
export function parsePublishedDecimal(s: unknown): Rat | null {
  if (typeof s !== "string") return null;
  const m = new RegExp(`^(\\d{1,15})(?:[.,](\\d{1,${MAX_DECIMALS}}))?$`).exec(s);
  if (!m) return null;
  const frac = m[2] ?? "";
  return norm({ n: BigInt(m[1]! + frac), d: 10n ** BigInt(frac.length) });
}
export const fromInt = (x: bigint): Rat => ({ n: x, d: 1n });
export const mul = (a: Rat, b: Rat): Rat => norm({ n: a.n * b.n, d: a.d * b.d });
export const add = (a: Rat, b: Rat): Rat => norm({ n: a.n * b.d + b.n * a.d, d: a.d * b.d });
/** a − b, avkortet til 0 (brukes bare for «beløp over en grense»). */
export const subFloor0 = (a: Rat, b: Rat): Rat => { const r = norm({ n: a.n * b.d - b.n * a.d, d: a.d * b.d }); return r.n < 0n ? { n: 0n, d: 1n } : r; };
export const cmp = (a: Rat, b: Rat): number => { const l = a.n * b.d, r = b.n * a.d; return l < r ? -1 : l > r ? 1 : 0; };
export const isZero = (a: Rat): boolean => a.n === 0n;

export interface RoundingPolicy {
  mode: "half_up" | "half_even";
  /** `unconfirmed_convention`: fixture-/utviklerkonvensjon uten kilde (U-013). `approved` krever uttrykkelig beslutning og er ikke gitt for noen policy. */
  status: "unconfirmed_convention" | "approved";
}
/** Den eneste policyen som er brukt i fixturene (ECON-001 §4.3). IKKE en godkjent produksjonsregel. */
export const UNCONFIRMED_HALF_UP: RoundingPolicy = { mode: "half_up", status: "unconfirmed_convention" };

export interface Rounded {
  /** Verdien etter policy. */
  value: bigint;
  /** Brøkdelen er nøyaktig 0,5: da avhenger utfallet av policyen, som er uavklart (U-013). */
  tie: boolean;
  /** Begge kandidater når `tie` (ellers lik `value`). */
  candidates: { halfUp: bigint; halfEven: bigint };
}

/** Nærmeste hele tall (bare ikke-negative verdier). */
export function roundToWhole(r: Rat, policy: RoundingPolicy): Rounded {
  if (r.n < 0n) throw new Error("negative beløp støttes ikke");
  const q = r.n / r.d;
  const twice = (r.n % r.d) * 2n;
  const tie = twice === r.d;
  const halfUp = twice >= r.d ? q + 1n : q;
  const halfEven = tie ? (q % 2n === 0n ? q : q + 1n) : halfUp;
  return { value: policy.mode === "half_up" ? halfUp : halfEven, tie, candidates: { halfUp, halfEven } };
}

/** Eksakt desimalstreng for et tall med endelig desimalutvikling (≤ maxScale desimaler); ellers null. Ingen avkorting. */
export function toExactDecimalString(r: Rat, maxScale = 12): string | null {
  for (let k = 0; k <= maxScale; k++) {
    const scaled = r.n * 10n ** BigInt(k);
    if (scaled % r.d === 0n) {
      const v = (scaled / r.d).toString().padStart(k + 1, "0");
      return k === 0 ? v : `${v.slice(0, -k)}.${v.slice(-k)}`; // k er minste skala: ingen etterfølgende nuller
    }
  }
  return null;
}

/** Avkortet desimalvisning (kun dokumentasjon/visning, aldri videre beregning). */
export function toDecimalString(r: Rat, scale = 4): string {
  const scaled = (r.n * 10n ** BigInt(scale)) / r.d;
  const s = scaled.toString().padStart(scale + 1, "0");
  return `${s.slice(0, -scale)}.${s.slice(-scale)}`;
}

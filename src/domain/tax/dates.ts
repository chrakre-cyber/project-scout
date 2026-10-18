/**
 * Rene datohjelpere (ISO «YYYY-MM-DD») uten tidssone og uten Date-objekt: samme resultat uavhengig av maskin og klokke.
 */
export interface Ymd {
  readonly y: number;
  readonly m: number;
  readonly d: number;
}

export function parseIsoDate(s: string): Ymd | null {
  const x = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!x) return null;
  const y = Number(x[1]);
  const m = Number(x[2]);
  const d = Number(x[3]);
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null;
  return { y, m, d };
}

export const isLeapYear = (y: number): boolean => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

export function daysInMonth(y: number, m: number): number {
  return [31, isLeapYear(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]!;
}

const pad = (n: number, w: number): string => String(n).padStart(w, "0");
export const formatIso = (v: Ymd): string => `${pad(v.y, 4)}-${pad(v.m, 2)}-${pad(v.d, 2)}`;

/** Leksikografisk sammenligning er korrekt for nullpadda ISO-datoer. */
export const compareIso = (a: string, b: string): -1 | 0 | 1 => (a < b ? -1 : a > b ? 1 : 0);

/**
 * «Første dato der alderen er minst `months` måneder», dato til dato. Er dagen (29–31) ikke til i målmåneden, er kilden taus
 * (T42/T03 4.2 eksemplifiserer bare hele år): to kandidater returneres — siste dag i målmåneden («clamped») og første dag i
 * neste måned («rolled»). Er dagen til i målmåneden, er begge like.
 */
export function monthAnniversaryCandidates(first: Ymd, months: number): { clamped: string; rolled: string } {
  const total = first.y * 12 + (first.m - 1) + months;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  const dim = daysInMonth(y, m);
  if (first.d <= dim) {
    const same = formatIso({ y, m, d: first.d });
    return { clamped: same, rolled: same };
  }
  const nextTotal = total + 1;
  return {
    clamped: formatIso({ y, m, d: dim }),
    rolled: formatIso({ y: Math.floor(nextTotal / 12), m: (nextTotal % 12) + 1, d: 1 }),
  };
}

export function lastDayOfMonth(y: number, m: number): string {
  return formatIso({ y, m, d: daysInMonth(y, m) });
}

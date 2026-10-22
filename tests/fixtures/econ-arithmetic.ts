/**
 * ECON-003: uavhengig, eksakt testaritmetikk (rasjonale tall med bigint; ingen binær float). Dette er et TESTORAKEL for å kontrollere fixturenes
 * forventninger — ikke produksjonskode og ikke landed-cost-kjernen (ECON-004). Avrundingskonvensjonen «nærmeste hele krone, halvt opp» er en
 * FIXTURE-KONVENSJON fra ECON-001 §4.3; den er ikke kildebelagt for mva. (U-013 er åpent). Likhetstilfeller (x,5) registreres, ikke skjules.
 */
export interface Rat { n: bigint; d: bigint }

const gcd = (a: bigint, b: bigint): bigint => { while (b) [a, b] = [b, a % b]; return a < 0n ? -a : a; };
const norm = (r: Rat): Rat => { const g = gcd(r.n, r.d) || 1n; return { n: r.n / g, d: r.d / g }; };

/** «10.6709» → rasjonalt tall. Bare ikke-negative desimalstrenger. */
export function parseDec(s: string): Rat {
  const m = /^(\d+)(?:\.(\d+))?$/.exec(s);
  if (!m) throw new Error(`ugyldig desimalstreng: ${s}`);
  const frac = m[2] ?? "";
  return norm({ n: BigInt(m[1]! + frac), d: 10n ** BigInt(frac.length) });
}
export const int = (x: number | bigint): Rat => ({ n: BigInt(x), d: 1n });
export const mul = (a: Rat, b: Rat): Rat => norm({ n: a.n * b.n, d: a.d * b.d });
export const add = (a: Rat, b: Rat): Rat => norm({ n: a.n * b.d + b.n * a.d, d: a.d * b.d });
export const sub = (a: Rat, b: Rat): Rat => norm({ n: a.n * b.d - b.n * a.d, d: a.d * b.d });
export const max0 = (a: Rat): Rat => (a.n < 0n ? { n: 0n, d: 1n } : a);

/** Nærmeste hele tall, halvt opp (bare ikke-negative verdier). `tie` er true når brøkdelen er nøyaktig 0,5. */
export function roundHalfUp(r: Rat): { value: bigint; tie: boolean } {
  if (r.n < 0n) throw new Error("negative beløp støttes ikke i fixturene");
  const q = r.n / r.d;
  const rem2 = (r.n % r.d) * 2n; // sammenlign brøkdelen med 1/2
  return { value: rem2 >= r.d ? q + 1n : q, tie: rem2 === r.d };
}
export const floorInt = (r: Rat): bigint => r.n / r.d;
export const ceilInt = (r: Rat): bigint => (r.n % r.d === 0n ? r.n / r.d : r.n / r.d + 1n);

/** Eksakt desimalvisning med `scale` desimaler (avkortet; bare for dokumentasjon, aldri til beregning). */
export function toDecimalString(r: Rat, scale = 4): string {
  const scaled = (r.n * 10n ** BigInt(scale)) / r.d;
  const s = scaled.toString().padStart(scale + 1, "0");
  return `${s.slice(0, -scale)}.${s.slice(-scale)}`;
}

export interface Ruling { acquisitionUsedNok: number; customsValueNok: number; importVatNok: number; totalRegistrationTaxesNok: number; importCashRequirementNok: number }
export type VatState = "recoverable" | "non_recoverable" | "unknown";
export type LandedCost =
  | { status: "calculated"; valueNok: number }
  | { status: "unresolved_vat"; valueNok: null; scenarios: { if_recoverable: number; if_non_recoverable: number } };

export interface OracleInput {
  /** Annonsepris (netto) i EUR, hele euro. */
  priceEur: number;
  acquisitionFxRate: string;
  customsFxRate: string;
  transportNok: number;
  /** Beløp som holdes utenfor mva.-grunnlaget (EV: 300 000 når fritaket antas å gjelde; ellers 0). Anvendelsen er åpen (R-IMP-VAT-003). */
  vatExemptionNok: number;
  totalRegistrationTaxesNok: number;
}

/** Kjøpesum og tollverdi avrundes hver for seg, én gang, til nærmeste hele krone (ECON-001 §4.3 pkt. 1); mva. = 25 % av avrundet grunnlag over fritak, nærmeste krone (pkt. 2). */
export function oracle(i: OracleInput): { ruling: Ruling; ties: string[]; raw: { purchaseAcq: Rat; purchaseCustoms: Rat; vat: Rat } } {
  const ties: string[] = [];
  const purchaseAcq = mul(int(i.priceEur), parseDec(i.acquisitionFxRate));
  const purchaseCustoms = mul(int(i.priceEur), parseDec(i.customsFxRate));
  const acq = roundHalfUp(purchaseAcq); if (acq.tie) ties.push("acquisition");
  const cus = roundHalfUp(purchaseCustoms); if (cus.tie) ties.push("customs_purchase");
  const customsValue = cus.value + BigInt(i.transportNok);
  const vatRaw = mul({ n: 25n, d: 100n }, max0(sub(int(customsValue), int(i.vatExemptionNok))));
  const vat = roundHalfUp(vatRaw); if (vat.tie) ties.push("import_vat");
  const cash = acq.value + BigInt(i.transportNok) + vat.value + BigInt(i.totalRegistrationTaxesNok);
  return {
    ruling: { acquisitionUsedNok: Number(acq.value), customsValueNok: Number(customsValue), importVatNok: Number(vat.value), totalRegistrationTaxesNok: i.totalRegistrationTaxesNok, importCashRequirementNok: Number(cash) },
    ties,
    raw: { purchaseAcq, purchaseCustoms, vat: vatRaw },
  };
}

/** Permanent økonomisk kost (ECON-001 §12): import-mva. inngår bare ved non_recoverable; `unknown` gir ingen enkelttall, men to merkede scenarier. */
export function landedCost(r: Ruling, transportNok: number, state: VatState): LandedCost {
  const withoutVat = r.acquisitionUsedNok + transportNok + r.totalRegistrationTaxesNok;
  const withVat = withoutVat + r.importVatNok;
  if (state === "recoverable") return { status: "calculated", valueNok: withoutVat };
  if (state === "non_recoverable") return { status: "calculated", valueNok: withVat };
  return { status: "unresolved_vat", valueNok: null, scenarios: { if_recoverable: withoutVat, if_non_recoverable: withVat } };
}

/**
 * ECON-005c: forhandleropplysninger til økonomiberegningen (ren domenekode: ingen I/O, DB, UI, provider eller klokke).
 *
 * Forhandlerinput er forhandlerens EGNE opplysninger med oppgitt grunnlag; de er aldri annonsepåstander. Tekniske avgiftsinput kan bare ha grunnlag
 * `dealer_entered | vehicle_register | type_approval` (aldri `listing_claim`). Kurser er alltid forhandleroppgitte (kilde, dato, estimatstatus bevares). Mva.-håndtering og
 * fradragsstatus er `unknown` hvis ikke uttrykkelig oppgitt. Penger er desimalstrenger i NOK (aldri flyttall); ukjent er `null`/fraværende, aldri 0.
 *
 * Parseren er streng: ukjente nøkler avvises på alle nivåer (inkl. forsøk på å sende firma-id eller `listing_claim`), størrelse er begrenset, og feil returneres som
 * koder uten å eksponere verdier. Binding til firma/søk/kandidat/revisjon (plan P2) og vurdering av om en bekreftelse er foreldet ligger her; lagring og firma-oppløsning er serverens ansvar.
 */
import { parseUtcInstant } from "@/domain/search-v2/budget";
import type { LineScope, ValidityLimit } from "./types";

export const DEALER_INPUT_SCHEMA_VERSION = 1 as const;
export const MAX_DEALER_INPUT_BYTES = 16_000;

export type TechnicalBasis = "dealer_entered" | "vehicle_register" | "type_approval";
export type WeightBasisInput = "eu_type_approval_minimum_mass" | "vehicle_register" | "dealer_entered";
export type Co2MethodInput = "wltp_combined" | "wltp_weighted_combined" | "epa_nrcan" | "nedc" | "not_wltp_or_nedc_approved" | "unspecified";
export type DealerVatHandling = "registered_reports_in_vat_return" | "not_registered_pays_at_import" | "unknown";
export type DealerDeduction = "recoverable" | "non_recoverable" | "unknown";

export interface DealerAmount { amount: string }
export type DealerCharge = DealerAmount | { state: "unknown" } | { state: "not_applicable"; basis: string };
export interface DealerFx {
  /** «EUR/NOK». Må samsvare med annonsens valuta (kontrolleres av økonomikjernen). */
  pair: string;
  /** NOK per 1 enhet kildevaluta (desimalstreng). */
  rate: string;
  /** Fritekst: hvor kursen er hentet fra (vises som kilde). Kursen er alltid `dealer_entered`. */
  sourceLabel: string;
  effectiveAt?: string | null;
  /** Når kursen ble notert (påkrevd: forhandleroppgitt kurs har alltid kilde og dato). */
  quotedAt: string;
  /** Anskaffelseskurs: siste gyldighetsdato (inklusiv). */
  validUntil?: string | null;
  /** Tollkurs: gyldighetsperiode (inklusiv). */
  validFrom?: string | null;
  validTo?: string | null;
}
export type DealerLineScope = "unconfirmed" | "to_border" | "after_border" | "other" | { split: { toBorderMinor: string; afterBorderMinor: string } };

export interface DealerInputV1 {
  schemaVersion: typeof DEALER_INPUT_SCHEMA_VERSION;
  propulsion?: {
    pistonCombustionEngine: boolean | null; externallyChargeable: boolean | null;
    combustionFuel: "diesel" | "petrol" | "other" | null; hybridization: "none" | "non_chargeable_hybrid" | null; basis: TechnicalBasis;
  };
  taxWeight?: { kg: number | null; basis: WeightBasisInput };
  co2?: { gramsPerKm: number | null; method: Co2MethodInput };
  firstRegistration?: { precision: "day" | "month" | "year" | "none" | "unknown"; value: string | null; basis: TechnicalBasis };
  norwegianRegistration?: { date: string | null; kind: "expected" | "actual" };
  customsDate?: { date: string | null; kind: "actual_acceptance" | "expected_scenario" | "unknown" };
  foreignVat?: { treatment: "excluded_documented" | "unconfirmed"; evidence: "invoice_or_contract" | "dealer_entered" };
  fx?: { acquisition?: DealerFx; customs?: DealerFx };
  transportToBorder?: DealerAmount;
  transportAfterBorder?: DealerCharge;
  loadingHandling?: DealerCharge;
  insurance?: DealerAmount;
  climateGas?: DealerCharge;
  registrationFee?: DealerCharge;
  deduction?: DealerDeduction;
  vatHandling?: DealerVatHandling;
  /** Bekreftet omfang per søkekostnadslinje (plan P1). Linjer uten oppføring er `unconfirmed`. */
  lineScopes?: Record<string, DealerLineScope>;
  evidenceRef?: string;
}

/** Firmanivå-standarder (`dealer_profile`): standard `unknown`; endrer aldri en bekreftet kandidatoverstyring. */
export interface DealerProfileV1 { schemaVersion: 1; vatHandling?: DealerVatHandling; deduction?: DealerDeduction }

export interface InputIssue { path: string; code: "unknown_key" | "invalid_type" | "invalid_value" | "too_large" | "missing" }
export type ParseResult<T> = { ok: true; value: T } | { ok: false; issues: InputIssue[] };

// ---------------------------------------------------------------- primitive validatorer
const AMOUNT = /^(0|[1-9][0-9]{0,11})(\.[0-9]{1,2})?$/;
const RATE = /^(0|[1-9][0-9]{0,5})(\.[0-9]{1,8})?$/;
const PAIR = /^[A-Z]{3}\/NOK$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const YEAR_MONTH = /^\d{4}-\d{2}$/;
const YEAR = /^\d{4}$/;
const LINE_ID = /^[a-z0-9][a-z0-9_-]{0,39}$/;
const MINOR = /^(0|[1-9][0-9]{0,15})$/;
const MAX_MINOR = 9_007_199_254_740_991n;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const text = (v: unknown, max: number): v is string => typeof v === "string" && v.length >= 1 && v.length <= max && !/[\u0000-\u001f\u007f]/.test(v) && v === v.trim();
const validDate = (v: unknown): v is string => typeof v === "string" && DATE.test(v) && parseUtcInstant(`${v}T00:00:00Z`) !== null;
const nullableDate = (v: unknown): v is string | null => v === null || validDate(v);
const bool = (v: unknown): v is boolean | null => v === null || typeof v === "boolean";
const oneOf = <T extends string>(v: unknown, set: readonly T[]): v is T => typeof v === "string" && (set as readonly string[]).includes(v);

class Ctx {
  issues: InputIssue[] = [];
  add(path: string, code: InputIssue["code"]) { this.issues.push({ path, code }); }
  /** Objekt med nøyaktig tillatte nøkler (alle valgfrie unntatt `required`). */
  obj(v: unknown, path: string, allowed: readonly string[], required: readonly string[] = []): Record<string, unknown> | null {
    if (!isObj(v)) { this.add(path, "invalid_type"); return null; }
    for (const k of Object.keys(v)) if (!allowed.includes(k)) this.add(`${path}.${k}`, "unknown_key");
    for (const k of required) if (!(k in v)) this.add(`${path}.${k}`, "missing");
    return v;
  }
}

function parseFx(c: Ctx, v: unknown, path: string, role: "acquisition" | "customs"): DealerFx | undefined {
  const o = c.obj(v, path, ["pair", "rate", "sourceLabel", "effectiveAt", "quotedAt", "validUntil", "validFrom", "validTo"], ["pair", "rate", "sourceLabel", "quotedAt"]);
  if (!o) return undefined;
  const before = c.issues.length;
  if (typeof o.pair !== "string" || !PAIR.test(o.pair)) c.add(`${path}.pair`, "invalid_value");
  if (typeof o.rate !== "string" || !RATE.test(o.rate) || /^0(\.0+)?$/.test(o.rate)) c.add(`${path}.rate`, "invalid_value");
  if (!text(o.sourceLabel, 100)) c.add(`${path}.sourceLabel`, "invalid_value");
  for (const k of ["effectiveAt", "quotedAt", "validUntil", "validFrom", "validTo"] as const) if (k in o && !nullableDate(o[k])) c.add(`${path}.${k}`, "invalid_value");
  if (o.quotedAt === null) c.add(`${path}.quotedAt`, "invalid_value"); // kilde og dato er påkrevd for forhandleroppgitt kurs
  if (role === "acquisition" && ("validFrom" in o || "validTo" in o)) c.add(`${path}.validTo`, "invalid_value");
  if (role === "customs" && "validUntil" in o) c.add(`${path}.validUntil`, "invalid_value");
  if (c.issues.length > before) return undefined;
  return o as unknown as DealerFx;
}

const amountOf = (c: Ctx, v: unknown, path: string): DealerAmount | undefined => {
  const o = c.obj(v, path, ["amount"], ["amount"]);
  if (!o) return undefined;
  if (typeof o.amount !== "string" || !AMOUNT.test(o.amount)) { c.add(`${path}.amount`, "invalid_value"); return undefined; }
  return { amount: o.amount };
};
const chargeOf = (c: Ctx, v: unknown, path: string): DealerCharge | undefined => {
  if (isObj(v) && "state" in v) {
    const o = c.obj(v, path, ["state", "basis"], ["state"]);
    if (!o) return undefined;
    if (o.state === "unknown" && !("basis" in o)) return { state: "unknown" };
    if (o.state === "not_applicable" && text(o.basis, 100)) return { state: "not_applicable", basis: o.basis };
    c.add(`${path}.state`, "invalid_value");
    return undefined;
  }
  return amountOf(c, v, path);
};

function parseScope(c: Ctx, v: unknown, path: string): DealerLineScope | undefined {
  if (oneOf(v, ["unconfirmed", "to_border", "after_border", "other"] as const)) return v;
  const o = c.obj(v, path, ["split"], ["split"]);
  const s = o ? c.obj(o.split, `${path}.split`, ["toBorderMinor", "afterBorderMinor"], ["toBorderMinor", "afterBorderMinor"]) : null;
  if (!s) return undefined;
  const ok = (x: unknown): x is string => typeof x === "string" && MINOR.test(x) && BigInt(x) <= MAX_MINOR;
  if (!ok(s.toBorderMinor) || !ok(s.afterBorderMinor)) { c.add(`${path}.split`, "invalid_value"); return undefined; }
  return { split: { toBorderMinor: s.toBorderMinor, afterBorderMinor: s.afterBorderMinor } };
}

const TOP_KEYS = ["schemaVersion", "propulsion", "taxWeight", "co2", "firstRegistration", "norwegianRegistration", "customsDate", "foreignVat", "fx", "transportToBorder", "transportAfterBorder",
  "loadingHandling", "insurance", "climateGas", "registrationFee", "deduction", "vatHandling", "lineScopes", "evidenceRef"] as const;
const BASES = ["dealer_entered", "vehicle_register", "type_approval"] as const;
const CO2_METHODS = ["wltp_combined", "wltp_weighted_combined", "epa_nrcan", "nedc", "not_wltp_or_nedc_approved", "unspecified"] as const;

/** Streng parsing av forhandlerinput (JSON fra klient/lager). Aldri unntak; ukjente nøkler og `listing_claim`-grunnlag avvises. */
export function parseDealerInput(raw: unknown): ParseResult<DealerInputV1> {
  const c = new Ctx();
  // Alltid JSON: gå via serialisering (avviser bigint/sirkulære verdier, dropper `undefined`, fjerner prototyper/gettere), og begrens størrelsen.
  let serialized: string | undefined, json: unknown;
  try { serialized = JSON.stringify(raw); json = serialized === undefined ? undefined : JSON.parse(serialized); } catch { return { ok: false, issues: [{ path: "$", code: "invalid_type" }] }; }
  if ((serialized?.length ?? 0) > MAX_DEALER_INPUT_BYTES) return { ok: false, issues: [{ path: "$", code: "too_large" }] };
  const o = c.obj(json, "$", TOP_KEYS, ["schemaVersion"]);
  if (!o) return { ok: false, issues: c.issues };
  if (o.schemaVersion !== DEALER_INPUT_SCHEMA_VERSION) c.add("$.schemaVersion", "invalid_value");
  const out: DealerInputV1 = { schemaVersion: DEALER_INPUT_SCHEMA_VERSION };

  if ("propulsion" in o) {
    const p = c.obj(o.propulsion, "$.propulsion", ["pistonCombustionEngine", "externallyChargeable", "combustionFuel", "hybridization", "basis"], ["pistonCombustionEngine", "externallyChargeable", "combustionFuel", "hybridization", "basis"]);
    if (p) {
      if (!bool(p.pistonCombustionEngine)) c.add("$.propulsion.pistonCombustionEngine", "invalid_type");
      if (!bool(p.externallyChargeable)) c.add("$.propulsion.externallyChargeable", "invalid_type");
      if (p.combustionFuel !== null && !oneOf(p.combustionFuel, ["diesel", "petrol", "other"] as const)) c.add("$.propulsion.combustionFuel", "invalid_value");
      if (p.hybridization !== null && !oneOf(p.hybridization, ["none", "non_chargeable_hybrid"] as const)) c.add("$.propulsion.hybridization", "invalid_value");
      if (!oneOf(p.basis, BASES)) c.add("$.propulsion.basis", "invalid_value");
      out.propulsion = p as unknown as NonNullable<DealerInputV1["propulsion"]>;
    }
  }
  if ("taxWeight" in o) {
    const w = c.obj(o.taxWeight, "$.taxWeight", ["kg", "basis"], ["kg", "basis"]);
    if (w) {
      if (w.kg !== null && !(typeof w.kg === "number" && Number.isSafeInteger(w.kg) && w.kg >= 1 && w.kg <= 20_000)) c.add("$.taxWeight.kg", "invalid_value");
      if (!oneOf(w.basis, ["eu_type_approval_minimum_mass", "vehicle_register", "dealer_entered"] as const)) c.add("$.taxWeight.basis", "invalid_value");
      out.taxWeight = w as unknown as NonNullable<DealerInputV1["taxWeight"]>;
    }
  }
  if ("co2" in o) {
    const w = c.obj(o.co2, "$.co2", ["gramsPerKm", "method"], ["gramsPerKm", "method"]);
    if (w) {
      if (w.gramsPerKm !== null && !(typeof w.gramsPerKm === "number" && Number.isSafeInteger(w.gramsPerKm) && w.gramsPerKm >= 0 && w.gramsPerKm <= 2000)) c.add("$.co2.gramsPerKm", "invalid_value");
      if (!oneOf(w.method, CO2_METHODS)) c.add("$.co2.method", "invalid_value");
      out.co2 = w as unknown as NonNullable<DealerInputV1["co2"]>;
    }
  }
  if ("firstRegistration" in o) {
    const w = c.obj(o.firstRegistration, "$.firstRegistration", ["precision", "value", "basis"], ["precision", "value", "basis"]);
    if (w) {
      const okPrec = oneOf(w.precision, ["day", "month", "year", "none", "unknown"] as const);
      if (!okPrec) c.add("$.firstRegistration.precision", "invalid_value");
      else {
        const v = w.value;
        const ok = (w.precision === "none" || w.precision === "unknown") ? v === null
          : w.precision === "day" ? validDate(v) : w.precision === "month" ? typeof v === "string" && YEAR_MONTH.test(v) && validDate(`${v}-01`) : typeof v === "string" && YEAR.test(v);
        if (!ok) c.add("$.firstRegistration.value", "invalid_value"); // presisjonen må stemme med verdien: ingen oppdiktet måned/dag
      }
      if (!oneOf(w.basis, BASES)) c.add("$.firstRegistration.basis", "invalid_value");
      out.firstRegistration = w as unknown as NonNullable<DealerInputV1["firstRegistration"]>;
    }
  }
  if ("norwegianRegistration" in o) {
    const w = c.obj(o.norwegianRegistration, "$.norwegianRegistration", ["date", "kind"], ["date", "kind"]);
    if (w) {
      if (!nullableDate(w.date)) c.add("$.norwegianRegistration.date", "invalid_value");
      if (!oneOf(w.kind, ["expected", "actual"] as const)) c.add("$.norwegianRegistration.kind", "invalid_value");
      out.norwegianRegistration = w as unknown as NonNullable<DealerInputV1["norwegianRegistration"]>;
    }
  }
  if ("customsDate" in o) {
    const w = c.obj(o.customsDate, "$.customsDate", ["date", "kind"], ["date", "kind"]);
    if (w) {
      if (!nullableDate(w.date)) c.add("$.customsDate.date", "invalid_value");
      if (!oneOf(w.kind, ["actual_acceptance", "expected_scenario", "unknown"] as const)) c.add("$.customsDate.kind", "invalid_value");
      if (w.kind === "unknown" && w.date !== null) c.add("$.customsDate.date", "invalid_value");
      out.customsDate = w as unknown as NonNullable<DealerInputV1["customsDate"]>;
    }
  }
  if ("foreignVat" in o) {
    const w = c.obj(o.foreignVat, "$.foreignVat", ["treatment", "evidence"], ["treatment", "evidence"]);
    if (w) {
      if (!oneOf(w.treatment, ["excluded_documented", "unconfirmed"] as const)) c.add("$.foreignVat.treatment", "invalid_value");
      if (!oneOf(w.evidence, ["invoice_or_contract", "dealer_entered"] as const)) c.add("$.foreignVat.evidence", "invalid_value"); // listing_claim avvises
      out.foreignVat = w as unknown as NonNullable<DealerInputV1["foreignVat"]>;
    }
  }
  if ("fx" in o) {
    const f = c.obj(o.fx, "$.fx", ["acquisition", "customs"]);
    if (f) {
      const fx: NonNullable<DealerInputV1["fx"]> = {};
      if ("acquisition" in f) { const q = parseFx(c, f.acquisition, "$.fx.acquisition", "acquisition"); if (q) fx.acquisition = q; }
      if ("customs" in f) { const q = parseFx(c, f.customs, "$.fx.customs", "customs"); if (q) fx.customs = q; }
      out.fx = fx;
    }
  }
  if ("transportToBorder" in o) { const a = amountOf(c, o.transportToBorder, "$.transportToBorder"); if (a) out.transportToBorder = a; }
  if ("insurance" in o) { const a = amountOf(c, o.insurance, "$.insurance"); if (a) out.insurance = a; }
  for (const k of ["transportAfterBorder", "loadingHandling", "climateGas", "registrationFee"] as const) {
    if (k in o) { const a = chargeOf(c, o[k], `$.${k}`); if (a) out[k] = a; }
  }
  if ("deduction" in o) { if (oneOf(o.deduction, ["recoverable", "non_recoverable", "unknown"] as const)) out.deduction = o.deduction; else c.add("$.deduction", "invalid_value"); }
  if ("vatHandling" in o) { if (oneOf(o.vatHandling, ["registered_reports_in_vat_return", "not_registered_pays_at_import", "unknown"] as const)) out.vatHandling = o.vatHandling; else c.add("$.vatHandling", "invalid_value"); }
  if ("lineScopes" in o) {
    const l = o.lineScopes;
    if (!isObj(l)) c.add("$.lineScopes", "invalid_type");
    else if (Object.keys(l).length > 30) c.add("$.lineScopes", "too_large");
    else {
      const scopes: Record<string, DealerLineScope> = {};
      for (const [id, s] of Object.entries(l)) {
        if (!LINE_ID.test(id)) { c.add("$.lineScopes", "invalid_value"); continue; }
        const p = parseScope(c, s, `$.lineScopes.${id}`);
        if (p !== undefined) scopes[id] = p;
      }
      out.lineScopes = scopes;
    }
  }
  if ("evidenceRef" in o) { if (text(o.evidenceRef, 200)) out.evidenceRef = o.evidenceRef; else c.add("$.evidenceRef", "invalid_value"); }
  return c.issues.length > 0 ? { ok: false, issues: c.issues } : { ok: true, value: out };
}

export function parseDealerProfile(raw: unknown): ParseResult<DealerProfileV1> {
  const c = new Ctx();
  const o = c.obj(raw, "$", ["schemaVersion", "vatHandling", "deduction"], ["schemaVersion"]);
  if (!o) return { ok: false, issues: c.issues };
  if (o.schemaVersion !== 1) c.add("$.schemaVersion", "invalid_value");
  const out: DealerProfileV1 = { schemaVersion: 1 };
  if ("vatHandling" in o) { if (oneOf(o.vatHandling, ["registered_reports_in_vat_return", "not_registered_pays_at_import", "unknown"] as const)) out.vatHandling = o.vatHandling; else c.add("$.vatHandling", "invalid_value"); }
  if ("deduction" in o) { if (oneOf(o.deduction, ["recoverable", "non_recoverable", "unknown"] as const)) out.deduction = o.deduction; else c.add("$.deduction", "invalid_value"); }
  return c.issues.length > 0 ? { ok: false, issues: c.issues } : { ok: true, value: out };
}

/** JSON-omfang (strenger) → intern `LineScope` (bigint). Ugyldig øre-sum håndteres av mapperen (`split_sum_mismatch`). */
export function toLineScopes(scopes: DealerInputV1["lineScopes"]): Record<string, LineScope> {
  const out: Record<string, LineScope> = {};
  for (const [id, s] of Object.entries(scopes ?? {})) {
    out[id] = typeof s === "string" ? s : { split: { toBorderMinor: BigInt(s.split.toBorderMinor), afterBorderMinor: BigInt(s.split.afterBorderMinor) } };
  }
  return out;
}

// ---------------------------------------------------------------- binding og foreldelse (plan P2)
/** Nøkkel for forhandlerinput. `dealershipId` kommer ALLTID fra serverens validerte sesjon/databasen, aldri fra klienten. */
export interface DealerInputBinding { dealershipId: string; searchId: string; candidateId: string; candidateVersion: string; inputSchemaVersion: number }

/** Det bekreftelsen ble gitt under. Endring av noe av dette krever ny bekreftelse. */
export interface ConfirmationContext {
  /** `costBasisOf(spec)` — kostnadslinjene (id, type, valuta, beløp, mva.-grunnlag). */
  costBasis: string;
  /** Planlagt norsk registreringsscenario (`spec.plannedRegistration.requested`). */
  registrationScenario: string;
  /** Avtrykk av rettighetsprofilen for kilden (inkl. rettigheter for avledet økonomi); endring av rettigheter påvirker hvilke avledede felt som kan brukes. */
  rightsDigest: string;
}

export interface StoredDealerInput { binding: DealerInputBinding; input: DealerInputV1; context: ConfirmationContext; confirmedBy: string; confirmedAt: string }

export type StaleReason =
  | "schema_version_changed" | "candidate_version_changed" | "cost_basis_changed" | "scenario_changed" | "rights_changed" | "fx_expired"
  /** Bekreftet omfang/fordeling stemmer ikke med søkets nåværende kostnadslinjer (type eller beløp). */
  | "line_scopes_invalid";
export type InputStatus =
  | { status: "none" }
  /** Hører til et annet firma/søk/kandidat: brukes aldri og påvirker ingenting (ingen antydning av innholdet). */
  | { status: "foreign" }
  | { status: "stale_needs_reconfirmation"; reasons: StaleReason[] }
  | { status: "fresh"; expiryLimits: ValidityLimit[] };

const DAY_MS = 86_400_000;
/** Inklusiv sluttdato (YYYY-MM-DD) → eksklusiv UTC-grense. */
export function dayAfterIso(date: string): string | null {
  const ms = parseUtcInstant(`${date}T00:00:00Z`);
  return ms === null ? null : new Date(ms + DAY_MS).toISOString();
}

function fxLimits(input: DealerInputV1): Array<{ label: string; untilExclusive: string | null }> {
  const out: Array<{ label: string; untilExclusive: string | null }> = [];
  const a = input.fx?.acquisition?.validUntil;
  if (a) out.push({ label: "dealer_acquisition_fx_validUntil", untilExclusive: dayAfterIso(a) });
  const t = input.fx?.customs?.validTo;
  if (t) out.push({ label: "dealer_customs_fx_validTo", untilExclusive: dayAfterIso(t) });
  return out;
}

/**
 * Er lagret forhandlerinput brukbar for DENNE kandidaten, DETTE søket og DETTE firmaet nå?
 * - annen firma-/søke-/kandidat-id ⇒ `foreign` (aldri brukt, heller ikke som hint);
 * - ny kandidatrevisjon, endret schema, kostnadsgrunnlag, planlagt scenario, rettighetsavtrykk eller utløpt forhandleroppgitt kurs ⇒ `stale_needs_reconfirmation` (ikke brukt);
 * - endret budsjett/avvik, avgifts-/økonomiprofilversjon krever ikke ny bekreftelse (resultatet regnes på nytt fra samme input).
 */
export function evaluateDealerInput(stored: StoredDealerInput | null, current: { binding: DealerInputBinding; context: ConfirmationContext; now: string }): InputStatus {
  if (stored === null) return { status: "none" };
  const b = stored.binding, k = current.binding;
  if (b.dealershipId !== k.dealershipId || b.searchId !== k.searchId || b.candidateId !== k.candidateId) return { status: "foreign" };
  const reasons: StaleReason[] = [];
  if (b.inputSchemaVersion !== k.inputSchemaVersion || stored.input.schemaVersion !== DEALER_INPUT_SCHEMA_VERSION) reasons.push("schema_version_changed");
  if (b.candidateVersion !== k.candidateVersion) reasons.push("candidate_version_changed");
  if (stored.context.costBasis !== current.context.costBasis) reasons.push("cost_basis_changed");
  if (stored.context.registrationScenario !== current.context.registrationScenario) reasons.push("scenario_changed");
  if (stored.context.rightsDigest !== current.context.rightsDigest) reasons.push("rights_changed");
  const nowMs = parseUtcInstant(current.now);
  const limits = fxLimits(stored.input);
  for (const l of limits) if (l.untilExclusive === null || nowMs === null || parseUtcInstant(l.untilExclusive)! <= nowMs) { reasons.push("fx_expired"); break; }
  if (reasons.length > 0) return { status: "stale_needs_reconfirmation", reasons };
  return { status: "fresh", expiryLimits: limits };
}

// ---------------------------------------------------------------- omfang mot aktuell kostnadslinje (plan P1)
/**
 * Kontrollerer bekreftet omfang mot AKTUELLE søkekostnadslinjer (kalles før lagring og før bruk av lagret input).
 *  - linjen må finnes;
 *  - `transport`: unconfirmed | to_border | after_border | split; `insurance`: unconfirmed | to_border | other; øvrige typer: bare unconfirmed;
 *  - split bare for transport, delbeløpene ikke-negative (sikres av parseren) og summen er nøyaktig linjens beløp (ukjent beløp ⇒ ugyldig).
 * Ugyldig omfang må ikke nå økonomikjernen. Ikke-inkluderte linjer og linjer i annen valuta er formelt gyldige (de mappes uansett ikke).
 */
export function validateLineScopes(scopes: DealerInputV1["lineScopes"], costs: ReadonlyArray<{ id: string; kind: string; amountMinor: bigint | null }>): InputIssue[] {
  const issues: InputIssue[] = [];
  const byId = new Map(costs.map((c) => [c.id, c]));
  for (const [id, scope] of Object.entries(scopes ?? {})) {
    const path = `$.lineScopes.${id}`;
    const line = byId.get(id);
    if (!line) { issues.push({ path, code: "invalid_value" }); continue; }
    if (scope === "unconfirmed") continue;
    const kindOk = line.kind === "transport" ? scope === "to_border" || scope === "after_border" || typeof scope === "object"
      : line.kind === "insurance" ? scope === "to_border" || scope === "other" : false;
    if (!kindOk) { issues.push({ path, code: "invalid_value" }); continue; }
    if (typeof scope === "object") {
      if (line.amountMinor === null || BigInt(scope.split.toBorderMinor) + BigInt(scope.split.afterBorderMinor) !== line.amountMinor) issues.push({ path: `${path}.split`, code: "invalid_value" });
    }
  }
  return issues;
}

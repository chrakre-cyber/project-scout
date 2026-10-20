/**
 * ECON-006b: skjemamodell for forhandleropplysninger (ren domenekode: ingen I/O, UI, klokke eller flyttall).
 *
 * Skjemaverdier er alltid strenger. `buildDealerInputFromForm` lager ubetrodd JSON som SENDES TIL `parseDealerInput` (den autoritative valideringen); skjemaet har bare ekstra
 * brukerrettede feilkoder per felt. Prinsipper:
 *  - tomt felt = ikke oppgitt = utelatt (ukjent). Aldri 0, aldri «dokumentert». Et faktisk skrevet «0» er et oppgitt nullbeløp og bevares;
 *  - ingen valg kan uttrykke annonsepåstand som grunnlag (`listing_claim` finnes ikke som verdi); verdier utenfor hvitelisten avvises;
 *  - skjemaet kan ikke uttrykke firma, søk, kandidat eller revisjon i selve opplysningene (de utledes av serveren);
 *  - kommaskilletegn og mellomrom i tall normaliseres med ren strengbehandling (ingen flyttall, ingen avrunding); NOK-beløp i fordeling omregnes til øre eksakt.
 */
import type { DealerInputV1 } from "./dealer-input";

export type FormValues = Record<string, string>;
export type FormErrorCode = "required" | "invalid_value" | "invalid_amount" | "invalid_integer" | "invalid_date" | "invalid_rate" | "too_long" | "split_mismatch" | "choose_one" | "must_be_empty";
export type FieldErrors = Record<string, FormErrorCode>;

export interface FormCostLine { id: string; kind: string; amountMinor: bigint | null }

export const PROPULSION_BASES = ["dealer_entered", "vehicle_register", "type_approval"] as const;
export const WEIGHT_BASES = ["eu_type_approval_minimum_mass", "vehicle_register", "dealer_entered"] as const;
export const CO2_METHODS = ["wltp_combined", "wltp_weighted_combined", "epa_nrcan", "nedc", "not_wltp_or_nedc_approved", "unspecified"] as const;
export const PRECISIONS = ["day", "month", "year", "unknown", "none"] as const;
export const CHARGE_KEYS = [["ta", "transportAfterBorder"], ["lh", "loadingHandling"], ["cg", "climateGas"], ["rf", "registrationFee"]] as const;

const AMOUNT = /^(0|[1-9][0-9]{0,11})(\.[0-9]{1,2})?$/;
const RATE = /^(0|[1-9][0-9]{0,5})(\.[0-9]{1,8})?$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const YEAR_MONTH = /^\d{4}-\d{2}$/;
const YEAR = /^\d{4}$/;
const PAIR = /^[A-Z]{3}\/NOK$/;

/** Desimaltall fra et tekstfelt: fjerner mellomrom (også hardt), komma → punktum. Ren strengbehandling; resultatet valideres av regex/parser. */
export const normalizeDecimal = (s: string): string => s.replace(/[\s ]/g, "").replace(",", ".");
/** NOK-beløp (maks 2 desimaler) → øre som heltallsstreng, eksakt; ellers null. */
export function nokToMinor(s: string): string | null {
  const n = normalizeDecimal(s);
  const m = /^(0|[1-9][0-9]{0,13})(?:\.([0-9]{1,2}))?$/.exec(n);
  if (!m) return null;
  const minor = BigInt(m[1]!) * 100n + BigInt((m[2] ?? "").padEnd(2, "0") || "0");
  return minor.toString();
}
const minorToNokText = (minor: string): string => {
  const m = BigInt(minor);
  const w = m / 100n, f = (m % 100n).toString().padStart(2, "0");
  return f === "00" ? w.toString() : `${w},${f}`;
};
const dot = (s: string): string => s.replace(".", ",");

const oneOf = <T extends string>(v: string, set: readonly T[]): v is T => (set as readonly string[]).includes(v);
const CONTROL = /[\u0000-\u001f\u007f]/;

class B {
  errors: FieldErrors = {};
  constructor(private readonly v: FormValues) {}
  get(k: string): string { const x = this.v[k]; return typeof x === "string" ? x.trim() : ""; }
  err(k: string, c: FormErrorCode) { if (!(k in this.errors)) this.errors[k] = c; }
  any(...ks: string[]): boolean { return ks.some((k) => this.get(k) !== ""); }
}

function textOk(s: string, max: number): boolean { return s.length >= 1 && s.length <= max && !CONTROL.test(s); }

export interface BuildResult { raw: Record<string, unknown>; errors: FieldErrors }

/**
 * Bygger forhandlerinput-JSON fra skjemaverdier. `lines` er søkets kostnadslinjer (kun transport/forsikring kan få omfang). Returnerer feil per skjemafelt; er det feil, skal
 * ingenting lagres. Opplysninger som ikke er oppgitt utelates (ukjent). Resultatet må uansett gjennom `parseDealerInput`.
 */
export function buildDealerInputFromForm(values: FormValues, lines: readonly FormCostLine[]): BuildResult {
  const b = new B(values);
  const raw: Record<string, unknown> = { schemaVersion: 1 };

  // --- drivlinje
  if (b.any("prop_piston", "prop_chargeable", "prop_fuel", "prop_hybrid", "prop_basis")) {
    const tri = (k: string): boolean | null => { const x = b.get(k); if (x === "") return null; if (x === "yes") return true; if (x === "no") return false; b.err(k, "invalid_value"); return null; };
    const piston = tri("prop_piston"), chargeable = tri("prop_chargeable");
    const fuel = b.get("prop_fuel"), hyb = b.get("prop_hybrid"), basis = b.get("prop_basis");
    if (fuel !== "" && !oneOf(fuel, ["diesel", "petrol", "other"] as const)) b.err("prop_fuel", "invalid_value");
    if (hyb !== "" && !oneOf(hyb, ["none", "non_chargeable_hybrid"] as const)) b.err("prop_hybrid", "invalid_value");
    if (basis === "") b.err("prop_basis", "required"); else if (!oneOf(basis, PROPULSION_BASES)) b.err("prop_basis", "invalid_value");
    raw.propulsion = { pistonCombustionEngine: piston, externallyChargeable: chargeable, combustionFuel: fuel === "" ? null : fuel, hybridization: hyb === "" ? null : hyb, basis };
  }
  // --- avgiftsvekt
  if (b.any("tw_kg", "tw_basis")) {
    const kg = normalizeDecimal(b.get("tw_kg")), basis = b.get("tw_basis");
    if (kg === "") b.err("tw_kg", "required"); else if (!/^[1-9][0-9]{0,4}$/.test(kg)) b.err("tw_kg", "invalid_integer");
    if (basis === "") b.err("tw_basis", "required"); else if (!oneOf(basis, WEIGHT_BASES)) b.err("tw_basis", "invalid_value");
    raw.taxWeight = { kg: /^[1-9][0-9]{0,4}$/.test(kg) ? parseInt(kg, 10) : null, basis };
  }
  // --- CO₂
  if (b.any("co2_g", "co2_method")) {
    const g = b.get("co2_g"), method = b.get("co2_method");
    if (g === "") b.err("co2_g", "required"); else if (!/^(0|[1-9][0-9]{0,3})$/.test(g)) b.err("co2_g", "invalid_integer");
    if (method === "") b.err("co2_method", "required"); else if (!oneOf(method, CO2_METHODS)) b.err("co2_method", "invalid_value");
    raw.co2 = { gramsPerKm: /^(0|[1-9][0-9]{0,3})$/.test(g) ? parseInt(g, 10) : null, method };
  }
  // --- første registrering: presisjonen må stemme med verdien (ingen oppdiktet dag/måned)
  if (b.any("fr_precision", "fr_value", "fr_basis")) {
    const p = b.get("fr_precision"), v = b.get("fr_value"), basis = b.get("fr_basis");
    if (p === "") b.err("fr_precision", "required");
    else if (!oneOf(p, PRECISIONS)) b.err("fr_precision", "invalid_value");
    else if (p === "unknown" || p === "none") { if (v !== "") b.err("fr_value", "must_be_empty"); }
    else if (v === "") b.err("fr_value", "required");
    else if (!(p === "day" ? DATE.test(v) : p === "month" ? YEAR_MONTH.test(v) : YEAR.test(v))) b.err("fr_value", "invalid_date");
    const unknownish = p === "unknown" || p === "none";
    // Ved «ukjent/ingen» finnes ingen verdi å dokumentere: grunnlaget settes til det laveste («oppgitt av forhandler») — aldri til register/typegodkjenning.
    const fb = unknownish ? "dealer_entered" : basis;
    if (!unknownish) { if (basis === "") b.err("fr_basis", "required"); else if (!oneOf(basis, PROPULSION_BASES)) b.err("fr_basis", "invalid_value"); }
    raw.firstRegistration = { precision: p, value: unknownish || v === "" ? null : v, basis: fb };
  }
  // --- norske datoer
  if (b.any("nr_date", "nr_kind")) {
    const d = b.get("nr_date"), k = b.get("nr_kind");
    if (d === "") b.err("nr_date", "required"); else if (!DATE.test(d)) b.err("nr_date", "invalid_date");
    if (k === "") b.err("nr_kind", "required"); else if (!oneOf(k, ["expected", "actual"] as const)) b.err("nr_kind", "invalid_value");
    raw.norwegianRegistration = { date: d === "" ? null : d, kind: k };
  }
  if (b.any("cd_kind", "cd_date")) {
    const k = b.get("cd_kind"), d = b.get("cd_date");
    if (k === "") b.err("cd_kind", "required");
    else if (!oneOf(k, ["expected_scenario", "actual_acceptance", "unknown"] as const)) b.err("cd_kind", "invalid_value");
    else if (k === "unknown") { if (d !== "") b.err("cd_date", "must_be_empty"); }
    else if (d === "") b.err("cd_date", "required");
    else if (!DATE.test(d)) b.err("cd_date", "invalid_date");
    raw.customsDate = { date: k === "unknown" || d === "" ? null : d, kind: k };
  }
  // --- utenlandsk mva.
  if (b.any("fv_treatment", "fv_evidence")) {
    const t = b.get("fv_treatment"), e = b.get("fv_evidence");
    if (t === "") b.err("fv_treatment", "required");
    else if (!oneOf(t, ["excluded_documented", "unconfirmed"] as const)) b.err("fv_treatment", "invalid_value");
    else if (t === "excluded_documented" && e === "") b.err("fv_evidence", "required");
    if (e !== "" && !oneOf(e, ["invoice_or_contract", "dealer_entered"] as const)) b.err("fv_evidence", "invalid_value");
    raw.foreignVat = { treatment: t, evidence: t === "unconfirmed" || e === "" ? "dealer_entered" : e };
  }
  // --- kurser (alltid forhandleroppgitt; kilde og dato påkrevd)
  const fx: Record<string, unknown> = {};
  for (const [role, p, dates] of [["acquisition", "fxA", ["validUntil"]], ["customs", "fxC", ["validFrom", "validTo"]]] as const) {
    const names = ["pair", "rate", "source", "quotedAt", "effectiveAt", ...dates].map((n) => `${p}_${n}`);
    if (!b.any(...names)) continue;
    const pair = b.get(`${p}_pair`), rate = normalizeDecimal(b.get(`${p}_rate`)), source = b.get(`${p}_source`), quoted = b.get(`${p}_quotedAt`);
    if (pair === "") b.err(`${p}_pair`, "required"); else if (!PAIR.test(pair)) b.err(`${p}_pair`, "invalid_value");
    if (rate === "") b.err(`${p}_rate`, "required"); else if (!RATE.test(rate) || /^0(\.0+)?$/.test(rate)) b.err(`${p}_rate`, "invalid_rate");
    if (source === "") b.err(`${p}_source`, "required"); else if (!textOk(source, 100)) b.err(`${p}_source`, "too_long");
    if (quoted === "") b.err(`${p}_quotedAt`, "required"); else if (!DATE.test(quoted)) b.err(`${p}_quotedAt`, "invalid_date");
    const q: Record<string, unknown> = { pair, rate, sourceLabel: source, quotedAt: quoted };
    for (const n of ["effectiveAt", ...dates]) {
      const x = b.get(`${p}_${n}`);
      if (x === "") continue;
      if (!DATE.test(x)) b.err(`${p}_${n}`, "invalid_date"); else q[n] = x;
    }
    fx[role] = q;
  }
  if (Object.keys(fx).length > 0) raw.fx = fx;
  // --- kostnader
  const amountField = (name: string, key: string) => {
    const x = normalizeDecimal(b.get(name));
    if (x === "") return;
    if (!AMOUNT.test(x)) b.err(name, "invalid_amount"); else raw[key] = { amount: x };
  };
  amountField("tb_amount", "transportToBorder");
  amountField("ins_amount", "insurance");
  for (const [p, key] of CHARGE_KEYS) {
    const mode = b.get(`${p}_mode`), amount = normalizeDecimal(b.get(`${p}_amount`)), note = b.get(`${p}_note`);
    if (mode === "") {
      if (amount !== "" || note !== "") b.err(`${p}_mode`, "choose_one"); // beløp eller begrunnelse uten valg: ikke gjett
      continue;
    }
    if (mode === "amount") {
      if (amount === "") b.err(`${p}_amount`, "required"); else if (!AMOUNT.test(amount)) b.err(`${p}_amount`, "invalid_amount"); else raw[key] = { amount };
      if (note !== "") b.err(`${p}_note`, "must_be_empty");
    } else if (mode === "not_applicable") {
      if (note === "") b.err(`${p}_note`, "required"); else if (!textOk(note, 100)) b.err(`${p}_note`, "too_long"); else raw[key] = { state: "not_applicable", basis: note };
      if (amount !== "") b.err(`${p}_amount`, "must_be_empty");
    } else b.err(`${p}_mode`, "invalid_value");
  }
  // --- mva. og fradrag: tomt = ikke satt for kandidaten (firmaprofilen kan gjelde); «ukjent» er et uttrykkelig valg
  for (const [name, key, set] of [["deduction", "deduction", ["recoverable", "non_recoverable", "unknown"]], ["vatHandling", "vatHandling", ["registered_reports_in_vat_return", "not_registered_pays_at_import", "unknown"]]] as const) {
    const x = b.get(name);
    if (x === "") continue;
    if (oneOf(x, set)) raw[key] = x; else b.err(name, "invalid_value");
  }
  // --- omfang per søkekostnadslinje
  const scopes: Record<string, unknown> = {};
  for (const l of lines) {
    if (l.kind !== "transport" && l.kind !== "insurance") continue;
    const s = b.get(`scope_${l.id}`);
    if (s === "" || s === "unconfirmed") continue;
    const allowed = l.kind === "transport" ? ["to_border", "after_border", "split"] : ["to_border", "other"];
    if (!allowed.includes(s)) { b.err(`scope_${l.id}`, "invalid_value"); continue; }
    if (s !== "split") { scopes[l.id] = s; continue; }
    const to = nokToMinor(b.get(`scopeTo_${l.id}`)), after = nokToMinor(b.get(`scopeAfter_${l.id}`));
    if (to === null) b.err(`scopeTo_${l.id}`, b.get(`scopeTo_${l.id}`) === "" ? "required" : "invalid_amount");
    if (after === null) b.err(`scopeAfter_${l.id}`, b.get(`scopeAfter_${l.id}`) === "" ? "required" : "invalid_amount");
    if (to !== null && after !== null) {
      if (l.amountMinor === null || BigInt(to) + BigInt(after) !== l.amountMinor) b.err(`scopeTo_${l.id}`, "split_mismatch");
      else scopes[l.id] = { split: { toBorderMinor: to, afterBorderMinor: after } };
    }
  }
  if (Object.keys(scopes).length > 0) raw.lineScopes = scopes;
  // --- henvisning
  const ev = b.get("evidenceRef");
  if (ev !== "") { if (textOk(ev, 200)) raw.evidenceRef = ev; else b.err("evidenceRef", "too_long"); }
  return { raw, errors: b.errors };
}

/** Lagret input → skjemaverdier (forhåndsutfylling til gjennomgang; bekrefter ingenting). */
export function dealerInputToFormValues(input: DealerInputV1): FormValues {
  const v: FormValues = {};
  const yn = (x: boolean | null) => (x === null ? "" : x ? "yes" : "no");
  if (input.propulsion) {
    const p = input.propulsion;
    Object.assign(v, { prop_piston: yn(p.pistonCombustionEngine), prop_chargeable: yn(p.externallyChargeable), prop_fuel: p.combustionFuel ?? "", prop_hybrid: p.hybridization ?? "", prop_basis: p.basis });
  }
  if (input.taxWeight) Object.assign(v, { tw_kg: input.taxWeight.kg === null ? "" : String(input.taxWeight.kg), tw_basis: input.taxWeight.basis });
  if (input.co2) Object.assign(v, { co2_g: input.co2.gramsPerKm === null ? "" : String(input.co2.gramsPerKm), co2_method: input.co2.method });
  if (input.firstRegistration) {
    const f = input.firstRegistration;
    Object.assign(v, { fr_precision: f.precision, fr_value: f.value ?? "", fr_basis: f.precision === "unknown" || f.precision === "none" ? "" : f.basis });
  }
  if (input.norwegianRegistration) Object.assign(v, { nr_date: input.norwegianRegistration.date ?? "", nr_kind: input.norwegianRegistration.kind });
  if (input.customsDate) Object.assign(v, { cd_kind: input.customsDate.kind, cd_date: input.customsDate.date ?? "" });
  if (input.foreignVat) Object.assign(v, { fv_treatment: input.foreignVat.treatment, fv_evidence: input.foreignVat.treatment === "unconfirmed" ? "" : input.foreignVat.evidence });
  for (const [role, p] of [["acquisition", "fxA"], ["customs", "fxC"]] as const) {
    const q = input.fx?.[role];
    if (!q) continue;
    Object.assign(v, { [`${p}_pair`]: q.pair, [`${p}_rate`]: dot(q.rate), [`${p}_source`]: q.sourceLabel, [`${p}_quotedAt`]: q.quotedAt, [`${p}_effectiveAt`]: q.effectiveAt ?? "" });
    if (role === "acquisition") v.fxA_validUntil = q.validUntil ?? ""; else { v.fxC_validFrom = q.validFrom ?? ""; v.fxC_validTo = q.validTo ?? ""; }
  }
  if (input.transportToBorder) v.tb_amount = dot(input.transportToBorder.amount);
  if (input.insurance) v.ins_amount = dot(input.insurance.amount);
  for (const [p, key] of CHARGE_KEYS) {
    const c = input[key];
    if (!c) continue;
    if ("amount" in c) Object.assign(v, { [`${p}_mode`]: "amount", [`${p}_amount`]: dot(c.amount) });
    else if (c.state === "not_applicable") Object.assign(v, { [`${p}_mode`]: "not_applicable", [`${p}_note`]: c.basis });
  }
  if (input.deduction) v.deduction = input.deduction;
  if (input.vatHandling) v.vatHandling = input.vatHandling;
  for (const [id, s] of Object.entries(input.lineScopes ?? {})) {
    if (typeof s === "string") v[`scope_${id}`] = s;
    else Object.assign(v, { [`scope_${id}`]: "split", [`scopeTo_${id}`]: minorToNokText(s.split.toBorderMinor), [`scopeAfter_${id}`]: minorToNokText(s.split.afterBorderMinor) });
  }
  if (input.evidenceRef) v.evidenceRef = input.evidenceRef;
  return v;
}

/** Parserens feilsti → skjemafelt (reserve når skjemavalideringen slapp noe gjennom). `null` = ikke knyttet til ett felt. */
export function fieldForIssuePath(path: string): string | null {
  const m = (re: RegExp) => re.exec(path);
  const direct: Record<string, string> = {
    "$.propulsion.pistonCombustionEngine": "prop_piston", "$.propulsion.externallyChargeable": "prop_chargeable", "$.propulsion.combustionFuel": "prop_fuel", "$.propulsion.hybridization": "prop_hybrid", "$.propulsion.basis": "prop_basis",
    "$.taxWeight.kg": "tw_kg", "$.taxWeight.basis": "tw_basis", "$.co2.gramsPerKm": "co2_g", "$.co2.method": "co2_method",
    "$.firstRegistration.precision": "fr_precision", "$.firstRegistration.value": "fr_value", "$.firstRegistration.basis": "fr_basis",
    "$.norwegianRegistration.date": "nr_date", "$.norwegianRegistration.kind": "nr_kind", "$.customsDate.date": "cd_date", "$.customsDate.kind": "cd_kind",
    "$.foreignVat.treatment": "fv_treatment", "$.foreignVat.evidence": "fv_evidence",
    "$.transportToBorder.amount": "tb_amount", "$.insurance.amount": "ins_amount", "$.deduction": "deduction", "$.vatHandling": "vatHandling", "$.evidenceRef": "evidenceRef",
  };
  if (path in direct) return direct[path]!;
  let r = m(/^\$\.fx\.(acquisition|customs)\.(pair|rate|sourceLabel|effectiveAt|quotedAt|validUntil|validFrom|validTo)$/);
  if (r) return `${r[1] === "acquisition" ? "fxA" : "fxC"}_${r[2] === "sourceLabel" ? "source" : r[2]}`;
  r = m(/^\$\.(transportAfterBorder|loadingHandling|climateGas|registrationFee)(?:\.(amount|state|basis))?$/);
  if (r) { const p = CHARGE_KEYS.find(([, k]) => k === r![1])![0]; return r[2] === "amount" ? `${p}_amount` : r[2] === "basis" ? `${p}_note` : `${p}_mode`; }
  r = m(/^\$\.lineScopes\.([a-z0-9][a-z0-9_-]{0,39})(?:\.split)?$/);
  if (r) return `scope_${r[1]}`;
  return null;
}

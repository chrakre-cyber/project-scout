/**
 * ECON-006a: forklaringsmodell for økonomi (ren). Bygges fra kjerneresultatet og 005a-mapperen og eksponeres BARE bak rettighetsgrensen (005d): nedbrytning av beløp med tilstand og
 * grunnlag per rad, forutsetninger (kurs med kilde/dato, datoer, mva./fradrag), hva som er usikkert (gruppert), hva som mangler (som inputfelt) og konkret dokumentasjonsdekning.
 *
 * Prinsipper:
 *  - ukjent er ukjent (`unknown`, aldri 0); nedre grense merkes; antakelser merkes; annonsepåstand er aldri dokumentasjon;
 *  - ingen tillitsscore. Grunnlagsetikett er en beskrivelse av hva beløpene bygger på. Telleren «dokumentasjonsdekning» teller bare kostnadsposter med dokumentbasert grunnlag (tilbud)
 *    blant de kjente kostnadspostene og sier ingenting om at tallene er riktige, sikre eller godkjente;
 *  - ingen nye regler: modellen speiler kjernens felt; differansen «øvrige poster» er ren aritmetikk (brutto utlegg minus itemiserte poster);
 *  - kun desimalstrenger i NOK (ingen bigint/flyttall i utdata).
 */
import type { CostMeta, EconomicsResult } from "@/domain/economics";
import type { CostLineTreatment, MappingOutcome } from "./types";

export type RowId =
  | "purchase" | "transport_to_border" | "transport_after_border" | "insurance" | "loading_handling" | "import_vat" | "one_off_tax" | "scrappage_deposit"
  | "climate_gas" | "registration_fee" | "import_levy" | "other_known" | "commission_separate" | "payment_cost" | "other_rounding"
  | "customs_value" | "customs_duty" | "import_vat_base";
export type RowState = "known" | "assumed" | "unknown" | "lower_bound" | "not_applicable" | "excluded_by_scenario";
export type BasisKey =
  | "listing_claim" | "dealer_entered" | "document" | "assumed" | "stated_input" | "engine_estimate" | "computed" | "ordinary_rate_unapproved" | "unresolved";

export interface BreakdownRow {
  id: RowId;
  state: RowState;
  /** NOK som eksakt desimalstreng (hele kroner fra kjernen; poster fra forhandler kan ha øre); null = ukjent (aldri 0). `excluded_by_scenario` = regnet som 0 i totalene etter uttrykkelig scenarioantakelse. */
  amountNok: string | null;
  /** Forhandlerens egen betegnelse (data, ikke instruks) for poster med fritekst. */
  label?: string;
  basis: BasisKey;
  /** true: raden inngår i brutto utlegg. false: beregningsgrunnlag/mellomregning (vises adskilt, summeres ikke). */
  inGrossOutlay: boolean;
  /** Kildevaluta og -beløp for kjøpesummen når den ikke er NOK (kurs vises under forutsetninger). */
  original?: { amount: string; currency: string };
}

export type FxSourceKey = "official_customs" | "bank" | "dealer_entered" | "fixture" | "none";
export interface FxAssumption {
  role: "acquisition" | "customs";
  status: "used" | "assumed_from_acquisition" | "not_calculated";
  pair: string | null;
  /** Normalisert NOK per enhet (desimalstreng). */
  rate: string | null;
  sourceKind: FxSourceKey;
  /** Kildetekst slik forhandleren oppga den (data, ikke instruks). */
  sourceLabel: string | null;
  effectiveAt: string | null;
  quotedAt: string | null;
  validFrom: string | null;
  validTo: string | null;
}
export interface Assumptions {
  fx: FxAssumption[];
  customsAcceptance: { date: string | null; kind: "actual_acceptance" | "expected_scenario" | "unknown" };
  norwegianRegistration: { date: string | null; kind: string | null; defaulted: boolean };
  vatRecoverability: { value: "recoverable" | "non_recoverable" | "unknown"; source: string | null };
  vatHandling: { value: "registered_reports_in_vat_return" | "not_registered_pays_at_import" | "unknown"; source: string | null };
  /** Beregningsprofil/regelstatus: alltid «ikke godkjent for validering» så lenge økonomiflaggene er false. */
  rulesApprovedForValidation: boolean;
}

export type UncertaintyCategory = "rule" | "input_basis" | "assumption" | "missing" | "not_collected" | "other";
export interface UncertaintyItem { category: UncertaintyCategory; code: string }

export type FormFieldKey =
  | "propulsion" | "tax_weight" | "co2" | "first_registration" | "norwegian_registration" | "customs_date" | "foreign_vat" | "fx_acquisition" | "fx_customs"
  | "transport_to_border" | "transport_after_border" | "insurance" | "loading_handling" | "deduction" | "vat_handling"
  | "listing_price_basis" | "ev_qualification" | "commission" | "payment_costs" | "import_levies";
export interface MissingField {
  field: FormFieldKey;
  /** false: opplysningen er ikke en del av det som kan registreres (ikke innsamlet i dagens skjemamodell). */
  collectable: boolean;
}

export interface DocumentationCoverage { documented: number; knownCostItems: number }
export type BasisSummaryKey = "listing_claim_only" | "dealer_stated" | "partly_documented";

export interface SearchCostRow { id: string; label: string; treatment: CostLineTreatment["treatment"]; counted: boolean; amountNok: string | null }

export interface Explanation {
  breakdown: BreakdownRow[];
  /** Summen av valgte tillegg fra søket (DEC-030) som er telt, og antall linjer som ikke kunne regnes med. Ikke en budsjettvurdering. */
  searchCosts: { rows: SearchCostRow[]; countedNok: string; uncountedLines: number };
  assumptions: Assumptions;
  uncertainty: UncertaintyItem[];
  missing: MissingField[];
  coverage: DocumentationCoverage;
  basisSummary: BasisSummaryKey;
  /** Kontantbehovet er et brutto utlegg, ikke nødvendigvis kontantbetaling ved grensen (fast forklaring i etikettene). */
  grossOutlayIsNotCashAtBorder: true;
}

// ---------------------------------------------------------------- kode → kategori / felt
const RULE = new Set(["vat_rules_unapproved", "rounding_unconfirmed", "customs_fx_rule_unconfirmed", "deduction_rule_unapproved", "tax_profile_not_approved", "customs_duty_ordinary_rate_unapproved", "tax_estimate", "ev_threshold_components_unconfirmed", "customs_fx_suspension_unverified"]);
const INPUT_BASIS = new Set(["purchase_price_listing_claim", "deduction_status_dealer_stated", "foreign_vat_exclusion_dealer_stated", "ev_qualification_stated", "customs_acceptance_date_expected", "customs_fx_fallback_acquisition_rate", "purchase_commission_deduction_unverified"]);
const ASSUMPTION = new Set(["transport_default_assumed", "assumed_default_amount", "amount_scenario_assumption", "charges_excluded_by_scenario", "fx_dates_missing"]);
export const uncertaintyCategory = (code: string, kind: "estimate" | "incomplete" | "note"): UncertaintyCategory =>
  RULE.has(code) ? "rule" : INPUT_BASIS.has(code) ? "input_basis" : ASSUMPTION.has(code) ? "assumption" : code.endsWith("_not_collected") ? "not_collected" : kind === "incomplete" ? "missing" : "other";

/** Kjernens kode (incomplete / missing / blokkering) → inputfelt. `null` = ingen opplysning kan rette det (regel eller kilde). */
const FIELD_OF: Record<string, FormFieldKey | null> = {
  transport_unknown: "transport_to_border", transportToBorder: "transport_to_border", transport_to_border: "transport_to_border",
  transport_after_border_unknown: "transport_after_border", transportAfterBorder: "transport_after_border",
  insurance_unknown: "insurance", insurance: "insurance", loading_handling_unknown: "loading_handling", loading_handling: "loading_handling", loadingHandling: "loading_handling",
  acquisition_fx_missing: "fx_acquisition", customs_fx_missing: "fx_customs", customs_fx_period_missing: "fx_customs", customs_fx_suspended: "fx_customs",
  customs_acceptance_date_unknown: "customs_date", customs_acceptance_date_outside_documented_period: "customs_date",
  foreign_vat_exclusion_undocumented: "foreign_vat", unresolved_vat_recoverability: "deduction", vat_recoverability: "deduction", vat_handling_unknown: "vat_handling",
  acquisition_used: "listing_price_basis",
  ev_qualification_unresolved: "ev_qualification", ev_threshold_basis_not_documented: "ev_qualification", ev_threshold_basis_not_documented_for_import_type: "ev_qualification",
  commission_role_unknown: "commission", commission_price_inclusion_unknown: "commission", commission_in_price_deduction_unresolved: "commission",
  payment_cost_nature_unknown: "payment_costs", vat_base_charge_unclassified: "import_levies", "charges.customsDuty": "import_levies",
  // regelspørsmål eller avledet: ingen opplysning retter dem
  rounding_tie_unresolved: null, tax_blocked: null, components_missing: null, customs_value_components: null, import_vat: null, import_vat_base_incomplete: null, import_vat_rounding_tie: null,
  total_registration_taxes: null, "charges.climateGas": null, "charges.registrationFee": null,
  // blokkeringer fra avgiftsmotoren
  propulsion_unknown: "propulsion", propulsion_evidence_insufficient: "propulsion", vehicle_profile_unknown: "propulsion",
  tax_weight_missing: "tax_weight", tax_weight_invalid: "tax_weight",
  co2_missing: "co2", co2_invalid: "co2", co2_field_mismatch: "co2", co2_nedc_unsupported: "co2", co2_fallback_unsupported: "co2", phev_requires_weighted_combined_co2: "co2",
  first_registration_missing: "first_registration", first_registration_invalid: "first_registration", registration_precision_insufficient: "first_registration",
  age_step_boundary_ambiguous: "first_registration", twenty_year_minimum_unresolved: "first_registration",
  norwegian_registration_missing: "norwegian_registration", norwegian_registration_invalid: "norwegian_registration", norwegian_registration_before_first_registration: "norwegian_registration",
};
/** Felt som ikke er en del av dagens forhandlerinput (005c): kan ikke registreres. */
const NOT_COLLECTABLE = new Set<FormFieldKey>(["ev_qualification", "commission", "payment_costs", "import_levies", "listing_price_basis"]);
export const fieldOfCode = (code: string): FormFieldKey | null | undefined => (code in FIELD_OF ? FIELD_OF[code] : undefined);

// ---------------------------------------------------------------- bygging
const s = (n: bigint | null): string | null => (n === null ? null : n.toString());
/** hele NOK minus summen av eksakte desimalstrenger, som eksakt desimalstreng (bigint-aritmetikk på felles skala; ingen flyttall, ingen avrunding). */
function minorDiff(whole: bigint, parts: readonly string[]): string | null {
  const scale = Math.max(0, ...parts.map((p) => (p.includes(".") ? p.length - p.indexOf(".") - 1 : 0)));
  if (scale > 12) return null;
  const unit = 10n ** BigInt(scale);
  const toUnits = (p: string): bigint => { const [i = "0", f = ""] = p.split("."); return BigInt(i) * unit + BigInt(f.padEnd(scale, "0") || "0"); };
  const d = whole * unit - parts.reduce((t, p) => t + toUnits(p), 0n);
  const neg = d < 0n, abs = neg ? -d : d;
  const w = abs / unit, f = (abs % unit).toString().padStart(scale, "0").replace(/0+$/, "");
  return `${neg ? "-" : ""}${w}${f ? `.${f}` : ""}`;
}
const minorToNok = (m: bigint): string => { const w = m / 100n, o = m % 100n; return o === 0n ? w.toString() : `${w}.${o.toString().padStart(2, "0")}`; };

function basisOfAmount(b: string | null | undefined): { basis: BasisKey; assumed: boolean } {
  switch (b) {
    case "dealer_entered": return { basis: "dealer_entered", assumed: false };
    case "quoted": return { basis: "document", assumed: false };
    case "assumed_default": case "scenario_assumption": return { basis: "assumed", assumed: true };
    default: return { basis: "stated_input", assumed: false };
  }
}

export function explainEconomics(a: { result: EconomicsResult; outcome: MappingOutcome | null; notes: readonly string[] }): Explanation {
  const r = a.result;
  const rows: BreakdownRow[] = [];
  const row = (id: RowId, state: RowState, amount: bigint | null, basis: BasisKey, inGross: boolean, original?: BreakdownRow["original"]) => {
    const x: BreakdownRow = { id, state: amount === null && (state === "known" || state === "assumed") ? "unknown" : state, amountNok: s(amount), basis, inGrossOutlay: inGross };
    if (original) x.original = original;
    rows.push(x);
  };

  // kjøpesum
  const u = r.acquisition.used;
  const purchaseBasis: BasisKey = u.evidence === "listing_claim" ? "listing_claim" : u.evidence === "quote_document" ? "document" : "dealer_entered";
  const resolved = r.acquisition.purchaseBasisResolved && r.acquisition.acquisitionUsedNok !== null;
  row("purchase", resolved ? "known" : "unknown", resolved ? r.acquisition.acquisitionUsedNok : null, resolved ? purchaseBasis : "unresolved", true,
    u.currency !== "NOK" && u.amount !== null ? { amount: u.amount, currency: u.currency } : undefined);
  // transport og tillegg: tilstand og grunnlag følger hvordan posten faktisk ble oppgitt (kjernens metadata), aldri gjettet av at et beløp finnes
  const tb = basisOfAmount(r.transportToBorderBasis);
  row("transport_to_border", r.transportToBorderNok === null ? "unknown" : tb.assumed ? "assumed" : "known", r.transportToBorderNok, r.transportToBorderNok === null ? "unresolved" : tb.basis, true);
  const metaRow = (id: RowId, m: CostMeta["insurance"], n: bigint | null) => {
    if (n === null || m.kind === "unknown") return row(id, "unknown", null, "unresolved", true);
    if (m.kind === "excluded_by_scenario") return row(id, "excluded_by_scenario", n, "assumed", true);
    if (m.kind === "not_applicable") return row(id, "not_applicable", n, "stated_input", true);
    const b = basisOfAmount(m.basis);
    return row(id, b.assumed ? "assumed" : "known", n, b.basis, true);
  };
  metaRow("transport_after_border", r.costMeta.transportAfterBorder, r.transportAfterBorderNok);
  metaRow("insurance", r.costMeta.insurance, r.insuranceNok);
  metaRow("loading_handling", r.costMeta.loadingHandling, r.loadingHandlingNok);
  // klimagassavgift og registreringsgebyr: beløp kommer som egne rader fra komponentlisten under; scenarioekskludering, ikke relevant og ukjent får egen tilstand (aldri «kjent»)
  for (const [id, m] of [["climate_gas", r.costMeta.climateGas], ["registration_fee", r.costMeta.registrationFee]] as const) {
    if (m.kind !== "amount") metaRow(id, m, m.kind === "unknown" ? null : 0n);
  }
  // mva.
  const iv = r.importVat;
  row("import_vat", iv.status === "calculated" ? "known" : iv.status === "lower_bound" ? "lower_bound" : "unknown", iv.valueNok, iv.valueNok === null ? "unresolved" : "computed", true);
  // engangsavgift og vrakpant (avgiftsmotor; estimat så lenge profilen ikke er godkjent)
  const taxBasis: BasisKey = r.tax.status === "approved" ? "computed" : "engine_estimate";
  row("one_off_tax", r.tax.oneOffTaxNok === null ? "unknown" : "known", r.tax.oneOffTaxNok, r.tax.oneOffTaxNok === null ? "unresolved" : taxBasis, true);
  row("scrappage_deposit", r.tax.scrappageDepositNok === null ? "unknown" : "known", r.tax.scrappageDepositNok, r.tax.scrappageDepositNok === null ? "unresolved" : taxBasis, true);
  // øvrige kjente kostnader: egne rader fra kjernens komponentliste (uavhengig av om totalen er verdi, nedre grense eller scenarier). Ukjente poster rekonstrueres ikke.
  const itemised = r.costMeta.otherItems;
  for (const it of itemised) {
    const b = basisOfAmount(it.basis);
    const x: BreakdownRow = { id: it.id === "customs_duty" ? "customs_duty" : it.id, state: b.assumed ? "assumed" : "known", amountNok: it.amount, basis: b.basis, inGrossOutlay: true };
    if (it.label) x.label = it.label;
    rows.push(x);
  }
  // Avrundingsdifferanse: kjernen avrunder summen av øvrige kostnader én gang; differansen mot de eksakte postene vises (ren aritmetikk, aldri en ny regel).
  if (r.costMeta.othersNok !== null && itemised.length > 0) {
    const diff = minorDiff(r.costMeta.othersNok, itemised.map((i) => i.amount));
    if (diff !== null && diff !== "0") rows.push({ id: "other_rounding", state: "known", amountNok: diff, basis: "computed", inGrossOutlay: true });
  }

  // beregningsgrunnlag (summeres ikke)
  row("customs_value", r.customsValueNok === null ? "unknown" : "known", r.customsValueNok, r.customsValueNok === null ? "unresolved" : "computed", false);
  const cd = r.customsDuty;
  if (!itemised.some((i) => i.id === "customs_duty")) {
    const dm = r.costMeta.customsDuty;
    row("customs_duty", dm?.kind === "excluded_by_scenario" ? "excluded_by_scenario" : cd.basis === "unknown" ? "unknown" : cd.basis === "stated_not_applicable" ? "not_applicable" : "known", cd.nok, dm?.kind === "excluded_by_scenario" ? "assumed" : cd.basis === "ordinary_rate_tariff_2026" ? "ordinary_rate_unapproved" : cd.basis === "unknown" ? "unresolved" : "stated_input", false);
  }
  row("import_vat_base", r.importVatBaseNok === null ? "unknown" : iv.status === "lower_bound" ? "lower_bound" : "known", r.importVatBaseNok, r.importVatBaseNok === null ? "unresolved" : "computed", false);

  // søkets kostnadslinjer (behandlet av 005a)
  const lines = a.outcome?.lines ?? [];
  const counted = lines.filter((l) => l.counted && l.amountMinor !== null).reduce((t, l) => t + (l.amountMinor as bigint), 0n);
  const searchCosts = {
    rows: lines.map((l) => ({ id: l.id, label: l.label, treatment: l.treatment, counted: l.counted, amountNok: l.amountMinor === null ? null : minorToNok(l.amountMinor) })),
    countedNok: minorToNok(counted),
    uncountedLines: lines.filter((l) => l.treatment === "unknown_amount" || l.treatment === "unsupported" || (l.treatment === "unmapped_unknown_scope" && !l.counted)).length,
  };

  // forutsetninger
  const fxOf = (role: "acquisition" | "customs"): FxAssumption | null => {
    const f = r.fx[role];
    if (f.status === "not_needed") return null;
    const kind = f.source?.kind;
    return {
      role, status: f.status, pair: f.pair, rate: f.rate, sourceKind: kind === "official_customs" || kind === "bank" || kind === "dealer_entered" || kind === "fixture" ? kind : "none",
      sourceLabel: f.source?.ref ?? null, effectiveAt: f.effectiveAt, quotedAt: f.quotedAt, validFrom: f.validFrom, validTo: f.validTo,
    };
  };
  const assumptions: Assumptions = {
    fx: [fxOf("acquisition"), fxOf("customs")].filter((x): x is FxAssumption => x !== null),
    customsAcceptance: { date: r.dates.customsAcceptance.date, kind: r.dates.customsAcceptance.kind },
    norwegianRegistration: { date: r.dates.norwegianRegistration.date, kind: r.dates.norwegianRegistration.kind, defaulted: a.notes.includes("norwegian_registration_defaulted_to_as_of") },
    vatRecoverability: { value: r.vatRecoverability.accepted ? r.vatRecoverability.value : "unknown", source: r.vatRecoverability.accepted ? r.vatRecoverability.source?.kind ?? null : null },
    vatHandling: { value: r.importVatSettlement.handling.accepted ? r.importVatSettlement.handling.value : "unknown", source: r.importVatSettlement.handling.accepted ? r.importVatSettlement.handling.source?.kind ?? null : null },
    rulesApprovedForValidation: r.status === "validated",
  };

  // usikkerhet (gruppert) og mangler (som inputfelt)
  const landedMissing = r.estimatedLandedCost.kind === "lower_bound" ? r.estimatedLandedCost.missing : [];
  const cashMissing = r.importCashRequirement.kind === "lower_bound" ? r.importCashRequirement.missing : [];
  const incomplete = [...new Set([...r.incompleteReasons, ...landedMissing, ...cashMissing])];
  const uncertainty: UncertaintyItem[] = [
    ...r.estimateReasons.map((code) => ({ category: uncertaintyCategory(code, "estimate"), code })),
    ...incomplete.map((code) => ({ category: uncertaintyCategory(code, "incomplete"), code })),
    ...a.notes.map((code) => ({ category: uncertaintyCategory(code, "note"), code })),
  ];
  const seen = new Set<string>();
  const uncertaintyUnique = uncertainty.filter((x) => (seen.has(`${x.category}:${x.code}`) ? false : (seen.add(`${x.category}:${x.code}`), true)));

  const fields = new Map<FormFieldKey, MissingField>();
  for (const code of [...incomplete, ...r.tax.blockers, ...r.blockers.map((b) => b.code)]) {
    const f = fieldOfCode(code);
    if (f) fields.set(f, { field: f, collectable: !NOT_COLLECTABLE.has(f) });
  }
  if (!r.acquisition.purchaseBasisResolved) fields.set("listing_price_basis", { field: "listing_price_basis", collectable: false });

  // dokumentasjonsdekning (konkret telling; ingen vurdering av riktighet)
  const COST_ITEMS = new Set<RowId>(["purchase", "transport_to_border", "transport_after_border", "insurance", "loading_handling", "climate_gas", "registration_fee", "import_levy", "other_known", "commission_separate", "payment_cost", "customs_duty"]);
  const known = rows.filter((x) => COST_ITEMS.has(x.id) && x.state === "known");
  const documented = known.filter((x) => x.basis === "document").length;
  const basisSummary: BasisSummaryKey = documented > 0 ? "partly_documented" : known.some((x) => x.id === "purchase" && x.basis === "listing_claim") && !known.some((x) => x.basis === "dealer_entered") ? "listing_claim_only" : "dealer_stated";

  return {
    breakdown: rows, searchCosts, assumptions, uncertainty: uncertaintyUnique, missing: [...fields.values()],
    coverage: { documented, knownCostItems: known.length }, basisSummary, grossOutlayIsNotCashAtBorder: true,
  };
}

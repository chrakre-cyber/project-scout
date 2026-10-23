/**
 * ECON-003-2: forhandlervennlig sammendrag av anslått innkjøpskostnad til Norge (ren presentasjonsmodell).
 *
 * Dette er en AVLEDNING av den eksisterende `EconomicsView` (som allerede har passert rettighetsgrensen). Den beregner ingen avgift, mva. eller kurs og kaller aldri økonomikjernen:
 * den velger og navngir bare det motoren allerede har regnet ut, og summerer til sammen ikke mer enn motorens egne rader (addisjon av engangsavgift og vrakpant, transport til/etter grensen,
 * øvrige poster). Komponenter får bare denne modellen — ingen beregning i JSX.
 *
 * Regler (fail-closed og aldri falsk presisjon):
 *  - `hidden`: rettighet ikke gitt ⇒ ingen tall, ingen årsaker.
 *  - Scenarier (uavklart elbilfritak): motorens egne scenariototaler vises som område, aldri som ett tall; mva.-linjen er «ikke beregnet» fordi den er ulik per scenario.
 *  - Totalen er motorens brutto utlegg (`cash`): kjøpesum + avgifter + import-mva. + oppgitte kostnader — uavhengig av fradragsrett. Alt er et estimat.
 *  - En nedre grense vises bare som «delsum» når den er > 0 OG kjøpesum og engangsavgift er kjent (en delsum uten dem er misvisende), og aldri som total.
 *    Ukjent er aldri 0: en post uten kjent beløp har `amountNok: null` og vises ikke som tall.
 *  - Transport vises bare når den faktisk er oppgitt (kjent eller uttrykkelig antatt) — aldri som standardbeløp.
 *  - Anskaffelses- og tollkurs holdes adskilt (to roller), aldri slått sammen.
 */
import type { EconomicsView } from "./view";
import type { BreakdownRow, FormFieldKey, FxAssumption } from "./explain";

export type SummaryLineId = "purchase" | "registration_tax" | "vat" | "transport" | "other";
export type SummaryLineState = "known" | "assumed" | "unknown";
export interface SummaryLine {
  id: SummaryLineId;
  /** NOK som desimalstreng; `null` = ukjent (aldri 0). */
  amountNok: string | null;
  state: SummaryLineState;
  /** Kjøpesum i kildevaluta (f.eks. EUR) når den ikke er NOK. */
  original?: { amount: string; currency: string };
}
export interface SummaryFx { role: FxAssumption["role"]; pair: string | null; rate: string | null; sourceKind: FxAssumption["sourceKind"]; status: FxAssumption["status"] }

export interface SummaryScenario { id: string; /** Motorens egen etikett (f.eks. «uten elbilfritak»). */ label: string; amountNok: string }
/** Notekode som merker at beregningen bruker de syntetiske demoforutsetningene for den kuraterte demoen (aldri satt for ekte eller leverandørbaserte resultater). */
export const DEMO_INPUTS_NOTE = "demo_economics_inputs";
/** Kjernens kode for akseptdato utenfor den dokumenterte avgiftsperioden (kun gjenkjenning; ingen regel er endret). */
const TAX_PERIOD_CODE = "customs_acceptance_date_outside_documented_period";
type Computed = { lines: SummaryLine[]; fx: SummaryFx[]; missing: FormFieldKey[]; priceFromListingClaim: boolean; /** Syntetiske demoforutsetninger er brukt (vises som «Demo-estimat»). */ demoInputs: boolean };

export type AcquisitionSummary =
  | { state: "hidden" }
  | {
      state: "unavailable";
      reasons: string[];
      missing: FormFieldKey[];
      /** PILOT-004A: `tax_period` = akseptdatoen ligger utenfor avgiftsgrunnlagets dokumenterte periode (ingen registrert opplysning retter det). */
      cause?: "tax_period";
    }
  | ({
      state: "estimate" | "partial";
      /** `estimate`: motorens samlede brutto utlegg. `partial`: ufullstendig delsum (> 0) — aldri en total. */
      amountNok: string;
    } & Computed)
  | ({
      /** Motoren gir to eller flere totaler fordi ett forhold er uavklart (f.eks. elbilfritak). Vises som område med hver scenariototal, sortert stigende; aldri som ett tall. */
      state: "scenarios";
      scenarios: SummaryScenario[];
    } & Computed);

const GROSS_OUTLAY_OTHER_EXCLUDED = new Set<BreakdownRow["id"]>(["purchase", "one_off_tax", "scrappage_deposit", "import_vat", "transport_to_border", "transport_after_border"]);
/** Rekkefølge på manglende opplysninger: bilens tekniske data og kurs først (størst effekt), deretter datoer og tillegg. */
const MISSING_ORDER: readonly FormFieldKey[] = [
  "propulsion", "tax_weight", "co2", "first_registration", "norwegian_registration", "fx_acquisition", "fx_customs", "customs_date", "foreign_vat",
  "transport_to_border", "transport_after_border", "insurance", "loading_handling", "vat_handling", "deduction",
];
const rank = (f: FormFieldKey): number => { const i = MISSING_ORDER.indexOf(f); return i === -1 ? MISSING_ORDER.length : i; };
const byPriority = (fields: readonly FormFieldKey[]): FormFieldKey[] => [...fields].sort((a, b) => rank(a) - rank(b));
const isCounted = (r: BreakdownRow): boolean => r.amountNok !== null && (r.state === "known" || r.state === "assumed" || r.state === "not_applicable" || r.state === "excluded_by_scenario");

/** Eksakt addisjon av desimalstrenger i NOK (BigInt på felles skala; ingen flyttall, ingen avrunding). `null` hvis noen er ugyldige. */
export function addNok(parts: readonly string[]): string | null {
  const scale = Math.max(0, ...parts.map((p) => (p.includes(".") ? p.length - p.indexOf(".") - 1 : 0)));
  if (scale > 12) return null;
  const unit = 10n ** BigInt(scale);
  let sum = 0n;
  for (const p of parts) {
    const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(p);
    if (!m) return null;
    const v = BigInt(m[2]!) * unit + BigInt((m[3] ?? "").padEnd(scale, "0") || "0");
    sum += m[1] === "-" ? -v : v;
  }
  const neg = sum < 0n, abs = neg ? -sum : sum;
  const frac = (abs % unit).toString().padStart(scale, "0").replace(/0+$/, "");
  return `${neg ? "-" : ""}${abs / unit}${frac ? `.${frac}` : ""}`;
}

const isZero = (nok: string): boolean => /^-?0+(\.0+)?$/.test(nok);
const stateOf = (rows: readonly BreakdownRow[]): SummaryLineState => (rows.some((r) => r.state === "assumed") ? "assumed" : "known");

export function toAcquisitionSummary(view: EconomicsView): AcquisitionSummary {
  if (view.status === "unavailable") return { state: "hidden" };
  const x = view.explanation;
  // Fradragsstatus og mva.-håndtering påvirker ikke totalen (brutto utlegg), bare den separate økonomiske kostnaden i detaljforklaringen: de er ikke «mangler» for dette sammendraget.
  const NOT_TOTAL_FIELDS: readonly FormFieldKey[] = ["deduction", "vat_handling"];
  const collectable = byPriority((x?.missing ?? []).filter((m) => m.collectable && !NOT_TOTAL_FIELDS.includes(m.field)).map((m) => m.field));
  const taxPeriod = x?.uncertainty.some((u) => u.code === TAX_PERIOD_CODE) === true;
  if (view.status === "not_calculated") return { state: "unavailable", reasons: [...view.reasons], missing: collectable, ...(taxPeriod ? { cause: "tax_period" as const } : {}) };

  const cash = view.cash;
  // Total: bare motorens brutto utlegg. Nedre grense bare som delsum > 0; scenarier som område; ellers ingen tall.
  let amountNok: string | null = null;
  let scenarios: SummaryScenario[] = [];
  let state: "estimate" | "partial" | "scenarios" = "estimate";
  if (cash.kind === "value") amountNok = cash.nok;
  else if (cash.kind === "lower_bound" && !isZero(cash.minimumNok)) { amountNok = cash.minimumNok; state = "partial"; }
  else if (cash.kind === "scenarios" && cash.scenarios.length >= 2 && cash.scenarios.every((c) => /^\d+$/.test(c.nok))) {
    scenarios = cash.scenarios.map((c) => ({ id: c.id, label: c.label, amountNok: c.nok })).sort((a, b) => (BigInt(a.amountNok) < BigInt(b.amountNok) ? -1 : BigInt(a.amountNok) > BigInt(b.amountNok) ? 1 : 0));
    state = "scenarios";
  }
  if ((amountNok === null && state !== "scenarios") || x === null) return { state: "unavailable", reasons: cash.kind === "none" ? [...cash.reasons] : [...view.incompleteReasons], missing: collectable, ...(taxPeriod ? { cause: "tax_period" as const } : {}) };

  const row = (id: BreakdownRow["id"]) => x.breakdown.find((r) => r.id === id);
  const lines: SummaryLine[] = [];

  const purchase = row("purchase");
  const purchaseKnown = purchase !== undefined && purchase.state === "known" && purchase.amountNok !== null;
  const tax = [row("one_off_tax"), row("scrappage_deposit")];
  const taxKnown = tax.every((r) => r !== undefined && r.state === "known" && r.amountNok !== null);
  // Ingen delsum uten kjent kjøpesum OG kjent engangsavgift: uten dem ville tallet se ut som en (liten) total, og engangsavgiften er ofte den største posten.
  if ((state === "partial" || state === "scenarios") && !(purchaseKnown && taxKnown)) return { state: "unavailable", reasons: [...view.incompleteReasons], missing: collectable };

  if (purchase) lines.push({ id: "purchase", amountNok: purchaseKnown ? purchase.amountNok : null, state: purchaseKnown ? "known" : "unknown", ...(purchase.original ? { original: purchase.original } : {}) });
  lines.push({ id: "registration_tax", amountNok: taxKnown ? addNok(tax.map((r) => r!.amountNok!)) : null, state: taxKnown ? "known" : "unknown" });

  const vat = row("import_vat");
  lines.push({ id: "vat", amountNok: vat && vat.state === "known" ? vat.amountNok : null, state: vat && vat.state === "known" ? "known" : "unknown" });

  // Transport: bare når oppgitt (kjent eller uttrykkelig antatt). Ukjent/ikke relevant/scenarioekskludert gir ingen linje (og ingen 0).
  const transport = [row("transport_to_border"), row("transport_after_border")].filter((r): r is BreakdownRow => r !== undefined && (r.state === "known" || r.state === "assumed") && r.amountNok !== null);
  if (transport.length > 0) lines.push({ id: "transport", amountNok: addNok(transport.map((r) => r.amountNok!)), state: stateOf(transport) });

  // Øvrige poster som inngår i brutto utlegg (forsikring, lasting, gebyrer, avgifter ved innførsel, avrundingsdifferanse …): vises bare når de er kjente og ikke 0.
  const others = x.breakdown.filter((r) => r.inGrossOutlay && !GROSS_OUTLAY_OTHER_EXCLUDED.has(r.id) && isCounted(r));
  const othersSum = others.length > 0 ? addNok(others.map((r) => r.amountNok!)) : null;
  if (othersSum !== null && !isZero(othersSum)) lines.push({ id: "other", amountNok: othersSum, state: stateOf(others) });

  const fx: SummaryFx[] = x.assumptions.fx.map((f) => ({ role: f.role, pair: f.pair, rate: f.rate, sourceKind: f.sourceKind, status: f.status }));
  const rest: Computed = { lines, fx, missing: collectable, priceFromListingClaim: x.basisSummary === "listing_claim_only", demoInputs: view.notes.includes(DEMO_INPUTS_NOTE) };
  return state === "scenarios" ? { state, scenarios, ...rest } : { state, amountNok: amountNok!, ...rest };
}

/** Viser sammendraget et kronebeløp (estimat, delsum eller scenarioområde)? Brukes til å velge budsjettnotisen slik at den aldri motsier et beløp som vises. */
export const summaryShowsAmount = (s: AcquisitionSummary): boolean => s.state === "estimate" || s.state === "partial" || s.state === "scenarios";

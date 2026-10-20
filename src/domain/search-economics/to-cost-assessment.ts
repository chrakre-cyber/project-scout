/**
 * ECON-005a: `EconomicsResult` → `CostAssessment` (ren). Positiv budsjettstatus kan bare oppstå via `complete_validated`, som bare gis når økonomikjernen er `validated`
 * (uoppnåelig med registerprofilen), kontantbehovet er en entydig verdi, alle inkluderte kostnadslinjer er fullt behandlet og vurderingen ikke er foreldet.
 * Alt annet gir `unvalidated`, `incomplete` eller ingen vurdering (`null` ⇒ `classifyBudget` = `no_assessment`).
 */
import type { EconomicsResult, Total } from "@/domain/economics";
import { DOCUMENTED_RULE_PERIOD } from "@/domain/economics/validity";
import { costBasisOf, parseUtcInstant } from "@/domain/search-v2/budget";
import { BUDGET_BASIS } from "@/domain/search-v2/types";
import type { CandidateRef, CostAssessment, SearchSpec } from "@/domain/search-v2/types";
import { isResolved, treatCostLines } from "./cost-lines";
import type { CostLineTreatment, LineScope, MappingOutcome, ValidityLimit } from "./types";

const ORE_PER_NOK = 100n;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
/** Teknisk tak (ikke en regel): en vurdering gjelder høyst 24 timer. */
export const MAX_ASSESSMENT_AGE_MS = 24 * HOUR_MS;

export interface MapperInput {
  result: EconomicsResult;
  spec: SearchSpec;
  candidate: CandidateRef;
  /** UTC ISO 8601; injiseres (domenet leser ikke klokken). */
  now: string;
  /** Sporbar referanse: avgiftsprofil-id@versjon + økonomiprofilens identitet. Må være ikke-tom. */
  profileRef: string;
  /** Rettighetsprofilens `validUntil` (eksklusiv); `null` = profilen har ingen slutt. Obligatorisk, så den ikke kan glemmes. */
  rightsLimit: ValidityLimit;
  /** Kildedataenes utløp (`retrievedAt` + cache/retensjon); `null` = ingen grense. Obligatorisk. */
  sourceDataLimit: ValidityLimit;
  /** Øvrige grenser: avgiftsprofil, anskaffelseskursens `validUntil`, forhandlerbekreftelsenes utløp m.m. */
  extraLimits?: readonly ValidityLimit[];
  lineScopes?: Readonly<Record<string, LineScope>>;
}

const nok = (t: Total): bigint | null => (t.kind === "value" ? t.valueNok : t.kind === "lower_bound" ? t.lowerBoundNok : t.kind === "scenarios" ? t.scenarios.reduce((m, s) => (s.valueNok < m ? s.valueNok : m), t.scenarios[0]!.valueNok) : null);
const isoAt = (ms: number): string => new Date(ms).toISOString();
/** Dato (YYYY-MM-DD) → UTC-start av neste døgn (eksklusiv slutt for en inklusiv sluttdato). */
const dayAfter = (dateIso: string): number | null => {
  const ms = parseUtcInstant(`${dateIso}T00:00:00Z`);
  return ms === null ? null : ms + DAY_MS;
};

/**
 * Plan P3: `validUntil` er minimum av alle gyldighetsgrenser, aldri lengre enn noen av dem: teknisk tak (now + 24 t), rettighetsprofil, kildedata, beregningsprofilens dokumenterte
 * periode (eksklusiv slutt), tollkursens `validTo` (inklusiv ⇒ +1 døgn) og eventuelle øvrige grenser. Ugyldig/uleselig grense ⇒ `null` (ikke «ingen grense»).
 */
export function computeValidUntil(input: Pick<MapperInput, "result" | "now" | "rightsLimit" | "sourceDataLimit" | "extraLimits">): { validUntil: string | null; binding: string | null; invalid: string[] } {
  const nowMs = parseUtcInstant(input.now);
  if (nowMs === null) return { validUntil: null, binding: null, invalid: ["now"] };
  const candidates: Array<{ label: string; ms: number }> = [{ label: "technical_cap_24h", ms: nowMs + MAX_ASSESSMENT_AGE_MS }];
  const invalid: string[] = [];
  const periodEnd = dayAfter(DOCUMENTED_RULE_PERIOD.toIso);
  if (periodEnd !== null) candidates.push({ label: "documented_rule_period", ms: periodEnd });
  const fxTo = input.result.fx.customs.validTo;
  if (fxTo !== null && fxTo !== undefined) {
    const ms = dayAfter(fxTo);
    if (ms === null) invalid.push("customs_fx_validTo"); else candidates.push({ label: "customs_fx_validTo", ms });
  }
  for (const l of [input.rightsLimit, input.sourceDataLimit, ...(input.extraLimits ?? [])]) {
    if (l.untilExclusive === null) continue;
    const ms = parseUtcInstant(l.untilExclusive);
    if (ms === null) invalid.push(l.label); else candidates.push({ label: l.label, ms });
  }
  if (invalid.length) return { validUntil: null, binding: null, invalid };
  const min = candidates.reduce((m, c) => (c.ms < m.ms ? c : m), candidates[0]!);
  return { validUntil: isoAt(min.ms), binding: min.label, invalid };
}

const none = (cls: MappingOutcome["class"], lines: CostLineTreatment[], reasons: string[], validUntil: string | null = null, binding: string | null = null): MappingOutcome =>
  ({ class: cls, assessment: null, lines, reasons, validUntil, bindingLimit: binding });

export function toCostAssessment(input: MapperInput): MappingOutcome {
  const { result, spec, candidate } = input;
  const lines = treatCostLines(spec, result, input.lineScopes);
  const reasons: string[] = [];
  if (typeof input.profileRef !== "string" || input.profileRef.trim() === "") return none("not_calculated", lines, ["profile_ref_missing"]);
  if (candidate.id === "" || candidate.version === "") return none("not_calculated", lines, ["candidate_ref_missing"]);

  const scenario = spec.plannedRegistration.requested;
  if (scenario === "unspecified") return none("not_calculated", lines, ["scenario_unspecified"]);
  if (scenario !== "passenger") return none("not_calculated", lines, ["scenario_not_supported_by_economics"]); // varebil er ikke støttet av økonomikjernen
  if (result.status === "blocked") return none("not_calculated", lines, ["economics_blocked", ...result.blockers.map((b) => b.code)]);
  if (result.importCashRequirement.kind === "not_calculated") return none("not_calculated", lines, ["cash_requirement_not_calculated", ...result.importCashRequirement.reasons]);

  const v = computeValidUntil(input);
  if (v.validUntil === null) return none("not_calculated", lines, [`validity_limit_invalid:${v.invalid.join(",")}`]);
  const nowMs = parseUtcInstant(input.now)!;
  if (nowMs >= parseUtcInstant(v.validUntil)!) return none("stale", lines, [`validity_exhausted:${v.binding}`], v.validUntil, v.binding);

  const cash = result.importCashRequirement;
  const cashNok = nok(cash)!;
  const counted = lines.filter((l) => l.counted).reduce((s, l) => s + (l.amountMinor ?? 0n), 0n);
  const totalMinor = cashNok * ORE_PER_NOK + counted;

  const unresolved = lines.filter((l) => !isResolved(l));
  for (const l of unresolved) reasons.push(`cost_line_${l.treatment}:${l.id}:${l.reason ?? ""}`);
  if (result.status !== "validated") reasons.push(`economics_${result.status}`);
  if (cash.kind !== "value") reasons.push(`cash_requirement_${cash.kind}`);

  let status: CostAssessment["status"];
  let cls: MappingOutcome["class"];
  if (result.status === "validated" && cash.kind === "value" && unresolved.length === 0) { status = "complete_validated"; cls = "complete_validated"; }
  else if (result.status === "estimate" && cash.kind === "value" && unresolved.length === 0) { status = "unvalidated"; cls = "unvalidated"; }
  else { status = "incomplete"; cls = "incomplete"; }

  const assessment: CostAssessment = {
    totalMinor, currency: "NOK", basis: BUDGET_BASIS, registrationScenario: scenario, status, profileRef: input.profileRef,
    validUntil: v.validUntil, coveredCostLineIds: lines.filter((l) => l.treatment === "mapped_to_input" || l.treatment === "added_to_total").map((l) => l.id),
    candidateId: candidate.id, candidateVersion: candidate.version, costBasis: costBasisOf(spec),
  };
  return { class: cls, assessment, lines, reasons, validUntil: v.validUntil, bindingLimit: v.binding };
}

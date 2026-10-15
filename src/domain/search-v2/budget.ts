/**
 * Budsjettgrenser og klassifisering — UTEN avgiftsmotor.
 *
 * Her beregnes bare budsjettets øvre grense (eksakte heltall i øre/basispunkter, brøkøre rundes ned),
 * og en ferdig, forhåndsvurdert kandidatkostnad fra et fremtidig beregningslag klassifiseres mot grensen.
 * Ingen mva., engangsavgift, fradragsrett, FX eller verdsetting finnes her (IMPORT_ENGINE_SPEC, TAX-001/002).
 *
 * Invarianter:
 *  - Kostnadslinjer er forutsetninger og endrer aldri budsjett eller øvre grense.
 *  - Valg av registreringsscenario (varebil) endrer aldri en total eller gir noen avgiftsfordel; scenarioet
 *    brukes bare til å kreve at vurderingen gjelder samme scenario som søket.
 *  - Ingen positiv budsjettstatus uten en uttrykkelig fullstendig og validert vurdering i NOK, samme basis,
 *    samme scenario og ikke foreldet. Alt annet gir `not_calculated` med grunn.
 *  - Prisstatus opphever aldri excluded/needs_review fra bilkrav (se combineAssessment).
 */
import { BUDGET_BASIS } from "./types";
import type {
  BudgetClassification, BudgetSpec, CandidateAssessment, CostAssessment, NotCalculatedReason, SearchSpec, VehicleEvaluation,
} from "./types";

const BP_DENOMINATOR = 10_000n;

/** Øvre grense = budsjett × (10 000 + avvik i bp) / 10 000, brøkøre rundet ned. Avslått avvik → budsjettet. */
export function upperLimitMinor(budget: BudgetSpec): bigint | null {
  if (budget.maxTotalNokMinor === null) return null;
  if (budget.deviationBasisPoints === null) return budget.maxTotalNokMinor;
  return (budget.maxTotalNokMinor * (BP_DENOMINATOR + BigInt(budget.deviationBasisPoints))) / BP_DENOMINATOR; // BigInt-divisjon avrunder mot 0 (= ned for positive tall)
}

function daysInMonth(y: number, m: number): number {
  if (m === 2) return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28;
  return [4, 6, 9, 11].includes(m) ? 30 : 31;
}

/** Streng UTC ISO 8601 («2026-10-15T12:00:00Z», valgfrie sekunddeler). Ugyldig kalenderdato → null. */
export function parseUtcInstant(s: unknown): number | null {
  if (typeof s !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z$/.exec(s);
  if (!m) return null;
  const [y, mo, d, h, mi, se] = m.slice(1, 7).map(Number) as [number, number, number, number, number, number];
  if (mo < 1 || mo > 12 || d < 1 || d > daysInMonth(y, mo) || h > 23 || mi > 59 || se > 59) return null;
  const ms = m[7] ? Number(m[7].padEnd(3, "0")) : 0;
  return Date.UTC(y, mo - 1, d, h, mi, se, ms);
}

const notCalculated = (reason: NotCalculatedReason, budget: bigint | null, upper: bigint | null): BudgetClassification => ({ status: "not_calculated", reason, budgetMinor: budget, upperLimitMinor: upper });

/**
 * @param now  Nåtidspunkt som UTC ISO 8601 — injiseres (domenet leser ikke klokken).
 */
export function classifyBudget(spec: SearchSpec, assessment: CostAssessment | null | undefined, now: string): BudgetClassification {
  const budget = spec.budget.maxTotalNokMinor;
  const upper = upperLimitMinor(spec.budget);
  const fail = (reason: NotCalculatedReason) => notCalculated(reason, budget, upper);

  if (budget === null || upper === null) return fail("no_budget");
  if (assessment === null || assessment === undefined) return fail("no_assessment");

  const a = assessment as unknown as Record<string, unknown>;
  const nowMs = parseUtcInstant(now);
  const validUntilMs = parseUtcInstant(a.validUntil);
  if (
    typeof a.totalMinor !== "bigint" || a.totalMinor < 0n || typeof a.currency !== "string" || typeof a.basis !== "string" ||
    typeof a.profileRef !== "string" || a.profileRef.trim() === "" || validUntilMs === null || nowMs === null ||
    !Array.isArray(a.coveredCostLineIds) || a.coveredCostLineIds.some((x) => typeof x !== "string") ||
    (a.registrationScenario !== "passenger" && a.registrationScenario !== "van") ||
    (a.status !== "complete_validated" && a.status !== "incomplete" && a.status !== "unvalidated")
  ) return fail("assessment_invalid");

  if (a.status === "unvalidated") return fail("assessment_not_validated");
  if (a.status === "incomplete") return fail("assessment_incomplete");
  if (a.currency !== "NOK") return fail("currency_not_nok");
  if (a.basis !== BUDGET_BASIS) return fail("basis_mismatch");
  const wanted = spec.plannedRegistration.requested;
  if (wanted === "unspecified") return fail("scenario_unspecified");
  if (wanted !== a.registrationScenario) return fail("scenario_mismatch");
  if (nowMs >= validUntilMs) return fail("assessment_stale");

  const covered = new Set(a.coveredCostLineIds as string[]);
  for (const c of spec.budget.costs) {
    if (!c.includedInBudget) continue;
    if (c.amountMinor === null) return fail("included_cost_unknown");
    if (!covered.has(c.id)) return fail("included_cost_not_covered");
  }

  const total = a.totalMinor;
  const status = total <= budget ? "within_budget" : total <= upper ? "within_deviation" : "over_limit";
  return { status, reason: null, budgetMinor: budget, upperLimitMinor: upper };
}

/**
 * Samler kjøretøyvurdering og budsjettklassifisering uten at det ene kan overstyre det andre:
 * pris kan aldri gjøre en `excluded`/`needs_review` bil til treff.
 */
export function combineAssessment(vehicle: VehicleEvaluation, budget: BudgetClassification): CandidateAssessment {
  return {
    vehicle,
    budget,
    isFullHit: vehicle.status === "match" && (budget.status === "within_budget" || budget.status === "within_deviation"),
  };
}

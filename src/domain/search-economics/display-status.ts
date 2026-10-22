/**
 * ECON-005a: visningsstatus for økonomi (ren). Rettighetene kommer inn som ferdige booleans (005b bygger oppslaget); uten avledet bruk og visningsrett er økonomi `unavailable`
 * (ikke 0 og ikke skjult). Bare `validated` kan være positiv-berettiget; estimat, nedre grense, scenarier og ukjent er det aldri.
 */
import type { EconomicsResult, Total } from "@/domain/economics";
import type { DisplayTotal, EconomicsDisplayStatus, MappingOutcome } from "./types";

export interface DisplayRights { canDerive: boolean; canDisplay: boolean }

const total = (t: Total): DisplayTotal => {
  switch (t.kind) {
    case "value": return { kind: "value", valueNok: t.valueNok };
    case "lower_bound": return { kind: "lower_bound", minimumNok: t.lowerBoundNok, missing: [...t.missing] };
    case "scenarios": return { kind: "scenarios", scenarios: t.scenarios.map((s) => ({ id: s.id, label: s.label, valueNok: s.valueNok })) };
    case "not_calculated": return { kind: "not_calculated", reasons: [...t.reasons] };
  }
};
const notCalc = (reasons: string[]): DisplayTotal => ({ kind: "not_calculated", reasons });

export function toEconomicsDisplayStatus(input: { result: EconomicsResult | null; outcome: MappingOutcome | null; rights: DisplayRights }): EconomicsDisplayStatus {
  if (input.rights.canDerive !== true || input.rights.canDisplay !== true) return { overall: "unavailable", reason: "rights_not_granted", labelKey: "rights_not_granted", positiveBudgetEligible: false };
  const { result, outcome } = input;
  if (result === null || outcome === null) {
    return { overall: "not_calculated", labelKey: "not_calculated", cash: notCalc(["no_result"]), landed: notCalc(["no_result"]), estimateReasons: [], incompleteReasons: [], reasons: ["no_result"], lines: outcome?.lines ?? [], positiveBudgetEligible: false };
  }
  const overall = outcome.class === "complete_validated" ? "validated" : outcome.class === "unvalidated" ? "estimate" : outcome.class === "incomplete" ? "incomplete" : "not_calculated";
  // En ikke-beregnet (null) vurdering kan aldri vise tall som om de var beregnet for budsjett: totalene følger likevel økonomikjernens egen merking (verdi/nedre grense/scenarier).
  const cash = outcome.class === "not_calculated" || outcome.class === "stale" ? notCalc(outcome.reasons) : total(result.importCashRequirement);
  const landed = outcome.class === "not_calculated" || outcome.class === "stale" ? notCalc(outcome.reasons) : total(result.estimatedLandedCost);
  const labelKey = overall === "validated" ? "validated" : overall === "estimate" ? "estimate_not_validated" : overall === "incomplete" ? "incomplete_lower_bound" : "not_calculated";
  return {
    overall, labelKey, cash, landed, estimateReasons: [...result.estimateReasons], incompleteReasons: [...result.incompleteReasons], reasons: [...outcome.reasons], lines: outcome.lines,
    positiveBudgetEligible: overall === "validated",
  };
}

/**
 * ECON-005d: visningsmodell for økonomi (ren). Det eneste UI får se av økonomien: ferdige statuser, beløp som desimalstrenger (hele NOK), faste etikettnøkler og koder for
 * forutsetninger. Aldri `EconomicsResult`, kjernens interne felt, annonseverdier, forhandlerinput eller bigint. Tekstene eies av `search-labels`; modellen bærer bare nøkler og koder.
 *
 * Produktregel: bare `validated` kan være positiv-berettiget (uoppnåelig med registerprofilen). Estimat, nedre grense, scenarier, ufullstendig og ikke-beregnet er alltid false.
 */
import type { EconomicsDisplayStatus, InputStatus } from "@/domain/search-economics";
import type { CostLineTreatment } from "./types";

export type EconomicsLabelKey = "validated" | "estimate_not_validated" | "incomplete_lower_bound" | "scenarios" | "not_calculated" | "rights_not_granted";
export type EconomicsViewStatus = "estimate" | "lower_bound" | "scenarios" | "validated" | "not_calculated" | "unavailable";

export type ViewAmount =
  | { kind: "value"; nok: string }
  | { kind: "lower_bound"; minimumNok: string; missing: string[] }
  | { kind: "scenarios"; scenarios: Array<{ id: string; label: string; nok: string }> }
  | { kind: "none"; reasons: string[] };

/** Status på forhandleropplysningene uten å avsløre innhold: ingen / må bekreftes på nytt (med årsaker) / brukt. Fremmed input vises som «ingen». */
export type DealerInputView = { state: "none" } | { state: "needs_reconfirmation"; reasons: string[] } | { state: "in_use" };

export interface EconomicsViewLine { id: string; label: string; treatment: CostLineTreatment["treatment"]; counted: boolean; reason: string | null }

export type EconomicsView =
  | { status: "unavailable"; labelKey: "rights_not_granted"; positiveBudgetEligible: false }
  | { status: "not_calculated"; labelKey: "not_calculated"; reasons: string[]; dealerInput: DealerInputView; positiveBudgetEligible: false }
  | {
      status: "estimate" | "lower_bound" | "scenarios" | "validated";
      labelKey: EconomicsLabelKey;
      cash: ViewAmount;
      landed: ViewAmount;
      estimateReasons: string[];
      incompleteReasons: string[];
      lines: EconomicsViewLine[];
      dealerInput: DealerInputView;
      /** Poster som ikke er innsamlet/oppgitt (aldri 0). */
      notes: string[];
      positiveBudgetEligible: boolean;
    };

export const UNAVAILABLE_VIEW: EconomicsView = Object.freeze({ status: "unavailable", labelKey: "rights_not_granted", positiveBudgetEligible: false }) as EconomicsView;
const uniq = (xs: readonly string[]): string[] => [...new Set(xs)];
export const notCalculatedView = (reasons: string[], dealerInput: DealerInputView = { state: "none" }): EconomicsView =>
  ({ status: "not_calculated", labelKey: "not_calculated", reasons: uniq(reasons), dealerInput, positiveBudgetEligible: false });

export function dealerInputView(s: InputStatus): DealerInputView {
  if (s.status === "fresh") return { state: "in_use" };
  if (s.status === "stale_needs_reconfirmation") return { state: "needs_reconfirmation", reasons: [...s.reasons] };
  return { state: "none" }; // none og foreign: ingen antydning av hva som finnes
}

const amount = (t: Extract<EconomicsDisplayStatus, { overall: "validated" | "estimate" | "incomplete" | "not_calculated" }>["cash"]): ViewAmount => {
  switch (t.kind) {
    case "value": return { kind: "value", nok: t.valueNok.toString() };
    case "lower_bound": return { kind: "lower_bound", minimumNok: t.minimumNok.toString(), missing: [...new Set(t.missing)] };
    case "scenarios": return { kind: "scenarios", scenarios: t.scenarios.map((s) => ({ id: s.id, label: s.label, nok: s.valueNok.toString() })) };
    case "not_calculated": return { kind: "none", reasons: [...t.reasons] };
  }
};

/**
 * 005a-visningsstatus → visningsmodell. Statusen følger totalen som vises: en nedre grense vises alltid som nedre grense («Minst …»), aldri som punktestimat, også når
 * kjernen ellers kalte resultatet estimat. `unavailable` bærer aldri tall.
 */
export function toEconomicsView(display: EconomicsDisplayStatus, dealerInput: DealerInputView, notes: readonly string[]): EconomicsView {
  if (display.overall === "unavailable") return UNAVAILABLE_VIEW;
  const landed = amount(display.landed), cash = amount(display.cash);
  if (display.overall === "not_calculated" || landed.kind === "none") {
    return notCalculatedView(landed.kind === "none" ? landed.reasons : display.reasons, dealerInput);
  }
  const status: "estimate" | "lower_bound" | "scenarios" | "validated" =
    display.overall === "validated" ? "validated" : landed.kind === "lower_bound" ? "lower_bound" : landed.kind === "scenarios" ? "scenarios" : "estimate";
  const labelKey: EconomicsLabelKey = status === "validated" ? "validated" : status === "lower_bound" ? "incomplete_lower_bound" : status === "scenarios" ? "scenarios" : "estimate_not_validated";
  return {
    status, labelKey, cash, landed,
    estimateReasons: uniq(display.estimateReasons), incompleteReasons: uniq(display.incompleteReasons),
    lines: display.lines.map((l) => ({ id: l.id, label: l.label, treatment: l.treatment, counted: l.counted, reason: l.reason })),
    dealerInput, notes: uniq(notes),
    positiveBudgetEligible: status === "validated" && display.positiveBudgetEligible === true,
  };
}

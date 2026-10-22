/**
 * ECON-005a: rene mapperfunksjoner fra økonomikjernen (ECON-004) til søkemodellens `CostAssessment` og en visningsstatus. Ren domenekode: ingen I/O, DB, UI, provider
 * eller rettighetsoppslag (rettigheter kommer inn som ferdige booleans fra et senere lag). Mapperen endrer verken `classifyBudget`, økonomiflagg eller avrundingspolicy.
 * Produktregel (Christian, 20.10.2026): estimater, nedre grenser, scenarier og ukjente kostnader gir aldri positive budsjettutfall, `isFullHit` eller varsler.
 */
import type { CostAssessment, CostKind } from "@/domain/search-v2/types";

/**
 * Forhandlerbekreftet omfang for en søkekostnadslinje (plan P1). Søkemodellen har ikke omfang på `transport`/`insurance`; en eksisterende linje tolkes aldri automatisk.
 * `unconfirmed` er standard. `to_border`/`after_border`/`split` gjelder transport; `to_border`/`other` gjelder forsikring.
 */
export type LineScope = "unconfirmed" | "to_border" | "after_border" | "other" | { split: { toBorderMinor: bigint; afterBorderMinor: bigint } };

/** En gyldighetsgrense for en vurdering (plan P3). `untilExclusive` er UTC ISO 8601 (eksklusiv slutt); `null` = ingen slutt. */
export interface ValidityLimit { label: string; untilExclusive: string | null }

export type LineTreatment =
  | "mapped_to_input"
  | "added_to_total"
  | "unmapped_unknown_scope"
  | "unknown_amount"
  | "unsupported"
  | "not_included";

/** Eksplisitt behandling av hver kostnadslinje (plan P4): ingen linje forsvinner og ingen blir 0 uten å være oppgitt 0. */
export interface CostLineTreatment {
  id: string;
  kind: CostKind;
  label: string;
  amountMinor: bigint | null;
  treatment: LineTreatment;
  /** Beløpet er med i `totalMinor`. */
  counted: boolean;
  /** Maskinlesbar årsak når linjen ikke er fullt behandlet (ellers null). */
  reason: string | null;
}

export type OutcomeClass = "complete_validated" | "unvalidated" | "incomplete" | "not_calculated" | "stale";

export interface MappingOutcome {
  class: OutcomeClass;
  /** `null` ⇒ `classifyBudget` gir `no_assessment` (ikke beregnet). */
  assessment: CostAssessment | null;
  lines: CostLineTreatment[];
  /** Hvorfor vurderingen er null eller ikke komplett/validert (maskinlesbare koder). */
  reasons: string[];
  /** UTC ISO 8601 (eksklusiv slutt) = minimum av alle gyldighetsgrenser; null når ingen vurdering lages. */
  validUntil: string | null;
  /** Etiketten på den bindende (tidligste) grensen. */
  bindingLimit: string | null;
}

export type DisplayTotal =
  | { kind: "value"; valueNok: bigint }
  | { kind: "lower_bound"; minimumNok: bigint; missing: string[] }
  | { kind: "scenarios"; scenarios: Array<{ id: string; label: string; valueNok: bigint }> }
  | { kind: "not_calculated"; reasons: string[] };

/** Faste nøkler; tekstene eies av visningslaget (005d) og skal aldri inneholde positive budsjettutsagn for noe annet enn `validated`. */
export type DisplayLabelKey = "validated" | "estimate_not_validated" | "incomplete_lower_bound" | "not_calculated" | "rights_not_granted";

export type EconomicsDisplayStatus =
  | { overall: "unavailable"; reason: "rights_not_granted"; labelKey: "rights_not_granted"; positiveBudgetEligible: false }
  | {
      overall: "validated" | "estimate" | "incomplete" | "not_calculated";
      labelKey: DisplayLabelKey;
      cash: DisplayTotal;
      landed: DisplayTotal;
      estimateReasons: string[];
      incompleteReasons: string[];
      reasons: string[];
      lines: CostLineTreatment[];
      /** Sann bare for `validated` (uoppnåelig med registerprofilen). Estimat, nedre grense, scenarier og ukjent er alltid false. */
      positiveBudgetEligible: boolean;
    };

import type { EconomicsView } from "@/domain/search-economics";
import { EconomicsExplanation } from "@/components/search/EconomicsExplanation";
import { DEALER_INPUT_TEXT, ECONOMICS_HEADING, ECONOMICS_NOT_BUDGET, ECONOMICS_RIGHTS_TEXT, economicsHeadline, economicsReasonText, staleReasonText } from "@/lib/search-labels";

/**
 * Økonomivisning (ECON-005d): ferdig visningsmodell → faste etiketter. Tall vises bare når modellen har dem (rettighetsgrensen er passert); `unavailable` viser ingen tall.
 * Aldri budsjettspråk: ingen «innenfor budsjett», «treff» eller grønn bekreftelse — alle statuser unntatt `validated` er nøytrale, og `validated` er uoppnåelig med registerprofilen.
 * `compact`: kort linje i resultatkortet. Ellers: full forklaring (detaljsiden).
 */
export function EconomicsNote({ economics: e, compact = false }: { economics: EconomicsView; compact?: boolean }) {
  const headline = economicsHeadline(e);
  const attrs = { "data-testid": "economics", "data-economics-status": e.status, "data-economics-label": e.labelKey, "data-positive-budget": String(e.positiveBudgetEligible) } as const;
  if (e.status === "unavailable") {
    return <p className="mt-1 text-xs" {...attrs}><strong>{ECONOMICS_HEADING}:</strong> {headline}{compact ? "" : <> — {ECONOMICS_RIGHTS_TEXT}</>}</p>;
  }
  if (compact) {
    return <p className="mt-1 text-xs" {...attrs}><strong>{ECONOMICS_HEADING}:</strong> <span data-testid="economics-headline">{headline}</span>{e.status === "not_calculated" ? "" : <> · <span className="text-muted">{ECONOMICS_NOT_BUDGET}</span></>}</p>;
  }
  return (
    <div className="space-y-2 rounded-xl border border-sand bg-paper p-3 text-sm" {...attrs}>
      <p className="text-xs font-bold uppercase tracking-wide text-rust-dark">{ECONOMICS_HEADING}</p>
      <p className="text-base font-bold" data-testid="economics-headline">{headline}</p>
      <p className="text-xs text-muted" data-testid="economics-not-budget">{ECONOMICS_NOT_BUDGET}</p>
      {e.status === "not_calculated"
        ? (
          <>
            <ul className="list-disc pl-5" data-testid="economics-reasons">{e.reasons.map((r) => <li key={r}>{economicsReasonText(r)}</li>)}</ul>
            {e.explanation && <EconomicsExplanation e={e} />}
          </>
        )
        : <EconomicsExplanation e={e} />}
      <p className="text-xs" data-testid="economics-dealer-input">
        {e.dealerInput.state === "none" ? DEALER_INPUT_TEXT.none : e.dealerInput.state === "in_use" ? DEALER_INPUT_TEXT.in_use : `${DEALER_INPUT_TEXT.needs_reconfirmation} (${e.dealerInput.reasons.map(staleReasonText).join("; ")}).`}
      </p>
    </div>
  );
}

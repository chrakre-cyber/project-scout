import type { EconomicsView } from "@/domain/search-economics";
import {
  DEALER_INPUT_TEXT, ECONOMICS_HEADING, ECONOMICS_NOT_BUDGET, ECONOMICS_RIGHTS_TEXT, LINE_TREATMENT_TEXT, economicsHeadline, economicsNoteText, economicsReasonText, formatNokString, staleReasonText,
} from "@/lib/search-labels";

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
        ? <ul className="list-disc pl-5" data-testid="economics-reasons">{e.reasons.map((r) => <li key={r}>{economicsReasonText(r)}</li>)}</ul>
        : (
          <>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
              <dt className="text-muted">Kontantbehov (brutto utlegg)</dt><dd data-testid="economics-cash">{amountText(e.cash)}</dd>
              <dt className="text-muted">Anslått samlet kostnad</dt><dd data-testid="economics-landed">{amountText(e.landed)}</dd>
            </dl>
            {e.landed.kind === "scenarios" && <ul className="list-disc pl-5" data-testid="economics-scenarios">{e.landed.scenarios.map((s) => <li key={s.id}>{s.label}: {formatNokString(s.nok)}</li>)}</ul>}
            {e.landed.kind === "lower_bound" && e.landed.missing.length > 0 && <p data-testid="economics-missing"><strong>Mangler:</strong> {e.landed.missing.map(economicsReasonText).join(" ")}</p>}
            {e.incompleteReasons.length > 0 && <ul className="list-disc pl-5" data-testid="economics-incomplete">{e.incompleteReasons.map((r) => <li key={r}>{economicsReasonText(r)}</li>)}</ul>}
            {e.estimateReasons.length > 0 && (
              <details><summary className="min-h-11 cursor-pointer py-2 font-semibold text-forest underline">Forutsetninger og forbehold</summary>
                <ul className="list-disc pl-5" data-testid="economics-estimate-reasons">{e.estimateReasons.map((r) => <li key={r}>{economicsReasonText(r)}</li>)}</ul>
              </details>
            )}
            {e.lines.length > 0 && (
              <details><summary className="min-h-11 cursor-pointer py-2 font-semibold text-forest underline">Kostnadslinjer i søket</summary>
                <ul className="list-disc pl-5" data-testid="economics-lines">{e.lines.map((l) => <li key={l.id}>{l.label}: {LINE_TREATMENT_TEXT[l.treatment]}</li>)}</ul>
              </details>
            )}
            {e.notes.length > 0 && <ul className="list-disc pl-5 text-xs text-muted" data-testid="economics-notes">{e.notes.map((n) => <li key={n}>{economicsNoteText(n)}</li>)}</ul>}
          </>
        )}
      <p className="text-xs" data-testid="economics-dealer-input">
        {e.dealerInput.state === "none" ? DEALER_INPUT_TEXT.none : e.dealerInput.state === "in_use" ? DEALER_INPUT_TEXT.in_use : `${DEALER_INPUT_TEXT.needs_reconfirmation} (${e.dealerInput.reasons.map(staleReasonText).join("; ")}).`}
      </p>
    </div>
  );
}

function amountText(a: Extract<EconomicsView, { cash: unknown }>["cash"]): string {
  switch (a.kind) {
    case "value": return formatNokString(a.nok);
    case "lower_bound": return `Minst ${formatNokString(a.minimumNok)} (ufullstendig)`;
    case "scenarios": return `Fra ${formatNokString(a.scenarios.reduce((m, s) => (BigInt(s.nok) < BigInt(m) ? s.nok : m), a.scenarios[0]?.nok ?? "0"))} (scenarier)`;
    case "none": return "Ikke beregnet";
  }
}

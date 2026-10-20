import type { Explanation, EconomicsView, ViewAmount } from "@/domain/search-economics";
import {
  ASSUMPTIONS_TITLE, ASSUMPTION_SOURCE_LABEL, BASIS_LABEL, BASIS_SUMMARY_LABEL, BREAKDOWN_BASIS_NOTE, BREAKDOWN_CAPTION, BREAKDOWN_TITLE, COVERAGE_DISCLAIMER, CUSTOMS_DATE_KIND_LABEL,
  DEALER_FORM_NOT_AVAILABLE, DF_FIX_LINK, FIELD_ANCHOR, ECONOMIC_COST_EXPLAIN, ECONOMIC_COST_TITLE, ECONOMICS_NOT_ADVICE, ECONOMICS_UNCERTAINTY_INTRO, FIELD_LABEL, FX_ROLE_LABEL, FX_SOURCE_LABEL, GROSS_OUTLAY_EXPLAIN, GROSS_OUTLAY_TITLE,
  LINE_TREATMENT_TEXT, MISSING_TITLE, NOT_COLLECTABLE_TEXT, REGISTRATION_DATE_KIND_LABEL, ROW_LABEL, RULES_NOT_APPROVED, SEARCH_COSTS_NOTE, SEARCH_COSTS_TITLE, STATE_LABEL, UNCERTAINTY_GROUP_TITLE,
  VAT_HANDLING_LABEL, VAT_RECOVERABILITY_LABEL, coverageText, economicsNoteText, economicsReasonText, formatNokExact, formatNokString,
} from "@/lib/search-labels";

type Computable = Extract<EconomicsView, { cash: unknown }>;

/** Beløp i tekst. `none` = ikke beregnet; nedre grense merkes; scenarier listes av kalleren. */
export function amountText(a: ViewAmount): string {
  switch (a.kind) {
    case "value": return formatNokString(a.nok);
    case "lower_bound": return `Minst ${formatNokString(a.minimumNok)} (ufullstendig)`;
    case "scenarios": return `Fra ${formatNokString(a.scenarios.reduce((m, s) => (BigInt(s.nok) < BigInt(m) ? s.nok : m), a.scenarios[0]?.nok ?? "0"))} (scenarier)`;
    case "none": return "Ikke beregnet";
  }
}

/** To summer med forklaring: brutto utlegg (ikke nødvendigvis kontant ved grensen) og økonomisk kostnad (med scenarier ved ukjent fradragsstatus). */
export function Sums({ e }: { e: Computable }) {
  return (
    <div className="space-y-2" data-testid="economics-sums">
      <div>
        <p className="font-semibold">{GROSS_OUTLAY_TITLE}: <span data-testid="economics-cash">{amountText(e.cash)}</span></p>
        <p className="text-xs text-muted" data-testid="economics-gross-explain">{GROSS_OUTLAY_EXPLAIN}</p>
      </div>
      <div>
        <p className="font-semibold">{ECONOMIC_COST_TITLE}: <span data-testid="economics-landed">{amountText(e.landed)}</span></p>
        {e.landed.kind === "scenarios" && <ul className="list-disc pl-5" data-testid="economics-scenarios">{e.landed.scenarios.map((s) => <li key={s.id}>{s.label}: {formatNokString(s.nok)}</li>)}</ul>}
        <p className="text-xs text-muted" data-testid="economics-cost-explain">{ECONOMIC_COST_EXPLAIN}</p>
      </div>
    </div>
  );
}

function Breakdown({ x }: { x: Explanation }) {
  const main = x.breakdown.filter((r) => r.inGrossOutlay), memo = x.breakdown.filter((r) => !r.inGrossOutlay);
  const cell = (r: Explanation["breakdown"][number], i: number) => (
    <tr key={`${r.id}-${i}`} data-row={r.id} data-state={r.state}>
      <th scope="row" className="py-1 pr-3 text-left font-normal">{ROW_LABEL[r.id]}{r.label ? <span className="block text-xs text-muted">{r.label}</span> : null}</th>
      <td className="py-1 pr-3 text-right tabular-nums">{r.amountNok === null ? "ukjent" : formatNokExact(r.amountNok)}{r.original ? <span className="block text-xs text-muted">({r.original.amount} {r.original.currency})</span> : null}</td>
      <td className="py-1 pr-3">{STATE_LABEL[r.state]}</td>
      <td className="py-1">{BASIS_LABEL[r.basis]}</td>
    </tr>
  );
  return (
    <section aria-label={BREAKDOWN_TITLE} data-testid="economics-breakdown">
      <h3 className="font-bold">{BREAKDOWN_TITLE}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">{BREAKDOWN_CAPTION}</caption>
          <thead><tr><th scope="col" className="text-left">Post</th><th scope="col" className="text-right">Beløp</th><th scope="col" className="text-left">Tilstand</th><th scope="col" className="text-left">Grunnlag</th></tr></thead>
          <tbody>{main.map(cell)}</tbody>
          <tbody data-testid="economics-breakdown-basis"><tr><th scope="rowgroup" colSpan={4} className="pt-2 text-left text-xs font-bold uppercase tracking-wide text-muted">{BREAKDOWN_BASIS_NOTE}</th></tr>{memo.map(cell)}</tbody>
        </table>
      </div>
    </section>
  );
}

function Assumptions({ a }: { a: Explanation["assumptions"] }) {
  const d = a.norwegianRegistration;
  return (
    <section aria-label={ASSUMPTIONS_TITLE} data-testid="economics-assumptions">
      <h3 className="font-bold">{ASSUMPTIONS_TITLE}</h3>
      <ul className="list-disc pl-5">
        {a.fx.map((f) => (
          <li key={f.role} data-fx-role={f.role}>
            <strong>{FX_ROLE_LABEL[f.role]}:</strong> {f.rate && f.pair ? `${f.pair} ${f.rate}` : "kurs mangler"} — {FX_SOURCE_LABEL[f.sourceKind]}{f.sourceLabel ? ` («${f.sourceLabel}»)` : ""}
            {f.quotedAt ? `, notert ${f.quotedAt}` : ""}{f.effectiveAt ? `, gjelder ${f.effectiveAt}` : ""}{f.validTo ? `, gyldig til ${f.validTo}` : ""}
          </li>
        ))}
        <li data-testid="economics-customs-date"><strong>Akseptdato for tolldeklarasjon:</strong> {a.customsAcceptance.date ?? "ukjent"} ({CUSTOMS_DATE_KIND_LABEL[a.customsAcceptance.kind]})</li>
        <li data-testid="economics-registration-date"><strong>Norsk registreringsdato:</strong> {d.date ?? "ukjent"}{d.kind ? ` (${REGISTRATION_DATE_KIND_LABEL[d.kind] ?? d.kind}${d.defaulted ? "; standard: beregningsdatoen" : ""})` : ""}</li>
        <li><strong>Fradragsstatus for import-mva.:</strong> {VAT_RECOVERABILITY_LABEL[a.vatRecoverability.value]}{a.vatRecoverability.source ? ` — ${ASSUMPTION_SOURCE_LABEL[a.vatRecoverability.source] ?? "oppgitt"}` : ""}</li>
        <li><strong>Mva.-håndtering:</strong> {VAT_HANDLING_LABEL[a.vatHandling.value]}{a.vatHandling.source ? ` — ${ASSUMPTION_SOURCE_LABEL[a.vatHandling.source] ?? "oppgitt"}` : ""}</li>
        {!a.rulesApprovedForValidation && <li data-testid="economics-rules-status">{RULES_NOT_APPROVED}</li>}
      </ul>
    </section>
  );
}

function Uncertainty({ x }: { x: Explanation }) {
  const groups = (Object.keys(UNCERTAINTY_GROUP_TITLE) as Array<keyof typeof UNCERTAINTY_GROUP_TITLE>).map((c) => [c, x.uncertainty.filter((u) => u.category === c)] as const).filter(([, l]) => l.length > 0);
  if (groups.length === 0) return null;
  return (
    <section aria-label={ECONOMICS_UNCERTAINTY_INTRO} data-testid="economics-uncertainty">
      <h3 className="font-bold">{ECONOMICS_UNCERTAINTY_INTRO}</h3>
      {groups.map(([c, list]) => (
        <div key={c} data-uncertainty={c}>
          <p className="text-sm font-semibold">{UNCERTAINTY_GROUP_TITLE[c]}</p>
          <ul className="list-disc pl-5">{list.map((u) => <li key={u.code}>{c === "not_collected" || u.code.endsWith("_unknown_no_dealer_basis") || u.code.endsWith("_defaulted_to_as_of") ? economicsNoteText(u.code) : economicsReasonText(u.code)}</li>)}</ul>
        </div>
      ))}
    </section>
  );
}

function Missing({ x, formHref }: { x: Explanation; formHref?: string }) {
  if (x.missing.length === 0) return null;
  return (
    <section aria-label={MISSING_TITLE} data-testid="economics-missing-fields">
      <h3 className="font-bold">{MISSING_TITLE}</h3>
      <ul className="list-disc pl-5">{x.missing.map((m) => <li key={m.field} data-field={m.field}>
        {FIELD_LABEL[m.field]}
        {!m.collectable ? ` — ${NOT_COLLECTABLE_TEXT}` : formHref ? <> — <a className="font-semibold text-rust underline" href={`${formHref}#f-${FIELD_ANCHOR[m.field]}`} data-testid="economics-missing-link">{DF_FIX_LINK}</a></> : ""}
      </li>)}</ul>
      {!formHref && x.missing.some((m) => m.collectable) && <p className="text-xs text-muted" data-testid="economics-form-unavailable">{DEALER_FORM_NOT_AVAILABLE}</p>}
    </section>
  );
}

/** Skrivebeskyttet forklaring av beløp og usikkerhet (ECON-006a). Tar bare visningsmodellen (bak rettighetsgrensen). */
export function EconomicsExplanation({ e, formHref }: { e: Exclude<EconomicsView, { status: "unavailable" }>; formHref?: string }) {
  const x = e.explanation;
  return (
    <div className="space-y-3">
      {"cash" in e && <Sums e={e as Computable} />}
      {x && (
        <>
          <p className="text-sm" data-testid="economics-basis-summary">{BASIS_SUMMARY_LABEL[x.basisSummary]}
            {x.coverage.knownCostItems > 0 && <> <span data-testid="economics-coverage">{coverageText(x.coverage.documented, x.coverage.knownCostItems)}</span> <span className="text-xs text-muted">{COVERAGE_DISCLAIMER}</span></>}
          </p>
          <Breakdown x={x} />
          <Assumptions a={x.assumptions} />
          <section aria-label={SEARCH_COSTS_TITLE} data-testid="economics-lines">
            <h3 className="font-bold">{SEARCH_COSTS_TITLE}</h3>
            {x.searchCosts.rows.length === 0 ? <p className="text-sm">Ingen tillegg lagt inn i søket.</p> : (
              <ul className="list-disc pl-5">{x.searchCosts.rows.map((l) => <li key={l.id}>{l.label}{l.amountNok ? ` (${formatNokExact(l.amountNok)})` : ""}: {LINE_TREATMENT_TEXT[l.treatment]}</li>)}</ul>
            )}
            <p className="text-xs text-muted">{SEARCH_COSTS_NOTE}</p>
          </section>
          <Uncertainty x={x} />
          <Missing x={x} formHref={formHref} />
        </>
      )}
      <p className="text-xs text-muted" data-testid="economics-not-advice">{ECONOMICS_NOT_ADVICE}</p>
    </div>
  );
}

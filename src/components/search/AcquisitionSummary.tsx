import type { AcquisitionSummary as Summary, FormFieldKey, SummaryLine } from "@/domain/search-economics";
import {
  FIELD_ANCHOR, FIELD_LABEL, FX_ROLE_LABEL, FX_SOURCE_LABEL, SUMMARY_ESTIMATE_NOTE, SUMMARY_FX_NONE, SUMMARY_FX_TITLE, SUMMARY_LINE_ASSUMED, SUMMARY_LINE_LABEL, SUMMARY_LINE_UNKNOWN,
  SUMMARY_MISSING_DETAIL_TITLE, SUMMARY_MISSING_INTRO, SUMMARY_MISSING_MORE, SUMMARY_PARTIAL_LABEL, SUMMARY_PARTIAL_NOTE, SUMMARY_PRICE_CLAIM_NOTE, SUMMARY_SCENARIO_EV_NOTE, SUMMARY_SCENARIO_GENERIC_NOTE, SUMMARY_TITLE, SUMMARY_TOTAL_LABEL,
  SUMMARY_TOTAL_SCOPE, SUMMARY_TRANSPORT_NOTE, SUMMARY_UNAVAILABLE_HEADLINE, SUMMARY_UNAVAILABLE_LEAD, SUMMARY_VAT_SCOPE_NOTE, DF_FIX_LINK, economicsReasonText, formatNokExact, formatNokString,
} from "@/lib/search-labels";

/**
 * Anslått innkjøpskostnad til Norge (ECON-003-2). Mottar KUN `AcquisitionSummary` (presentasjonsmodellen avledet fra den eksisterende `EconomicsView`): ingen avgifts-, mva.- eller
 * kursberegning her. Ukjent vises aldri som 0 og en nedre grense vises aldri som total. Alt er merket som estimat.
 * `compact`: kort i resultatlisten. Ellers: fullere nedbrytning (detaljsiden). `formHref` = lenke til forhandlerskjemaet (bare når økonomien kan vises).
 */
const nok = (v: string): string => (/^\d+$/.test(v) ? formatNokString(v) : formatNokExact(v));
const amountOf = (l: SummaryLine): string => (l.amountNok === null ? SUMMARY_LINE_UNKNOWN : `${nok(l.amountNok)}${l.state === "assumed" ? ` (${SUMMARY_LINE_ASSUMED})` : ""}`);
const labelsOf = (fields: readonly FormFieldKey[], max: number): string => {
  const shown = fields.slice(0, max).map((f) => FIELD_LABEL[f].replace(/ \(.*\)$/, "").replace(/ — .*$/, "").toLowerCase());
  return `${shown.join(", ")}${fields.length > max ? ` ${SUMMARY_MISSING_MORE}` : ""}`;
};

const rangeText = (sc: readonly { amountNok: string }[]): string => `${nok(sc[0]!.amountNok).replace(/\u00a0kr$/, "")} – ${nok(sc[sc.length - 1]!.amountNok)}`;
const scenarioNote = (sc: readonly { id: string }[]): string => (sc.some((x) => x.id.startsWith("with_exemption")) ? SUMMARY_SCENARIO_EV_NOTE : SUMMARY_SCENARIO_GENERIC_NOTE);

type Calc = Exclude<Summary, { state: "hidden" } | { state: "unavailable" }>;

function Lines({ s }: { s: Calc }) {
  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm" data-testid="acq-lines">
      {s.lines.map((l) => (
        <div key={l.id} className="contents" data-line={l.id} data-state={l.state}>
          <dt>{SUMMARY_LINE_LABEL[l.id]}{l.original ? <span className="block text-xs text-muted">({l.original.amount} {l.original.currency})</span> : null}</dt>
          <dd className="text-right tabular-nums">{amountOf(l)}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Begge kursroller vises hver for seg (kurs for kjøpesum og tollkurs) — aldri slått sammen. */
function Fx({ s }: { s: Calc }) {
  return (
    <div className="text-sm" data-testid="acq-fx">
      <p className="font-semibold">{SUMMARY_FX_TITLE}</p>
      {s.fx.length === 0 ? <p className="text-muted">{SUMMARY_FX_NONE}</p> : (
        <ul className="list-disc pl-5">{s.fx.map((f) => (
          <li key={f.role} data-fx-role={f.role}><strong>{FX_ROLE_LABEL[f.role]}:</strong> {f.rate && f.pair ? `${f.pair} ${f.rate}` : "kurs mangler"} — {FX_SOURCE_LABEL[f.sourceKind]}</li>
        ))}</ul>
      )}
    </div>
  );
}

function Notes({ s }: { s: Calc }) {
  return (
    <ul className="list-disc pl-5 text-xs text-muted" data-testid="acq-notes">
      <li>{SUMMARY_ESTIMATE_NOTE}</li>
      {s.priceFromListingClaim ? <li>{SUMMARY_PRICE_CLAIM_NOTE}</li> : null}
      <li>{SUMMARY_VAT_SCOPE_NOTE}</li>
      {s.lines.some((l) => l.id === "transport") ? null : <li>{SUMMARY_TRANSPORT_NOTE}</li>}
    </ul>
  );
}

function Missing({ fields, formHref }: { fields: readonly FormFieldKey[]; formHref?: string }) {
  if (fields.length === 0) return null;
  return (
    <div data-testid="acq-missing">
      <p className="text-sm font-semibold">{SUMMARY_MISSING_DETAIL_TITLE}</p>
      <ul className="list-disc pl-5 text-sm">
        {fields.map((f) => (
          <li key={f} data-field={f}>
            {FIELD_LABEL[f]}
            {formHref ? <> — <a className="font-semibold text-rust underline" href={`${formHref}#f-${FIELD_ANCHOR[f]}`}>{DF_FIX_LINK}</a></> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AcquisitionSummary({ summary: s, compact = false, formHref }: { summary: Summary; compact?: boolean; formHref?: string }) {
  if (s.state === "hidden") return null;

  if (s.state === "unavailable") {
    const why = s.missing.length > 0 ? `${SUMMARY_MISSING_INTRO}: ${labelsOf(s.missing, compact ? 3 : 6)}` : s.reasons.slice(0, 2).map(economicsReasonText).join(" ");
    if (compact) {
      return (
        <div className="mt-2 border-t border-sand pt-2" data-testid="acq-summary" data-acq-state="unavailable">
          <p className="text-sm"><strong>{SUMMARY_UNAVAILABLE_HEADLINE}</strong></p>
          <p className="text-xs text-muted" data-testid="acq-why">{SUMMARY_UNAVAILABLE_LEAD}{why ? ` — ${why.charAt(0).toLowerCase()}${why.slice(1)}` : ""}</p>
        </div>
      );
    }
    return (
      <section className="space-y-2 rounded-2xl border border-sand bg-paper p-4 sm:p-5" aria-labelledby="acq-h" data-testid="acq-summary" data-acq-state="unavailable">
        <h2 id="acq-h" className="text-lg font-bold">{SUMMARY_TITLE}</h2>
        <p className="text-base font-bold" data-testid="acq-headline">{SUMMARY_UNAVAILABLE_HEADLINE}</p>
        <p className="text-sm" data-testid="acq-why">{SUMMARY_UNAVAILABLE_LEAD}. {s.missing.length === 0 ? why : ""}</p>
        <Missing fields={s.missing} formHref={formHref} />
      </section>
    );
  }

  if (s.state === "scenarios") {
    if (compact) {
      return (
        <div className="mt-2 border-t border-sand pt-2" data-testid="acq-summary" data-acq-state="scenarios">
          <p className="text-sm"><span className="text-muted">{SUMMARY_TOTAL_LABEL}: </span><strong className="text-base" data-testid="acq-total">{rangeText(s.scenarios)}</strong><span className="text-muted"> {SUMMARY_TOTAL_SCOPE}</span></p>
          <p className="text-xs text-muted" data-testid="acq-scenarios">{scenarioNote(s.scenarios)} {s.scenarios.map((c) => `${c.label} ${nok(c.amountNok)}`).join(" · ")}</p>
        </div>
      );
    }
    return (
      <section className="space-y-3 rounded-2xl border border-sand bg-paper p-4 sm:p-5" aria-labelledby="acq-h" data-testid="acq-summary" data-acq-state="scenarios">
        <h2 id="acq-h" className="text-lg font-bold">{SUMMARY_TITLE}</h2>
        <p className="text-2xl font-bold tracking-tight text-forest">
          <span className="block text-sm font-semibold text-muted">{SUMMARY_TOTAL_LABEL}</span>
          <span data-testid="acq-total">{rangeText(s.scenarios)}</span><span className="ml-2 text-sm font-normal text-muted">{SUMMARY_TOTAL_SCOPE}</span>
        </p>
        <p className="text-sm" data-testid="acq-scenario-note">{scenarioNote(s.scenarios)}</p>
        <ul className="list-disc pl-5 text-sm" data-testid="acq-scenarios">{s.scenarios.map((c) => <li key={c.id} data-scenario={c.id}>{c.label}: <strong>{nok(c.amountNok)}</strong></li>)}</ul>
        <Lines s={s} />
        <Fx s={s} />
        <Notes s={s} />
        <Missing fields={s.missing} formHref={formHref} />
      </section>
    );
  }

  const partial = s.state === "partial";
  // Kortlinjen viser kjente poster; en uttrykkelig oppgitt transport på 0 er kjent, men er bare støy her (den vises i detaljen).
  const known = s.lines.filter((l) => l.amountNok !== null && !(l.id === "transport" && /^0(\.0+)?$/.test(l.amountNok)));
  const parts = known.map((l) => `${SUMMARY_LINE_LABEL[l.id]} ${nok(l.amountNok!)}${l.state === "assumed" ? ` (${SUMMARY_LINE_ASSUMED})` : ""}`).join(" · ");
  if (compact) {
    return (
      <div className="mt-2 border-t border-sand pt-2" data-testid="acq-summary" data-acq-state={s.state}>
        <p className="text-sm">
          <span className="text-muted">{partial ? SUMMARY_PARTIAL_LABEL : SUMMARY_TOTAL_LABEL}: </span><strong className="text-base" data-testid="acq-total">{nok(s.amountNok)}</strong>
          {partial ? null : <span className="text-muted"> {SUMMARY_TOTAL_SCOPE}</span>}
        </p>
        {partial ? <p className="text-xs text-muted" data-testid="acq-partial-note">{SUMMARY_PARTIAL_NOTE}{s.missing.length > 0 ? ` ${SUMMARY_MISSING_INTRO}: ${labelsOf(s.missing, 3)}.` : ""}</p> : null}
        {parts ? <p className="text-xs text-muted" data-testid="acq-parts">{parts}</p> : null}
      </div>
    );
  }

  return (
    <section className="space-y-3 rounded-2xl border border-sand bg-paper p-4 sm:p-5" aria-labelledby="acq-h" data-testid="acq-summary" data-acq-state={s.state}>
      <h2 id="acq-h" className="text-lg font-bold">{SUMMARY_TITLE}</h2>
      <p className="text-2xl font-bold tracking-tight text-forest">
        <span className="block text-sm font-semibold text-muted">{partial ? SUMMARY_PARTIAL_LABEL : SUMMARY_TOTAL_LABEL}</span>
        <span data-testid="acq-total">{nok(s.amountNok)}</span>
        {partial ? null : <span className="ml-2 text-sm font-normal text-muted">{SUMMARY_TOTAL_SCOPE}</span>}
      </p>
      {partial ? <p className="text-sm" data-testid="acq-partial-note">{SUMMARY_PARTIAL_NOTE}</p> : null}
      <Lines s={s} />
      <Fx s={s} />
      <Notes s={s} />
      <Missing fields={s.missing} formHref={formHref} />
    </section>
  );
}

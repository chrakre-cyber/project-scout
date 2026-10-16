import { summarizeSpec } from "@/lib/search-summary";
import type { SearchSpec } from "@/domain/search-v2/types";

/** Kravsammendrag på norsk. Viser tydelig hva som IKKE er satt (f.eks. kilometerstand) og at budsjettgrensen ikke er et beregnet treff. */
export function SpecSummary({ spec }: { spec: SearchSpec }) {
  const s = summarizeSpec(spec);
  return (
    <section className="space-y-3 rounded-2xl border border-sand border-t-4 border-t-forest bg-paper p-4 text-sm sm:p-5" aria-labelledby="spec-summary" data-testid="spec-summary">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-rust-dark">Kundens behov</p>
        <h2 id="spec-summary" className="text-lg font-bold text-forest">Slik er søket satt opp</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="font-bold text-forest">Krav <span className="font-normal text-muted">(må ha)</span></h3>
          {s.must.length ? <ul className="list-disc pl-5">{s.must.map((m) => <li key={m}>{m}</li>)}</ul> : <p className="text-muted">Ingen krav er satt.</p>}
          <h3 className="mt-3 font-bold text-forest">Ønsker <span className="font-normal text-muted">(ønskelig)</span></h3>
          {s.wishes.length ? <ul className="list-disc pl-5">{s.wishes.map((m) => <li key={m}>{m}</li>)}</ul> : <p className="text-muted">Ingen ønsker er satt.</p>}
        </div>
        <div>
          <h3 className="font-bold">Ikke satt</h3>
          <p className="text-muted" data-testid="not-set">{s.notSet.length ? s.notSet.join(", ") : "Alt er satt."}</p>
          <h3 className="mt-3 font-bold">Budsjett</h3>
          <ul className="list-disc pl-5">{s.budget.map((m) => <li key={m}>{m}</li>)}</ul>
          {s.costs.length > 0 && <ul className="mt-1 list-disc pl-5 text-muted">{s.costs.map((m) => <li key={m}>{m}</li>)}</ul>}
          <h3 className="mt-3 font-bold">Planlagt norsk registrering</h3>
          <p>{s.registration}</p>
        </div>
      </div>
    </section>
  );
}

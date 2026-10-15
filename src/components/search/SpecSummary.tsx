import { summarizeSpec } from "@/lib/search-summary";
import type { SearchSpec } from "@/domain/search-v2/types";

/** Kravsammendrag på norsk. Viser tydelig hva som IKKE er satt (f.eks. kilometerstand) og at budsjettgrensen ikke er et beregnet treff. */
export function SpecSummary({ spec }: { spec: SearchSpec }) {
  const s = summarizeSpec(spec);
  return (
    <section className="space-y-3 rounded-2xl border border-sand bg-paper p-4 text-sm sm:p-5" aria-labelledby="spec-summary" data-testid="spec-summary">
      <h2 id="spec-summary" className="text-base font-bold">Slik er søket satt opp</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="font-bold">Krav</h3>
          {s.must.length ? <ul className="list-disc pl-5">{s.must.map((m) => <li key={m}>{m}</li>)}</ul> : <p className="text-muted">Ingen krav er satt.</p>}
          <h3 className="mt-3 font-bold">Ønsker</h3>
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

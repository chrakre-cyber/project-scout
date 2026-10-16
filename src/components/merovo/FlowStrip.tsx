/**
 * Forklarer Merovos modell i fire trinn. Dette er en illustrasjon av ideen, ikke en beskrivelse av tilkoblede systemer:
 * hvert trinn sier hva som faktisk gjelder i denne demoen (syntetiske annonser, ingen selgerkontakt, ingen live kilder).
 */
const STEPS = [
  { title: "Forhandlerens etterspørsel", demo: "Krav og ønsker du lagrer her" },
  { title: "Merovo søker", demo: "I demoen: mot syntetiske annonser" },
  { title: "Kildeannonse", demo: "I demoen: syntetisk demoannonse" },
  { title: "Selger", demo: "I demoen: ikke tilkoblet" },
] as const;

export function FlowStrip() {
  return (
    <section aria-labelledby="flow-h" className="rounded-2xl border border-sand bg-paper p-4 sm:p-5" data-testid="flow-strip">
      <h2 id="flow-h" className="sr-only">Slik tenker Merovo</h2>
      <ol className="grid gap-3 sm:grid-cols-4">
        {STEPS.map((s, i) => (
          <li key={s.title} className="relative rounded-xl bg-cream p-3">
            <p className="flex items-center gap-2 text-sm font-bold text-forest">
              <span aria-hidden="true" className="inline-flex h-6 w-6 flex-none items-center justify-center rounded-full bg-forest text-xs text-cream">{i + 1}</span>
              {s.title}
            </p>
            <p className="mt-1 text-xs text-muted">{s.demo}</p>
            {i < STEPS.length - 1 && <span aria-hidden="true" className="absolute -right-3 top-1/2 hidden -translate-y-1/2 text-lg font-bold text-rust sm:block">→</span>}
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-muted">Illustrerer Merovos modell. Ingen live kilder, ingen avtaler med leverandører, ingen handel eller kontakt med selgere i denne demoen.</p>
    </section>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ResultCard } from "@/components/search/ResultCard";
import { SpecSummary } from "@/components/search/SpecSummary";
import { formatDateTime } from "@/lib/format";
import { FlowStrip } from "@/components/merovo/FlowStrip";
import { StatusBadge } from "@/components/merovo/StatusBadge";
import { orderForPresentation } from "@/lib/search-explain";
import { BUDGET_NOT_CALCULATED, criterionLabel, SYNTHETIC_SOURCE_LABEL, VEHICLE_STATUS_LABEL } from "@/lib/search-labels";
import { equipmentLabel } from "@/lib/search-summary";
import { getDraft } from "@/server/search-drafts";
import { loadEconomicsContext } from "@/server/dealer-economics-context";
import { previewForDisplay } from "@/server/search-display";
import { getSessionContext } from "@/server/session";

export const metadata: Metadata = { title: "Prøv med demodata — Merovo demo" };
// Resultatet beregnes for hver forespørsel og lagres ikke.
export const dynamic = "force-dynamic";

export default async function PreviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ v?: string }> }) {
  const ctx = await getSessionContext();
  if (ctx.status !== "member") redirect("/searches");
  const { id } = await params;
  const draft = await getDraft(ctx, id);
  if (!draft) notFound();
  const requested = Number((await searchParams).v);
  const back = <Link className="font-semibold text-rust underline" href={`/searches/${id}`}>Tilbake til søket</Link>;

  if (!draft.readable) {
    return <div className="space-y-3"><h1 className="text-2xl font-bold">{draft.name}</h1><p role="alert" className="rounded-lg bg-[#fbeae5] p-3 text-danger">Utkastet kan ikke vurderes mot gjeldende katalog.</p>{back}</div>;
  }
  if (!Number.isSafeInteger(requested) || requested !== draft.version) {
    return (
      <div className="space-y-3" data-testid="stale-version">
        <h1 className="text-2xl font-bold">{draft.name}</h1>
        <p role="alert" className="rounded-lg border border-sand bg-sand-soft p-3">
          Søket er endret siden du trykket «Prøv med demodata» (du så versjon {Number.isSafeInteger(requested) ? requested : "ukjent"}, gjeldende lagrede versjon er {draft.version}).
          Ingen resultater vises for en annen versjon enn den du ber om.
        </p>
        <Link className="inline-block min-h-11 rounded-lg bg-rust px-5 py-2 font-semibold text-white" href={`/searches/${id}/preview?v=${draft.version}`}>Prøv versjon {draft.version}</Link> {back}
      </div>
    );
  }

  const outcome = await previewForDisplay(draft.spec, { economics: await loadEconomicsContext(ctx, draft.id) });
  const equip = (k: string) => equipmentLabel(k);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-forest">{draft.name}</h1>
        <p className="text-sm text-muted" data-testid="preview-meta">
          Resultatet gjelder <strong>lagret versjon {draft.version}</strong> (sist lagret {formatDateTime(draft.updatedAt)}). {back}
        </p>
      </div>
      <p className="rounded-lg border border-sand bg-sand-soft p-3 text-sm" data-testid="preview-notice">
        <strong>{SYNTHETIC_SOURCE_LABEL}.</strong> Demo mot syntetiske annonser. Resultatet beregnes nå, for denne forespørselen, og lagres ikke — det kan ikke åpnes igjen senere.
        Ingen live kilde er brukt. {BUDGET_NOT_CALCULATED}
      </p>
      <FlowStrip />
      <SpecSummary spec={draft.spec} />

      {!outcome.ok ? (
        <div role="alert" className="rounded-lg border border-danger/40 bg-[#fbeae5] p-4 text-danger" data-testid="source-error">
          <p className="font-bold">Kilden kunne ikke leses.</p>
          <p>{outcome.message} Ingen resultater vises. Prøv igjen senere.</p>
        </div>
      ) : (
        <>
          <section aria-labelledby="coverage" className="space-y-2 rounded-2xl border border-sand bg-paper p-4 text-sm" data-testid="coverage">
            <h2 id="coverage" className="font-bold">Dekning</h2>
            <p>
              Vurderte <strong>{outcome.coverage.evaluated}</strong> av {outcome.coverage.sourceTotal} annonser i demokilden ({outcome.coverage.pages} {outcome.coverage.pages === 1 ? "side" : "sider"}).
              {outcome.coverage.truncated
                ? <strong className="text-danger"> Resultatet er avkortet: bare deler av kilden er hentet, så dette er ikke full dekning.</strong>
                : " Hele demokilden er hentet."}
              {outcome.coverage.rejectedBySource > 0 && ` ${outcome.coverage.rejectedBySource} kildeposter kunne ikke leses og er ikke vurdert.`}
              {outcome.coverage.withheldByProvenance > 0 && ` ${outcome.coverage.withheldByProvenance} annonser vises ikke fordi visningsretten eller kildedataene ikke lenger er gyldige.`}
              {outcome.coverage.notAdapted > 0 && ` ${outcome.coverage.notAdapted} annonser kunne ikke gjøres om til vurderbare biler og er ikke vurdert.`}
            </p>
            {outcome.sourceCannotSupply.length > 0 && (
              <p data-testid="source-cannot-supply">
                <strong>Demokilden kan ikke oppgi:</strong>{" "}
                {outcome.sourceCannotSupply.map((c) => criterionLabel(c, equip)).join(", ")}. Biler får derfor «ikke oppgitt» på disse kravene — det betyr ikke at bilen mangler egenskapen.
              </p>
            )}
          </section>

          <section aria-labelledby="counts" className="grid gap-3 sm:grid-cols-3" data-testid="counts">
            <h2 id="counts" className="sr-only">Antall</h2>
            {([["match", outcome.counts.match], ["needs_review", outcome.counts.needsReview], ["excluded", outcome.counts.excluded]] as const).map(([k, n]) => (
              <div key={k} className="rounded-2xl border border-sand bg-paper p-4 text-center">
                <p className="text-3xl font-bold text-forest" data-count={k}>{n}</p>
                <p className="mt-1"><StatusBadge status={k} /></p>
              </div>
            ))}
          </section>
          {outcome.counts.match === 0 && (
            <p className="rounded-lg border border-sand bg-sand-soft p-3 text-sm" data-testid="no-match">
              Ingen biler oppfyller alle kravene med de opplysningene demokilden har.
              {outcome.counts.needsReview > 0 ? " Noen kan fortsatt oppfylle dem, men kilden oppgir ikke nok — se «Må kontrolleres»." : ""}
            </p>
          )}

          {(["match", "needs_review"] as const).map((st) => {
            const items = orderForPresentation(outcome.items.filter((i) => i.assessment.vehicle.status === st));
            return (
              <section key={st} aria-labelledby={`g-${st}`} className="space-y-3">
                <h2 id={`g-${st}`} className="flex flex-wrap items-center gap-3 text-xl font-bold text-forest"><StatusBadge status={st} /><span>({items.length})</span></h2>
                {st === "needs_review" && <p className="text-sm text-muted">Dette er ikke feil: kilden oppgir ikke alt som trengs for å avgjøre kravene. Kontroller hos kilden før du går videre.</p>}
                {items.length === 0 ? <p className="text-sm text-muted">Ingen.</p> : <ul className="space-y-3">{items.map((i) => <ResultCard key={i.listing.listingId} item={i} draftId={id} version={draft.version} />)}</ul>}
              </section>
            );
          })}
          <details className="rounded-2xl border border-sand bg-paper p-4" data-testid="excluded">
            <summary className="min-h-11 cursor-pointer text-xl font-bold text-forest">{VEHICLE_STATUS_LABEL.excluded} ({outcome.counts.excluded})</summary>
            <p className="mt-2 text-sm text-muted">Disse bilene har minst ett kjent kravbrudd. Åpne forklaringen for å se hvilket krav som ikke er oppfylt.</p>
            <ul className="mt-3 space-y-3">
              {orderForPresentation(outcome.items.filter((i) => i.assessment.vehicle.status === "excluded")).map((i) => <ResultCard key={i.listing.listingId} item={i} draftId={id} version={draft.version} />)}
            </ul>
          </details>
        </>
      )}
    </div>
  );
}

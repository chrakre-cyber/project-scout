import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CarPlaceholder } from "@/components/CarPlaceholder";
import { StatusBadge, SyntheticChip } from "@/components/merovo/StatusBadge";
import { AcquisitionSummary } from "@/components/search/AcquisitionSummary";
import { EconomicsNote } from "@/components/search/EconomicsNote";
import { Explanation } from "@/components/search/Explanation";
import { DemoEnrichment } from "@/components/search/DemoEnrichment";
import { ListingGallery } from "@/components/search/ListingGallery";
import { ListingFacts } from "@/components/search/ListingFacts";
import { PUBLIC_ID_PATTERN } from "@/domain/display-policy";
import { summaryShowsAmount, toAcquisitionSummary } from "@/domain/search-economics";
import { fieldValue } from "@/lib/display-text";
import { mustSummary, whyShown, wishSummary } from "@/lib/search-explain";
import { BLOCKED_TEXT, DF_SAVED, BUDGET_NOT_CALCULATED, SUMMARY_BUDGET_NOTE, CANDIDATE_FIELD_LABEL, SOURCE_NOTE, VEHICLE_STATUS_LABEL } from "@/lib/search-labels";
import { getDraft } from "@/server/search-drafts";
import { loadEconomicsContext } from "@/server/dealer-economics-context";
import { detailForDisplay } from "@/server/search-display";
import { getSessionContext } from "@/server/session";

export const metadata: Metadata = { title: "Detaljer — Merovo demo" };
export const dynamic = "force-dynamic";

export default async function ListingDetailPage({ params, searchParams }: { params: Promise<{ id: string; listingId: string }>; searchParams: Promise<{ v?: string; msg?: string }> }) {
  const ctx = await getSessionContext();
  if (ctx.status !== "member") redirect("/searches");
  const { id, listingId: raw } = await params;
  const listingId = decodeURIComponent(raw);
  const draft = await getDraft(ctx, id);
  if (!draft || !PUBLIC_ID_PATTERN.test(listingId)) notFound();
  const back = <Link className="font-semibold text-rust underline" href={`/searches/${id}/preview?v=${draft.version}`}>Tilbake til resultatet</Link>;
  if (!draft.readable) notFound();
  const sp = await searchParams;
  const requested = Number(sp.v);
  if (requested !== draft.version) {
    return <div className="space-y-3" data-testid="stale-version"><p role="alert" className="rounded-lg border border-sand bg-sand-soft p-3">Søket er endret siden resultatet ble vist (gjeldende lagrede versjon er {draft.version}). {back}</p></div>;
  }

  const detail = await detailForDisplay(draft.spec, listingId, { economics: await loadEconomicsContext(ctx, draft.id) });
  if (detail.kind === "source_error") return <div className="space-y-3"><p role="alert" className="rounded-lg bg-[#fbeae5] p-3 text-danger">Kilden kunne ikke leses. {back}</p></div>;
  if (detail.kind === "not_found") notFound();
  if (detail.kind === "blocked") {
    // Feiler lukket: ingen annonsedata, bare en nøytral forklaring på HVORFOR (utløpt kilde / rettighet utløpt eller trukket / utilgjengelig).
    return <div className="space-y-3" data-testid="blocked" data-reason={detail.reason}><p role="alert" className="rounded-lg border border-sand bg-sand-soft p-3">{BLOCKED_TEXT[detail.reason]} {back}</p></div>;
  }
  if (detail.kind === "not_assessable") return <div className="space-y-3"><p role="alert" className="rounded-lg bg-[#fbeae5] p-3 text-danger">Annonsen kunne ikke vurderes. {back}</p></div>;

  const { listing, assessment, unknowns, economics, media, enrichment } = detail.item;
  const status = assessment.vehicle.status;
  const summary = toAcquisitionSummary(economics);
  const formHref = economics.status === "unavailable" ? undefined : `/searches/${draft.id}/preview/${encodeURIComponent(listingId)}/dealer-input?v=${draft.version}`;
  const title = listing.title.state === "value"
    ? `${listing.title.value.make} ${listing.title.value.model}${listing.title.value.variant ? ` · ${listing.title.value.variant}` : ""}`
    : "Annonse";
  return (
    <div className="space-y-5">
      <p>{back}</p>
      <p className="rounded-xl bg-paper px-4 py-2 text-xs text-muted" data-testid="chain">
        <strong className="text-forest">Forhandlerens etterspørsel</strong> (søket «{draft.name}») → <strong className="text-forest">Merovo søker</strong> (syntetiske annonser) →{" "}
        <strong className="text-forest">Kildeannonse</strong> (syntetisk demoannonse) → <strong className="text-forest">Selger</strong> (ikke tilkoblet i demoen).
      </p>
      <div className="grid gap-4 md:grid-cols-[14rem_1fr]">
        {media && media.images.length > 0
          ? <ListingGallery media={media} />
          : <CarPlaceholder variant="merovo" seed={listing.listingId} bodyType={fieldValue(listing.specs.bodyType)} className="h-44" />}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-forest">{title}</h1>
          <p className="text-sm text-muted">{listing.policy.environment === "synthetic" ? `Syntetisk demoannonse. Ikke en ekte annonse.` : listing.attribution}</p>
          <p><SyntheticChip text={listing.attribution} /></p>
          <p className="text-lg font-bold" data-testid="detail-status"><StatusBadge status={status} /></p>
          <div className="rounded-xl border-l-4 border-rust bg-cream p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-rust-dark">Hvorfor vist</p>
            <p className="mt-0.5 text-base" data-testid="why-shown">{whyShown(assessment.vehicle)}</p>
            <p className="mt-1 text-sm text-muted" data-testid="criteria-summary"><strong>Krav:</strong> {mustSummary(assessment.vehicle)} <strong>Ønsker:</strong> {wishSummary(assessment.vehicle)}</p>
          </div>
          <p className="rounded-lg bg-sand-soft px-3 py-2 text-sm" data-testid="budget-note">{summaryShowsAmount(summary) ? SUMMARY_BUDGET_NOTE : BUDGET_NOT_CALCULATED}</p>
        </div>
      </div>
      {sp.msg === "econ_saved" && <p role="status" className="rounded-lg border border-ok/40 bg-[#e5f0e8] p-3 text-sm text-ok" data-testid="econ-saved">{DF_SAVED}</p>}
      <AcquisitionSummary summary={summary} formHref={formHref} />
      <section aria-label="Anslått innkjøpskostnad til Norge — detaljert beregning"><EconomicsNote economics={economics} dealerFormHref={formHref} /></section>
      <section className="rounded-2xl border border-sand bg-paper p-4 sm:p-5" aria-labelledby="facts">
        <h2 id="facts" className="mb-2 text-lg font-bold">Opplysninger fra annonsen</h2>
        <ListingFacts listing={listing} />
      </section>
      {enrichment && <DemoEnrichment info={enrichment} />}
      <section className="rounded-2xl border border-sand bg-paper p-4 sm:p-5" aria-labelledby="why">
        <h2 id="why" className="mb-2 text-lg font-bold">Hvorfor {VEHICLE_STATUS_LABEL[status].toLowerCase()}?</h2>
        <Explanation vehicle={assessment.vehicle} />
      </section>
      {unknowns.length > 0 && (
        <section className="rounded-2xl border border-sand bg-paper p-4 text-sm sm:p-5" aria-labelledby="unknown">
          <h2 id="unknown" className="mb-2 text-lg font-bold">Opplysninger demokilden ikke har</h2>
          <ul className="list-disc pl-5">{unknowns.map((u) => <li key={`${u.field}-${u.code}`}><strong>{CANDIDATE_FIELD_LABEL[u.field] ?? "Opplysning"}</strong>: {SOURCE_NOTE[u.code] ?? "ikke oppgitt"}</li>)}</ul>
        </section>
      )}
    </div>
  );
}

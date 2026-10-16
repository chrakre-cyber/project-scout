import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CarPlaceholder } from "@/components/CarPlaceholder";
import { Explanation } from "@/components/search/Explanation";
import {
  BODY_LABEL, FUEL_LABEL, SELLER_LABEL, TRANSMISSION_LABEL, formatDateTime, formatFirstRegistration, formatListingPrice, formatMileage, formatNumber,
  formatPriceBasis, formatVatStatement, labelOrNotStated,
} from "@/lib/format";
import { StatusBadge, SyntheticChip } from "@/components/merovo/StatusBadge";
import { mustSummary, whyShown, wishSummary } from "@/lib/search-explain";
import { BUDGET_NOT_CALCULATED, CANDIDATE_FIELD_LABEL, SOURCE_NOTE, SYNTHETIC_SOURCE_LABEL, VEHICLE_STATUS_LABEL } from "@/lib/search-labels";
import { MarketplaceError, getMarketplaceProvider } from "@/providers/marketplace";
import { getDraft } from "@/server/search-drafts";
import { assessListing } from "@/server/search-preview";
import { getSessionContext } from "@/server/session";

export const metadata: Metadata = { title: "Detaljer — Merovo demo" };
export const dynamic = "force-dynamic";

const SAFE_ID = /^[A-Za-z0-9._:-]{1,200}$/;

export default async function ListingDetailPage({ params, searchParams }: { params: Promise<{ id: string; listingId: string }>; searchParams: Promise<{ v?: string }> }) {
  const ctx = await getSessionContext();
  if (ctx.status !== "member") redirect("/searches");
  const { id, listingId: raw } = await params;
  const listingId = decodeURIComponent(raw);
  const draft = await getDraft(ctx, id);
  if (!draft || !SAFE_ID.test(listingId)) notFound();
  const back = <Link className="font-semibold text-rust underline" href={`/searches/${id}/preview?v=${draft.version}`}>Tilbake til resultatet</Link>;
  if (!draft.readable) notFound();
  const requested = Number((await searchParams).v);
  if (requested !== draft.version) {
    return <div className="space-y-3" data-testid="stale-version"><p role="alert" className="rounded-lg border border-sand bg-sand-soft p-3">Søket er endret siden resultatet ble vist (gjeldende lagrede versjon er {draft.version}). {back}</p></div>;
  }

  let listing = null;
  try { listing = await getMarketplaceProvider().getListing(listingId); } catch (e) {
    if (!(e instanceof MarketplaceError)) throw e;
    return <div className="space-y-3"><p role="alert" className="rounded-lg bg-[#fbeae5] p-3 text-danger">Kilden kunne ikke leses. {back}</p></div>;
  }
  if (!listing) notFound();
  const item = assessListing(draft.spec, listing);
  if (!item) return <div className="space-y-3"><p role="alert" className="rounded-lg bg-[#fbeae5] p-3 text-danger">Annonsen kunne ikke vurderes. {back}</p></div>;

  const s = listing.specs;
  const price = formatListingPrice(listing.price);
  const status = item.assessment.vehicle.status;
  const unknowns = item.meta.explanations;
  return (
    <div className="space-y-5">
      <p>{back}</p>
      <p className="rounded-xl bg-paper px-4 py-2 text-xs text-muted" data-testid="chain">
        <strong className="text-forest">Forhandlerens etterspørsel</strong> (søket «{draft.name}») → <strong className="text-forest">Merovo søker</strong> (syntetiske annonser) →{" "}
        <strong className="text-forest">Kildeannonse</strong> (syntetisk demoannonse) → <strong className="text-forest">Selger</strong> (ikke tilkoblet i demoen).
      </p>
      <div className="grid gap-4 md:grid-cols-[14rem_1fr]">
        <CarPlaceholder variant="merovo" seed={listing.sourceListingId} bodyType={s.bodyType} className="h-44" />
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-forest">{s.make} {s.model}{s.variant ? ` · ${s.variant}` : ""}</h1>
          <p className="text-sm text-muted">Syntetisk demoannonse {listing.sourceListingId} · {item.meta.provenance.description}. Ikke en ekte annonse.</p>
          <p><SyntheticChip text={SYNTHETIC_SOURCE_LABEL} /></p>
          <p className="text-lg font-bold" data-testid="detail-status"><StatusBadge status={status} /></p>
          <div className="rounded-xl border-l-4 border-rust bg-cream p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-rust-dark">Hvorfor vist</p>
            <p className="mt-0.5 text-base" data-testid="why-shown">{whyShown(item.assessment.vehicle)}</p>
            <p className="mt-1 text-sm text-muted" data-testid="criteria-summary"><strong>Krav:</strong> {mustSummary(item.assessment.vehicle)} <strong>Ønsker:</strong> {wishSummary(item.assessment.vehicle)}</p>
          </div>
          <p className="rounded-lg bg-sand-soft px-3 py-2 text-sm" data-testid="budget-note">{BUDGET_NOT_CALCULATED}</p>
        </div>
      </div>
      <section className="rounded-2xl border border-sand bg-paper p-4 sm:p-5" aria-labelledby="facts">
        <h2 id="facts" className="mb-2 text-lg font-bold">Opplysninger fra annonsen</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm sm:grid-cols-[12rem_1fr]">
          <dt className="text-muted">Førstegangsregistrering</dt><dd>{formatFirstRegistration(s.firstRegistration)}</dd>
          <dt className="text-muted">Kilometerstand</dt><dd>{formatMileage(s.mileage)}</dd>
          <dt className="text-muted">Drivstoff</dt><dd>{labelOrNotStated(FUEL_LABEL, s.fuel)}</dd>
          <dt className="text-muted">Girkasse</dt><dd>{labelOrNotStated(TRANSMISSION_LABEL, s.transmission)}</dd>
          <dt className="text-muted">Karosseri</dt><dd>{labelOrNotStated(BODY_LABEL, s.bodyType)}</dd>
          <dt className="text-muted">Effekt</dt><dd>{formatNumber(s.powerKw, "kW")}</dd>
          <dt className="text-muted">Farge</dt><dd>{s.color ?? "ikke oppgitt"}</dd>
          <dt className="text-muted">Selger</dt><dd>{listing.seller ? `${SELLER_LABEL[listing.seller.type]}${listing.seller.countryCode ? `, ${listing.seller.countryCode}` : ""}` : "ikke oppgitt"}</dd>
          <dt className="text-muted">Annonsepris</dt><dd><strong>{price.text}</strong>{price.note && ` (${price.note})`} — {formatPriceBasis(listing.price)}. Annonseprisen er ikke total innkjøpskostnad til Norge.</dd>
          <dt className="text-muted">Mva. i annonsen</dt><dd>{formatVatStatement(listing.price?.vat ?? null)}. Gir ingen nettojustering.</dd>
          <dt className="text-muted">Sist endret hos kilden</dt><dd>{formatDateTime(listing.sourceModifiedAt)}</dd>
        </dl>
        {listing.text && (
          <div className="mt-3">
            <h3 className="text-sm font-bold">Annonsetekst (ubetrodd tekst, vises som den er)</h3>
            <p className="mt-1 whitespace-pre-wrap break-words rounded-lg bg-sand-soft p-3 text-sm" data-testid="listing-text">{listing.text}</p>
          </div>
        )}
      </section>
      <section className="rounded-2xl border border-sand bg-paper p-4 sm:p-5" aria-labelledby="why">
        <h2 id="why" className="mb-2 text-lg font-bold">Hvorfor {VEHICLE_STATUS_LABEL[status].toLowerCase()}?</h2>
        <Explanation vehicle={item.assessment.vehicle} />
      </section>
      {unknowns.length > 0 && (
        <section className="rounded-2xl border border-sand bg-paper p-4 text-sm sm:p-5" aria-labelledby="unknown">
          <h2 id="unknown" className="mb-2 text-lg font-bold">Opplysninger demokilden ikke har</h2>
          <ul className="list-disc pl-5">{unknowns.map((u) => <li key={`${u.field}-${u.code}`}><strong>{CANDIDATE_FIELD_LABEL[String(u.field)] ?? "Opplysning"}</strong>: {SOURCE_NOTE[u.code] ?? "ikke oppgitt"}</li>)}</ul>
        </section>
      )}
    </div>
  );
}

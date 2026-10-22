import Link from "next/link";
import { CarPlaceholder } from "@/components/CarPlaceholder";
import { StatusBadge, SyntheticChip } from "@/components/merovo/StatusBadge";
import { EconomicsNote } from "@/components/search/EconomicsNote";
import { Explanation } from "@/components/search/Explanation";
import { BODY_LABEL, FUEL_LABEL, TRANSMISSION_LABEL, formatFirstRegistration, formatListingPrice, formatMileage, formatPriceBasis } from "@/lib/format";
import { fieldText, fieldValue } from "@/lib/display-text";
import { mustSummary, whyShown, wishSummary } from "@/lib/search-explain";
import { BUDGET_NOT_CALCULATED } from "@/lib/search-labels";
import type { DisplayItem } from "@/server/search-display";

/**
 * Resultatkort (DEV-006D). Rekkefølge: tittel + status → HVORFOR vist → krav-/ønskesammendrag → forklaring → fakta og annonsepris →
 * kilde/demo-etikett. Annonseprisen er tydelig adskilt fra innkjøpskostnad (som ikke er beregnet).
 */
export function ResultCard({ item, draftId, version, expanded = false }: { item: DisplayItem; draftId: string; version: number; expanded?: boolean }) {
  const { listing: l, assessment: a } = item;
  const status = a.vehicle.status;
  const title = l.title.state === "value" ? `${l.title.value.make} ${l.title.value.model}${l.title.value.variant ? ` · ${l.title.value.variant}` : ""}` : fieldText(l.title, () => "");
  return (
    <li className="overflow-hidden rounded-2xl border border-sand bg-paper shadow-sm" data-listing={l.listingId} data-status={status}>
      <div className="grid gap-0 md:grid-cols-[12rem_1fr]">
        {item.media?.images[0]
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={item.media.images[0].src} alt={item.media.images[0].alt} className="h-36 w-full object-cover md:h-full" data-testid="card-thumb" />
          : <CarPlaceholder variant="merovo" seed={l.listingId} bodyType={fieldValue(l.specs.bodyType)} className="h-36 md:h-full" />}
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="text-xl font-bold tracking-tight text-forest">{title}</h3>
            <span data-testid="vehicle-status"><StatusBadge status={status} /></span>
          </div>
          <div className="rounded-xl border-l-4 border-rust bg-cream p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-rust-dark">Hvorfor vist</p>
            <p className="mt-0.5 text-base" data-testid="why-shown">{whyShown(a.vehicle)}</p>
            <p className="mt-1 text-xs text-muted" data-testid="criteria-summary"><strong>Krav:</strong> {mustSummary(a.vehicle)} <strong>Ønsker:</strong> {wishSummary(a.vehicle)}</p>
          </div>
          {expanded
            ? <Explanation vehicle={a.vehicle} />
            : (
              <details>
                <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-forest underline">Vis forklaring</summary>
                <div className="mt-2"><Explanation vehicle={a.vehicle} /></div>
              </details>
            )}
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm sm:grid-cols-[auto_1fr_auto_1fr]">
            <dt className="text-muted">Registrert</dt><dd>{fieldText(l.registration, formatFirstRegistration)}</dd>
            <dt className="text-muted">Kilometerstand</dt><dd>{fieldText(l.mileage, formatMileage)}</dd>
            <dt className="text-muted">Drivstoff</dt><dd>{fieldText(l.specs.fuel, (v) => FUEL_LABEL[v])}</dd>
            <dt className="text-muted">Girkasse</dt><dd>{fieldText(l.specs.transmission, (v) => TRANSMISSION_LABEL[v])}</dd>
            <dt className="text-muted">Karosseri</dt><dd>{fieldText(l.specs.bodyType, (v) => BODY_LABEL[v])}</dd>
          </dl>
          <div className="rounded-xl bg-sand-soft p-3 text-sm">
            {l.price.state === "value"
              ? (() => { const price = formatListingPrice(l.price.value); return (<><p><span className="text-muted">Annonsepris (ikke innkjøpskostnad): </span><strong className="text-base">{price.text}</strong>{price.note && <span className="text-muted"> ({price.note})</span>}</p><p className="text-xs text-muted">{formatPriceBasis(l.price.value)}</p></>); })()
              : <p><span className="text-muted">Annonsepris (ikke innkjøpskostnad): </span>{fieldText(l.price, () => "")}</p>}
            <p className="mt-1 text-xs" data-testid="budget-note">{BUDGET_NOT_CALCULATED}</p>
            <EconomicsNote economics={item.economics} compact />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SyntheticChip text={l.attribution} />
            <Link href={`/searches/${draftId}/preview/${encodeURIComponent(l.listingId)}?v=${version}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-rust-dark underline">Se detaljer</Link>
          </div>
        </div>
      </div>
    </li>
  );
}

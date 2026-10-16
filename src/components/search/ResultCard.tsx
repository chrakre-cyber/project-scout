import Link from "next/link";
import { CarPlaceholder } from "@/components/CarPlaceholder";
import { StatusBadge, SyntheticChip } from "@/components/merovo/StatusBadge";
import { Explanation } from "@/components/search/Explanation";
import { BODY_LABEL, FUEL_LABEL, TRANSMISSION_LABEL, formatFirstRegistration, formatListingPrice, formatMileage, formatPriceBasis, labelOrNotStated } from "@/lib/format";
import { mustSummary, whyShown, wishSummary } from "@/lib/search-explain";
import { BUDGET_NOT_CALCULATED, SYNTHETIC_SOURCE_LABEL } from "@/lib/search-labels";
import type { PreviewItem } from "@/server/search-preview";

/**
 * Resultatkort (DEV-006D). Rekkefølge: tittel + status → HVORFOR vist → krav-/ønskesammendrag → forklaring → fakta og annonsepris →
 * kilde/demo-etikett. Annonseprisen er tydelig adskilt fra innkjøpskostnad (som ikke er beregnet).
 */
export function ResultCard({ item, draftId, version, expanded = false }: { item: PreviewItem; draftId: string; version: number; expanded?: boolean }) {
  const { listing: l, assessment: a } = item;
  const s = l.specs;
  const price = formatListingPrice(l.price);
  const status = a.vehicle.status;
  return (
    <li className="overflow-hidden rounded-2xl border border-sand bg-paper shadow-sm" data-listing={l.sourceListingId} data-status={status}>
      <div className="grid gap-0 md:grid-cols-[12rem_1fr]">
        <CarPlaceholder variant="merovo" seed={l.sourceListingId} bodyType={s.bodyType} className="h-36 md:h-full" />
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="text-xl font-bold tracking-tight text-forest">{s.make} {s.model}{s.variant ? ` · ${s.variant}` : ""}</h3>
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
            <dt className="text-muted">Registrert</dt><dd>{formatFirstRegistration(s.firstRegistration)}</dd>
            <dt className="text-muted">Kilometerstand</dt><dd>{formatMileage(s.mileage)}</dd>
            <dt className="text-muted">Drivstoff</dt><dd>{labelOrNotStated(FUEL_LABEL, s.fuel)}</dd>
            <dt className="text-muted">Girkasse</dt><dd>{labelOrNotStated(TRANSMISSION_LABEL, s.transmission)}</dd>
            <dt className="text-muted">Karosseri</dt><dd>{labelOrNotStated(BODY_LABEL, s.bodyType)}</dd>
          </dl>
          <div className="rounded-xl bg-sand-soft p-3 text-sm">
            <p><span className="text-muted">Annonsepris (ikke innkjøpskostnad): </span><strong className="text-base">{price.text}</strong>{price.note && <span className="text-muted"> ({price.note})</span>}</p>
            <p className="text-xs text-muted">{formatPriceBasis(l.price)}</p>
            <p className="mt-1 text-xs" data-testid="budget-note">{BUDGET_NOT_CALCULATED}</p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SyntheticChip text={SYNTHETIC_SOURCE_LABEL} />
            <Link href={`/searches/${draftId}/preview/${encodeURIComponent(l.sourceListingId)}?v=${version}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-rust-dark underline">Se detaljer</Link>
          </div>
        </div>
      </div>
    </li>
  );
}

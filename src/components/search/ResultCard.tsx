import Link from "next/link";
import { CarPlaceholder } from "@/components/CarPlaceholder";
import { Explanation } from "@/components/search/Explanation";
import { BODY_LABEL, FUEL_LABEL, TRANSMISSION_LABEL, formatFirstRegistration, formatListingPrice, formatMileage, formatPriceBasis, labelOrNotStated } from "@/lib/format";
import { BUDGET_NOT_CALCULATED, VEHICLE_STATUS_LABEL } from "@/lib/search-labels";
import type { PreviewItem } from "@/server/search-preview";

const CHIP = { match: "bg-[#dcebdf] text-ok", needs_review: "bg-[#f6e6c9] text-[#6b4a07]", excluded: "bg-[#f0d8d2] text-danger" } as const;

export function ResultCard({ item, draftId, version, expanded = false }: { item: PreviewItem; draftId: string; version: number; expanded?: boolean }) {
  const { listing: l, assessment: a } = item;
  const s = l.specs;
  const price = formatListingPrice(l.price);
  const status = a.vehicle.status;
  return (
    <li className="overflow-hidden rounded-2xl border border-sand bg-paper" data-listing={l.sourceListingId} data-status={status}>
      <div className="grid gap-0 md:grid-cols-[11rem_1fr]">
        <CarPlaceholder seed={l.sourceListingId} bodyType={s.bodyType} className="h-36 md:h-full" />
        <div className="space-y-2 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="text-lg font-bold">{s.make} {s.model}{s.variant ? ` · ${s.variant}` : ""}</h3>
            <span className={`rounded-full px-3 py-0.5 text-xs font-bold ${CHIP[status]}`} data-testid="vehicle-status">{VEHICLE_STATUS_LABEL[status]}</span>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm sm:grid-cols-[auto_1fr_auto_1fr]">
            <dt className="text-muted">Registrert</dt><dd>{formatFirstRegistration(s.firstRegistration)}</dd>
            <dt className="text-muted">Kilometerstand</dt><dd>{formatMileage(s.mileage)}</dd>
            <dt className="text-muted">Drivstoff</dt><dd>{labelOrNotStated(FUEL_LABEL, s.fuel)}</dd>
            <dt className="text-muted">Girkasse</dt><dd>{labelOrNotStated(TRANSMISSION_LABEL, s.transmission)}</dd>
            <dt className="text-muted">Karosseri</dt><dd>{labelOrNotStated(BODY_LABEL, s.bodyType)}</dd>
            <dt className="text-muted">Annonsepris</dt>
            <dd><strong>{price.text}</strong>{price.note && <span className="text-muted"> ({price.note})</span>}<br /><span className="text-xs text-muted">{formatPriceBasis(l.price)}</span></dd>
          </dl>
          <p className="rounded-lg bg-sand-soft px-3 py-2 text-xs" data-testid="budget-note">{BUDGET_NOT_CALCULATED}</p>
          {expanded
            ? <Explanation vehicle={a.vehicle} />
            : (
              <details>
                <summary className="cursor-pointer text-sm font-semibold text-forest underline">Vis forklaring</summary>
                <div className="mt-2"><Explanation vehicle={a.vehicle} /></div>
              </details>
            )}
          <Link href={`/searches/${draftId}/preview/${encodeURIComponent(l.sourceListingId)}?v=${version}`} className="inline-block text-sm font-semibold text-rust underline">Se detaljer</Link>
        </div>
      </div>
    </li>
  );
}

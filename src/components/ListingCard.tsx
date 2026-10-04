import Link from "next/link";
import type { NormalizedListing } from "@/domain/types";
import {
  FUEL_LABEL, TRANSMISSION_LABEL, formatDateTime, formatFirstRegistration,
  formatMileage, formatMoney, formatPriceBasis, labelOrNotStated,
} from "@/lib/format";
import { CarPlaceholder } from "./CarPlaceholder";

export function ListingCard({ listing }: { listing: NormalizedListing }) {
  const { specs } = listing;
  return (
    <Link
      href={`/opportunities/${listing.sourceListingId}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:border-slate-400 hover:shadow focus-visible:outline-2 focus-visible:outline-slate-900"
    >
      <CarPlaceholder seed={listing.sourceListingId} bodyType={specs.bodyType} className="h-32" />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold leading-tight group-hover:underline">
            {specs.make} {specs.model}
            <span className="block text-sm font-normal text-slate-600">{specs.variant ?? "Variant ikke oppgitt"}</span>
          </h3>
          <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-900">
            Syntetisk
          </span>
        </div>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-700">
          <dt className="text-slate-500">1. reg.</dt><dd>{formatFirstRegistration(specs.firstRegistration)}</dd>
          <dt className="text-slate-500">Kilometer</dt><dd>{formatMileage(specs.mileage)}</dd>
          <dt className="text-slate-500">Drivstoff</dt><dd>{labelOrNotStated(FUEL_LABEL, specs.fuel)}</dd>
          <dt className="text-slate-500">Gir</dt><dd>{labelOrNotStated(TRANSMISSION_LABEL, specs.transmission)}</dd>
        </dl>
        <div className="mt-auto border-t border-slate-100 pt-2">
          <p className="text-lg font-semibold">{formatMoney(listing.price.amount)}</p>
          <p className="text-xs text-slate-600">Annonsepris · {formatPriceBasis(listing.price)}</p>
          <p className="mt-1 text-xs text-slate-500">Estimert bidrag: <em>ikke beregnet</em></p>
          <p className="text-xs text-slate-500">Først sett i Scout (syntetisk): {formatDateTime(listing.firstSeenAt)}</p>
        </div>
      </div>
    </Link>
  );
}

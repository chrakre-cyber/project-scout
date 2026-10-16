import type { DisplayableListing } from "@/domain/display-policy";
import {
  BODY_LABEL, FUEL_LABEL, SELLER_LABEL, TRANSMISSION_LABEL, formatDateTime, formatFirstRegistration, formatListingPrice, formatMileage,
  formatNumber, formatPriceBasis, formatVatStatement, NOT_STATED,
} from "@/lib/format";
import { fieldText } from "@/lib/display-text";

/** Opplysninger fra annonsen på detaljsiden. Tar kun visningstrygge felt; hvert felt viser sin tilstand (verdi / ikke oppgitt / vises ikke / ikke tilgjengelig). */
export function ListingFacts({ listing: l }: { listing: DisplayableListing }) {
  return (
    <>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm sm:grid-cols-[12rem_1fr]" data-testid="listing-facts">
        <dt className="text-muted">Førstegangsregistrering</dt><dd>{fieldText(l.registration, formatFirstRegistration)}</dd>
        <dt className="text-muted">Kilometerstand</dt><dd>{fieldText(l.mileage, formatMileage)}</dd>
        <dt className="text-muted">Drivstoff</dt><dd>{fieldText(l.specs.fuel, (v) => FUEL_LABEL[v])}</dd>
        <dt className="text-muted">Girkasse</dt><dd>{fieldText(l.specs.transmission, (v) => TRANSMISSION_LABEL[v])}</dd>
        <dt className="text-muted">Karosseri</dt><dd>{fieldText(l.specs.bodyType, (v) => BODY_LABEL[v])}</dd>
        <dt className="text-muted">Effekt</dt><dd>{fieldText(l.specs.powerKw, (v) => formatNumber(v, "kW"))}</dd>
        <dt className="text-muted">Farge</dt><dd>{fieldText(l.specs.color, (v) => v)}</dd>
        <dt className="text-muted">Selger</dt><dd>{fieldText(l.sellerType, (v) => SELLER_LABEL[v])}</dd>
        <dt className="text-muted">Selgerland</dt><dd>{fieldText(l.sellerLocation, (v) => v.countryCode ?? NOT_STATED)}</dd>
        <dt className="text-muted">Annonsepris</dt>
        <dd>
          {l.price.state === "value"
            ? (() => { const p = formatListingPrice(l.price.value); return <><strong>{p.text}</strong>{p.note && ` (${p.note})`} — {formatPriceBasis(l.price.value)}. Annonseprisen er ikke total innkjøpskostnad til Norge.</>; })()
            : fieldText(l.price, () => "")}
        </dd>
        <dt className="text-muted">Mva. i annonsen</dt>
        <dd>{l.price.state === "value" ? `${formatVatStatement(l.price.value.vat)}. Gir ingen nettojustering.` : fieldText(l.price, () => "")}</dd>
        <dt className="text-muted">Sist endret hos kilden</dt><dd>{fieldText(l.listingDates, (v) => formatDateTime(v.sourceModifiedAt))}</dd>
        <dt className="text-muted">Kilde</dt><dd>{fieldText(l.providerName, (v) => v)}</dd>
      </dl>
      <div className="mt-3">
        <h3 className="text-sm font-bold">Annonsetekst (ubetrodd tekst, vises som den er)</h3>
        {l.text.state === "value"
          ? <p className="mt-1 whitespace-pre-wrap break-words rounded-lg bg-sand-soft p-3 text-sm" data-testid="listing-text">{l.text.value}</p>
          : <p className="mt-1 rounded-lg bg-sand-soft p-3 text-sm text-muted" data-testid="listing-text-state">{fieldText<string>(l.text, (v) => v)}</p>}
      </div>
    </>
  );
}

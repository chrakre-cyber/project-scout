import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CarPlaceholder } from "@/components/CarPlaceholder";
import { agentsForListing, getDemoListing, listDemoListings } from "@/demo/repository";
import {
  BODY_LABEL, FUEL_LABEL, NOT_STATED, PRICE_BASIS_LABEL, SELLER_LABEL, TRANSMISSION_LABEL,
  formatDateTime, formatFirstRegistration, formatMileage, formatMoney, formatNumber, labelOrNotStated,
} from "@/lib/format";

type Params = { params: Promise<{ id: string }> };

export function generateStaticParams() {
  return listDemoListings().map((l) => ({ id: l.sourceListingId }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const listing = getDemoListing((await params).id);
  return { title: listing ? `${listing.specs.make} ${listing.specs.model} — Project Scout demo` : "Ikke funnet" };
}

/** Kostlinjer fra IMPORT_ENGINE_SPEC som skal vises, men som ikke beregnes i DEV-001. */
const COST_LINES = [
  ["Kjøpspris i NOK", "Valutakurs ikke valgt (DEV-009)"],
  ["Estimert transport", "Transporttabell ikke implementert (DEV-009)"],
  ["Import-mva.", "Avgiftsmotor ikke implementert (DEV-007)"],
  ["Engangsavgift", "Avgiftsmotor ikke implementert (DEV-007)"],
  ["Vrakpant og andre avgifter", "Avgiftsmotor ikke implementert (DEV-007)"],
  ["Økonomisk anskaffelseskost", "Avhenger av fradragsstatus (DEV-007)"],
  ["Salgsinntekt eks. utgående mva.", "Salgsprofil ikke valgt (DEV-008)"],
] as const;

export default async function OpportunityPage({ params }: Params) {
  const { id } = await params;
  const listing = getDemoListing(id);
  if (!listing) notFound();
  const { specs, price, seller } = listing;
  const agents = agentsForListing(listing.sourceListingId);

  return (
    <div className="space-y-6">
      <Link href="/dashboard" className="text-sm text-slate-600 hover:underline">← Tilbake til dashboard</Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            {specs.make} {specs.model}
          </h1>
          <p className="text-slate-600">{specs.variant ?? "Variant ikke oppgitt"}</p>
        </div>
        <span className="rounded bg-amber-100 px-2 py-1 text-xs font-semibold uppercase text-amber-900">
          Syntetisk demoannonse
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <CarPlaceholder seed={listing.sourceListingId} bodyType={specs.bodyType} className="h-56 rounded-lg border border-slate-200" />

          <Section title="Annonsepris">
            <p className="text-2xl font-semibold">{formatMoney(price.amount)}</p>
            <p className="text-sm text-slate-700">Grunnlag: {PRICE_BASIS_LABEL[price.basis]}</p>
            <p className="text-sm text-slate-600">Belegg: {price.basisEvidence ?? NOT_STATED}</p>
            <p className="mt-2 text-xs text-slate-500">
              Annonsens mva.-opplysning gir ikke automatisk rett til netto eksportpris eller norsk fradrag.
            </p>
          </Section>

          <Section title="Spesifikasjoner (som oppgitt i annonsen)">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr_auto_1fr]">
              <Row label="1. registrering" value={formatFirstRegistration(specs.firstRegistration)} />
              <Row label="Kilometer" value={formatMileage(specs.mileage)} />
              <Row label="Drivstoff" value={labelOrNotStated(FUEL_LABEL, specs.fuel)} />
              <Row label="Gir" value={labelOrNotStated(TRANSMISSION_LABEL, specs.transmission)} />
              <Row label="Karosseri" value={labelOrNotStated(BODY_LABEL, specs.bodyType)} />
              <Row label="Effekt" value={formatNumber(specs.powerKw, "kW")} />
              <Row
                label="CO2"
                value={specs.co2 ? `${specs.co2.gramsPerKm} g/km (${specs.co2.testMethod})` : NOT_STATED}
              />
              <Row label="Egenvekt" value={formatNumber(specs.curbWeightKg, "kg")} />
              <Row label="Farge" value={specs.color ?? NOT_STATED} />
            </dl>
          </Section>

          <Section title="Estimerte kostnader og bidrag">
            <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
              <strong>Avgiftsstatus: ingen validert skatteprofil.</strong> Kost, avgifter og bidrag er ikke beregnet,
              og marginvarsel er blokkert.
            </div>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                {COST_LINES.map(([label, reason]) => (
                  <tr key={label}>
                    <th scope="row" className="py-1.5 pr-3 text-left font-normal text-slate-700">{label}</th>
                    <td className="py-1.5 text-right italic text-slate-500">ikke beregnet</td>
                    <td className="hidden py-1.5 pl-3 text-xs text-slate-400 sm:table-cell">{reason}</td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <th scope="row" className="py-2 pr-3 text-left">Estimert bidrag før faste kostnader</th>
                  <td className="py-2 text-right italic text-slate-500">ikke beregnet</td>
                  <td className="hidden sm:table-cell" />
                </tr>
              </tbody>
            </table>
            <p className="mt-2 text-xs text-slate-500">Likviditetsbehov: ikke beregnet.</p>
          </Section>

          <Section title="Annonseanalyse">
            <p className="text-sm text-slate-600">
              Ikke kjørt — AI-analyse med belegg kommer i DEV-011. Fravær av skadeomtale betyr ikke at bilen er skadefri.
            </p>
            <h3 className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Annonsetekst (syntetisk)</h3>
            <p className="text-sm">{listing.text ?? NOT_STATED}</p>
          </Section>
        </div>

        <aside className="space-y-6">
          <Section title="Kilde">
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <Row label="Kilde" value="Syntetisk demo" />
              <Row label="Demo-ID" value={listing.sourceListingId} />
              <Row label="Ny i Scout" value={formatDateTime(listing.firstSeenAt)} />
              <Row label="Sist endret i kilde" value={formatDateTime(listing.sourceModifiedAt)} />
            </dl>
            <button
              type="button"
              disabled
              aria-describedby="demo-listing-note"
              className="mt-3 w-full cursor-not-allowed rounded-md bg-slate-300 px-4 py-2 text-sm font-medium text-slate-600"
            >
              Åpne demoannonse
            </button>
            <p id="demo-listing-note" className="mt-1 text-xs text-slate-500">
              Inaktiv: dette er en syntetisk annonse uten originalkilde.
            </p>
          </Section>

          <Section title="Selger">
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <Row label="Type" value={seller ? SELLER_LABEL[seller.type] : NOT_STATED} />
              <Row label="Land" value={seller?.countryCode ?? NOT_STATED} />
              <Row label="Sted" value={seller?.city ?? NOT_STATED} />
            </dl>
          </Section>

          <Section title="Dine forutsetninger">
            {agents.length === 0 && <p className="text-sm text-slate-600">Ingen demo-agent knyttet til annonsen.</p>}
            {agents.map((a) => (
              <div key={a.id} className="text-sm">
                <p className="font-medium">{a.name}{a.status === "paused" ? " (pauset)" : ""}</p>
                <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
                  <Row label="Forventet salgspris" value={formatMoney(a.assumptions.retail?.expectedRetailTotal ?? null)} />
                  <Row label="Min. bidrag" value={formatMoney(a.assumptions.minimumContribution)} />
                  <Row label="Klargjøringsreserve" value={formatMoney(a.assumptions.preparationReserve)} />
                </dl>
                <p className="mt-1 text-xs text-slate-500">{a.assumptions.retail?.priceBasisDescription ?? "Prisgrunnlag ikke oppgitt"}</p>
              </div>
            ))}
          </Section>
        </aside>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="mb-2 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-slate-500">{label}</dt>
      <dd>{value}</dd>
    </>
  );
}

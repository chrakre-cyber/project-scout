import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  BODY_LABEL, CRITERION_LABEL, FUEL_LABEL, RUN_ERROR_LABEL, RUN_STATUS_LABEL, TRANSMISSION_LABEL,
  formatDateTime, formatFirstRegistration, formatMileage, labelOrNotStated,
} from "@/lib/format";
import { formatMoney } from "@/lib/format";
import { RESULTS_PAGE_SIZE, getRun, listRunResults, type StoredResult } from "@/server/search-runs";
import { getSessionContext } from "@/server/session";

export const metadata: Metadata = { title: "Søkekjøring — Project Scout" };

function priceText(snap: StoredResult["snapshot"]): string {
  const p = snap.price;
  if (!p) return snap.withheld?.includes("price") ? "pris lagres ikke (rettighetsprofil)" : "ikke oppgitt";
  const basis = p.basis === "gross" ? "brutto" : p.basis === "net" ? "netto" : "mva.-grunnlag ukjent";
  return p.amountMinor === null
    ? `${p.stated} ${p.currency} (valuta støttes ikke, ikke omregnet) · ${basis}`
    : `${formatMoney({ amountMinor: Number(p.amountMinor), currency: p.currency })} · ${basis}`;
}

export default async function RunPage({
  params, searchParams,
}: { params: Promise<{ id: string; runId: string }>; searchParams: Promise<{ page?: string }> }) {
  const ctx = await getSessionContext();
  if (ctx.status !== "member") redirect("/agents");
  const { id, runId } = await params;
  const run = await getRun(ctx, id, runId);
  if (!run) notFound();
  const pageNo = Math.max(1, Number.parseInt((await searchParams).page ?? "1", 10) || 1);
  const results = run.status === "completed" ? await listRunResults(ctx, run.id, pageNo) : [];
  const total = run.counts ? run.counts.matches + run.counts.needsReview : 0;
  const hasNext = pageNo * RESULTS_PAGE_SIZE < total;
  const f = run.criteria?.filters;

  return (
    <div className="space-y-6">
      <Link href={`/agents/${run.agentId}/runs`} className="text-sm text-slate-600 hover:underline">← Søkekjøringer</Link>
      <div>
        <h1 className="text-2xl font-semibold">Søkekjøring{run.criteria ? `: ${run.criteria.agentName}` : ""}</h1>
        <p className="text-sm text-amber-900">Syntetiske demodata ({run.provider}) — ikke live-annonser fra mobile.de eller annen markedsplass.</p>
      </div>

      <dl data-testid="run-summary" data-status={run.status} className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-slate-500">Status</dt><dd data-testid="run-status">{RUN_STATUS_LABEL[run.status]}</dd>
        <dt className="text-slate-500">Startet</dt><dd>{formatDateTime(run.startedAt)}</dd>
        <dt className="text-slate-500">Avsluttet</dt><dd>{run.finishedAt ? formatDateTime(run.finishedAt) : "ikke avsluttet"}</dd>
        <dt className="text-slate-500">Agentversjon</dt><dd>{run.agentVersion}</dd>
        <dt className="text-slate-500">Slettes automatisk</dt><dd data-testid="run-expires">{formatDateTime(run.expiresAt)} (rettighetsprofil {run.provider} v{run.rightsProfileVersion})</dd>
        {run.counts && (
          <>
            <dt className="text-slate-500">Treff</dt><dd data-testid="run-matches">{run.counts.matches}</dd>
            <dt className="text-slate-500">Må kontrolleres</dt><dd data-testid="run-needs-review">{run.counts.needsReview}</dd>
            <dt className="text-slate-500">Hentet / ekskludert</dt><dd>{run.counts.fetched} / {run.counts.excluded}</dd>
            {run.counts.truncated && <><dt className="text-slate-500">Merknad</dt><dd>Kilden har flere treff enn det som ble hentet eller lagret.</dd></>}
          </>
        )}
      </dl>

      {run.status === "running" && <p role="status" className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">Søket pågår. Last siden på nytt for å se status.</p>}
      {run.status === "failed" && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          {RUN_ERROR_LABEL[run.errorCode ?? "internal"] ?? RUN_ERROR_LABEL.internal}
        </p>
      )}

      {f && (
        <section>
          <h2 className="mb-1 text-lg font-semibold">Kriterier brukt i denne kjøringen</h2>
          <p className="text-sm text-slate-700" data-testid="run-criteria">
            {[
              f.make && `Merke ${f.make}`, f.model && `modell ${f.model}`, f.variant && `variant ${f.variant}`,
              f.yearMin !== null && `fra ${f.yearMin}`, f.yearMax !== null && `til ${f.yearMax}`,
              f.maxMileageKm !== null && `maks ${f.maxMileageKm} km`,
              f.fuels.length > 0 && `drivstoff ${f.fuels.map((x) => labelOrNotStated(FUEL_LABEL, x)).join("/")}`,
              f.transmissions.length > 0 && `girkasse ${f.transmissions.map((x) => labelOrNotStated(TRANSMISSION_LABEL, x)).join("/")}`,
              f.bodyTypes.length > 0 && `karosseri ${f.bodyTypes.map((x) => labelOrNotStated(BODY_LABEL, x)).join("/")}`,
              f.countryCodes.length > 0 && `land ${f.countryCodes.join("/")}`,
              f.maxPrice && `maks annonsepris ${formatMoney(f.maxPrice)}`,
            ].filter(Boolean).join(", ") || "Alle (bredt søk bekreftet)"}
          </p>
        </section>
      )}

      {run.status === "completed" && (
        <section>
          <h2 className="mb-2 text-lg font-semibold">Resultater</h2>
          {total === 0 ? (
            <p data-testid="run-empty" className="text-sm text-slate-600">Ingen annonser i den syntetiske kilden passet kriteriene.</p>
          ) : (
            <ul className="space-y-2" data-testid="run-results">
              {results.map((r) => (
                <li key={r.sourceListingId} data-listing-id={r.sourceListingId} data-match-status={r.matchStatus} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">
                      #{r.rank} {r.snapshot.make ? `${r.snapshot.make} ${r.snapshot.model ?? ""}${r.snapshot.variant ? ` ${r.snapshot.variant}` : ""}` : "Detaljer lagres ikke (rettighetsprofil)"}
                    </span>
                    <span className={r.matchStatus === "match" ? "text-emerald-800" : "text-amber-900"}>
                      {r.matchStatus === "match" ? "Treff" : `Må kontrolleres (ukjent: ${r.unknownCriteria.map((c) => CRITERION_LABEL[c] ?? c).join(", ")})`}
                    </span>
                  </div>
                  <p className="text-slate-600">
                    {formatFirstRegistration(r.snapshot.firstRegistration)} · {formatMileage(r.snapshot.mileage)} · {priceText(r.snapshot)} · syntetisk
                  </p>
                  <Link href={`/opportunities/${encodeURIComponent(r.sourceListingId)}`} className="underline">Se annonse</Link>
                </li>
              ))}
            </ul>
          )}
          <nav className="mt-3 flex gap-4 text-sm">
            {pageNo > 1 && <Link href={`?page=${pageNo - 1}`} className="underline">Forrige</Link>}
            {hasNext && <Link href={`?page=${pageNo + 1}`} className="underline">Neste</Link>}
          </nav>
        </section>
      )}
    </div>
  );
}

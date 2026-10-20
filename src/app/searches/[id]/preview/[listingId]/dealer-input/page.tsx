import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DealerInputForm, type DealerFormLine } from "@/components/search/DealerInputForm";
import { ListingFacts } from "@/components/search/ListingFacts";
import { PUBLIC_ID_PATTERN } from "@/domain/display-policy";
import type { FormValues } from "@/domain/search-economics";
import { formatNokExact } from "@/lib/search-labels";
import { BLOCKED_TEXT, DF_CLAIMS_TITLE, DF_OPTION, DF_PROFILE_NOT_SET, DF_TITLE, DF_UNAVAILABLE } from "@/lib/search-labels";
import { loadEconomicsContext } from "@/server/dealer-economics-context";
import { selectPrefill } from "@/server/dealer-input-flow";
import { getDraft } from "@/server/search-drafts";
import { resolveDealerTarget } from "@/server/search-display";
import { getSessionContext } from "@/server/session";

export const metadata: Metadata = { title: "Forhandleropplysninger — Merovo demo" };
export const dynamic = "force-dynamic";

const minorText = (m: bigint): string => formatNokExact(`${m / 100n}${m % 100n === 0n ? "" : `.${(m % 100n).toString().padStart(2, "0")}`}`);

export default async function DealerInputPage({ params, searchParams }: { params: Promise<{ id: string; listingId: string }>; searchParams: Promise<{ v?: string }> }) {
  const ctx = await getSessionContext();
  if (ctx.status !== "member") redirect("/searches");
  const { id, listingId: raw } = await params;
  const listingId = decodeURIComponent(raw);
  const draft = await getDraft(ctx, id);
  if (!draft || !draft.readable || !PUBLIC_ID_PATTERN.test(listingId)) notFound();
  const back = `/searches/${draft.id}/preview/${encodeURIComponent(listingId)}?v=${draft.version}`;
  if (Number((await searchParams).v) !== draft.version) {
    return <div className="space-y-3" data-testid="stale-version"><p role="alert" className="rounded-lg border border-sand bg-sand-soft p-3">Søket er endret siden resultatet ble vist (gjeldende lagrede versjon er {draft.version}). <Link className="font-semibold text-rust underline" href={`/searches/${draft.id}/preview?v=${draft.version}`}>Tilbake til resultatet</Link></p></div>;
  }
  const economics = await loadEconomicsContext(ctx, draft.id);
  const target = await resolveDealerTarget(draft.spec, listingId, { economics });
  if (target.kind === "source_error") return <p role="alert" className="rounded-lg bg-[#fbeae5] p-3 text-danger">Kilden kunne ikke leses. <Link className="underline" href={back}>Tilbake</Link></p>;
  if (target.kind === "not_found" || target.kind === "not_assessable") notFound();
  if (target.kind === "blocked") return <p role="alert" data-testid="blocked" className="rounded-lg border border-sand bg-sand-soft p-3">{BLOCKED_TEXT[target.reason]} <Link className="underline" href={back}>Tilbake</Link></p>;
  const e = target.item.economics;
  if (e.status === "unavailable") {
    return (
      <div className="space-y-3" data-testid="dealer-form-unavailable">
        <h1 className="text-2xl font-bold">{DF_TITLE}</h1>
        <p role="status" className="rounded-lg border border-sand bg-sand-soft p-3 text-sm">{DF_UNAVAILABLE}</p>
        <Link className="font-semibold text-rust underline" href={back}>Tilbake til detaljene</Link>
      </div>
    );
  }
  const prefill = selectPrefill(economics.storedInputs, target.candidate);
  const lines: DealerFormLine[] = draft.spec.budget.costs
    .filter((c): c is typeof c & { kind: "transport" | "insurance" } => c.kind === "transport" || c.kind === "insurance")
    .map((c) => ({ id: c.id, kind: c.kind, label: c.label, hasAmount: c.amountMinor !== null && c.currency === "NOK", amountText: c.amountMinor === null ? "ukjent beløp" : c.currency === "NOK" ? minorText(c.amountMinor) : `${c.amountMinor / 100n} ${c.currency}` }));
  const p = economics.profile;
  const profileText = { vatHandling: p?.vatHandling ? DF_OPTION.vatHandling[p.vatHandling] : DF_PROFILE_NOT_SET, deduction: p?.deduction ? DF_OPTION.deduction[p.deduction] : DF_PROFILE_NOT_SET };
  const staleReasons = e.dealerInput.state === "needs_reconfirmation" ? e.dealerInput.reasons : [];
  const initial: FormValues = prefill.values;
  return (
    <div className="space-y-5">
      <p><Link className="font-semibold text-rust underline" href={back}>Tilbake til detaljene</Link></p>
      <h1 className="text-3xl font-bold tracking-tight text-forest">{DF_TITLE}</h1>
      <section className="rounded-2xl border border-sand bg-paper p-4 text-sm sm:p-5" aria-labelledby="claims" data-testid="listing-claims">
        <h2 id="claims" className="mb-2 text-lg font-bold">{DF_CLAIMS_TITLE}</h2>
        <ListingFacts listing={target.item.listing} />
      </section>
      <DealerInputForm key={`${target.candidate.id}-${target.candidate.version}-${draft.version}`} searchId={draft.id} listingId={listingId} draftVersion={draft.version} candidate={target.candidate}
        initial={initial} prefill={prefill.source} lines={lines} profile={profileText} staleReasons={staleReasons} backHref={back} />
    </div>
  );
}

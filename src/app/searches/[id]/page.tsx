import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SearchForm } from "@/components/search/SearchForm";
import { SpecSummary } from "@/components/search/SpecSummary";
import { formatDateTime } from "@/lib/format";
import { getDraft } from "@/server/search-drafts";
import { specToFormValues } from "@/server/search-form";
import { getSessionContext } from "@/server/session";
import { DRAFT_SUCCESS, lookup } from "../messages";

export const metadata: Metadata = { title: "Rediger søk — Project Scout" };

export default async function EditSearchPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string }> }) {
  const ctx = await getSessionContext();
  if (ctx.status !== "member") redirect("/searches");
  const draft = await getDraft(ctx, (await params).id);
  if (!draft) notFound();
  const success = lookup(DRAFT_SUCCESS, (await searchParams).msg);
  if (!draft.readable) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">{draft.name}</h1>
        <p role="alert" className="rounded-lg bg-[#fbeae5] p-3 text-sm text-danger">Dette utkastet kan ikke åpnes mot gjeldende katalog. Det er ikke endret.</p>
        <Link className="font-semibold text-rust underline" href="/searches">Tilbake til oversikten</Link>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{draft.name}</h1>
        <p className="text-sm text-muted" data-testid="draft-meta">Utkast (ikke aktiv) · lagret versjon {draft.version} · sist lagret {formatDateTime(draft.updatedAt)} · firma: {ctx.dealership.name}</p>
      </div>
      {success && <p role="status" className="rounded-lg border border-ok/40 bg-[#e5f0e8] p-3 text-sm text-ok">{success}</p>}
      <SpecSummary spec={draft.spec} />
      <h2 className="pt-2 text-xl font-bold">Rediger</h2>
      <SearchForm key={`${draft.id}-${draft.version}`} id={draft.id} version={draft.version} initial={specToFormValues(draft.name, draft.spec)} />
    </div>
  );
}

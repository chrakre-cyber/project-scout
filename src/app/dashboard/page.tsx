import type { Metadata } from "next";
import Link from "next/link";
import { ListingCard } from "@/components/ListingCard";
import { SourceErrorNotice } from "@/components/SourceErrorNotice";
import { getDemoAgent, listDemoAgents } from "@/demo/repository";
import type { NormalizedListing } from "@/domain/types";
import { EMPTY_QUERY, MarketplaceError, getMarketplaceProvider, type SearchPage } from "@/providers/marketplace";

export const metadata: Metadata = { title: "Dashboard — Project Scout demo" };

const PAGE_SIZE = 24;

type View =
  | { kind: "all"; page: SearchPage; pageNumber: number }
  | { kind: "agent"; listings: NormalizedListing[] }
  | { kind: "error"; error: MarketplaceError };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ agent?: string; page?: string }> }) {
  const { agent: agentParam, page: pageParam } = await searchParams;
  const agent = agentParam ? getDemoAgent(agentParam) : null;
  const unknownAgent = Boolean(agentParam) && !agent;
  const pageNumber = /^[1-9]\d{0,3}$/.test(pageParam ?? "") ? Number(pageParam) : 1;
  const agents = listDemoAgents();
  const provider = getMarketplaceProvider();

  let view: View | null = null;
  if (!unknownAgent) {
    try {
      view = agent
        ? {
            kind: "agent",
            // Håndplukket demo-kobling (DEV-001); agentsøk kommer i DEV-004/DEV-005.
            listings: (await Promise.all(agent.demoListingIds.map((id) => provider.getListing(id))))
              .filter((l): l is NormalizedListing => l !== null),
          }
        : { kind: "all", page: await provider.search(EMPTY_QUERY, { page: pageNumber, pageSize: PAGE_SIZE }), pageNumber };
    } catch (e) {
      if (!(e instanceof MarketplaceError)) throw e;
      view = { kind: "error", error: e };
    }
  }

  const listings = view?.kind === "all" ? view.page.items : view?.kind === "agent" ? view.listings : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-slate-600">
          Annonser fra den syntetiske datakilden. Ingen ekte annonser og ingen tilkoblet markedsplass.
        </p>
      </div>

      <section aria-label="Status" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Siste vellykkede søk" value="Aldri kjørt" note="Ingen planlagte søk i demo" />
        <Stat
          label="Annonser i visningen"
          value={String(listings.length)}
          note={view?.kind === "all" ? `av ${view.page.sourceTotal} i syntetisk kilde` : "Syntetiske demoannonser"}
        />
        <Stat label="Relevante treff" value="Ikke vurdert" note="Matching kommer i DEV-010" />
        <Stat label="Når marginmål" value="Ikke beregnet" note="Kost-/bidragsmotor finnes ikke ennå" />
      </section>

      <section aria-label="Filtrer på agent" className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-slate-600">Vis treff for:</span>
        <FilterChip href="/dashboard" active={!agent && !unknownAgent}>Alle syntetiske annonser</FilterChip>
        {agents.map((a) => (
          <FilterChip key={a.id} href={`/dashboard?agent=${a.id}`} active={agent?.id === a.id}>
            {a.name}
          </FilterChip>
        ))}
      </section>

      {unknownAgent && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          Fant ingen demo-agent med denne ID-en. Viser ingen treff.
        </p>
      )}
      {view?.kind === "error" && <SourceErrorNotice error={view.error} />}
      {view?.kind === "all" && view.page.truncated && (
        <p role="status" className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Kilden har flere treff enn den lar oss hente. Resultatet er ufullstendig.
        </p>
      )}
      {view?.kind === "all" && view.page.rejected.length > 0 && (
        <p role="status" className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {view.page.rejected.length} kildepost(er) på denne siden kunne ikke leses og vises ikke.
        </p>
      )}

      {listings.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {listings.map((l) => (
            <li key={l.sourceListingId} className="flex">
              <ListingCard listing={l} />
            </li>
          ))}
        </ul>
      )}
      {view && view.kind !== "error" && listings.length === 0 && <p className="text-sm text-slate-600">Ingen treff.</p>}

      {view?.kind === "all" && (view.pageNumber > 1 || view.page.nextPage) && (
        <nav aria-label="Sider" className="flex items-center justify-between text-sm">
          {view.pageNumber > 1 ? (
            <Link href={`/dashboard?page=${view.pageNumber - 1}`} className="rounded-md border border-slate-300 bg-white px-3 py-1 hover:bg-slate-100">
              ← Forrige
            </Link>
          ) : <span />}
          <span className="text-slate-600">Side {view.pageNumber}</span>
          {view.page.nextPage ? (
            <Link href={`/dashboard?page=${view.page.nextPage}`} className="rounded-md border border-slate-300 bg-white px-3 py-1 hover:bg-slate-100">
              Neste →
            </Link>
          ) : <span />}
        </nav>
      )}
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
      <p className="text-xs text-slate-500">{note}</p>
    </div>
  );
}

function FilterChip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`rounded-full border px-3 py-1 ${active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white hover:bg-slate-100"}`}
    >
      {children}
    </Link>
  );
}

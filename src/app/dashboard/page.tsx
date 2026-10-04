import type { Metadata } from "next";
import Link from "next/link";
import { ListingCard } from "@/components/ListingCard";
import { getDemoAgent, listDemoAgents, listDemoListings } from "@/demo/repository";

export const metadata: Metadata = { title: "Dashboard — Project Scout demo" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ agent?: string }> }) {
  const { agent: agentParam } = await searchParams;
  const agent = agentParam ? getDemoAgent(agentParam) : null;
  const unknownAgent = Boolean(agentParam) && !agent;
  const listings = unknownAgent ? [] : listDemoListings(agent?.id);
  const agents = listDemoAgents();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-slate-600">Oversikt over syntetiske treff. Kortene er ikke koblet til en kilde.</p>
      </div>

      <section aria-label="Status" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Siste vellykkede søk" value="Aldri kjørt" note="Ingen kilde tilkoblet i demo" />
        <Stat label="Annonser i visningen" value={String(listings.length)} note="Syntetiske demoannonser, ikke nye siden forrige kjøring" />
        <Stat label="Relevante treff" value="Ikke vurdert" note="Matching kommer i DEV-010" />
        <Stat label="Når marginmål" value="Ikke beregnet" note="Kost-/bidragsmotor finnes ikke ennå" />
      </section>

      <section aria-label="Filtrer på agent" className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-slate-600">Vis treff for:</span>
        <FilterChip href="/dashboard" active={!agent}>Alle demo-agenter</FilterChip>
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

      {listings.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {listings.map((l) => (
            <li key={l.sourceListingId} className="flex">
              <ListingCard listing={l} />
            </li>
          ))}
        </ul>
      ) : (
        !unknownAgent && <p className="text-sm text-slate-600">Ingen treff.</p>
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

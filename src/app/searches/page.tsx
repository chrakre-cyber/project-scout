import { DP_LINK } from "@/lib/search-labels";
import type { Metadata } from "next";
import Link from "next/link";
import { FlowStrip } from "@/components/merovo/FlowStrip";
import { SpecSummary } from "@/components/search/SpecSummary";
import { formatDateTime } from "@/lib/format";
import { EXAMPLES } from "@/server/search-examples";
import { listDrafts } from "@/server/search-drafts";
import { getSessionContext } from "@/server/session";
import { DRAFT_SUCCESS, lookup } from "./messages";

export const metadata: Metadata = { title: "Søk — Merovo demo" };

export default async function SearchesPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const ctx = await getSessionContext();
  if (ctx.status !== "member") {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Søk</h1>
        <p>Du må være innlogget med en firmakonto for å lage og lagre søk.{" "}
          <Link className="font-semibold text-rust underline" href="/login">Logg inn</Link>.</p>
      </div>
    );
  }
  const { msg } = await searchParams;
  const success = lookup(DRAFT_SUCCESS, msg);
  const drafts = await listDrafts(ctx);
  return (
    <div className="space-y-6">
      <FlowStrip />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-3xl space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-forest">Søk</h1>
          <p className="text-muted">
            Firma: {ctx.dealership.name}. Beskriv bilen kunden vil ha — krav og ønsker — og lagre den som <strong>utkast</strong>. Du kan prøve et lagret utkast mot de
            syntetiske demoannonsene. Utkast er <strong>ikke aktive agenter</strong>: de søker ikke automatisk, sender ingen varsler og teller ikke mot grensen på ti
            aktive agenter. Eksisterende agenter er uendret.
          </p>
        </div>
        <Link href="/searches/new" className="inline-flex min-h-11 items-center rounded-lg bg-forest px-5 py-2 font-semibold text-cream hover:bg-ink" data-testid="new-search">Nytt søk</Link>
      </div>
      <p className="text-sm"><Link href="/searches/economics-profile" className="font-semibold text-rust underline" data-testid="economics-profile-link">{DP_LINK}</Link></p>
      {success && <p role="status" className="rounded-lg border border-ok/40 bg-[#e5f0e8] p-3 text-sm text-ok">{success}</p>}

      <section aria-labelledby="examples" className="rounded-2xl border border-sand bg-paper p-4">
        <h2 id="examples" className="font-bold text-forest">Start fra et demoeksempel</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {EXAMPLES.map((e) => (
            <li key={e.id}><Link className="font-semibold text-rust underline" href={`/searches/new?example=${e.id}`}>{e.title}</Link> — {e.note}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="drafts" className="space-y-3">
        <h2 id="drafts" className="text-xl font-bold text-forest">Lagrede søkeutkast ({drafts.length})</h2>
        {drafts.length === 0 ? <p className="text-muted">Firmaet har ingen lagrede søkeutkast ennå.</p> : (
          <ul className="space-y-3">
            {drafts.map((d) => (
              <li key={d.id} className="rounded-2xl border border-sand bg-paper p-4" data-draft-id={d.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-forest">{d.name}</h3>
                    <p className="text-xs text-muted">Versjon {d.version} · sist lagret {formatDateTime(d.updatedAt)} · utkast (ikke aktiv)</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/searches/${d.id}`} className="min-h-11 rounded-lg border border-forest px-4 py-2 text-sm font-semibold text-forest hover:bg-sand-soft">Åpne og rediger</Link>
                    {d.readable && <Link href={`/searches/${d.id}/preview?v=${d.version}`} className="min-h-11 rounded-lg bg-rust px-4 py-2 text-sm font-semibold text-white hover:bg-rust-dark">Prøv med demodata</Link>}
                  </div>
                </div>
                {d.readable
                  ? <div className="mt-3"><SpecSummary spec={d.spec} /></div>
                  : <p role="alert" className="mt-3 rounded-lg bg-[#fbeae5] p-3 text-sm text-danger">Dette utkastet kan ikke åpnes mot gjeldende katalog og må rettes av en administrator. Det er ikke endret.</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

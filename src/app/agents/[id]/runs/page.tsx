import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { RunButton } from "@/components/RunButton";
import { RUN_STATUS_LABEL, formatDateTime } from "@/lib/format";
import { getAgent } from "@/server/agents";
import { listRuns } from "@/server/search-runs";
import { getSessionContext } from "@/server/session";
import { lookupMessage } from "../../messages";
import { startRunAction } from "./actions";
import { RUN_START_MESSAGES } from "./messages";

export const metadata: Metadata = { title: "Søkekjøringer — Project Scout" };

export default async function RunsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const ctx = await getSessionContext();
  if (ctx.status !== "member") redirect("/agents");
  const { id } = await params;
  const agent = await getAgent(ctx, id);
  if (!agent) notFound();
  const { error } = await searchParams;
  const errorText = error ? lookupMessage(RUN_START_MESSAGES, error) ?? RUN_START_MESSAGES.failed : null;
  const runs = await listRuns(ctx, agent.id);
  const active = agent.status === "active";
  const token = crypto.randomUUID(); // engangstoken for dette skjemaet: dobbeltklikk gir samme kjøring

  return (
    <div className="space-y-6">
      <Link href="/agents" className="text-sm text-slate-600 hover:underline">← Mine agenter</Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Søkekjøringer: {agent.name}</h1>
          <p className="text-sm text-slate-600">
            Manuelt søk mot den <strong>syntetiske demokilden</strong>. Ingen live mobile.de-data og ingen margin- eller avgiftsberegning.
          </p>
        </div>
        <form action={startRunAction}>
          <input type="hidden" name="agentId" value={agent.id} />
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="version" value={agent.version} />
          <RunButton disabled={!active} />
          {!active && <p className="mt-1 text-xs text-slate-500">Agenten må være aktiv for å kjøre søk.</p>}
        </form>
      </div>
      {errorText && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{errorText}</p>}

      <section>
        <h2 className="mb-2 text-lg font-semibold">Historikk</h2>
        {runs.length === 0 ? (
          <p className="text-sm text-slate-600">Ingen kjøringer ennå.</p>
        ) : (
          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white" data-testid="run-history">
            {runs.map((r) => (
              <li key={r.id} data-run-id={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <span>{formatDateTime(r.startedAt)} · agentversjon {r.agentVersion}</span>
                <span className="flex items-center gap-3">
                  <span data-status={r.status}>{RUN_STATUS_LABEL[r.status]}</span>
                  {r.counts && <span>{r.counts.matches} treff, {r.counts.needsReview} må kontrolleres</span>}
                  <Link href={`/agents/${agent.id}/runs/${r.id}`} className="underline">Åpne</Link>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

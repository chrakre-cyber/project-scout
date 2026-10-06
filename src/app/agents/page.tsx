import type { Metadata } from "next";
import Link from "next/link";
import { activationIssues } from "@/domain/agent-validation";
import type { AgentFilters, SearchAgent } from "@/domain/types";
import { listDemoAgents } from "@/demo/repository";
import {
  BODY_LABEL, FUEL_LABEL, TRANSMISSION_LABEL, formatDateTime, formatMoney, formatNumber, formatReserve,
  formatRetailBasis,
} from "@/lib/format";
import { agentToDraft } from "@/server/agent-records";
import { listAgents } from "@/server/agents";
import { getSessionContext } from "@/server/session";
import { setActiveAction } from "./actions";
import { AGENT_MESSAGES, SUCCESS_MESSAGES, lookupMessage } from "./messages";

export const metadata: Metadata = { title: "Mine agenter — Project Scout" };

/** Grensen fra DEC-003 håndheves i databasen; visningen bare forklarer den. */
const MAX_ACTIVE_AGENTS = 10;

export default async function AgentsPage({ searchParams }: { searchParams: Promise<{ error?: string; msg?: string }> }) {
  const ctx = await getSessionContext();
  if (ctx.status !== "member") return <DemoAgents ctxStatus={ctx.status} />;
  const { error, msg } = await searchParams;
  const agents = await listAgents(ctx);
  const activeCount = agents.filter((a) => a.status === "active").length;
  const successText = lookupMessage(SUCCESS_MESSAGES, msg);
  const errorText = error ? lookupMessage(AGENT_MESSAGES, error) ?? AGENT_MESSAGES.failed : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Mine agenter</h1>
          <p className="text-sm text-slate-600">
            Firma: {ctx.dealership.name}. <strong>{activeCount} av maks {MAX_ACTIVE_AGENTS} aktive.</strong> Grensen håndheves av databasen.
          </p>
          <p className="text-xs text-slate-500">Aktiv betyr at agenten er aktivert. Du kan kjøre søk manuelt mot den syntetiske demokilden; automatisk søk finnes ikke, og det hentes ingen live mobile.de-data.</p>
        </div>
        <Link href="/agents/new" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">Ny agent</Link>
      </div>
      {errorText && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{errorText}</p>}
      {successText && <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{successText}</p>}

      {agents.length === 0 ? (
        <p className="text-sm text-slate-600">Firmaet har ingen agenter ennå.</p>
      ) : (
        <ul className="space-y-4">{agents.map((a) => <StoredAgentCard key={a.id} agent={a} />)}</ul>
      )}
    </div>
  );
}

function StoredAgentCard({ agent: a }: { agent: SearchAgent }) {
  const issues = activationIssues(agentToDraft(a));
  const active = a.status === "active";
  return (
    <li id={`agent-${a.id}`} data-agent-id={a.id} className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{a.name}</h2>
          <p className="text-xs text-slate-500">
            Versjon {a.version} · Siste vellykkede søk: {a.lastSuccessAt ? formatDateTime(a.lastSuccessAt) : "aldri kjørt"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span data-status={a.status} className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${active ? "bg-emerald-100 text-emerald-900" : "bg-slate-200 text-slate-700"}`}>
            {active ? "Aktiv" : "Ikke aktiv"}
          </span>
          <Link href={`/agents/${a.id}`} className="rounded-md border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100">Rediger</Link>
          <Link href={`/agents/${a.id}/runs`} className="rounded-md border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100">Søkekjøringer</Link>
          <form action={setActiveAction}>
            <input type="hidden" name="id" value={a.id} />
            <input type="hidden" name="active" value={active ? "false" : "true"} />
            <button
              type="submit" disabled={!active && issues.length > 0}
              className="rounded-md bg-slate-900 px-3 py-1 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
            >
              {active ? "Pause" : "Aktiver"}
            </button>
          </form>
        </div>
      </div>
      {!active && (issues.length === 0
        ? <p className="mt-2 text-xs font-medium text-emerald-800">Klar for aktivering.</p>
        : (
          <div className="mt-2 text-xs text-amber-900">
            <p className="font-medium">Kan ikke aktiveres ennå:</p>
            <ul className="list-disc pl-5">{issues.map((i) => <li key={i}>{i}</li>)}</ul>
          </div>
        ))}
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
          {filterRows(a.filters).map(([k, v]) => <Row key={k} label={k} value={v} />)}
          {a.filters.make === null && <Row label="Bredt søk" value={a.broadSearchConfirmed ? "bekreftet" : "ikke bekreftet"} />}
        </dl>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
          <Row label="Forventet salgspris" value={formatMoney(a.assumptions.retail.expectedRetailTotal)} />
          <Row label="Prisgrunnlag" value={formatRetailBasis(a.assumptions.retail.priceBasis)} />
          <Row label="Min. bidrag" value={formatMoney(a.assumptions.minimumContribution)} />
          <Row label="Klargjøringsreserve" value={formatReserve(a.assumptions.preparationReserve)} />
        </dl>
      </div>
    </li>
  );
}

function DemoAgents({ ctxStatus }: { ctxStatus: "not_configured" | "anonymous" | "no_membership" }) {
  const notice =
    ctxStatus === "anonymous" ? "Logg inn for å se og opprette firmaets lagrede agenter."
    : ctxStatus === "no_membership" ? "Brukeren er ikke knyttet til et firma. Kontakt prosjekteier."
    : null;
  const agents = listDemoAgents();
  const activeCount = agents.filter((a) => a.status === "active").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Mine agenter</h1>
          <p className="text-sm text-slate-600">
            {activeCount} av maks {MAX_ACTIVE_AGENTS} aktive (demo). Agentene er syntetiske og lagres ikke.
          </p>
          {notice && <p className="mt-1 text-sm font-medium text-slate-700">{notice}</p>}
        </div>
        <div className="text-right">
          <button
            type="button"
            disabled
            aria-describedby="create-agent-note"
            className="cursor-not-allowed rounded-md bg-slate-300 px-4 py-2 text-sm font-medium text-slate-600"
          >
            Opprett agent
          </button>
          <p id="create-agent-note" className="mt-1 text-xs text-slate-500">
            Ikke tilgjengelig i demo — krever innlogging og firmatilknytning.
          </p>
        </div>
      </div>

      <ul className="space-y-4">
        {agents.map((a) => (
          <li key={a.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">{a.name}</h2>
                <p className="text-xs text-slate-500">
                  Versjon {a.version} · Siste vellykkede søk: {a.lastSuccessAt ? formatDateTime(a.lastSuccessAt) : "aldri kjørt"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    a.status === "active" ? "bg-emerald-100 text-emerald-900" : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {a.status === "active" ? "Aktiv (demo)" : "Pauset"}
                </span>
                <Link href={`/dashboard?agent=${a.id}`} className="rounded-md border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100">
                  Vis {a.demoListingIds.length} treff
                </Link>
              </div>
            </div>

            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Filtre</h3>
                <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
                  {filterRows(a.filters).map(([k, v]) => (
                    <Row key={k} label={k} value={v} />
                  ))}
                </dl>
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Kalkyleforutsetninger (syntetiske eksempler)
                </h3>
                <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
                  <Row label="Forventet salgspris" value={formatMoney(a.assumptions.retail.expectedRetailTotal)} />
                  <Row label="Prisgrunnlag" value={formatRetailBasis(a.assumptions.retail.priceBasis)} />
                  <Row label="Min. bidrag" value={formatMoney(a.assumptions.minimumContribution)} />
                  <Row label="Klargjøringsreserve" value={formatReserve(a.assumptions.preparationReserve)} />
                </dl>
                <p className="mt-2 text-xs text-slate-500">
                  Lagret salgspris betyr ikke at margin er beregnet. Ingen kost- eller avgiftsberegning finnes i demoen.
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
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

const ANY = "alle";

function filterRows(f: AgentFilters): [string, string][] {
  const list = <K extends string>(items: K[], labels: Record<K, string>) =>
    items.length ? items.map((i) => labels[i]).join(", ") : ANY;
  const years =
    f.yearMin === null && f.yearMax === null ? ANY : `${f.yearMin ?? "…"}–${f.yearMax ?? "…"}`;
  return [
    ["Merke / modell", [f.make, f.model, f.variant].filter(Boolean).join(" ") || ANY],
    ["Årsmodell", years],
    ["Maks km", f.maxMileageKm === null ? ANY : formatNumber(f.maxMileageKm, "km")],
    ["Drivstoff", list(f.fuels, FUEL_LABEL)],
    ["Gir", list(f.transmissions, TRANSMISSION_LABEL)],
    ["Karosseri", list(f.bodyTypes, BODY_LABEL)],
    ["Land", f.countryCodes.length ? f.countryCodes.join(", ") : ANY],
    ["Maks annonsepris", f.maxPrice ? formatMoney(f.maxPrice) : ANY],
  ];
}

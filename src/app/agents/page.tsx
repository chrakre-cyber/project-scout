import type { Metadata } from "next";
import Link from "next/link";
import type { AgentFilters } from "@/domain/types";
import { listDemoAgents } from "@/demo/repository";
import {
  BODY_LABEL, FUEL_LABEL, NOT_STATED, TRANSMISSION_LABEL, formatDateTime, formatMoney, formatNumber,
} from "@/lib/format";

export const metadata: Metadata = { title: "Mine agenter — Project Scout demo" };

/** Demo viser alltid grensen fra DEC-003; håndheving på server kommer i DEV-004. */
const MAX_ACTIVE_AGENTS = 10;

export default function AgentsPage() {
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
            Ikke tilgjengelig i demo — lagring av agenter kommer i DEV-004.
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
                  <Row label="Forventet salgspris" value={formatMoney(a.assumptions.retail?.expectedRetailTotal ?? null)} />
                  <Row label="Prisgrunnlag" value={a.assumptions.retail?.priceBasisDescription ?? NOT_STATED} />
                  <Row label="Min. bidrag" value={formatMoney(a.assumptions.minimumContribution)} />
                  <Row label="Klargjøringsreserve" value={formatMoney(a.assumptions.preparationReserve)} />
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
    ["Merke / modell", [f.make, f.model].filter(Boolean).join(" ") || ANY],
    ["Årsmodell", years],
    ["Maks km", f.maxMileageKm === null ? ANY : formatNumber(f.maxMileageKm, "km")],
    ["Drivstoff", list(f.fuels, FUEL_LABEL)],
    ["Gir", list(f.transmissions, TRANSMISSION_LABEL)],
    ["Karosseri", list(f.bodyTypes, BODY_LABEL)],
    ["Land", f.countryCodes.length ? f.countryCodes.join(", ") : ANY],
    ["Maks annonsepris", f.maxPrice ? formatMoney(f.maxPrice) : ANY],
  ];
}

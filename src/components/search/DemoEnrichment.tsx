import { Fragment } from "react";
import type { ListingEnrichment } from "@/server/demo-media";

/** Demoberiket informasjon om bilen. Ikke fra kilden og ikke søkekriterier; påvirker aldri «Oppfyller kravene». Ukjent felt vises ikke som tall. */
export function DemoEnrichment({ info: e }: { info: ListingEnrichment }) {
  const rows: [string, string | null][] = [
    ["Batteristatus", e.batteryHealthPct === null ? null : `${String(e.batteryHealthPct).replace(".", ",")} %`],
    ["Batterikapasitet", e.batteryCapacityKwh === null ? null : `${e.batteryCapacityKwh} kWh`],
    ["Effekt", e.powerHp === null ? null : `${e.powerHp} hk`],
    ["Hjuldrift", e.driveTrain],
    ["Lakk", e.paintName],
    ["Interiørfarge", e.interiorColor],
    ["Eiere", e.owners === null ? null : String(e.owners)],
  ];
  return (
    <section className="rounded-2xl border border-sand bg-paper p-4 sm:p-5" aria-labelledby="enrich" data-testid="demo-enrichment">
      <h2 id="enrich" className="mb-1 text-lg font-bold">Demoberiket informasjon</h2>
      <p className="mb-2 text-xs text-muted">Kuratert demodata om bilen. Ikke fra et annonseformat, ikke søkekriterier og ikke brukt i vurderingen av kravene.</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm sm:grid-cols-[12rem_1fr]">
        {rows.map(([k, v]) => <Fragment key={k}><dt className="text-muted">{k}</dt><dd>{v ?? "ikke oppgitt"}</dd></Fragment>)}
        <dt className="text-muted">Kjent utstyr</dt>
        <dd>{e.knownEquipment.length > 0 ? e.knownEquipment.join(", ") : "ikke oppgitt"}</dd>
      </dl>
    </section>
  );
}

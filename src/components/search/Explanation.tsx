import type { CriterionExplanation, VehicleEvaluation } from "@/domain/search-v2/types";
import { CRITERION_STATUS_LABEL, criterionLabel, reasonLabel } from "@/lib/search-labels";
import { equipmentLabel } from "@/lib/search-summary";


const label = (c: CriterionExplanation) => criterionLabel(c.criterion, equipmentLabel);
const TONE = { fulfilled: "text-ok", not_fulfilled: "text-danger", unknown: "text-muted" } as const;
const MARK = { fulfilled: "✓", not_fulfilled: "✗", unknown: "?" } as const;

function Row({ c }: { c: CriterionExplanation }) {
  return (
    <li className="flex gap-2" data-criterion={c.criterion} data-status={c.status}>
      <span aria-hidden="true" className={`w-4 flex-none font-bold ${TONE[c.status]}`}>{MARK[c.status]}</span>
      <span>
        <span className="font-semibold">{label(c)}:</span>{" "}
        <span className={TONE[c.status]}>{CRITERION_STATUS_LABEL[c.status]}</span>
        {c.status !== "fulfilled" && <span className="text-muted"> — {reasonLabel(c.reason)}</span>}
      </span>
    </li>
  );
}

/** Forklaring per krav og ønske. Ønsker påvirker aldri om bilen oppfyller kravene. */
export function Explanation({ vehicle }: { vehicle: VehicleEvaluation }) {
  const must = vehicle.criteria.filter((c) => c.priority === "must");
  const nice = vehicle.criteria.filter((c) => c.priority === "nice");
  return (
    <div className="grid gap-3 text-sm md:grid-cols-2" data-testid="explanation">
      <div>
        <h4 className="font-bold">Krav</h4>
        {must.length ? <ul className="mt-1 space-y-1">{must.map((c) => <Row key={c.criterion} c={c} />)}</ul> : <p className="text-muted">Ingen krav å vurdere.</p>}
      </div>
      <div>
        <h4 className="font-bold">Ønsker</h4>
        {nice.length ? <ul className="mt-1 space-y-1">{nice.map((c) => <Row key={c.criterion} c={c} />)}</ul> : <p className="text-muted">Ingen ønsker er satt.</p>}
      </div>
    </div>
  );
}

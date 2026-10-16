import type { CriterionExplanation, VehicleEvaluation } from "@/domain/search-v2/types";
import { CRITERION_STATUS_LABEL, criterionLabel, reasonLabel } from "@/lib/search-labels";
import { equipmentLabel } from "@/lib/search-summary";

const label = (c: CriterionExplanation) => criterionLabel(c.criterion, equipmentLabel);

/**
 * Visuell behandling per (prioritet, status). Ikon og tekst følger alltid med fargen.
 *  - Krav ukjent = «Må kontrolleres» (ravgul, krever oppmerksomhet — ikke feilrød).
 *  - Ønske ukjent = «Ikke oppgitt» (nøytral, aldri som feil). Ønske ikke oppfylt er dempet, ikke rød: ønsker utelukker aldri.
 *  - Bare et kjent brudd på et krav er rødt.
 */
function look(c: CriterionExplanation): { mark: string; tone: string; text: string } {
  if (c.priority === "must") {
    if (c.status === "fulfilled") return { mark: "✓", tone: "text-ok", text: CRITERION_STATUS_LABEL.fulfilled };
    if (c.status === "not_fulfilled") return { mark: "✕", tone: "text-danger", text: CRITERION_STATUS_LABEL.not_fulfilled };
    return { mark: "◐", tone: "text-[#6b4a07]", text: "Må kontrolleres" };
  }
  if (c.status === "fulfilled") return { mark: "✓", tone: "text-ok", text: CRITERION_STATUS_LABEL.fulfilled };
  if (c.status === "not_fulfilled") return { mark: "–", tone: "text-[#7a3a29]", text: CRITERION_STATUS_LABEL.not_fulfilled };
  return { mark: "?", tone: "text-muted", text: CRITERION_STATUS_LABEL.unknown };
}

function Row({ c }: { c: CriterionExplanation }) {
  const l = look(c);
  return (
    <li className="flex gap-2" data-criterion={c.criterion} data-status={c.status}>
      <span aria-hidden="true" className={`w-4 flex-none text-center font-bold ${l.tone}`}>{l.mark}</span>
      <span>
        <span className="font-semibold">{label(c)}:</span>{" "}
        <span className={l.tone}>{l.text}</span>
        {c.status !== "fulfilled" && <span className="text-muted"> — {reasonLabel(c.reason)}</span>}
      </span>
    </li>
  );
}

/** Forklaring per krav og ønske, i to adskilte flater. Ønsker påvirker aldri om bilen oppfyller kravene. */
export function Explanation({ vehicle }: { vehicle: VehicleEvaluation }) {
  const must = vehicle.criteria.filter((c) => c.priority === "must");
  const nice = vehicle.criteria.filter((c) => c.priority === "nice");
  return (
    <div className="grid gap-3 text-sm md:grid-cols-2" data-testid="explanation">
      <div className="rounded-xl border-l-4 border-forest bg-cream p-3" data-group="must">
        <h4 className="font-bold text-forest">Krav <span className="font-normal text-muted">(må ha)</span></h4>
        {must.length ? <ul className="mt-1 space-y-1">{must.map((c) => <Row key={c.criterion} c={c} />)}</ul> : <p className="text-muted">Ingen krav å vurdere.</p>}
      </div>
      <div className="rounded-xl border-l-4 border-sand bg-paper p-3" data-group="nice">
        <h4 className="font-bold text-forest">Ønsker <span className="font-normal text-muted">(ønskelig — utelukker aldri)</span></h4>
        {nice.length ? <ul className="mt-1 space-y-1">{nice.map((c) => <Row key={c.criterion} c={c} />)}</ul> : <p className="text-muted">Ingen ønsker er satt.</p>}
      </div>
    </div>
  );
}

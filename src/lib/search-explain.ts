/**
 * Forklaringstekst og visningsrekkefølge for søkeresultater (DEV-006C). Rene funksjoner uten I/O, bygget bare på
 * `VehicleEvaluation` (SEARCH-002). Ingen ny score, ingen statusendring, ingen skjult antakelse:
 *  - status kommer alltid fra domenet; teksten her gjengir bare hva vurderingen sier,
 *  - ukjent er ukjent (aldri «ikke oppfylt», aldri 0),
 *  - ønsker påvirker aldri status — kun rekkefølgen INNEN en statusgruppe (visning).
 * Ingen avgifts-, mva.- eller totalkostnadslogikk. Teksten antyder aldri fullt eller økonomisk verifisert treff.
 */
import type { CriterionExplanation, VehicleEvaluation } from "@/domain/search-v2/types";
import { criterionLabel } from "@/lib/search-labels";
import { equipmentLabel } from "@/lib/search-summary";

const label = (c: CriterionExplanation) => criterionLabel(c.criterion, equipmentLabel);
const of = (v: VehicleEvaluation, priority: "must" | "nice", status: CriterionExplanation["status"]) =>
  v.criteria.filter((c) => c.priority === priority && c.status === status);
const list = (cs: CriterionExplanation[]) => cs.map((c) => label(c).toLowerCase()).join(", ");

export interface WishCounts { total: number; fulfilled: number; notFulfilled: number; unknown: number }
export function wishCounts(v: VehicleEvaluation): WishCounts {
  const f = of(v, "nice", "fulfilled").length, n = of(v, "nice", "not_fulfilled").length, u = of(v, "nice", "unknown").length;
  return { total: f + n + u, fulfilled: f, notFulfilled: n, unknown: u };
}

/** «1 av 2 ønsker oppfylt, 1 ukjent». Tom streng-erstatning når ingen ønsker er satt. */
export function wishSummary(v: VehicleEvaluation): string {
  const w = wishCounts(v);
  if (w.total === 0) return "Ingen ønsker er satt.";
  const parts = [`${w.fulfilled} av ${w.total} ${w.total === 1 ? "ønske" : "ønsker"} oppfylt`];
  if (w.notFulfilled > 0) parts.push(`${w.notFulfilled} ikke oppfylt`);
  if (w.unknown > 0) parts.push(w.unknown === 1 ? "1 ukjent" : `${w.unknown} ukjente`);
  return parts.join(", ");
}

/** «Alle 5 krav er oppfylt», «4 av 5 krav oppfylt, 1 må kontrolleres», «1 av 5 krav er ikke oppfylt». */
export function mustSummary(v: VehicleEvaluation): string {
  const must = v.criteria.filter((c) => c.priority === "must");
  if (must.length === 0) return "Ingen krav å vurdere.";
  const ok = of(v, "must", "fulfilled").length, bad = of(v, "must", "not_fulfilled").length, unk = of(v, "must", "unknown").length;
  if (bad === 0 && unk === 0) return `Alle ${must.length} ${must.length === 1 ? "krav" : "krav"} er oppfylt.`;
  const parts = [`${ok} av ${must.length} krav oppfylt`];
  if (bad > 0) parts.push(`${bad} ikke oppfylt`);
  if (unk > 0) parts.push(`${unk} må kontrolleres`);
  return parts.join(", ") + ".";
}

/** Kort setning om hvorfor bilen vises i sin gruppe. Gjengir kun vurderingen; sier ingenting om pris eller totalkostnad. */
export function whyShown(v: VehicleEvaluation): string {
  if (v.status === "excluded") {
    const bad = of(v, "must", "not_fulfilled");
    return `Vises blant biler som ikke oppfyller kravene: ${list(bad)} er kjent ikke oppfylt. Ønsker kan ikke veie opp for et kravbrudd.`;
  }
  const w = wishCounts(v);
  const wish = w.total === 0 ? "" : ` ${wishSummary(v)}.`;
  if (v.status === "needs_review") {
    return `Ingen krav er kjent brutt, men ${list(of(v, "must", "unknown"))} er ikke oppgitt i annonsen og må kontrolleres hos kilden.${wish}`;
  }
  return `Alle krav er oppfylt etter opplysningene i annonsen.${wish} Dette er ikke et økonomisk verifisert treff.`;
}

/**
 * Rekkefølge for visning INNEN en statusgruppe: flest oppfylte ønsker først. Stabil (ellers lik rekkefølge beholdes), endrer
 * ikke status og er ikke en score. Ukjente og ikke-oppfylte ønsker teller ikke som oppfylt og straffes ikke utover det.
 * Kravstatus har forrang fordi funksjonen bare skal brukes på elementer i samme gruppe; eventuelle blandede lister sorteres
 * først etter kravstatus (match, needs_review, excluded).
 */
const STATUS_ORDER = { match: 0, needs_review: 1, excluded: 2 } as const;
export function orderForPresentation<T extends { assessment: { vehicle: VehicleEvaluation } }>(items: readonly T[]): T[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const va = a.item.assessment.vehicle, vb = b.item.assessment.vehicle;
      return STATUS_ORDER[va.status] - STATUS_ORDER[vb.status] || wishCounts(vb).fulfilled - wishCounts(va).fulfilled || a.index - b.index;
    })
    .map((x) => x.item);
}

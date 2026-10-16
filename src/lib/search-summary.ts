/**
 * Oppsummering av et søk på norsk (SEARCH-005): hva som kreves, hva som er ønsket og hva som IKKE er satt.
 * Ren presentasjon over den interne modellen — ingen beregning av avgifter og ingen vurdering av biler.
 * Budsjettgrensen er bare «budsjett + valgt prisavvik» (domenets `upperLimitMinor`); den er en grense og ikke et beregnet treff.
 */
import { DEMO_BRANDS, DEMO_EQUIPMENT_GROUPS, DEMO_EXTERIOR_COLORS, DEMO_INTERIOR_COLORS, DEMO_INTERIOR_MATERIALS, DEMO_MODELS } from "@/adapters/search-catalog/demo-catalog";
import type { CatalogOption } from "@/adapters/search-catalog/demo-catalog";
import { upperLimitMinor } from "@/domain/search-v2/budget";
import type { PrioritizedList, SearchSpec } from "@/domain/search-v2/types";
import type { FirstRegistration } from "@/domain/types";
import { BODY_LABEL, FUEL_LABEL, TRANSMISSION_LABEL, formatMoney } from "@/lib/format";
import { FIXED_COSTS, SCENARIO_LABEL } from "@/lib/search-labels";

const DRIVE_LABEL = { awd: "Firehjulsdrift", fwd: "Forhjulsdrift", rwd: "Bakhjulsdrift" } as const;
const VAT_LABEL = { incl: "inkl. mva.", excl: "ekskl. mva.", none: "uten mva." } as const;
const fmtInt = (n: number) => new Intl.NumberFormat("nb-NO").format(n);

const labelOf = (opts: readonly CatalogOption[], key: string) => opts.find((o) => o.key === key)?.label ?? key;

export function equipmentLabel(key: string): string | undefined {
  for (const g of DEMO_EQUIPMENT_GROUPS) for (const i of g.items) if (i.key === key) return i.label;
  return undefined;
}
export const brandLabel = (key: string) => labelOf(DEMO_BRANDS, key);
export const modelLabel = (brand: string, model: string) => DEMO_MODELS[brand]?.find((m) => m.key === model)?.label ?? model;

function regLabel(fr: FirstRegistration | null): string {
  if (!fr) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return fr.precision === "year" ? `${fr.year}` : fr.precision === "month" ? `${p(fr.month)}.${fr.year}` : `${p(fr.day)}.${p(fr.month)}.${fr.year}`;
}
function range(min: number | null, max: number | null, unit = ""): string {
  const u = unit ? ` ${unit}` : "";
  if (min !== null && max !== null) return min === max ? `${fmtInt(min)}${u}` : `${fmtInt(min)}–${fmtInt(max)}${u}`;
  if (min !== null) return `fra ${fmtInt(min)}${u}`;
  return `til ${fmtInt(max ?? 0)}${u}`;
}

export interface SpecSummary {
  /** Krav (alltid absolutte, pluss «Må ha»-utstyr/-farger). */
  must: string[];
  /** Ønsker («Ønskelig»). Påvirker aldri om bilen oppfyller kravene. */
  wishes: string[];
  /** Krav som IKKE er satt (ingen begrensning). */
  notSet: string[];
  budget: string[];
  /** Kostnadsforutsetninger (ikke beregnet). */
  costs: string[];
  registration: string;
}

export function summarizeSpec(spec: SearchSpec): SpecSummary {
  const must: string[] = [];
  const wishes: string[] = [];
  const notSet: string[] = [];
  const v = spec.vehicle, r = spec.requirements;
  if (v.brand) must.push(`Merke: ${brandLabel(v.brand)}`); else notSet.push("Merke");
  if (v.model && v.brand) must.push(`Modell: ${modelLabel(v.brand, v.model)}`); else notSet.push("Modell");
  if (v.variant) must.push(`Variant inneholder «${v.variant}»`);
  if (r.modelYear) must.push(`Modellår: ${range(r.modelYear.min, r.modelYear.max)}`); else notSet.push("Modellår");
  if (r.firstRegistration) {
    const { from, to } = r.firstRegistration;
    must.push(`Førstegangsregistrering: ${from && to ? `${regLabel(from)}–${regLabel(to)}` : from ? `fra ${regLabel(from)}` : `til ${regLabel(to)}`}`);
  } else notSet.push("Førstegangsregistrering");
  if (r.maxMileageKm !== null) must.push(`Kilometerstand: høyst ${fmtInt(r.maxMileageKm)} km`); else notSet.push("Kilometerstand");
  if (r.seats) must.push(`Antall seter: ${range(r.seats.min, r.seats.max)}`); else notSet.push("Antall seter");
  const list = (title: string, items: string[]) => { if (items.length) must.push(`${title}: ${items.join(" eller ")}`); else notSet.push(title); };
  list("Karosseri", r.bodyTypes.map((b) => BODY_LABEL[b]));
  list("Drivstoff", r.fuels.map((f) => FUEL_LABEL[f]));
  list("Girkasse", r.transmissions.map((t) => TRANSMISSION_LABEL[t]));
  list("Hjuldrift", r.driveTrains.map((d) => DRIVE_LABEL[d]));
  const pl = (title: string, l: PrioritizedList | null, opts: readonly CatalogOption[]) => {
    if (!l) { notSet.push(title); return; }
    (l.priority === "must" ? must : wishes).push(`${title}: ${l.values.map((k) => labelOf(opts, k)).join(" eller ")}`);
  };
  pl("Utvendig farge", spec.appearance.exteriorColors, DEMO_EXTERIOR_COLORS);
  pl("Interiørfarge", spec.appearance.interiorColors, DEMO_INTERIOR_COLORS);
  pl("Interiørmateriale", spec.appearance.interiorMaterials, DEMO_INTERIOR_MATERIALS);
  for (const e of spec.equipment) (e.priority === "must" ? must : wishes).push(equipmentLabel(e.key) ?? e.key);

  const b = spec.budget;
  const budget: string[] = [];
  if (b.maxTotalNokMinor === null) budget.push("Budsjett er ikke satt.");
  else {
    budget.push(`Maks innkjøpskostnad til Norge: ${formatMoney({ amountMinor: Number(b.maxTotalNokMinor), currency: "NOK" })}`);
    if (b.deviationBasisPoints === null) budget.push("Prisavvik: ikke valgt.");
    else {
      const upper = upperLimitMinor(b);
      budget.push(`Prisavvik: ${new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 2 }).format(b.deviationBasisPoints / 100)} % → øvre grense ${upper === null ? "—" : formatMoney({ amountMinor: Number(upper), currency: "NOK" })}. Dette er en grense, ikke et beregnet treff.`);
    }
  }
  const costs = b.costs.map((c) => {
    const name = c.kind === "custom" ? c.label : FIXED_COSTS.find((f) => f.kind === c.kind)?.label ?? c.label;
    const amount = c.amountMinor === null ? `beløp ikke oppgitt (${c.currency})` : formatMoney({ amountMinor: Number(c.amountMinor), currency: c.currency });
    return `${name}: ${amount}${c.vatBasis ? `, ${VAT_LABEL[c.vatBasis]}` : ""} · ${c.includedInBudget ? "inngår i budsjettet" : "inngår ikke i budsjettet"}`;
  });
  return { must, wishes, notSet, budget, costs, registration: SCENARIO_LABEL[spec.plannedRegistration.requested] };
}

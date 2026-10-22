/** ECON-005a: eksplisitt behandling av alle søkekostnadslinjer (plan P1/P4). Ren. */
import type { EconomicsResult } from "@/domain/economics";
import type { CostLine, SearchSpec } from "@/domain/search-v2/types";
import type { CostLineTreatment, LineScope } from "./types";

const ORE_PER_NOK = 100n;
/** Komponenten kan ikke allerede inneholde linjens beløp (ukjent eller uttrykkelig 0) ⇒ ingen risiko for dobbelttelling. */
const emptyComponent = (n: bigint | null): boolean => n === null || n === 0n;
const isSplit = (s: LineScope): s is { split: { toBorderMinor: bigint; afterBorderMinor: bigint } } => typeof s === "object" && s !== null && "split" in s;

function line(c: CostLine, treatment: CostLineTreatment["treatment"], counted: boolean, reason: string | null): CostLineTreatment {
  return { id: c.id, kind: c.kind, label: c.label, amountMinor: c.amountMinor, treatment, counted, reason };
}

/**
 * Hele-NOK-verdier de støttede nærmeste-krone-policyene (half_up, half_even; uavklart policy viser en av dem) kan gi for `amountMinor` (øre):
 * under 50 øre ned, over 50 opp. Eksakt 50 øre: half_up gir alltid q+1; half_even gir partall, dvs. q+1 når q er oddetall og q når q er partall.
 * Kandidatsettet er derfor {q+1} for oddetalls-q og {q, q+1} for partalls-q (1,50 ⇒ bare 2; 2,50 ⇒ 2 eller 3). 0,99 NOK gir 1 NOK, aldri 0.
 */
const roundingCandidates = (amountMinor: bigint): bigint[] => {
  const q = amountMinor / ORE_PER_NOK;
  const r = amountMinor % ORE_PER_NOK;
  if (r === 0n || r < 50n) return [q];
  if (r > 50n) return [q + 1n];
  return q % 2n === 1n ? [q + 1n] : [q, q + 1n];
};

/** Kjernens komponent (hele NOK) er nøyaktig linjens beløp avrundet etter en støttet nærmeste-krone-regel. Ingen toleranse; ukjent komponent dekker ikke. */
const covers = (componentNok: bigint | null, amountMinor: bigint): boolean => componentNok !== null && amountMinor >= 0n && roundingCandidates(amountMinor).includes(componentNok);

/**
 * Hver linje får nøyaktig én behandling. Regler:
 *  - ikke inkludert i budsjettet ⇒ `not_included` (synlig, ikke i total);
 *  - ukjent beløp ⇒ `unknown_amount` (ikke i total; totalen er nedre grense); valuta ≠ NOK, ukjent mva.-grunnlag eller `excl` (brutto budsjettbeløp ukjent) ⇒ `unsupported` (ikke omregnet, ikke antatt, ikke i total);
 *  - bekreftet omfang krever at kjernens komponent er nøyaktig linjens beløp avrundet til hele NOK (eksplisitt mapping, ingen toleranse); ellers `mapped_component_missing`;
 *  - `transport`/`insurance` med bekreftet omfang ⇒ `mapped_to_input` (allerede i økonomikjernens komponent; telles ikke på nytt); ubekreftet ⇒ `unmapped_unknown_scope`:
 *    telles som kostnad BARE når kjernens tilsvarende komponent(er) er ukjent eller uttrykkelig 0 (ellers kan beløpet allerede være med, og en nedre grense må ikke dobbelttelle);
 *  - øvrige kinder ⇒ `added_to_total` som valgt kostnad (DEC-030), aldri i tollverdi/mva.-grunnlag.
 */
export function treatCostLines(spec: SearchSpec, result: EconomicsResult, scopes: Readonly<Record<string, LineScope>> = {}): CostLineTreatment[] {
  return spec.budget.costs.map((c): CostLineTreatment => {
    if (!c.includedInBudget) return line(c, "not_included", false, null);
    if (c.amountMinor === null) return line(c, "unknown_amount", false, "amount_unknown");
    if (c.currency !== "NOK") return line(c, "unsupported", false, "currency_not_nok");
    if (c.vatBasis === null) return line(c, "unsupported", false, "vat_basis_unknown");
    // Eksklusiv mva.: det finnes ingen sats eller brutto sluttbeløp på linjen, og denne skiven innfører ingen mva.-regel for tillegg. Beløpet bevares, men linjen forblir uavklart.
    if (c.vatBasis === "excl") return line(c, "unsupported", false, "vat_basis_excl_gross_unknown");
    const amount = c.amountMinor;
    if (c.kind === "transport") {
      const s = scopes[c.id] ?? "unconfirmed";
      if (s === "unconfirmed") { const free = emptyComponent(result.transportToBorderNok) && emptyComponent(result.transportAfterBorderNok); return line(c, "unmapped_unknown_scope", free, free ? "scope_unconfirmed" : "scope_unconfirmed_possible_overlap"); }
      if (s === "to_border") return covers(result.transportToBorderNok, amount) ? line(c, "mapped_to_input", false, null) : line(c, "unsupported", false, "mapped_component_missing");
      if (s === "after_border") return covers(result.transportAfterBorderNok, amount) ? line(c, "mapped_to_input", false, null) : line(c, "unsupported", false, "mapped_component_missing");
      if (isSplit(s)) {
        if (s.split.toBorderMinor < 0n || s.split.afterBorderMinor < 0n || s.split.toBorderMinor + s.split.afterBorderMinor !== amount) return line(c, "unsupported", false, "split_sum_mismatch");
        return covers(result.transportToBorderNok, s.split.toBorderMinor) && covers(result.transportAfterBorderNok, s.split.afterBorderMinor) ? line(c, "mapped_to_input", false, null) : line(c, "unsupported", false, "mapped_component_missing");
      }
      return line(c, "unsupported", false, "scope_not_valid_for_kind");
    }
    if (c.kind === "insurance") {
      const s = scopes[c.id] ?? "unconfirmed";
      if (s === "unconfirmed") { const free = emptyComponent(result.insuranceNok); return line(c, "unmapped_unknown_scope", free, free ? "scope_unconfirmed" : "scope_unconfirmed_possible_overlap"); }
      if (s === "to_border") return covers(result.insuranceNok, amount) ? line(c, "mapped_to_input", false, null) : line(c, "unsupported", false, "mapped_component_missing");
      if (s === "other") return line(c, "added_to_total", true, null);
      return line(c, "unsupported", false, "scope_not_valid_for_kind");
    }
    return line(c, "added_to_total", true, null);
  });
}

/** Linjer som er fullt behandlet (kan dekkes av totalen): ingen usikkerhet gjenstår. */
export const isResolved = (l: CostLineTreatment): boolean => l.treatment === "mapped_to_input" || l.treatment === "added_to_total" || l.treatment === "not_included";

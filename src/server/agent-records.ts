/**
 * Validering av ny agent og mapping mellom databaserad og domenemodell.
 * Rene funksjoner (ingen I/O), slik at grensen kan testes uten database.
 *
 * DEV-002 lagrer bare navn og merke/modell. Fullstendige filtre,
 * økonomiforutsetninger, aktivering og pause kommer i DEV-004.
 */
import { moneyFromDb, moneyToDb, type MoneyDb } from "@/domain/currency";
import type { AgentAssumptions, AgentFilters, SearchAgent } from "@/domain/types";

export interface NewAgentInput {
  name: string;
  make: string | null;
  model: string | null;
}

export type ValidationResult = { ok: true; value: NewAgentInput } | { ok: false; errors: string[] };

const text = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");

/** Leser bare kjente felt. Eventuelle firma-ID-er o.l. i skjemaet ignoreres. */
export function validateNewAgent(form: FormData): ValidationResult {
  const name = text(form.get("name"));
  const make = text(form.get("make"));
  const model = text(form.get("model"));
  const errors: string[] = [];
  if (name.length < 1 || name.length > 120) errors.push("Navn må være 1–120 tegn.");
  if (make.length > 60) errors.push("Merke kan være maks 60 tegn.");
  if (model.length > 60) errors.push("Modell kan være maks 60 tegn.");
  if (model && !make) errors.push("Modell krever merke.");
  return errors.length ? { ok: false, errors } : { ok: true, value: { name, make: make || null, model: model || null } };
}

type FiltersDb = Omit<AgentFilters, "maxPrice"> & { maxPrice: MoneyDb | null };

export function filtersToDb(f: AgentFilters): FiltersDb {
  return { ...f, maxPrice: f.maxPrice ? moneyToDb(f.maxPrice) : null };
}

export function emptyFiltersFor(input: NewAgentInput): AgentFilters {
  return {
    make: input.make, model: input.model, yearMin: null, yearMax: null, maxMileageKm: null,
    fuels: [], transmissions: [], bodyTypes: [], countryCodes: [], maxPrice: null,
  };
}

export interface AgentRow {
  id: string;
  name: string;
  filters: unknown;
  assumptions: unknown;
  active: boolean;
  version: number;
  last_success_at: string | null;
}

const obj = (v: unknown): Record<string, unknown> => (typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {});
const strOrNull = (v: unknown) => (typeof v === "string" ? v : null);
const intOrNull = (v: unknown) => (Number.isSafeInteger(v) ? (v as number) : null);
const arr = <T extends string>(v: unknown): T[] => (Array.isArray(v) ? v.filter((x): x is T => typeof x === "string") : []);
const moneyOrNull = (v: unknown) => (v == null ? null : moneyFromDb(v));

/** Databaserad → domene. Penger går gjennom moneyFromDb; ukjent forblir null. */
export function agentFromRow(row: AgentRow): SearchAgent {
  const f = obj(row.filters);
  const a = obj(row.assumptions);
  const retail = obj(a.retail);
  const filters: AgentFilters = {
    make: strOrNull(f.make), model: strOrNull(f.model),
    yearMin: intOrNull(f.yearMin), yearMax: intOrNull(f.yearMax), maxMileageKm: intOrNull(f.maxMileageKm),
    fuels: arr(f.fuels), transmissions: arr(f.transmissions), bodyTypes: arr(f.bodyTypes), countryCodes: arr(f.countryCodes),
    maxPrice: moneyOrNull(f.maxPrice),
  };
  const assumptions: AgentAssumptions = {
    retail: a.retail == null ? null : {
      expectedRetailTotal: moneyFromDb(retail.expectedRetailTotal),
      priceBasisDescription: strOrNull(retail.priceBasisDescription) ?? "",
    },
    minimumContribution: moneyOrNull(a.minimumContribution),
    preparationReserve: moneyOrNull(a.preparationReserve),
  };
  return {
    id: row.id, name: row.name, status: row.active ? "active" : "paused",
    filters, assumptions, version: row.version, lastSuccessAt: row.last_success_at,
  };
}

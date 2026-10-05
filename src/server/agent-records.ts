/**
 * Mapping mellom databaserad (search_agents) og domenemodell. Ren, ingen I/O.
 * Penger går gjennom DEC-020-formatet (tekst ved databasegrensen).
 * Manglende nøkler (f.eks. agenter lagret i DEV-002) leses som null/«alle».
 */
import { moneyFromDb, moneyToDb, type MoneyDb } from "@/domain/currency";
import type { AgentDraft } from "@/domain/agent-validation";
import type { AgentAssumptions, AgentFilters, InclusionBasis, Money, SearchAgent } from "@/domain/types";

export interface AgentRow {
  id: string;
  name: string;
  filters: unknown;
  assumptions: unknown;
  active: boolean;
  version: number;
  last_success_at: string | null;
}

export const AGENT_COLUMNS = "id, name, filters, assumptions, active, version, last_success_at";

const dbMoney = (m: Money | null): MoneyDb | null => (m ? moneyToDb(m) : null);
/** Klargjøringsreserve kan være 0 kr; ellers samme format. */
const dbMoneyAllowZero = (m: Money | null): MoneyDb | null =>
  m === null ? null : m.amountMinor === 0 ? { amountMinor: "0", currency: m.currency } : moneyToDb(m);

/** Domene → kolonner for insert/update. Firma-ID, active og version settes aldri her. */
export function draftToDb(d: AgentDraft) {
  const f = d.filters;
  const a = d.assumptions;
  return {
    name: d.name.trim(),
    filters: { ...f, maxPrice: dbMoney(f.maxPrice), broadSearchConfirmed: d.broadSearchConfirmed },
    assumptions: {
      retail: { expectedRetailTotal: dbMoney(a.retail.expectedRetailTotal), priceBasis: { ...a.retail.priceBasis } },
      minimumContribution: dbMoney(a.minimumContribution),
      preparationReserve: { amount: dbMoneyAllowZero(a.preparationReserve.amount), vatBasis: a.preparationReserve.vatBasis },
    },
  };
}

const obj = (v: unknown): Record<string, unknown> => (typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const strOrNull = (v: unknown) => (typeof v === "string" ? v : null);
const intOrNull = (v: unknown) => (Number.isSafeInteger(v) ? (v as number) : null);
const arr = <T extends string>(v: unknown): T[] => (Array.isArray(v) ? v.filter((x): x is T => typeof x === "string") : []);
const moneyOrNull = (v: unknown) => (v == null ? null : moneyFromDb(v));
const moneyOrNullAllowZero = (v: unknown): Money | null => {
  const o = obj(v);
  if (v != null && o.amountMinor === "0" && typeof o.currency === "string") return { amountMinor: 0, currency: o.currency };
  return moneyOrNull(v);
};
const oneOf = <T extends string>(v: unknown, allowed: readonly T[]): T | null =>
  typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : null;
const INCL: readonly InclusionBasis[] = ["included", "excluded"];

/** Databaserad → domene. Ukjent forblir null; penger med feil format gir MoneyBoundaryError. */
export function agentFromRow(row: AgentRow): SearchAgent {
  const f = obj(row.filters);
  const a = obj(row.assumptions);
  const retail = obj(a.retail);
  const basis = obj(retail.priceBasis);
  const reserve = obj(a.preparationReserve);
  const filters: AgentFilters = {
    make: strOrNull(f.make), model: strOrNull(f.model), variant: strOrNull(f.variant),
    yearMin: intOrNull(f.yearMin), yearMax: intOrNull(f.yearMax), maxMileageKm: intOrNull(f.maxMileageKm),
    fuels: arr(f.fuels), transmissions: arr(f.transmissions), bodyTypes: arr(f.bodyTypes), countryCodes: arr(f.countryCodes),
    maxPrice: moneyOrNull(f.maxPrice),
  };
  const assumptions: AgentAssumptions = {
    retail: {
      expectedRetailTotal: moneyOrNull(retail.expectedRetailTotal),
      priceBasis: { vat: oneOf(basis.vat, INCL), registrationTaxes: oneOf(basis.registrationTaxes, INCL) },
    },
    minimumContribution: moneyOrNull(a.minimumContribution),
    preparationReserve: { amount: moneyOrNullAllowZero(reserve.amount), vatBasis: oneOf(reserve.vatBasis, ["ex_vat", "incl_vat"] as const) },
  };
  return {
    id: row.id, name: row.name, status: row.active ? "active" : "paused",
    filters, broadSearchConfirmed: f.broadSearchConfirmed === true, assumptions,
    version: row.version, lastSuccessAt: row.last_success_at,
  };
}

export function agentToDraft(a: SearchAgent): AgentDraft {
  return { name: a.name, filters: a.filters, broadSearchConfirmed: a.broadSearchConfirmed, assumptions: a.assumptions };
}

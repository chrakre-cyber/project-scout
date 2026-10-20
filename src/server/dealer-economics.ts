/**
 * ECON-005c — forhandlerinput: validering, bekreftelse og lesing (server-modul uten I/O; lagringen ligger bak `DealerEconomicsStore`, se `dealer-economics-store.ts`).
 *
 * Regler:
 *  - firma kommer ALLTID fra den validerte sesjonen (`dealershipId` parameter) og avgjøres til slutt av databasen (RLS + trigger); klientinput inneholder aldri firma-id
 *    (parseren avviser det som ukjent nøkkel);
 *  - hele dokumentet valideres av `parseDealerInput` før lagring OG når et lagret dokument leses (korrupt/utdatert lagring behandles som ingen input, ikke som tillit);
 *  - bekreftelseskonteksten (kostnadsgrunnlag, scenario, rettighetsavtrykk) beregnes av serveren fra gjeldende søk og rettigheter — aldri fra klienten;
 *  - bare forhandlerinput lagres. Avledede beregningsresultater lagres aldri (E9).
 */
import { DEALER_INPUT_SCHEMA_VERSION, parseDealerInput, parseDealerProfile, validateLineScopes } from "@/domain/search-economics";
import type { ConfirmationContext, DealerInputV1, DealerProfileV1, InputIssue, StoredDealerInput } from "@/domain/search-economics";
import type { ResolvedRights } from "@/domain/provider-rights";
import type { SearchSpec } from "@/domain/search-v2/types";
import { bindingFor, confirmationContextFor } from "./search-economics";

export interface DealerInputRow {
  dealershipId: string;
  searchId: string;
  candidateId: string;
  candidateVersion: string;
  inputSchemaVersion: number;
  payload: unknown;
  context: unknown;
  confirmedBy: string | null;
  confirmedAt: string;
}
export interface DealerInputKey { searchId: string; candidateId: string; candidateVersion: string; inputSchemaVersion: number }
export type SaveError = "search_not_found" | "rejected" | "unavailable";

/** Lagringsgrensesnitt. Implementasjonen kjører som innlogget bruker under RLS (aldri service-role). */
export interface DealerEconomicsStore {
  getInput(key: DealerInputKey): Promise<DealerInputRow | null>;
  /** Oppretter eller erstatter bekreftelsen for nøkkelen. Firma, bruker og tidspunkt settes av databasen. */
  saveInput(key: DealerInputKey, payload: DealerInputV1, context: ConfirmationContext): Promise<{ ok: true } | { ok: false; code: SaveError }>;
  getProfile(): Promise<{ dealershipId: string; payload: unknown } | null>;
  saveProfile(payload: DealerProfileV1): Promise<{ ok: true } | { ok: false; code: SaveError }>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

const isContext = (v: unknown): v is ConfirmationContext => {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return Object.keys(o).sort().join() === "costBasis,registrationScenario,rightsDigest" && typeof o.costBasis === "string" && typeof o.registrationScenario === "string"
    && typeof o.rightsDigest === "string" && /^[0-9a-f]{64}$/.test(o.rightsDigest);
};

export type ConfirmResult =
  | { ok: true }
  | { ok: false; code: "invalid_search" | "invalid_input" | SaveError; issues?: InputIssue[] };

/**
 * Bekrefter forhandlerinput for (søk, kandidat, revisjon). `raw` er ubetrodd klientinput. Linjeomfang valideres mot søkets kostnadslinjer (eksisterende linje, tillatt type, split = linjens beløp).
 * `dealershipId` brukes ikke til skriving (databasen utleder firma fra medlemskapet); den finnes for å kontrollere at lagret binding stemmer ved lesing.
 */
export async function confirmDealerInput(store: DealerEconomicsStore, a: {
  searchId: string; candidate: { id: string; version: string }; spec: SearchSpec; rights: ResolvedRights; raw: unknown;
}): Promise<ConfirmResult> {
  if (!isUuid(a.searchId)) return { ok: false, code: "invalid_search" };
  const parsed = parseDealerInput(a.raw);
  if (!parsed.ok) return { ok: false, code: "invalid_input", issues: parsed.issues };
  // Omfang/fordeling valideres mot AKTUELLE kostnadslinjer før lagring: linjen finnes, typen tillater omfanget, og en split summerer nøyaktig til linjens beløp.
  const scopeIssues = validateLineScopes(parsed.value.lineScopes, a.spec.budget.costs);
  if (scopeIssues.length > 0) return { ok: false, code: "invalid_input", issues: scopeIssues };
  const key: DealerInputKey = { searchId: a.searchId, candidateId: a.candidate.id, candidateVersion: a.candidate.version, inputSchemaVersion: DEALER_INPUT_SCHEMA_VERSION };
  const saved = await store.saveInput(key, parsed.value, confirmationContextFor(a.spec, a.rights));
  return saved.ok ? { ok: true } : { ok: false, code: saved.code };
}

/**
 * Lagret forhandlerinput for kandidaten, eller null. Raden må tilhøre `dealershipId` (sesjonen) og nøkkelen; payload og kontekst valideres på nytt.
 * En rad som ikke kan leses trygt (korrupt, ukjent schema) gir null — aldri delvis tillit.
 */
export async function loadStoredInput(store: DealerEconomicsStore, a: { dealershipId: string; searchId: string; candidate: { id: string; version: string } }): Promise<StoredDealerInput | null> {
  if (!isUuid(a.searchId)) return null;
  const row = await store.getInput({ searchId: a.searchId, candidateId: a.candidate.id, candidateVersion: a.candidate.version, inputSchemaVersion: DEALER_INPUT_SCHEMA_VERSION });
  if (row === null) return null;
  if (row.dealershipId !== a.dealershipId || row.searchId !== a.searchId) return null; // forsvar i dybden: RLS skal allerede ha filtrert
  const parsed = parseDealerInput(row.payload);
  if (!parsed.ok || !isContext(row.context) || row.confirmedBy === null) return null;
  return {
    binding: bindingFor(row.dealershipId, row.searchId, { id: row.candidateId, version: row.candidateVersion }),
    input: parsed.value, context: row.context, confirmedBy: row.confirmedBy, confirmedAt: row.confirmedAt,
  };
}

export async function loadDealerProfile(store: DealerEconomicsStore, dealershipId: string): Promise<DealerProfileV1 | null> {
  const row = await store.getProfile();
  if (row === null || row.dealershipId !== dealershipId) return null;
  const p = parseDealerProfile(row.payload);
  return p.ok ? p.value : null;
}

export async function saveDealerProfile(store: DealerEconomicsStore, raw: unknown): Promise<{ ok: true } | { ok: false; code: "invalid_input" | SaveError; issues?: InputIssue[] }> {
  const parsed = parseDealerProfile(raw);
  if (!parsed.ok) return { ok: false, code: "invalid_input", issues: parsed.issues };
  const saved = await store.saveProfile(parsed.value);
  return saved.ok ? { ok: true } : { ok: false, code: saved.code };
}

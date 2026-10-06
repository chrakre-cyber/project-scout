import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { RunCounts, ResultSnapshot, SearchRunErrorCode, SearchRunStatus } from "@/domain/search-run";
import type { AgentFilters } from "@/domain/types";
import { getMarketplaceProvider, type MarketplaceProvider } from "@/providers/marketplace";
import { agentFromRow } from "./agent-records";
import { runSearchPipeline, type PipelineOptions, type ResultRow } from "./search-pipeline";
import type { SessionContext } from "./session";

type Member = Extract<SessionContext, { status: "member" }>;

/**
 * Orkestrering av manuelle søkekjøringer (DEV-005, DEC-026). Serveren sender bare agent-ID, forespørselstoken og
 * forventet agentversjon; firma, agentversjon og kriteriesnapshot utledes av databasen. Matching skjer i domenet.
 */

export type RunStartError = "not_found" | "inactive" | "not_ready" | "stale_agent" | "already_running" | "invalid" | "failed";

export interface SearchRun {
  id: string;
  agentId: string;
  agentVersion: number;
  provider: string;
  status: SearchRunStatus;
  criteria: { agentName: string; filters: AgentFilters; schemaVersion: number } | null;
  counts: RunCounts | null;
  errorCode: SearchRunErrorCode | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface StoredResult {
  rank: number;
  sourceListingId: string;
  matchStatus: "match" | "needs_review";
  unknownCriteria: string[];
  snapshot: ResultSnapshot;
}

export type RunStartResult =
  | { ok: true; run: SearchRun; replayed: boolean }
  | { ok: false; code: RunStartError; runId?: string };

const RUN_COLUMNS = "id, agent_id, agent_version, provider, status, criteria_snapshot, counts, error_code, started_at, finished_at";
const RESULT_COLUMNS = "rank, source_listing_id, match_status, unknown_criteria, listing_snapshot";
const CHUNK = 250;
export const RESULTS_PAGE_SIZE = 50;

interface RunRow {
  id: string; agent_id: string; agent_version: number; provider: string; status: SearchRunStatus;
  criteria_snapshot: unknown; counts: unknown; error_code: SearchRunErrorCode | null; started_at: string; finished_at: string | null;
}

export interface RunDeps {
  provider?: MarketplaceProvider;
  pipeline?: PipelineOptions;
}

const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

async function client() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase er ikke konfigurert");
  return supabase;
}

function runFromRow(row: RunRow): SearchRun {
  const snap = typeof row.criteria_snapshot === "object" && row.criteria_snapshot !== null ? (row.criteria_snapshot as Record<string, unknown>) : null;
  let criteria: SearchRun["criteria"] = null;
  if (snap) {
    try {
      const agent = agentFromRow({ id: row.agent_id, name: String(snap.agentName ?? ""), filters: snap.filters, assumptions: snap.assumptions, active: true, version: row.agent_version, last_success_at: null });
      criteria = { agentName: agent.name, filters: agent.filters, schemaVersion: Number(snap.schemaVersion ?? 0) };
    } catch {
      criteria = null; // uleselig snapshot vises som «ikke tilgjengelig», aldri som tomme (=alle) kriterier
    }
  }
  return {
    id: row.id, agentId: row.agent_id, agentVersion: row.agent_version, provider: row.provider, status: row.status,
    criteria, counts: (row.counts as RunCounts | null) ?? null, errorCode: row.error_code, startedAt: row.started_at, finishedAt: row.finished_at,
  };
}

function mapInsertError(error: { code?: string; message?: string; details?: string }): RunStartError {
  const msg = `${error.message ?? ""} ${error.details ?? ""}`;
  if (error.code === "42501") return "not_found"; // samme svar for ukjent og fremmed agent (ingen sidekanal)
  if (error.code === "23514") {
    if (msg.includes("search_run_agent_inactive")) return "inactive";
    if (msg.includes("search_run_agent_not_ready")) return "not_ready";
    if (msg.includes("search_run_stale_agent")) return "stale_agent";
    return "invalid";
  }
  if (error.code === "23505" && msg.includes("search_runs_one_running_per_agent")) return "already_running";
  return "failed";
}

/**
 * Starter og kjører en søkekjøring til den er avsluttet. Samme (agent, token) gir aldri en ny kjøring:
 * dobbeltklikk/replay returnerer den eksisterende (idempotens). Bare én kjøring per agent kan pågå.
 */
export async function startSearchRun(
  ctx: Member, agentId: string, token: string, expectedVersion: number | null, deps: RunDeps = {},
): Promise<RunStartResult> {
  if (!isUuid(agentId) || !isUuid(token)) return { ok: false, code: "invalid" };
  const provider = deps.provider ?? getMarketplaceProvider();
  const supabase = await client();

  const ins = await supabase
    .from("search_runs")
    .insert({ agent_id: agentId, request_token: token, requested_agent_version: expectedVersion, provider: provider.source })
    .select(RUN_COLUMNS).single();

  if (ins.error) {
    const code = mapInsertError(ins.error);
    const blocked = `${ins.error.message ?? ""} ${ins.error.details ?? ""}`;
    if (ins.error.code === "23505" && blocked.includes("search_runs_token_key")) {
      const existing = await supabase.from("search_runs").select(RUN_COLUMNS).eq("agent_id", agentId).eq("request_token", token).maybeSingle();
      if (existing.data) return { ok: true, run: runFromRow(existing.data as RunRow), replayed: true };
      return { ok: false, code: "failed" };
    }
    if (code === "already_running") {
      const running = await supabase.from("search_runs").select("id").eq("agent_id", agentId).eq("status", "running").maybeSingle();
      return { ok: false, code, runId: (running.data as { id: string } | null)?.id };
    }
    return { ok: false, code };
  }

  const run = runFromRow(ins.data as RunRow);
  if (!run.criteria) return fail(supabase, run, "internal");

  try {
    const outcome = await runSearchPipeline(provider, run.criteria.filters, deps.pipeline);
    if (!outcome.ok) return fail(supabase, run, outcome.errorCode);
    const stored = await storeResults(supabase, run.id, provider.source, outcome.rows);
    if (!stored) return fail(supabase, run, "internal");
    const done = await supabase
      .from("search_runs").update({ status: "completed", counts: outcome.counts })
      .eq("id", run.id).eq("status", "running").select(RUN_COLUMNS).maybeSingle();
    if (done.error || !done.data) return fail(supabase, run, "internal");
    return { ok: true, run: runFromRow(done.data as RunRow), replayed: false };
  } catch {
    return fail(supabase, run, "internal");
  }
}

type Supabase = Awaited<ReturnType<typeof client>>;

async function storeResults(supabase: Supabase, runId: string, source: string, rows: ResultRow[]): Promise<boolean> {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK).map((r) => ({
      search_run_id: runId, source, source_listing_id: r.sourceListingId, content_hash: r.contentHash, rank: r.rank,
      match_status: r.matchStatus, unknown_criteria: r.unknownCriteria, listing_snapshot: r.snapshot,
    }));
    const { error } = await supabase.from("search_run_results").insert(chunk);
    if (error) return false;
  }
  return true;
}

/** Aldri la en kjøring bli stående som «running»: marker som feilet (best effort; stale-opprydding tar resten). */
async function fail(supabase: Supabase, run: SearchRun, code: SearchRunErrorCode): Promise<RunStartResult> {
  const { data } = await supabase
    .from("search_runs").update({ status: "failed", error_code: code })
    .eq("id", run.id).eq("status", "running").select(RUN_COLUMNS).maybeSingle();
  return { ok: true, run: data ? runFromRow(data as RunRow) : { ...run, status: "failed", errorCode: code }, replayed: false };
}

export async function listRuns(ctx: Member, agentId: string, limit = 20): Promise<SearchRun[]> {
  if (!isUuid(agentId)) return [];
  const supabase = await client();
  const { data, error } = await supabase
    .from("search_runs").select(RUN_COLUMNS).eq("agent_id", agentId).eq("dealership_id", ctx.dealership.id)
    .order("started_at", { ascending: false }).limit(limit);
  if (error) throw new Error(`Kunne ikke hente kjøringer (${error.code})`);
  return (data as RunRow[]).map(runFromRow);
}

export async function getRun(ctx: Member, agentId: string, runId: string): Promise<SearchRun | null> {
  if (!isUuid(agentId) || !isUuid(runId)) return null;
  const supabase = await client();
  const { data, error } = await supabase
    .from("search_runs").select(RUN_COLUMNS).eq("id", runId).eq("agent_id", agentId).eq("dealership_id", ctx.dealership.id).maybeSingle();
  if (error) throw new Error(`Kunne ikke hente kjøring (${error.code})`);
  return data ? runFromRow(data as RunRow) : null;
}

export async function listRunResults(ctx: Member, runId: string, page: number): Promise<StoredResult[]> {
  if (!isUuid(runId) || !Number.isSafeInteger(page) || page < 1) return [];
  const supabase = await client();
  const from = (page - 1) * RESULTS_PAGE_SIZE;
  const { data, error } = await supabase
    .from("search_run_results").select(RESULT_COLUMNS).eq("search_run_id", runId).eq("dealership_id", ctx.dealership.id)
    .order("rank").range(from, from + RESULTS_PAGE_SIZE - 1);
  if (error) throw new Error(`Kunne ikke hente resultater (${error.code})`);
  return (data as { rank: number; source_listing_id: string; match_status: "match" | "needs_review"; unknown_criteria: string[]; listing_snapshot: ResultSnapshot }[])
    .map((r) => ({ rank: r.rank, sourceListingId: r.source_listing_id, matchStatus: r.match_status, unknownCriteria: r.unknown_criteria, snapshot: r.listing_snapshot }));
}

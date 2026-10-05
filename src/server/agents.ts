import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { activationIssues, type AgentDraft } from "@/domain/agent-validation";
import type { SearchAgent } from "@/domain/types";
import { AGENT_COLUMNS, agentFromRow, agentToDraft, draftToDb, type AgentRow } from "./agent-records";
import type { SessionContext } from "./session";

type Member = Extract<SessionContext, { status: "member" }>;

export type AgentWriteError =
  | "not_found" | "conflict" | "forbidden" | "active_limit" | "not_ready" | "invalid" | "active_requires_complete" | "failed";

export type AgentWriteResult = { ok: true; agent: SearchAgent } | { ok: false; code: AgentWriteError; issues?: string[] };

/** Agenter for brukerens firma. RLS begrenser; firmafilteret er ekstra forsvar. */
export async function listAgents(ctx: Member): Promise<SearchAgent[]> {
  const supabase = await client();
  const { data, error } = await supabase
    .from("search_agents").select(AGENT_COLUMNS).eq("dealership_id", ctx.dealership.id).order("created_at");
  if (error) throw new Error(`Kunne ikke hente agenter (${error.code})`);
  return (data as AgentRow[]).map(agentFromRow);
}

export async function getAgent(ctx: Member, id: string): Promise<SearchAgent | null> {
  if (!isUuid(id)) return null;
  const supabase = await client();
  const { data, error } = await supabase
    .from("search_agents").select(AGENT_COLUMNS).eq("id", id).eq("dealership_id", ctx.dealership.id).maybeSingle();
  if (error) throw new Error(`Kunne ikke hente agent (${error.code})`);
  return data ? agentFromRow(data as AgentRow) : null;
}

/** Ny agent i brukerens firma, alltid ikke aktiv. dealership_id kommer fra membership. */
export async function createAgent(ctx: Member, draft: AgentDraft): Promise<AgentWriteResult> {
  const supabase = await client();
  const { data, error } = await supabase
    .from("search_agents")
    .insert({ ...draftToDb(draft), dealership_id: ctx.dealership.id, active: false })
    .select(AGENT_COLUMNS).single();
  return error ? { ok: false, code: mapError(error) } : { ok: true, agent: agentFromRow(data as AgentRow) };
}

/**
 * Lagrer endringer. `expectedVersion` hindrer at samtidige endringer overskriver
 * hverandre (brukes bare til konfliktsjekk, ikke til autorisasjon).
 * En aktiv agent må forbli komplett; ellers må den pauses først.
 */
export async function updateAgent(ctx: Member, id: string, expectedVersion: number, draft: AgentDraft): Promise<AgentWriteResult> {
  const current = await getAgent(ctx, id);
  if (!current) return { ok: false, code: "not_found" };
  if (current.version !== expectedVersion) return { ok: false, code: "conflict" };
  if (current.status === "active") {
    const issues = activationIssues(draft);
    if (issues.length) return { ok: false, code: "active_requires_complete", issues };
  }
  const supabase = await client();
  const { data, error } = await supabase
    .from("search_agents")
    .update(draftToDb(draft))
    .eq("id", id).eq("dealership_id", ctx.dealership.id).eq("version", expectedVersion)
    .select(AGENT_COLUMNS).maybeSingle();
  if (error) return { ok: false, code: mapError(error) };
  return data ? { ok: true, agent: agentFromRow(data as AgentRow) } : { ok: false, code: "conflict" };
}

/**
 * Aktiver eller pause. Aktivering valideres på serveren og håndheves av
 * databasen (CHECK for komplett agent, trigger for maks 10 aktive).
 */
export async function setAgentActive(ctx: Member, id: string, active: boolean): Promise<AgentWriteResult> {
  const current = await getAgent(ctx, id);
  if (!current) return { ok: false, code: "not_found" };
  if (current.status === (active ? "active" : "paused")) return { ok: true, agent: current };
  if (active) {
    const issues = activationIssues(agentToDraft(current));
    if (issues.length) return { ok: false, code: "not_ready", issues };
  }
  const supabase = await client();
  const { data, error } = await supabase
    .from("search_agents")
    .update({ active })
    .eq("id", id).eq("dealership_id", ctx.dealership.id)
    .select(AGENT_COLUMNS).maybeSingle();
  if (error) return { ok: false, code: mapError(error) };
  return data ? { ok: true, agent: agentFromRow(data as AgentRow) } : { ok: false, code: "not_found" };
}

async function client() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase er ikke konfigurert");
  return supabase;
}

function mapError(error: { code?: string; message?: string }): AgentWriteError {
  const msg = error.message ?? "";
  if (error.code === "42501") return "forbidden";
  if (error.code === "23514" && msg.includes("active_agent_limit")) return "active_limit";
  if (error.code === "23514" && msg.includes("search_agents_ready_when_active")) return "not_ready";
  if (error.code === "23514") return "invalid";
  return "failed";
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

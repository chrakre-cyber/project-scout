import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SearchAgent } from "@/domain/types";
import { agentFromRow, emptyFiltersFor, filtersToDb, type AgentRow, type NewAgentInput } from "./agent-records";
import type { SessionContext } from "./session";

type Member = Extract<SessionContext, { status: "member" }>;

const COLUMNS = "id, name, filters, assumptions, active, version, last_success_at";

/** Agenter for brukerens firma. RLS begrenser; firmafilteret er ekstra forsvar. */
export async function listAgents(ctx: Member): Promise<SearchAgent[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("search_agents").select(COLUMNS).eq("dealership_id", ctx.dealership.id).order("created_at");
  if (error) throw new Error(`Kunne ikke hente agenter (${error.code})`);
  return (data as AgentRow[]).map(agentFromRow);
}

export type CreateAgentResult = { ok: true; agent: SearchAgent } | { ok: false; code: "forbidden" | "active_limit" | "invalid" | "failed" };

/**
 * Oppretter agent i brukerens firma. dealership_id kommer fra membership,
 * aldri fra skjemaet; RLS WITH CHECK avviser uansett andre firma.
 * Ny agent lagres som ikke aktiv — aktivering hører til DEV-004.
 */
export async function createAgent(ctx: Member, input: NewAgentInput): Promise<CreateAgentResult> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, code: "failed" };
  const { data, error } = await supabase
    .from("search_agents")
    .insert({
      dealership_id: ctx.dealership.id,
      name: input.name,
      filters: filtersToDb(emptyFiltersFor(input)),
      assumptions: {},
      active: false,
    })
    .select(COLUMNS)
    .single();
  if (error) {
    if (error.code === "42501") return { ok: false, code: "forbidden" };
    if (error.code === "23514" && error.message.includes("active_agent_limit")) return { ok: false, code: "active_limit" };
    if (error.code === "23514") return { ok: false, code: "invalid" };
    return { ok: false, code: "failed" };
  }
  return { ok: true, agent: agentFromRow(data as AgentRow) };
}

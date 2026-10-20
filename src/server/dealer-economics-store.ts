import "server-only";
/**
 * ECON-005c — lagring av forhandlerinput og firmaprofil: `public.dealer_economics_inputs` / `public.dealer_economics_profiles`, firmabundet med RLS.
 * Kjører som innlogget bruker via Supabase (publishable key) — aldri service-role. Firma settes av databasen fra medlemskapet (kolonnen er ikke skrivbar for klienten);
 * `ctx.dealership.id` brukes bare som ekstra filter og for å kontrollere lest binding. Avledede resultater lagres ikke.
 */
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { DealerEconomicsStore, DealerInputKey, DealerInputRow, SaveError } from "./dealer-economics";
import type { SessionContext } from "./session";

type Member = Extract<SessionContext, { status: "member" }>;

const COLUMNS = "dealership_id, search_id, candidate_id, candidate_version, input_schema_version, payload, context, confirmed_by, confirmed_at";
interface Row { dealership_id: string; search_id: string; candidate_id: string; candidate_version: string; input_schema_version: number; payload: unknown; context: unknown; confirmed_by: string | null; confirmed_at: string }

async function client() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase er ikke konfigurert");
  return supabase;
}

/** 23503 = søket finnes ikke i brukerens firma (samme feil for ukjent og fremmed søk); 23514/42501 = avvist av databasens kontroller. */
function mapError(e: { code?: string | null }): SaveError {
  if (e.code === "23503") return "search_not_found";
  if (e.code === "23514" || e.code === "42501") return "rejected";
  return "unavailable";
}

export function createDealerEconomicsStore(ctx: Member): DealerEconomicsStore {
  return {
    async getInput(key: DealerInputKey): Promise<DealerInputRow | null> {
      const supabase = await client();
      const { data, error } = await supabase.from("dealer_economics_inputs").select(COLUMNS)
        .eq("dealership_id", ctx.dealership.id).eq("search_id", key.searchId).eq("candidate_id", key.candidateId)
        .eq("candidate_version", key.candidateVersion).eq("input_schema_version", key.inputSchemaVersion).maybeSingle();
      if (error) throw new Error(`Kunne ikke hente forhandlerinput (${error.code})`);
      if (!data) return null;
      const r = data as Row;
      return { dealershipId: r.dealership_id, searchId: r.search_id, candidateId: r.candidate_id, candidateVersion: r.candidate_version, inputSchemaVersion: r.input_schema_version, payload: r.payload, context: r.context, confirmedBy: r.confirmed_by, confirmedAt: r.confirmed_at };
    },
    async saveInput(key, payload, context) {
      const supabase = await client();
      // Firma settes av databasen. Finnes nøkkelen fra før (23505), er dette en ny bekreftelse: oppdater innholdet.
      const ins = await supabase.from("dealer_economics_inputs").insert({ search_id: key.searchId, candidate_id: key.candidateId, candidate_version: key.candidateVersion, input_schema_version: key.inputSchemaVersion, payload, context });
      if (!ins.error) return { ok: true };
      if (ins.error.code !== "23505") return { ok: false, code: mapError(ins.error) };
      const upd = await supabase.from("dealer_economics_inputs").update({ payload, context })
        .eq("dealership_id", ctx.dealership.id).eq("search_id", key.searchId).eq("candidate_id", key.candidateId)
        .eq("candidate_version", key.candidateVersion).eq("input_schema_version", key.inputSchemaVersion).select("id").maybeSingle();
      if (upd.error) return { ok: false, code: mapError(upd.error) };
      return upd.data ? { ok: true } : { ok: false, code: "unavailable" };
    },
    async getProfile() {
      const supabase = await client();
      const { data, error } = await supabase.from("dealer_economics_profiles").select("dealership_id, payload").eq("dealership_id", ctx.dealership.id).maybeSingle();
      if (error) throw new Error(`Kunne ikke hente forhandlerprofil (${error.code})`);
      return data ? { dealershipId: (data as { dealership_id: string }).dealership_id, payload: (data as { payload: unknown }).payload } : null;
    },
    async saveProfile(payload) {
      const supabase = await client();
      const ins = await supabase.from("dealer_economics_profiles").insert({ payload });
      if (!ins.error) return { ok: true };
      if (ins.error.code !== "23505") return { ok: false, code: mapError(ins.error) };
      const upd = await supabase.from("dealer_economics_profiles").update({ payload }).eq("dealership_id", ctx.dealership.id).select("dealership_id").maybeSingle();
      if (upd.error) return { ok: false, code: mapError(upd.error) };
      return upd.data ? { ok: true } : { ok: false, code: "unavailable" };
    },
  };
}

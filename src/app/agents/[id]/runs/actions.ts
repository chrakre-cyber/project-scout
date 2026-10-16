"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/server/session";
import { startSearchRun } from "@/server/search-runs";

/**
 * Manuell søkekjøring. Skjemaet gir bare agent-ID, engangstoken (idempotens) og forventet agentversjon;
 * firma og kriterier kommer fra sesjon og database, aldri fra skjemaet.
 */
export async function startRunAction(form: FormData) {
  const str = (k: string) => (typeof form.get(k) === "string" ? String(form.get(k)) : "");
  const agentId = str("agentId");
  const ctx = await getSessionContext();
  if (ctx.status !== "member") redirect("/agents");
  const version = Number(str("version"));
  const result = await startSearchRun(ctx, agentId, str("token"), Number.isSafeInteger(version) && version >= 1 ? version : null);
  revalidatePath(`/agents/${agentId}/runs`);
  if (!result.ok) {
    // Ukjent/fremmed agent: ingen side å gå tilbake til (den ville gitt 404); samme svar uansett årsak.
    if (result.code === "not_found" || result.code === "invalid") redirect("/agents?error=not_found");
    if (result.code === "already_running" && result.runId) redirect(`/agents/${agentId}/runs/${result.runId}`);
    redirect(`/agents/${agentId}/runs?error=${result.code}`);
  }
  redirect(`/agents/${agentId}/runs/${result.run.id}`);
}

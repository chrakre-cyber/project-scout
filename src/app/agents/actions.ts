"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FieldErrors } from "@/domain/agent-validation";
import { parseAgentForm, type FormValues } from "@/server/agent-form";
import { createAgent, setAgentActive, updateAgent } from "@/server/agents";
import { AGENT_MESSAGES as MESSAGES } from "./messages";
import { getSessionContext } from "@/server/session";

export interface AgentFormState {
  errors: FieldErrors;
  values: FormValues | null;
  message: string | null;
  issues: string[];
}



export async function saveAgentAction(_prev: AgentFormState, form: FormData): Promise<AgentFormState> {
  const ctx = await getSessionContext();
  if (ctx.status !== "member") return { errors: {}, values: null, message: "Du må være innlogget og knyttet til et firma.", issues: [] };

  const parsed = parseAgentForm(form);
  if (!parsed.draft) return { errors: parsed.errors, values: parsed.values, message: "Agenten ble ikke lagret. Rett feltene som er merket.", issues: [] };

  const id = typeof form.get("id") === "string" ? String(form.get("id")) : "";
  const version = Number(form.get("version"));
  const result = id
    ? await updateAgent(ctx, id, Number.isSafeInteger(version) ? version : -1, parsed.draft)
    : await createAgent(ctx, parsed.draft);
  if (!result.ok) return { errors: {}, values: parsed.values, message: MESSAGES[result.code], issues: result.issues ?? [] };

  revalidatePath("/agents");
  redirect(`/agents?msg=saved#agent-${result.agent.id}`);
}

export async function setActiveAction(form: FormData) {
  const ctx = await getSessionContext();
  if (ctx.status !== "member") redirect("/agents?error=forbidden");
  const id = typeof form.get("id") === "string" ? String(form.get("id")) : "";
  const active = form.get("active") === "true";
  const result = await setAgentActive(ctx, id, active);
  revalidatePath("/agents");
  if (!result.ok) redirect(`/agents?error=${result.code}#agent-${id}`);
  redirect(`/agents?msg=${active ? "activated" : "paused"}#agent-${id}`);
}


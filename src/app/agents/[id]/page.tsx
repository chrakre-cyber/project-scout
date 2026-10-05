import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AgentForm } from "@/components/AgentForm";
import { agentToFormValues } from "@/server/agent-form";
import { getAgent } from "@/server/agents";
import { getSessionContext } from "@/server/session";

export const metadata: Metadata = { title: "Rediger agent — Project Scout" };

export default async function EditAgentPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext();
  if (ctx.status !== "member") redirect("/agents");
  const agent = await getAgent(ctx, (await params).id);
  if (!agent) notFound();
  const active = agent.status === "active";
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Rediger agent</h1>
      <p className="text-sm text-slate-600">
        Status: <strong>{active ? "Aktiv" : "Ikke aktiv"}</strong> · Versjon {agent.version}.
        {active && " En aktiv agent må forbli komplett når den lagres. Pause den først for å lagre et ufullstendig utkast."}
      </p>
      <AgentForm id={agent.id} version={agent.version} initial={agentToFormValues(agent)} />
    </div>
  );
}

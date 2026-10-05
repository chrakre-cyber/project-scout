import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AgentForm } from "@/components/AgentForm";
import { getSessionContext } from "@/server/session";

export const metadata: Metadata = { title: "Ny agent — Project Scout" };

export default async function NewAgentPage() {
  const ctx = await getSessionContext();
  if (ctx.status !== "member") redirect("/agents");
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Ny agent</h1>
      <p className="text-sm text-slate-600">Firma: {ctx.dealership.name}. Agenten lagres som ikke aktiv; aktiver den fra agentlisten når alle krav er oppfylt.</p>
      <AgentForm initial={{}} />
    </div>
  );
}

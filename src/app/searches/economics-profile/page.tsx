import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DealerProfileForm } from "@/components/search/DealerProfileForm";
import { DF_OUTCOME_TEXT, DP_TITLE } from "@/lib/search-labels";
import { createDealerEconomicsStore } from "@/server/dealer-economics-store";
import { loadDealerProfile } from "@/server/dealer-economics";
import { profileToFormValues } from "@/server/dealer-input-flow";
import { getSessionContext } from "@/server/session";

export const metadata: Metadata = { title: "Firmaprofil for økonomi — Merovo demo" };
export const dynamic = "force-dynamic";

export default async function EconomicsProfilePage() {
  const ctx = await getSessionContext();
  if (ctx.status !== "member") redirect("/searches");
  let profile;
  try { profile = await loadDealerProfile(createDealerEconomicsStore(ctx), ctx.dealership.id); } catch {
    // Feiler lukket: uten lesbar profil vises ingen skjema, så en lagring ikke kan overskrive en eksisterende profil med tomme verdier.
    return <p role="alert" data-testid="profile-unavailable" className="rounded-lg bg-[#fbeae5] p-3 text-danger">{DF_OUTCOME_TEXT.unavailable}</p>;
  }
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold tracking-tight text-forest">{DP_TITLE}</h1>
      <p className="text-sm text-muted" data-testid="profile-firm">Firma: {ctx.dealership.name}</p>
      <DealerProfileForm initial={profileToFormValues(profile)} />
    </div>
  );
}

import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SessionContext =
  | { status: "not_configured" }
  | { status: "anonymous" }
  | { status: "no_membership"; user: { id: string; email: string | null } }
  | { status: "member"; user: { id: string; email: string | null }; dealership: { id: string; name: string } };

/**
 * Bruker utledes fra validert sesjon (getUser kontrollerer token mot Auth).
 * Firma utledes fra membership via RLS — aldri fra nettleserinput (ARCHITECTURE «Firmatilgang»).
 */
export const getSessionContext = cache(loadSessionContext);

async function loadSessionContext(): Promise<SessionContext> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { status: "not_configured" };

  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return { status: "anonymous" };
  const user = { id: auth.user.id, email: auth.user.email ?? null };

  const { data, error } = await supabase
    .from("dealership_members")
    .select("dealership_id, dealerships ( id, name )")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw new Error(`Kunne ikke lese medlemskap (${error.code})`);

  const dealership = data?.dealerships as unknown;
  if (!data || !isDealership(dealership) || dealership.id !== data.dealership_id) return { status: "no_membership", user };
  return { status: "member", user, dealership: { id: dealership.id, name: dealership.name } };
}

function isDealership(v: unknown): v is { id: string; name: string } {
  return typeof v === "object" && v !== null && typeof (v as { id: unknown }).id === "string"
    && typeof (v as { name: unknown }).name === "string";
}

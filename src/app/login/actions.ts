"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function signIn(form: FormData) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login");
  const email = typeof form.get("email") === "string" ? String(form.get("email")).trim() : "";
  const password = typeof form.get("password") === "string" ? String(form.get("password")) : "";
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  // Felles feilmelding: avslører ikke om e-posten finnes.
  if (error) redirect("/login?error=1");
  redirect("/agents");
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  if (supabase) await supabase.auth.signOut();
  redirect("/login");
}

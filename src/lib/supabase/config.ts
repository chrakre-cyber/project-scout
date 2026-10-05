/**
 * Supabase-konfigurasjon fra offentlige miljøvariabler. Bare URL og
 * publishable key brukes i appen; ingen secret/service-role-nøkkel (CLAUDE.md pkt. 7).
 * Uten konfigurasjon kjører appen i ren demomodus med syntetiske data.
 */
export interface SupabasePublicConfig {
  url: string;
  publishableKey: string;
}

export function getSupabaseConfig(): SupabasePublicConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) return null;
  return { url, publishableKey };
}

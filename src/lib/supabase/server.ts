import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseConfig } from "./config";

/** Ny klient per forespørsel (påkrevd av @supabase/ssr). Kjører som innlogget bruker; RLS gjelder. */
export async function createSupabaseServerClient() {
  const config = getSupabaseConfig();
  if (!config) return null;
  const cookieStore = await cookies();
  return createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
        } catch {
          // Server Components kan ikke sette cookies; proxy.ts fornyer sesjonen.
        }
      },
    },
  });
}

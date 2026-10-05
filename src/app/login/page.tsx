import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/server/session";
import { signIn } from "./actions";

export const metadata: Metadata = { title: "Logg inn — Project Scout" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const ctx = await getSessionContext();
  if (ctx.status === "member" || ctx.status === "no_membership") redirect("/agents");

  return (
    <div className="mx-auto max-w-sm space-y-4">
      <h1 className="text-2xl font-semibold">Logg inn</h1>
      {ctx.status === "not_configured" ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Innlogging er ikke konfigurert i dette miljøet (mangler NEXT_PUBLIC_SUPABASE_URL /
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY). Demoen fungerer uten innlogging.
        </p>
      ) : (
        <>
          <p className="text-sm text-slate-600">
            Brukere opprettes av prosjekteier og knyttes til ett firma. Det finnes ingen åpen registrering.
          </p>
          {error && (
            <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              Innloggingen mislyktes. Kontroller e-post og passord.
            </p>
          )}
          <form action={signIn} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
            <label className="block text-sm">
              E-post
              <input name="email" type="email" required autoComplete="username" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
            </label>
            <label className="block text-sm">
              Passord
              <input name="password" type="password" required autoComplete="current-password" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
            </label>
            <button type="submit" className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
              Logg inn
            </button>
          </form>
        </>
      )}
    </div>
  );
}

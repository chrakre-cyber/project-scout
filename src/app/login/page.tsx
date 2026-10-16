import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/server/session";
import { signIn } from "./actions";

export const metadata: Metadata = { title: "Logg inn — Merovo demo" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const ctx = await getSessionContext();
  // DEV-006E (godkjent atferdsendring): allerede innlogget bruker sendes til /searches (tidligere /agents).
  if (ctx.status === "member" || ctx.status === "no_membership") redirect("/searches");

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight text-forest">Logg inn</h1>
        <p className="text-sm text-muted" data-testid="login-support">Privat partnerdemo. Tilgang gis av Merovo; det finnes ingen åpen registrering.</p>
      </div>
      {ctx.status === "not_configured" ? (
        <p className="rounded-xl border border-sand bg-sand-soft p-4 text-sm" data-testid="login-not-configured">
          Innlogging er ikke satt opp i dette miljøet.
        </p>
      ) : (
        <>
          {error && (
            <p role="alert" className="rounded-xl border border-danger/40 bg-[#fbeae5] p-3 text-sm text-danger" data-testid="login-error">
              Innloggingen mislyktes. Kontroller e-post og passord.
            </p>
          )}
          <form action={signIn} className="space-y-4 rounded-2xl border border-sand border-t-4 border-t-forest bg-paper p-5 shadow-sm">
            <label className="block text-sm font-bold">
              E-post
              <input name="email" type="email" required autoComplete="username" className="mt-1 block w-full rounded-lg border-[1.5px] border-[#9a8f7c] bg-white px-3 py-2.5 font-normal" />
            </label>
            <label className="block text-sm font-bold">
              Passord
              <input name="password" type="password" required autoComplete="current-password" className="mt-1 block w-full rounded-lg border-[1.5px] border-[#9a8f7c] bg-white px-3 py-2.5 font-normal" />
            </label>
            <button type="submit" className="min-h-11 w-full rounded-lg bg-forest px-4 py-2.5 font-semibold text-cream hover:bg-ink">
              Logg inn
            </button>
          </form>
        </>
      )}
    </div>
  );
}

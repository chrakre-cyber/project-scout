import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = { title: "Fant ikke siden — Merovo demo" };

/**
 * Global «ikke funnet» i Merovo-stil (DEV-006G). Ingen Project Scout-merkevare og ingen gammel demobanner; ingen innloggingslogikk
 * (lenken går til inngangen, som selv sender innlogget bruker videre til /searches). Søkeflyten har sin egen variant under /searches.
 */
export default function NotFound() {
  return (
    <div className="merovo-scope flex min-h-screen flex-col bg-cream text-ink" data-testid="global-not-found">
      <header className="border-b border-sand bg-paper">
        <div className="mx-auto flex max-w-5xl items-center px-4 py-2 sm:px-6">
          <Image src="/brand/merovo-logo-horizontal-original.svg" alt="Merovo" width={160} height={40} priority unoptimized className="h-9 w-auto" />
        </div>
      </header>
      <div className="border-b border-sand bg-forest text-cream">
        <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6">
          <p className="text-2xl font-bold tracking-tight" lang="en">Local demand. European supply.</p>
        </div>
      </div>
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-3 px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold text-forest">Fant ikke siden</h1>
        <p className="text-muted">Siden finnes ikke, eller den er ikke en del av denne demoen.</p>
        <Link href="/login" className="inline-flex min-h-11 items-center rounded-lg bg-forest px-5 py-2 font-semibold text-cream hover:bg-ink">Til innloggingen</Link>
      </main>
    </div>
  );
}

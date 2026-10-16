import Image from "next/image";

/**
 * Merovo-skall for innlogging (DEV-006E). Kun presentasjon: ingen innloggingslogikk her.
 * Ingen Project Scout-merkevare, ingen gult demobanner, ingen leverandørlogoer.
 */
export default function LoginLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="merovo-scope flex min-h-screen flex-col bg-cream text-ink">
      <header className="border-b border-sand bg-paper">
        <div className="mx-auto flex max-w-5xl items-center px-4 py-2 sm:px-6">
          <Image src="/brand/merovo-logo-horizontal-original.svg" alt="Merovo" width={160} height={40} priority unoptimized className="h-9 w-auto" />
        </div>
      </header>
      <div className="border-b border-sand bg-forest text-cream">
        <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6">
          <p className="text-2xl font-bold tracking-tight" lang="en" data-testid="tagline">Local demand. European supply.</p>
        </div>
      </div>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}

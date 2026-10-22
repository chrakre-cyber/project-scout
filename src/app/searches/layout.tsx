import Image from "next/image";
import Link from "next/link";
import { MerovoAccount } from "@/components/merovo/MerovoAccount";
import { MerovoNav } from "@/components/merovo/MerovoNav";
import { SYNTHETIC_SOURCE_LABEL } from "@/lib/search-labels";
import { syntheticGeneratedLabel } from "@/server/synthetic-label";

// Merkingen avhenger av serverens miljø (SCOUT_SYNTHETIC_EPOCH) og klokka; aldri forhåndsrendret ved bygging.
export const dynamic = "force-dynamic";

/**
 * Merovo-skall for hele søkeflyten (SEARCH-005, DEV-006D): eget topplinje, merkevarelinje og fast etikett for syntetiske data.
 * Erstatter Project Scout-toppen og det gule demobanneret på `/searches/**` (se AppChrome). Navigasjonen holdes til selve
 * søkeopplevelsen. Etiketten er alltid synlig og er den samme sikkerhetsmeldingen som banneret ga: annonsene er syntetiske.
 */
export default function SearchesLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const generated = syntheticGeneratedLabel();
  return (
    <div className="merovo-scope min-h-screen bg-cream text-ink">
      <header className="border-b border-sand bg-paper">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-2 sm:px-6">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
            <Link href="/searches" className="flex items-center" aria-label="Merovo — til søkeoversikten">
              <Image src="/brand/merovo-logo-horizontal-original.svg" alt="Merovo" width={160} height={40} priority unoptimized className="h-9 w-auto" />
            </Link>
            <MerovoNav />
          </div>
          <MerovoAccount />
        </div>
      </header>
      <div className="border-b border-sand bg-forest text-cream">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          <div>
            <p className="text-lg font-bold tracking-tight" lang="en" data-testid="tagline">Local demand. European supply.</p>
            <p className="text-sm text-cream/90" data-testid="tagline-explainer">Forhandlere vet hvilke biler kundene vil ha. Merovo finner dem i Europa.</p>
          </div>
          <p role="status" className="rounded-full border border-rust bg-paper px-3 py-1 text-xs font-bold text-rust-dark" data-testid="layout-source-label">
            <span aria-hidden="true">◇ </span>{SYNTHETIC_SOURCE_LABEL}
            {generated && <span data-testid="layout-generated-label"> · {generated}</span>}
          </p>
        </div>
      </div>
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}

import Image from "next/image";
import Link from "next/link";
import { SYNTHETIC_SOURCE_LABEL } from "@/lib/search-labels";

/**
 * Egen, avgrenset flate for den nye søkeflyten (SEARCH-005): Merovo-profil (krem, skoggrønn, terrakotta, Figtree) kun her.
 * Eksisterende sider (agenter, dashboard, kjøringer) beholder sitt utseende og sin navigasjon.
 */
export default function SearchesLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="merovo-scope rounded-2xl bg-cream text-ink">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-sand px-4 py-3 sm:px-6">
        <Link href="/searches" className="flex items-center gap-3" aria-label="Nye søk — til oversikten">
          <Image src="/brand/merovo-logo-horizontal-original.svg" alt="Merovo" width={160} height={40} priority unoptimized className="h-9 w-auto" />
        </Link>
        <span className="rounded-full border border-rust px-3 py-0.5 text-xs font-bold uppercase tracking-wide text-rust">Demo · utkast</span>
        <span className="w-full text-xs text-muted" data-testid="layout-source-label">{SYNTHETIC_SOURCE_LABEL}</span>
      </header>
      <div className="px-4 py-6 sm:px-6">{children}</div>
    </div>
  );
}

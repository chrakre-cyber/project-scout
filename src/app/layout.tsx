import type { Metadata } from "next";
import { AppChrome } from "@/components/AppChrome";
import { AuthStatus } from "@/components/AuthStatus";
import { DemoBanner } from "@/components/DemoBanner";
import { SiteNav } from "@/components/SiteNav";
import { legacyRoutesEnabled } from "@/lib/legacy-routes";
import "./globals.css";

export const metadata: Metadata = {
  title: "Merovo demo",
  description: "Privat partnerdemo med syntetiske data. Ingen ekte annonser eller beregninger.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="nb">
      <body className="min-h-screen">
        <AppChrome
          chrome={!legacyRoutesEnabled(process.env.SCOUT_ENABLE_LEGACY_ROUTES) ? null : (
            <>
              <DemoBanner />
              <header className="border-b border-slate-200 bg-white">
                <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <span className="text-lg font-semibold tracking-tight">Project Scout</span>
                  <SiteNav />
                  <AuthStatus />
                </div>
              </header>
            </>
          )}
        >
          {children}
        </AppChrome>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { AppChrome } from "@/components/AppChrome";
import { AuthStatus } from "@/components/AuthStatus";
import { DemoBanner } from "@/components/DemoBanner";
import { SiteNav } from "@/components/SiteNav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Project Scout — demo",
  description: "Syntetisk demo av Project Scout. Ingen ekte annonser eller beregninger.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="nb">
      <body className="min-h-screen">
        <AppChrome
          chrome={(
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

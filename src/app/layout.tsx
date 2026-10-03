import type { Metadata } from "next";
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
        <DemoBanner />
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
            <span className="text-lg font-semibold tracking-tight">Project Scout</span>
            <SiteNav />
            <span className="text-xs text-slate-500" title="Innlogging kommer i DEV-002">
              Ikke innlogget · ingen autentisering i demo
            </span>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}

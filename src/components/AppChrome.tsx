"use client";

import { usePathname } from "next/navigation";

/**
 * Velger skall per rute (DEV-006D). `/searches/**` har sitt eget, sammenhengende Merovo-skall (se app/searches/layout.tsx), så
 * Project Scout-toppen og det gule demobanneret vises ikke der — den faste Merovo-etiketten for syntetiske data tar over.
 * Alle andre ruter (agenter, dashboard, muligheter, innlogging) beholder det eksisterende skallet uendret.
 */
export function AppChrome({ chrome, children }: { chrome: React.ReactNode; children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/searches" || pathname.startsWith("/searches/")) return <>{children}</>;
  return (
    <>
      {chrome}
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </>
  );
}

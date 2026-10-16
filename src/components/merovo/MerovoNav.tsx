"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Navigasjon i Merovo-skallet. Bare søkeopplevelsen: ingen lenker tilbake til den eldre Project Scout-flaten. */
const LINKS = [
  { href: "/searches", label: "Søk", active: (p: string) => p === "/searches" || (/^\/searches\/(?!new)/.test(p)) },
  { href: "/searches/new", label: "Nytt søk", active: (p: string) => p === "/searches/new" },
];

export function MerovoNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Hovedmeny" className="flex gap-1">
      {LINKS.map((l) => {
        const on = l.active(pathname);
        return (
          <Link key={l.href} href={l.href} aria-current={on ? "page" : undefined}
            className={`min-h-11 rounded-lg px-4 py-2.5 text-sm font-semibold ${on ? "bg-forest text-cream" : "text-forest hover:bg-sand-soft"}`}>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

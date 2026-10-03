"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/dashboard", label: "Dashboard", match: ["/dashboard", "/opportunities"] },
  { href: "/agents", label: "Mine agenter", match: ["/agents"] },
];

export function SiteNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Hovedmeny" className="flex gap-1">
      {links.map((l) => {
        const active = l.match.some((m) => pathname.startsWith(m));
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              active ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

import Link from "next/link";

/** Merovo-variant av «ikke funnet» for søkeflyten (DEV-006E). Den globale not-found.tsx er uendret. */
export default function SearchesNotFound() {
  return (
    <div className="space-y-3" data-testid="searches-not-found">
      <h1 className="text-2xl font-bold text-forest">Fant ikke siden</h1>
      <p className="text-muted">Søket eller siden finnes ikke, eller du har ikke tilgang til den.</p>
      <Link href="/searches" className="inline-flex min-h-11 items-center rounded-lg bg-forest px-5 py-2 font-semibold text-cream hover:bg-ink">Til søkeoversikten</Link>
    </div>
  );
}

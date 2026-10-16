import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SearchForm } from "@/components/search/SearchForm";
import { emptyFormValues } from "@/server/search-form";
import { exampleById } from "@/server/search-examples";
import { getSessionContext } from "@/server/session";

export const metadata: Metadata = { title: "Nytt søk — Merovo demo" };

export default async function NewSearchPage({ searchParams }: { searchParams: Promise<{ example?: string }> }) {
  const ctx = await getSessionContext();
  if (ctx.status !== "member") redirect("/searches");
  const example = exampleById((await searchParams).example);
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold tracking-tight text-forest">Nytt søk</h1>
      <p className="max-w-3xl text-muted">Firma: {ctx.dealership.name}. Søket lagres som utkast; det aktiveres ikke og kjører ikke av seg selv.</p>
      <SearchForm key={example?.id ?? "blank"} initial={example ? example.values() : emptyFormValues()} note={example?.note} />
    </div>
  );
}

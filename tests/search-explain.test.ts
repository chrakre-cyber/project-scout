import { describe, expect, it } from "vitest";
import { DEMO_CATALOG } from "@/adapters/search-catalog/demo-catalog";
import { mustSummary, orderForPresentation, whyShown, wishCounts, wishSummary } from "@/lib/search-explain";
import { SYNTHETIC_SOURCE_LABEL } from "@/lib/search-labels";
import { SyntheticMarketplaceProvider } from "@/providers/marketplace/synthetic/provider";
import { EXAMPLES } from "@/server/search-examples";
import { parseSearchFormValues, type FormValues } from "@/server/search-form";
import { previewSearch, type PreviewItem } from "@/server/search-preview";

let seq = 0;
const ids = () => (seq++).toString(16).padStart(12, "0");
const demo = (patch: FormValues = {}): FormValues => ({ ...EXAMPLES.find((e) => e.id === "demo-bmw")!.values(), ...patch });
const parse = (v: FormValues) => parseSearchFormValues(v, DEMO_CATALOG, { newCostId: ids });
async function run(patch: FormValues = {}) {
  const r = parse(demo(patch));
  if (!r.ok || !r.spec) throw new Error(JSON.stringify(r.errors));
  const out = await previewSearch(r.spec, new SyntheticMarketplaceProvider());
  if (!out.ok) throw new Error("kilden feilet");
  return out;
}
const byId = (items: PreviewItem[], id: string) => items.find((i) => i.listing.sourceListingId === id)!;

describe("DEV-006C: variasjonsposter gir de forventede utfallene (kravsemantikk uendret)", () => {
  it("minst 2 treff, 2 delvise/interessante, 1 kjent kravbrudd og 1 ukjent krav finnes", async () => {
    const out = await run();
    const d = (id: string) => byId(out.items, id).assessment.vehicle;
    // sterke: krav oppfylt og fargeønsket oppfylt
    for (const id of ["dvar-001", "dvar-002"]) { expect(d(id).status).toBe("match"); expect(d(id).wishes.fulfilled).toContain("exteriorColors"); }
    // delvise: krav oppfylt, men ønsket er kjent ikke oppfylt / ukjent — ønsker utelukker aldri
    expect(d("dvar-003").status).toBe("match");
    expect(d("dvar-003").wishes.notFulfilled).toContain("exteriorColors");
    expect(d("dvar-004").status).toBe("match");
    expect(d("dvar-004").wishes.unknown).toContain("exteriorColors");
    expect(d("dvar-004").wishes.notFulfilled).not.toContain("exteriorColors"); // ukjent er ikke «ikke oppfylt»
    // ukjent viktig krav: må kontrolleres, ikke bestått og ikke brudd
    expect(d("dvar-005").status).toBe("needs_review");
    expect(d("dvar-005").unknownMust).toEqual(["maxMileage"]);
    expect(d("dvar-005").excludedBy).toEqual([]);
    // kjent kravbrudd har forrang, selv med oppfylt ønske
    expect(d("dvar-006").status).toBe("excluded");
    expect(d("dvar-006").excludedBy).toEqual(["fuels"]);
    expect(d("dvar-006").wishes.fulfilled).toContain("exteriorColors");
  });

  it("ingen modellår utledes og ingen utstyr oppdiktes: utstyrsønsket er ukjent for alle biler, også de nye", async () => {
    const out = await run();
    for (const i of out.items.filter((x) => x.listing.sourceListingId.startsWith("dvar-"))) {
      expect(i.candidate.modelYear).toBeNull();
      expect(i.assessment.vehicle.wishes.unknown).toContain("equipment:carplay");
      expect(i.assessment.vehicle.wishes.fulfilled).not.toContain("equipment:carplay");
      expect(i.assessment.isFullHit).toBe(false);
      expect(i.assessment.budget.status).toBe("not_calculated");
      expect(i.listing.originalUrl).toBeNull();
      expect(i.listing.source).toBe("synthetic-demo");
    }
  });

  it("status er uendret av ønsker: samme statuser uten ønskene", async () => {
    const a = await run();
    const b = await run({ exteriorColors: [], exteriorColorsPriority: "", "eq:carplay": "" });
    expect(b.items.map((i) => i.assessment.vehicle.status)).toEqual(a.items.map((i) => i.assessment.vehicle.status));
  });
});

describe("DEV-006C: forklaringstekster", () => {
  it("ønskesammendrag gjengir faktiske tall; ukjent regnes aldri som ikke oppfylt", async () => {
    const out = await run();
    expect(wishSummary(byId(out.items, "dvar-001").assessment.vehicle)).toBe("1 av 2 ønsker oppfylt, 1 ukjent");
    expect(wishSummary(byId(out.items, "dvar-003").assessment.vehicle)).toBe("0 av 2 ønsker oppfylt, 1 ikke oppfylt, 1 ukjent");
    expect(wishSummary(byId(out.items, "dvar-004").assessment.vehicle)).toBe("0 av 2 ønsker oppfylt, 2 ukjente");
    const none = await run({ exteriorColors: [], exteriorColorsPriority: "", "eq:carplay": "" });
    expect(wishSummary(byId(none.items, "dvar-001").assessment.vehicle)).toBe("Ingen ønsker er satt.");
  });

  it("kravsammendrag og «hvorfor vist» skiller oppfylt, må kontrolleres og brudd, og påstår ikke økonomisk treff", async () => {
    const out = await run();
    const ok = byId(out.items, "dvar-001").assessment.vehicle;
    expect(mustSummary(ok)).toMatch(/^Alle \d+ krav er oppfylt\.$/);
    expect(whyShown(ok)).toContain("Alle krav er oppfylt");
    expect(whyShown(ok)).toContain("ikke et økonomisk verifisert treff");
    expect(whyShown(ok)).not.toMatch(/sterkt|fullt treff|lønnsom/i);
    const unk = byId(out.items, "dvar-005").assessment.vehicle;
    expect(mustSummary(unk)).toMatch(/1 må kontrolleres/);
    expect(whyShown(unk)).toMatch(/kilometerstand er ikke oppgitt i annonsen og må kontrolleres/);
    const bad = byId(out.items, "dvar-006").assessment.vehicle;
    expect(mustSummary(bad)).toMatch(/1 ikke oppfylt/);
    expect(whyShown(bad)).toMatch(/drivstoff er kjent ikke oppfylt/);
  });

  it("etiketten er den avtalte teksten", () => {
    expect(SYNTHETIC_SOURCE_LABEL).toBe("Syntetiske demodata – ikke ekte leverandørdata");
  });
});

describe("DEV-006C: visningsrekkefølge", () => {
  it("flest oppfylte ønsker først innen gruppen; stabil ved likhet; endrer ikke status; ukjent straffes ikke", async () => {
    const out = await run();
    const group = out.items.filter((i) => i.assessment.vehicle.status === "match");
    const ordered = orderForPresentation(group);
    expect(ordered).toHaveLength(group.length);
    const f = ordered.map((i) => wishCounts(i.assessment.vehicle).fulfilled);
    expect(f).toEqual([...f].sort((a, b) => b - a));
    // de med oppfylt farge kommer før dvar-003 (ikke oppfylt) og dvar-004 (ukjent)
    const pos = (id: string) => ordered.findIndex((i) => i.listing.sourceListingId === id);
    expect(pos("dvar-001")).toBeLessThan(pos("dvar-003"));
    expect(pos("dvar-002")).toBeLessThan(pos("dvar-004"));
    // ikke oppfylt og ukjent teller likt (0 oppfylt): kildens rekkefølge bevares mellom dem
    expect(pos("dvar-003")).toBeLessThan(pos("dvar-004"));
    // status er uendret, og input muteres ikke
    expect(ordered.every((i) => i.assessment.vehicle.status === "match")).toBe(true);
    expect(group.map((i) => i.listing.sourceListingId)).toEqual(out.items.filter((i) => i.assessment.vehicle.status === "match").map((i) => i.listing.sourceListingId));
    // deterministisk
    expect(orderForPresentation(group).map((i) => i.listing.sourceListingId)).toEqual(ordered.map((i) => i.listing.sourceListingId));
  });

  it("kravstatus har forrang i blandede lister", async () => {
    const out = await run();
    const mixed = orderForPresentation([...out.items].reverse());
    const rank = { match: 0, needs_review: 1, excluded: 2 } as const;
    const r = mixed.map((i) => rank[i.assessment.vehicle.status]);
    expect(r).toEqual([...r].sort((a, b) => a - b));
  });
});

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DEMO_CATALOG } from "@/adapters/search-catalog/demo-catalog";
import { policyAllowing, type DisplayPolicy } from "@/domain/display-policy";
import { SYNTHETIC_DISPLAY_POLICY } from "@/domain/provider-rights";
import type { NormalizedListing } from "@/domain/types";
import { ListingFacts } from "@/components/search/ListingFacts";
import { ResultCard } from "@/components/search/ResultCard";
import { Explanation } from "@/components/search/Explanation";
import { mustSummary, whyShown, wishSummary } from "@/lib/search-explain";
import { UNAVAILABLE_TEXT, WITHHELD_TEXT } from "@/lib/display-text";
import type { MarketplaceProvider } from "@/providers/marketplace";
import { EXAMPLES } from "@/server/search-examples";
import { detailForDisplay, previewForDisplay } from "@/server/search-display";
import { parseSearchFormValues, type FormValues } from "@/server/search-form";
import { sentinelListing } from "./fixtures/display-sentinel";

const NOW = () => new Date("2026-10-16T12:00:00Z");
let seq = 0;
const ids = () => (seq++).toString(16).padStart(12, "0");
const spec = () => {
  const v: FormValues = { ...EXAMPLES.find((e) => e.id === "demo-bmw")!.values() };
  const r = parseSearchFormValues(v, DEMO_CATALOG, { newCostId: ids });
  if (!r.ok || !r.spec) throw new Error(JSON.stringify(r.errors));
  return r.spec;
};
const providerOf = (listings: NormalizedListing[]): MarketplaceProvider => ({
  source: "synthetic-demo",
  search: async () => ({ items: listings, nextPage: null, sourceTotal: listings.length, truncated: false, fetchedAt: NOW().toISOString(), rejected: [] }),
  getListing: async (id) => listings.find((l) => l.sourceListingId === id) ?? null,
});
const SENTINELS = ["SENTINEL", "31337", "424242", "12345678", "sentinel-url", "2026-10-01T08"];
const json = (v: unknown) => JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x));
const noSentinel = (s: string, label: string) => { for (const x of SENTINELS) expect(s, `${label}: ${x}`).not.toContain(x); };

const deny: (p?: DisplayPolicy) => () => DisplayPolicy = () => () => policyAllowing(SYNTHETIC_DISPLAY_POLICY, []);

describe("DATA-002A: forbudte felt når aldri UI-modellen eller markup", () => {
  it("deny-all: resultatkortet, forklaringen og hele visningsmodellen har ingen sentinelverdier — men vurderingen finnes", async () => {
    const out = await previewForDisplay(spec(), { provider: providerOf([sentinelListing()]), now: NOW, policyFor: deny() });
    if (!out.ok) throw new Error("kilden feilet");
    expect(out.items).toHaveLength(1);
    const item = out.items[0]!;
    noSentinel(json(out), "DisplayPreviewOutcome");
    const html = renderToStaticMarkup(createElement(ResultCard, { item, draftId: "d1", version: 1, expanded: true }));
    noSentinel(html, "ResultCard");
    expect(html).toContain(WITHHELD_TEXT);
    // vurderingen er fortsatt til stede (evalueringen bygger ikke på visningsretten) og forklaringen er verdifri
    expect(["match", "needs_review", "excluded"]).toContain(item.assessment.vehicle.status);
    noSentinel(whyShown(item.assessment.vehicle) + mustSummary(item.assessment.vehicle) + wishSummary(item.assessment.vehicle), "forklaringstekst");
    noSentinel(renderToStaticMarkup(createElement(Explanation, { vehicle: item.assessment.vehicle })), "Explanation");
    // illustrasjonen avhenger ikke av forbudt karosseri
    expect(html).not.toMatch(/stasjonsvogn/i);
  });

  it("detaljvisning (deny-all): fakta-seksjonen viser «vises ikke» for hvert felt og ingen sentinel, inkludert fritekst, selgersted og URL", async () => {
    const out = await detailForDisplay(spec(), "sentinel-1", { provider: providerOf([sentinelListing()]), now: NOW, policyFor: deny() });
    if (out.kind !== "ok") throw new Error(out.kind);
    noSentinel(json(out), "DisplayDetailOutcome");
    const html = renderToStaticMarkup(createElement(ListingFacts, { listing: out.item.listing }));
    noSentinel(html, "ListingFacts");
    expect(html.split(WITHHELD_TEXT).length - 1).toBeGreaterThanOrEqual(10);
    expect(html).toContain('data-testid="listing-text-state"');
    expect(html).not.toContain('data-testid="listing-text"');
  });

  it("delvis profil: bare tillatte felt vises; forbudte erstattes med «vises ikke», aldri med oppdiktet verdi", async () => {
    const policy = policyAllowing(SYNTHETIC_DISPLAY_POLICY, ["title", "registration"]);
    const out = await detailForDisplay(spec(), "sentinel-1", { provider: providerOf([sentinelListing()]), now: NOW, policyFor: () => policy });
    if (out.kind !== "ok") throw new Error(out.kind);
    const html = renderToStaticMarkup(createElement(ListingFacts, { listing: out.item.listing }));
    expect(html).toContain("2019"); // registrering er tillatt
    for (const forbidden of ["424", "31", "SENTINEL-FRITEKST", "SENTINEL-BY", "SENTINEL-FARGE", "sentinel-url"]) expect(html, forbidden).not.toContain(forbidden);
    expect(html).toContain(WITHHELD_TEXT);
    const card = renderToStaticMarkup(createElement(ResultCard, { item: out.item, draftId: "d1", version: 1 }));
    expect(card).toContain("SENTINEL-MERKE"); // tittel er tillatt
    expect(card).not.toContain("424");
    expect(card).not.toContain("31");
  });

  it("alt tillatt (syntetisk profil): verdiene vises, ukjent vises som «ikke oppgitt», `unavailable` har egen tekst", async () => {
    const l = sentinelListing();
    l.specs.color = null;
    const out = await detailForDisplay(spec(), "sentinel-1", { provider: providerOf([l]), now: NOW });
    if (out.kind !== "ok") throw new Error(out.kind);
    const html = renderToStaticMarkup(createElement(ListingFacts, { listing: out.item.listing }));
    expect(html).toContain("SENTINEL-FRITEKST");
    expect(html).toContain("ikke oppgitt");
    expect(html).not.toContain(WITHHELD_TEXT);
    const un = renderToStaticMarkup(createElement(ListingFacts, { listing: { ...out.item.listing, text: { state: "unavailable" } } }));
    expect(un).toContain(UNAVAILABLE_TEXT);
    expect(un).not.toContain("SENTINEL-FRITEKST");
  });

  it("DisplayItem bærer verken rå annonse, kandidat, kildens proveniensfritekst eller kildeverdier", async () => {
    const l = sentinelListing();
    l.specs.color = "SENTINEL-UMAPPET"; // gir forklaring med sourceValue i kandidatmetadata
    const out = await previewForDisplay(spec(), { provider: providerOf([l]), now: NOW }); // alt tillatt
    if (!out.ok) throw new Error("kilden feilet");
    const item = out.items[0]!;
    expect(Object.keys(item).sort()).toEqual(["assessment", "listing", "unknowns"]);
    expect(json(item.unknowns)).not.toContain("SENTINEL-UMAPPET");
    expect(json(item)).not.toContain("SENTINEL-PROVENANS");
    for (const u of item.unknowns) expect(Object.keys(u).sort()).toEqual(["code", "field"]);
  });

  it("kilde uten visningsprofil blir aldri vist (standardrouting): ukjent kilde → deny-all; kandidatadapteren avviser dessuten fremmed kilde", async () => {
    const foreign = sentinelListing("noen-ekte-leverandor");
    const out = await previewForDisplay(spec(), { provider: providerOf([foreign]), now: NOW });
    if (!out.ok) throw new Error("kilden feilet");
    expect(out.items).toHaveLength(0); // adapteren kjenner bare «synthetic-demo»
    expect(out.coverage.notAdapted).toBe(1);
    noSentinel(json(out), "utdata for fremmed kilde");
  });
});

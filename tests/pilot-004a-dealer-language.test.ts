/**
 * PILOT-004A — kjerneopprydding i forhandlerrettet økonomispråk: én primær økonomiflate, ingen intern valideringsterminologi, riktig årsak ved utløpt avgiftsgrunnlag.
 * Presentasjon kun: ingen formel, regel, kurs, rettighet eller demoverdi er endret (tallene under er de samme som før).
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DEMO_CATALOG } from "@/adapters/search-catalog/demo-catalog";
import { AcquisitionSummary } from "@/components/search/AcquisitionSummary";
import { ResultCard } from "@/components/search/ResultCard";
import { REGISTERED_PROFILES, rightsForSource, type ProviderRightsProfile } from "@/domain/provider-rights";
import { toAcquisitionSummary, type DealerInputV1 } from "@/domain/search-economics";
import type { NormalizedListing } from "@/domain/types";
import { SUMMARY_BUDGET_NOTE } from "@/lib/search-labels";
import * as L from "@/lib/search-labels";
import type { MarketplaceProvider } from "@/providers/marketplace";
import { storedKey } from "@/server/dealer-economics";
import { syntheticRawListings } from "@/providers/marketplace/synthetic/fixtures";
import { SyntheticMarketplaceProvider } from "@/providers/marketplace/synthetic/provider";
import { EXAMPLES } from "@/server/search-examples";
import { parseSearchFormValues } from "@/server/search-form";
import { previewForDisplay, type DisplayItem, type EconomicsContext } from "@/server/search-display";
import { FIRM_A, NOW, SEARCH_1, candidateFor, dealerInput, listing, specOf, stored } from "./fixtures/economics-005c";

const providerOf = (ls: NormalizedListing[]): MarketplaceProvider => ({
  source: "synthetic-demo",
  search: async () => ({ items: ls, nextPage: null, sourceTotal: ls.length, truncated: false, fetchedAt: NOW.toISOString(), rejected: [] }),
  getListing: async (id) => ls.find((l) => l.sourceListingId === id) ?? null,
});

/** Kjører ekte pipeline (rettigheter → adapter → motor → visningsgrense) for én annonse; `input = null` ⇒ ingen bekreftet forhandlerinput. */
async function run(input: Partial<DealerInputV1> | null, o: { l?: NormalizedListing; profiles?: readonly ProviderRightsProfile[]; noContext?: boolean; policyFor?: Parameters<typeof previewForDisplay>[1] extends infer X ? (X extends { policyFor?: infer P } ? P : never) : never } = {}): Promise<DisplayItem> {
  const l = o.l ?? listing();
  const spec = specOf();
  const cand = candidateFor(l);
  const map = new Map();
  if (input !== null) map.set(storedKey(cand.id, cand.version), stored({ rights: rightsForSource("synthetic-demo", NOW, o.profiles ?? REGISTERED_PROFILES), spec, cand, input: dealerInput(input) }));
  const economics: EconomicsContext | undefined = o.noContext ? undefined : { dealershipId: FIRM_A, searchId: SEARCH_1, storedInputs: map, profile: null };
  const out = await previewForDisplay(spec, { provider: providerOf([l]), now: () => NOW, profiles: o.profiles, policyFor: o.policyFor, economics });
  if (!out.ok) throw new Error("kilden feilet");
  return out.items[0] as DisplayItem;
}
const card = (i: DisplayItem) => renderToStaticMarkup(createElement(ResultCard, { item: i, draftId: "d1", version: 1 }));
/** Selve sammendragsblokken i kortet (annonseprisen og øvrig kortinnhold er ikke økonomi og skal ikke skannes for «ingen beløp»). */
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/g, " ").replace(/\s+/g, " ");

// ---------------------------------------------------------------- iX3 (EUR) — scenario fra oppdraget, kjørt gjennom ekte motor
const ix3 = (): NormalizedListing => listing({
  price: { ...listing().price!, stated: { amount: "36950", currency: "EUR" }, amount: { amountMinor: 3_695_000, currency: "EUR" } },
  specs: { ...listing().specs, make: "BMW", model: "iX3", variant: "Inspiring", fuel: "electric", firstRegistration: { precision: "month", year: 2024, month: 3 }, powerKw: 210, co2: null, curbWeightKg: null },
});
const fxAcq = (rate: string) => ({ pair: "EUR/NOK", rate, sourceLabel: "TESTKURS (ikke en markedskurs)", effectiveAt: "2026-10-20", quotedAt: "2026-10-20", validUntil: "2026-10-31" });
const fxCust = (rate: string) => ({ pair: "EUR/NOK", rate, sourceLabel: "TESTKURS (ikke en markedskurs)", quotedAt: "2026-10-16", validFrom: "2026-10-16", validTo: "2026-10-31" });
const bev = (over: Partial<DealerInputV1> = {}): Partial<DealerInputV1> => ({
  propulsion: { pistonCombustionEngine: false, externallyChargeable: true, combustionFuel: null, hybridization: null, basis: "type_approval" },
  taxWeight: { kg: 2260, basis: "vehicle_register" }, co2: { gramsPerKm: 0, method: "wltp_combined" },
  firstRegistration: { precision: "month", value: "2024-03", basis: "vehicle_register" },
  fx: { acquisition: fxAcq("10.663058"), customs: fxCust("10.663058") },
  ...over,
});


import { EconomicsNote } from "@/components/search/EconomicsNote";
import { whyShown } from "@/lib/search-explain";
import { Fragment } from "react";
import { SYNTHETIC_DEFAULT_EPOCH } from "@/providers/marketplace/synthetic/epoch";

const dspec = () => { const r = parseSearchFormValues({ ...EXAMPLES.find((e) => e.id === "demo-ix3")!.values() }, DEMO_CATALOG, { newCostId: () => "000000000001" }); if (!r.ok || !r.spec) throw new Error("spec"); return r.spec; };
const demoAt = async (at: string): Promise<DisplayItem[]> => { const d = new Date(at); const out = await previewForDisplay(dspec(), { provider: new SyntheticMarketplaceProvider({ records: syntheticRawListings, now: () => d, epoch: SYNTHETIC_DEFAULT_EPOCH }), now: () => d }); if (!out.ok) throw new Error("demo"); return out.items; };
const summaryState = (i: DisplayItem) => toAcquisitionSummary(i.economics).state;
/** Detaljsidens økonomidel slik siden setter den sammen. */
const page = (i: DisplayItem): string => {
  const s = toAcquisitionSummary(i.economics);
  return text(renderToStaticMarkup(createElement(Fragment, null, createElement("p", null, whyShown(i.assessment.vehicle)), createElement("p", null, SUMMARY_BUDGET_NOTE),
    createElement(AcquisitionSummary, { summary: s, formHref: "/f" }), createElement(EconomicsNote, { economics: i.economics, summary: s, dealerFormHref: "/f" }))));
};
const cardText = (i: DisplayItem): string => text(card(i));
const count = (hay: string, needle: string): number => hay.split(needle).length - 1;
const FORBIDDEN = /ikke validert|godkjent for validering|ikke godkjent|Regelmotor|regelmotor|Ikke løst|docs\/tax|Beregningsgrunnlag|\.json\b/;

/** De sju tilstandene fra PILOT-004-auditen, gjennom ekte pipeline. */
async function states(): Promise<Record<string, DisplayItem>> {
  const today = await demoAt("2026-10-23T12:00:00Z");
  const expired = (await demoAt("2027-01-15T12:00:00Z")).find((i) => i.economics.status === "not_calculated" && i.economics.explanation !== null)!;
  return {
    complete: await run({}),
    scenariosDemo: today.find((i) => summaryState(i) === "scenarios")!,
    partial: await run({ transportToBorder: undefined }),
    unavailable: today.find((i) => summaryState(i) === "unavailable")!,
    expiredTax: expired,
    missingFx: await run(bev({ fx: undefined }), { l: ix3() }),
    ownEur: await run(bev({ transportToBorder: { amount: "8000" }, customsDate: { date: "2026-10-20", kind: "actual_acceptance" } }), { l: ix3() }),
  };
}

describe("1–2. én primær økonomiflate: ingen gjentatt total eller status", () => {
  it("kortet: totalen/området/delsummen står én gang, og den gamle legacy-statuslinjen er borte (bare skjult statusnode)", async () => {
    const s = await states();
    expect(count(cardText(s.complete!), "468 723")).toBe(1);
    expect(count(cardText(s.scenariosDemo!), "484 214 – 559 214 kr")).toBe(1);
    expect(count(cardText(s.partial!), "433 723")).toBe(1);
    for (const [name, i] of Object.entries(s)) {
      const html = card(i);
      expect(html, name).not.toMatch(/<p[^>]*data-testid="economics"/); // ingen synlig legacy-linje
      expect(html, name).not.toContain('data-testid="economics-headline"');
      expect(cardText(i), name).not.toContain("Anslått innkjøpskostnad til Norge");
      expect(html, name).toMatch(/data-testid="economics"[^>]*data-economics-status/); // maskinlesbar status beholdt
    }
  });
  it("detalj: komplett estimat — totalen står én gang (ikke som overskrift, brutto utlegg og økonomisk kostnad i tillegg)", async () => {
    const t = page((await states()).complete!);
    expect(count(t, "468 723")).toBe(1);
    expect(t).not.toContain("Brutto utlegg");
    expect(t).not.toContain("Økonomisk kostnad");
    expect(t).not.toContain("Estimat:"); // legacy-overskriften
    expect(t).toContain("Slik er beløpet bygget opp"); // dypere forklaring beholdt
    expect(t).toContain("Det er ikke nødvendigvis kontantbetaling ved grensen"); // forklaringen står én gang uten gjentatt total
  });
  it("detalj: delsum og scenarioområde — samme tall gjentas ikke under andre navn", async () => {
    const s = await states();
    const p = page(s.partial!);
    expect(count(p, "433 723")).toBe(1);
    expect(p).not.toMatch(/Minst\s+433/);
    expect(p).not.toContain("Brutto utlegg:");
    const d = page(s.scenariosDemo!);
    expect(count(d, "484 214 – 559 214 kr")).toBe(1);
    expect(d).not.toContain("Brutto utlegg:");
    expect(d).not.toContain("Scenarier — fradragsstatus er ukjent"); // legacy-overskriften
  });
});

describe("3. kostnad etter mva.-fradrag: bare når den avviker, med forhandlerspråk", () => {
  it("ikke-fradragsberettiget komplett estimat: samme tall som totalen ⇒ ikke vist; ukjent fradrag (demo) ⇒ vist med nytt navn og scenarier; kjent fradrag ⇒ lavere tall vist", async () => {
    const s = await states();
    expect(page(s.complete!)).not.toContain("Kostnad etter mva.-fradrag"); // deduction non_recoverable ⇒ identisk med totalen
    const demo = page(s.scenariosDemo!);
    expect(demo).toContain("Kostnad etter mva.-fradrag");
    expect(demo).toContain("hvis fradragsberettiget");
    expect(demo).not.toContain("Økonomisk kostnad");
    const rec = page(await run({ deduction: "recoverable" }));
    expect(rec).toContain("Kostnad etter mva.-fradrag");
    expect(rec).toMatch(/Kostnad etter mva\.-fradrag:\s*4\d\d\s\d{3}\skr/);
    expect(count(rec, "468 723")).toBe(1); // totalen fortsatt én gang
  });
});

describe("4–7. ingen intern valideringsterminologi, ingen filstier i forhandlerrettet utdata", () => {
  it("kort og detalj i alle sju tilstandene er frie for «ikke validert», «ikke godkjent (for validering)», «Regelmotor», «Ikke løst», «Beregningsgrunnlag» og dokumentstier", async () => {
    for (const [name, i] of Object.entries(await states())) {
      for (const t of [cardText(i), page(i)]) expect(t, name).not.toMatch(FORBIDDEN);
    }
  });
  it("erstatningene er på plass (bevarer usikkerheten): «Endelig kostnad må kontrolleres før kjøp», «Beregnet av Merovo», «Ikke avklart», «Syntetisk demokurs — ikke en markedskurs»", async () => {
    const s = await states();
    const own = page(s.ownEur!);
    expect(own).toContain("Endelig kostnad må kontrolleres før kjøp");
    expect(own).toContain("Beregnet av Merovo");
    expect(own).toContain("Ikke avklart");
    expect(own).toContain("Grunnlag for beregningen");
    const demo = page(s.scenariosDemo!);
    expect(demo).toContain("Syntetisk demokurs — ikke en markedskurs");
    expect(demo).not.toMatch(/Syntetisk demokurs — ikke en markedskurs \(«/); // ikke gjentatt i parentes
  });
  it("skjemasiden og etikettene: DF_NOT_VALIDATED og alle regeletiketter er frie for intern valideringsterminologi", () => {
    expect(L.DF_NOT_VALIDATED).not.toMatch(FORBIDDEN);
    for (const v of [...Object.values(L.BASIS_LABEL), ...Object.values(L.UNCERTAINTY_GROUP_TITLE), L.RULES_NOT_APPROVED, L.COVERAGE_DISCLAIMER, L.BREAKDOWN_BASIS_NOTE, ...Object.values(L.ECONOMICS_LABELS).filter((x) => x !== L.ECONOMICS_LABELS.validated)]) expect(v).not.toMatch(FORBIDDEN);
  });
});

describe("8. utløpt avgiftsgrunnlag: riktig årsak, ikke «registrer akseptdato»", () => {
  it("demoen 2027-01-15: «ikke beregnet» med årsaken avgiftsgrunnlaget, uten Registrer-lenke for akseptdato og uten generiske reservetekster", async () => {
    const i = (await states()).expiredTax!;
    const s = toAcquisitionSummary(i.economics);
    expect(s.state).toBe("unavailable");
    if (s.state === "unavailable") { expect(s.cause).toBe("tax_period"); expect(s.missing).not.toContain("customs_date"); }
    const raw = renderToStaticMarkup(createElement(Fragment, null, createElement(AcquisitionSummary, { summary: s, formHref: "/f" }), createElement(EconomicsNote, { economics: i.economics, summary: s, dealerFormHref: "/f" })));
    const t = text(raw);
    expect(t).toContain("Avgiftsgrunnlaget er ikke tilgjengelig for denne datoen.");
    expect(t).toContain("Å registrere en annen dato retter ikke dette.");
    expect(t).not.toContain("Akseptdato for tolldeklarasjon — Registrer");
    expect(raw).not.toContain("f-customs"); // ingen lenke til akseptdatofeltet
    expect(t).not.toContain("Kontantbehovet er ikke beregnet");
    expect(t).not.toContain("Forutsetning mangler eller er ikke dokumentert");
    expect(t).not.toContain("ligger utenfor dokumentert periode");
    expect(count(t, "Estimert innkjøpskostnad til Norge: ikke beregnet")).toBe(1);
    expect(t).not.toMatch(/Minst/);
  });
  it("manglende kurs er fortsatt «Registrer»-veiledning (en opplysning kan rette det), og tolkes ikke som avgiftsperiode", async () => {
    const i = (await states()).missingFx!;
    const s = toAcquisitionSummary(i.economics);
    expect(s.state).toBe("unavailable");
    if (s.state === "unavailable") { expect(s.cause).toBeUndefined(); expect(s.missing).toEqual(expect.arrayContaining(["fx_acquisition", "fx_customs"])); }
    expect(page(i)).toContain("Kurs for kjøpesum");
  });
});

describe("9–12. tallene er uendret", () => {
  it("9. komplett estimat: 468 723 = 100 000 + 333 723 + 27 000 + 8 000", async () => {
    const s = toAcquisitionSummary((await states()).complete!.economics);
    expect(s.state).toBe("estimate");
    if (s.state === "estimate") { expect(s.amountNok).toBe("468723"); expect(Object.fromEntries(s.lines.map((l) => [l.id, l.amountNok]))).toEqual({ purchase: "100000", registration_tax: "333723", vat: "27000", transport: "8000" }); }
  });
  it("10–11. EV-scenarioområde: demoen 484 214 – 559 214 kr; eget EUR/BEV-input 445 558 – 520 558 kr", async () => {
    const s = await states();
    for (const [i, expected] of [[s.scenariosDemo!, ["484214", "559214"]], [s.ownEur!, ["445558", "520558"]]] as const) {
      const sum = toAcquisitionSummary(i.economics);
      expect(sum.state).toBe("scenarios");
      if (sum.state === "scenarios") expect(sum.scenarios.map((c) => c.amountNok)).toEqual(expected);
    }
  });
  it("12. vanlig forhandlerinput: delsum uten transport er uendret (433 723, mangler transport)", async () => {
    const sum = toAcquisitionSummary((await states()).partial!.economics);
    expect(sum.state).toBe("partial");
    if (sum.state === "partial") { expect(sum.amountNok).toBe("433723"); expect(sum.missing).toContain("transport_to_border"); }
  });
});

describe("skjult statusnode på kortet: ingen tilgjengelighetseksponering, ingen legacy-tekst", () => {
  it("noden er `hidden` (display:none ⇒ utenfor tilgjengelighetstreet), har ingen tekstbarn og ingen aria/rolle — bare data-*-attributter for kontroller", async () => {
    for (const [name, i] of Object.entries(await states())) {
      const html = card(i);
      const nodes = html.match(/<[a-z]+[^>]*data-testid="economics"[^>]*>(?:<\/[a-z]+>)?/g) ?? [];
      expect(nodes.length, name).toBe(1);
      const n = nodes[0]!;
      expect(n, name).toMatch(/^<span hidden=""/);
      expect(n, name).not.toMatch(/aria-|role=|tabindex/);
      expect(n, name).toMatch(/^<span[^>]*><\/span>$/); // ingen innhold
      expect(n, name).toContain("data-economics-status=");
      // all synlig/tilgjengelig tekst er utenfor noden: fjernes noden, endres ikke teksten
      expect(text(html.replace(n, "")), name).toBe(text(html));
    }
  });
});

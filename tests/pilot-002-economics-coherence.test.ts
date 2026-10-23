/**
 * PILOT-002 — én sammenhengende økonomimelding per tilstand (kun presentasjon).
 *
 * Kjører ekte pipeline (rettigheter → adapter → motor → visningsgrense → sammendrag) der det er mulig, og rendrer de faktiske komponentene som detaljsiden setter sammen
 * (`whyShown` + budsjettnotis + `AcquisitionSummary` + `EconomicsNote`). Ingen formel, regel eller beløp er endret; testene låser at tekstene aldri motsier hverandre.
 */
import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DEMO_CATALOG } from "@/adapters/search-catalog/demo-catalog";
import { AcquisitionSummary } from "@/components/search/AcquisitionSummary";
import { EconomicsExplanation, amountText } from "@/components/search/EconomicsExplanation";
import { EconomicsNote } from "@/components/search/EconomicsNote";
import { ResultCard } from "@/components/search/ResultCard";
import { toAcquisitionSummary, type EconomicsView } from "@/domain/search-economics";
import { LINE_TREATMENT_TEXT, SEARCH_LINE_ENGINE_TRANSPORT_NOTE, SUMMARY_BUDGET_NOTE, economicsHeadline, searchLineText } from "@/lib/search-labels";
import { whyShown } from "@/lib/search-explain";
import { syntheticRawListings } from "@/providers/marketplace/synthetic/fixtures";
import { SyntheticMarketplaceProvider } from "@/providers/marketplace/synthetic/provider";
import { EXAMPLES } from "@/server/search-examples";
import { parseSearchFormValues } from "@/server/search-form";
import { previewForDisplay, type DisplayItem } from "@/server/search-display";
import { listing } from "./fixtures/economics-005c";

const NOW = new Date("2026-10-14T12:00:00Z"); // innenfor demoens observasjons-/profilvindu
const text = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/g, " ").replace(/\s+/g, " ");
const demoSpec = () => {
  const r = parseSearchFormValues({ ...EXAMPLES.find((e) => e.id === "demo-ix3")!.values() }, DEMO_CATALOG, { newCostId: () => "000000000001" });
  if (!r.ok || !r.spec) throw new Error(JSON.stringify(r.errors));
  return r.spec;
};
async function demoItems(): Promise<DisplayItem[]> {
  const out = await previewForDisplay(demoSpec(), { provider: new SyntheticMarketplaceProvider({ records: syntheticRawListings, now: () => NOW }), now: () => NOW });
  if (!out.ok) throw new Error("demo feilet");
  return out.items;
}
const card = (i: DisplayItem) => text(renderToStaticMarkup(createElement(ResultCard, { item: i, draftId: "d1", version: 1 })));
/** Detaljsidens økonomidel slik siden setter den sammen (whyShown, budsjettnotis, sammendrag, forklaringsblokk). */
const detail = (i: DisplayItem): string => {
  const s = toAcquisitionSummary(i.economics);
  return text(renderToStaticMarkup(createElement(Fragment, null,
    createElement("p", null, whyShown(i.assessment.vehicle)), createElement("p", null, SUMMARY_BUDGET_NOTE),
    createElement(AcquisitionSummary, { summary: s, formHref: "/f" }), createElement(EconomicsNote, { economics: i.economics, summary: s, dealerFormHref: "/f" }))));
};
/** «Innkjøpskostnaden er ikke beregnet» som GLOBAL påstand (linjenivå som «MVA ikke beregnet» er ikke en slik påstand). */
const NOT_CALCULATED_CLAIM = /innkjøpskostnad[^.]{0,60}ikke beregnet|kan ikke beregnes|Anslått innkjøpskostnad til Norge: Ikke beregnet/i;

const BASE_EXPL = { assumptions: { fx: [], customsAcceptance: { date: null, kind: "unknown" }, norwegianRegistration: { date: null, kind: null, defaulted: false }, vatRecoverability: { value: "unknown", source: null }, vatHandling: { value: "unknown", source: null }, rulesApprovedForValidation: false }, uncertainty: [], missing: [], coverage: { documented: 0, knownCostItems: 0 }, basisSummary: "dealer_stated", grossOutlayIsNotCashAtBorder: true } as const;
const lbView = (min: string, over: { purchase?: boolean; tax?: boolean; transport?: "known" | "unknown"; rows?: Array<{ id: string; kind: string; label: string; treatment: keyof typeof LINE_TREATMENT_TEXT; counted: boolean; amountNok: string | null }> } = {}): EconomicsView => ({
  status: "lower_bound", labelKey: "incomplete_lower_bound", cash: { kind: "lower_bound", minimumNok: min, missing: ["x"] }, landed: { kind: "lower_bound", minimumNok: min, missing: ["x"] },
  estimateReasons: [], incompleteReasons: ["x"], lines: [], dealerInput: { state: "none" }, notes: [], positiveBudgetEligible: false,
  explanation: {
    breakdown: [
      { id: "purchase", state: over.purchase === false ? "unknown" : "known", amountNok: over.purchase === false ? null : "100000", basis: "stated_input", inGrossOutlay: true },
      { id: "one_off_tax", state: over.tax === false ? "unknown" : "known", amountNok: over.tax === false ? null : "10000", basis: "engine_estimate", inGrossOutlay: true },
      { id: "scrappage_deposit", state: over.tax === false ? "unknown" : "known", amountNok: over.tax === false ? null : "2400", basis: "engine_estimate", inGrossOutlay: true },
      { id: "import_vat", state: "unknown", amountNok: null, basis: "unresolved", inGrossOutlay: true },
      { id: "transport_to_border", state: over.transport ?? "unknown", amountNok: over.transport === "known" ? "8000" : null, basis: over.transport === "known" ? "stated_input" : "unresolved", inGrossOutlay: true },
    ],
    searchCosts: { rows: over.rows ?? [], countedNok: "0", uncountedLines: 0 }, ...BASE_EXPL,
  },
} as unknown as EconomicsView);

describe("1–3. beløp og «ikke beregnet» kan aldri stå sammen (ekte pipeline: demoen)", () => {
  it("1. estimat/scenarier: kort og detalj sier aldri at innkjøpskostnaden ikke er beregnet; budsjettnotisen er den samme og påstår bare det som er sant", async () => {
    const all = await demoItems();
    const shown = all.filter((i) => ["scenarios", "estimate", "partial"].includes(toAcquisitionSummary(i.economics).state));
    expect(shown.length).toBe(1); // den kuraterte demobilen
    for (const i of shown) {
      for (const t of [card(i), detail(i)]) {
        expect(t).toMatch(/\d{3}\s214/); // et beløp vises (484 214 – 559 214)
        expect(t).not.toMatch(NOT_CALCULATED_CLAIM);
        expect(t).toContain(SUMMARY_BUDGET_NOTE);
      }
    }
  });

  it("2. scenarioområdet (BMW iX3-demoen) er uendret motorutledet: 484 214 – 559 214 kr, og står uten «ikke beregnet»-påstand", async () => {
    const i = (await demoItems()).find((x) => toAcquisitionSummary(x.economics).state === "scenarios")!;
    const s = toAcquisitionSummary(i.economics);
    if (s.state !== "scenarios") throw new Error("forventet scenarier");
    expect(Object.fromEntries(s.scenarios.map((c) => [c.id, c.amountNok]))).toEqual({ with_exemption__basis_customs_value: "484214", no_exemption: "559214" });
    expect(card(i)).toContain("484 214 – 559 214 kr");
    expect(detail(i)).toContain("484 214 – 559 214 kr");
    expect(detail(i)).not.toMatch(NOT_CALCULATED_CLAIM);
    // nedbrytningen (genuint ulik informasjon) beholdes
    expect(detail(i)).toContain("Slik er beløpet bygget opp");
  });

  it("3. meningsfull delsum (kjent kjøpesum + engangsavgift) vises som delsum, uten «ikke beregnet»-påstand og med samme legacy-sum", () => {
    const e = lbView("112400", { transport: "known" });
    const s = toAcquisitionSummary(e);
    expect(s.state).toBe("partial");
    const t = text(renderToStaticMarkup(createElement(Fragment, null, createElement("p", null, SUMMARY_BUDGET_NOTE), createElement(AcquisitionSummary, { summary: s }), createElement(EconomicsNote, { economics: e, summary: s }))));
    expect(t).toContain("112 400 kr");
    expect(t).toContain("Foreløpig delsum");
    expect(t).not.toMatch(NOT_CALCULATED_CLAIM);
    expect(t).not.toMatch(/Minst 0/);
  });
});

describe("4–5. utilgjengelig tilstand: ett budskap, aldri et null-beløp, aldri «Minst 0 kr»", () => {
  it("4. alle annonser uten forhandlerinput: nøyaktig ÉN «ikke beregnet»-overskrift per kort/detalj, ingen kroneverdi i økonomidelen, ingen 0", async () => {
    const others = (await demoItems()).filter((i) => toAcquisitionSummary(i.economics).state === "unavailable");
    expect(others.length).toBeGreaterThan(50);
    for (const i of others) {
      const c = card(i), d = detail(i);
      for (const t of [c, d]) {
        expect((t.match(/Estimert innkjøpskostnad til Norge: ikke beregnet/g) ?? []).length).toBe(1);
        expect(t).not.toMatch(/Anslått innkjøpskostnad til Norge: Ikke beregnet/i); // legacy-dobbelen
        expect(t).not.toMatch(/Minst/);
        expect(t).not.toContain(SUMMARY_BUDGET_NOTE.replace(/\.$/, "") + "x");
      }
      expect(d).not.toMatch(/(Brutto utlegg|Økonomisk kostnad)[^A-Za-z]{0,6}(Minst|0 kr)/); // ingen summer uten støtte
      expect(d).not.toMatch(/Brutto utlegg:/);
      expect(d).not.toMatch(/innkjøpskostnaden er ikke beregnet|Innkjøpskostnad til Norge er ikke beregnet/); // ingen ekstra legacy-melding ved siden av overskriften
    }
  });

  it("5. «Minst 0 kr» finnes ikke: nedre grense 0 ⇒ ikke beregnet (modell, tekst, overskrift), og ukjente poster blir aldri 0", () => {
    const zero = lbView("0", { purchase: false, tax: false });
    expect(toAcquisitionSummary(zero).state).toBe("unavailable");
    expect(amountText({ kind: "lower_bound", minimumNok: "0", missing: [] })).toBe("Ikke beregnet");
    expect(economicsHeadline(zero)).toBe("Ikke beregnet");
    expect(amountText({ kind: "lower_bound", minimumNok: "2510", missing: [] })).toMatch(/^Minst 2\s510\skr \(ufullstendig\)$/); // meningsfull nedre grense er uendret
    const s = toAcquisitionSummary(zero);
    const html = renderToStaticMarkup(createElement(Fragment, null,
      createElement(AcquisitionSummary, { summary: s }), createElement(EconomicsNote, { economics: zero, summary: s }), createElement(EconomicsNote, { economics: zero, summary: s, compact: true }),
      createElement(EconomicsNote, { economics: zero }), createElement(EconomicsNote, { economics: zero, compact: true })));
    expect(text(html)).not.toMatch(/Minst\s+0/);
    expect(text(html)).not.toMatch(/(^|[^\d])0\s?kr/);
    // utilgjengelig sammendrag + legacy lower_bound med positiv grense som sammendraget ikke støtter: ingen kroneverdi i summene
    const unsupported = lbView("2510", { purchase: false });
    const us = toAcquisitionSummary(unsupported);
    expect(us.state).toBe("unavailable");
    const ut = text(renderToStaticMarkup(createElement(EconomicsNote, { economics: unsupported, summary: us })));
    expect(ut).not.toMatch(/Minst|Brutto utlegg:/);
    expect(text(renderToStaticMarkup(createElement(EconomicsNote, { economics: unsupported, summary: us, compact: true }))).trim()).toBe(""); // ingen synlig tekst (bare skjult statusnode)
  });

  it("5b. ingen brukerrettet kodefil produserer «Minst 0»: legacy-overskrift og summer er beskyttet i alle komponenter", () => {
    // uten sammendrag (eldre kallsted): samme null-vern
    const zero = lbView("0");
    const t = text(renderToStaticMarkup(createElement(EconomicsNote, { economics: zero })));
    expect(t).not.toMatch(/Minst\s+0/);
    expect(economicsHeadline(lbView("0"))).not.toMatch(/Minst/);
  });
});

describe("6–7. transport: motorens oppgitte transport er «med», søkelinjer som ikke støttes er «ikke regnet med» — aldri samme transport begge veier", () => {
  const rows = [{ id: "c1", kind: "transport", label: "Transport", treatment: "unsupported" as const, counted: false, amountNok: "8000" }];
  const render = (e: EconomicsView) => text(renderToStaticMarkup(createElement(EconomicsExplanation, { e: e as Exclude<EconomicsView, { status: "unavailable" }> })));

  it("6. demoen: transport 8 000 kr er med i estimatet, og søkelinjen forklares som «ikke brukt fra søket», ikke som at transporten ikke er regnet med", async () => {
    const i = (await demoItems()).find((x) => toAcquisitionSummary(x.economics).state === "scenarios")!;
    const e = i.economics;
    if (e.status === "unavailable" || e.status === "not_calculated" || !e.explanation) throw new Error("forventet beregnet");
    // utgangspunktet fra PILOT-001: søkelinjen er `unsupported` og transporten er med i motoren
    expect(e.explanation.searchCosts.rows.find((r) => r.kind === "transport")).toMatchObject({ treatment: "unsupported", counted: false });
    expect(e.explanation.breakdown.find((r) => r.id === "transport_to_border")).toMatchObject({ amountNok: "8000", inGrossOutlay: true });
    const t = detail(i);
    expect(t).toContain("Transport 8 000 kr");
    expect(t).toContain(SEARCH_LINE_ENGINE_TRANSPORT_NOTE);
    expect(t).not.toContain("Transport (8 000 kr): støttes ikke (ikke regnet med)");
    expect(t).not.toMatch(/Transport[^.]{0,40}ikke regnet med/);
  });

  it("6b. samme regel i enhetsform: oppgitt motor-transport + ikke-støttet transportlinje ⇒ forklaring uten «ikke regnet med»", () => {
    const t = render(lbView("112400", { transport: "known", rows }));
    expect(t).toContain(`Transport (8 000 kr): ${SEARCH_LINE_ENGINE_TRANSPORT_NOTE}`);
    expect(t).not.toContain("ikke regnet med");
  });

  it("7. uten motor-transport forblir den ikke-støttede søkelinjen tydelig utelatt («støttes ikke (ikke regnet med)»); andre linjetyper er uendret", () => {
    const t = render(lbView("112400", { transport: "unknown", rows }));
    expect(t).toContain("Transport (8 000 kr): støttes ikke (ikke regnet med)");
    expect(t).not.toContain(SEARCH_LINE_ENGINE_TRANSPORT_NOTE);
    // ingen estimat vises (sammendraget «ikke beregnet», f.eks. utløpt) ⇒ aldri «transporten som er med i estimatet»
    const noEstimate = lbView("2510", { purchase: false, transport: "known", rows });
    const ns = toAcquisitionSummary(noEstimate);
    expect(ns.state).toBe("unavailable");
    const nt = text(renderToStaticMarkup(createElement(EconomicsNote, { economics: noEstimate, summary: ns })));
    expect(nt).not.toContain(SEARCH_LINE_ENGINE_TRANSPORT_NOTE);
    expect(searchLineText({ kind: "transport", treatment: "unsupported" }, false)).toBe(LINE_TREATMENT_TEXT.unsupported);
    expect(searchLineText({ kind: "insurance", treatment: "unsupported" }, true)).toBe(LINE_TREATMENT_TEXT.unsupported); // bare transport har motorparallell
    expect(searchLineText({ kind: "transport", treatment: "mapped_to_input" }, true)).toBe(LINE_TREATMENT_TEXT.mapped_to_input); // «inngår» forblir «inngår»
    expect(searchLineText({ kind: "transport", treatment: "not_included" }, true)).toBe(LINE_TREATMENT_TEXT.not_included);
  });
});

describe("8–9. ellers uendret", () => {
  it("8. demoens motorutledede økonomi er uendret (kjøpesum 424 925, engangsavgift 18 058, transport 8 000; scenarier 484 214 / 559 214)", async () => {
    const i = (await demoItems()).find((x) => toAcquisitionSummary(x.economics).state === "scenarios")!;
    const s = toAcquisitionSummary(i.economics);
    if (s.state !== "scenarios") throw new Error("forventet scenarier");
    expect(Object.fromEntries(s.lines.map((l) => [l.id, l.amountNok]))).toEqual({ purchase: "424925", registration_tax: "18058", vat: null, transport: "8000" });
    expect(s.scenarios.map((c) => c.amountNok)).toEqual(["484214", "559214"]);
  });

  it("9. ikke-demo (vanlig annonse, ingen forhandlerinput): fortsatt «ikke beregnet», ingen beløp; hvorfor-vist påstår ikke lenger noe om kostnad", async () => {
    const out = await previewForDisplay(demoSpec(), { provider: { source: "synthetic-demo", search: async () => ({ items: [listing()], nextPage: null, sourceTotal: 1, truncated: false, fetchedAt: NOW.toISOString(), rejected: [] }), getListing: async () => listing() }, now: () => NOW });
    if (!out.ok) throw new Error("feilet");
    const i = out.items[0]!;
    expect(toAcquisitionSummary(i.economics).state).toBe("unavailable");
    expect(i.economics.status).toBe("not_calculated");
    expect(card(i)).toContain("Estimert innkjøpskostnad til Norge: ikke beregnet");
    expect(whyShown({ ...i.assessment.vehicle, status: "match" } as never)).not.toMatch(/innkjøpskostnad/i);
  });
});

describe("10. ikke beregnet: ingen legacy-nedbrytning med kroneverdier (sluttregel), og verdifull forklaring beholdes ellers", () => {
  const note = (e: EconomicsView, s = toAcquisitionSummary(e)) => text(renderToStaticMarkup(createElement(EconomicsNote, { economics: e, summary: s, dealerFormHref: "/f" })));
  const transportRows = [{ id: "c1", kind: "transport", label: "Transport", treatment: "unsupported" as const, counted: false, amountNok: "8000" }];

  it("1–3. utløpt demo (ekte pipeline, klokke etter avgiftsprofilens periode): ingen kroneverdier fra nedbrytningen, ingen transportlinje, men årsak + «dette mangler» + skjemalenke", async () => {
    const LATE = new Date("2027-01-15T12:00:00Z"); // utenfor avgiftsprofilens periode (PILOT-003: observasjonsalder utløper ikke lenger den kuraterte demoen)
    const out = await previewForDisplay(demoSpec(), { provider: new SyntheticMarketplaceProvider({ records: syntheticRawListings, now: () => LATE }), now: () => LATE });
    if (!out.ok) throw new Error("demo feilet");
    const pick = out.items.find((i) => i.economics.status === "not_calculated" && i.economics.explanation !== null); // den kuraterte demobilen, nå «ikke beregnet» fordi avgiftsprofilens periode er utløpt
    if (!pick) throw new Error("fant ingen ikke-beregnet annonse med forklaring");
    const s = toAcquisitionSummary(pick.economics);
    expect(s.state).toBe("unavailable");
    const t = detail(pick);
    expect(t).not.toContain("Slik er beløpet bygget opp");
    expect(t).not.toMatch(/Kjøpesum\s+[\d\s]+kr|Engangsavgift\s+[\d\s]+kr|Tollverdi\s+[\d\s]+kr|Transport til innførselsstedet\s+[\d\s]+kr/);
    expect(t).not.toContain("Dine valgte tillegg fra søket");
    expect(t).not.toMatch(/Transport[^.]{0,40}(ikke regnet med|med i estimatet)/);
    expect(t).not.toMatch(/Minst/);
    expect(t).toContain("Estimert innkjøpskostnad til Norge: ikke beregnet");
    expect(t).toMatch(/Registrer|Dette mangler|Beregningen er utløpt|mangler/i);
  });

  it("1–3 (enhet): ikke-beregnet med kjent transport + ikke-støttet transportlinje ⇒ ingen nedbrytning/transportlinje; missing-guidance og skjemalenke beholdes", () => {
    const e = lbView("2510", { purchase: false, transport: "known", rows: transportRows });
    (e as { explanation: { missing: unknown[] } }).explanation.missing = [{ field: "fx_acquisition", collectable: true }];
    const t = note(e);
    const raw = renderToStaticMarkup(createElement(EconomicsNote, { economics: e, summary: toAcquisitionSummary(e), dealerFormHref: "/f" }));
    expect(toAcquisitionSummary(e).state).toBe("unavailable");
    expect(t).not.toContain("Slik er beløpet bygget opp");
    expect(t).not.toMatch(/\d\s?kr/);
    expect(t).not.toContain("Transport");
    expect(t).toContain("Dette må oppgis for å beregne mer");
    expect(raw).toContain('href="/f#f-');
  });

  it("4–5. estimat og scenarioområde (ekte demo) beholder nedbrytning, forutsetninger og søkelinje-forklaring", async () => {
    const i = (await demoItems()).find((x) => toAcquisitionSummary(x.economics).state === "scenarios")!;
    const t = detail(i);
    expect(t).toContain("Slik er beløpet bygget opp");
    expect(t).toMatch(/Kjøpesum\s+424\s925\skr/);
    expect(t).toContain("Dine valgte tillegg fra søket");
    expect(t).toContain(SEARCH_LINE_ENGINE_TRANSPORT_NOTE);
    const e = lbView("112400", { transport: "known" });
    expect(toAcquisitionSummary(e).state).toBe("partial");
    // estimat (enhet): kjent total
    const est = { ...lbView("0"), status: "estimate", labelKey: "estimate_not_validated", cash: { kind: "value", nok: "468723" }, landed: { kind: "value", nok: "468723" } } as unknown as EconomicsView;
    expect(toAcquisitionSummary(est).state).toBe("estimate");
    expect(note(est)).toContain("Slik er beløpet bygget opp");
  });

  it("6. meningsfull delsum beholder nedbrytningen", () => {
    const e = lbView("112400", { transport: "known", rows: transportRows });
    expect(toAcquisitionSummary(e).state).toBe("partial");
    const t = note(e);
    expect(t).toContain("Slik er beløpet bygget opp");
    expect(t).toContain("100 000 kr");
    expect(t).toContain(SEARCH_LINE_ENGINE_TRANSPORT_NOTE);
  });

  it("7. BMW iX3-demoens totaler er uendret", async () => {
    const i = (await demoItems()).find((x) => toAcquisitionSummary(x.economics).state === "scenarios")!;
    const s = toAcquisitionSummary(i.economics);
    if (s.state !== "scenarios") throw new Error("forventet scenarier");
    expect(s.scenarios.map((c) => c.amountNok)).toEqual(["484214", "559214"]);
    expect(detail(i)).toContain("484 214 – 559 214 kr");
  });
});

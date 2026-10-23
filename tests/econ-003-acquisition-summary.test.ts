/**
 * ECON-003-2 — anslått innkjøpskostnad til Norge i resultatflyten.
 *
 * Presentasjonsmodellen (`toAcquisitionSummary`) er en ren avledning av den eksisterende `EconomicsView`. Integrasjonstestene kjører den ELLER økonomikjernen ekte
 * (`previewForDisplay` → `assessEconomics` → `calculateEconomics`, registerprofilen, rettighetsgrensen) — ingen mock av motoren, og ECON-002-orakelet dupliseres ikke.
 *
 * Forventede tall er håndregnet fra satstabellene (docs/tax/rules.json) og oppgitt referanse, ikke kopiert fra motoren:
 *  Diesel (NOK 100 000-annonse, 1 976 kg, 179 g/km, 2023-11, norsk registrering 2026-10-30 ⇒ 35 mnd ⇒ 30 %): engangsavgift 333 723 (inkl. vrakpant 2 400),
 *    kjøpesum 100 000, transport til grensen 8 000 ⇒ tollverdi 108 000 ⇒ mva. 25 % = 27 000 ⇒ total 468 723.
 *  iX3 (EUR 36 950 netto, BEV, 2 260 kg, 2024-03 ⇒ 31 mnd ⇒ 30 %): (2 260−500)×12,71 = 22 369,60 × 0,70 = 15 658,72 ⇒ 15 658 + vrakpant 2 400 = 18 058.
 *    Testkurs 10,663058 (BACK-LØST fra referansens kjøpesum NOK 394 000 — ikke en markedskurs): 36 950 × 10,663058 = 393 999,99 ⇒ 394 000. Elbilfritak: mva. = 25 % × (tollverdi − 300 000).
 *    Uten transport: 25 % × 94 000 = 23 500 ⇒ total 394 000 + 18 058 + 23 500 = 435 558. Med transport 8 000 (i tollverdien): 25 % × 102 000 = 25 500 ⇒ total 445 558.
 */
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DEMO_CATALOG } from "@/adapters/search-catalog/demo-catalog";
import { AcquisitionSummary } from "@/components/search/AcquisitionSummary";
import { ResultCard } from "@/components/search/ResultCard";
import { policyAllowing } from "@/domain/display-policy";
import { REGISTERED_PROFILES, SYNTHETIC_DISPLAY_POLICY, rightsForSource, type ProviderRightsProfile } from "@/domain/provider-rights";
import { addNok, toAcquisitionSummary, toEconomicsView, type AcquisitionSummary as Summary, type DealerInputV1, type EconomicsView } from "@/domain/search-economics";
import type { NormalizedListing } from "@/domain/types";
import { SUMMARY_BUDGET_NOTE, BUDGET_NOT_CALCULATED } from "@/lib/search-labels";
import * as L from "@/lib/search-labels";
import type { MarketplaceProvider } from "@/providers/marketplace";
import { storedKey } from "@/server/dealer-economics";
import { syntheticRawListings } from "@/providers/marketplace/synthetic/fixtures";
import { SyntheticMarketplaceProvider } from "@/providers/marketplace/synthetic/provider";
import { EXAMPLES } from "@/server/search-examples";
import { parseSearchFormValues } from "@/server/search-form";
import { previewForDisplay, type DisplayItem, type EconomicsContext } from "@/server/search-display";
import { FIRM_A, NOW, SEARCH_1, candidateFor, dealerInput, listing, specOf, stored } from "./fixtures/economics-005c";
import { profile } from "./fixtures/rights-profiles";

const demo = rightsForSource("synthetic-demo", NOW, REGISTERED_PROFILES);
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
const summaryOf = async (input: Partial<DealerInputV1> | null, o: Parameters<typeof run>[1] = {}) => toAcquisitionSummary((await run(input, o)).economics);
const line = (s: Summary, id: string) => (s.state === "estimate" || s.state === "partial" || s.state === "scenarios" ? s.lines.find((l) => l.id === id) : undefined);
const scen = (s: Summary) => (s.state === "scenarios" ? Object.fromEntries(s.scenarios.map((c) => [c.id, c.amountNok])) : null);
const card = (i: DisplayItem) => renderToStaticMarkup(createElement(ResultCard, { item: i, draftId: "d1", version: 1 }));
const detail = (s: Summary, formHref?: string) => renderToStaticMarkup(createElement(AcquisitionSummary, { summary: s, formHref }));
/** Selve sammendragsblokken i kortet (annonseprisen og øvrig kortinnhold er ikke økonomi og skal ikke skannes for «ingen beløp»). */
const frag = (html: string): string => /<div class="mt-2 border-t[^>]*data-testid="acq-summary"[\s\S]*?<\/div>/.exec(html)?.[0] ?? "";
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

describe("1–2. komplett resultat: estimert total og nedbrytning stemmer med motoren", () => {
  it("diesel-annonse med full forhandlerinput ⇒ estimert total 468 723 = kjøpesum 100 000 + engangsavgift 333 723 + mva. 27 000 + transport 8 000", async () => {
    const i = await run({});
    const s = toAcquisitionSummary(i.economics);
    expect(s.state).toBe("estimate");
    if (s.state !== "estimate") return;
    expect(s.amountNok).toBe("468723");
    expect(Object.fromEntries(s.lines.map((l) => [l.id, l.amountNok]))).toEqual({ purchase: "100000", registration_tax: "333723", vat: "27000", transport: "8000" });
    expect(s.lines.every((l) => l.state === "known")).toBe(true);
    // linjene summerer til totalen (ingen skjult post)
    expect(addNok(s.lines.map((l) => l.amountNok!))).toBe(s.amountNok);
  });

  it("tallene er motorens egne: totalen er `cash` fra visningsmodellen, og hver linje er raden i forklaringen (engangsavgift = engangsavgift + vrakpant)", async () => {
    const e = (await run({})).economics;
    if (e.status === "unavailable" || e.status === "not_calculated" || e.explanation === null) throw new Error("forventet beregnet");
    const s = toAcquisitionSummary(e);
    if (s.state !== "estimate") throw new Error("forventet estimat");
    expect(e.cash).toEqual({ kind: "value", nok: s.amountNok });
    const row = (id: string) => e.explanation!.breakdown.find((r) => r.id === id)!.amountNok;
    expect(line(s, "purchase")!.amountNok).toBe(row("purchase"));
    expect(line(s, "vat")!.amountNok).toBe(row("import_vat"));
    expect(line(s, "transport")!.amountNok).toBe(row("transport_to_border"));
    expect(line(s, "registration_tax")!.amountNok).toBe(addNok([row("one_off_tax")!, row("scrappage_deposit")!]));
    expect(row("scrappage_deposit")).toBe("2400");
  });

  it("alt er merket som estimat; ingen intern terminologi eller offisielt språk i det forhandleren ser", async () => {
    const i = await run({});
    const html = text(card(i)) + " " + text(detail(toAcquisitionSummary(i.economics), "/f"));
    expect(html).toContain("Estimert total til Norge");
    expect(html).toContain("468 723 kr");
    expect(html).toMatch(/Estimat basert på annonsepris/);
    expect(html).toMatch(/Ikke en offisiell avgiftsberegning/);
    const own = [L.SUMMARY_TITLE, L.SUMMARY_TOTAL_LABEL, L.SUMMARY_TOTAL_SCOPE, L.SUMMARY_PARTIAL_LABEL, L.SUMMARY_PARTIAL_NOTE, ...Object.values(L.SUMMARY_LINE_LABEL), L.SUMMARY_ESTIMATE_NOTE, L.SUMMARY_PRICE_CLAIM_NOTE,
      L.SUMMARY_VAT_SCOPE_NOTE, L.SUMMARY_TRANSPORT_NOTE, L.SUMMARY_FX_TITLE, L.SUMMARY_UNAVAILABLE_HEADLINE, L.SUMMARY_UNAVAILABLE_LEAD, L.SUMMARY_BUDGET_NOTE].join(" | ");
    for (const banned of [/validert/i, /godkjent/i, /\bTAX\b/, /REVIEW/, /garanti/i, /offisiell(?! avgiftsberegning)/i, /innenfor budsjett/i, /holder (seg )?(innenfor )?budsjett/i, /anbefal/i, /Minst/]) expect(own).not.toMatch(banned);
  });
});

describe("3–4. manglende data blir aldri 0, og ingen misvisende total vises", () => {
  const BAD = /\b0 kr\b|Minst 0|Minst\s+0\b/;
  it("manglende vekt ⇒ ikke beregnet, uten tall; vekt er oppført som manglende", async () => {
    const l = listing({ specs: { ...listing().specs, curbWeightKg: null } });
    const i = await run({ taxWeight: undefined }, { l });
    const s = toAcquisitionSummary(i.economics);
    expect(s.state).toBe("unavailable");
    if (s.state !== "unavailable") return;
    expect(s.missing).toContain("tax_weight");
    const html = card(i) + detail(s, "/f");
    expect(text(html)).toContain("ikke beregnet");
    expect(text(frag(card(i)))).toMatch(/mangler: avgiftsvekt/);
    expect(text(detail(s, "/f"))).toMatch(/Dette mangler for å beregne\s+Avgiftsvekt/);
    expect(html).not.toContain('data-testid="acq-total"');
    expect(text(html)).not.toMatch(BAD);
  });

  it("manglende CO₂ (forbrenningsbil) ⇒ ikke beregnet; CO₂ er oppført som manglende", async () => {
    const l = listing({ specs: { ...listing().specs, co2: null } });
    const s = await summaryOf({ co2: undefined }, { l });
    expect(s.state).toBe("unavailable");
    if (s.state === "unavailable") expect(s.missing).toContain("co2");
  });

  it("manglende registreringsdato (første registrering) ⇒ ikke beregnet", async () => {
    const l = listing({ specs: { ...listing().specs, firstRegistration: null } });
    const s = await summaryOf({ firstRegistration: undefined }, { l });
    expect(s.state).toBe("unavailable");
    if (s.state === "unavailable") expect(s.missing).toContain("first_registration");
  });

  it("utløpt avgiftsprofil (norsk registrering etter 2026-12-31) ⇒ ikke beregnet, ingen avgift og ingen total, forklart i klartekst", async () => {
    const i = await run({ norwegianRegistration: { date: "2027-01-15", kind: "expected" } });
    const s = toAcquisitionSummary(i.economics);
    expect(s.state).toBe("unavailable");
    const html = text(frag(card(i))) + " " + text(detail(s, "/f"));
    expect(html).not.toMatch(/\d\s?kr/); // ingen beløp
    expect(html).not.toMatch(BAD);
    expect(html).not.toMatch(/profile_|_exceeded|tax_blocked/); // aldri rå koder
  });

  it("ingen bekreftet forhandlerinput (eller ingen forhandlerkontekst) ⇒ ikke beregnet med klar årsak, aldri et tall", async () => {
    for (const o of [{ input: null as null, ctx: {} }, { input: null as null, ctx: { noContext: true } }]) {
      const i = await run(o.input, o.ctx);
      const s = toAcquisitionSummary(i.economics);
      expect(s.state).toBe("unavailable");
      const html = card(i);
      expect(text(html)).toContain("Estimert innkjøpskostnad til Norge: ikke beregnet");
      expect(text(html)).not.toMatch(BAD);
      expect(html).not.toContain('data-testid="acq-total"');
    }
  });

  it("delsum vises bare når kjøpesum OG engangsavgift er kjent, tydelig merket som ufullstendig — aldri som total", async () => {
    // ukjent transport til grensen ⇒ motoren gir nedre grense; kjøpesum og avgift er kjent ⇒ delsum
    const i = await run({ transportToBorder: undefined });
    const s = toAcquisitionSummary(i.economics);
    expect(s.state).toBe("partial");
    if (s.state !== "partial") return;
    expect(s.missing).toContain("transport_to_border");
    const html = text(card(i)) + " " + text(detail(s, "/f"));
    expect(html).toContain("Foreløpig delsum — ufullstendig");
    expect(html).toContain("Ikke en total: opplysninger mangler.");
    expect(html).not.toContain("Estimert total til Norge");
    expect(html).not.toMatch(BAD);
  });

  it("ukjent kurs for EUR-annonse (kjøpesum ukjent) ⇒ ikke en delsum av avgift + transport, men ikke beregnet", async () => {
    const i = await run(bev({ fx: undefined }), { l: ix3() });
    const s = toAcquisitionSummary(i.economics);
    expect(s.state).toBe("unavailable");
    if (s.state === "unavailable") expect(s.missing).toEqual(expect.arrayContaining(["fx_acquisition", "fx_customs"]));
    expect(text(frag(card(i)))).not.toMatch(/\d\s?kr/);
  });

  it("modellen gir aldri 0 for en ukjent post, og nedre grense 0 gir ingen tall", () => {
    const lb = (min: string, purchaseKnown: boolean): EconomicsView => ({
      status: "lower_bound", labelKey: "incomplete_lower_bound", cash: { kind: "lower_bound", minimumNok: min, missing: ["x"] }, landed: { kind: "lower_bound", minimumNok: min, missing: ["x"] },
      estimateReasons: [], incompleteReasons: ["x"], lines: [], dealerInput: { state: "none" }, notes: [], positiveBudgetEligible: false,
      explanation: { breakdown: [
        { id: "purchase", state: purchaseKnown ? "known" : "unknown", amountNok: purchaseKnown ? "100" : null, basis: "stated_input", inGrossOutlay: true },
        { id: "one_off_tax", state: "known", amountNok: "10", basis: "engine_estimate", inGrossOutlay: true }, { id: "scrappage_deposit", state: "known", amountNok: "2400", basis: "engine_estimate", inGrossOutlay: true },
        { id: "import_vat", state: "unknown", amountNok: null, basis: "unresolved", inGrossOutlay: true },
      ], searchCosts: { rows: [], countedNok: "0", uncountedLines: 0 }, assumptions: { fx: [], customsAcceptance: { date: null, kind: "unknown" }, norwegianRegistration: { date: null, kind: null, defaulted: false }, vatRecoverability: { value: "unknown", source: null }, vatHandling: { value: "unknown", source: null }, rulesApprovedForValidation: false }, uncertainty: [], missing: [], coverage: { documented: 0, knownCostItems: 0 }, basisSummary: "dealer_stated", grossOutlayIsNotCashAtBorder: true },
    });
    expect(toAcquisitionSummary(lb("0", true)).state).toBe("unavailable");
    expect(toAcquisitionSummary(lb("2510", false)).state).toBe("unavailable");
    const ok = toAcquisitionSummary(lb("2510", true));
    expect(ok.state).toBe("partial");
    if (ok.state === "partial") expect(line(ok, "vat")).toMatchObject({ amountNok: null, state: "unknown" });
  });
});

describe("5. transport tas bare med når den er oppgitt", () => {
  it("oppgitt 8 000 ⇒ linje og total inkluderer den (8 000 + 25 % mva. = 10 000); eksplisitt 0 ⇒ 0 er kjent; ikke oppgitt ⇒ ingen linje og ingen antatt beløp", async () => {
    const withT = await summaryOf({});
    const zero = await summaryOf({ transportToBorder: { amount: "0" } });
    const none = await summaryOf({ transportToBorder: undefined });
    if (withT.state !== "estimate" || zero.state !== "estimate") throw new Error("forventet estimat");
    expect(line(withT, "transport")).toMatchObject({ amountNok: "8000", state: "known" });
    expect(line(zero, "transport")).toMatchObject({ amountNok: "0", state: "known" }); // oppgitt som 0 av forhandler
    expect(BigInt(withT.amountNok) - BigInt(zero.amountNok)).toBe(10_000n);
    expect(none.state).toBe("partial");
    expect(line(none, "transport")).toBeUndefined();
    if (none.state === "partial") { expect(none.amountNok).not.toBe(withT.amountNok); expect(none.missing).toContain("transport_to_border"); }
  });

  it("standard transport (8 000) finnes ikke utenfor forhandlerinput: uten input ingen transportlinje", async () => {
    const s = await summaryOf(null);
    expect(s.state).toBe("unavailable");
    expect(JSON.stringify(s)).not.toContain("8000");
  });
});

describe("6. anskaffelseskurs og tollkurs holdes adskilt", () => {
  it("ulike kurser: kjøpesum følger anskaffelseskursen, mva.-grunnlaget følger tollkursen; begge vises som egne roller", async () => {
    // kjøpesum 36 950 × 10,66 = 393 887 ; tollverdi 36 950 × 10,70 + 8 000 = 403 365 ; avgift 18 058
    // med elbilfritak: mva. 25 % × (403 365 − 300 000) = 25 841,25 ⇒ 25 841 ⇒ total 393 887 + 18 058 + 25 841 + 8 000 = 445 786
    // uten elbilfritak: mva. 25 % × 403 365 = 100 841,25 ⇒ 100 841 ⇒ total 520 786
    const s = await summaryOf(bev({ transportToBorder: { amount: "8000" }, fx: { acquisition: fxAcq("10.66"), customs: fxCust("10.70") } }), { l: ix3() });
    expect(s.state).toBe("scenarios");
    expect(scen(s)).toEqual({ with_exemption__basis_customs_value: "445786", no_exemption: "520786" });
    if (s.state !== "scenarios") return;
    expect(line(s, "purchase")).toMatchObject({ amountNok: "393887", original: { amount: "36950", currency: "EUR" } });
    expect(line(s, "registration_tax")!.amountNok).toBe("18058");
    expect(line(s, "vat")).toMatchObject({ amountNok: null, state: "unknown" }); // ulik per scenario ⇒ ikke ett tall
    expect(s.fx.map((f) => [f.role, f.rate])).toEqual([["acquisition", "10.66"], ["customs", "10.7"]]);
    const html = text(detail(s));
    expect(html).toMatch(/Kurs for kjøpesum:\s*EUR\/NOK 10\.66/);
    expect(html).toMatch(/Tollkurs:\s*EUR\/NOK 10\.7/);
  });

  it("manglende tollkurs brukes ikke stilltiende som anskaffelseskurs: kurs mangler vises som egen mangel", async () => {
    const s = await summaryOf(bev({ fx: { acquisition: fxAcq("10.66") } }), { l: ix3() });
    expect(s.state).not.toBe("estimate");
    if (s.state === "estimate") return;
    expect(JSON.stringify(s)).toContain("fx_customs");
  });
});

describe("iX3-referansen fra oppdraget reproduseres av ekte motor (FX back-løst fra kjøpesum NOK 394 000)", () => {
  it("elbilfritaket er ikke bekreftet (kvalifikasjon samles ikke inn) ⇒ motoren gir to scenarier, vist som område — referansen 435 558 er scenariet MED fritak", async () => {
    // uten transport: med fritak 394 000 + 18 058 + 25 % × (394 000 − 300 000) = 23 500 ⇒ 435 558 ; uten fritak 394 000 + 18 058 + 25 % × 394 000 = 98 500 ⇒ 510 558
    const i = await run(bev({ transportToBorder: { amount: "0" } }), { l: ix3() });
    const s = toAcquisitionSummary(i.economics);
    expect(s.state).toBe("scenarios");
    expect(scen(s)).toEqual({ with_exemption__basis_customs_value: "435558", no_exemption: "510558" });
    if (s.state !== "scenarios") return;
    expect(s.scenarios.map((c) => c.amountNok)).toEqual(["435558", "510558"]); // stigende
    expect(Object.fromEntries(s.lines.map((l) => [l.id, l.amountNok]))).toEqual({ purchase: "394000", registration_tax: "18058", vat: null, transport: "0" });
    const c = text(frag(card(i)));
    expect(c).toContain("Estimert total til Norge: 435 558 – 510 558 kr inkl. engangsavgift og mva.");
    expect(c).toContain("Totalen avhenger av om elbilfritaket gjelder. Det er ikke bekreftet.");
    expect(c).not.toMatch(/Estimert total til Norge: 435 558 kr/); // aldri ett tall som skjuler usikkerheten
  });

  it("med transport 8 000 (i tollverdien, bærer også 25 % mva.): med fritak 445 558 (referansens «ca. 445 558»), uten fritak 520 558", async () => {
    // tollverdi 402 000 ⇒ med fritak mva. 25 % × 102 000 = 25 500 ⇒ 394 000 + 8 000 + 18 058 + 25 500 = 445 558 ; uten fritak 25 % × 402 000 = 100 500 ⇒ 520 558
    const s = await summaryOf(bev({ transportToBorder: { amount: "8000" } }), { l: ix3() });
    expect(scen(s)).toEqual({ with_exemption__basis_customs_value: "445558", no_exemption: "520558" });
    expect(Object.fromEntries((s.state === "scenarios" ? s.lines : []).map((l) => [l.id, l.amountNok]))).toEqual({ purchase: "394000", registration_tax: "18058", vat: null, transport: "8000" });
  });

  it("med den gyldne testkursen 10,6709 gir samme annonse en annen, motorberegnet kjøpesum — ingen tall er hardkodet i visningen", async () => {
    // 36 950 × 10,6709 = 394 289,755 ⇒ 394 290 ; engangsavgift uendret 18 058 ; mva. med fritak 25 % × 94 290 = 23 572,5 (x,5-likhet, U-013 uavklart)
    const i = await run(bev({ transportToBorder: { amount: "0" }, fx: { acquisition: fxAcq("10.6709"), customs: fxCust("10.6709") } }), { l: ix3() });
    const s = toAcquisitionSummary(i.economics);
    expect(s.state).not.toBe("estimate"); // aldri ett presist tall når motoren ikke kan velge avrunding
    if (s.state === "unavailable" || s.state === "hidden") throw new Error("forventet delsum eller scenarier");
    expect(line(s, "purchase")!.amountNok).toBe("394290");
    expect(line(s, "registration_tax")!.amountNok).toBe("18058");
    expect(line(s, "vat")).toMatchObject({ amountNok: null, state: "unknown" });
    if (s.state === "scenarios") expect(s.scenarios.map((c) => BigInt(c.amountNok))).toEqual([...s.scenarios.map((c) => BigInt(c.amountNok))].sort((a, b) => (a < b ? -1 : 1)));
  });
});

describe("7. syntetisk demo: BMW iX3-søket virker, med demomerking og uten tall uten forhandlerinput", () => {
  const demoSpec = () => {
    const r = parseSearchFormValues({ ...EXAMPLES.find((e) => e.id === "demo-ix3")!.values() }, DEMO_CATALOG, { newCostId: () => "000000000001" });
    if (!r.ok || !r.spec) throw new Error(JSON.stringify(r.errors));
    return r.spec;
  };
  const synth = () => new SyntheticMarketplaceProvider({ records: syntheticRawListings, now: () => NOW });

  it("uten forhandlerinput viser alle demokort «ikke beregnet» med klar årsak, bevarer demomerkingen, og viser ingen kroneverdi fra økonomien", async () => {
    const out = await previewForDisplay(demoSpec(), { provider: synth(), now: () => NOW });
    if (!out.ok) throw new Error("demo feilet");
    expect(out.items.length).toBeGreaterThan(0);
    for (const i of out.items) {
      const html = card(i);
      expect(i.economics.status).toBe("not_calculated");
      expect(text(frag(html))).toContain("Estimert innkjøpskostnad til Norge: ikke beregnet");
      expect(html).toContain('data-acq-state="unavailable"');
      expect(html).not.toContain('data-testid="acq-total"');
      expect(text(frag(html))).not.toMatch(/\d\s?kr/);
      expect(text(html)).toMatch(/Syntetisk/i); // demomerkingen er uendret
      expect(text(html)).toContain(BUDGET_NOT_CALCULATED.slice(0, 40)); // ingen estimat ⇒ den opprinnelige budsjettnotisen står
    }
  });

  it("toppannonsen (dix3-001) med forhandlerinput gir motorberegnede scenarier; søkets egen transportlinje (8 000, ekskl. mva.) telles ikke i tillegg", async () => {
    // Råpostens observasjon er 2026-10-12T18:00Z og den syntetiske profilen lagrer i 7 dager: klokken må ligge innenfor (i drift fornyes demoens observasjonstider, ECON-006e).
    const DEMO_NOW = new Date("2026-10-14T12:00:00Z");
    const spec = demoSpec();
    const clock = new SyntheticMarketplaceProvider({ records: syntheticRawListings, now: () => DEMO_NOW });
    const l = await clock.getListing("dix3-001");
    if (!l) throw new Error("dix3-001 mangler");
    const cand = candidateFor(l);
    const fa = { pair: "EUR/NOK", rate: "10.663058", sourceLabel: "TESTKURS (ikke en markedskurs)", effectiveAt: "2026-10-14", quotedAt: "2026-10-14", validUntil: "2026-10-31" };
    const fc = { pair: "EUR/NOK", rate: "10.663058", sourceLabel: "TESTKURS (ikke en markedskurs)", quotedAt: "2026-10-13", validFrom: "2026-10-13", validTo: "2026-10-31" };
    const input = dealerInput(bev({ transportToBorder: { amount: "8000" }, fx: { acquisition: fa, customs: fc }, customsDate: { date: "2026-10-14", kind: "expected_scenario" } }));
    const map = new Map([[storedKey(cand.id, cand.version), stored({ rights: demo, spec, cand, input, confirmedAt: "2026-10-14T11:00:00Z" })]]);
    const out = await previewForDisplay(spec, { provider: clock, now: () => DEMO_NOW, economics: { dealershipId: FIRM_A, searchId: SEARCH_1, storedInputs: map, profile: null } });
    if (!out.ok) throw new Error("demo feilet");
    const computed = out.items.filter((i) => toAcquisitionSummary(i.economics).state !== "unavailable");
    expect(computed).toHaveLength(1); // bare annonsen forhandleren har bekreftet input for
    const top = computed[0]!;
    const s = toAcquisitionSummary(top.economics);
    expect(s.state).toBe("scenarios");
    expect(scen(s)).toEqual({ with_exemption__basis_customs_value: "445558", no_exemption: "520558" }); // med back-løst kurs 10,663058
    if (s.state !== "scenarios") return;
    expect(line(s, "transport")!.amountNok).toBe("8000"); // én gang: fra forhandlerinput
    const e = top.economics;
    if (e.status === "unavailable" || e.status === "not_calculated") throw new Error("forventet beregnet");
    const search = e.explanation!.searchCosts.rows.find((r) => r.treatment === "unsupported");
    expect(search).toMatchObject({ counted: false, treatment: "unsupported" }); // søkelinjen er ikke med i totalen (eksisterende 005a-policy, uendret)
    expect(line(s, "purchase")!.original).toEqual({ amount: "36950", currency: "EUR" });
    const html = card(top);
    expect(text(frag(html))).toContain("Estimert total til Norge: 445 558 – 520 558 kr");
    expect(text(html)).toMatch(/Syntetisk/i);
    expect(html).toContain(SUMMARY_BUDGET_NOTE); // beløp vist ⇒ notisen motsier ikke estimatet
    expect(html).not.toContain(BUDGET_NOT_CALCULATED);
  });
});

describe("8. rettighetsgrensen omgås ikke", () => {
  it("uten visningsrett for avledet økonomi vises ingen sammendrag og ingen økonomitall", async () => {
    const hidden = await run({}, { profiles: [profile()] });
    expect(hidden.economics.status).toBe("unavailable");
    expect(toAcquisitionSummary(hidden.economics)).toEqual({ state: "hidden" });
    expect(renderToStaticMarkup(createElement(AcquisitionSummary, { summary: { state: "hidden" } }))).toBe("");
    expect(card(hidden)).not.toContain('data-testid="acq-summary"');
    expect(text(card(hidden))).not.toContain("Estimert total til Norge");
  });
  it("innsnevret feltvisning (pris ikke tillatt) ⇒ også skjult, selv med full forhandlerinput", async () => {
    const i = await run({}, { policyFor: () => policyAllowing(SYNTHETIC_DISPLAY_POLICY, ["title"]) });
    expect(i.economics.status).toBe("unavailable");
    expect(toAcquisitionSummary(i.economics)).toEqual({ state: "hidden" });
    expect(card(i)).not.toContain('data-testid="acq-total"');
  });
  it("modellen skiller ikke «skjult» fra «ikke beregnet»: skjult bærer aldri årsaker eller felt", () => {
    const view = toEconomicsView({ overall: "unavailable", reason: "rights_not_granted", labelKey: "rights_not_granted", positiveBudgetEligible: false }, { state: "none" }, []);
    expect(toAcquisitionSummary(view)).toStrictEqual({ state: "hidden" });
  });
});

describe("arkitektur og ren funksjon", () => {
  it("presentasjonen beregner ikke: komponenten og modellen importerer verken kjerne, avgiftsmotor, server eller provider", () => {
    for (const f of ["src/components/search/AcquisitionSummary.tsx", "src/domain/search-economics/acquisition-summary.ts"]) {
      const src = readFileSync(f, "utf8");
      expect(src, f).not.toMatch(/from\s+["']@\/(server|providers|adapters)|@\/domain\/economics["'/]|@\/domain\/tax|calculateEconomics|calculateNorwegianVehicleTax|assessEconomics|fetch\(/);
    }
  });
  it("addNok er eksakt (ingen flyttall) og avviser ugyldige verdier", () => {
    expect(addNok(["0.1", "0.2"])).toBe("0.3");
    expect(addNok(["15658", "2400"])).toBe("18058");
    expect(addNok(["100", "-0.5"])).toBe("99.5");
    expect(addNok(["12", "abc"])).toBeNull();
    expect(addNok(["1e3"])).toBeNull();
  });
  it("sammendraget er deterministisk: samme visningsmodell gir identisk resultat, og endrer ikke inputen", async () => {
    const e = (await run({})).economics;
    const before = JSON.stringify(e);
    expect(toAcquisitionSummary(e)).toEqual(toAcquisitionSummary(e));
    expect(JSON.stringify(e)).toBe(before);
  });
});

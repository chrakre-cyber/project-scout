/**
 * ECON-005d — økonomivisning gjennom rettighetsgrensen med faste statusetiketter. Kjernen kjøres ekte (registerprofilen, alle økonomiflagg false). Verifiserer: ferdig
 * visningsmodell uten kjerneinternt, rettighetsporter (beregning, visning, feltvisning for pris), faste etiketter uten budsjettspråk, ingen positive utfall, ingen lagring.
 */
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EconomicsNote } from "@/components/search/EconomicsNote";
import { ResultCard } from "@/components/search/ResultCard";
import { policyAllowing } from "@/domain/display-policy";
import { REGISTERED_PROFILES, SYNTHETIC_DISPLAY_POLICY, rightsForSource, type ProviderRightsProfile } from "@/domain/provider-rights";
import { toEconomicsView, type DealerInputV1, type DisplayTotal, type EconomicsDisplayStatus, type EconomicsView } from "@/domain/search-economics";
import type { NormalizedListing } from "@/domain/types";
import type { MarketplaceProvider } from "@/providers/marketplace";
import {
  ECONOMICS_HEADING, ECONOMICS_LABELS, ECONOMICS_NOT_BUDGET, ECONOMICS_NOTE_TEXT, ECONOMICS_REASON_TEXT, ECONOMICS_RIGHTS_TEXT, DEALER_INPUT_TEXT, LINE_TREATMENT_TEXT,
  economicsHeadline, economicsReasonText, formatNokString, staleReasonText,
} from "@/lib/search-labels";
import { loadStoredInputsForSearch, storedKey, type DealerEconomicsStore, type DealerInputRow } from "@/server/dealer-economics";
import { detailForDisplay, previewForDisplay, type DisplayItem, type EconomicsContext } from "@/server/search-display";
import { FIRM_A, FIRM_B, NOW, SEARCH_1, SEARCH_2, candidateFor, dealerInput, line, listing, specOf, stored } from "./fixtures/economics-005c";
import { profile } from "./fixtures/rights-profiles";

const demo = rightsForSource("synthetic-demo", NOW, REGISTERED_PROFILES);
const json = (v: unknown) => JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x));
const providerOf = (ls: NormalizedListing[]): MarketplaceProvider => ({
  source: "synthetic-demo",
  search: async () => ({ items: ls, nextPage: null, sourceTotal: ls.length, truncated: false, fetchedAt: NOW.toISOString(), rejected: [] }),
  getListing: async (id) => ls.find((l) => l.sourceListingId === id) ?? null,
});
/** Kontekst der bekreftelsen er gitt for annonsen (kanonisk kandidat) under gjeldende rettigheter. */
const ctxFor = (l: NormalizedListing, input: Partial<DealerInputV1> | null, over: Partial<EconomicsContext> = {}, rights = demo, spec = specOf()): EconomicsContext => {
  const cand = candidateFor(l);
  const map = new Map();
  if (input !== null) map.set(storedKey(cand.id, cand.version), stored({ rights, spec, cand, input: dealerInput(input) }));
  return { dealershipId: FIRM_A, searchId: SEARCH_1, storedInputs: map, profile: null, ...over };
};
const run = async (input: Partial<DealerInputV1> | null, o: { l?: NormalizedListing; profiles?: readonly ProviderRightsProfile[]; policyFor?: Parameters<typeof previewForDisplay>[1] extends infer X ? (X extends { policyFor?: infer P } ? P : never) : never; spec?: ReturnType<typeof specOf>; ctx?: Partial<EconomicsContext> | null } = {}) => {
  const l = o.l ?? listing();
  const spec = o.spec ?? specOf();
  const rights = rightsForSource("synthetic-demo", NOW, o.profiles ?? REGISTERED_PROFILES);
  const economics = o.ctx === null ? undefined : ctxFor(l, input, o.ctx ?? {}, rights, spec);
  const out = await previewForDisplay(spec, { provider: providerOf([l]), now: () => NOW, profiles: o.profiles, policyFor: o.policyFor, economics });
  if (!out.ok) throw new Error("kilden feilet");
  return out.items[0] as DisplayItem;
};
const prof = (de: { price?: boolean; registration?: boolean; specs?: boolean; display?: boolean }, over: Parameters<typeof profile>[0] = {}): ProviderRightsProfile =>
  profile({ storage: { ...profile().storage, retentionSeconds: 604_800 }, derivedEconomics: { allow: { price: de.price ?? false, registration: de.registration ?? false, specs: de.specs ?? false }, display: de.display ?? false }, ...over });

describe("statuser: estimat, nedre grense, scenarier, ikke beregnet — med faste etiketter", () => {
  it("fullt estimat ⇒ «Estimat — ikke validert: X kr», aldri validated; budsjettstatus forblir ikke beregnet", async () => {
    const i = await run({});
    const e = i.economics;
    expect(e.status).toBe("estimate");
    if (e.status !== "estimate") return;
    expect(e.labelKey).toBe("estimate_not_validated");
    expect(e.landed.kind).toBe("value");
    expect(economicsHeadline(e)).toBe(`${ECONOMICS_LABELS.estimate_not_validated}: ${formatNokString(e.landed.kind === "value" ? e.landed.nok : "")}`);
    expect(e.positiveBudgetEligible).toBe(false);
    expect(e.dealerInput).toEqual({ state: "in_use" });
    expect(i.assessment.budget.status).toBe("not_calculated");
    expect(i.assessment.isFullHit).toBe(false);
  });
  it("ukjent transport etter grensen ⇒ nedre grense «Minst X kr (ufullstendig)» — aldri punktestimat", async () => {
    const e = (await run({ transportAfterBorder: { state: "unknown" } })).economics;
    expect(e.status).toBe("lower_bound");
    if (e.status !== "lower_bound" || e.landed.kind !== "lower_bound") throw new Error("forventet nedre grense");
    expect(e.labelKey).toBe("incomplete_lower_bound");
    expect(economicsHeadline(e)).toBe(`Minst ${formatNokString(e.landed.minimumNok)} (ufullstendig)`);
    expect(e.landed.missing.length).toBeGreaterThan(0);
    expect(e.positiveBudgetEligible).toBe(false);
  });
  it("ukjent fradragsstatus ⇒ scenarier (merket), aldri ett tall presentert som fasit", async () => {
    const e = (await run({ deduction: "unknown" })).economics;
    expect(e.status).toBe("scenarios");
    if (e.status !== "scenarios" || e.landed.kind !== "scenarios") throw new Error("forventet scenarier");
    expect(e.labelKey).toBe("scenarios");
    expect(economicsHeadline(e)).toBe(ECONOMICS_LABELS.scenarios);
    expect(e.landed.scenarios.length).toBeGreaterThanOrEqual(2);
    expect(e.positiveBudgetEligible).toBe(false);
  });
  it("uten forhandlerinput: tekniske avgiftsinput er ukjente ⇒ aldri estimat; vises som «Minst … (ufullstendig)» med forhandleropplysninger «ingen» — ikke som et punktestimat", async () => {
    const e = (await run(null)).economics;
    expect(["lower_bound", "not_calculated"]).toContain(e.status);
    expect(e.status === "estimate" || e.status === "scenarios" || e.status === "validated").toBe(false);
    if (e.status === "lower_bound" || e.status === "not_calculated") expect(e.dealerInput).toEqual({ state: "none" });
    if (e.status === "lower_bound") expect(economicsHeadline(e)).toMatch(/^Minst .* \(ufullstendig\)$/);
  });
  it("kilden uten bekreftet prisgrunnlag (brutto uten belegg) ⇒ kjøpesummen er ikke løst; nedre grense uten pris, aldri pris som netto", async () => {
    const l = listing({ price: { ...listing().price!, basis: "unknown", basisEvidence: null } });
    const e = (await run({}, { l })).economics;
    expect(e.status === "estimate" || e.status === "validated").toBe(false);
    expect(e.positiveBudgetEligible).toBe(false);
  });
  it("uten forhandlerkontekst (ingen sesjon/søk) ⇒ ikke beregnet/no_dealer_context", async () => {
    const e = (await run(null, { ctx: null })).economics;
    expect(e).toMatchObject({ status: "not_calculated", reasons: ["no_dealer_context"] });
  });
  it("modellen er JSON-trygg (ingen bigint) og bærer bare kjente nøkler per status — ingen kjerneinterne felt", async () => {
    const KEYS: Record<string, string[]> = {
      estimate: ["cash", "dealerInput", "estimateReasons", "explanation", "incompleteReasons", "labelKey", "landed", "lines", "notes", "positiveBudgetEligible", "status"],
      not_calculated: ["dealerInput", "explanation", "labelKey", "positiveBudgetEligible", "reasons", "status"],
      unavailable: ["labelKey", "positiveBudgetEligible", "status"],
    };
    KEYS.lower_bound = KEYS.estimate!; KEYS.scenarios = KEYS.estimate!; KEYS.validated = KEYS.estimate!;
    for (const input of [{}, { transportAfterBorder: { state: "unknown" as const } }, { deduction: "unknown" as const }, null]) {
      const e = (await run(input)).economics;
      expect(() => JSON.stringify(e)).not.toThrow();
      expect(Object.keys(e).sort()).toEqual(KEYS[e.status]);
      expect(json(e)).not.toMatch(/blockers|acquisition|importVat|oneOffTax|taxLine|EconomicsResult|rawRate|candidate|SENTINEL/i);
    }
  });
  it("hver årsakskode som kjernen faktisk produserer i variantene har en egen norsk tekst (ingen generell reservetekst)", async () => {
    const generic = economicsReasonText("__ukjent__");
    const variants: Array<Partial<DealerInputV1> | null> = [{}, { transportAfterBorder: { state: "unknown" } }, { deduction: "unknown" }, { vatHandling: "unknown" }, { insurance: undefined }, { transportToBorder: undefined },
      { customsDate: { date: null, kind: "unknown" } }, { foreignVat: undefined }, { customsDate: { date: "2026-10-20", kind: "expected_scenario" } }, null];
    const codes = new Set<string>();
    for (const v of variants) {
      const e = (await run(v)).economics;
      if (e.status === "not_calculated") e.reasons.forEach((c) => codes.add(c));
      else if (e.status !== "unavailable") {
        [...e.estimateReasons, ...e.incompleteReasons, ...e.notes].forEach((c) => codes.add(c));
        if (e.landed.kind === "lower_bound") e.landed.missing.forEach((c) => codes.add(c));
        if (e.landed.kind === "none") e.landed.reasons.forEach((c) => codes.add(c));
      }
    }
    expect(codes.size).toBeGreaterThan(5);
    for (const c of codes) {
      if (ECONOMICS_NOTE_TEXT[c]) continue;
      expect(economicsReasonText(c), c).not.toBe(generic);
    }
  });
});

describe("rettighetsgrensen: uten rett ingen tall", () => {
  const sentinel = listing({ price: { ...listing().price!, stated: { amount: "123457", currency: "NOK" }, amount: { amountMinor: 12_345_700, currency: "NOK" } } });
  const noNumbers = (e: EconomicsView) => { expect(e).toEqual({ status: "unavailable", labelKey: "rights_not_granted", positiveBudgetEligible: false }); expect(json(e)).not.toMatch(/\d/); };
  it("ingen beregningsrett (profil uten avledet økonomi, selv med full visnings-/matchingrett) ⇒ unavailable", async () => {
    noNumbers((await run({}, { l: sentinel, profiles: [profile()] })).economics);
  });
  it("beregningsrett uten visningsrett for avledet økonomi ⇒ unavailable, men vurderingen finnes ellers", async () => {
    const p = prof({ price: true, registration: true, specs: true, display: false });
    const i = await run({}, { l: sentinel, profiles: [p] });
    noNumbers(i.economics);
    expect(["match", "needs_review", "excluded"]).toContain(i.assessment.vehicle.status);
  });
  it("visningsrett for avledet økonomi, men prisen kan ikke vises (feltrett) ⇒ unavailable", async () => {
    noNumbers((await run({}, { l: sentinel, profiles: [prof({ price: true, registration: true, specs: true, display: true }, { display: { price: false } })] })).economics);
  });
  it("overstyrt/innsnevret visningspolicy som skjuler prisen skjuler også økonomien (økonomi avslører pris)", async () => {
    const i = await run({}, { l: sentinel, policyFor: () => policyAllowing(SYNTHETIC_DISPLAY_POLICY, []) });
    noNumbers(i.economics);
    expect(json(i)).not.toContain("123457");
    const withPrice = await run({}, { l: sentinel, policyFor: () => policyAllowing(SYNTHETIC_DISPLAY_POLICY, ["price"]) });
    expect(withPrice.economics.status).not.toBe("unavailable");
  });
  it("kilde uten registrert profil/utløpt/utkast ⇒ annonsen vises ikke i det hele tatt (proveniens feiler lukket); økonomi når aldri UI", async () => {
    const out = await previewForDisplay(specOf(), { provider: providerOf([listing()]), now: () => NOW, profiles: [prof({ price: true, display: true }, { status: "draft", verifiedBy: null, verifiedAt: null })], economics: ctxFor(listing(), {}) });
    expect(out.ok && out.items).toEqual([]);
  });
  it("registrering/specs uten rett: forhandlerens egne verdier gjelder fortsatt og estimat vises; nektede felt påvirker ikke visningen", async () => {
    const l = listing({ specs: { ...listing().specs, curbWeightKg: 4321, co2: { gramsPerKm: 987, testMethod: "NEDC" }, firstRegistration: { precision: "year", year: 1993 } } });
    const p = prof({ price: true, display: true });
    const i = await run({}, { l, profiles: [p] });
    expect(i.economics.status).toBe("estimate");
    expect(i.economics.status === "estimate" && i.economics.dealerInput).toEqual({ state: "in_use" });
    expect(json(i.economics)).not.toMatch(/4321|987|1993/);
  });
  it("annet firmas bekreftelse brukes ikke og røpes ikke: dealerInput = ingen, ikke beregnet", async () => {
    const l = listing();
    const cand = candidateFor(l);
    const foreign = stored({ rights: demo, spec: specOf(), cand, dealershipId: FIRM_B });
    const ctx: EconomicsContext = { dealershipId: FIRM_A, searchId: SEARCH_1, storedInputs: new Map([[storedKey(cand.id, cand.version), foreign]]), profile: null };
    const out = await previewForDisplay(specOf(), { provider: providerOf([l]), now: () => NOW, economics: ctx });
    if (!out.ok) throw new Error("kilden feilet");
    const e = out.items[0]!.economics;
    expect(e.status === "estimate").toBe(false); // fremmed bekreftelse gir ikke estimat
    expect(e.status !== "unavailable" && e.dealerInput).toEqual({ state: "none" });
  });
  it("foreldet bekreftelse (annonsen endret) ⇒ «må bekreftes på nytt», ikke brukt", async () => {
    const l = listing();
    const older = candidateFor(listing({ price: { ...listing().price!, stated: { amount: "99999", currency: "NOK" }, amount: { amountMinor: 9_999_900, currency: "NOK" } } }));
    const oldRec = stored({ rights: demo, spec: specOf(), cand: older });
    const cur = candidateFor(l);
    // oppslag på gjeldende revisjon finner ingenting ⇒ ingen; med bekreftelse lagt under gjeldende nøkkel men bundet til gammel revisjon ⇒ stale
    const ctx: EconomicsContext = { dealershipId: FIRM_A, searchId: SEARCH_1, storedInputs: new Map([[storedKey(cur.id, cur.version), oldRec]]), profile: null };
    const out = await previewForDisplay(specOf(), { provider: providerOf([l]), now: () => NOW, economics: ctx });
    if (!out.ok) throw new Error("kilden feilet");
    const e = out.items[0]!.economics;
    expect(e.status === "estimate").toBe(false);
    expect(e.status !== "unavailable" && e.dealerInput).toEqual({ state: "needs_reconfirmation", reasons: ["candidate_version_changed"] });
  });
});

describe("ingen positive budsjettutfall eller varsler fra økonomivisningen", () => {
  const big = specOf([], "passenger", 900_000_000_000n); // svært høyt budsjett: ethvert tall ligger langt under
  const inputs: Array<[string, Partial<DealerInputV1> | null]> = [["estimat", {}], ["nedre grense", { transportAfterBorder: { state: "unknown" } }], ["scenarier", { deduction: "unknown" }], ["ingen input", null], ["ukjent vat-håndtering", { vatHandling: "unknown" }]];
  it.each(inputs)("%s: budsjettstatus aldri innenfor, isFullHit false, positiveBudgetEligible false", async (_n, input) => {
    const i = await run(input, { spec: big });
    expect(["within_budget", "within_deviation"]).not.toContain(i.assessment.budget.status);
    expect(i.assessment.budget.status).toBe("not_calculated");
    expect(i.assessment.isFullHit).toBe(false);
    expect(i.economics.positiveBudgetEligible).toBe(false);
    expect(i.economics.status === "validated").toBe(false);
  });
  it("bare validated kan være positiv-berettiget (uoppnåelig med registerprofilen): ren projeksjon av en validert statusmodell", () => {
    const val: EconomicsDisplayStatus = { overall: "validated", labelKey: "validated", cash: { kind: "value", valueNok: 500_000n }, landed: { kind: "value", valueNok: 500_000n }, estimateReasons: [], incompleteReasons: [], reasons: [], lines: [], positiveBudgetEligible: true };
    expect(toEconomicsView(val, { state: "in_use" }, [])).toMatchObject({ status: "validated", labelKey: "validated", positiveBudgetEligible: true });
    for (const overall of ["estimate", "incomplete"] as const) {
      const totals: DisplayTotal[] = [{ kind: "value", valueNok: 1n }, { kind: "lower_bound", minimumNok: 1n, missing: [] }, { kind: "scenarios", scenarios: [{ id: "a", label: "a", valueNok: 1n }] }];
      for (const landed of totals) {
        const v = toEconomicsView({ ...val, overall, labelKey: "estimate_not_validated", landed, positiveBudgetEligible: true }, { state: "in_use" }, []);
        expect(v.positiveBudgetEligible, `${overall}/${landed.kind}`).toBe(false);
        expect(v.status === "validated").toBe(false);
      }
    }
  });
  it("nedre grense presenteres aldri som punktestimat, heller ikke når kjernen kaller resultatet estimat", () => {
    const d: EconomicsDisplayStatus = { overall: "estimate", labelKey: "estimate_not_validated", cash: { kind: "value", valueNok: 1n }, landed: { kind: "lower_bound", minimumNok: 400_000n, missing: ["insurance"] }, estimateReasons: [], incompleteReasons: [], reasons: [], lines: [], positiveBudgetEligible: false };
    const v = toEconomicsView(d, { state: "none" }, []);
    expect(v.status).toBe("lower_bound");
    expect(economicsHeadline(v)).toContain("Minst");
    expect(economicsHeadline(v)).toContain("ufullstendig");
  });
});

describe("faste etiketter og markup", () => {
  const POSITIVE = [/innenfor budsjett/i, /innenfor avvik/i, /fullt treff/i, /holder (seg )?(innenfor )?budsjett/i, /anbefal/i, /god handel/i, /lønnsom/i, /gunstig/i, /✓|✔/];
  const stripNegations = (h: string) => h.split(ECONOMICS_NOT_BUDGET).join("");
  const allTexts = () => [...Object.values(ECONOMICS_LABELS), ECONOMICS_HEADING, ECONOMICS_RIGHTS_TEXT, ...Object.values(ECONOMICS_REASON_TEXT), ...Object.values(ECONOMICS_NOTE_TEXT), ...Object.values(DEALER_INPUT_TEXT), ...Object.values(LINE_TREATMENT_TEXT), staleReasonText("x")];
  it("etikettene er faste konstanter (snapshot)", () => {
    expect(ECONOMICS_LABELS).toEqual({
      estimate_not_validated: "Estimat — ikke validert", incomplete_lower_bound: "Minst {amount} (ufullstendig)", scenarios: "Scenarier — fradragsstatus er ukjent",
      not_calculated: "Ikke beregnet", rights_not_granted: "Ikke tilgjengelig for denne kilden", validated: "Validert beregning",
    });
    expect(ECONOMICS_NOT_BUDGET).toMatch(/ikke en budsjettvurdering/);
    expect(formatNokString("468723")).toBe("468 723 kr");
    expect(formatNokString("12")).toBe("12 kr");
    expect(formatNokString("1e3")).toBe("ukjent beløp");
  });
  it("ingen etikett eller årsakstekst bruker positivt budsjettspråk (budsjettsetningen er en negasjon og skannes for seg)", () => {
    for (const t of allTexts()) for (const re of POSITIVE) expect(t, t).not.toMatch(re);
    const neg = ECONOMICS_NOT_BUDGET;
    expect(neg).toMatch(/aldri/);
    expect(neg).toMatch(/ikke en budsjettvurdering/);
  });
  it("kortvisning i resultatkortet bruker de faste etikettene og sier at dette ikke er et budsjettutfall; unavailable viser ingen tall", async () => {
    const i = await run({});
    const html = renderToStaticMarkup(createElement(ResultCard, { item: i, draftId: "d1", version: 1 }));
    expect(html).toContain(`data-economics-status="estimate"`);
    expect(html).toContain(ECONOMICS_LABELS.estimate_not_validated);
    expect(html).toContain("ikke en budsjettvurdering");
    expect(html).toContain(`data-positive-budget="false"`);
    const fragment = /<p[^>]*data-testid="economics"[\s\S]*?<\/p>/.exec(html)?.[0] ?? "";
    expect(fragment.length).toBeGreaterThan(0);
    for (const re of POSITIVE) expect(stripNegations(fragment)).not.toMatch(re);
    const hidden = await run({}, { profiles: [profile()] });
    const h2 = renderToStaticMarkup(createElement(EconomicsNote, { economics: hidden.economics, compact: true }));
    expect(h2).toContain(ECONOMICS_LABELS.rights_not_granted);
    expect(h2).not.toMatch(/\d{3}/);
  });
  it("full visning: etikett, begge totaler, forutsetninger, kostnadslinjer, forhandlerinput-status; ingen budsjettspråk", async () => {
    const sp = specOf([line("transport", "transport", 800_000n), line("prep", "custom", 250_000n)]);
    const i = await run({ transportToBorder: undefined, lineScopes: { transport: "to_border" } }, { spec: sp });
    const html = renderToStaticMarkup(createElement(EconomicsNote, { economics: i.economics }));
    expect(html).toContain(ECONOMICS_HEADING);
    expect(html).toContain(`data-testid="economics-cash"`);
    expect(html).toContain(`data-testid="economics-landed"`);
    expect(html).toContain(`data-testid="economics-uncertainty"`); // ECON-006a: forutsetninger/forbehold er nå gruppert under «Hva som er usikkert»
    expect(html).toContain(`data-testid="economics-lines"`);
    expect(html).toContain(LINE_TREATMENT_TEXT.mapped_to_input);
    expect(html).toContain(LINE_TREATMENT_TEXT.added_to_total);
    expect(html).toContain(DEALER_INPUT_TEXT.in_use);
    expect(html).toContain("ikke en budsjettvurdering");
    for (const re of POSITIVE) expect(stripNegations(html)).not.toMatch(re);
  });
  it("ikke beregnet: årsaker på norsk, uten rå koder; nedre grense viser hva som mangler", async () => {
    const nc = renderToStaticMarkup(createElement(EconomicsNote, { economics: (await run(null, { ctx: null })).economics }));
    expect(nc).toContain(ECONOMICS_LABELS.not_calculated);
    expect(nc).not.toMatch(/propulsion_unknown|tax_blocked|no_dealer_context|_unknown\b/);
    const lb = renderToStaticMarkup(createElement(EconomicsNote, { economics: (await run({ transportAfterBorder: { state: "unknown" } })).economics }));
    expect(lb).toContain("Minst");
    expect(lb).toContain(`data-testid="economics-missing-fields"`); // ECON-006a: mangler vises som inputfelt
  });
  it("forhandlerinput som må bekreftes på nytt forklares med årsak", async () => {
    const html = renderToStaticMarkup(createElement(EconomicsNote, { economics: { status: "not_calculated", labelKey: "not_calculated", reasons: ["tax_blocked"], dealerInput: { state: "needs_reconfirmation", reasons: ["candidate_version_changed", "fx_expired"] }, explanation: null, positiveBudgetEligible: false } }));
    expect(html).toContain("annonsen er endret");
    expect(html).toContain("oppgitt kurs er utløpt");
  });
});

describe("detaljvisning, lagring og kobling", () => {
  it("detailForDisplay gir samme økonomimodell gjennom samme grense (og ingenting når annonsen blokkeres)", async () => {
    const l = listing();
    const ctx = ctxFor(l, {});
    const prev = await previewForDisplay(specOf(), { provider: providerOf([l]), now: () => NOW, economics: ctx });
    if (!prev.ok) throw new Error("kilden feilet");
    const id = prev.items[0]!.listing.listingId;
    const d = await detailForDisplay(specOf(), id, { provider: providerOf([l]), now: () => NOW, economics: ctx });
    expect(d.kind).toBe("ok");
    if (d.kind === "ok") expect(d.item.economics).toEqual(prev.items[0]!.economics);
    const blocked = await detailForDisplay(specOf(), id, { provider: providerOf([l]), now: () => NOW, economics: ctx, profiles: [prof({ price: true, display: true }, { validUntil: "2026-10-20T10:00:00Z" })] });
    expect(blocked.kind).toBe("blocked");
  });
  const row = (over: Partial<DealerInputRow> = {}): DealerInputRow => {
    const cand = candidateFor(listing());
    const s = stored({ rights: demo, spec: specOf(), cand });
    return { dealershipId: FIRM_A, searchId: SEARCH_1, candidateId: cand.id, candidateVersion: cand.version, inputSchemaVersion: 1, payload: s.input, context: s.context, confirmedBy: "u", confirmedAt: NOW.toISOString(), ...over };
  };
  const storeOf = (rows: DealerInputRow[]): DealerEconomicsStore => ({ getInput: async () => null, listInputs: async () => rows, saveInput: async () => ({ ok: true }), getProfile: async () => null, saveProfile: async () => ({ ok: true }) });
  it("loadStoredInputsForSearch: validerer og indekserer; andre firma/søk, ugyldig payload/kontekst og annen schemaversjon utelates", async () => {
    const cand = candidateFor(listing());
    const m = await loadStoredInputsForSearch(storeOf([
      row(), row({ dealershipId: FIRM_B, candidateVersion: "rev1:" + "1".repeat(64) }), row({ searchId: SEARCH_2, candidateVersion: "rev1:" + "2".repeat(64) }),
      row({ payload: { schemaVersion: 1, dealershipId: FIRM_B }, candidateVersion: "rev1:" + "3".repeat(64) }), row({ context: { costBasis: "[]" }, candidateVersion: "rev1:" + "4".repeat(64) }),
      row({ inputSchemaVersion: 2, candidateVersion: "rev1:" + "5".repeat(64) }), row({ confirmedBy: null, candidateVersion: "rev1:" + "6".repeat(64) }),
    ]), { dealershipId: FIRM_A, searchId: SEARCH_1 });
    expect([...m.keys()]).toEqual([storedKey(cand.id, cand.version)]);
    expect(await loadStoredInputsForSearch(storeOf([row()]), { dealershipId: FIRM_A, searchId: "ikke-uuid" })).toEqual(new Map());
  });
  const src = (f: string) => readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  it("ingen lagring av avledede resultater i visningslagene: ingen skriveoperasjoner, ingen lagringsimport i visningsgrensen, komponent eller view", () => {
    for (const f of ["src/server/search-display.ts", "src/server/economics-view.ts", "src/components/search/EconomicsNote.tsx", "src/domain/search-economics/view.ts", "src/server/dealer-economics-context.ts"]) {
      const code = src(f);
      expect(code, f).not.toMatch(/\.insert\(|\.upsert\(|\.update\(|\.delete\(|localStorage|sessionStorage|writeFile|saveInput|saveProfile|cookies\(/);
    }
    for (const f of ["src/server/search-display.ts", "src/server/economics-view.ts", "src/components/search/EconomicsNote.tsx"]) expect(src(f), f).not.toMatch(/supabase|dealer-economics-store/);
  });
  it("UI bruker bare visningsmodellen: komponenten importerer ikke servermoduler/kjerne, og sidene henter kontekst via serverhjelperen", () => {
    const c = src("src/components/search/EconomicsNote.tsx");
    expect(c).not.toMatch(/@\/server|@\/domain\/economics|calculateEconomics|assessEconomics|EconomicsResult/);
    expect(src("src/app/searches/[id]/preview/page.tsx")).toMatch(/loadEconomicsContext\(ctx, draft\.id\)/);
    expect(src("src/app/searches/[id]/preview/[listingId]/page.tsx")).toMatch(/loadEconomicsContext\(ctx, draft\.id\)/);
    const ctxSrc = readFileSync("src/server/dealer-economics-context.ts", "utf8");
    expect(ctxSrc).toMatch(/^import "server-only";/);
  });
  it("økonomiflaggene og konfigurasjonen røres ikke av visningslaget", () => {
    for (const f of ["src/server/economics-view.ts", "src/domain/search-economics/view.ts", "src/components/search/EconomicsNote.tsx", "src/server/search-display.ts"]) {
      expect(src(f), f).not.toMatch(/vatRulesApproved|roundingApproved|customsFxRuleApproved|deductionRuleApproved|REGISTRY_ECONOMICS_PROFILE|classifyBudget\(/);
    }
  });
});

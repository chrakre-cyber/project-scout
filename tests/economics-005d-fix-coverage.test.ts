/**
 * ECON-005d retting (review av 47fb78a, P2): økonomiens visningsrett håndheves også ved tidlige avslag og manglende kontekst. Uten rett er modellen alltid uniform «unavailable»
 * (ingen årsaker, ingen status for forhandlerbekreftelse, ingen tall). Med rett vises «Ikke beregnet» fortsatt med relevante årsaker. Kjernen kjøres ekte (registerprofilen).
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EconomicsNote } from "@/components/search/EconomicsNote";
import { policyAllowing } from "@/domain/display-policy";
import { REGISTERED_PROFILES, SYNTHETIC_DISPLAY_POLICY, policyForSource, rightsForSource, type ProviderRightsProfile } from "@/domain/provider-rights";
import type { EconomicsView } from "@/domain/search-economics";
import type { NormalizedListing } from "@/domain/types";
import type { MarketplaceProvider } from "@/providers/marketplace";
import { toDisplayEconomics, toDisplayEconomicsWithoutContext } from "@/server/economics-view";
import { storedKey } from "@/server/dealer-economics";
import { assessEconomics } from "@/server/search-economics";
import { detailForDisplay, previewForDisplay, type EconomicsContext } from "@/server/search-display";
import { FIRM_A, NOW, SEARCH_1, candidate, candidateFor, dealerInput, listing, specOf, stored } from "./fixtures/economics-005c";
import { profile } from "./fixtures/rights-profiles";

const UNAVAILABLE = { status: "unavailable", labelKey: "rights_not_granted", positiveBudgetEligible: false } as const;
const prof = (de: { display?: boolean; price?: boolean; registration?: boolean; specs?: boolean }, over: Parameters<typeof profile>[0] = {}): ProviderRightsProfile =>
  profile({ storage: { ...profile().storage, retentionSeconds: 604_800 }, derivedEconomics: { allow: { price: de.price ?? true, registration: de.registration ?? true, specs: de.specs ?? true }, display: de.display ?? false }, ...over });
const providerOf = (ls: NormalizedListing[]): MarketplaceProvider => ({
  source: "synthetic-demo",
  search: async () => ({ items: ls, nextPage: null, sourceTotal: ls.length, truncated: false, fetchedAt: NOW.toISOString(), rejected: [] }),
  getListing: async (id) => ls.find((l) => l.sourceListingId === id) ?? null,
});
const ctxFor = (l: NormalizedListing, p: ProviderRightsProfile | null, spec = specOf()): EconomicsContext => {
  const cand = candidateFor(l);
  const rights = rightsForSource("synthetic-demo", NOW, p ? [p] : REGISTERED_PROFILES);
  return { dealershipId: FIRM_A, searchId: SEARCH_1, storedInputs: new Map([[storedKey(cand.id, cand.version), stored({ rights, spec, cand, input: dealerInput() })]]), profile: null };
};

/** Tidlige avslag som kan utløses gjennom den faktiske visningsgrensen (`previewForDisplay`). */
const EARLY: Array<[string, { l: NormalizedListing; spec: ReturnType<typeof specOf>; reason: string }]> = [
  ["fremtidig kildeobservasjon", { l: listing({ lastSeenAt: "2026-10-21T10:00:00Z" }), spec: specOf(), reason: "source_observation_in_future" }],
  ["scenario som ikke støttes (varebil)", { l: listing(), spec: specOf([], "van"), reason: "scenario_not_supported" }],
  ["annonse uten pris", { l: listing({ price: null }), spec: specOf(), reason: "price_missing" }],
];
const view = async (l: NormalizedListing, spec: ReturnType<typeof specOf>, o: { p?: ProviderRightsProfile; policyFor?: Parameters<typeof previewForDisplay>[1] extends infer X ? (X extends { policyFor?: infer P } ? P : never) : never; ctx?: boolean } = {}): Promise<EconomicsView> => {
  const out = await previewForDisplay(spec, { provider: providerOf([l]), now: () => NOW, profiles: o.p ? [o.p] : undefined, policyFor: o.policyFor, economics: o.ctx === false ? undefined : ctxFor(l, o.p ?? null, spec) });
  if (!out.ok) throw new Error("kilden feilet");
  expect(out.items).toHaveLength(1);
  return out.items[0]!.economics;
};
const json = (v: unknown) => JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x));

describe.each(EARLY)("tidlig avslag: %s", (_n, { l, spec, reason }) => {
  it("uten visningsrett for avledet økonomi ⇒ uniform «unavailable» — ingen årsak, ingen bekreftelsesstatus, ingen tall", async () => {
    const v = await view(l, spec, { p: prof({ display: false }) });
    expect(v).toEqual(UNAVAILABLE);
    expect(json(v)).not.toMatch(/reasons|dealerInput|in_use|needs_reconfirmation|\d/);
  });
  it("uten beregningsrett ⇒ «unavailable» (samme modell)", async () => {
    expect(await view(l, spec, { p: prof({ price: false, display: true }) })).toEqual(UNAVAILABLE);
  });
  it("prisen kan ikke vises (feltrett) ⇒ «unavailable»", async () => {
    expect(await view(l, spec, { p: prof({ display: true }, { display: { price: false } }) })).toEqual(UNAVAILABLE);
  });
  it("overstyrt feltpolicy uten pris ⇒ «unavailable», selv om profilen tillater visning", async () => {
    expect(await view(l, spec, { policyFor: () => policyAllowing(SYNTHETIC_DISPLAY_POLICY, []) })).toEqual(UNAVAILABLE);
  });
  it("med visningsrett (demoprofilen) ⇒ «Ikke beregnet» fortsatt med relevant årsak og status for forhandlerbekreftelse", async () => {
    const v = await view(l, spec);
    expect(v.status).toBe("not_calculated");
    if (v.status !== "not_calculated") return;
    expect(v.reasons).toEqual([reason]);
    expect(v.labelKey).toBe("not_calculated");
    expect(v.dealerInput.state).toMatch(/^(in_use|needs_reconfirmation|none)$/);
    expect(v.positiveBudgetEligible).toBe(false);
  });
  it("også med eksplisitt prispolicy og profil med visningsrett ⇒ «Ikke beregnet» med årsak", async () => {
    const v = await view(l, spec, { p: prof({ display: true }), policyFor: (s, at) => policyForSource(s, at, [prof({ display: true })]) });
    expect(v).toMatchObject({ status: "not_calculated", reasons: [reason] });
  });
});

describe("den reviewer-rapporterte forskjellen: reproduksjon gjennom visningsgrensen", () => {
  it("rettighetsavslag skjuler både årsaken og at bekreftelsen er i bruk; samme sak med visningsrett viser begge", async () => {
    const l = listing({ lastSeenAt: "2026-10-21T10:00:00Z" });
    expect(await view(l, specOf(), { p: prof({ display: false }) })).toEqual(UNAVAILABLE);
    expect(await view(l, specOf())).toEqual({ status: "not_calculated", labelKey: "not_calculated", reasons: ["source_observation_in_future"], dealerInput: { state: "in_use" }, explanation: null, positiveBudgetEligible: false });
  });
  it("detaljvisningen følger samme grense", async () => {
    const l = listing({ lastSeenAt: "2026-10-21T10:00:00Z" });
    const p = prof({ display: false });
    const ctx = ctxFor(l, p);
    const pv = await previewForDisplay(specOf(), { provider: providerOf([l]), now: () => NOW, profiles: [p], economics: ctx });
    if (!pv.ok) throw new Error("kilden feilet");
    const d = await detailForDisplay(specOf(), pv.items[0]!.listing.listingId, { provider: providerOf([l]), now: () => NOW, profiles: [p], economics: ctx });
    expect(d.kind === "ok" && d.item.economics).toEqual(UNAVAILABLE);
  });
});

describe("manglende økonomikontekst omgår ikke visningsgrensen", () => {
  const l = listing();
  it("uten kontekst og uten visningsrett ⇒ «unavailable» (ikke «ingen forhandlerkontekst»)", async () => {
    expect(await view(l, specOf(), { p: prof({ display: false }), ctx: false })).toEqual(UNAVAILABLE);
    expect(await view(l, specOf(), { p: prof({ price: false, display: true }), ctx: false })).toEqual(UNAVAILABLE);
  });
  it("uten kontekst og skjult pris (feltrett eller policy) ⇒ «unavailable»", async () => {
    expect(await view(l, specOf(), { p: prof({ display: true }, { display: { price: false } }), ctx: false })).toEqual(UNAVAILABLE);
    expect(await view(l, specOf(), { ctx: false, policyFor: () => policyAllowing(SYNTHETIC_DISPLAY_POLICY, []) })).toEqual(UNAVAILABLE);
  });
  it("uten kontekst med full rett ⇒ «Ikke beregnet» med årsaken «ingen forhandlerkontekst»", async () => {
    expect(await view(l, specOf(), { ctx: false })).toEqual({ status: "not_calculated", labelKey: "not_calculated", reasons: ["no_dealer_context"], dealerInput: { state: "none" }, explanation: null, positiveBudgetEligible: false });
  });
  it("direkte: toDisplayEconomicsWithoutContext følger samme tre porter", () => {
    const pol = SYNTHETIC_DISPLAY_POLICY;
    const demoRights = rightsForSource("synthetic-demo", NOW, REGISTERED_PROFILES);
    expect(toDisplayEconomicsWithoutContext(demoRights, pol)).toMatchObject({ status: "not_calculated", reasons: ["no_dealer_context"] });
    expect(toDisplayEconomicsWithoutContext(demoRights, policyAllowing(pol, []))).toEqual(UNAVAILABLE);
    expect(toDisplayEconomicsWithoutContext(rightsForSource("synthetic-demo", NOW, [prof({ display: false })]), pol)).toEqual(UNAVAILABLE);
    expect(toDisplayEconomicsWithoutContext(rightsForSource("ukjent", NOW, REGISTERED_PROFILES), pol)).toEqual(UNAVAILABLE);
    expect(toDisplayEconomicsWithoutContext(rightsForSource("synthetic-demo", NOW, [prof({ display: true }, { status: "revoked" })]), pol)).toEqual(UNAVAILABLE);
  });
});

describe("projeksjonen: tidlige avslag bærer ekte rettighetsbeslutning", () => {
  const spec = specOf();
  const asm = (p: ProviderRightsProfile, over: Parameters<typeof assessEconomics>[0] extends infer R ? Partial<R> : never = {}) => {
    const l = listing();
    const rights = rightsForSource("synthetic-demo", NOW, [p]);
    const cand = candidateFor(l);
    return assessEconomics({ dealershipId: FIRM_A, searchId: SEARCH_1, listing: l, candidate: cand, spec, stored: stored({ rights, spec, cand }), profile: null, profiles: [p], now: NOW, ...over });
  };
  it("rights.display speiler økonomiens visningsrett på tidlige avslag (ikke lenger alltid false)", () => {
    const denied = asm(prof({ display: false }), { candidate: candidate({ id: "x" }) });
    const allowed = asm(prof({ display: true }), { candidate: candidate({ id: "x" }) });
    expect(denied.kind === "not_calculated" && denied.rights).toMatchObject({ derive: true, display: false, reason: "display_not_granted", usedFields: [] });
    expect(allowed.kind === "not_calculated" && allowed.rights).toMatchObject({ derive: true, display: true, reason: null });
    const hiddenPrice = asm(prof({ display: true }, { display: { price: false } }), { candidate: candidate({ id: "x" }) });
    expect(hiddenPrice.kind === "not_calculated" && hiddenPrice.rights).toMatchObject({ display: false, reason: "reveal_not_granted" });
  });
  it("paringsavvik (annen annonse enn kandidaten): «unavailable» uten rett, årsak med rett", () => {
    const pol = SYNTHETIC_DISPLAY_POLICY;
    const bad = { candidate: candidate({ id: "x" }) };
    expect(toDisplayEconomics(asm(prof({ display: false }), bad), pol)).toEqual(UNAVAILABLE);
    expect(toDisplayEconomics(asm(prof({ display: true }), bad), pol)).toMatchObject({ status: "not_calculated", reasons: ["candidate_listing_mismatch"] });
  });
  it("ugyldig observasjonstidspunkt (stub-adapter): «unavailable» uten rett, årsak med rett", () => {
    const stub = { mapping: { sourceId: "s", version: "1" }, adapt: () => ({ ok: true as const, candidate: candidate(), meta: {} as never }) };
    const mk = (p: ProviderRightsProfile) => asm(p, { listing: listing({ lastSeenAt: "i går" }), candidate: candidate(), candidateAdapter: stub });
    expect(toDisplayEconomics(mk(prof({ display: false })), SYNTHETIC_DISPLAY_POLICY)).toEqual(UNAVAILABLE);
    expect(toDisplayEconomics(mk(prof({ display: true })), SYNTHETIC_DISPLAY_POLICY)).toMatchObject({ status: "not_calculated", reasons: ["source_observation_invalid"] });
  });
  it("«unavailable» fra beregningsrett er uendret; assessed-grenen er uendret (beskyttet av 005a-visningsstatusen)", () => {
    expect(toDisplayEconomics(asm(prof({ price: false, display: true })), SYNTHETIC_DISPLAY_POLICY)).toEqual(UNAVAILABLE);
    expect(toDisplayEconomics(asm(prof({ display: false })), SYNTHETIC_DISPLAY_POLICY)).toEqual(UNAVAILABLE);
    expect(toDisplayEconomics(asm(prof({ display: true })), SYNTHETIC_DISPLAY_POLICY).status).not.toBe("unavailable");
  });
});

describe("markup: uten rett vises ingen årsaker eller bekreftelsesstatus", () => {
  it("unavailable fra tidlig avslag gir rettighetsteksten, ikke årsakslisten", async () => {
    const l = listing({ lastSeenAt: "2026-10-21T10:00:00Z" });
    const denied = renderToStaticMarkup(createElement(EconomicsNote, { economics: await view(l, specOf(), { p: prof({ display: false }) }) }));
    expect(denied).toContain("Ikke tilgjengelig for denne kilden");
    expect(denied).not.toMatch(/economics-reasons|economics-dealer-input|fremtiden|observasjon|bekreftelse|Forhandleropplysning/i);
    const allowed = renderToStaticMarkup(createElement(EconomicsNote, { economics: await view(l, specOf()) }));
    expect(allowed).toContain("economics-reasons");
    expect(allowed).toMatch(/fremtiden/);
  });
});

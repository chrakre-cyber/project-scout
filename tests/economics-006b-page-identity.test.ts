/**
 * ECON-006b-FIX1 — rå kandidatidentitet og leverandørens annonse-id skal aldri til klienten. Den FAKTISKE siden (server-komponenten) kjøres med ekte `resolveDealerTarget` mot en
 * testkilde med en egen rettighetsprofil som NEKTER visning av `listing_id`; klientpropsene til skjemaet, rendret HTML og feilsvar fra action sjekkes for den rå id-en. Deretter
 * kjøres selve sløyfen side → markør → action: gyldig innsending lagres; ny revisjon, feil offentlig identitet og manipulert markør avvises uten skriving.
 * Statisk server-rendring, ikke nettleser; sesjon, utkast og lagring er mockede (ikke Supabase-integrasjon).
 */
import { isValidElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { noEconomicsRights, type ProviderRightsProfile } from "@/domain/provider-rights";
import type { MarketplaceProvider } from "@/providers/marketplace";
import type { NormalizedListing } from "@/domain/types";

const m = vi.hoisted(() => ({ session: vi.fn(), getDraft: vi.fn(), loadCtx: vi.fn(), saveInput: vi.fn(), opts: { profiles: undefined as unknown, provider: undefined as unknown, now: undefined as unknown } }));
vi.mock("@/server/session", () => ({ getSessionContext: m.session }));
vi.mock("@/server/search-drafts", () => ({ getDraft: m.getDraft }));
vi.mock("@/server/dealer-economics-context", () => ({ loadEconomicsContext: m.loadCtx }));
vi.mock("@/server/dealer-economics-store", () => ({ createDealerEconomicsStore: () => ({ saveInput: m.saveInput, getInput: vi.fn(), listInputs: vi.fn(), getProfile: vi.fn(), saveProfile: vi.fn() }) }));
vi.mock("@/server/search-display", async (orig) => {
  const real = await orig<typeof import("@/server/search-display")>();
  return { ...real, resolveDealerTarget: (spec: never, id: string, o: object = {}) => real.resolveDealerTarget(spec, id, { ...o, ...(m.opts as object) } as never) };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => { throw Object.assign(new Error("NEXT_REDIRECT"), { to }); },
  notFound: () => { throw Object.assign(new Error("NEXT_NOT_FOUND"), { notFound: true }); },
}));

import DealerInputPage from "@/app/searches/[id]/preview/[listingId]/dealer-input/page";
import { confirmDealerInputAction } from "@/app/searches/[id]/preview/[listingId]/dealer-input/actions";
import { EMPTY_DEALER_FORM_STATE } from "@/app/searches/[id]/preview/[listingId]/dealer-input/state";
import { DealerInputForm } from "@/components/search/DealerInputForm";
import { dealerInputToFormValues } from "@/domain/search-economics";
import { publicIdFor } from "@/server/public-ids";
import { FIRM_A, NOW, SEARCH_1, candidateFor, dealerInput, listing, specOf } from "./fixtures/economics-005c";
import { profile } from "./fixtures/rights-profiles";

const RAW = "provider-private-listing-783129";
const spec = specOf();
const member = { status: "member", dealership: { id: FIRM_A, name: "Firma A" }, user: { id: "u1" } };
const listingOf = (price = "100000"): NormalizedListing => listing({ sourceListingId: RAW, price: { ...listing().price!, stated: { amount: price, currency: "NOK" }, amount: { amountMinor: Number(price) * 100, currency: "NOK" } } });
const providerOf = (l: NormalizedListing): MarketplaceProvider => ({
  source: "synthetic-demo", search: async () => ({ items: [l], nextPage: null, sourceTotal: 1, truncated: false, fetchedAt: NOW.toISOString(), rejected: [] }), getListing: async () => l,
});
const econ = { price: true, registration: true, specs: true };
/** Profil som gir økonomirett og visning av alt UNNTATT leverandørens annonse-id (`listing_id`). */
const denyListingId: ProviderRightsProfile = profile({ storage: { ...profile().storage, retentionSeconds: 604_800 }, display: { listing_id: false }, derivedEconomics: { allow: { ...noEconomicsRights(), ...econ }, display: true } });
const allowListingId: ProviderRightsProfile = profile({ storage: { ...profile().storage, retentionSeconds: 604_800 }, derivedEconomics: { allow: { ...noEconomicsRights(), ...econ }, display: true } });
const PUBLIC = publicIdFor("synthetic-demo", RAW, "synthetic");
const draft = { id: SEARCH_1, name: "S", version: 4, readable: true, spec };

const collect = (node: unknown, out: Array<{ type: unknown; key: string | null; props: Record<string, unknown> }> = []) => {
  if (Array.isArray(node)) node.forEach((n) => collect(n, out));
  else if (isValidElement(node)) {
    const el = node as ReactElement<Record<string, unknown>>;
    out.push({ type: el.type, key: el.key, props: el.props });
    collect(el.props.children, out);
  }
  return out;
};
const renderPage = async (v = 4) => {
  const tree = await DealerInputPage({ params: Promise.resolve({ id: SEARCH_1, listingId: PUBLIC }), searchParams: Promise.resolve({ v: String(v) }) });
  const form = collect(tree).find((e) => e.type === DealerInputForm)!;
  return { tree, form, html: renderToStaticMarkup(tree as ReactElement) };
};
const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };
const submit = async (marker: string, over: Record<string, string> = {}) => {
  try { return { state: await confirmDealerInputAction(EMPTY_DEALER_FORM_STATE, fd({ searchId: SEARCH_1, listingId: PUBLIC, bindingMarker: marker, ...dealerInputToFormValues(dealerInput()), confirm: "yes", ...over })), to: null as string | null }; }
  catch (e) { const to = (e as { to?: string }).to; if (!to) throw e; return { state: null, to }; }
};

beforeEach(() => {
  vi.clearAllMocks();
  m.session.mockResolvedValue(member);
  m.getDraft.mockResolvedValue(draft);
  m.loadCtx.mockResolvedValue({ dealershipId: FIRM_A, searchId: SEARCH_1, storedInputs: new Map(), profile: null });
  m.saveInput.mockResolvedValue({ ok: true });
  m.opts.profiles = [denyListingId]; m.opts.provider = providerOf(listingOf()); m.opts.now = () => NOW;
});

describe("rå identitet når aldri klienten (faktisk side, nektet listing_id)", () => {
  it("klientprops, nøkler og rendret HTML inneholder ikke leverandørens annonse-id, kandidat-id eller revisjon", async () => {
    const { form, html } = await renderPage();
    expect(form).toBeTruthy();
    const serialized = JSON.stringify({ props: form.props, key: form.key }, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
    for (const where of [serialized, html]) {
      expect(where).not.toContain(RAW);
      expect(where).not.toContain("14:synthetic-demo");
      expect(where).not.toMatch(/synthetic-demo\//);
    }
    // klientpropsene er nøyaktig den nye trygge kontrakten
    expect(Object.keys(form.props).sort()).toEqual(["backHref", "bindingMarker", "initial", "lines", "listingId", "prefill", "profile", "searchId", "staleReasons"]);
    expect(form.props.listingId).toBe(PUBLIC);
    expect(String(form.props.bindingMarker)).toMatch(/^b1_[A-Za-z0-9_-]{32}$/);
    expect(form.key).toBe(form.props.bindingMarker);
  });
  it("revisjonen (innholdsavtrykket) er heller ikke i klientutdata", async () => {
    const cand = candidateFor(listingOf());
    const { form, html } = await renderPage();
    expect(cand.version.length).toBeGreaterThan(8);
    expect(JSON.stringify(form.props)).not.toContain(cand.version);
    expect(html).not.toContain(cand.version);
  });
  it("også med visning av listing_id tillatt vises ikke kandidat-id (som koder leverandør + id) i skjemaets egne felt", async () => {
    m.opts.profiles = [allowListingId];
    const { form, html } = await renderPage();
    expect(JSON.stringify(form.props)).not.toContain(RAW);
    expect(html).not.toMatch(/name="[^"]*[Cc]andidate/);
    expect(html).not.toContain("14:synthetic-demo");
  });
  it("feilresponser fra action inneholder ikke rå identitet (utdatert, manipulert, mangler økonomirett)", async () => {
    for (const marker of ["b1_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", ""]) {
      const r = await submit(marker);
      expect(JSON.stringify(r)).not.toMatch(/provider-private|14:synthetic-demo|synthetic-demo\//);
    }
    m.opts.profiles = [profile({ display: { listing_id: false } })]; // ingen økonomirett ⇒ unavailable
    const { form } = await (async () => { try { return await renderPage(); } catch { return { form: undefined }; } })();
    expect(form).toBeUndefined(); // siden viser ingen skjema (unavailable), altså heller ingen props
    const r = await submit("b1_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
    expect(JSON.stringify(r)).not.toMatch(/provider-private|14:synthetic-demo/);
    expect(m.saveInput).not.toHaveBeenCalled();
  });
});

describe("sløyfen side → markør → action", () => {
  it("gyldig innsending med markøren fra siden lagres under serverutledet nøkkel og omdirigerer til detaljsiden", async () => {
    const { form } = await renderPage();
    const r = await submit(String(form.props.bindingMarker));
    expect(r.to).toBe(`/searches/${SEARCH_1}/preview/${encodeURIComponent(PUBLIC)}?v=4&msg=econ_saved`);
    expect(m.saveInput).toHaveBeenCalledTimes(1);
    const [key] = m.saveInput.mock.calls[0]!;
    expect(key.searchId).toBe(SEARCH_1);
    expect(key.candidateId).toContain(RAW); // serversiden kjenner identiteten
    expect(key.candidateVersion).toBeTruthy();
  });
  it("annonsen får ny revisjon etter at siden ble åpnet ⇒ avvist uten skriving, og svaret røper ingen identitet", async () => {
    const { form } = await renderPage();
    m.opts.provider = providerOf(listingOf("111000")); // ny revisjon
    const r = await submit(String(form.props.bindingMarker));
    expect(r.to).toBeNull();
    expect(r.state?.stale).toBe(true);
    expect(JSON.stringify(r.state)).not.toMatch(/provider-private|14:synthetic-demo/);
    expect(m.saveInput).not.toHaveBeenCalled();
  });
  it("søket er lagret på nytt (ny versjon) etter at siden ble åpnet ⇒ avvist uten skriving", async () => {
    const { form } = await renderPage();
    m.getDraft.mockResolvedValue({ ...draft, version: 5 });
    expect((await submit(String(form.props.bindingMarker))).state?.stale).toBe(true);
    expect(m.saveInput).not.toHaveBeenCalled();
  });
  it("feil offentlig identitet (markør fra en annen annonse/side brukt mot denne) ⇒ avvist uten skriving", async () => {
    const { form } = await renderPage();
    const other = publicIdFor("synthetic-demo", "annen-annonse", "synthetic");
    const r = await submit(String(form.props.bindingMarker), { listingId: other });
    expect(r.state?.message).toMatch(/Fant ikke|endret/);
    expect(m.saveInput).not.toHaveBeenCalled();
  });
  it("manipulert markør (ett tegn endret, avkortet, base64-av-id, rå id) ⇒ avvist uten skriving", async () => {
    const { form } = await renderPage();
    const mk = String(form.props.bindingMarker);
    for (const bad of [mk.replace(/.$/, (c) => (c === "A" ? "B" : "A")), mk.slice(0, -1), `b1_${Buffer.from(`14:synthetic-demo/${RAW}`).toString("base64url").slice(0, 32)}`, `14:synthetic-demo/${RAW}`]) {
      const r = await submit(bad);
      expect(r.state?.stale, bad).toBe(true);
    }
    expect(m.saveInput).not.toHaveBeenCalled();
  });
  it("firmabinding og uttrykkelig bekreftelse er uendret: uten avkrysning lagres ingenting, og forfalsket firma/kandidatfelt har ingen virkning", async () => {
    const { form } = await renderPage();
    const mk = String(form.props.bindingMarker);
    const noConfirm = await submit(mk, { confirm: "" });
    expect(noConfirm.state?.errors).toEqual({ confirm: "required" });
    expect(m.saveInput).not.toHaveBeenCalled();
    const forged = await submit(mk, { dealershipId: "11111111-1111-4111-8111-111111111111", candidateId: "14:synthetic-demo/annen", candidateVersion: "x" });
    expect(forged.to).toBeTruthy();
    const [key, payload] = m.saveInput.mock.calls[0]!;
    expect(key.candidateId).toContain(RAW);
    expect(JSON.stringify(payload)).not.toMatch(/1111|annen/);
  });
});

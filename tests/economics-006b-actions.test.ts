/**
 * ECON-006b — server actions (tynne innpakninger rundt flyten): firma fra sesjonen, søk/annonse utledet av serveren, ingen skriving ved feil, omdirigering bare etter vellykket
 * bekreftelse. Avhengigheter (sesjon, utkast, kilde, lagring) er mockede; dette er IKKE en integrasjonstest mot Supabase/PostgREST eller nettleser (006c / eget kontrollpunkt).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { REGISTERED_PROFILES, rightsForSource } from "@/domain/provider-rights";
import { dealerInputToFormValues } from "@/domain/search-economics";
import { FIRM_A, NOW, SEARCH_1, candidateFor, dealerInput, listing, specOf } from "./fixtures/economics-005c";

const m = vi.hoisted(() => ({
  session: vi.fn(), getDraft: vi.fn(), resolve: vi.fn(), createStore: vi.fn(), saveInput: vi.fn(), saveProfile: vi.fn(), revalidate: vi.fn(),
}));
vi.mock("@/server/session", () => ({ getSessionContext: m.session }));
vi.mock("@/server/search-drafts", () => ({ getDraft: m.getDraft }));
vi.mock("@/server/search-display", () => ({ resolveDealerTarget: m.resolve }));
vi.mock("@/server/dealer-economics-store", () => ({ createDealerEconomicsStore: m.createStore }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidate }));
vi.mock("next/navigation", () => ({ redirect: (to: string) => { throw Object.assign(new Error("NEXT_REDIRECT"), { to }); } }));

import { confirmDealerInputAction } from "@/app/searches/[id]/preview/[listingId]/dealer-input/actions";
import { EMPTY_DEALER_FORM_STATE } from "@/app/searches/[id]/preview/[listingId]/dealer-input/state";
import { saveDealerProfileAction } from "@/app/searches/economics-profile/actions";
import { EMPTY_PROFILE_FORM_STATE } from "@/app/searches/economics-profile/state";

const member = { status: "member", dealership: { id: FIRM_A, name: "Firma A" }, user: { id: "u1" } };
const l0 = listing(), cand = candidateFor(l0), spec = specOf();
const rights = rightsForSource("synthetic-demo", NOW, REGISTERED_PROFILES);
const PUBLIC = "m1_abcdefghijklmnopqrstuvwx";
const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };
const form = (over: Record<string, string> = {}) => ({ searchId: SEARCH_1, listingId: PUBLIC, draftVersion: "4", candidateId: cand.id, candidateVersion: cand.version, ...dealerInputToFormValues(dealerInput()), confirm: "yes", ...over });
const run = async (f: FormData) => { try { return { state: await confirmDealerInputAction(EMPTY_DEALER_FORM_STATE, f), redirectedTo: null as string | null }; } catch (e) { const to = (e as { to?: string }).to; if (!to) throw e; return { state: null, redirectedTo: to }; } };

beforeEach(() => {
  vi.clearAllMocks();
  m.session.mockResolvedValue(member);
  m.getDraft.mockResolvedValue({ id: SEARCH_1, name: "S", version: 4, readable: true, spec });
  m.resolve.mockResolvedValue({ kind: "ok", item: { economics: { status: "not_calculated" } }, candidate: { id: cand.id, version: cand.version }, rights });
  m.saveInput.mockResolvedValue({ ok: true });
  m.saveProfile.mockResolvedValue({ ok: true });
  m.createStore.mockReturnValue({ saveInput: m.saveInput, saveProfile: m.saveProfile, getInput: vi.fn(), listInputs: vi.fn(), getProfile: vi.fn() });
});

describe("confirmDealerInputAction", () => {
  it("vellykket: lagringen opprettes for sesjonens firma; omdirigerer til detaljsiden med melding; revaliderer", async () => {
    const r = await run(fd(form({ dealershipId: "forfalsket", firmId: "forfalsket" })));
    expect(r.redirectedTo).toBe(`/searches/${SEARCH_1}/preview/${PUBLIC}?v=4&msg=econ_saved`);
    expect(m.createStore).toHaveBeenCalledWith(member);
    expect(m.getDraft).toHaveBeenCalledWith(member, SEARCH_1);
    expect(m.saveInput).toHaveBeenCalledTimes(1);
    const [key, payload] = m.saveInput.mock.calls[0]!;
    expect(key).toEqual({ searchId: SEARCH_1, candidateId: cand.id, candidateVersion: cand.version, inputSchemaVersion: 1 });
    expect(JSON.stringify(payload)).not.toContain("forfalsket");
    expect(m.revalidate).toHaveBeenCalled();
  });
  it("ikke innlogget/uten firma ⇒ melding, ingen oppslag eller skriving", async () => {
    m.session.mockResolvedValue({ status: "anonymous" });
    const r = await run(fd(form()));
    expect(r.state?.message).toMatch(/innlogget/);
    expect(m.getDraft).not.toHaveBeenCalled();
    expect(m.saveInput).not.toHaveBeenCalled();
  });
  it.each<[string, Record<string, string>]>([["ugyldig annonse-id", { listingId: "../etc" }], ["manglende søk", { searchId: "" }]])("%s ⇒ ikke funnet, ingen skriving", async (_n, over) => {
    if (over.searchId === "") m.getDraft.mockResolvedValue(null);
    const r = await run(fd(form(over)));
    expect(r.redirectedTo).toBeNull();
    expect(r.state?.message).toMatch(/Fant ikke/);
    expect(m.saveInput).not.toHaveBeenCalled();
  });
  it("annonsen finnes ikke / blokkert / ikke vurderbar ⇒ ikke funnet, ingen skriving", async () => {
    for (const kind of ["not_found", "blocked", "source_error", "not_assessable"]) {
      m.resolve.mockResolvedValue({ kind, reason: "rights_unknown" });
      const r = await run(fd(form()));
      expect(r.state?.message, kind).toMatch(/Fant ikke/);
    }
    expect(m.saveInput).not.toHaveBeenCalled();
  });
  it("utdatert søkeversjon eller revisjon ⇒ stale med lenke-flagg; brukerens verdier beholdes UTEN bekreftelse; ingen skriving", async () => {
    const r = await run(fd(form({ draftVersion: "3", tb_amount: "7777" })));
    expect(r.state).toMatchObject({ stale: true });
    expect(r.state?.message).toMatch(/endret/);
    expect(r.state?.values?.tb_amount).toBe("7777");
    expect(r.state?.values?.confirm).toBeUndefined();
    expect(m.saveInput).not.toHaveBeenCalled();
  });
  it("manglende bekreftelse ⇒ feltfeil på bekreftelsen, verdiene beholdes, ingen skriving", async () => {
    const f = form(); delete (f as Record<string, string>).confirm;
    const r = await run(fd(f));
    expect(r.state?.errors).toEqual({ confirm: "required" });
    expect(r.state?.values?.tb_amount).toBe("8000");
    expect(m.saveInput).not.toHaveBeenCalled();
  });
  it("økonomi utilgjengelig (rettigheter) ⇒ avslag uten skriving", async () => {
    m.resolve.mockResolvedValue({ kind: "ok", item: { economics: { status: "unavailable" } }, candidate: { id: cand.id, version: cand.version }, rights });
    const r = await run(fd(form()));
    expect(r.state?.message).toMatch(/kan ikke vises/);
    expect(m.saveInput).not.toHaveBeenCalled();
  });
  it("lagringsfeil og unntak ⇒ melding uten omdirigering; ingen detaljer eller verdier lekker", async () => {
    m.saveInput.mockResolvedValue({ ok: false, code: "unavailable" });
    expect((await run(fd(form()))).redirectedTo).toBeNull();
    m.saveInput.mockRejectedValue(new Error("postgres://hemmelig"));
    const r = await run(fd(form()));
    expect(r.state?.message).toMatch(/Lagringen feilet/);
    expect(JSON.stringify(r.state)).not.toContain("hemmelig");
    m.getDraft.mockRejectedValue(new Error("hemmelig"));
    expect(JSON.stringify((await run(fd(form()))).state)).not.toContain("hemmelig");
  });
});

describe("saveDealerProfileAction", () => {
  const go = (o: Record<string, string>) => saveDealerProfileAction(EMPTY_PROFILE_FORM_STATE, fd(o));
  it("lagrer for sesjonens firma og ignorerer oppgitt firma", async () => {
    const s = await go({ p_deduction: "recoverable", dealershipId: "forfalsket" });
    expect(s).toMatchObject({ saved: true });
    expect(m.createStore).toHaveBeenCalledWith(member);
    expect(m.saveProfile).toHaveBeenCalledWith({ schemaVersion: 1, deduction: "recoverable" });
  });
  it("ugyldig verdi ⇒ feltfeil og ingen skriving; ikke innlogget ⇒ melding", async () => {
    expect(await go({ p_vatHandling: "annet" })).toMatchObject({ saved: false, errors: { p_vatHandling: "invalid_value" } });
    expect(m.saveProfile).not.toHaveBeenCalled();
    m.session.mockResolvedValue({ status: "anonymous" });
    expect((await go({})).message).toMatch(/innlogget/);
    expect(m.saveProfile).not.toHaveBeenCalled();
  });
  it("lagringsunntak ⇒ melding uten lekkasje", async () => {
    m.saveProfile.mockRejectedValue(new Error("hemmelig"));
    const s = await go({});
    expect(s.saved).toBe(false);
    expect(JSON.stringify(s)).not.toContain("hemmelig");
  });
});

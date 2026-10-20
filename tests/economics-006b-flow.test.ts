/**
 * ECON-006b — innsending, forhåndsutfylling og firmaprofil (server-flyt uten I/O; lagring = minnelager som etterligner kontrakten til `DealerEconomicsStore`). Dette er IKKE bekreftet
 * Supabase/PostgREST-integrasjon (B6): den separate kontrollen mot ekte lagring står åpen. Kjernen kjøres ekte; økonomiflaggene er false.
 */
import { describe, expect, it } from "vitest";
import { REGISTERED_PROFILES, rightsForSource } from "@/domain/provider-rights";
import { dealerInputToFormValues, type FormValues } from "@/domain/search-economics";
import type { MarketplaceProvider } from "@/providers/marketplace";
import type { NormalizedListing } from "@/domain/types";
import { loadDealerProfile, loadStoredInputsForSearch, storedKey, type DealerEconomicsStore, type DealerInputKey, type DealerInputRow, type SaveError } from "@/server/dealer-economics";
import { formValuesOf, selectPrefill, submitDealerInputForm, submitDealerProfileForm, profileToFormValues } from "@/server/dealer-input-flow";
import { previewForDisplay, type EconomicsContext } from "@/server/search-display";
import { confirmationContextFor } from "@/server/search-economics";
import { FIRM_A, NOW, SEARCH_1, candidateFor, dealerInput, line, listing, specOf } from "./fixtures/economics-005c";

const rights = rightsForSource("synthetic-demo", NOW, REGISTERED_PROFILES);

/** Minnelager med samme kontrakt som den ekte lagringen: firma settes av «databasen» (her: fast), nøkkelen erstatter ved ny bekreftelse. */
function memoryStore(o: { failSave?: SaveError; confirmedAt?: () => string } = {}) {
  const rows = new Map<string, DealerInputRow>();
  let profile: unknown = null;
  const calls: Array<{ key: DealerInputKey; payload: unknown; context: unknown }> = [];
  const k = (x: DealerInputKey) => `${x.searchId}|${x.candidateId}|${x.candidateVersion}|${x.inputSchemaVersion}`;
  const store: DealerEconomicsStore = {
    async getInput(key) { return rows.get(k(key)) ?? null; },
    async listInputs(searchId) { return [...rows.values()].filter((r) => r.searchId === searchId); },
    async saveInput(key, payload, context) {
      calls.push({ key, payload, context });
      if (o.failSave) return { ok: false, code: o.failSave };
      rows.set(k(key), { dealershipId: FIRM_A, searchId: key.searchId, candidateId: key.candidateId, candidateVersion: key.candidateVersion, inputSchemaVersion: key.inputSchemaVersion, payload, context, confirmedBy: "user-1", confirmedAt: o.confirmedAt?.() ?? "2026-10-20T09:30:00Z" });
      return { ok: true };
    },
    async getProfile() { return profile === null ? null : { dealershipId: FIRM_A, payload: profile }; },
    async saveProfile(p) { profile = p; return { ok: true }; },
  };
  return { store, rows, calls, profileOf: () => profile };
}
const providerOf = (ls: NormalizedListing[]): MarketplaceProvider => ({
  source: "synthetic-demo",
  search: async () => ({ items: ls, nextPage: null, sourceTotal: ls.length, truncated: false, fetchedAt: NOW.toISOString(), rejected: [] }),
  getListing: async (id) => ls.find((l) => l.sourceListingId === id) ?? null,
});

const l0 = listing();
const cand = candidateFor(l0);
const spec = specOf([line("freight", "transport", 1_200_000n), line("ins", "insurance", 300_000n)]);
const target = { candidate: { id: cand.id, version: cand.version }, rights, economicsStatus: "not_calculated" };
const hidden = (over: FormValues = {}): FormValues => ({ searchId: SEARCH_1, listingId: "x", draftVersion: "3", candidateId: cand.id, candidateVersion: cand.version, ...over });
const goodForm = (over: FormValues = {}): FormValues => ({ ...hidden(), ...dealerInputToFormValues(dealerInput()), confirm: "yes", ...over });
const submit = (m: ReturnType<typeof memoryStore>, form: FormValues, over: Partial<Parameters<typeof submitDealerInputForm>[0]> = {}) =>
  submitDealerInputForm({ store: m.store, searchId: SEARCH_1, spec, draftVersion: 3, target, form, ...over });

describe("bekreftelse: uttrykkelig, bundet og uten skriving ved feil", () => {
  it("vellykket: lagrer kun forhandlerinput + serverberegnet kontekst under serverutledet nøkkel; ingen avledede tall", async () => {
    const m = memoryStore();
    expect(await submit(m, goodForm())).toEqual({ ok: true });
    expect(m.calls).toHaveLength(1);
    const c = m.calls[0]!;
    expect(c.key).toEqual({ searchId: SEARCH_1, candidateId: cand.id, candidateVersion: cand.version, inputSchemaVersion: 1 });
    expect(c.context).toEqual(confirmationContextFor(spec, rights));
    expect(c.payload).toMatchObject({ schemaVersion: 1, deduction: "non_recoverable" });
    expect(JSON.stringify(c.payload)).not.toMatch(/landed|cash|estimat|valueNok|importVat|confirm|searchId|candidate/i);
  });
  it("uten uttrykkelig bekreftelse lagres ingenting (også når alt annet er gyldig)", async () => {
    for (const confirm of [undefined, "", "no", "on", "true"]) {
      const m = memoryStore();
      const f = goodForm(); if (confirm === undefined) delete f.confirm; else f.confirm = confirm;
      expect(await submit(m, f), String(confirm)).toMatchObject({ ok: false, code: "field_errors", errors: { confirm: "required" } });
      expect(m.calls).toHaveLength(0);
    }
  });
  it("firma/søk/kandidat fra skjemaet har ingen virkning: serverutledet nøkkel brukes, forfalsket firma ignoreres", async () => {
    const m = memoryStore();
    expect(await submit(m, goodForm({ dealershipId: "11111111-1111-4111-8111-111111111111", dealership_id: "x", firmId: "y" }))).toEqual({ ok: true });
    expect(m.calls[0]!.key.searchId).toBe(SEARCH_1);
    expect(JSON.stringify(m.calls[0]!.payload)).not.toContain("1111");
    expect([...m.rows.values()].every((r) => r.dealershipId === FIRM_A)).toBe(true);
  });
  it.each([["draftVersion", "2"], ["draftVersion", ""], ["candidateVersion", "annen"], ["candidateId", "annen-kandidat"]])("utdatert side (%s=%s) ⇒ stale_page, ingenting lagres", async (k, v) => {
    const m = memoryStore();
    expect(await submit(m, goodForm({ [k]: v }))).toEqual({ ok: false, code: "stale_page" });
    expect(m.calls).toHaveLength(0);
  });
  it("manglende visnings-/beregningsrett (unavailable) ⇒ ingen registrering", async () => {
    const m = memoryStore();
    expect(await submit(m, goodForm(), { target: { ...target, economicsStatus: "unavailable" } })).toEqual({ ok: false, code: "rights_unavailable" });
    expect(m.calls).toHaveLength(0);
  });
  it("ugyldig input gir feltfeil og ingen skriving; verdier følger ikke med i feilen", async () => {
    const m = memoryStore();
    const r = await submit(m, goodForm({ tb_amount: "8000.123", tw_kg: "abc", prop_basis: "listing_claim" }));
    expect(r).toMatchObject({ ok: false, code: "field_errors", errors: { tb_amount: "invalid_amount", tw_kg: "invalid_integer", prop_basis: "invalid_value" } });
    expect(JSON.stringify(r)).not.toMatch(/8000\.123|listing_claim/);
    expect(m.calls).toHaveLength(0);
  });
  it("fordeling mot AKTUELL linje: feil sum avvises i skjema; reservekontroll mot spesifikasjonen fanger endret linje", async () => {
    const m = memoryStore();
    expect(await submit(m, goodForm({ scope_freight: "split", scopeTo_freight: "10 000", scopeAfter_freight: "1 000" }))).toMatchObject({ ok: false, errors: { scopeTo_freight: "split_mismatch" } });
    expect(await submit(m, goodForm({ scope_freight: "split", scopeTo_freight: "10 000", scopeAfter_freight: "2 000" }))).toEqual({ ok: true });
    const stored = m.calls[0]!.payload as { lineScopes: unknown };
    expect(stored.lineScopes).toEqual({ freight: { split: { toBorderMinor: "1000000", afterBorderMinor: "200000" } } });
    // linjen i søket er endret (annet beløp) etter at skjemaet ble åpnet: samme verdier avvises, ingenting lagres
    const m2 = memoryStore();
    const changed = specOf([line("freight", "transport", 1_300_000n), line("ins", "insurance", 300_000n)]);
    expect(await submit(m2, goodForm({ scope_freight: "split", scopeTo_freight: "10 000", scopeAfter_freight: "2 000" }), { spec: changed })).toMatchObject({ ok: false, errors: { scopeTo_freight: "split_mismatch" } });
    expect(m2.calls).toHaveLength(0);
  });
  it("lagringsfeil gir ingen delvis tilstand og mappes til kode", async () => {
    for (const code of ["search_not_found", "rejected", "unavailable"] as const) {
      const m = memoryStore({ failSave: code });
      expect(await submit(m, goodForm())).toEqual({ ok: false, code });
      expect(m.rows.size).toBe(0);
    }
  });
  it("ny bekreftelse erstatter (idempotent nøkkel): to innsendinger gir én rad med siste innhold", async () => {
    const m = memoryStore();
    await submit(m, goodForm());
    await submit(m, goodForm({ tb_amount: "9000" }));
    expect(m.rows.size).toBe(1);
    expect((m.calls[1]!.payload as { transportToBorder: unknown }).transportToBorder).toEqual({ amount: "9000" });
  });
  it("formValuesOf tar bare strenger og dropper handlingsfelt", () => {
    const fd = new FormData();
    fd.set("a", "1"); fd.set("$ACTION_ID_x", "y"); fd.set("f", new Blob(["x"]), "f.txt");
    expect(formValuesOf(fd)).toEqual({ a: "1" });
  });
});

describe("gjennom visningsgrensen: bekreftelse endrer vurderingen, foreldelse krever ny bekreftelse", () => {
  const view = async (m: ReturnType<typeof memoryStore>, o: { l?: NormalizedListing; s?: typeof spec; now?: Date } = {}) => {
    const l = o.l ?? l0, s = o.s ?? spec;
    const storedInputs = await loadStoredInputsForSearch(m.store, { dealershipId: FIRM_A, searchId: SEARCH_1 });
    const profile = await loadDealerProfile(m.store, FIRM_A);
    const economics: EconomicsContext = { dealershipId: FIRM_A, searchId: SEARCH_1, storedInputs, profile };
    const out = await previewForDisplay(s, { provider: providerOf([l]), now: () => o.now ?? NOW, economics });
    if (!out.ok) throw new Error("kilden feilet");
    return { e: out.items[0]!.economics, storedInputs, cand: candidateFor(l) };
  };
  it("før: ingen bekreftet input ⇒ ikke estimat; etter bekreftelse ⇒ «estimat — ikke validert»; aldri positivt budsjettutfall", async () => {
    const m = memoryStore();
    const before = (await view(m)).e;
    expect(before.status).not.toBe("estimate");
    expect(before.status === "unavailable" ? null : before.dealerInput.state).toBe("none");
    await submit(m, goodForm());
    const after = (await view(m)).e;
    expect(after.status).toBe("estimate");
    expect(after.positiveBudgetEligible).toBe(false);
    if (after.status === "estimate") expect(after.dealerInput.state).toBe("in_use");
  });
  it("manglende verdier blir ikke 0 eller dokumentert: uten transport er totalen ikke et punktestimat, og transport vises som ukjent", async () => {
    const m = memoryStore();
    const f = goodForm(); delete f.tb_amount;
    expect(await submit(m, f)).toEqual({ ok: true });
    const e = (await view(m)).e;
    expect(e.status === "unavailable" ? "" : e.status).not.toBe("estimate");
    if (e.status !== "unavailable" && e.explanation) {
      expect(e.explanation.breakdown.find((r) => r.id === "transport_to_border")).toMatchObject({ state: "unknown", amountNok: null });
      expect(e.explanation.coverage.documented).toBe(0);
    }
  });
  it("annonsen endres (ny revisjon): gammel bekreftelse brukes ikke; forhåndsutfylling kommer fra den tidligere og bekrefter ingenting", async () => {
    const m = memoryStore();
    await submit(m, goodForm());
    const changed = listing({ price: { ...l0.price!, stated: { amount: "110000", currency: "NOK" }, amount: { amountMinor: 11_000_000, currency: "NOK" } } });
    const { e, storedInputs, cand: c2 } = await view(m, { l: changed });
    expect(c2.id).toBe(cand.id);
    expect(c2.version).not.toBe(cand.version);
    expect(e.status).not.toBe("estimate");
    const pre = selectPrefill(storedInputs, c2);
    expect(pre.source).toBe("previous_revision");
    expect(pre.values.tb_amount).toBe("8000");
    expect(pre.values.confirm).toBeUndefined();
    // ny aktiv bekreftelse for den nye revisjonen er nødvendig for å få estimat igjen
    const again = await submitDealerInputForm({ store: m.store, searchId: SEARCH_1, spec, draftVersion: 3, target: { candidate: { id: c2.id, version: c2.version }, rights, economicsStatus: "not_calculated" }, form: { ...goodForm(), candidateVersion: c2.version } });
    expect(again).toEqual({ ok: true });
    expect(m.rows.size).toBe(2);
    expect((await view(m, { l: changed })).e.status).toBe("estimate");
  });
  it("søkets kostnadsgrunnlag endres: bekreftelsen er foreldet (må bekreftes på nytt) og tallene fra den brukes ikke", async () => {
    const m = memoryStore();
    await submit(m, goodForm());
    const other = specOf([line("freight", "transport", 1_500_000n), line("ins", "insurance", 300_000n)]);
    const { e } = await view(m, { s: other });
    expect(e.status).not.toBe("estimate");
    const di = e.status === "unavailable" ? null : e.dealerInput;
    expect(di).toMatchObject({ state: "needs_reconfirmation" });
    if (di?.state === "needs_reconfirmation") expect(di.reasons).toContain("cost_basis_changed");
  });
  it("oppgitt kurs utløper: må bekreftes på nytt (fx_expired)", async () => {
    const m = memoryStore();
    const input = dealerInput({ fx: { acquisition: { pair: "EUR/NOK", rate: "10.6709", sourceLabel: "Bank X", quotedAt: "2026-10-19", validUntil: "2026-10-20" } } });
    await submit(m, goodForm({ ...dealerInputToFormValues(input) }));
    expect(m.rows.size).toBe(1);
    expect((await view(m)).e.status === "unavailable" ? "" : (await view(m)).e.status).toBe("estimate"); // gyldig til og med 20.10.
    const later = new Date("2026-10-21T00:30:00Z");
    const { e } = await view(m, { now: later });
    const di = e.status === "unavailable" ? null : e.dealerInput;
    expect(di).toMatchObject({ state: "needs_reconfirmation" });
    if (di?.state === "needs_reconfirmation") expect(di.reasons).toContain("fx_expired");
  });
});

describe("forhåndsutfylling", () => {
  const rowAt = async (m: ReturnType<typeof memoryStore>) => loadStoredInputsForSearch(m.store, { dealershipId: FIRM_A, searchId: SEARCH_1 });
  it("ingen tidligere bekreftelse ⇒ tomt (annonsens påstander fylles aldri ut)", async () => {
    const m = memoryStore();
    expect(selectPrefill(await rowAt(m), target.candidate)).toEqual({ values: {}, source: "none" });
  });
  it("gjeldende revisjon går foran; ellers nyeste fra tidligere revisjon; andre kandidater ignoreres", async () => {
    let t = 0;
    const m = memoryStore({ confirmedAt: () => `2026-10-20T09:${String(10 + ++t).padStart(2, "0")}:00Z` });
    await submit(m, goodForm({ tb_amount: "1" }), { target: { ...target, candidate: { id: cand.id, version: "gammel-a" } }, form: goodForm({ tb_amount: "1", candidateVersion: "gammel-a" }) });
    await submit(m, goodForm({ tb_amount: "2" }), { target: { ...target, candidate: { id: cand.id, version: "gammel-b" } }, form: goodForm({ tb_amount: "2", candidateVersion: "gammel-b" }) });
    await submit(m, goodForm({ tb_amount: "9" }), { target: { ...target, candidate: { id: "annen-id", version: "x" } }, form: goodForm({ tb_amount: "9", candidateId: "annen-id", candidateVersion: "x" }) });
    const st = await rowAt(m);
    expect(selectPrefill(st, target.candidate)).toMatchObject({ source: "previous_revision", values: { tb_amount: "2" } });
    await submit(m, goodForm({ tb_amount: "5" }));
    expect(selectPrefill(await rowAt(m), target.candidate)).toMatchObject({ source: "current", values: { tb_amount: "5" } });
    expect(storedKey(cand.id, cand.version)).toBeTruthy();
  });
});

describe("firmaprofil", () => {
  it("tomt skjema lagrer ingen standard; verdier lagres; ugyldig avvises uten skriving", async () => {
    const m = memoryStore();
    expect(await submitDealerProfileForm(m.store, {})).toEqual({ ok: true });
    expect(m.profileOf()).toEqual({ schemaVersion: 1 });
    expect(await submitDealerProfileForm(m.store, { p_vatHandling: "registered_reports_in_vat_return", p_deduction: "non_recoverable", dealershipId: "x" })).toEqual({ ok: true });
    expect(m.profileOf()).toEqual({ schemaVersion: 1, vatHandling: "registered_reports_in_vat_return", deduction: "non_recoverable" });
    const before = m.profileOf();
    expect(await submitDealerProfileForm(m.store, { p_deduction: "ja" })).toMatchObject({ ok: false, code: "field_errors", errors: { p_deduction: "invalid_value" } });
    expect(m.profileOf()).toBe(before);
  });
  it("profil → skjemaverdier (tomt = ikke satt)", () => {
    expect(profileToFormValues(null)).toEqual({ p_vatHandling: "", p_deduction: "" });
    expect(profileToFormValues({ schemaVersion: 1, deduction: "recoverable" })).toEqual({ p_vatHandling: "", p_deduction: "recoverable" });
  });
  it("profilen overstyrer aldri en bekreftet verdi for annonsen, og gjelder bare der annonsen ikke har egen verdi", async () => {
    const m = memoryStore();
    await submitDealerProfileForm(m.store, { p_deduction: "recoverable", p_vatHandling: "registered_reports_in_vat_return" });
    const f = goodForm(); delete f.deduction; delete f.vatHandling;
    await submit(m, f); // annonsen har ingen egen verdi ⇒ profilen gjelder
    const value = async (mm: typeof m) => {
      const storedInputs = await loadStoredInputsForSearch(mm.store, { dealershipId: FIRM_A, searchId: SEARCH_1 });
      const profile = await loadDealerProfile(mm.store, FIRM_A);
      const out = await previewForDisplay(spec, { provider: providerOf([l0]), now: () => NOW, economics: { dealershipId: FIRM_A, searchId: SEARCH_1, storedInputs, profile } });
      if (!out.ok) throw new Error("x");
      const e = out.items[0]!.economics;
      return e.status === "unavailable" || !e.explanation ? null : e.explanation.assumptions.vatRecoverability;
    };
    expect(await value(m)).toMatchObject({ value: "recoverable" });
    await submit(m, goodForm({ deduction: "non_recoverable" })); // egen bekreftet verdi vinner
    expect(await value(m)).toMatchObject({ value: "non_recoverable" });
    await submit(m, goodForm({ deduction: "unknown" })); // uttrykkelig «ukjent» overstyrer profilen
    expect(await value(m)).toMatchObject({ value: "unknown" });
  });
});

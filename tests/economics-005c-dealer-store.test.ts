/**
 * ECON-005c — serverlogikk for forhandlerinput mot et lagringsgrensesnitt (i minnet): servervalidering før lagring og ved lesing, konteksten beregnes av serveren,
 * firmabinding ved lesing, korrupt lagring = ingen tillit, og hele flyten bekreft → les → vurder (foreldelse ved endringer). Databasens RLS testes i tests/db/econ005c-dealer-inputs.test.ts.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { REGISTERED_PROFILES, rightsForSource } from "@/domain/provider-rights";
import type { ConfirmationContext, DealerInputV1 } from "@/domain/search-economics";
import { assessEconomics } from "@/server/search-economics";
import { confirmDealerInput, loadDealerProfile, loadStoredInput, saveDealerProfile, type DealerEconomicsStore, type DealerInputKey, type DealerInputRow } from "@/server/dealer-economics";
import { FIRM_A, FIRM_B, NOW, SEARCH_1, SEARCH_2, candidate, candidateFor, dealerInput, line, listing, specOf } from "./fixtures/economics-005c";

const demo = rightsForSource("synthetic-demo", NOW, REGISTERED_PROFILES);

/** Lagring i minnet som etterligner databasens regler: firma settes av «sesjonen», nøkkelen er unik, søk må tilhøre firmaet. */
class MemStore implements DealerEconomicsStore {
  rows: DealerInputRow[] = [];
  profile: { dealershipId: string; payload: unknown } | null = null;
  writes = 0;
  constructor(public firm: string, private searches: Record<string, string> = { [SEARCH_1]: FIRM_A, [SEARCH_2]: FIRM_B }) {}
  private match = (r: DealerInputRow, k: DealerInputKey) => r.dealershipId === this.firm && r.searchId === k.searchId && r.candidateId === k.candidateId && r.candidateVersion === k.candidateVersion && r.inputSchemaVersion === k.inputSchemaVersion;
  async getInput(k: DealerInputKey) { return this.rows.find((r) => this.match(r, k)) ?? null; }
  async listInputs(searchId: string) { return this.rows.filter((r) => r.dealershipId === this.firm && r.searchId === searchId); }
  async saveInput(k: DealerInputKey, payload: DealerInputV1, context: ConfirmationContext) {
    if (this.searches[k.searchId] !== this.firm) return { ok: false as const, code: "search_not_found" as const };
    this.writes++;
    const row: DealerInputRow = { dealershipId: this.firm, ...k, payload, context, confirmedBy: "user-1", confirmedAt: NOW.toISOString() };
    const i = this.rows.findIndex((r) => this.match(r, k));
    if (i >= 0) this.rows[i] = row; else this.rows.push(row);
    return { ok: true as const };
  }
  async getProfile() { return this.profile; }
  async saveProfile(payload: unknown) { this.writes++; this.profile = { dealershipId: this.firm, payload }; return { ok: true as const }; }
}
const spec = specOf([line("transport", "transport", 800_000n)]);
const confirm = (store: DealerEconomicsStore, raw: unknown, over: Partial<Parameters<typeof confirmDealerInput>[1]> = {}) =>
  confirmDealerInput(store, { searchId: SEARCH_1, candidate: candidate(), spec, rights: demo, raw, ...over });
const assess = async (store: MemStore, over: { spec?: typeof spec; listing?: ReturnType<typeof listing>; firm?: string } = {}) => {
  const l = over.listing ?? listing(), cand = candidateFor(l), sp = over.spec ?? spec, firm = over.firm ?? store.firm;
  const st = await loadStoredInput(store, { dealershipId: firm, searchId: SEARCH_1, candidate: cand });
  const profile = await loadDealerProfile(store, firm);
  return assessEconomics({ dealershipId: firm, searchId: SEARCH_1, candidate: cand, spec: sp, stored: st, profile, now: NOW, listing: l });
};

describe("bekreftelse: servervalidering før lagring", () => {
  it("gyldig input lagres med serverberegnet kontekst (kostnadsgrunnlag, scenario, rettighetsavtrykk) — klienten kan ikke oppgi konteksten", async () => {
    const s = new MemStore(FIRM_A);
    expect(await confirm(s, dealerInput({ lineScopes: { transport: "to_border" } }))).toEqual({ ok: true });
    expect(s.rows).toHaveLength(1);
    expect(s.rows[0]!.context).toMatchObject({ registrationScenario: "passenger" });
    expect((s.rows[0]!.context as ConfirmationContext).costBasis).toContain("transport");
    const withCtx = await confirm(s, { ...dealerInput(), context: { costBasis: "x" } });
    expect(withCtx).toMatchObject({ ok: false, code: "invalid_input" });
  });
  it.each([
    ["klientens firma-id", { ...dealerInput(), dealershipId: FIRM_B }],
    ["annonsepåstand som grunnlag", { ...dealerInput(), propulsion: { ...dealerInput().propulsion!, basis: "listing_claim" } }],
    ["flyttall som beløp", { ...dealerInput(), transportToBorder: { amount: 8000 } }],
    ["feil schemaversjon", { ...dealerInput(), schemaVersion: 2 }],
    ["ikke-objekt", "tekst"],
    ["omfang for ukjent kostnadslinje", dealerInput({ lineScopes: { ghost: "to_border" } })],
  ])("avvises uten skriving: %s", async (_n, raw) => {
    const s = new MemStore(FIRM_A);
    const r = await confirm(s, raw);
    expect(r).toMatchObject({ ok: false, code: "invalid_input" });
    expect(s.writes).toBe(0);
  });
  it("ugyldig søk-id avvises før noe annet; søk i annet firma gir search_not_found fra lagringen", async () => {
    const s = new MemStore(FIRM_A);
    expect(await confirm(s, dealerInput(), { searchId: "ikke-uuid" })).toMatchObject({ ok: false, code: "invalid_search" });
    expect(await confirm(s, dealerInput(), { searchId: SEARCH_2 })).toEqual({ ok: false, code: "search_not_found" });
    expect(s.writes).toBe(0);
  });
  it("ny bekreftelse for samme nøkkel erstatter innholdet (én rad)", async () => {
    const s = new MemStore(FIRM_A);
    await confirm(s, dealerInput({ deduction: "non_recoverable" }));
    await confirm(s, dealerInput({ deduction: "unknown" }));
    expect(s.rows).toHaveLength(1);
    expect((s.rows[0]!.payload as DealerInputV1).deduction).toBe("unknown");
  });
});

describe("lesing: ingen delvis tillit", () => {
  const good = async () => { const s = new MemStore(FIRM_A); await confirm(s, dealerInput()); return s; };
  const read = (s: MemStore, firm = FIRM_A) => loadStoredInput(s, { dealershipId: firm, searchId: SEARCH_1, candidate: candidate() });
  it("gyldig rad leses med binding fra raden (firma, søk, kandidat, revisjon, schema 1)", async () => {
    const r = await read(await good());
    expect(r!.binding).toEqual({ dealershipId: FIRM_A, searchId: SEARCH_1, candidateId: candidate().id, candidateVersion: candidate().version, inputSchemaVersion: 1 });
    expect(r!.input).toEqual(dealerInput());
  });
  it("rad som tilhører et annet firma enn sesjonens leses ikke (forsvar i dybden mot en lekkasje i lagringen)", async () => {
    const s = await good();
    expect(await read(s, FIRM_B)).toBeNull();
    s.rows[0] = { ...s.rows[0]!, dealershipId: FIRM_B };
    expect(await read(s, FIRM_A)).toBeNull();
  });
  it.each([
    ["korrupt payload", { payload: { schemaVersion: 1, propulsion: "diesel" } }], ["ukjent nøkkel i payload", { payload: { schemaVersion: 1, dealershipId: FIRM_B } }],
    ["utdatert schema", { payload: { schemaVersion: 2 } }], ["ugyldig kontekst", { context: { costBasis: "[]" } }], ["kontekst med feil avtrykk", { context: { costBasis: "[]", registrationScenario: "passenger", rightsDigest: "x" } }],
    ["ukjent bekrefter", { confirmedBy: null }], ["annet søk i raden", { searchId: SEARCH_2 }],
  ])("%s ⇒ ingen input (null), ikke delvis tillit", async (_n, over) => {
    const s = await good();
    s.rows[0] = { ...s.rows[0]!, ...over } as DealerInputRow;
    expect(await read(s)).toBeNull();
  });
  it("ugyldig søk-id gir null uten oppslag", async () => {
    const s = await good();
    expect(await loadStoredInput(s, { dealershipId: FIRM_A, searchId: "x", candidate: candidate() })).toBeNull();
  });
});

describe("firmaprofil", () => {
  it("lagres validert og leses tilbake; ugyldig avvises uten skriving; annet firma leses ikke; ukjent standard = null", async () => {
    const s = new MemStore(FIRM_A);
    expect(await loadDealerProfile(s, FIRM_A)).toBeNull();
    expect(await saveDealerProfile(s, { schemaVersion: 1, vatHandling: "registered_reports_in_vat_return" })).toEqual({ ok: true });
    expect(await loadDealerProfile(s, FIRM_A)).toEqual({ schemaVersion: 1, vatHandling: "registered_reports_in_vat_return" });
    expect(await loadDealerProfile(s, FIRM_B)).toBeNull();
    const w = s.writes;
    expect(await saveDealerProfile(s, { schemaVersion: 1, vatHandling: "x", dealershipId: FIRM_B })).toMatchObject({ ok: false, code: "invalid_input" });
    expect(s.writes).toBe(w);
    s.profile = { dealershipId: FIRM_A, payload: { schemaVersion: 1, deduction: 5 } };
    expect(await loadDealerProfile(s, FIRM_A)).toBeNull();
  });
});

describe("hele flyten: bekreft → les → vurder (ingen lagring av resultater)", () => {
  it("bekreftet input gir estimat; ny kandidatrevisjon / endret kostnadsgrunnlag krever ny bekreftelse; andre firma ser ingenting", async () => {
    const s = new MemStore(FIRM_A);
    await confirm(s, dealerInput({ transportToBorder: undefined, insurance: undefined, lineScopes: { transport: "to_border" } }));
    const writesAfterConfirm = s.writes;
    const a = await assess(s);
    expect(a.kind).toBe("assessed");
    if (a.kind !== "assessed") return;
    expect(a.dealerInput.status).toBe("fresh");
    expect(a.display.overall).toBe("incomplete"); // forsikring ukjent (aldri 0) ⇒ nedre grense
    expect(a.detail!.outcome.lines[0]).toMatchObject({ id: "transport", treatment: "mapped_to_input", counted: false });
    expect(a.budget.status).toBe("not_calculated");
    // vurderingen skriver ingenting
    expect(s.writes).toBe(writesAfterConfirm);
    // ny revisjon
    const changed = listing({ price: { ...listing().price!, stated: { amount: "100001", currency: "NOK" }, amount: { amountMinor: 10_000_100, currency: "NOK" } } }); // annonsen er endret ⇒ ny kanonisk revisjon
    expect(candidateFor(changed).id).toBe(candidate().id);
    expect(candidateFor(changed).version).not.toBe(candidate().version);
    const b = await assess(s, { listing: changed });
    expect(b.kind === "assessed" && b.dealerInput.status).toBe("none"); // ingen rad for den nye revisjonen: må bekreftes på nytt
    // endret kostnadsgrunnlag på samme revisjon
    const c = await assess(s, { spec: specOf([line("transport", "transport", 999_000n)]) });
    expect(c.kind === "assessed" && c.dealerInput).toMatchObject({ status: "stale_needs_reconfirmation", reasons: ["cost_basis_changed"] });
    // et annet firma i samme søk-id ser ingenting (lagringen filtrerer på sesjonens firma)
    const other = new MemStore(FIRM_B, { [SEARCH_1]: FIRM_B });
    other.rows = s.rows;
    const d = await assess(other);
    expect(d.kind === "assessed" && d.dealerInput.status).toBe("none");
  });
});

describe("lagringsmodulen er adskilt fra orkestreringen", () => {
  it("dealer-economics-store.ts er server-only, bruker publishable-klienten (ikke service-role) og skriver ingen avledede felt", () => {
    const src = readFileSync("src/server/dealer-economics-store.ts", "utf8");
    expect(src).toMatch(/^import "server-only";/);
    expect(src).not.toMatch(/service_role|SERVICE_ROLE|createClient\(/);
    expect(src).not.toMatch(/estimat|landed|totalMinor|importCash/i);
    const logic = readFileSync("src/server/dealer-economics.ts", "utf8");
    expect(logic).not.toMatch(/supabase|node:fs|fetch\(|process\.env/);
  });
});

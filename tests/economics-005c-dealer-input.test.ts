/**
 * ECON-005c — forhandlerinput: streng parsing (server-validering), ingen annonsepåstander som avgiftsgrunnlag, binding til firma/søk/kandidat/revisjon og foreldelse (plan P2).
 */
import { describe, expect, it } from "vitest";
import { evaluateDealerInput, parseDealerInput, parseDealerProfile, toLineScopes, dayAfterIso, MAX_DEALER_INPUT_BYTES, type DealerInputV1, type StoredDealerInput } from "@/domain/search-economics";
import { bindingFor, confirmationContextFor } from "@/server/search-economics";
import { rightsForSource, REGISTERED_PROFILES } from "@/domain/provider-rights";
import { FIRM_A, FIRM_B, NOW, SEARCH_1, SEARCH_2, candidate, dealerInput, line, specOf, stored } from "./fixtures/economics-005c";

const rights = rightsForSource("synthetic-demo", NOW, REGISTERED_PROFILES);
const issues = (raw: unknown) => { const r = parseDealerInput(raw); return r.ok ? [] : r.issues.map((i) => `${i.path}:${i.code}`); };

describe("parseDealerInput: streng servervalidering", () => {
  it("gyldig fullstendig input godtas og returneres uendret", () => {
    const r = parseDealerInput(dealerInput());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual(dealerInput());
  });
  it("kun schemaVersion er gyldig minimum (alt annet er ukjent, ikke 0)", () => {
    const r = parseDealerInput({ schemaVersion: 1 });
    expect(r).toEqual({ ok: true, value: { schemaVersion: 1 } });
  });
  it.each([null, undefined, 5, "x", [], true])("ikke-objekt %j avvises uten unntak", (v) => { expect(parseDealerInput(v).ok).toBe(false); });
  it("klientens firma-/søke-/kandidatnøkler og andre ukjente nøkler avvises på alle nivåer", () => {
    expect(issues({ ...dealerInput(), dealershipId: FIRM_B })).toContain("$.dealershipId:unknown_key");
    expect(issues({ ...dealerInput(), dealership_id: FIRM_B, candidateId: "x", searchId: "y" })).toEqual(expect.arrayContaining(["$.dealership_id:unknown_key", "$.candidateId:unknown_key", "$.searchId:unknown_key"]));
    expect(issues({ ...dealerInput(), propulsion: { ...dealerInput().propulsion!, extra: 1 } })).toContain("$.propulsion.extra:unknown_key");
    expect(issues({ ...dealerInput(), fx: { acquisition: { pair: "EUR/NOK", rate: "11.5", sourceLabel: "bank", quotedAt: "2026-10-19", dealershipId: FIRM_B } } })).toContain("$.fx.acquisition.dealershipId:unknown_key");
  });
  it("annonsepåstand kan aldri være grunnlag for tekniske avgiftsinput eller utenlandsk mva.", () => {
    expect(issues({ ...dealerInput(), propulsion: { ...dealerInput().propulsion!, basis: "listing_claim" } })).toContain("$.propulsion.basis:invalid_value");
    expect(issues({ ...dealerInput(), firstRegistration: { precision: "year", value: "2023", basis: "listing_claim" } })).toContain("$.firstRegistration.basis:invalid_value");
    expect(issues({ ...dealerInput(), taxWeight: { kg: 1900, basis: "reference_listing" } })).toContain("$.taxWeight.basis:invalid_value");
    expect(issues({ ...dealerInput(), taxWeight: { kg: 1900, basis: "unverified" } })).toContain("$.taxWeight.basis:invalid_value");
    expect(issues({ ...dealerInput(), foreignVat: { treatment: "excluded_documented", evidence: "listing_claim" } })).toContain("$.foreignVat.evidence:invalid_value");
  });
  it("datopresisjon: verdi må stemme med presisjon (ingen oppdiktet dag/måned); ugyldig kalenderdato avvises", () => {
    for (const [precision, value] of [["day", "2023-11"], ["month", "2023-11-15"], ["year", "2023-11"], ["day", "2023-02-30"], ["month", "2023-13"], ["unknown", "2023"], ["none", "2023-11-15"], ["year", null], ["day", null]] as const) {
      expect(issues({ schemaVersion: 1, firstRegistration: { precision, value, basis: "vehicle_register" } }), `${precision}/${value}`).toContain("$.firstRegistration.value:invalid_value");
    }
    for (const [precision, value] of [["day", "2023-11-15"], ["month", "2023-11"], ["year", "2023"], ["unknown", null], ["none", null]] as const) {
      expect(issues({ schemaVersion: 1, firstRegistration: { precision, value, basis: "dealer_entered" } }), `${precision}/${value}`).toEqual([]);
    }
    expect(issues({ schemaVersion: 1, customsDate: { date: "2026-10-20", kind: "unknown" } })).toContain("$.customsDate.date:invalid_value");
    expect(issues({ schemaVersion: 1, norwegianRegistration: { date: "2026-02-30", kind: "expected" } })).toContain("$.norwegianRegistration.date:invalid_value");
  });
  it("penger er desimalstrenger i NOK: flyttall, negative, eksponent, for mange desimaler og tomt avvises; 0 godtas bare når den er oppgitt", () => {
    for (const bad of [8000, -1, "-1", "1e3", "8 000", "8000,50", "8000.123", "", ".5", "01", "NaN", "1000000000000"]) expect(issues({ schemaVersion: 1, transportToBorder: { amount: bad } }), String(bad)).toContain("$.transportToBorder.amount:invalid_value");
    for (const ok of ["0", "8000", "8000.5", "8000.50", "0.99"]) expect(issues({ schemaVersion: 1, insurance: { amount: ok } }), ok).toEqual([]);
  });
  it("kurs: kilde og dato er påkrevd, par må være X/NOK, kurs > 0 med begrenset presisjon; kilde er alltid forhandleroppgitt", () => {
    const fx = (over: Record<string, unknown>) => ({ schemaVersion: 1, fx: { acquisition: { pair: "EUR/NOK", rate: "11.5", sourceLabel: "Bank X", quotedAt: "2026-10-19", ...over } } });
    expect(issues(fx({}))).toEqual([]);
    for (const [k, v] of [["pair", "EURNOK"], ["pair", "EUR/USD"], ["rate", "0"], ["rate", "0.0"], ["rate", "-1"], ["rate", 11.5], ["rate", "11,5"], ["sourceLabel", ""], ["quotedAt", null], ["quotedAt", "19.10.2026"], ["effectiveAt", "2026-13-01"], ["validFrom", "2026-10-01"], ["validTo", "2026-10-31"]] as const) {
      expect(issues(fx({ [k]: v })).length, `${k}=${String(v)}`).toBeGreaterThan(0);
    }
    expect(issues({ schemaVersion: 1, fx: { customs: { pair: "EUR/NOK", rate: "11.5", sourceLabel: "Tolletaten, hentet manuelt", quotedAt: "2026-10-19", validFrom: "2026-10-16", validTo: "2026-10-31" } } })).toEqual([]);
    expect(issues({ schemaVersion: 1, fx: { customs: { pair: "EUR/NOK", rate: "11.5", sourceLabel: "x", quotedAt: "2026-10-19", validUntil: "2026-10-31" } } })).toContain("$.fx.customs.validUntil:invalid_value");
    expect(issues({ schemaVersion: 1, fx: { acquisition: { pair: "EUR/NOK", rate: "11.5", sourceLabel: "x", quotedAt: "2026-10-19", source: { kind: "official_customs" } } } })).toContain("$.fx.acquisition.source:unknown_key");
  });
  it("mva.-håndtering og fradrag: kun kjente verdier; utelatt = ukjent (ingen standardverdi settes av parseren)", () => {
    expect(issues({ schemaVersion: 1, vatHandling: "registered" })).toContain("$.vatHandling:invalid_value");
    expect(issues({ schemaVersion: 1, deduction: true })).toContain("$.deduction:invalid_value");
    const r = parseDealerInput({ schemaVersion: 1 });
    expect(r.ok && "deduction" in r.value).toBe(false);
    expect(r.ok && "vatHandling" in r.value).toBe(false);
  });
  it("omfang per kostnadslinje: kjente verdier, split med heltallsstrenger; ugyldig id og for mange linjer avvises", () => {
    const ok = parseDealerInput({ schemaVersion: 1, lineScopes: { transport: "to_border", ins: "other", t2: { split: { toBorderMinor: "800000", afterBorderMinor: "200000" } }, u: "unconfirmed" } });
    expect(ok.ok).toBe(true);
    for (const bad of ["maybe", { split: { toBorderMinor: 8000, afterBorderMinor: "1" } }, { split: { toBorderMinor: "-1", afterBorderMinor: "1" } }, { split: { toBorderMinor: "1" } }, { split: { toBorderMinor: "1", afterBorderMinor: "1", x: 1 } }, null]) {
      expect(issues({ schemaVersion: 1, lineScopes: { a: bad } }).length, JSON.stringify(bad)).toBeGreaterThan(0);
    }
    expect(issues({ schemaVersion: 1, lineScopes: { "Bad Id": "to_border" } })).toContain("$.lineScopes:invalid_value");
    expect(issues({ schemaVersion: 1, lineScopes: Object.fromEntries(Array.from({ length: 31 }, (_, i) => [`l${i}`, "other"])) })).toContain("$.lineScopes:too_large");
    expect(toLineScopes(ok.ok ? ok.value.lineScopes : undefined)).toEqual({ transport: "to_border", ins: "other", t2: { split: { toBorderMinor: 800_000n, afterBorderMinor: 200_000n } }, u: "unconfirmed" });
  });
  it("størrelsesgrense og sirkulære/uparsebare verdier gir avvisning, ikke unntak", () => {
    expect(issues({ schemaVersion: 1, evidenceRef: "x".repeat(MAX_DEALER_INPUT_BYTES) })).toEqual(["$:too_large"]);
    const cyc: Record<string, unknown> = { schemaVersion: 1 }; cyc.self = cyc;
    expect(parseDealerInput(cyc).ok).toBe(false);
    expect(parseDealerInput({ schemaVersion: 1, taxWeight: { kg: 10n, basis: "dealer_entered" } }).ok).toBe(false);
  });
  it("tekniske verdier: vekt/CO₂ heltall innen grenser (flyttall, 0 vekt og negative avvises); ukjent = null", () => {
    for (const kg of [0, -5, 1.5, 20_001, "1976"]) expect(issues({ schemaVersion: 1, taxWeight: { kg, basis: "dealer_entered" } }), String(kg)).toContain("$.taxWeight.kg:invalid_value");
    expect(issues({ schemaVersion: 1, taxWeight: { kg: null, basis: "dealer_entered" } })).toEqual([]);
    for (const g of [-1, 2001, 1.5]) expect(issues({ schemaVersion: 1, co2: { gramsPerKm: g, method: "wltp_combined" } })).toContain("$.co2.gramsPerKm:invalid_value");
    expect(issues({ schemaVersion: 1, co2: { gramsPerKm: 0, method: "wltp_combined" } })).toEqual([]);
  });
  it("firmaprofil: bare mva.-håndtering og fradrag; standard ukjent", () => {
    expect(parseDealerProfile({ schemaVersion: 1 })).toEqual({ ok: true, value: { schemaVersion: 1 } });
    expect(parseDealerProfile({ schemaVersion: 1, vatHandling: "unknown", deduction: "recoverable" }).ok).toBe(true);
    for (const bad of [{ schemaVersion: 1, dealershipId: FIRM_A }, { schemaVersion: 1, vatHandling: "x" }, { schemaVersion: 2 }, {}, null]) expect(parseDealerProfile(bad).ok).toBe(false);
  });
});

describe("binding til firma, søk, kandidat og revisjon; foreldelse (P2)", () => {
  const spec = specOf([line("transport", "transport", 800_000n)]);
  const cur = (over: Partial<{ dealershipId: string; searchId: string; candidateId: string; candidateVersion: string }> = {}, spec2 = spec, now = NOW.toISOString()) => ({
    binding: { ...bindingFor(FIRM_A, SEARCH_1, candidate()), ...over }, context: confirmationContextFor(spec2, rights), now,
  });
  const st = (over: Partial<StoredDealerInput> = {}): StoredDealerInput => ({ ...stored({ rights, spec }), ...over });

  it("ingen lagret input ⇒ none; uendret nøkkel og kontekst ⇒ fresh", () => {
    expect(evaluateDealerInput(null, cur())).toEqual({ status: "none" });
    expect(evaluateDealerInput(st(), cur())).toEqual({ status: "fresh", expiryLimits: [] });
  });
  it.each([
    ["annet firma", { dealershipId: FIRM_B }], ["annet søk", { searchId: SEARCH_2 }], ["annen kandidat", { candidateId: "13:synthetic-demo/ad-2" }],
  ])("%s ⇒ foreign (brukes aldri, ingen antydning av innholdet)", (_n, over) => {
    expect(evaluateDealerInput(st(), cur(over))).toEqual({ status: "foreign" });
  });
  it("ny kandidatrevisjon ⇒ krever ny bekreftelse", () => {
    expect(evaluateDealerInput(st(), cur({ candidateVersion: "rev1:" + "b".repeat(64) }))).toEqual({ status: "stale_needs_reconfirmation", reasons: ["candidate_version_changed"] });
  });
  it("endret kostnadsgrunnlag (beløp, linje lagt til/fjernet, mva.-grunnlag, valuta) ⇒ krever ny bekreftelse", () => {
    for (const s2 of [specOf([line("transport", "transport", 900_000n)]), specOf([]), specOf([line("transport", "transport", 800_000n), line("x", "custom", 1n)]), specOf([line("transport", "transport", 800_000n, { vatBasis: "none" })]),
      specOf([line("transport", "transport", 800_000n, { includedInBudget: false })])]) {
      expect(evaluateDealerInput(st(), cur({}, s2))).toEqual({ status: "stale_needs_reconfirmation", reasons: ["cost_basis_changed"] });
    }
  });
  it("endret planlagt registreringsscenario ⇒ krever ny bekreftelse", () => {
    const r = evaluateDealerInput(st(), cur({}, specOf(spec.budget.costs, "van")));
    expect(r).toEqual({ status: "stale_needs_reconfirmation", reasons: ["scenario_changed"] });
  });
  it("endret budsjett/avvik krever IKKE ny bekreftelse (resultatet regnes på nytt fra samme input)", () => {
    expect(evaluateDealerInput(st(), cur({}, specOf(spec.budget.costs, "passenger", 5_000_000n))).status).toBe("fresh");
  });
  it("endret rettighetsavtrykk for avledet økonomi ⇒ krever ny bekreftelse", () => {
    expect(evaluateDealerInput(st({ context: { ...st().context, rightsDigest: "0".repeat(64) } }), cur())).toEqual({ status: "stale_needs_reconfirmation", reasons: ["rights_changed"] });
  });
  it("endret inputSchemaVersion ⇒ krever ny bekreftelse", () => {
    const s = st(); s.binding = { ...s.binding, inputSchemaVersion: 0 };
    expect(evaluateDealerInput(s, cur())).toEqual({ status: "stale_needs_reconfirmation", reasons: ["schema_version_changed"] });
  });
  it("flere årsaker rapporteres sammen", () => {
    const r = evaluateDealerInput(st(), cur({ candidateVersion: "rev1:" + "c".repeat(64) }, specOf([])));
    expect(r).toEqual({ status: "stale_needs_reconfirmation", reasons: ["candidate_version_changed", "cost_basis_changed"] });
  });
  it("utløpt forhandleroppgitt kurs ⇒ krever ny bekreftelse; gyldig kurs gir utløpsgrense (inklusiv sluttdato ⇒ eksklusiv neste døgn)", () => {
    const fx = (validUntil: string): DealerInputV1 => dealerInput({ fx: { acquisition: { pair: "EUR/NOK", rate: "11.5", sourceLabel: "Bank X", effectiveAt: "2026-10-19", quotedAt: "2026-10-19", validUntil } } });
    const fresh = evaluateDealerInput(stored({ rights, spec, input: fx("2026-10-20") }), cur());
    expect(fresh).toEqual({ status: "fresh", expiryLimits: [{ label: "dealer_acquisition_fx_validUntil", untilExclusive: "2026-10-21T00:00:00.000Z" }] });
    expect(evaluateDealerInput(stored({ rights, spec, input: fx("2026-10-19") }), cur())).toEqual({ status: "stale_needs_reconfirmation", reasons: ["fx_expired"] });
    expect(evaluateDealerInput(stored({ rights, spec, input: fx("2026-10-20") }), cur({}, spec, "2026-10-21T00:00:00Z"))).toEqual({ status: "stale_needs_reconfirmation", reasons: ["fx_expired"] });
    const customs = dealerInput({ fx: { customs: { pair: "EUR/NOK", rate: "11.5", sourceLabel: "Tolletaten", quotedAt: "2026-10-16", validFrom: "2026-10-16", validTo: "2026-10-31" } } });
    expect(evaluateDealerInput(stored({ rights, spec, input: customs }), cur())).toEqual({ status: "fresh", expiryLimits: [{ label: "dealer_customs_fx_validTo", untilExclusive: "2026-11-01T00:00:00.000Z" }] });
  });
  it("dayAfterIso", () => {
    expect(dayAfterIso("2026-12-31")).toBe("2027-01-01T00:00:00.000Z");
    expect(dayAfterIso("2026-02-30")).toBeNull();
  });
});

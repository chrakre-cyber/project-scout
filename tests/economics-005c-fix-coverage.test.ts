/**
 * ECON-005c retting (review av c1295cf, fire P2): (1) kontrollert kobling annonse ↔ kandidat (id + revisjon) før bekreftelsen brukes, (2) omfang/split valideres mot aktuell
 * kostnadslinje før lagring og før bruk, (3) fremtidig/ugyldig kildeobservasjon gir ingen brukbar vurdering, (4) registreringsfeltet (og øvrige annonsefelt) leses bare etter
 * rettighetskontroll og bare når forhandlerens egen verdi ikke brukes. Kjernen kjøres ekte (registerprofilen, alle økonomiflagg false).
 */
import { describe, expect, it } from "vitest";
import { toEconomicsInput, type AdapterInput } from "@/adapters/search-economics/to-economics-input";
import { candidateId } from "@/adapters/search-candidate/candidate";
import { REGISTRY_ECONOMICS_PROFILE, UNCONFIRMED_HALF_UP, calculateEconomics } from "@/domain/economics";
import { REGISTERED_PROFILES, rightsForSource, type EconomicsFieldKey } from "@/domain/provider-rights";
import { toCostAssessment, validateLineScopes, type DealerInputV1 } from "@/domain/search-economics";
import { assessEconomics, type EconomicsRequest } from "@/server/search-economics";
import { verifyCandidatePair } from "@/server/candidate-pairing";
import { confirmDealerInput, type DealerEconomicsStore } from "@/server/dealer-economics";
import { FIRM_A, NOW, SEARCH_1, candidate, candidateFor, dealerInput, line, listing, specOf, stored } from "./fixtures/economics-005c";
import { profile } from "./fixtures/rights-profiles";

const demo = rightsForSource("synthetic-demo", NOW, REGISTERED_PROFILES);
const req = (over: Partial<EconomicsRequest> = {}): EconomicsRequest => {
  const spec = over.spec ?? specOf();
  const l = over.listing ?? listing();
  // Annonser kandidatadapteren avviser (f.eks. ugyldig tidspunkt) har ingen kanonisk kandidat; testene som bruker dem skal gi en ikke-beregnet årsak.
  const cand = over.candidate ?? (() => { try { return candidateFor(l); } catch { return candidate(); } })();
  return { dealershipId: FIRM_A, searchId: SEARCH_1, spec, stored: stored({ rights: demo, spec, cand }), profile: null, now: NOW, ...over, listing: l, candidate: cand };
};
const withPrice = (amount: string, minor: number) => listing({ price: { ...listing().price!, stated: { amount, currency: "NOK" }, amount: { amountMinor: minor, currency: "NOK" } } });
const json = (v: unknown) => JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x));

// ================================================================== P2-1
describe("P2-1: kontrollert kobling annonse ↔ kandidat (id og revisjon) før bekreftelsen brukes", () => {
  it("fixturenes identitet er kanonisk: id følger source.length (14 for «synthetic-demo»), ikke den tidligere håndskrevne «13:»-prefiksen", () => {
    const l = listing();
    expect(l.source.length).toBe(14);
    expect(candidate().id).toBe(candidateId(l.source, l.sourceListingId));
    expect(candidate().id).toBe("14:synthetic-demo/ad-1");
    expect(candidate().id.startsWith("13:")).toBe(false);
    expect(candidate().version).toMatch(/^rev1:[0-9a-f]{64}$/);
  });
  it("riktig par godkjennes, også når kandidaten er laget av den ekte pipelinefunksjonen", () => {
    expect(verifyCandidatePair({ listing: listing(), candidate: candidate(), rights: demo })).toEqual({ ok: true });
  });
  it("annen annonse enn kandidatens: identity_mismatch (reviewers scenario)", () => {
    expect(verifyCandidatePair({ listing: listing({ sourceListingId: "another-ad" }), candidate: candidate(), rights: demo })).toEqual({ ok: false, reason: "identity_mismatch" });
    expect(verifyCandidatePair({ listing: listing({ source: "annen-kilde" }), candidate: candidate(), rights: demo })).toMatchObject({ ok: false });
  });
  it("samme annonse-id men endret innhold (pris, spesifikasjoner, tekst, selger): revision_mismatch — revisjonen er ikke en fritt oppgitt streng", () => {
    const base = listing();
    for (const changed of [
      withPrice("100001", 10_000_100),
      listing({ specs: { ...base.specs, curbWeightKg: 1977 } }),
      listing({ specs: { ...base.specs, firstRegistration: { precision: "month", year: 2023, month: 12 } } }),
      listing({ text: "ny tekst" }),
      listing({ seller: { type: "private", countryCode: "DE", city: null } }),
    ]) {
      expect(verifyCandidatePair({ listing: changed, candidate: candidate(), rights: demo })).toEqual({ ok: false, reason: "revision_mismatch" });
    }
  });
  it("oppgitte, ikke-kanoniske par avvises: håndskrevet «13:»-id, vilkårlig revisjon, tom revisjon, feil type", () => {
    for (const c of [{ id: "13:synthetic-demo/ad-1", version: candidate().version }, { id: candidate().id, version: "rev1:" + "0".repeat(64) }, { id: candidate().id, version: "" }, { id: candidate().id, version: 5 as unknown as string }, { id: 7 as unknown as string, version: candidate().version }]) {
      expect(verifyCandidatePair({ listing: listing(), candidate: c, rights: demo })).toMatchObject({ ok: false });
    }
  });
  it("kilde uten registrert mapping og manglende adapter avvises lukket", () => {
    expect(verifyCandidatePair({ listing: listing({ source: "ukjent-kilde" }), candidate: { id: candidateId("ukjent-kilde", "ad-1"), version: "rev1:x" }, rights: demo })).toMatchObject({ ok: false });
    expect(verifyCandidatePair({ listing: listing(), candidate: candidate(), rights: demo, adapter: null })).toEqual({ ok: false, reason: "mapping_unavailable" });
  });
  it("forbehandlingen følger matchingretten som pipelinen: nektet tittel ⇒ uvurderbar ⇒ ikke verifiserbar", () => {
    const p = profile({ matching: { title: false } });
    expect(verifyCandidatePair({ listing: listing(), candidate: candidate(), rights: rightsForSource("synthetic-demo", NOW, [p]) })).toEqual({ ok: false, reason: "not_adaptable" });
  });
  it("assessEconomics: bekreftelsen for ad-1 brukes aldri sammen med annonse another-ad (kandidat-id for ad-1), og ingen tall produseres", () => {
    const other = listing({ sourceListingId: "another-ad", price: { ...listing().price!, stated: { amount: "777777", currency: "NOK" }, amount: { amountMinor: 77_777_700, currency: "NOK" } } });
    const a = assessEconomics(req({ listing: other, candidate: candidate() }));
    expect(a.kind).toBe("not_calculated");
    if (a.kind === "not_calculated") { expect(a.reason).toBe("candidate_listing_mismatch"); expect(a.dealerInput).toEqual({ status: "foreign" }); expect(a.budget.status).toBe("not_calculated"); }
    expect(json(a)).not.toContain("777777");
  });
  it("assessEconomics: samme id, annonsen endret etter at kandidaten ble laget ⇒ ikke brukt (revision_mismatch), selv om bekreftelsen er bundet til den gamle revisjonen", () => {
    const changed = withPrice("100001", 10_000_100);
    const a = assessEconomics(req({ listing: changed, candidate: candidate() }));
    expect(a.kind === "not_calculated" && a.reason).toBe("candidate_listing_mismatch");
  });
  it("assessEconomics: kandidat utledet av den aktuelle (endrede) annonsen gir ny revisjon og krever ny bekreftelse — ikke den gamle", () => {
    const changed = withPrice("100001", 10_000_100);
    const a = assessEconomics(req({ listing: changed, candidate: candidateFor(changed), stored: stored({ rights: demo, spec: specOf(), cand: candidate() }) }));
    expect(a.kind === "assessed" && a.dealerInput).toEqual({ status: "stale_needs_reconfirmation", reasons: ["candidate_version_changed"] });
  });
  it("kandidat-adapter-injeksjon: en annen (ugyldig) adapter gir mismatch, ikke tillit", () => {
    const a = assessEconomics(req({ candidateAdapter: null }));
    expect(a.kind === "not_calculated" && a.reason).toBe("candidate_listing_mismatch");
  });
  it("paringen sjekkes etter beregningsretten for pris (uten rett leses ingen annonse): unavailable uavhengig av parets gyldighet", () => {
    const p = profile({ derivedEconomics: { allow: { price: false, registration: true, specs: true }, display: false } });
    const a = assessEconomics(req({ profiles: [p], candidate: candidate({ id: "x" }) }));
    expect(a.kind).toBe("unavailable");
  });
});

// ================================================================== P2-2
describe("P2-2: omfang og split valideres mot aktuell kostnadslinje (før lagring og før bruk)", () => {
  const costs = [line("t", "transport", 800_000n), line("i", "insurance", 50_000n), line("c", "custom", 100_000n), line("u", "transport", null, { id: "u" })];
  const issues = (scopes: DealerInputV1["lineScopes"]) => validateLineScopes(scopes, costs).map((i) => i.path);
  it("gyldige: transport til/etter/split(sum = beløp), forsikring til/annet, unconfirmed på alle typer", () => {
    expect(issues({ t: "to_border" })).toEqual([]);
    expect(issues({ t: "after_border" })).toEqual([]);
    expect(issues({ t: { split: { toBorderMinor: "800000", afterBorderMinor: "0" } } })).toEqual([]);
    expect(issues({ t: { split: { toBorderMinor: "0", afterBorderMinor: "800000" } } })).toEqual([]);
    expect(issues({ t: { split: { toBorderMinor: "600001", afterBorderMinor: "199999" } } })).toEqual([]);
    expect(issues({ i: "to_border" })).toEqual([]);
    expect(issues({ i: "other" })).toEqual([]);
    expect(issues({ t: "unconfirmed", i: "unconfirmed", c: "unconfirmed", u: "unconfirmed" })).toEqual([]);
  });
  it.each([
    ["split over linjens beløp (reviewers tilfelle)", { t: { split: { toBorderMinor: "10000000", afterBorderMinor: "0" } } }],
    ["split under linjens beløp", { t: { split: { toBorderMinor: "400000", afterBorderMinor: "399999" } } }],
    ["split ett øre for mye", { t: { split: { toBorderMinor: "800000", afterBorderMinor: "1" } } }],
    ["split på forsikring", { i: { split: { toBorderMinor: "25000", afterBorderMinor: "25000" } } }],
    ["split på øvrig kostnad", { c: { split: { toBorderMinor: "50000", afterBorderMinor: "50000" } } }],
    ["split på linje med ukjent beløp", { u: { split: { toBorderMinor: "1", afterBorderMinor: "1" } } }],
    ["after_border på forsikring", { i: "after_border" }],
    ["other på transport", { t: "other" }],
    ["to_border på øvrig kostnad", { c: "to_border" }],
    ["ukjent linje", { ghost: "to_border" }],
  ])("ugyldig: %s", (_n, scopes) => { expect(issues(scopes as DealerInputV1["lineScopes"]).length).toBeGreaterThan(0); });

  const spec = specOf([line("t", "transport", 800_000n), line("i", "insurance", 50_000n)]);
  const memStore = () => { const w: unknown[] = []; const s: DealerEconomicsStore = { getInput: async () => null, listInputs: async () => [], saveInput: async (...a) => { w.push(a); return { ok: true }; }, getProfile: async () => null, saveProfile: async () => ({ ok: true }) }; return { s, w }; };
  it.each([
    ["split over linjen", { t: { split: { toBorderMinor: "10000000", afterBorderMinor: "0" } } }],
    ["split på forsikring", { i: { split: { toBorderMinor: "25000", afterBorderMinor: "25000" } } }],
    ["after_border på forsikring", { i: "after_border" }],
    ["endret linjebeløp (split for 9 000 mot linje 8 000)", { t: { split: { toBorderMinor: "900000", afterBorderMinor: "0" } } }],
  ])("lagring avvises uten skriving: %s", async (_n, scopes) => {
    const { s, w } = memStore();
    const r = await confirmDealerInput(s, { searchId: SEARCH_1, candidate: candidate(), spec, rights: demo, raw: dealerInput({ lineScopes: scopes as DealerInputV1["lineScopes"] }) });
    expect(r).toMatchObject({ ok: false, code: "invalid_input" });
    expect(w).toHaveLength(0);
  });
  it("gyldig split lagres", async () => {
    const { s, w } = memStore();
    expect(await confirmDealerInput(s, { searchId: SEARCH_1, candidate: candidate(), spec, rights: demo, raw: dealerInput({ lineScopes: { t: { split: { toBorderMinor: "600000", afterBorderMinor: "200000" } } } }) })).toEqual({ ok: true });
    expect(w).toHaveLength(1);
  });

  const ad = (input: DealerInputV1, sp = spec): AdapterInput => ({ listing: listing(), spec: sp, dealer: { input, confirmedBy: "u", confirmedAt: NOW.toISOString() }, profile: null, allowedFields: new Set<EconomicsFieldKey>(["price", "registration", "specs"]), now: NOW.toISOString() });
  const noComponents = { transportToBorder: undefined, transportAfterBorder: undefined, insurance: undefined } as const;
  it("adapter: ugyldig split mates ALDRI inn i kjernen (komponentene forblir ukjente) og meldes", () => {
    const r = toEconomicsInput(ad(dealerInput({ ...noComponents, lineScopes: { t: { split: { toBorderMinor: "10000000", afterBorderMinor: "0" } } } })));
    if (!r.ok) throw new Error(r.reason);
    expect(r.input.transportToBorder).toBe("unknown");
    expect(r.input.transportAfterBorder).toEqual({ state: "unknown" });
    expect(r.notes).toContain("line_scope_invalid_not_used");
    const core = calculateEconomics(r.input, { rounding: UNCONFIRMED_HALF_UP, profile: REGISTRY_ECONOMICS_PROFILE });
    expect(core.transportToBorderNok).toBeNull();
  });
  it("adapter: split på forsikring, omfang på feil type og split med feil sum gir ingen økonomiinput", () => {
    for (const scopes of [{ i: { split: { toBorderMinor: "25000", afterBorderMinor: "25000" } } }, { i: "after_border" }, { t: "other" }, { t: { split: { toBorderMinor: "400000", afterBorderMinor: "399999" } } }] as DealerInputV1["lineScopes"][]) {
      const r = toEconomicsInput(ad(dealerInput({ ...noComponents, lineScopes: scopes })));
      if (!r.ok) throw new Error(r.reason);
      expect([r.input.transportToBorder, r.input.insurance]).toEqual(["unknown", "unknown"]);
      expect(r.input.transportAfterBorder).toEqual({ state: "unknown" });
    }
  });
  it("adapter: gyldig split mates inn (kontroll av at vernet ikke er for strengt)", () => {
    const r = toEconomicsInput(ad(dealerInput({ ...noComponents, lineScopes: { t: { split: { toBorderMinor: "600000", afterBorderMinor: "200000" } } } })));
    if (!r.ok) throw new Error(r.reason);
    expect(r.input.transportToBorder).toEqual({ amount: "6000", basis: "dealer_entered" });
    expect(r.input.transportAfterBorder).toEqual({ amount: "2000", basis: "dealer_entered" });
  });
  it("samspill med eksplisitte komponentoverstyringer: forhandlerens komponent vinner, men avvik fra den gyldige splitten gjør linjen uavklart (005a) — aldri dekket", () => {
    const sp = spec;
    const r = toEconomicsInput(ad(dealerInput({ transportToBorder: { amount: "5000" }, transportAfterBorder: undefined, insurance: undefined, lineScopes: { t: { split: { toBorderMinor: "600000", afterBorderMinor: "200000" } } } }), sp));
    if (!r.ok) throw new Error(r.reason);
    expect(r.input.transportToBorder).toEqual({ amount: "5000", basis: "dealer_entered" });
    const core = calculateEconomics(r.input, { rounding: UNCONFIRMED_HALF_UP, profile: REGISTRY_ECONOMICS_PROFILE });
    const out = toCostAssessment({ result: core, spec: sp, candidate: candidate(), now: NOW.toISOString(), profileRef: "x@y", rightsLimit: { label: "r", untilExclusive: null }, sourceDataLimit: { label: "s", untilExclusive: null }, lineScopes: r.lineScopes });
    expect(out.lines.find((l) => l.id === "t")).toMatchObject({ treatment: "unsupported", reason: "mapped_component_missing" });
    expect(out.class).not.toBe("complete_validated");
  });
  it("assessEconomics: lagret ugyldig fordeling (omgått lagringsvalideringen) brukes ikke — stale line_scopes_invalid og ukjent transport i kjernen", () => {
    const bad = dealerInput({ ...noComponents, lineScopes: { t: { split: { toBorderMinor: "10000000", afterBorderMinor: "0" } } } });
    const a = assessEconomics(req({ spec, stored: stored({ rights: demo, spec, input: bad }) }));
    expect(a.kind).toBe("assessed");
    if (a.kind !== "assessed") return;
    expect(a.dealerInput).toEqual({ status: "stale_needs_reconfirmation", reasons: ["line_scopes_invalid"] });
    expect(a.detail!.result.transportToBorderNok).toBeNull();
    expect(a.detail!.result.tax.status).toBe("blocked"); // hele forhandlerinputen er ubrukt
  });
  it("assessEconomics: bekreftelse som var gyldig, men linjens beløp er endret etter bekreftelsen ⇒ ny bekreftelse (kostnadsgrunnlag)", () => {
    const old = specOf([line("t", "transport", 800_000n), line("i", "insurance", 50_000n)]);
    const input = dealerInput({ ...noComponents, lineScopes: { t: { split: { toBorderMinor: "600000", afterBorderMinor: "200000" } } } });
    const s = stored({ rights: demo, spec: old, input });
    const changed = specOf([line("t", "transport", 900_000n), line("i", "insurance", 50_000n)]);
    const a = assessEconomics(req({ spec: changed, stored: s }));
    expect(a.kind === "assessed" && a.dealerInput).toMatchObject({ status: "stale_needs_reconfirmation" });
    if (a.kind === "assessed") expect(a.detail!.result.transportToBorderNok).toBeNull();
  });
  it("assessEconomics: reviewers tilfelle — 100 000 NOK når aldri kjernen", () => {
    const sp = specOf([line("t", "transport", 800_000n)]);
    const input = dealerInput({ transportToBorder: undefined, transportAfterBorder: undefined, lineScopes: { t: { split: { toBorderMinor: "10000000", afterBorderMinor: "0" } } } });
    const a = assessEconomics(req({ spec: sp, stored: stored({ spec: sp, rights: demo, input }) }));
    expect(a.kind === "assessed" && a.detail?.result.transportToBorderNok).toBeNull();
  });
});

// ================================================================== P2-3
describe("P2-3: fremtidig eller ugyldig kildeobservasjon gir ingen brukbar vurdering", () => {
  const at = (lastSeenAt: string, now = NOW) => assessEconomics(req({ listing: listing({ lastSeenAt }), now }));
  it("framtidig observasjon (også ett millisekund) ⇒ not_calculated/source_observation_in_future, ingen tall og ingen vurdering", () => {
    for (const t of ["2026-10-21T10:00:00Z", "2026-10-20T10:00:00.001Z", "2027-01-01T00:00:00Z"]) {
      const a = at(t);
      expect(a.kind, t).toBe("not_calculated");
      if (a.kind === "not_calculated") { expect(a.reason).toBe("source_observation_in_future"); expect(a.budget.status).toBe("not_calculated"); }
      expect(json(a)).not.toMatch(/468723|lowerBound|valueNok/);
    }
  });
  it.each(["", "i går", "2026-10-20", "2026-10-20T10:00:00", "2026-13-01T00:00:00Z", "2026-02-30T00:00:00Z", "20261020T100000Z", "2026-10-20T25:00:00Z"])("ugyldig tidspunkt «%s» ⇒ source_observation_invalid", (t) => {
    // ugyldig lastSeenAt får annonsen også til å feile kandidatadapteren (parringen) – begge gir en presis ikke-beregnet årsak, aldri en vurdering
    const a = at(t);
    expect(a.kind).toBe("not_calculated");
    if (a.kind === "not_calculated") expect(["source_observation_invalid", "candidate_listing_mismatch"]).toContain(a.reason);
  });
  it("ugyldig tidspunkt som slipper gjennom en (stub-)adapter treffer egen kontroll: source_observation_invalid, uten vurdering", () => {
    const l = listing({ lastSeenAt: "i går" });
    const stub = { mapping: { sourceId: "stub", version: "1" }, adapt: () => ({ ok: true as const, candidate: candidate(), meta: {} as never }) };
    // paringen kan ikke bestå uten at id stemmer: bruk id fra den gyldige annonsen (samme id, stub gir samme revisjon)
    const a = assessEconomics(req({ listing: l, candidate: candidate(), candidateAdapter: stub }));
    expect(a.kind === "not_calculated" && a.reason).toBe("source_observation_invalid");
  });
  it("tidspunktet = nåtid er gyldig (grensen er streng ›); nylig observert gir vurdering", () => {
    expect(at(NOW.toISOString()).kind).toBe("assessed");
    expect(at("2026-10-20T09:59:59.999Z").kind).toBe("assessed");
  });
  it("kontroll hos reviewer-testen: framtidig observasjon gir ingen CostAssessment", () => {
    const a = assessEconomics(req({ listing: listing({ lastSeenAt: "2026-10-21T10:00:00Z" }) }));
    expect(a.kind === "assessed" && a.detail?.outcome.assessment).toBeFalsy();
  });
  it("utløpt kilde (observasjon + retensjon ≤ nå) gir fortsatt ingen brukbar vurdering — korrekt grense bevart", () => {
    const p = profile({ derivedEconomics: { allow: { price: true, registration: true, specs: true }, display: true }, storage: { ...profile().storage, retentionSeconds: 3600 } });
    const sp = specOf();
    const rights = rightsForSource("synthetic-demo", NOW, [p]);
    const mk = (lastSeenAt: string) => { const l = listing({ lastSeenAt }); return req({ listing: l, profiles: [p], stored: stored({ rights, spec: sp, cand: candidateFor(l) }) }); };
    const fresh = assessEconomics(mk("2026-10-20T09:30:00Z"));
    expect(fresh.kind === "assessed" && fresh.detail?.outcome.assessment).toBeTruthy();
    expect(fresh.kind === "assessed" && fresh.detail?.outcome.validUntil).toBe("2026-10-20T10:30:00.000Z");
    const expired = assessEconomics(mk("2026-10-20T09:00:00Z")); // observasjon + 1 t = nå ⇒ utløpt
    expect(expired.kind === "assessed" && expired.detail?.outcome.assessment).toBeNull();
    expect(expired.budget.status).toBe("not_calculated");
  });
});

// ================================================================== P2-4
describe("P2-4: annonsefelt leses bare etter rettighetskontroll og når forhandlerens egen verdi ikke brukes", () => {
  type Fields = "price" | "firstRegistration" | "curbWeightKg" | "co2";
  function spyListing() {
    const l = listing();
    const reads: Record<Fields, number> = { price: 0, firstRegistration: 0, curbWeightKg: 0, co2: 0 };
    const orig = { price: l.price, firstRegistration: l.specs.firstRegistration, curbWeightKg: l.specs.curbWeightKg, co2: l.specs.co2 };
    Object.defineProperty(l, "price", { get() { reads.price++; return orig.price; }, enumerable: true });
    for (const k of ["firstRegistration", "curbWeightKg", "co2"] as const) Object.defineProperty(l.specs, k, { get() { reads[k]++; return orig[k]; }, enumerable: true });
    return { l, reads };
  }
  const run = (allowed: EconomicsFieldKey[], d: Partial<DealerInputV1> | null) => {
    const { l, reads } = spyListing();
    const dealer = d === null ? null : { input: dealerInput(d), confirmedBy: "u", confirmedAt: NOW.toISOString() };
    const r = toEconomicsInput({ listing: l, spec: specOf(), dealer, profile: null, allowedFields: new Set(allowed), now: NOW.toISOString() });
    return { r, reads };
  };
  const NONE = { propulsion: undefined, taxWeight: undefined, co2: undefined, firstRegistration: undefined } as const;
  it("reviewers tilfelle: bare price-rett og forhandlerens egen registrering ⇒ registreringen leses ikke", () => {
    const { r, reads } = run(["price"], {});
    expect(r.ok).toBe(true);
    expect(reads.firstRegistration).toBe(0);
  });
  it("registrering: leses kun når rett er gitt OG forhandler ikke har egen verdi", () => {
    expect(run(["price"], NONE).reads.firstRegistration).toBe(0);                        // nektet, ingen forhandlerverdi ⇒ ukjent, ikke lest
    expect(run(["price", "registration"], {}).reads.firstRegistration).toBe(0);           // tillatt, men forhandlerens verdi brukes
    expect(run(["price", "registration"], NONE).reads.firstRegistration).toBe(1);         // tillatt og ingen forhandlerverdi ⇒ lest
    expect(run(["price", "registration"], null).reads.firstRegistration).toBe(1);         // uten forhandlerinput
    expect(run(["price"], null).reads.firstRegistration).toBe(0);
  });
  it("vekt og CO₂ (specs): leses kun når specs-rett er gitt og forhandler ikke har egen verdi", () => {
    expect(run(["price"], NONE).reads).toMatchObject({ curbWeightKg: 0, co2: 0 });
    expect(run(["price", "specs"], {}).reads).toMatchObject({ curbWeightKg: 0, co2: 0 });
    const used = run(["price", "specs"], NONE).reads; // tillatt og ingen forhandlerverdi ⇒ lest (flere oppslag per felt: test + bruk, begge etter rettighetskontrollen)
    expect(used.curbWeightKg).toBeGreaterThan(0); expect(used.co2).toBeGreaterThan(0);
    const dealerWeight = run(["price", "specs"], { ...NONE, taxWeight: { kg: 1900, basis: "dealer_entered" } }).reads;
    expect(dealerWeight.curbWeightKg).toBe(0); expect(dealerWeight.co2).toBeGreaterThan(0);
    const dealerCo2 = run(["price", "specs"], { ...NONE, co2: { gramsPerKm: 100, method: "wltp_combined" } }).reads;
    expect(dealerCo2.curbWeightKg).toBeGreaterThan(0); expect(dealerCo2.co2).toBe(0);
  });
  it("pris: leses ikke uten beregningsrett (avvisning før lesing)", () => {
    const { reads } = run(["registration", "specs"], NONE);
    expect(reads.price).toBe(0);
    expect(run(["price"], {}).reads.price).toBe(1);
  });
  it("ingen nektet felt påvirker utdata eller brukte felt (sentineler): uten registration/specs-rett finnes verken registreringsår, vekt eller CO₂ fra annonsen i input eller resultat", () => {
    const s = listing({ specs: { ...listing().specs, curbWeightKg: 4321, co2: { gramsPerKm: 987, testMethod: "NEDC" }, firstRegistration: { precision: "year", year: 1993 } } });
    const r = toEconomicsInput({ listing: s, spec: specOf(), dealer: null, profile: null, allowedFields: new Set<EconomicsFieldKey>(["price"]), now: NOW.toISOString() });
    if (!r.ok) throw new Error(r.reason);
    expect(r.usedListingFields).toEqual(["price"]);
    expect(json(r.input)).not.toMatch(/4321|987|1993/);
    const p = profile({ derivedEconomics: { allow: { price: true, registration: false, specs: false }, display: true } });
    const rights = rightsForSource("synthetic-demo", NOW, [p]);
    const a = assessEconomics(req({ listing: s, profiles: [p], stored: stored({ rights, spec: specOf(), cand: candidateFor(s) }) }));
    expect(a.kind).toBe("assessed");
    expect(json(a)).not.toMatch(/4321|987|1993/);
    if (a.kind === "assessed") { expect(a.rights.usedFields).toEqual(["price"]); expect(a.rights.deniedFields).toEqual(["registration", "specs"]); }
  });
  it("registrering fra annonsen brukes (og regnes som brukt felt) når den er tillatt og forhandler ikke har egen verdi", () => {
    const r = run(["price", "registration"], NONE).r;
    if (!r.ok) throw new Error(r.reason);
    expect(r.usedListingFields).toContain("registration");
    expect(r.input.taxInput.firstRegistration).toEqual({ precision: "month", value: "2023-11" });
  });
});

/**
 * ECON-005c — serverorkestrering: rettighetskontroll før kildefelt brukes (beregning, visning og matching holdt adskilt), firmabundet forhandlerinput, foreldelse,
 * ingen positive budsjettutfall/varsler fra estimat, ingen lagring av avledede resultater. Kjernen kjøres ekte med registerprofilen (alle økonomiflagg false).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { combineAssessment } from "@/domain/search-v2/budget";
import { REGISTERED_PROFILES, SYNTHETIC_RIGHTS_PROFILE, rightsForSource, type ProviderRightsProfile } from "@/domain/provider-rights";
import { assessEconomics, bindingFor, confirmationContextFor, derivedRightsDigest, type EconomicsRequest } from "@/server/search-economics";
import { FIRM_A, FIRM_B, NOW, SEARCH_1, SEARCH_2, candidate, candidateFor, dealerInput, line, listing, specOf, stored } from "./fixtures/economics-005c";
import { MOBILE_SANDBOX_EXAMPLE, profile } from "./fixtures/rights-profiles";

const demo = rightsForSource("synthetic-demo", NOW, REGISTERED_PROFILES);
const prof = (de: { price?: boolean; registration?: boolean; specs?: boolean; display?: boolean }, over: Parameters<typeof profile>[0] = {}): ProviderRightsProfile =>
  profile({ derivedEconomics: { allow: { price: de.price ?? false, registration: de.registration ?? false, specs: de.specs ?? false }, display: de.display ?? false }, ...over });
/** Kandidaten utledes (kanonisk) fra den annonsen som faktisk brukes; stored-standarden er bekreftelsen for samme annonse. */
const req = (over: Partial<EconomicsRequest> = {}): EconomicsRequest => {
  const spec = over.spec ?? specOf();
  const l = over.listing ?? listing();
  // Kilder uten registrert mapping (sandbox-eksempel, ukjent) kan ikke gi kanonisk kandidat; de avvises uansett før paringen (ingen beregningsrett/profil).
  const cand = over.candidate ?? (() => { try { return candidateFor(l); } catch { return candidate(); } })();
  return { dealershipId: FIRM_A, searchId: SEARCH_1, spec, stored: stored({ rights: demo, spec, cand }), profile: null, now: NOW, ...over, listing: l, candidate: cand };
};
const assessed = (a: ReturnType<typeof assessEconomics>) => { if (a.kind !== "assessed") throw new Error(a.kind + ":" + ("reason" in a ? a.reason : "")); return a; };

describe("grunnflyt med syntetisk demoprofil (eneste profil med uttrykkelig rett)", () => {
  it("full forhandlerinput gir et estimat — aldri validated — og budsjettstatus not_calculated (ingen positiv, ikke fullt treff)", () => {
    const a = assessed(assessEconomics(req()));
    expect(a.rights).toMatchObject({ derive: true, display: true, reason: null });
    expect([...a.rights.usedFields].sort()).toEqual(["price"]); // forhandlerens egne verdier erstatter annonsens registrering/vekt/CO₂
    expect(a.dealerInput).toMatchObject({ status: "fresh" });
    expect(a.display.overall).toBe("estimate");
    expect(a.display).toMatchObject({ overall: "estimate", labelKey: "estimate_not_validated", positiveBudgetEligible: false });
    expect(a.detail!.result.status).toBe("estimate");
    expect(a.detail!.outcome.class).toBe("unvalidated");
    expect(a.budget).toMatchObject({ status: "not_calculated", reason: "assessment_not_validated" });
    expect(combineAssessment({ status: "match" } as never, a.budget).isFullHit).toBe(false);
  });
  it("resultatet bruker registerprofilen: alle fire økonomiflagg er false i profilen, og ingenting kan gi validated", () => {
    const a = assessed(assessEconomics(req()));
    const r = a.detail!.result;
    expect(r.status).not.toBe("validated");
    expect(r.estimateReasons).toEqual(expect.arrayContaining(["vat_rules_unapproved", "rounding_unconfirmed", "deduction_rule_unapproved"]));
  });
  it("uten forhandlerinput: tekniske avgiftsinput ukjente ⇒ ikke estimat; annonsens elbil-påstand oppgraderes ikke", () => {
    const a = assessed(assessEconomics(req({ stored: null })));
    expect(a.dealerInput).toEqual({ status: "none" });
    expect(a.detail!.result.status).not.toBe("estimate");
    expect(a.detail!.result.status).not.toBe("validated");
    expect(a.detail!.result.tax.status).toBe("blocked");
    expect(a.budget.status).toBe("not_calculated");
  });
  it("er deterministisk og muterer ikke input; ingenting lagres (samme resultat to ganger, frosne input)", () => {
    const r = req();
    const deepFreeze = <T,>(o: T): T => { if (typeof o === "object" && o !== null) { Object.freeze(o); for (const v of Object.values(o)) deepFreeze(v); } return o; };
    deepFreeze(r);
    const a = assessEconomics(r), b = assessEconomics(r);
    expect(JSON.stringify(a, (_k, v) => (typeof v === "bigint" ? v.toString() : v))).toBe(JSON.stringify(b, (_k, v) => (typeof v === "bigint" ? v.toString() : v)));
  });
});

describe("rettigheter: beregning, visning og matching er adskilt", () => {
  it("ingen beregningsrett for pris ⇒ unavailable(rights_not_granted); ingen annonsetall i utdata", () => {
    const l = listing({ price: { ...listing().price!, stated: { amount: "123457", currency: "NOK" } } });
    for (const p of [prof({ registration: true, specs: true, display: true }), prof({}), MOBILE_SANDBOX_EXAMPLE]) {
      const a = assessEconomics(req({ listing: { ...l, source: p.providerId }, profiles: [p] }));
      expect(a.kind).toBe("unavailable");
      expect(JSON.stringify(a, (_k, v) => (typeof v === "bigint" ? v.toString() : v))).not.toContain("123457");
      if (a.kind === "unavailable") expect(a.budget.status).toBe("not_calculated");
    }
  });
  it.each([
    ["ukjent leverandør", "ukjent-kilde", [] as ProviderRightsProfile[]],
    ["utkast", "synthetic-demo", [prof({ price: true, display: true }, { status: "draft", verifiedBy: null, verifiedAt: null })]],
    ["tilbakekalt", "synthetic-demo", [prof({ price: true, display: true }, { status: "revoked" })]],
    ["utløpt", "synthetic-demo", [prof({ price: true, display: true }, { validUntil: "2026-10-20T10:00:00Z" })]],
    ["ikke begynt", "synthetic-demo", [prof({ price: true, display: true }, { validFrom: "2026-10-21T00:00:00Z" })]],
    ["ugyldig profil", "synthetic-demo", [{ ...prof({ price: true, display: true }), derivedEconomics: { allow: {}, display: true } } as unknown as ProviderRightsProfile]],
  ])("%s ⇒ unavailable", (_n, source, profiles) => {
    const a = assessEconomics(req({ listing: listing({ source }), profiles }));
    expect(a.kind).toBe("unavailable");
  });
  it("matchingrett og visningsrett (felt) gir ikke beregningsrett: full matching/visning, men derivedEconomics = nei ⇒ unavailable", () => {
    const p = profile({ matching: { price: true, registration: true, specs: true }, display: { price: true, registration: true, specs: true } });
    expect(assessEconomics(req({ profiles: [p] })).kind).toBe("unavailable");
  });
  it("beregningsrett uten visningsrett: beregnes (budsjettstatus finnes), men ingen tall forlater orkestreringen", () => {
    const p = prof({ price: true, registration: true, specs: true, display: false });
    const a = assessed(assessEconomics(req({ profiles: [p] })));
    expect(a.rights).toMatchObject({ derive: true, display: false, reason: "display_not_granted" });
    expect(a.display).toEqual({ overall: "unavailable", reason: "rights_not_granted", labelKey: "rights_not_granted", positiveBudgetEligible: false });
    expect(a.detail).toBeNull();
    expect(a.budget.status).toBe("not_calculated");
  });
  it("visningsrett for avledet økonomi, men ikke for prisen som avsløres ⇒ ingen visning", () => {
    const p = prof({ price: true, registration: true, specs: true, display: true }, { display: { price: false } });
    const a = assessed(assessEconomics(req({ profiles: [p] })));
    expect(a.rights).toMatchObject({ derive: true, display: false, reason: "reveal_not_granted" });
    expect(a.detail).toBeNull();
    expect(a.display.overall).toBe("unavailable");
  });
  it("kun pris tillatt: registrering og vekt/CO₂ leses ikke fra annonsen (ukjent) men forhandlerens egne verdier gjelder; brukte felt = [price]", () => {
    const p = prof({ price: true, display: true });
    const spec = specOf();
    const st = stored({ rights: rightsForSource("synthetic-demo", NOW, [p]), spec }); // bekreftet under denne rettighetsprofilen
    const a = assessed(assessEconomics(req({ profiles: [p], stored: st })));
    expect(a.dealerInput.status).toBe("fresh");
    expect(a.rights.usedFields).toEqual(["price"]);
    expect(a.rights.deniedFields).toEqual(["registration", "specs"]);
    expect(a.rights).toMatchObject({ derive: true, display: true });
    expect(a.detail!.result.status).toBe("estimate"); // forhandlerinput dekker teknisk grunnlag
    const noDealer = assessed(assessEconomics(req({ profiles: [p], stored: null })));
    expect(noDealer.detail!.result.status).not.toBe("estimate");
    expect(noDealer.detail!.result.tax.status).toBe("blocked");
  });
  it("rettigheter vurderes ved hvert kall (ingen mellomlagring): utløp mellom to kall lukker", () => {
    const p = prof({ price: true, registration: true, specs: true, display: true }, { validUntil: "2026-10-20T10:30:00Z" });
    expect(assessEconomics(req({ profiles: [p], now: new Date("2026-10-20T10:29:59Z") })).kind).toBe("assessed");
    expect(assessEconomics(req({ profiles: [p], now: new Date("2026-10-20T10:30:00Z") })).kind).toBe("unavailable");
  });
});

describe("forhandlerinput: firma, søk, kandidat og revisjon; ny bekreftelse", () => {
  it("annet firmas input (selv med riktig søk/kandidat) brukes aldri og påvirker ingenting", () => {
    const spec = specOf();
    const foreign = stored({ rights: demo, spec, dealershipId: FIRM_B });
    const a = assessed(assessEconomics(req({ stored: foreign })));
    expect(a.dealerInput).toEqual({ status: "foreign" });
    const none = assessed(assessEconomics(req({ stored: null })));
    expect(JSON.stringify(a.display, (_k, v) => (typeof v === "bigint" ? v.toString() : v))).toBe(JSON.stringify(none.display, (_k, v) => (typeof v === "bigint" ? v.toString() : v)));
  });
  it("klienten kan ikke velge firma: eneste firmakilde er `dealershipId` fra serveren; lagret input med klient-firma avvises av bindingen", () => {
    const spec = specOf();
    const s = stored({ rights: demo, spec, dealershipId: FIRM_B });
    expect(assessEconomics(req({ dealershipId: FIRM_A, stored: s })).kind === "assessed" && (assessEconomics(req({ dealershipId: FIRM_A, stored: s })) as { dealerInput: { status: string } }).dealerInput.status).toBe("foreign");
    expect((assessEconomics(req({ dealershipId: FIRM_B, stored: s })) as { dealerInput: { status: string } }).dealerInput.status).toBe("fresh");
  });
  it.each([["annet søk", { searchId: SEARCH_2 }], ["annen kandidat", { cand: candidate({ id: "13:synthetic-demo/ad-9" }) }]])("%s ⇒ foreign", (_n, over) => {
    const spec = specOf();
    const s = stored({ rights: demo, spec, ...over });
    expect((assessEconomics(req({ stored: s })) as { dealerInput: { status: string } }).dealerInput.status).toBe("foreign");
  });
  it("ny kandidatrevisjon ⇒ stale_needs_reconfirmation og input brukes ikke", () => {
    const spec = specOf();
    const older = candidateFor(listing({ price: { ...listing().price!, stated: { amount: "99999", currency: "NOK" }, amount: { amountMinor: 9_999_900, currency: "NOK" } } })); // samme annonse-id, tidligere innhold
    expect(older.id).toBe(candidate().id); expect(older.version).not.toBe(candidate().version);
    const s = stored({ rights: demo, spec, cand: older });
    const a = assessed(assessEconomics(req({ stored: s })));
    expect(a.dealerInput).toEqual({ status: "stale_needs_reconfirmation", reasons: ["candidate_version_changed"] });
    expect(a.detail!.result.status).not.toBe("estimate");
    expect(a.detail!.result.tax.status).toBe("blocked");
  });
  it("endret kostnadsgrunnlag, scenario eller rettighetsavtrykk ⇒ ny bekreftelse; endret budsjett ⇒ ikke", () => {
    const spec = specOf([line("transport", "transport", 800_000n)]);
    const s = stored({ rights: demo, spec, input: dealerInput({ lineScopes: { transport: "to_border" } }) });
    expect(assessed(assessEconomics(req({ spec, stored: s }))).dealerInput.status).toBe("fresh");
    expect(assessed(assessEconomics(req({ spec: specOf([line("transport", "transport", 900_000n)]), stored: s }))).dealerInput).toMatchObject({ status: "stale_needs_reconfirmation", reasons: ["cost_basis_changed"] });
    expect(assessed(assessEconomics(req({ spec: specOf(spec.budget.costs, "passenger", 5_000_000n), stored: s }))).dealerInput.status).toBe("fresh");
    const other = prof({ price: true, registration: true, specs: true, display: true }, { version: 2, providerId: "synthetic-demo" });
    expect(assessed(assessEconomics(req({ spec, stored: s, profiles: [other] }))).dealerInput).toMatchObject({ status: "stale_needs_reconfirmation", reasons: ["rights_changed"] });
    const vanSpec = specOf(spec.budget.costs, "van");
    const v = assessEconomics(req({ spec: vanSpec, stored: stored({ rights: demo, spec }) }));
    expect(v.kind).toBe("not_calculated");
    if (v.kind === "not_calculated") { expect(v.reason).toBe("scenario_not_supported"); expect(v.dealerInput).toMatchObject({ status: "stale_needs_reconfirmation", reasons: expect.arrayContaining(["scenario_changed"]) }); expect(v.budget.status).toBe("not_calculated"); }
  });
  it("utløpt forhandleroppgitt kurs ⇒ input brukes ikke; gyldig kurs begrenser vurderingens validUntil (P3)", () => {
    const eur = listing({ price: { ...listing().price!, stated: { amount: "10000", currency: "EUR" }, amount: { amountMinor: 1_000_000, currency: "EUR" } } });
    const spec = specOf();
    const fx = (validUntil: string) => dealerInput({ fx: { acquisition: { pair: "EUR/NOK", rate: "11.50", sourceLabel: "Bank X", effectiveAt: "2026-10-19", quotedAt: "2026-10-19", validUntil }, customs: { pair: "EUR/NOK", rate: "11.60", sourceLabel: "Tolletaten", quotedAt: "2026-10-16", validFrom: "2026-10-16", validTo: "2026-10-31" } } });
    const ok = assessed(assessEconomics(req({ listing: eur, stored: stored({ rights: demo, spec, input: fx("2026-10-20"), cand: candidateFor(eur) }) })));
    expect(ok.dealerInput.status).toBe("fresh");
    expect(ok.detail!.outcome.validUntil).toBe("2026-10-21T00:00:00.000Z");
    expect(ok.detail!.outcome.bindingLimit).toBe("dealer_acquisition_fx_validUntil");
    const expired = assessed(assessEconomics(req({ listing: eur, stored: stored({ rights: demo, spec, input: fx("2026-10-19"), cand: candidateFor(eur) }) })));
    expect(expired.dealerInput).toEqual({ status: "stale_needs_reconfirmation", reasons: ["fx_expired"] });
  });
  it("firmaprofil: mva.-håndtering/fradrag fra profilen gjelder når kandidaten ikke oppgir; bekreftet kandidatoverstyring endres ikke av profilen", () => {
    const spec = specOf();
    const s = stored({ rights: demo, spec, input: dealerInput({ deduction: undefined, vatHandling: undefined }) });
    const withProfile = assessed(assessEconomics(req({ stored: s, profile: { schemaVersion: 1, deduction: "recoverable", vatHandling: "registered_reports_in_vat_return" } })));
    expect(withProfile.detail!.result.importVatSettlement.handling.source).toEqual({ kind: "dealer_profile" });
    const override = assessed(assessEconomics(req({ stored: stored({ rights: demo, spec, input: dealerInput({ vatHandling: "not_registered_pays_at_import" }) }), profile: { schemaVersion: 1, vatHandling: "registered_reports_in_vat_return" } })));
    expect(override.detail!.result.importVatSettlement.handling.value).toBe("not_registered_pays_at_import");
  });
  it("binding og kontekst bruker kandidatens id/revisjon, schema 1 og costBasisOf; rettighetsavtrykket endres av versjon og avledede rettigheter men ikke av visningsfelt", () => {
    expect(bindingFor(FIRM_A, SEARCH_1, candidate())).toEqual({ dealershipId: FIRM_A, searchId: SEARCH_1, candidateId: candidate().id, candidateVersion: candidate().version, inputSchemaVersion: 1 });
    const d = (p: ProviderRightsProfile) => derivedRightsDigest(rightsForSource(p.providerId, NOW, [p]));
    const base = prof({ price: true, display: true });
    expect(d(base)).toBe(d(prof({ price: true, display: true }, { display: { title: false } })));
    expect(d(base)).not.toBe(d(prof({ price: true, specs: true, display: true })));
    expect(d(base)).not.toBe(d(prof({ price: true, display: false })));
    expect(d(base)).not.toBe(d(prof({ price: true, display: true }, { version: 2 })));
    expect(confirmationContextFor(specOf(), demo).rightsDigest).toBe(derivedRightsDigest(demo));
  });
});

describe("ingen positive budsjettutfall eller varsler fra estimat, nedre grense eller scenarier", () => {
  const variants: Array<[string, Partial<EconomicsRequest>]> = [
    ["fullt estimat", {}], ["uten forhandlerinput", { stored: null }],
    ["lav pris, høyt budsjett", { listing: listing({ price: { ...listing().price!, stated: { amount: "1000", currency: "NOK" }, amount: { amountMinor: 100_000, currency: "NOK" } } }) }],
    ["bare pris tillatt", { profiles: [prof({ price: true, display: true })] }],
    ["uten visningsrett", { profiles: [prof({ price: true, registration: true, specs: true })] }],
    ["linje med omfang", { spec: specOf([line("transport", "transport", 800_000n)]), stored: stored({ rights: demo, spec: specOf([line("transport", "transport", 800_000n)]), input: dealerInput({ lineScopes: { transport: "to_border" } }) }) }],
    ["ukjent kostnadslinje", { spec: specOf([line("x", "custom", null)]) }],
    ["budsjett 0-nær", { spec: specOf([], "passenger", 1n) }],
    ["uten budsjett", { spec: specOf([], "passenger", null) }],
    ["ikke-NOK uten kurs", { listing: listing({ price: { ...listing().price!, stated: { amount: "10000", currency: "EUR" }, amount: { amountMinor: 1_000_000, currency: "EUR" } } }) }],
    ["prisgrunnlag ukjent (uten belegg)", { listing: listing({ price: { ...listing().price!, basis: "unknown", basisEvidence: null } }) }],
  ];
  it.each(variants)("%s: aldri within_budget/within_deviation, isFullHit false, positiveBudgetEligible false, ingen validated", (_n, over) => {
    const r = req(over);
    const a = assessEconomics(r);
    expect(["within_budget", "within_deviation"]).not.toContain(a.budget.status);
    expect(combineAssessment({ status: "match" } as never, a.budget).isFullHit).toBe(false);
    if (a.kind === "assessed") {
      expect("positiveBudgetEligible" in a.display ? a.display.positiveBudgetEligible : false).toBe(false);
      expect(a.display.overall === "validated").toBe(false);
      if (a.detail) { expect(a.detail.result.status).not.toBe("validated"); expect(a.detail.outcome.class).not.toBe("complete_validated"); expect(a.detail.outcome.assessment === null || a.detail.outcome.class !== "complete_validated").toBe(true); }
    }
  });
});

describe("arkitektur: ingen lagring, ingen konfigurasjon utenfra, ingen Supabase i orkestreringen", () => {
  const src = readFileSync("src/server/search-economics.ts", "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  it("orkestreringen importerer ikke Supabase/pg/fs/nettverk og har ingen skriveoperasjoner", () => {
    expect(src).not.toMatch(/supabase|from\s+"pg"|node:fs|fetch\(|\.insert\(|\.upsert\(|\.delete\(|\.from\(|localStorage|process\.env/);
  });
  it("økonomikonfigurasjonen er en intern, frossen konstant (registerprofilen); forespørselen har ingen config-/profil-overstyring av økonomiflagg", () => {
    expect(src).toMatch(/const ECONOMICS_CONFIG = Object\.freeze\(\{ rounding: UNCONFIRMED_HALF_UP, profile: REGISTRY_ECONOMICS_PROFILE \}\)/);
    expect(src).not.toMatch(/vatRulesApproved|roundingApproved|customsFxRuleApproved|deductionRuleApproved/);
    expect(SYNTHETIC_RIGHTS_PROFILE.derivedEconomics.display).toBe(true);
  });
});

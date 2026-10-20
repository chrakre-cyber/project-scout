/**
 * ECON-005c — ren adapter annonse + søk + forhandleropplysninger → `EconomicsInput`: ingen oppgradering av annonsepåstander, bevart datopresisjon/kildegrunnlag/ukjent,
 * transportomfang og kostnadslinjer uten dobbelttelling (sammen med 005a-mapperen), mva.-/fradragsstandard ukjent, forhandleroppgitte kurser som estimater.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { minorToNokString, toEconomicsInput, type AdapterInput } from "@/adapters/search-economics/to-economics-input";
import { REGISTRY_ECONOMICS_PROFILE, UNCONFIRMED_HALF_UP, calculateEconomics } from "@/domain/economics";
import type { EconomicsFieldKey } from "@/domain/provider-rights";
import { toCostAssessment } from "@/domain/search-economics";
import { NOW, candidate, dealerInput, line, listing, specOf } from "./fixtures/economics-005c";

const ALL = new Set<EconomicsFieldKey>(["price", "registration", "specs"]);
const base = (over: Partial<AdapterInput> = {}): AdapterInput => ({ listing: listing(), spec: specOf(), dealer: null, profile: null, allowedFields: ALL, now: NOW.toISOString(), ...over });
const withDealer = (input = dealerInput(), over: Partial<AdapterInput> = {}) => base({ dealer: { input, confirmedBy: "user-1", confirmedAt: "2026-10-20T09:30:00Z" }, ...over });
const ok = (a: AdapterInput) => { const r = toEconomicsInput(a); if (!r.ok) throw new Error(r.reason); return r; };

describe("avvisning og rettigheter", () => {
  it("bare personbilscenarioet støttes; van og uspesifisert gir ikke beregning", () => {
    for (const s of ["van", "unspecified"] as const) expect(toEconomicsInput(base({ spec: specOf([], s) }))).toEqual({ ok: false, reason: "scenario_not_supported" });
  });
  it("uten beregningsrett for pris leses ingenting; annonse uten pris ⇒ price_missing (ikke 0)", () => {
    expect(toEconomicsInput(base({ allowedFields: new Set<EconomicsFieldKey>(["registration", "specs"]) }))).toEqual({ ok: false, reason: "price_not_allowed" });
    expect(toEconomicsInput(base({ listing: listing({ price: null }) }))).toEqual({ ok: false, reason: "price_missing" });
    expect(toEconomicsInput(base({ now: "ikke-en-dato" }))).toEqual({ ok: false, reason: "invalid_now" });
  });
  it("felt uten beregningsrett leses ikke: registrering/vekt/CO₂ fra annonsen blir ukjent og feltet står ikke i brukte felt", () => {
    const r = ok(base({ allowedFields: new Set<EconomicsFieldKey>(["price"]) }));
    expect(r.usedListingFields).toEqual(["price"]);
    expect(r.input.taxInput.firstRegistration).toEqual({ precision: "unknown", value: null });
    expect(r.input.taxInput.norwegianTaxWeight).toEqual({ kg: null, basis: "unverified" });
    expect(r.input.taxInput.co2).toEqual({ gramsPerKm: null, method: "unspecified" });
    const full = ok(base());
    expect(full.usedListingFields).toEqual(["price", "specs", "registration"]);
  });
  it("forhandlerens egne verdier trenger ikke beregningsrett for annonsefelt (de leses ikke fra annonsen) og overstyrer annonsen", () => {
    const r = ok(withDealer(dealerInput(), { allowedFields: new Set<EconomicsFieldKey>(["price"]) }));
    expect(r.usedListingFields).toEqual(["price"]);
    expect(r.input.taxInput.norwegianTaxWeight).toEqual({ kg: 1976, basis: "vehicle_register" });
    expect(r.input.taxInput.firstRegistration).toEqual({ precision: "month", value: "2023-11" });
    expect(r.input.taxInput.co2).toEqual({ gramsPerKm: 179, method: "wltp_combined" });
  });
});

describe("annonsepåstander oppgraderes aldri", () => {
  it("pris har bevis listing_claim; brutto/netto bare med eksplisitt belegg, ellers ukjent og beløpet brukes ikke som løst grunnlag", () => {
    const net = ok(base()).input.price;
    expect(net).toMatchObject({ currency: "NOK", priceBasis: "net", advertisedNet: "100000", advertisedGross: null, evidence: "listing_claim", use: "advertised" });
    const gross = ok(base({ listing: listing({ price: { ...listing().price!, basis: "gross" } }) })).input.price;
    expect(gross).toMatchObject({ priceBasis: "gross", advertisedGross: "100000", advertisedNet: null });
    const noEvidence = ok(base({ listing: listing({ price: { ...listing().price!, basisEvidence: null } }) }));
    expect(noEvidence.input.price).toMatchObject({ priceBasis: "unknown", advertisedNet: null, advertisedGross: null });
    expect(noEvidence.notes).toContain("price_basis_unknown");
    const unknown = ok(base({ listing: listing({ price: { ...listing().price!, basis: "unknown" } }) }));
    expect(unknown.input.price.priceBasis).toBe("unknown");
  });
  it("annonsens mva.-utsagn (sats, «kan trekkes fra») og selgertype «forhandler» påvirker hverken utenlandsk mva., fradrag eller mva.-håndtering", () => {
    const l = listing({ price: { ...listing().price!, vat: { statedRateBasisPoints: 1900, reclaimableClaim: "claimed", evidence: ["MwSt. ausweisbar"], origin: "listing_text" } }, seller: { type: "dealer", countryCode: "DE", city: null } });
    const r = ok(base({ listing: l }));
    expect(r.input.price.foreignVat).toBeUndefined();
    expect(r.input.deduction).toBeNull();
    expect(r.input.vatHandling).toBeNull();
    expect(JSON.stringify(r.input)).not.toContain("ausweisbar");
  });
  it("utenlandsk mva. kommer bare fra forhandler med bevis", () => {
    expect(ok(withDealer()).input.price.foreignVat).toEqual({ treatment: "excluded_documented", evidence: "invoice_or_contract" });
    expect(ok(withDealer(dealerInput({ foreignVat: undefined }))).input.price.foreignVat).toBeUndefined();
  });
  it("uten forhandlergrunnlag er drivlinjen ukjent med listing_claim — annonsens drivstoff (elektrisk) brukes ikke", () => {
    const r = ok(base());
    expect(r.input.taxInput.propulsion).toEqual({ pistonCombustionEngine: null, externallyChargeable: null, combustionFuel: null, hybridization: null, evidence: "listing_claim" });
    expect(r.notes).toContain("propulsion_unknown_no_dealer_basis");
    expect(JSON.stringify(r.input.taxInput)).not.toMatch(/electric|bev/i);
    const withLp = calculateEconomics(r.input, { rounding: UNCONFIRMED_HALF_UP, profile: REGISTRY_ECONOMICS_PROFILE });
    expect(["blocked", "incomplete"]).toContain(withLp.status);
    expect(withLp.tax.status).toBe("blocked");
  });
  it("annonsevekt er reference_listing og annonse-CO₂ får metode «unspecified» (aldri «wltp_combined»); NEDC bevares som nedc", () => {
    const r = ok(base());
    expect(r.input.taxInput.norwegianTaxWeight).toEqual({ kg: 1976, basis: "reference_listing" });
    expect(r.input.taxInput.co2).toEqual({ gramsPerKm: 179, method: "unspecified" });
    const nedc = ok(base({ listing: listing({ specs: { ...listing().specs, co2: { gramsPerKm: 150, testMethod: "NEDC" } } }) }));
    expect(nedc.input.taxInput.co2).toEqual({ gramsPerKm: 150, method: "nedc" });
  });
  it("datopresisjon fra annonsen bevares (dag/måned/år) og ukjent forblir ukjent — ingen oppdiktet måned/dag", () => {
    const fr = (f: Parameters<typeof listing>[0]) => ok(base({ listing: listing(f) })).input.taxInput.firstRegistration;
    const s = listing().specs;
    expect(fr({ specs: { ...s, firstRegistration: { precision: "date", year: 2023, month: 5, day: 7 } } })).toEqual({ precision: "day", value: "2023-05-07" });
    expect(fr({ specs: { ...s, firstRegistration: { precision: "month", year: 2023, month: 5 } } })).toEqual({ precision: "month", value: "2023-05" });
    expect(fr({ specs: { ...s, firstRegistration: { precision: "year", year: 2023 } } })).toEqual({ precision: "year", value: "2023" });
    expect(fr({ specs: { ...s, firstRegistration: null } })).toEqual({ precision: "unknown", value: null });
  });
  it("norsk registreringsdato uten forhandlerinput er standard = beregningsdato og merkes defaulted; forhandlerens dato bevarer type", () => {
    const d = ok(base());
    expect(d.input.taxInput.norwegianRegistration).toEqual({ date: "2026-10-20", kind: "expected", defaulted: true });
    expect(d.notes).toContain("norwegian_registration_defaulted_to_as_of");
    expect(ok(withDealer()).input.taxInput.norwegianRegistration).toEqual({ date: "2026-10-30", kind: "expected" });
    expect(ok(withDealer(dealerInput({ norwegianRegistration: { date: "2026-10-25", kind: "actual" } }))).input.taxInput.norwegianRegistration).toEqual({ date: "2026-10-25", kind: "actual" });
  });
});

describe("ukjent forblir ukjent (aldri 0 og aldri produktantakelse)", () => {
  it("uten forhandlerinput: alle kostnadskomponenter ukjente, akseptdato ukjent, kurser mangler, mva./fradrag null", () => {
    const i = ok(base()).input;
    expect(i).toMatchObject({ transportToBorder: "unknown", insurance: "unknown", transportAfterBorder: { state: "unknown" }, loadingHandling: { state: "unknown" }, customsDate: { date: null, kind: "unknown" }, deduction: null, vatHandling: null, fx: {} });
    expect(i.charges).toEqual({ climateGas: { state: "unknown" }, registrationFee: { state: "unknown" } });
  });
  it("transportstandard (8 000) settes aldri av adapteren", () => {
    expect(JSON.stringify(ok(base()).input)).not.toContain("8000");
  });
  it("ikke innsamlede poster (provisjon, betalingskostnader, importavgifter, øvrige kostnader, EV-kvalifikasjon, tollavgift) utelates og listes", () => {
    const r = ok(withDealer());
    for (const k of ["commission", "paymentCosts", "evQualification"] as const) expect(r.input[k]).toBeUndefined();
    expect(r.input.charges).not.toHaveProperty("customsDuty");
    expect(r.notes).toEqual(expect.arrayContaining(["commission_not_collected", "payment_costs_not_collected", "import_levies_not_collected", "other_costs_not_collected", "ev_qualification_not_collected", "customs_duty_not_collected"]));
  });
  it("0 forekommer bare når forhandleren har oppgitt 0", () => {
    const i = ok(withDealer(dealerInput({ insurance: { amount: "0" } }))).input;
    expect(i.insurance).toEqual({ amount: "0", basis: "dealer_entered" });
    expect(ok(withDealer(dealerInput({ insurance: undefined }))).input.insurance).toBe("unknown");
  });
});

describe("mva.-håndtering og fradragsstatus: kandidat > firmaprofil > ukjent", () => {
  it("firmaprofil gjelder når kandidaten ikke oppgir; kandidatoverstyring vinner; eksplisitt unknown bevares som unknown", () => {
    const profile = { schemaVersion: 1 as const, vatHandling: "not_registered_pays_at_import" as const, deduction: "recoverable" as const };
    const p = ok(base({ profile })).input;
    expect(p.vatHandling).toEqual({ value: "not_registered_pays_at_import", source: { kind: "dealer_profile" } });
    expect(p.deduction).toEqual({ value: "recoverable", source: { kind: "dealer_profile" } });
    const c = ok(withDealer(dealerInput({ deduction: "non_recoverable", vatHandling: "registered_reports_in_vat_return" }), { profile })).input;
    expect(c.deduction).toEqual({ value: "non_recoverable", source: { kind: "dealer_entered", by: "user-1", at: "2026-10-20T09:30:00Z" } });
    expect(c.vatHandling?.value).toBe("registered_reports_in_vat_return");
    const u = ok(withDealer(dealerInput({ deduction: "unknown", vatHandling: "unknown" }), { profile })).input;
    expect(u.deduction?.value).toBe("unknown");
    expect(u.vatHandling?.value).toBe("unknown");
    const none = ok(base({ profile: { schemaVersion: 1 } }));
    expect(none.input.deduction).toBeNull();
    expect(none.notes).toEqual(expect.arrayContaining(["deduction_status_unknown", "vat_handling_unknown"]));
  });
});

describe("forhandleroppgitte kurser beholder kilde, dato og estimatstatus", () => {
  const eur = listing({ price: { ...listing().price!, stated: { amount: "10000", currency: "EUR" }, amount: { amountMinor: 1_000_000, currency: "EUR" } } });
  const fxInput = dealerInput({ fx: {
    acquisition: { pair: "EUR/NOK", rate: "11.50", sourceLabel: "Bank X (manuelt notert)", effectiveAt: "2026-10-19", quotedAt: "2026-10-19", validUntil: "2026-10-20" },
    customs: { pair: "EUR/NOK", rate: "11.60", sourceLabel: "Tolletaten, manuelt notert", quotedAt: "2026-10-16", validFrom: "2026-10-16", validTo: "2026-10-31" },
  } });
  it("kursene mappes som dealer_entered med oppgitt kilde, datoer og gyldighet", () => {
    const fx = ok(withDealer(fxInput, { listing: eur })).input.fx;
    expect(fx.acquisition).toEqual({ pair: "EUR/NOK", rate: "11.50", source: { kind: "dealer_entered", ref: "Bank X (manuelt notert)" }, effectiveAt: "2026-10-19", quotedAt: "2026-10-19", validUntil: "2026-10-20" });
    expect(fx.customs).toEqual({ pair: "EUR/NOK", rate: "11.60", source: { kind: "dealer_entered", ref: "Tolletaten, manuelt notert" }, effectiveAt: null, quotedAt: "2026-10-16", validFrom: "2026-10-16", validTo: "2026-10-31" });
    expect(fx.customs).not.toHaveProperty("fixtureOnly");
  });
  it("EUR uten forhandlerkurs ⇒ kjernen kan ikke regne kjøpesummen (aldri en antatt kurs); med kurs ⇒ aldri validated, estimatårsaker bevart", () => {
    const missing = calculateEconomics(ok(withDealer(dealerInput(), { listing: eur })).input, { rounding: UNCONFIRMED_HALF_UP, profile: REGISTRY_ECONOMICS_PROFILE });
    expect(missing.acquisition.acquisitionUsedNok).toBeNull();
    expect(missing.status).not.toBe("validated");
    const withFx = calculateEconomics(ok(withDealer(fxInput, { listing: eur })).input, { rounding: UNCONFIRMED_HALF_UP, profile: REGISTRY_ECONOMICS_PROFILE });
    expect(withFx.status).not.toBe("validated");
    expect(withFx.fx.acquisition.source).toEqual({ kind: "dealer_entered", ref: "Bank X (manuelt notert)" });
    expect(withFx.fx.acquisition.status).toBe("used");
  });
});

describe("transportomfang og kostnadslinjer: bevart, ingen dobbelttelling (sammen med 005a)", () => {
  const costs = [line("transport", "transport", 800_000n), line("ins", "insurance", 0n), line("prep", "custom", 250_000n), line("unk", "travel", null), line("off", "custom", 1_000n, { includedInBudget: false })];
  const spec = specOf(costs);
  const run = (a: AdapterInput) => {
    const ad = ok(a);
    const result = calculateEconomics(ad.input, { rounding: UNCONFIRMED_HALF_UP, profile: REGISTRY_ECONOMICS_PROFILE });
    const outcome = toCostAssessment({ result, spec: a.spec, candidate: candidate(), now: a.now, profileRef: "x@y", rightsLimit: { label: "rights_profile", untilExclusive: null }, sourceDataLimit: { label: "source", untilExclusive: null }, lineScopes: ad.lineScopes });
    return { ad, result, outcome };
  };
  it("ubekreftet omfang (standard): linjene mappes ikke til komponentene; transport/forsikring telles som kostnad av ukjent omfang bare når komponentene er ukjente", () => {
    const { ad, outcome } = run(withDealer(dealerInput({ transportToBorder: undefined, insurance: undefined }), { spec }));
    expect(ad.input.transportToBorder).toBe("unknown");
    expect(ad.input.insurance).toBe("unknown");
    expect(Object.fromEntries(outcome.lines.map((l) => [l.id, l.treatment]))).toEqual({ transport: "unmapped_unknown_scope", ins: "unmapped_unknown_scope", prep: "added_to_total", unk: "unknown_amount", off: "not_included" });
    expect(outcome.lines.find((l) => l.id === "transport")).toMatchObject({ counted: true, reason: "scope_unconfirmed" });
  });
  it("ubekreftet omfang + forhandlerens egen transportkomponent: linjen telles IKKE på nytt (mulig overlapp) men forblir uavklart", () => {
    const { outcome } = run(withDealer(dealerInput({ transportToBorder: { amount: "8000" } }), { spec }));
    expect(outcome.lines.find((l) => l.id === "transport")).toMatchObject({ treatment: "unmapped_unknown_scope", counted: false, reason: "scope_unconfirmed_possible_overlap" });
    expect(outcome.class).not.toBe("complete_validated");
  });
  it("bekreftet to_border: linjens eksakte beløp blir komponenten (8 000 NOK) og linjen telles én gang (mapped_to_input)", () => {
    const { ad, outcome, result } = run(withDealer(dealerInput({ transportToBorder: undefined, insurance: undefined, lineScopes: { transport: "to_border", ins: "to_border" } }), { spec }));
    expect(ad.input.transportToBorder).toEqual({ amount: "8000", basis: "dealer_entered" });
    expect(ad.input.insurance).toEqual({ amount: "0", basis: "dealer_entered" });
    expect(result.transportToBorderNok).toBe(8000n);
    expect(outcome.lines.find((l) => l.id === "transport")).toMatchObject({ treatment: "mapped_to_input", counted: false });
    expect(outcome.lines.find((l) => l.id === "ins")).toMatchObject({ treatment: "mapped_to_input", counted: false });
  });
  it("bekreftet split: delbeløpene mapper til hver sin komponent (øre bevart i strengen, hele NOK i kjernen)", () => {
    const sp = specOf([line("transport", "transport", 1_000_049n)]);
    const { ad, outcome, result } = run(withDealer(dealerInput({ transportToBorder: undefined, transportAfterBorder: undefined, lineScopes: { transport: { split: { toBorderMinor: "800049", afterBorderMinor: "200000" } } } }), { spec: sp }));
    expect(ad.input.transportToBorder).toEqual({ amount: "8000.49", basis: "dealer_entered" });
    expect(ad.input.transportAfterBorder).toEqual({ amount: "2000", basis: "dealer_entered" });
    expect([result.transportToBorderNok, result.transportAfterBorderNok]).toEqual([8000n, 2000n]);
    expect(outcome.lines[0]).toMatchObject({ treatment: "mapped_to_input", counted: false });
  });
  it("bekreftet omfang med feil totalsum, ugyldig linjetype eller motstridende forhandlerkomponent ⇒ uavklart (aldri dekket)", () => {
    const sp = specOf([line("transport", "transport", 1_000_000n)]);
    expect(run(withDealer(dealerInput({ transportToBorder: undefined, lineScopes: { transport: { split: { toBorderMinor: "800000", afterBorderMinor: "100000" } } } }), { spec: sp })).outcome.lines[0]).toMatchObject({ treatment: "unsupported", reason: "split_sum_mismatch" });
    expect(run(withDealer(dealerInput({ lineScopes: { ins: "after_border" } }), { spec })).outcome.lines.find((l) => l.id === "ins")).toMatchObject({ treatment: "unsupported", reason: "scope_not_valid_for_kind" });
    // forhandler oppgir 7 000 mens bekreftet linje er 8 000 ⇒ komponenten (7 000) dekker ikke linjen
    expect(run(withDealer(dealerInput({ transportToBorder: { amount: "7000" }, lineScopes: { transport: "to_border" } }), { spec })).outcome.lines.find((l) => l.id === "transport")).toMatchObject({ treatment: "unsupported", reason: "mapped_component_missing" });
  });
  it("linjer med mva.-grunnlag excl/ukjent eller ikke-NOK mappes ikke til økonomiinput", () => {
    for (const over of [{ vatBasis: "excl" as const }, { vatBasis: null }, { currency: "EUR" as const }]) {
      const sp = specOf([line("transport", "transport", 800_000n, over)]);
      const { ad, outcome } = run(withDealer(dealerInput({ transportToBorder: undefined, lineScopes: { transport: "to_border" } }), { spec: sp }));
      expect(ad.input.transportToBorder).toBe("unknown");
      expect(outcome.lines[0]!.treatment).toBe("unsupported");
    }
  });
  it("linje som ikke er inkludert i budsjettet mappes ikke; omfang for ukjent linje-id ignoreres med merknad", () => {
    const sp = specOf([line("transport", "transport", 800_000n, { includedInBudget: false })]);
    const r = ok(withDealer(dealerInput({ transportToBorder: undefined, lineScopes: { transport: "to_border", ghost: "to_border" } }), { spec: sp }));
    expect(r.input.transportToBorder).toBe("unknown");
    expect(r.lineScopes).toEqual({ transport: "to_border" });
    expect(r.notes).toContain("line_scope_for_unknown_line_ignored");
  });
  it("alle inkluderte linjer får nøyaktig én behandling (antall inn = antall ut), og ingen linje blir 0 uten å være oppgitt 0", () => {
    const { outcome } = run(withDealer(dealerInput({ lineScopes: { transport: "to_border" } }), { spec }));
    expect(outcome.lines.map((l) => l.id)).toEqual(costs.map((c) => c.id));
    expect(outcome.lines.find((l) => l.id === "unk")).toMatchObject({ treatment: "unknown_amount", amountMinor: null });
  });
  it("minorToNokString", () => {
    expect([0n, 99n, 100n, 800_049n, 1_000_000n].map(minorToNokString)).toEqual(["0", "0.99", "1", "8000.49", "10000"]);
  });
});

describe("renhet: adapteren har ingen I/O, klokke eller flyttall", () => {
  const src = readFileSync("src/adapters/search-economics/to-economics-input.ts", "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  it("ingen Date.now/new Date()/Math/parseFloat/Number()/toFixed og ingen importer utenfor @/domain og relative filer", () => {
    expect(src).not.toMatch(/Date\.now\(|new Date\(\)|Math\.|parseFloat|\bNumber\(|toFixed|fetch\(|process\.env|require\(/);
    for (const m of src.matchAll(/from\s+"([^"]+)"/g)) expect(m[1], m[1]).toMatch(/^@\/domain\/|^@\/domain$|^\.\//);
  });
});

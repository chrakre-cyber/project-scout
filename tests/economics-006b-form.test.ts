/**
 * ECON-006b — skjemamodellen (ren): skjemaverdier → forhandlerinput-JSON. Prinsipper som testes: tomt = utelatt (ukjent), aldri 0; faktisk skrevet 0 bevares; ingen valg kan uttrykke
 * annonsepåstand som grunnlag; firma/søk/kandidat kan ikke komme inn i opplysningene; presisjon må stemme med verdi; fordeling summerer nøyaktig; tall normaliseres uten flyttall.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildDealerInputFromForm, dealerInputToFormValues, fieldForIssuePath, nokToMinor, normalizeDecimal, parseDealerInput, type DealerInputV1, type FormCostLine, type FormValues,
} from "@/domain/search-economics";
import { dealerInput } from "./fixtures/economics-005c";

const LINES: FormCostLine[] = [
  { id: "freight", kind: "transport", amountMinor: 1_200_000n }, { id: "ins", kind: "insurance", amountMinor: 300_000n }, { id: "fee", kind: "approval", amountMinor: 50_000n },
  { id: "noamt", kind: "transport", amountMinor: null },
];
const build = (v: FormValues, lines: FormCostLine[] = LINES) => buildDealerInputFromForm(v, lines);
const errs = (v: FormValues, lines?: FormCostLine[]) => build(v, lines).errors;

describe("tomt skjema og ukjent", () => {
  it("helt tomt skjema ⇒ bare skjemaversjon; ingenting er 0, ingen grunnlag er satt; parseren godtar", () => {
    const r = build({});
    expect(r.errors).toEqual({});
    expect(r.raw).toEqual({ schemaVersion: 1 });
    expect(parseDealerInput(r.raw).ok).toBe(true);
  });
  it("mellomrom og tomme strenger regnes som ikke oppgitt (ikke 0)", () => {
    const r = build({ tb_amount: "  ", ins_amount: "", tw_kg: " ", co2_g: "", ta_mode: "", rf_mode: " ", deduction: "", vatHandling: "" });
    expect(r.errors).toEqual({});
    expect(r.raw).toEqual({ schemaVersion: 1 });
  });
  it("faktisk skrevet 0 er et oppgitt nullbeløp og bevares, men tomt er det ikke", () => {
    const r = build({ tb_amount: "0", ins_amount: "", rf_mode: "amount", rf_amount: "0" });
    expect(r.errors).toEqual({});
    expect(r.raw.transportToBorder).toEqual({ amount: "0" });
    expect("insurance" in r.raw).toBe(false);
    expect(r.raw.registrationFee).toEqual({ amount: "0" });
  });
  it("valg 'Ukjent' for drivlinje gir null (ikke false), og kan ikke lagres uten grunnlag", () => {
    const r = build({ prop_fuel: "diesel", prop_basis: "dealer_entered" });
    expect(r.raw.propulsion).toMatchObject({ pistonCombustionEngine: null, externallyChargeable: null, combustionFuel: "diesel", hybridization: null });
    expect(errs({ prop_fuel: "diesel" })).toEqual({ prop_basis: "required" });
  });
});

describe("tall normaliseres uten flyttall", () => {
  it.each([["8 000,50", "8000.50"], ["8000", "8000"], ["8 000", "8000"], ["10,6709", "10.6709"], [" 0,5 ", "0.5"]])("«%s» ⇒ %s", (i, o) => expect(normalizeDecimal(i)).toBe(o));
  it.each([["8000,50", "800050"], ["0", "0"], ["0,5", "50"], ["1 000", "100000"], ["12,05", "1205"]])("NOK «%s» ⇒ %s øre (eksakt)", (i, o) => expect(nokToMinor(i)).toBe(o));
  it.each(["", "abc", "1,234", "-1", "1e3", "1.2.3", "٣", "1,", ",5"])("ugyldig NOK-beløp «%s» ⇒ null", (i) => expect(nokToMinor(i)).toBeNull());
  it.each(["abc", "8000.123", "-5", "1e3", "1,2,3", "１２", "1000000000000"])("ugyldig beløp «%s» avvises i skjemaet", (x) => expect(errs({ tb_amount: x }).tb_amount).toBe("invalid_amount"));
  it("komma i beløp godtas", () => expect(build({ tb_amount: "8000,5" }).raw.transportToBorder).toEqual({ amount: "8000.5" }));
});

describe("grunnlag kan ikke være annonsepåstand; uforståelige valg avvises", () => {
  it.each([["prop_basis", "listing_claim"], ["tw_basis", "listing_claim"], ["fr_basis", "listing_claim"], ["fv_evidence", "listing_claim"], ["co2_method", "listing_claim"]])("%s = %s avvises", (k, v) => {
    const base: FormValues = { prop_basis: "dealer_entered", tw_kg: "1500", tw_basis: "dealer_entered", co2_g: "100", co2_method: "wltp_combined", fr_precision: "year", fr_value: "2023", fr_basis: "dealer_entered", fv_treatment: "excluded_documented", fv_evidence: "invoice_or_contract", prop_piston: "yes" };
    expect(errs({ ...base, [k]: v })[k]).toBe("invalid_value");
  });
  it("det finnes ingen verdi 'listing_claim' i noe skjemavalg", () => {
    const src = readFileSync("src/lib/search-labels.ts", "utf8");
    const section = src.slice(src.indexOf("ECON-006b: forhandlerskjema"));
    expect(section).not.toContain("listing_claim");
  });
  it("kontrollerte hvitelister: ukjente verdier i alle valgfelt avvises", () => {
    for (const [k, v] of [["prop_piston", "maybe"], ["prop_fuel", "hydrogen"], ["prop_hybrid", "full"], ["nr_kind", "planned"], ["cd_kind", "guess"], ["fv_treatment", "claimed"], ["deduction", "yes"], ["vatHandling", "other"]] as const) {
      expect(errs({ prop_basis: "dealer_entered", nr_date: "2026-10-30", cd_date: "2026-10-20", fv_evidence: "dealer_entered", [k]: v })[k], k).toBe("invalid_value");
    }
  });
  it("ekstra nøkler (firma, søk, kandidat, revisjon, vilkårlige) kommer aldri inn i opplysningene", () => {
    const r = build({ tb_amount: "8000", dealershipId: "x", dealership_id: "y", firmId: "z", searchId: "s", candidateId: "c", candidateVersion: "v", confirm: "yes", __proto__x: "1", lineScopes: "{}", schemaVersion: "9" } as FormValues);
    expect(r.errors).toEqual({});
    expect(Object.keys(r.raw).sort()).toEqual(["schemaVersion", "transportToBorder"]);
    expect(r.raw.schemaVersion).toBe(1);
  });
});

describe("grupper: påkrevde sammenhenger", () => {
  it("vekt: kg og grunnlag hører sammen; kg må være positivt heltall", () => {
    expect(errs({ tw_kg: "1976" })).toEqual({ tw_basis: "required" });
    expect(errs({ tw_basis: "dealer_entered" })).toEqual({ tw_kg: "required" });
    for (const k of ["0", "1.5", "abc", "100000", "-3"]) expect(errs({ tw_kg: k, tw_basis: "dealer_entered" }).tw_kg, k).toBe("invalid_integer");
    expect(build({ tw_kg: "1976", tw_basis: "vehicle_register" }).raw.taxWeight).toEqual({ kg: 1976, basis: "vehicle_register" });
  });
  it("CO₂: 0 er et gyldig oppgitt tall (elbil), tomt er ikke 0; metode påkrevd", () => {
    expect(build({ co2_g: "0", co2_method: "wltp_combined" }).raw.co2).toEqual({ gramsPerKm: 0, method: "wltp_combined" });
    expect(errs({ co2_g: "179" })).toEqual({ co2_method: "required" });
    expect(errs({ co2_method: "wltp_combined" })).toEqual({ co2_g: "required" });
    expect(errs({ co2_g: "12.5", co2_method: "nedc" }).co2_g).toBe("invalid_integer");
  });
  it("første registrering: presisjonen må stemme med verdien (ingen oppdiktet dag/måned)", () => {
    expect(errs({ fr_precision: "month", fr_value: "2023-11-05", fr_basis: "vehicle_register" }).fr_value).toBe("invalid_date");
    expect(errs({ fr_precision: "day", fr_value: "2023-11", fr_basis: "vehicle_register" }).fr_value).toBe("invalid_date");
    expect(errs({ fr_precision: "year", fr_value: "23", fr_basis: "vehicle_register" }).fr_value).toBe("invalid_date");
    expect(errs({ fr_precision: "month", fr_value: "", fr_basis: "vehicle_register" }).fr_value).toBe("required");
    expect(errs({ fr_precision: "unknown", fr_value: "2023" }).fr_value).toBe("must_be_empty");
    expect(errs({ fr_precision: "month", fr_value: "2023-11" }).fr_basis).toBe("required");
    expect(errs({ fr_value: "2023-11" }).fr_precision).toBe("required");
    expect(build({ fr_precision: "month", fr_value: "2023-11", fr_basis: "type_approval" }).raw.firstRegistration).toEqual({ precision: "month", value: "2023-11", basis: "type_approval" });
  });
  it("første registrering 'ukjent' får laveste grunnlag (oppgitt av forhandler), aldri register/typegodkjenning", () => {
    expect(build({ fr_precision: "unknown" }).raw.firstRegistration).toEqual({ precision: "unknown", value: null, basis: "dealer_entered" });
    expect(build({ fr_precision: "none", fr_basis: "type_approval" }).raw.firstRegistration).toEqual({ precision: "none", value: null, basis: "dealer_entered" });
  });
  it("tolldato: ukjent skal ikke ha dato; forventet/faktisk må ha dato", () => {
    expect(errs({ cd_kind: "unknown", cd_date: "2026-10-20" }).cd_date).toBe("must_be_empty");
    expect(errs({ cd_kind: "expected_scenario" }).cd_date).toBe("required");
    expect(errs({ cd_date: "2026-10-20" }).cd_kind).toBe("required");
    expect(build({ cd_kind: "unknown" }).raw.customsDate).toEqual({ date: null, kind: "unknown" });
  });
  it("utenlandsk mva.: dokumentert krever dokumentasjonstype; ikke bekreftet får aldri dokumentasjon", () => {
    expect(errs({ fv_treatment: "excluded_documented" }).fv_evidence).toBe("required");
    expect(build({ fv_treatment: "unconfirmed", fv_evidence: "invoice_or_contract" }).raw.foreignVat).toEqual({ treatment: "unconfirmed", evidence: "dealer_entered" });
    expect(build({ fv_treatment: "excluded_documented", fv_evidence: "invoice_or_contract" }).raw.foreignVat).toEqual({ treatment: "excluded_documented", evidence: "invoice_or_contract" });
  });
  it("kurs: kilde, dato og kurs er påkrevd; kurs 0 avvises; rollene har ulike gyldighetsfelt", () => {
    expect(Object.keys(errs({ fxA_rate: "10,67" })).sort()).toEqual(["fxA_pair", "fxA_quotedAt", "fxA_source"]);
    expect(errs({ fxA_pair: "EUR/NOK", fxA_rate: "0", fxA_source: "bank", fxA_quotedAt: "2026-10-19" }).fxA_rate).toBe("invalid_rate");
    expect(errs({ fxA_pair: "EUR", fxA_rate: "10,5", fxA_source: "bank", fxA_quotedAt: "2026-10-19" }).fxA_pair).toBe("invalid_value");
    expect(errs({ fxA_pair: "EUR/NOK", fxA_rate: "10,5", fxA_source: "bank", fxA_quotedAt: "19.10.2026" }).fxA_quotedAt).toBe("invalid_date");
    const r = build({ fxA_pair: "EUR/NOK", fxA_rate: "10,6709", fxA_source: "Bank X", fxA_quotedAt: "2026-10-19", fxA_validUntil: "2026-11-11", fxC_pair: "EUR/NOK", fxC_rate: "10,7", fxC_source: "Tolletaten", fxC_quotedAt: "2026-10-15", fxC_validFrom: "2026-10-15", fxC_validTo: "2026-11-11" });
    expect(r.errors).toEqual({});
    expect(r.raw.fx).toEqual({
      acquisition: { pair: "EUR/NOK", rate: "10.6709", sourceLabel: "Bank X", quotedAt: "2026-10-19", validUntil: "2026-11-11" },
      customs: { pair: "EUR/NOK", rate: "10.7", sourceLabel: "Tolletaten", quotedAt: "2026-10-15", validFrom: "2026-10-15", validTo: "2026-11-11" },
    });
    expect(parseDealerInput(r.raw).ok).toBe(true);
  });
  it("kostnader: beløp / ikke relevant (begrunnet) / ikke oppgitt; ingen blanding", () => {
    expect(build({ ta_mode: "not_applicable", ta_note: "ingen etterfølgende transport" }).raw.transportAfterBorder).toEqual({ state: "not_applicable", basis: "ingen etterfølgende transport" });
    expect(errs({ ta_mode: "not_applicable" }).ta_note).toBe("required");
    expect(errs({ ta_mode: "amount" }).ta_amount).toBe("required");
    expect(errs({ ta_mode: "amount", ta_amount: "5", ta_note: "x" }).ta_note).toBe("must_be_empty");
    expect(errs({ ta_mode: "not_applicable", ta_note: "x", ta_amount: "5" }).ta_amount).toBe("must_be_empty");
    expect(errs({ ta_amount: "500" }).ta_mode).toBe("choose_one");
    expect(errs({ lh_mode: "weird" }).lh_mode).toBe("invalid_value");
    expect(errs({ cg_mode: "not_applicable", cg_note: "x".repeat(101) }).cg_note).toBe("too_long");
    expect(errs({ rf_mode: "not_applicable", rf_note: "ny\nlinje" }).rf_note).toBe("too_long");
  });
});

describe("kostnadslinjer i søket: omfang og fordeling", () => {
  it("transport: til/etter/fordelt; forsikring: til/annet; andre linjer og ukjente linjer ignoreres", () => {
    const r = build({ scope_freight: "to_border", scope_ins: "other", scope_fee: "to_border", scope_ghost: "to_border" });
    expect(r.errors).toEqual({});
    expect(r.raw.lineScopes).toEqual({ freight: "to_border", ins: "other" });
  });
  it("forsikring kan ikke være 'etter innførselsstedet' eller 'fordelt'; transport kan ikke være 'annet'", () => {
    expect(errs({ scope_ins: "after_border" }).scope_ins).toBe("invalid_value");
    expect(errs({ scope_ins: "split" }).scope_ins).toBe("invalid_value");
    expect(errs({ scope_freight: "other" }).scope_freight).toBe("invalid_value");
  });
  it("fordeling må summere nøyaktig til linjens beløp (øre eksakt)", () => {
    const ok = build({ scope_freight: "split", scopeTo_freight: "10 000", scopeAfter_freight: "2000" });
    expect(ok.errors).toEqual({});
    expect(ok.raw.lineScopes).toEqual({ freight: { split: { toBorderMinor: "1000000", afterBorderMinor: "200000" } } });
    expect(errs({ scope_freight: "split", scopeTo_freight: "10 000,01", scopeAfter_freight: "2000" }).scopeTo_freight).toBe("split_mismatch");
    expect(errs({ scope_freight: "split", scopeTo_freight: "10 000", scopeAfter_freight: "1999,99" }).scopeTo_freight).toBe("split_mismatch");
    expect(errs({ scope_freight: "split", scopeTo_freight: "", scopeAfter_freight: "x" })).toEqual({ scopeTo_freight: "required", scopeAfter_freight: "invalid_amount" });
    expect(errs({ scope_noamt: "split", scopeTo_noamt: "1", scopeAfter_noamt: "1" }).scopeTo_noamt).toBe("split_mismatch");
  });
  it("ubekreftet er standard og utelates", () => {
    expect(build({ scope_freight: "unconfirmed" }).raw.lineScopes).toBeUndefined();
    expect(build({}).raw.lineScopes).toBeUndefined();
  });
});

describe("rundtur og parser som bakstopp", () => {
  const full: DealerInputV1 = dealerInput({
    fx: { acquisition: { pair: "EUR/NOK", rate: "10.6709", sourceLabel: "Bank X", quotedAt: "2026-10-19", validUntil: "2026-11-11" }, customs: { pair: "EUR/NOK", rate: "10.7", sourceLabel: "Tolletaten", quotedAt: "2026-10-15", validFrom: "2026-10-15", validTo: "2026-11-11" } },
    transportAfterBorder: { amount: "1500.50" }, loadingHandling: { state: "not_applicable", basis: "ingen" }, climateGas: { amount: "0" }, registrationFee: { amount: "3000" },
    lineScopes: { freight: { split: { toBorderMinor: "1000000", afterBorderMinor: "200000" } }, ins: "to_border" }, evidenceRef: "tilbud 123", deduction: "recoverable", vatHandling: "unknown",
  });
  it("lagret input → skjemaverdier → ny input er identisk (ingen verdi skapes, mistes eller blir 0)", () => {
    const back = build(dealerInputToFormValues(full));
    expect(back.errors).toEqual({});
    expect(parseDealerInput(back.raw)).toEqual({ ok: true, value: full });
  });
  it("forhåndsutfylling inneholder aldri bekreftelse", () => {
    expect(dealerInputToFormValues(full).confirm).toBeUndefined();
  });
  it("alt skjemaet godtar, godtar parseren også (tabell med gyldige variasjoner)", () => {
    const variants: FormValues[] = [
      {}, { tb_amount: "0" }, { co2_g: "0", co2_method: "unspecified" }, { fr_precision: "day", fr_value: "2023-11-30", fr_basis: "vehicle_register" }, { nr_date: "2026-10-30", nr_kind: "actual" },
      { cd_kind: "actual_acceptance", cd_date: "2026-10-20" }, { cg_mode: "amount", cg_amount: "1 000,5" }, { evidenceRef: "x".repeat(200) }, { deduction: "unknown", vatHandling: "not_registered_pays_at_import" },
    ];
    for (const v of variants) {
      const r = build(v);
      expect(r.errors, JSON.stringify(v)).toEqual({});
      expect(parseDealerInput(r.raw).ok, JSON.stringify(v)).toBe(true);
    }
  });
  it("det parseren avviser som skjemaet ikke fanger (ugyldig kalenderdato) kan knyttes til riktig felt", () => {
    const r = build({ nr_date: "2026-02-30", nr_kind: "expected" });
    expect(r.errors).toEqual({});
    const p = parseDealerInput(r.raw);
    expect(p.ok).toBe(false);
    if (!p.ok) expect(p.issues.map((i) => fieldForIssuePath(i.path))).toEqual(["nr_date"]);
  });
  it.each([
    ["$.propulsion.basis", "prop_basis"], ["$.taxWeight.kg", "tw_kg"], ["$.fx.acquisition.rate", "fxA_rate"], ["$.fx.customs.sourceLabel", "fxC_source"], ["$.fx.customs.validTo", "fxC_validTo"],
    ["$.transportAfterBorder", "ta_mode"], ["$.climateGas.amount", "cg_amount"], ["$.registrationFee.basis", "rf_note"], ["$.lineScopes.freight.split", "scope_freight"], ["$.deduction", "deduction"],
    ["$.firstRegistration.value", "fr_value"], ["$.unknown", null], ["$", null],
  ] as const)("feilsti %s → felt %s", (path, field) => expect(fieldForIssuePath(path)).toBe(field));
});

describe("ren domenekode", () => {
  const src = readFileSync("src/domain/search-economics/dealer-form.ts", "utf8");
  it("importerer bare domene; ingen forbudte tallfunksjoner eller I/O", () => {
    for (const m of src.matchAll(/from "([^"]+)"/g)) expect(m[1]!.startsWith("@/domain/") || m[1]!.startsWith("./")).toBe(true);
    expect(src).not.toMatch(/Math\.|parseFloat|Number\(|toFixed|Date\.now\(|new Date\(|fetch\(|process\.env|localStorage/);
  });
});

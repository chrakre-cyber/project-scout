/**
 * SEARCH-002 — søkemodell v1: validering, JSON-rundtur, krav/ønsker og budsjettgrenser.
 * Forventede verdier er utledet uavhengig av implementasjonen (hånd-regnet i øre, eksplisitte datoer og
 * kjente utfall), ikke ved å gjenta koden. All data er syntetisk (tests/fixtures/search-v2.ts).
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { classifyBudget, combineAssessment, upperLimitMinor, parseUtcInstant } from "@/domain/search-v2/budget";
import { emptyCandidate, emptySpec } from "@/domain/search-v2/factory";
import { criteriaSourceCannotSupply, evaluateCandidate } from "@/domain/search-v2/evaluation";
import { PROTOTYPE_MAPPING, mappingFor } from "@/domain/search-v2/mapping";
import { specFromJson, specToJson } from "@/domain/search-v2/serialization";
import { BUDGET_BASIS, MAX_MINOR } from "@/domain/search-v2/types";
import type { CandidateV2, CostLine, SearchSpec, SourceCapabilities } from "@/domain/search-v2/types";
import { validateSpec } from "@/domain/search-v2/validation";
import { NOW, TEST_CATALOG, glsCandidate, glsSpec, synthAssessment } from "./fixtures/search-v2";

const cost = (over: Partial<CostLine> & { id: string }): CostLine => ({
  kind: "custom", label: "Tollagring", currency: "NOK", amountMinor: null, vatBasis: null, includedInBudget: false, ...over,
});
const toJson = (spec: SearchSpec) => {
  const r = specToJson(spec, TEST_CATALOG);
  if (!r.ok) throw new Error("forventet gyldig: " + JSON.stringify(r.issues));
  return r.value;
};
const issuesOf = (input: unknown) => {
  const r = specFromJson(input, TEST_CATALOG);
  if (r.ok) throw new Error("forventet feil");
  return r.issues;
};
const hasIssue = (input: unknown, code: string, path?: string) => issuesOf(input).some((i) => i.code === code && (path === undefined || i.path === path));
function deepFreeze<T>(x: T): T {
  if (typeof x === "object" && x !== null) { Object.values(x).forEach(deepFreeze); Object.freeze(x); }
  return x;
}

// ------------------------------------------------------------------ 1. GLS og modellens bredde

describe("GLS-søket i søkemodell v1", () => {
  it("representerer GLS med krav/ønsker og 750 000 kr / 10 % uten salgspris, retail eller margin", () => {
    const spec = glsSpec();
    expect(validateSpec(spec, TEST_CATALOG)).toEqual([]);
    const json = toJson(spec);
    expect(json.budget.maxTotal).toEqual({ amountMinor: "75000000", currency: "NOK" });
    expect(json.budget.deviationBasisPoints).toBe(1000);
    expect(json.requirements.seats).toEqual({ min: 7, max: 7, unit: "seats" });
    expect(json.equipment.filter((e) => e.priority === "must").map((e) => e.key)).toEqual(["camera_360", "carplay"]);
    expect(JSON.stringify(json)).not.toMatch(/retail|margin|minimumContribution|salgspris|sellingPrice/i);
  });

  it("modellversjonen er adskilt fra prototypens filformat (merovo.search-draft v2)", () => {
    const json = toJson(glsSpec());
    expect(json.schema).toBe("merovo.search-model");
    expect(json.schema).not.toBe("merovo.search-draft");
    expect(json.modelVersion).toBe(1);
  });

  it("tom spec er gyldig: ingenting satt betyr ingen begrensning (match mot enhver kandidat)", () => {
    const spec = emptySpec();
    expect(validateSpec(spec, TEST_CATALOG)).toEqual([]);
    const ev = evaluateCandidate(spec, emptyCandidate("x"));
    expect(ev.status).toBe("match");
    expect(ev.criteria).toEqual([]);
  });
});

// ------------------------------------------------------------------ 2. Validering

describe("validering: avviser uten unntak og uten delvis resultat", () => {
  const good = () => toJson(glsSpec());

  it("avviser ukjent versjon, feil skjema, ikke-objekt og prototypens eget format", () => {
    expect(issuesOf({ ...good(), modelVersion: 2 })[0]).toMatchObject({ code: "unsupported_version", path: "modelVersion" });
    expect(issuesOf({ ...good(), modelVersion: "1" })[0]?.code).toBe("unsupported_version");
    expect(issuesOf({ ...good(), schema: "merovo.search-draft" })[0]?.code).toBe("wrong_schema");
    for (const bad of [null, [], "x", 3, undefined]) expect(issuesOf(bad)[0]?.code).toBe("not_object");
  });

  it("avviser ukjente nøkler på alle nivåer, også arvede/prototypenøkler", () => {
    const a = good() as unknown as Record<string, unknown>;
    expect(hasIssue({ ...a, hacked: 1 }, "unknown_key", "hacked")).toBe(true);
    expect(hasIssue({ ...a, requirements: { ...(a.requirements as object), hacked: 1 } }, "unknown_key", "requirements.hacked")).toBe(true);
    const viaJson = JSON.parse(JSON.stringify(a));
    viaJson.vehicle = JSON.parse('{"brand":null,"model":null,"variant":null,"__proto__":{"x":1}}');
    expect(hasIssue(viaJson, "unknown_key", "vehicle.__proto__")).toBe(true);
    expect(hasIssue({ ...a, toString: "x" }, "unknown_key", "toString")).toBe(true);
  });

  it("mangler en påkrevd nøkkel avvises (ingen stille standardverdi)", () => {
    const a = good() as unknown as Record<string, unknown>;
    const rest = { ...a };
    delete rest.budget;
    expect(hasIssue(rest, "missing_key", "budget")).toBe(true);
    const req = { ...(a.requirements as Record<string, unknown>) };
    delete req.seats;
    expect(hasIssue({ ...a, requirements: req }, "missing_key", "requirements.seats")).toBe(true);
  });

  it("avviser prototypekriterier uten implementert semantikk med tydelig kode i stedet for å ignorere dem", () => {
    const a = good() as unknown as Record<string, unknown>;
    for (const field of ["power", "packages", "towbar", "cruise", "climate", "damage", "country", "weight", "vat"]) {
      const req = { ...(a.requirements as object), [field]: { any: 1 } };
      expect(hasIssue({ ...a, requirements: req }, "criterion_not_supported", `requirements.${field}`), field).toBe(true);
    }
    // også som «utstyr»: cruise/climate/towbar er ikke boolske utstyrskriterier
    for (const key of ["cruise", "climate", "towbar"]) {
      expect(hasIssue({ ...a, equipment: [{ key, priority: "must" }] }, "criterion_not_supported", "equipment[0].key"), key).toBe(true);
    }
  });

  it("avviser feil enheter", () => {
    const a = good();
    expect(hasIssue({ ...a, requirements: { ...a.requirements, seats: { min: 7, max: 7, unit: "years" } } }, "wrong_unit", "requirements.seats.unit")).toBe(true);
    expect(hasIssue({ ...a, requirements: { ...a.requirements, modelYear: { min: 2021, max: null, unit: "år" } } }, "wrong_unit", "requirements.modelYear.unit")).toBe(true);
    expect(hasIssue({ ...a, requirements: { ...a.requirements, maxMileage: { value: 100, unit: "mi" } } }, "wrong_unit", "requirements.maxMileage.unit")).toBe(true);
    expect(hasIssue({ ...a, budget: { ...a.budget, maxTotal: { amountMinor: "100", currency: "EUR" } } }, "currency_not_nok", "budget.maxTotal.currency")).toBe(true);
  });

  it("avviser feil merke/modell, men aldri en fritekstvariant under gyldig modell", () => {
    const s = glsSpec();
    s.vehicle.brand = "nope";
    expect(validateSpec(s, TEST_CATALOG).map((i) => i.code)).toContain("unknown_brand");
    for (const [brand, model] of [["mercedes-benz", "not-a-model"], ["bmw", "gls"], [null, "gls"], ["mercedes-benz", "toString"], ["mercedes-benz", "__proto__"]] as const) {
      const t = glsSpec();
      t.vehicle = { brand, model, variant: null };
      expect(validateSpec(t, TEST_CATALOG).length, `${brand}/${model}`).toBeGreaterThan(0);
    }
    const v = glsSpec();
    v.vehicle.variant = "GLS 450 d 4MATIC (finnes ikke i noen forslagsliste)";
    expect(validateSpec(v, TEST_CATALOG)).toEqual([]);
    const noModel = emptySpec();
    noModel.vehicle.variant = "AMG";
    expect(validateSpec(noModel, TEST_CATALOG).map((i) => i.code)).toContain("variant_requires_model");
  });

  it("avviser ugyldige intervaller og grenseverdier", () => {
    const cases: [string, (s: SearchSpec) => void][] = [
      ["min_above_max", (s) => { s.requirements.seats = { min: 8, max: 7 }; }],
      ["empty_range", (s) => { s.requirements.modelYear = { min: null, max: null }; }],
      ["out_of_range", (s) => { s.requirements.modelYear = { min: 1949, max: null }; }],
      ["out_of_range", (s) => { s.requirements.modelYear = { min: null, max: 2101 }; }],
      ["out_of_range", (s) => { s.requirements.seats = { min: 0, max: null }; }],
      ["out_of_range", (s) => { s.requirements.seats = { min: 1.5, max: null }; }],
      ["out_of_range", (s) => { s.requirements.maxMileageKm = 0; }],
      ["out_of_range", (s) => { s.requirements.maxMileageKm = 2_000_001; }],
      ["out_of_range", (s) => { s.budget.deviationBasisPoints = 10_001; }],
      ["out_of_range", (s) => { s.budget.deviationBasisPoints = -1; }],
      ["invalid_amount", (s) => { s.budget.maxTotalNokMinor = 0n; }],
      ["invalid_amount", (s) => { s.budget.maxTotalNokMinor = -5n; }],
      ["invalid_amount", (s) => { s.budget.maxTotalNokMinor = MAX_MINOR + 1n; }],
      ["from_after_to", (s) => { s.requirements.firstRegistration = { from: { precision: "year", year: 2022 }, to: { precision: "month", year: 2021, month: 12 } }; }],
      ["empty_range", (s) => { s.requirements.firstRegistration = { from: null, to: null }; }],
    ];
    for (const [code, mutate] of cases) {
      const s = glsSpec();
      mutate(s);
      expect(validateSpec(s, TEST_CATALOG).map((i) => i.code), code).toContain(code);
    }
    // grensene selv er gyldige
    const ok = glsSpec();
    ok.requirements.modelYear = { min: 1950, max: 2100 };
    ok.requirements.seats = { min: 1, max: 20 };
    ok.requirements.maxMileageKm = 2_000_000;
    ok.budget.deviationBasisPoints = 10_000;
    ok.budget.maxTotalNokMinor = MAX_MINOR;
    expect(validateSpec(ok, TEST_CATALOG)).toEqual([]);
  });

  it("avviser ugyldige datoer og datopresisjon som ikke stemmer (ingen oppdiktet måned/dag)", () => {
    const bad = [
      { precision: "month", year: 2021, month: 13 },
      { precision: "month", year: 2021, month: 0 },
      { precision: "date", year: 2021, month: 2, day: 29 },
      { precision: "date", year: 2021, month: 4, day: 31 },
      { precision: "year", year: 2021, month: 6 },
      { precision: "month", year: 2021 },
      { precision: "date", year: 2021, month: 6 },
      { precision: "week", year: 2021 },
      { precision: "year", year: 1899 },
      { precision: "year", year: "2021" },
    ];
    for (const d of bad) {
      const a = good();
      const input = { ...a, requirements: { ...a.requirements, firstRegistration: { from: d, to: null } } };
      expect(hasIssue(input, "invalid_date", "requirements.firstRegistration.from"), JSON.stringify(d)).toBe(true);
    }
    const leap = good();
    expect(specFromJson({ ...leap, requirements: { ...leap.requirements, firstRegistration: { from: { precision: "date", year: 2020, month: 2, day: 29 }, to: null } } }, TEST_CATALOG).ok).toBe(true);
  });

  it("avviser duplikate kriterier/utstyr/verdier og ugyldige prioriteter", () => {
    const a = good();
    expect(hasIssue({ ...a, equipment: [{ key: "carplay", priority: "must" }, { key: "carplay", priority: "nice" }] }, "duplicate", "equipment")).toBe(true);
    expect(hasIssue({ ...a, requirements: { ...a.requirements, fuels: ["diesel", "diesel"] } }, "duplicate", "requirements.fuels")).toBe(true);
    expect(hasIssue({ ...a, appearance: { ...a.appearance, exteriorColors: { values: ["black", "black"], priority: "must" } } }, "duplicate", "appearance.exteriorColors.values")).toBe(true);
    for (const p of ["maybe", "MUST", "", 1, null]) {
      expect(hasIssue({ ...a, equipment: [{ key: "carplay", priority: p }] }, "invalid_priority", "equipment[0].priority"), String(p)).toBe(true);
      expect(hasIssue({ ...a, appearance: { ...a.appearance, exteriorColors: { values: ["black"], priority: p } } }, "invalid_priority", "appearance.exteriorColors.priority"), String(p)).toBe(true);
    }
    expect(hasIssue({ ...a, appearance: { ...a.appearance, exteriorColors: { values: [], priority: "must" } } }, "empty_list", "appearance.exteriorColors.values")).toBe(true);
    // ukjent utstyr/farge, også arvede navn
    expect(hasIssue({ ...a, equipment: [{ key: "toString", priority: "must" }] }, "unknown_equipment", "equipment[0].key")).toBe(true);
    expect(hasIssue({ ...a, equipment: [{ key: "teleporter", priority: "nice" }] }, "unknown_equipment")).toBe(true);
    expect(hasIssue({ ...a, appearance: { ...a.appearance, exteriorColors: { values: ["plaid"], priority: "must" } } }, "unknown_key")).toBe(true);
    expect(hasIssue({ ...a, requirements: { ...a.requirements, fuels: ["steam"] } }, "invalid_value", "requirements.fuels[0]")).toBe(true);
  });

  it("kostnadslinjer: beløp som JSON-tall, ustøttet valuta, duplikate typer/id-er og ugyldige verdier avvises", () => {
    const base = good();
    const line = { id: "c1", kind: "custom", label: "Tollagring", currency: "EUR", amountMinor: "200000", vatBasis: "excl", includedInBudget: true };
    const withCosts = (costs: unknown[]) => ({ ...base, budget: { ...base.budget, costs } });
    expect(specFromJson(withCosts([line]), TEST_CATALOG).ok).toBe(true);
    expect(hasIssue(withCosts([{ ...line, amountMinor: 200000 }]), "invalid_amount", "budget.costs[0].amountMinor")).toBe(true);
    expect(hasIssue(withCosts([{ ...line, amountMinor: "1.5" }]), "invalid_amount")).toBe(true);
    expect(hasIssue(withCosts([{ ...line, amountMinor: "-1" }]), "invalid_amount")).toBe(true);
    expect(hasIssue(withCosts([{ ...line, amountMinor: "007" }]), "invalid_amount")).toBe(true);
    expect(hasIssue(withCosts([{ ...line, amountMinor: "9007199254740992" }]), "invalid_amount")).toBe(true);
    expect(hasIssue(withCosts([{ ...line, currency: "XXX" }]), "unsupported_currency", "budget.costs[0].currency")).toBe(true);
    expect(hasIssue(withCosts([{ ...line, currency: "eur" }]), "unsupported_currency")).toBe(true);
    expect(hasIssue(withCosts([{ ...line, vatBasis: "mixed" }]), "invalid_vat_basis")).toBe(true);
    expect(hasIssue(withCosts([{ ...line, includedInBudget: "yes" }]), "not_boolean")).toBe(true);
    expect(hasIssue(withCosts([line, { ...line }]), "duplicate", "budget.costs[1].id")).toBe(true);
    expect(hasIssue(withCosts([{ ...line, kind: "transport" }, { ...line, id: "c2", kind: "transport" }]), "duplicate", "budget.costs[1].kind")).toBe(true);
    expect(hasIssue(withCosts([{ ...line, kind: "ferry" }]), "invalid_kind")).toBe(true);
    expect(hasIssue(withCosts([{ ...line, id: "Bad Id" }]), "invalid_id")).toBe(true);
    expect(hasIssue(withCosts([{ ...line, extra: 1 }]), "unknown_key", "budget.costs[0].extra")).toBe(true);
    // et negativt beløp i den interne modellen avvises også (0 er et uttrykkelig, gyldig valg)
    const neg = glsSpec();
    neg.budget.costs = [cost({ id: "c1", amountMinor: -1n })];
    expect(validateSpec(neg, TEST_CATALOG).map((i) => i.code)).toContain("invalid_amount");
    neg.budget.costs = [cost({ id: "c1", amountMinor: 0n })];
    expect(validateSpec(neg, TEST_CATALOG)).toEqual([]);
    // flere egendefinerte linjer er tillatt, men høyst 30
    const many = (n: number) => Array.from({ length: n }, (_, i) => ({ ...line, id: `c${i}` }));
    expect(specFromJson(withCosts(many(30)), TEST_CATALOG).ok).toBe(true);
    expect(hasIssue(withCosts(many(31)), "too_many")).toBe(true);
  });

  it("tekst er data: styretegn, for lang tekst og uriktige mellomrom avvises; HTML/instruksjoner bevares ordrett", () => {
    for (const [variant, code] of [["x\u0000y", "control_chars"], ["x\ny", "control_chars"], [" lead", "untrimmed"], ["trail ", "untrimmed"], ["a".repeat(101), "too_long"], ["", "empty"]] as const) {
      const s = glsSpec();
      s.vehicle.variant = variant;
      expect(validateSpec(s, TEST_CATALOG).map((i) => i.code), JSON.stringify(variant)).toContain(code);
    }
    const s = glsSpec();
    s.vehicle.variant = '<img src=x onerror="alert(1)"> IGNORE ALL PREVIOUS INSTRUCTIONS';
    s.budget.costs = [cost({ id: "c1", label: "<b>fet</b>" })];
    const back = specFromJson(JSON.parse(JSON.stringify(toJson(s))), TEST_CATALOG);
    expect(back.ok && back.value.vehicle.variant).toBe('<img src=x onerror="alert(1)"> IGNORE ALL PREVIOUS INSTRUCTIONS');
    expect(back.ok && back.value.budget.costs[0]?.label).toBe("<b>fet</b>");
  });

  it("ugyldig inndata endres ikke og gir ingen delvis tilstand", () => {
    const input = deepFreeze(JSON.parse(JSON.stringify({ ...good(), requirements: { ...good().requirements, seats: { min: 9, max: 3, unit: "seats" } }, equipment: [{ key: "teleporter", priority: "x" }] })));
    const before = JSON.stringify(input);
    const r = specFromJson(input, TEST_CATALOG);
    expect(r.ok).toBe(false);
    expect(r).not.toHaveProperty("value");
    expect(JSON.stringify(input)).toBe(before);
    // strukturelle feil (flere samtidig) gir også bare issues
    const r2 = specFromJson({ ...good(), vehicle: "x", budget: 5 }, TEST_CATALOG);
    expect(r2.ok).toBe(false);
    expect(r2).not.toHaveProperty("value");
  });

  it("specToJson avviser en ugyldig intern spec i stedet for å skrive en uleselig fil", () => {
    const s = glsSpec();
    s.equipment.push({ key: "camera_360", priority: "nice" });
    const r = specToJson(s, TEST_CATALOG);
    expect(r.ok).toBe(false);
  });
});

// ------------------------------------------------------------------ 3. Tapsfri rundtur

describe("JSON-rundtur uten stille tap", () => {
  const roundtrip = (spec: SearchSpec) => {
    const json = toJson(spec);
    const wire = JSON.parse(JSON.stringify(json)); // faktisk JSON-tekst, ingen bigint
    const back = specFromJson(wire, TEST_CATALOG);
    if (!back.ok) throw new Error(JSON.stringify(back.issues));
    return back.value;
  };

  it("bevarer ukjent EUR-beløp, eksplisitt 0, valuta, mva.-grunnlag og inkludering", () => {
    const s = glsSpec();
    s.budget.costs = [
      cost({ id: "transport", kind: "transport", label: "Transport", currency: "EUR", amountMinor: null, includedInBudget: true }),
      cost({ id: "insurance", kind: "insurance", label: "Forsikring", currency: "NOK", amountMinor: 0n, vatBasis: "none" }),
      cost({ id: "c1", label: "Tollagring", currency: "EUR", amountMinor: 200_000n, vatBasis: "excl", includedInBudget: true }),
      cost({ id: "c2", label: "Parkering", currency: "SEK", amountMinor: null, vatBasis: "incl" }),
    ];
    const back = roundtrip(s);
    expect(back).toEqual(s);
    expect(back.budget.costs[0]).toMatchObject({ currency: "EUR", amountMinor: null, includedInBudget: true });
    expect(back.budget.costs[1]).toMatchObject({ currency: "NOK", amountMinor: 0n });
    expect(back.budget.costs[1]?.amountMinor).not.toBeNull();
    expect(back.budget.costs[3]).toMatchObject({ currency: "SEK", amountMinor: null });
    // null og 0 er ulike i selve filen
    const json = toJson(s);
    expect(json.budget.costs[0]?.amountMinor).toBeNull();
    expect(json.budget.costs[1]?.amountMinor).toBe("0");
  });

  it("bevarer fri variant, prioriteter, listeprioritet, datopresisjon og varebilscenario", () => {
    const s = glsSpec();
    s.vehicle.variant = "GLS 450 d 4MATIC";
    s.requirements.firstRegistration = { from: { precision: "month", year: 2021, month: 6 }, to: { precision: "date", year: 2023, month: 2, day: 28 } };
    s.requirements.maxMileageKm = 120_000;
    s.requirements.bodyTypes = ["suv", "estate"];
    s.requirements.fuels = ["diesel", "plugin_hybrid"];
    s.requirements.transmissions = ["automatic"];
    s.requirements.driveTrains = ["awd"];
    s.appearance.interiorColors = { values: ["beige", "brown"], priority: "nice" };
    s.appearance.interiorMaterials = { values: ["leather"], priority: "must" };
    s.plannedRegistration = { requested: "van" };
    s.budget.costs = [
      cost({ id: "conversion", kind: "conversion", label: "Ombygging (oppgitt av forhandler)", amountMinor: 4_500_000n, includedInBudget: true }),
      cost({ id: "approval", kind: "approval", label: "Godkjenning (oppgitt av forhandler)", amountMinor: null }),
    ];
    const back = roundtrip(s);
    expect(back).toEqual(s);
    expect(back.plannedRegistration.requested).toBe("van");
    expect(back.requirements.firstRegistration?.from).toEqual({ precision: "month", year: 2021, month: 6 });
    expect(back.requirements.firstRegistration?.to).toEqual({ precision: "date", year: 2023, month: 2, day: 28 });
    expect(back.equipment.map((e) => `${e.key}:${e.priority}`)).toEqual(["camera_360:must", "carplay:must", "panoramic_roof:nice", "air_suspension:nice", "heated_seats_front:nice"]);
    // 'uspesifisert' skilles fra 'passenger'
    for (const requested of ["passenger", "unspecified"] as const) {
      const t = glsSpec();
      t.plannedRegistration = { requested };
      expect(roundtrip(t).plannedRegistration.requested).toBe(requested);
    }
  });

  it("bevarer store beløp eksakt (2^53-1) og avviser alt over", () => {
    const s = glsSpec();
    s.budget.maxTotalNokMinor = MAX_MINOR;
    s.budget.costs = [cost({ id: "c1", amountMinor: MAX_MINOR })];
    const json = toJson(s);
    expect(json.budget.maxTotal?.amountMinor).toBe("9007199254740991");
    expect(roundtrip(s)).toEqual(s);
  });

  it("alt usatt (null/tom liste) forblir usatt; tom spec rundturer", () => {
    expect(roundtrip(emptySpec())).toEqual(emptySpec());
  });

  it("utdata deler ikke referanser med inndata", () => {
    const s = glsSpec();
    const json = toJson(s);
    json.equipment.push({ key: "isofix", priority: "nice" });
    json.requirements.bodyTypes.push("suv");
    expect(s.equipment.length).toBe(5);
    expect(s.requirements.bodyTypes).toEqual([]);
    const wire = JSON.parse(JSON.stringify(toJson(s)));
    const r = specFromJson(wire, TEST_CATALOG);
    wire.equipment.length = 0;
    expect(r.ok && r.value.equipment.length).toBe(5);
  });
});

// ------------------------------------------------------------------ 4. Krav og ønsker

describe("kravvurdering: excluded / needs_review / match", () => {
  const spec = glsSpec();
  const ev = (c: CandidateV2, s: SearchSpec = spec) => evaluateCandidate(s, c);

  it("alle «must» oppfylt → match, også når alle ønsker er ukjent", () => {
    const r = ev(glsCandidate("a"));
    expect(r.status).toBe("match");
    expect(r.excludedBy).toEqual([]);
    expect(r.unknownMust).toEqual([]);
    expect(r.wishes.unknown.sort()).toEqual(["equipment:air_suspension", "equipment:heated_seats_front", "equipment:panoramic_roof"]);
  });

  it("kjent brudd på et absolutt krav → excluded (hver krav-type)", () => {
    const cases: [string, Partial<CandidateV2>, string][] = [
      ["brand", { brandKey: "bmw" }, "brand"],
      ["model", { modelKey: "gle" }, "model"],
      ["modelYear", { modelYear: 2020 }, "modelYear"],
      ["seats low", { seats: 5 }, "seats"],
      ["seats high", { seats: 8 }, "seats"],
      ["color", { exteriorColor: "grey" }, "exteriorColors"],
    ];
    for (const [name, over, crit] of cases) {
      const r = ev(glsCandidate("x", over));
      expect(r.status, name).toBe("excluded");
      expect(r.excludedBy, name).toContain(crit);
    }
  });

  it("ukjent opplysning for et absolutt krav → needs_review, aldri match", () => {
    for (const [name, over, crit] of [
      ["brand", { brandKey: null }, "brand"],
      ["modelYear", { modelYear: null }, "modelYear"],
      ["seats", { seats: null }, "seats"],
      ["color", { exteriorColor: null }, "exteriorColors"],
      ["equipment", { equipment: null }, "equipment:camera_360"],
    ] as [string, Partial<CandidateV2>, string][]) {
      const r = ev(glsCandidate("x", over));
      expect(r.status, name).toBe("needs_review");
      expect(r.unknownMust, name).toContain(crit);
      expect(r.excludedBy, name).toEqual([]);
    }
  });

  it("et annet kjent kravbrudd har forrang over ukjent", () => {
    const r = ev(glsCandidate("x", { seats: null, modelYear: 2019 }));
    expect(r.status).toBe("excluded");
    expect(r.excludedBy).toEqual(["modelYear"]);
    expect(r.unknownMust).toEqual(["seats"]);
  });

  it("ELLER innen en liste, OG mellom krav (ett brudd er nok)", () => {
    const s = glsSpec();
    s.requirements.fuels = ["diesel", "plugin_hybrid"];
    s.requirements.bodyTypes = ["suv"];
    const base = glsCandidate("x", { fuel: "diesel", bodyType: "suv" });
    expect(ev(base, s).status).toBe("match");
    expect(ev({ ...base, fuel: "plugin_hybrid" }, s).status).toBe("match");
    expect(ev({ ...base, fuel: "petrol" }, s).status).toBe("excluded");
    expect(ev({ ...base, fuel: "diesel", bodyType: "sedan" }, s).status).toBe("excluded");
    expect(ev({ ...base, fuel: null }, s).status).toBe("needs_review");
    // hjuldrift er et eget kandidatfelt: mangler det, er det ukjent
    const d = glsSpec();
    d.requirements.driveTrains = ["awd"];
    expect(ev(glsCandidate("x"), d).status).toBe("needs_review");
    expect(ev(glsCandidate("x", { driveTrain: "awd" }), d).status).toBe("match");
    expect(ev(glsCandidate("x", { driveTrain: "rwd" }), d).status).toBe("excluded");
  });

  it("fritekstvariant: delstreng uten hensyn til store/små bokstaver; ukjent når kandidaten mangler variant", () => {
    const s = glsSpec();
    s.vehicle.variant = "gls 450";
    expect(ev(glsCandidate("x", { variant: "GLS 450 d 4MATIC" }), s).status).toBe("match");
    expect(ev(glsCandidate("x", { variant: "GLS 580 4MATIC" }), s).status).toBe("excluded");
    expect(ev(glsCandidate("x", { variant: null }), s).status).toBe("needs_review");
  });

  it("seter: grenseverdier 6/7/8 mot nøyaktig 7, og ensidige intervaller", () => {
    expect([6, 7, 8].map((n) => ev(glsCandidate("x", { seats: n })).status)).toEqual(["excluded", "match", "excluded"]);
    const s = glsSpec();
    s.requirements.seats = { min: 5, max: null };
    expect([4, 5, 9].map((n) => ev(glsCandidate("x", { seats: n }), s).status)).toEqual(["excluded", "match", "match"]);
  });

  it("kilometerstand: akkurat på grensen er ok, én over er brudd, ukjent er ukjent", () => {
    const s = glsSpec();
    s.requirements.maxMileageKm = 100_000;
    expect([99_999, 100_000, 100_001].map((n) => ev(glsCandidate("x", { mileageKm: n }), s).status)).toEqual(["match", "match", "excluded"]);
    expect(ev(glsCandidate("x", { mileageKm: null }), s).status).toBe("needs_review");
  });

  it("modellår og registreringsår blandes aldri: registreringsår beviser ikke modellår", () => {
    const s = glsSpec();
    s.requirements.modelYear = { min: 2021, max: null };
    const regOnly = glsCandidate("x", { modelYear: null, firstRegistration: { precision: "year", year: 2022 } });
    const r = ev(regOnly, s);
    expect(r.status).toBe("needs_review");
    expect(r.criteria.find((c) => c.criterion === "modelYear")?.status).toBe("unknown");
    // motsatt: modellår 2020 med registrering 2022 er fortsatt et kjent brudd på modellårskravet
    expect(ev(glsCandidate("x", { modelYear: 2020, firstRegistration: { precision: "year", year: 2022 } }), s).status).toBe("excluded");
    // og modellår beviser ikke registrering
    const t = glsSpec();
    t.requirements.firstRegistration = { from: { precision: "year", year: 2022 }, to: null };
    expect(ev(glsCandidate("x", { modelYear: 2023, firstRegistration: null }), t).status).toBe("needs_review");
  });

  describe("førstegangsregistrering med presisjon", () => {
    const run = (range: SearchSpec["requirements"]["firstRegistration"], c: CandidateV2["firstRegistration"]) => {
      const s = glsSpec();
      s.requirements.firstRegistration = range;
      return ev(glsCandidate("x", { firstRegistration: c }), s).criteria.find((x) => x.criterion === "firstRegistration")?.status;
    };
    const from = (year: number, month?: number, day?: number) => ({ from: month === undefined ? { precision: "year" as const, year } : day === undefined ? { precision: "month" as const, year, month } : { precision: "date" as const, year, month, day }, to: null });
    const to = (year: number, month?: number, day?: number) => ({ from: null, to: from(year, month, day).from });

    it("fra juni 2021 (måned)", () => {
      const r = from(2021, 6);
      expect(run(r, { precision: "year", year: 2021 })).toBe("unknown"); // kan være jan–des 2021
      expect(run(r, { precision: "year", year: 2022 })).toBe("fulfilled");
      expect(run(r, { precision: "year", year: 2020 })).toBe("not_fulfilled");
      expect(run(r, { precision: "month", year: 2021, month: 5 })).toBe("not_fulfilled");
      expect(run(r, { precision: "month", year: 2021, month: 6 })).toBe("fulfilled");
      expect(run(r, { precision: "date", year: 2021, month: 5, day: 31 })).toBe("not_fulfilled");
      expect(run(r, { precision: "date", year: 2021, month: 6, day: 1 })).toBe("fulfilled");
      expect(run(r, null)).toBe("unknown");
    });
    it("til desember 2021 (måned) og til 2021 (år)", () => {
      expect(run(to(2021, 12), { precision: "month", year: 2021, month: 12 })).toBe("fulfilled");
      expect(run(to(2021, 12), { precision: "date", year: 2022, month: 1, day: 1 })).toBe("not_fulfilled");
      expect(run(to(2021, 6), { precision: "year", year: 2021 })).toBe("unknown");
      expect(run(to(2021), { precision: "year", year: 2021 })).toBe("fulfilled");
      expect(run(to(2021), { precision: "month", year: 2022, month: 1 })).toBe("not_fulfilled");
      expect(run(to(2021, 2, 28), { precision: "date", year: 2021, month: 2, day: 28 })).toBe("fulfilled");
      expect(run(to(2020, 2, 28), { precision: "month", year: 2020, month: 2 })).toBe("unknown"); // skuddår: februar har 29 dager
      expect(run(to(2021, 2, 28), { precision: "month", year: 2021, month: 2 })).toBe("fulfilled"); // 2021: februar slutter 28.
      expect(run(to(2020, 2, 29), { precision: "month", year: 2020, month: 2 })).toBe("fulfilled");
    });
    it("fra–til samtidig: bare det som avgjør hele kandidatperioden, ellers ukjent", () => {
      const r = { from: { precision: "year" as const, year: 2021 }, to: { precision: "year" as const, year: 2022 } };
      expect(run(r, { precision: "month", year: 2021, month: 1 })).toBe("fulfilled");
      expect(run(r, { precision: "month", year: 2022, month: 12 })).toBe("fulfilled");
      expect(run(r, { precision: "month", year: 2023, month: 1 })).toBe("not_fulfilled");
      expect(run(r, { precision: "year", year: 2020 })).toBe("not_fulfilled");
    });
    it("ugyldig kandidatdato blir ukjent, ikke et gjettet utfall", () => {
      expect(run(from(2021, 6), { precision: "month", year: 2022, month: 13 })).toBe("unknown");
    });
  });
});

describe("ønsker (nice): påvirker aldri status, forklares per kriterium", () => {
  const spec = glsSpec();

  it("«nice» kan være oppfylt, ikke oppfylt eller ukjent uten å ekskludere eller gi kontrollbehov", () => {
    const c = glsCandidate("x", {
      equipment: { present: ["camera_360", "carplay", "panoramic_roof"], absent: ["air_suspension"], listComplete: false },
    });
    const r = evaluateCandidate(spec, c);
    expect(r.status).toBe("match");
    expect(r.wishes).toEqual({ fulfilled: ["equipment:panoramic_roof"], notFulfilled: ["equipment:air_suspension"], unknown: ["equipment:heated_seats_front"] });
  });

  it("alle ønsker brutt og ingen oppfylt gir fortsatt match når «must» er oppfylt", () => {
    const c = glsCandidate("x", { equipment: { present: ["camera_360", "carplay"], absent: [], listComplete: true } });
    const r = evaluateCandidate(spec, c);
    expect(r.status).toBe("match");
    expect(r.wishes.fulfilled).toEqual([]);
    expect(r.wishes.notFulfilled).toHaveLength(3);
  });

  it("farge som ønske: feil farge ekskluderer ikke, ukjent farge gir ikke kontrollbehov", () => {
    const s = glsSpec();
    s.appearance.exteriorColors = { values: ["black", "white"], priority: "nice" };
    expect(evaluateCandidate(s, glsCandidate("x", { exteriorColor: "grey" })).status).toBe("match");
    expect(evaluateCandidate(s, glsCandidate("x", { exteriorColor: null })).status).toBe("match");
    expect(evaluateCandidate(s, glsCandidate("x", { exteriorColor: "white" })).wishes.fulfilled).toEqual(["exteriorColors"]);
  });

  it("to biler med samme krav men ulikt ønsket utstyr gir forklarbare forskjeller uten utilsiktet eksklusjon", () => {
    const a = glsCandidate("a", { equipment: { present: ["camera_360", "carplay", "panoramic_roof", "air_suspension", "heated_seats_front"], absent: [], listComplete: true } });
    const b = glsCandidate("b", { equipment: { present: ["camera_360", "carplay", "panoramic_roof"], absent: [], listComplete: false } });
    const c = glsCandidate("c", { equipment: { present: ["camera_360", "carplay"], absent: ["panoramic_roof", "air_suspension", "heated_seats_front"], listComplete: true } });
    const [ra, rb, rc] = [a, b, c].map((x) => evaluateCandidate(spec, x));
    expect([ra?.status, rb?.status, rc?.status]).toEqual(["match", "match", "match"]);
    expect(ra?.wishes.fulfilled).toHaveLength(3);
    expect(rb?.wishes).toEqual({ fulfilled: ["equipment:panoramic_roof"], notFulfilled: [], unknown: ["equipment:air_suspension", "equipment:heated_seats_front"] });
    expect(rc?.wishes.notFulfilled).toHaveLength(3);
    // identiske «must»-forklaringer
    const mustOf = (r: typeof ra) => r?.criteria.filter((x) => x.priority === "must").map((x) => `${x.criterion}:${x.status}`);
    expect(mustOf(ra)).toEqual(mustOf(rb));
    expect(mustOf(rb)).toEqual(mustOf(rc));
  });
});

describe("utstyr: ukjent er ikke «mangler»", () => {
  const s = glsSpec();
  const status = (facts: CandidateV2["equipment"], key = "camera_360") => evaluateCandidate(s, glsCandidate("x", { equipment: facts })).criteria.find((c) => c.criterion === `equipment:${key}`);

  it("fravær av omtale i en ufullstendig liste er ukjent; først bekreftet fravær eller fullstendig liste er «mangler»", () => {
    expect(status({ present: ["carplay"], absent: [], listComplete: false })).toMatchObject({ status: "unknown", reason: "source_list_incomplete" });
    expect(status({ present: ["carplay"], absent: ["camera_360"], listComplete: false })).toMatchObject({ status: "not_fulfilled", reason: "confirmed_absent" });
    expect(status({ present: ["carplay"], absent: [], listComplete: true })).toMatchObject({ status: "not_fulfilled", reason: "absent_from_complete_list" });
    expect(status({ present: ["camera_360"], absent: [], listComplete: true })).toMatchObject({ status: "fulfilled" });
    expect(status(null)).toMatchObject({ status: "unknown", reason: "equipment_not_stated" });
    expect(status({ present: [], absent: [], listComplete: false })).toMatchObject({ status: "unknown" });
  });

  it("motstridende kilde (både til stede og fraværende) er ukjent", () => {
    expect(status({ present: ["camera_360"], absent: ["camera_360"], listComplete: true })).toMatchObject({ status: "unknown", reason: "source_contradiction" });
  });

  it("modellpakker beviser ikke enkeltutstyr", () => {
    const withPackage = glsCandidate("x", { equipment: null, packages: ["Premium Plus-pakke", "AMG Line"] });
    const r = evaluateCandidate(s, withPackage);
    expect(r.status).toBe("needs_review");
    expect(r.unknownMust).toEqual(["equipment:camera_360", "equipment:carplay"]);
    // pakkeinnholdet påvirker heller ikke et kjent fravær
    const r2 = evaluateCandidate(s, glsCandidate("y", { equipment: { present: ["carplay"], absent: ["camera_360"], listComplete: false }, packages: ["Premium Plus-pakke"] }));
    expect(r2.status).toBe("excluded");
  });
});

describe("planlagt norsk registrering blandes ikke med karosserifilter eller kravvurdering", () => {
  it("varebilscenario endrer ingen kravvurdering; karosserifilteret ser bare bilens karosseri", () => {
    const candidate = glsCandidate("x", { bodyType: "suv", currentCategory: "passenger" });
    const outcomes = (["passenger", "van", "unspecified"] as const).map((requested) => {
      const s = glsSpec();
      s.requirements.bodyTypes = ["suv"];
      s.plannedRegistration = { requested };
      return evaluateCandidate(s, candidate);
    });
    expect(outcomes[1]).toEqual(outcomes[0]);
    expect(outcomes[2]).toEqual(outcomes[0]);
    expect(outcomes[0]?.status).toBe("match");

    // ønsket om varebil gjør ikke en SUV til «van», og et van-filter godtar ikke en personbil-SUV
    const s = glsSpec();
    s.requirements.bodyTypes = ["van"];
    s.plannedRegistration = { requested: "van" };
    expect(evaluateCandidate(s, candidate).status).toBe("excluded");
    // bilens nåværende kategori er heller ikke et filter
    expect(evaluateCandidate(s, { ...candidate, bodyType: "van", currentCategory: "passenger" }).status).toBe("match");
    expect(evaluateCandidate(s, { ...candidate, bodyType: "van", currentCategory: null }).status).toBe("match");
  });
});

describe("kildekapasitet", () => {
  it("opplyser kriterier kilden ikke kan levere (aldri stille bortfall)", () => {
    const s = glsSpec();
    s.requirements.driveTrains = ["awd"];
    const caps: SourceCapabilities = { id: "test-caps", fields: { brand: true, model: true, modelYear: true, seats: true, exteriorColors: true }, equipment: false };
    expect(criteriaSourceCannotSupply(s, caps)).toEqual([
      "driveTrains", "equipment:camera_360", "equipment:carplay", "equipment:panoramic_roof", "equipment:air_suspension", "equipment:heated_seats_front",
    ]);
    expect(criteriaSourceCannotSupply(s, { id: "t", fields: { ...caps.fields, driveTrains: true }, equipment: true })).toEqual([]);
    expect(criteriaSourceCannotSupply(emptySpec(), { id: "none", fields: {}, equipment: false })).toEqual([]);
  });
});

// ------------------------------------------------------------------ 5. Budsjett

describe("budsjettgrense i eksakte øre/basispunkter", () => {
  const withBudget = (maxTotalNokMinor: bigint | null, deviationBasisPoints: number | null, costs: CostLine[] = [], requested: SearchSpec["plannedRegistration"]["requested"] = "passenger"): SearchSpec => {
    const s = glsSpec();
    s.budget = { maxTotalNokMinor, deviationBasisPoints, costs };
    s.plannedRegistration = { requested };
    return s;
  };

  it("750 000 kr + 10 % = 825 000 kr; avslått avvik = budsjettet", () => {
    expect(upperLimitMinor(withBudget(75_000_000n, 1000).budget)).toBe(82_500_000n);
    expect(upperLimitMinor(withBudget(75_000_000n, null).budget)).toBe(75_000_000n);
    expect(upperLimitMinor(withBudget(75_000_000n, 0).budget)).toBe(75_000_000n);
    expect(upperLimitMinor(withBudget(null, 1000).budget)).toBeNull();
  });

  it("brøkøre rundes ned: 100,01 kr + 12,34 % = 112,35 kr; ikke rundet opp og ikke flyttall", () => {
    // 10 001 × 11 234 / 10 000 = 11 235,1234 → 11 235 øre
    expect(upperLimitMinor(withBudget(10_001n, 1234).budget)).toBe(11_235n);
    // 1 øre + 99 % = 1,99 øre → 1 øre
    expect(upperLimitMinor(withBudget(1n, 9900).budget)).toBe(1n);
    // 3 øre + 33,33 % = 3,9999 → 3
    expect(upperLimitMinor(withBudget(3n, 3333).budget)).toBe(3n);
    // 100 øre + 0,01 % = 100,01 → 100
    expect(upperLimitMinor(withBudget(100n, 1).budget)).toBe(100n);
    expect(upperLimitMinor(withBudget(10_000n, 1).budget)).toBe(10_001n);
  });

  it("store beløp mister ikke presisjon (ingen Number-konvertering)", () => {
    expect(upperLimitMinor(withBudget(MAX_MINOR, 10_000).budget)).toBe(18_014_398_509_481_982n);
    expect(upperLimitMinor(withBudget(MAX_MINOR, 1).budget)).toBe(9_007_199_254_740_991n + 900_719_925_474n); // ⌊MAX × 1 / 10 000⌋ = 900 719 925 474
  });

  it("grenser: ett øre under/lik/over budsjettet og øvre grense (lik grense er inkludert)", () => {
    const s = withBudget(75_000_000n, 1000);
    const cls = (total: bigint) => classifyBudget(s, synthAssessment(total), NOW).status;
    expect(cls(74_999_999n)).toBe("within_budget");
    expect(cls(75_000_000n)).toBe("within_budget");
    expect(cls(75_000_001n)).toBe("within_deviation");
    expect(cls(82_499_999n)).toBe("within_deviation");
    expect(cls(82_500_000n)).toBe("within_deviation");
    expect(cls(82_500_001n)).toBe("over_limit");
    expect(cls(0n)).toBe("within_budget");
  });

  it("ingen avvik: alt over budsjettet er over_limit", () => {
    const s = withBudget(75_000_000n, null);
    expect(classifyBudget(s, synthAssessment(75_000_000n), NOW).status).toBe("within_budget");
    expect(classifyBudget(s, synthAssessment(75_000_001n), NOW).status).toBe("over_limit");
    expect(classifyBudget(s, synthAssessment(75_000_001n), NOW).upperLimitMinor).toBe(75_000_000n);
  });

  it("grenser ved brøkøre-avrunding: ett øre over rundet grense er over_limit", () => {
    const s = withBudget(10_001n, 1234);
    expect(classifyBudget(s, synthAssessment(11_235n), NOW).status).toBe("within_deviation");
    expect(classifyBudget(s, synthAssessment(11_236n), NOW).status).toBe("over_limit");
  });

  it("kostnadslinjer er forutsetninger og øker aldri budsjett eller øvre grense", () => {
    const plain = withBudget(75_000_000n, 1000);
    const loaded = withBudget(75_000_000n, 1000, [
      cost({ id: "transport", kind: "transport", label: "Transport", currency: "NOK", amountMinor: 3_000_000n, includedInBudget: true }),
      cost({ id: "c1", currency: "EUR", amountMinor: 9_999_999n, includedInBudget: true }),
    ]);
    expect(upperLimitMinor(loaded.budget)).toBe(upperLimitMinor(plain.budget));
    // også med avvik avslått
    const offPlain = withBudget(75_000_000n, null);
    const offLoaded = withBudget(75_000_000n, null, [cost({ id: "c1", currency: "NOK", amountMinor: 5_000_000n, includedInBudget: true })]);
    expect(upperLimitMinor(offLoaded.budget)).toBe(upperLimitMinor(offPlain.budget));
    expect(classifyBudget(offLoaded, synthAssessment(75_000_001n, { coveredCostLineIds: ["c1"] }), NOW).status).toBe("over_limit");
    const a = synthAssessment(82_500_001n, { coveredCostLineIds: ["transport", "c1"] });
    expect(classifyBudget(loaded, a, NOW)).toMatchObject({ status: "over_limit", budgetMinor: 75_000_000n, upperLimitMinor: 82_500_000n });
  });

  describe("not_calculated: ingen bekreftet budsjettstatus uten gyldig vurdering", () => {
    const s = withBudget(75_000_000n, 1000);
    const reason = (a: Parameters<typeof classifyBudget>[1], spec = s, now = NOW) => {
      const r = classifyBudget(spec, a, now);
      expect(r.status).toBe(r.reason === null ? r.status : "not_calculated");
      return r.reason;
    };

    it("manglende vurdering og manglende budsjett", () => {
      expect(reason(null)).toBe("no_assessment");
      expect(reason(undefined)).toBe("no_assessment");
      expect(reason(synthAssessment(1n), withBudget(null, null))).toBe("no_budget");
      expect(classifyBudget(withBudget(null, null), synthAssessment(1n), NOW)).toMatchObject({ status: "not_calculated", budgetMinor: null, upperLimitMinor: null });
    });
    it("uvalidert, ufullstendig og ugyldig status", () => {
      expect(reason(synthAssessment(1n, { status: "unvalidated" }))).toBe("assessment_not_validated");
      expect(reason(synthAssessment(1n, { status: "incomplete" }))).toBe("assessment_incomplete");
      expect(reason(synthAssessment(1n, { status: "validated" as never }))).toBe("assessment_invalid");
      expect(reason(synthAssessment(1n, { profileRef: "  " }))).toBe("assessment_invalid");
      expect(reason(synthAssessment(1n, { totalMinor: -1n }))).toBe("assessment_invalid");
      expect(reason(synthAssessment(1n, { totalMinor: 1 as never }))).toBe("assessment_invalid");
      expect(reason(synthAssessment(1n, { validUntil: "i morgen" }))).toBe("assessment_invalid");
      expect(reason(synthAssessment(1n, { validUntil: "2026-02-30T00:00:00Z" }))).toBe("assessment_invalid");
      expect(reason(synthAssessment(1n), s, "not a time")).toBe("assessment_invalid");
    });
    it("foreldet vurdering: gyldig frem til, men ikke på, utløpstidspunktet", () => {
      const a = synthAssessment(1n, { validUntil: "2026-10-15T12:00:00Z" });
      expect(reason(a, s, "2026-10-15T11:59:59Z")).toBeNull();
      expect(reason(a, s, "2026-10-15T12:00:00Z")).toBe("assessment_stale");
      expect(reason(a, s, "2026-10-16T00:00:00Z")).toBe("assessment_stale");
    });
    it("feil valuta og feil budsjettbasis", () => {
      expect(reason(synthAssessment(1n, { currency: "EUR" }))).toBe("currency_not_nok");
      expect(reason(synthAssessment(1n, { currency: "nok" }))).toBe("currency_not_nok");
      expect(reason(synthAssessment(1n, { basis: "retail_price_ex_vat" }))).toBe("basis_mismatch");
      expect(reason(synthAssessment(1n, { basis: BUDGET_BASIS + " " }))).toBe("basis_mismatch");
    });
    it("feil eller uavklart registreringsscenario", () => {
      expect(reason(synthAssessment(1n, { registrationScenario: "van" }))).toBe("scenario_mismatch");
      expect(reason(synthAssessment(1n, { registrationScenario: "passenger" }), withBudget(75_000_000n, 1000, [], "van"))).toBe("scenario_mismatch");
      expect(reason(synthAssessment(1n, { registrationScenario: "van" }), withBudget(75_000_000n, 1000, [], "unspecified"))).toBe("scenario_unspecified");
      expect(reason(synthAssessment(1n), withBudget(75_000_000n, 1000, [], "unspecified"))).toBe("scenario_unspecified");
      expect(reason(synthAssessment(1n, { registrationScenario: "van" }), withBudget(75_000_000n, 1000, [], "van"))).toBeNull();
    });
    it("inkluderte kostnader må være kjente og dekket av totalen", () => {
      const inc = withBudget(75_000_000n, 1000, [cost({ id: "c1", amountMinor: null, includedInBudget: true })]);
      expect(reason(synthAssessment(1n, { coveredCostLineIds: ["c1"] }), inc)).toBe("included_cost_unknown");
      const known = withBudget(75_000_000n, 1000, [cost({ id: "c1", amountMinor: 0n, includedInBudget: true })]);
      expect(reason(synthAssessment(1n), known)).toBe("included_cost_not_covered");
      expect(reason(synthAssessment(1n, { coveredCostLineIds: ["c1"] }), known)).toBeNull();
      // ikke-inkluderte linjer (også ukjente) blokkerer ikke
      const excluded = withBudget(75_000_000n, 1000, [cost({ id: "c1", amountMinor: null, includedInBudget: false })]);
      expect(reason(synthAssessment(1n), excluded)).toBeNull();
    });
    it("ved not_calculated finnes aldri en positiv budsjettstatus", () => {
      const r = classifyBudget(s, synthAssessment(1n, { status: "unvalidated" }), NOW);
      expect(["within_budget", "within_deviation"]).not.toContain(r.status);
    });
  });

  it("valg av varebil alene endrer aldri total, grense eller gir en avgiftsfordel", () => {
    const a = synthAssessment(80_000_000n, { registrationScenario: "van" });
    const van = withBudget(75_000_000n, 1000, [], "van");
    const car = withBudget(75_000_000n, 1000, [], "passenger");
    expect(upperLimitMinor(van.budget)).toBe(upperLimitMinor(car.budget));
    // vurderingens total er uendret og klassifiseres likt uansett hvilket scenario søket ber om, når scenarioet samsvarer
    const rVan = classifyBudget(van, a, NOW);
    const rCar = classifyBudget(car, synthAssessment(80_000_000n, { registrationScenario: "passenger" }), NOW);
    expect(rVan).toEqual(rCar);
    expect(rVan.status).toBe("within_deviation");
    // et varebilsønske gir aldri positiv status på en personbil-total
    expect(classifyBudget(van, synthAssessment(1n, { registrationScenario: "passenger" }), NOW).status).toBe("not_calculated");
  });

  it("pris opphever aldri kravbrudd: excluded/needs_review forblir selv om totalen er innenfor budsjett", () => {
    const s = withBudget(75_000_000n, 1000);
    const budget = classifyBudget(s, synthAssessment(1_000_000n), NOW);
    expect(budget.status).toBe("within_budget");
    const hit = combineAssessment(evaluateCandidate(s, glsCandidate("a")), budget);
    expect(hit.isFullHit).toBe(true);
    const excluded = combineAssessment(evaluateCandidate(s, glsCandidate("b", { seats: 5 })), budget);
    expect(excluded.vehicle.status).toBe("excluded");
    expect(excluded.isFullHit).toBe(false);
    const review = combineAssessment(evaluateCandidate(s, glsCandidate("c", { seats: null })), budget);
    expect(review.vehicle.status).toBe("needs_review");
    expect(review.isFullHit).toBe(false);
    // og et fullt kjøretøytreff over grensen eller uten beregning er ikke fullt treff
    expect(combineAssessment(evaluateCandidate(s, glsCandidate("d")), classifyBudget(s, synthAssessment(99_000_000n), NOW)).isFullHit).toBe(false);
    expect(combineAssessment(evaluateCandidate(s, glsCandidate("e")), classifyBudget(s, null, NOW)).isFullHit).toBe(false);
    expect(combineAssessment(evaluateCandidate(s, glsCandidate("f")), classifyBudget(s, synthAssessment(80_000_000n), NOW)).isFullHit).toBe(true);
  });

  it("parseUtcInstant: streng UTC, kalenderkontroll", () => {
    expect(parseUtcInstant("2026-10-15T12:00:00Z")).toBe(Date.UTC(2026, 9, 15, 12));
    expect(parseUtcInstant("2026-10-15T12:00:00.5Z")).toBe(Date.UTC(2026, 9, 15, 12, 0, 0, 500));
    for (const bad of ["2026-10-15", "2026-10-15T12:00:00", "2026-10-15T12:00:00+01:00", "2026-13-01T00:00:00Z", "2026-04-31T00:00:00Z", "2026-02-29T00:00:00Z", "2026-10-15T24:00:00Z", 5, null]) {
      expect(parseUtcInstant(bad), String(bad)).toBeNull();
    }
    expect(parseUtcInstant("2028-02-29T00:00:00Z")).not.toBeNull();
  });
});

// ------------------------------------------------------------------ 6. Mappingtabell mot prototypen

describe("mappingtabell mot prototypens faktiske feltkatalog", () => {
  const require_ = createRequire(import.meta.url);
  // Testen leser prototypens data bare for å sjekke at tabellen er fullstendig; domenekoden importerer den aldri.
  const D = require_(join(__dirname, "../prototypes/merovo-search/js/data.js")) as {
    SECTIONS: { fields: { id: string }[]; advanced?: { fields: { id: string }[] } }[];
    EQUIPMENT_GROUPS: { id: string; items: [string, string][] }[];
  };
  const protoFields = D.SECTIONS.flatMap((s) => [...s.fields, ...(s.advanced?.fields ?? [])].map((f) => f.id));

  it("hvert prototypefelt og hver utstyrsgruppe har nøyaktig én rad, og tabellen har ingen overskuddsrader", () => {
    const rows = PROTOTYPE_MAPPING.filter((r) => r.kind === "field").map((r) => r.prototypeId);
    expect([...rows].sort()).toEqual([...protoFields].sort());
    expect(new Set(rows).size).toBe(rows.length);
    expect(PROTOTYPE_MAPPING.filter((r) => r.kind === "equipment_group").map((r) => r.prototypeId).sort()).toEqual(D.EQUIPMENT_GROUPS.map((g) => g.id).sort());
    expect(PROTOTYPE_MAPPING.filter((r) => r.kind === "budget").map((r) => r.prototypeId).sort()).toEqual(["budget.amount", "budget.costs", "budget.deviation"]);
  });

  it("støttede rader har modellfelt, øvrige har ingen; ingen tom begrunnelse", () => {
    for (const r of PROTOTYPE_MAPPING) {
      expect(r.note.length, r.prototypeId).toBeGreaterThan(10);
      expect(r.modelField === null, r.prototypeId).toBe(r.status !== "supported_now");
    }
  });

  it("den første operative mengden er nøyaktig det oppdraget beskriver", () => {
    const supported = PROTOTYPE_MAPPING.filter((r) => r.status === "supported_now" && r.kind === "field").map((r) => r.prototypeId).sort();
    expect(supported).toEqual(["body", "brand", "drive", "extColor", "firstReg", "fuel", "gear", "intColor", "material", "mileage", "model", "modelYear", "seats", "variant"].sort());
    expect(mappingFor("field", "freeText")?.status).toBe("not_relevant_for_matching");
    expect(mappingFor("field", "packages")?.status).toBe("planned_later");
    expect(mappingFor("field", "nonexistent")).toBeUndefined();
  });

  it("alle prototypens utstyrsnøkler er gyldige i en katalog bygget fra prototypens utstyrsgrupper (boolsk utstyr er støttet)", () => {
    const keys = D.EQUIPMENT_GROUPS.flatMap((g) => g.items.map(([k]) => k));
    expect(keys.length).toBeGreaterThan(30);
    // cruise/climate/towbar er ikke utstyrsnøkler i prototypen og kan derfor ikke forveksles
    for (const k of ["cruise", "climate", "towbar"]) expect(keys).not.toContain(k);
  });

  it("domenelaget importerer aldri prototypen (statisk kontroll)", () => {
    const dir = join(__dirname, "../src/domain/search-v2");
    for (const f of ["types", "validation", "evaluation", "budget", "serialization", "mapping", "catalog", "factory"]) {
      const text = readFileSync(join(dir, `${f}.ts`), "utf8");
      expect(text, f).not.toMatch(/from\s+["'][^"']*prototypes?\//);
      expect(text, f).not.toMatch(/require\(/);
      expect(text, f).not.toMatch(/\b(fetch|XMLHttpRequest|localStorage|document|window)\b\s*[.(]/);
      expect(text, f).not.toMatch(/Date\.now\(|new Date\(\)|Math\.random/);
    }
  });
});

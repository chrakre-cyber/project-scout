/**
 * SEARCH-003-FIX1 — regresjoner for Codex-funn F1 og F2 (feiler på 52dbcc1, består etter retting).
 *
 * F1: ustøttede valg skal ikke skjule feil i støttede verdier (katalog, intervaller, budsjett, kostnader).
 * F2: ustøttede felt skal valideres like grundig som støttede: valgmengder, grenser, rekkefølge, avhengigheter og
 *     kanonisk effekt. Gyldig men ustøttet → blocked. Skadet dokument → invalid. Aldri spec/JSON ved feil/blokkering.
 * Basisdokumentene er ekte eksporter fra prototypens logikk; formatreglene som er kopiert til adapteren
 * (FIELD_OPTIONS, grenser, effektkonvertering) sammenlignes med prototypens faktiske kode og katalog.
 */
import { createRequire } from "node:module";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { adaptPrototypeDraft } from "@/adapters/search-prototype/adapt";
import type { AdaptResult } from "@/adapters/search-prototype/adapt";
import { FIELD_OPTIONS, PROTOTYPE_FIELDS } from "@/adapters/search-prototype/fields";
import { mappingFor } from "@/domain/search-v2/mapping";
import { TEST_CATALOG } from "./fixtures/search-v2";

const require_ = createRequire(import.meta.url);
const PROTO = join(__dirname, "../prototypes/merovo-search/js");
/* eslint-disable @typescript-eslint/no-explicit-any */
const L: any = require_(join(PROTO, "logic.js"));
const D: any = require_(join(PROTO, "data.js"));
/* eslint-enable @typescript-eslint/no-explicit-any */
const NOW = new Date("2026-10-15T12:00:00Z");
const EXTRA = { plannedRegistration: "unspecified" } as const;

const empty = (): any => L.exportDraft(L.emptyState(), NOW).draft; // eslint-disable-line @typescript-eslint/no-explicit-any
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const run = (d: unknown, extra: unknown = EXTRA): AdaptResult => adaptPrototypeDraft(d, TEST_CATALOG, extra);
const codes = (r: AdaptResult) => (r.ok ? [] : r.issues.map((i) => `${i.path}:${i.code}`));
function deepFreeze<T>(x: T): T {
  if (typeof x === "object" && x !== null) { Object.values(x).forEach(deepFreeze); Object.freeze(x); }
  return x;
}
/** Felles invariant: ved feil/blokkering finnes hverken spec eller json, og input er uendret. */
function adaptChecked(doc: unknown, extra: unknown = EXTRA): AdaptResult {
  const frozen = deepFreeze(clone(doc));
  const before = JSON.stringify(frozen);
  const r = run(frozen, extra);
  expect(JSON.stringify(frozen)).toBe(before);
  if (!r.ok) { expect(r).not.toHaveProperty("spec"); expect(r).not.toHaveProperty("json"); }
  return r;
}

// ------------------------------------------------------------------ F1

describe("F1: støttede verdier valideres også når dokumentet har ustøttede valg", () => {
  it("Codex' reproduksjon: ukjent merke + utfylt land → invalid med feil på merket, og landet er fortsatt rapportert", () => {
    const d = empty(); d.criteria.brand = "invented-brand"; d.criteria.country = ["DE"];
    const r = adaptChecked(d);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.kind).toBe("invalid");
    expect(codes(r)).toContain("vehicle.brand:unknown_brand");
    expect(r.unsupported.map((u) => u.prototypeId)).toEqual(["country"]);
  });

  it("feil merke/modell, intervall, budsjett, kostnad og katalogvalg + gyldig ustøttet valg → invalid, ustøttet listet", () => {
    const cases: [string, (d: any) => void, string][] = [ // eslint-disable-line @typescript-eslint/no-explicit-any
      ["modell fra annet merke", (d) => { d.criteria.brand = "bmw"; d.criteria.model = "gls"; }, "vehicle.model:unknown_model"],
      ["modell uten merke", (d) => { d.criteria.model = "gls"; }, "vehicle.model:model_requires_brand"],
      ["variant uten modell", (d) => { d.criteria.variant = "AMG"; }, "vehicle.variant:variant_requires_model"],
      ["seter-intervall omvendt", (d) => { d.criteria.seats = { from: 9, to: 3, unit: "seter" }; }, "criteria.seats:min_above_max"],
      ["modellår feil enhet", (d) => { d.criteria.modelYear = { from: 2021, to: null, unit: "år " }; }, "criteria.modelYear:wrong_unit"],
      ["registrering omvendt", (d) => { d.criteria.firstReg = { from: "2023", to: "2021-01", format: "ÅÅÅÅ[-MM]" }; }, "requirements.firstRegistration:from_after_to"],
      ["ukjent drivstoff", (d) => { d.criteria.fuel = ["steam"]; }, "criteria.fuel[0]:unknown_option"],
      ["ukjent farge i katalogen", (d) => { d.criteria.extColor = ["plaid"]; }, ""],
      ["budsjett 0", (d) => { d.budget.maxPurchaseCost = { amountMinor: "0", currency: "NOK" }; }, ""],
      ["budsjett feil valuta", (d) => { d.budget.maxPurchaseCost = { amountMinor: "100", currency: "EUR" }; }, "budget.maxPurchaseCost.currency:currency_not_nok"],
      ["kostnad med feil kind", (d) => { d.budget.costs[0].kind = "ferry"; }, "budget.costs[0].kind:invalid_kind"],
      ["kostnad uten gyldig valuta", (d) => { d.budget.costs[0].currency = "ZZZ"; }, "budget.costs[0].currency:unsupported_currency"],
      ["ukjent utstyr", (d) => { d.equipment.teleporter = { priority: "must" }; }, "equipment.teleporter:unknown_equipment"],
      ["ugyldig utstyrsprioritet", (d) => { d.equipment.carplay = { priority: "maybe" }; }, "equipment.carplay.priority:invalid_priority"],
    ];
    for (const [name, mutate, expected] of cases) {
      const d = empty();
      d.criteria.country = ["DE"]; // gyldig, ustøttet
      d.criteria.doors = "4-5";
      mutate(d);
      const r = adaptChecked(d, { plannedRegistration: "unspecified", listPriorities: { extColor: "must" } });
      expect(r.ok, name).toBe(false);
      if (r.ok) continue;
      expect(r.kind, name).toBe("invalid");
      expect(r.issues.length, name).toBeGreaterThan(0);
      if (expected) expect(codes(r), name).toContain(expected);
      expect(r.unsupported.map((u) => u.prototypeId).sort(), name).toEqual(["country", "doors"]);
    }
  });

  it("manglende tilleggsinput (scenario/listeprioritet) rapporteres sammen med ustøttede valg, ikke som blokkert", () => {
    const d = empty(); d.criteria.country = ["DE"]; d.criteria.extColor = ["black"];
    const r = adaptChecked(d, {});
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.kind).toBe("invalid");
    expect(codes(r)).toEqual(expect.arrayContaining(["extra.plannedRegistration:missing_input", "extra.listPriorities.extColor:missing_input"]));
    expect(r.unsupported.map((u) => u.prototypeId)).toEqual(["country"]);
  });

  it("flere feil i både støttede og ustøttede felt rapporteres samlet med riktige stier", () => {
    const d = empty();
    d.criteria.brand = "nope";
    d.criteria.displacement = { from: 4000, to: 1000, unit: "cm³" };
    d.criteria.vat = "bogus";
    d.criteria.country = ["DE"];
    const r = adaptChecked(d);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.kind).toBe("invalid");
    expect(codes(r).sort()).toEqual(["criteria.displacement:min_above_max", "criteria.vat:unknown_option", "vehicle.brand:unknown_brand"]);
    expect(r.unsupported.map((u) => u.prototypeId)).toEqual(["country"]);
  });

  it("uten feil i støttede verdier er et gyldig, men ustøttet valg fortsatt blocked", () => {
    const d = empty(); d.criteria.brand = "mercedes-benz"; d.criteria.model = "gls"; d.criteria.country = ["DE"];
    const r = adaptChecked(d);
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.kind).toBe("blocked"); expect(r.issues).toEqual([]); }
  });
});

// ------------------------------------------------------------------ F2

interface Case { id: string; valid: unknown; bad: [string, unknown, string][] }
const U = "criteria.";
const CASES: Case[] = [
  { id: "doors", valid: "4-5", bad: [["ukjent valg", "7-8", "unknown_option"], ["ikke tekst", 4, "not_string"]] },
  { id: "sliding", valid: "right", bad: [["ukjent valg", "up", "unknown_option"]] },
  { id: "newUsed", valid: "new", bad: [["ukjent valg", "old", "unknown_option"]] },
  { id: "damage", valid: "exclude", bad: [["ukjent valg", "x", "unknown_option"]] },
  { id: "vat", valid: "specifiable", bad: [["ukjent valg", "invented-option", "unknown_option"]] },
  { id: "certification", valid: "bmw-ps", bad: [["ukjent valg", "x", "unknown_option"]] },
  { id: "adAge", valid: "7", bad: [["ukjent valg", "30", "unknown_option"]] },
  { id: "towbar", valid: "any", bad: [["ukjent valg", "x", "unknown_option"], ["tom verdi finnes ikke", "", "unknown_option"]] },
  { id: "cruise", valid: "adaptive", bad: [["ukjent valg", "x", "unknown_option"]] },
  { id: "climate", valid: "auto", bad: [["ukjent valg", "x", "unknown_option"]] },
  ...["euro", "extFinish", "service", "warranty", "prevUse", "seller", "country"].map((id): Case => ({
    id, valid: [FIELD_OPTIONS[id]![0]!],
    bad: [["ukjent valg", ["Z-ukjent"], "unknown_option"], ["duplikat", [FIELD_OPTIONS[id]![0]!, FIELD_OPTIONS[id]![0]!], "invalid_value"], ["ikke liste", FIELD_OPTIONS[id]![0]!, "invalid_value"]],
  })),
  { id: "displacement", valid: { from: 1000, to: 4000, unit: "cm³" }, bad: [
    ["omvendt (Codex)", { from: 4000, to: 1000, unit: "cm³" }, "min_above_max"], ["under grense", { from: 49, to: null, unit: "cm³" }, "out_of_range"],
    ["over grense", { from: null, to: 10001, unit: "cm³" }, "out_of_range"], ["feil enhet", { from: 1000, to: null, unit: "cc" }, "wrong_unit"], ["ikke heltall", { from: 1000.5, to: null, unit: "cm³" }, "out_of_range"]] },
  { id: "cylinders", valid: { from: 4, to: 8, unit: "sylindre" }, bad: [["omvendt", { from: 8, to: 4, unit: "sylindre" }, "min_above_max"], ["over grense", { from: 4, to: 17, unit: "sylindre" }, "out_of_range"]] },
  { id: "trailerBraked", valid: { value: 1000, unit: "kg", bound: "min" }, bad: [["under grense", { value: 0, unit: "kg", bound: "min" }, "out_of_range"], ["over grense", { value: 10001, unit: "kg", bound: "min" }, "out_of_range"], ["feil grense", { value: 1000, unit: "kg", bound: "max" }, "wrong_bound"], ["feil enhet", { value: 1000, unit: "t", bound: "min" }, "wrong_unit"]] },
  { id: "noseWeight", valid: { value: 50, unit: "kg", bound: "min" }, bad: [["over grense", { value: 501, unit: "kg", bound: "min" }, "out_of_range"]] },
  { id: "owners", valid: { value: 0, unit: "eiere", bound: "max" }, bad: [["over grense", { value: 21, unit: "eiere", bound: "max" }, "out_of_range"], ["negativ", { value: -1, unit: "eiere", bound: "max" }, "out_of_range"]] },
  { id: "inspection", valid: "2030-01", bad: [["bare år", "2030", "invalid_value"], ["måned 13", "2030-13", "invalid_value"], ["kort år", "30-01", "invalid_value"], ["ikke tekst", 5, "invalid_value"]] },
  { id: "freeText", valid: "tekst", bad: [["for lang", "x".repeat(201), "invalid_value"], ["ikke tekst", 5, "invalid_value"]] },
  { id: "weight", valid: { type: "curb", max: 1000, unit: "kg" }, bad: [
    ["ukjent type", { type: "net", max: 1000, unit: "kg" }, "invalid_value"], ["under grense", { type: "curb", max: 99, unit: "kg" }, "out_of_range"],
    ["over grense", { type: "gross", max: 10001, unit: "kg" }, "out_of_range"], ["verdi uten vekttype", { type: "", max: 1000, unit: "kg" }, "missing_dependency"], ["feil enhet", { type: "curb", max: 1000, unit: "lb" }, "wrong_unit"]] },
  { id: "consumption", valid: { unit: "l100", max: "8", perUnit: "100 km" }, bad: [
    ["over maksimum 100 (Codex)", { unit: "l100", max: "999.9", perUnit: "100 km" }, "out_of_range"], ["like over 100", { unit: "l100", max: "100.1", perUnit: "100 km" }, "out_of_range"],
    ["null", { unit: "l100", max: "0", perUnit: "100 km" }, "out_of_range"], ["for mange desimaler", { unit: "l100", max: "8.55", perUnit: "100 km" }, "invalid_value"],
    ["ikke tall", { unit: "l100", max: "abc", perUnit: "100 km" }, "invalid_value"], ["verdi uten enhet", { unit: "", max: "8", perUnit: "100 km" }, "missing_dependency"],
    ["ukjent enhet", { unit: "mpg", max: "8", perUnit: "100 km" }, "wrong_unit"], ["feil perUnit", { unit: "l100", max: "8", perUnit: "100 mi" }, "wrong_unit"]] },
  { id: "power", valid: { unit: "kW", from: 100, to: 200, approxKw: { from: 100, to: 200 }, normalizedWatts: { from: 100000, to: 200000 } }, bad: [
    ["omvendt intervall", { unit: "kW", from: 300, to: 200, approxKw: { from: 300, to: 200 }, normalizedWatts: { from: 300000, to: 200000 } }, "min_above_max"],
    ["ukjent enhet", { unit: "PS", from: 100, to: null, approxKw: { from: 100, to: null }, normalizedWatts: { from: 100000, to: null } }, "wrong_unit"],
    ["over kW-grense", { unit: "kW", from: 2201, to: null, approxKw: { from: 2201, to: null }, normalizedWatts: { from: 2201000, to: null } }, "out_of_range"],
    ["over hk-grense", { unit: "hk", from: 3001, to: null, approxKw: { from: 2207, to: null }, normalizedWatts: { from: 2207000, to: null } }, "out_of_range"],
    ["normalizedWatts stemmer ikke", { unit: "kW", from: 100, to: 200, approxKw: { from: 100, to: 200 }, normalizedWatts: { from: 100600, to: 200000 } }, "inconsistent"],
    ["approxKw stemmer ikke", { unit: "kW", from: 100, to: 200, approxKw: { from: 99, to: 200 }, normalizedWatts: { from: 100000, to: 200000 } }, "inconsistent"],
    ["watt uten verdi", { unit: "kW", from: null, to: 200, approxKw: { from: null, to: 200 }, normalizedWatts: { from: 5, to: 200000 } }, "inconsistent"]] },
];

describe("F2: ustøttede felt valideres fullt ut (gyldig → blocked, skadet → invalid)", () => {
  for (const c of CASES) {
    it(`${c.id}: gyldig verdi er blocked; ${c.bad.length} skadede varianter er invalid med feilsti til feltet`, () => {
      expect(mappingFor("field", c.id)?.status, "feltet er ustøttet").not.toBe("supported_now");
      const ok = empty(); ok.criteria[c.id] = c.valid;
      const r0 = adaptChecked(ok);
      expect(r0.ok).toBe(false);
      if (!r0.ok) { expect(r0.kind, `${c.id} gyldig: ${JSON.stringify(r0.issues)}`).toBe("blocked"); expect(r0.unsupported.map((u) => u.prototypeId)).toEqual([c.id]); }
      for (const [name, value, code] of c.bad) {
        const d = empty(); d.criteria[c.id] = value;
        const r = adaptChecked(d);
        expect(r.ok, name).toBe(false);
        if (r.ok) continue;
        expect(r.kind, `${c.id} ${name}`).toBe("invalid");
        const hit = r.issues.find((i) => i.path.startsWith(U + c.id) && i.code === code);
        expect(hit, `${c.id} ${name}: forventet ${code}, fikk ${JSON.stringify(r.issues)}`).toBeTruthy();
        // det skadede feltet er ikke samtidig meldt som gyldig ustøttet valg
        expect(r.unsupported.some((u) => u.prototypeId === c.id), `${c.id} ${name}`).toBe(false);
      }
    });
  }

  it("Codex' tre reproduksjoner fra F2", () => {
    for (const [id, v] of [["displacement", { from: 4000, to: 1000, unit: "cm³" }], ["consumption", { unit: "l100", max: "999.9", perUnit: "100 km" }], ["vat", "invented-option"]] as const) {
      const d = empty(); d.criteria[id] = v;
      const r = adaptChecked(d);
      expect(!r.ok && r.kind).toBe("invalid");
    }
  });

  it("pakker: krever valgt modell; må være liste av korte tekster (pakkenavn kan ikke valideres uten pakkekatalog)", () => {
    const base = (): any => { const d = empty(); d.criteria.brand = "mercedes-benz"; d.criteria.model = "gls"; d.criteria.packages = ["AMG Line"]; return d; }; // eslint-disable-line @typescript-eslint/no-explicit-any
    const r = adaptChecked(base());
    expect(!r.ok && r.kind).toBe("blocked");
    const noModel = base(); delete noModel.criteria.model; delete noModel.criteria.brand;
    expect(codes(adaptChecked(noModel))).toContain("criteria.packages:missing_dependency");
    const modelOnly = base(); delete modelOnly.criteria.brand;
    expect(codes(adaptChecked(modelOnly))).toEqual(["vehicle.model:model_requires_brand"]); // pakken har modell; modellen mangler merke
    for (const bad of ["AMG", [5], Array(11).fill("x"), ["x".repeat(61)], ["a", "a"]]) {
      const d = base(); d.criteria.packages = bad;
      const x = adaptChecked(d);
      expect(!x.ok && x.kind, JSON.stringify(bad).slice(0, 40)).toBe("invalid");
    }
  });

  it("tom ustøttet verdi (prototypens «alle»/tom) er ikke utfylt og blokkerer ikke, selv med en feil andre steder", () => {
    const d = empty();
    Object.assign(d.criteria, { doors: "", sliding: "", damage: "", vat: "", euro: [], country: [], weight: { type: "", max: null, unit: "kg" }, consumption: { unit: "", max: null, perUnit: "100 km" }, displacement: { from: null, to: null, unit: "cm³" } });
    expect(adaptChecked(d).ok).toBe(true);
    d.criteria.brand = "nope";
    const r = adaptChecked(d);
    expect(!r.ok && r.kind).toBe("invalid");
    expect(!r.ok && r.unsupported).toEqual([]);
  });
});

// ------------------------------------------------------------------ kopierte formatregler mot prototypen

describe("kopierte formatregler samsvarer med prototypens faktiske kode og katalog", () => {
  const fields: any[] = D.SECTIONS.flatMap((s: any) => [...s.fields, ...(s.advanced?.fields ?? [])]); // eslint-disable-line @typescript-eslint/no-explicit-any

  it("FIELD_OPTIONS er nøyaktig prototypens valgmengder (uten «alle»), og alle valgfelt er dekket", () => {
    const withOptions = fields.filter((f) => ["multi", "colors", "select", "radio", "towbar", "equipSelect"].includes(f.kind) && Array.isArray(f.options));
    expect(withOptions.length).toBeGreaterThan(20);
    expect(Object.keys(FIELD_OPTIONS).sort()).toEqual(withOptions.map((f) => f.id).sort());
    for (const f of withOptions) expect([...FIELD_OPTIONS[f.id]!], f.id).toEqual(f.options.map((o: any) => o.v).filter((v: string) => v !== "")); // eslint-disable-line @typescript-eslint/no-explicit-any
    // vekttyper og forbruksenheter
    expect(L.WEIGHT_TYPES.map((o: any) => o.v)).toEqual(["curb", "gross"]); // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(L.CONSUMPTION_UNITS.map((o: any) => o.v)).toEqual(["l100", "kwh100"]); // eslint-disable-line @typescript-eslint/no-explicit-any
  });

  it("grenser for tallfelt, vekt, forbruk og effekt avgjør samme tilfeller som prototypens egen validering", () => {
    // Prototypen avviser verdiene i sin egen validate(); adapteren skal avvise nøyaktig de samme (invalid), og godta grensene.
    const accepted = (id: string, value: unknown) => { const d = empty(); d.criteria[id] = value; const r = run(d); return r.ok || r.kind === "blocked"; };
    const protoOk = (set: (s: any) => void) => { const s = L.emptyState(); set(s); return L.errorCount(L.validate(s)) === 0; }; // eslint-disable-line @typescript-eslint/no-explicit-any
    for (const [n, text] of [["49", "49"], ["50", "50"], ["10000", "10 000"], ["10001", "10001"]] as const) {
      expect(accepted("displacement", { from: Number(n), to: null, unit: "cm³" }), n).toBe(protoOk((s) => { s.values.displacement = { from: text, to: "" }; }));
    }
    for (const m of ["0.1", "0", "100", "100.1", "99.9", "999.9", "0.0"]) {
      expect(accepted("consumption", { unit: "l100", max: m, perUnit: "100 km" }), m).toBe(protoOk((s) => { s.values.consumption = { unit: "l100", max: m.replace(".", ",") }; }));
    }
    for (const w of [99, 100, 10000, 10001]) {
      expect(accepted("weight", { type: "curb", max: w, unit: "kg" }), String(w)).toBe(protoOk((s) => { s.values.weight = { type: "curb", max: String(w) }; }));
    }
    expect(accepted("weight", { type: "", max: 1000, unit: "kg" })).toBe(protoOk((s) => { s.values.weight = { type: "", max: "1000" }; }));
    expect(accepted("consumption", { unit: "", max: "8", perUnit: "100 km" })).toBe(protoOk((s) => { s.values.consumption = { unit: "", max: "8" }; }));
    for (const [from, to] of [[100, 200], [200, 100], [100, 100]] as const) {
      expect(accepted("cylinders", { from: Math.min(from, 16), to: Math.min(to, 16) > 0 ? Math.min(to, 16) : null, unit: "sylindre" })).toBe(protoOk((s) => { s.values.cylinders = { from: String(Math.min(from, 16)), to: String(Math.min(to, 16)) }; }));
    }
  });

  it("PROTOTYPE_FIELDS dekker fortsatt alle felt (ingen nye prototypefelt uten adapterregler)", () => {
    expect(PROTOTYPE_FIELDS.map((f) => f.id)).toEqual(fields.map((f) => f.id));
  });
});

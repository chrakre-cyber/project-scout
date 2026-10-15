/**
 * SEARCH-003 — adapter fra prototypens eksportformat (merovo.search-draft v2) til søkemodell v1.
 *
 * Kontrakttestene bruker EKTE eksportdokumenter laget av prototypens egen logikk (`logic.js` `exportDraft`),
 * ikke håndskrevne eksempler som speiler adapteren. Prototypefilene leses bare av testen; adapteren importerer dem aldri.
 * Forventede verdier er utledet uavhengig (hånd-regnet øre, kjente utfall).
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PROTOTYPE_FIELDS } from "@/adapters/search-prototype/fields";
import { adaptPrototypeDraft } from "@/adapters/search-prototype/adapt";
import type { AdaptResult } from "@/adapters/search-prototype/adapt";
import { upperLimitMinor } from "@/domain/search-v2/budget";
import { evaluateCandidate } from "@/domain/search-v2/evaluation";
import { emptySpec } from "@/domain/search-v2/factory";
import { PROTOTYPE_MAPPING, mappingFor } from "@/domain/search-v2/mapping";
import { specFromJson, specToJson } from "@/domain/search-v2/serialization";
import { staticCatalog } from "@/domain/search-v2/catalog";
import { glsCandidate } from "./fixtures/search-v2";

const require_ = createRequire(import.meta.url);
const PROTO = join(__dirname, "../prototypes/merovo-search/js");
/* eslint-disable @typescript-eslint/no-explicit-any */
const L: any = require_(join(PROTO, "logic.js"));
const D: any = require_(join(PROTO, "data.js"));
/* eslint-enable @typescript-eslint/no-explicit-any */

type Field = { id: string; kind: string; label: string; options?: { v: string }[]; unit?: string; min?: number; max?: number; minimum?: boolean; max_?: number };
const ALL_FIELDS: Field[] = D.SECTIONS.flatMap((s: { fields: Field[]; advanced?: { fields: Field[] } }) => [...s.fields, ...(s.advanced?.fields ?? [])]);

/** Katalog bygget fra prototypens faktiske demokatalog (test-fixtur, ikke produksjonsfasit). */
const optionsOf = (id: string): string[] => (ALL_FIELDS.find((f) => f.id === id)?.options ?? []).map((o) => o.v);
const CATALOG = staticCatalog({
  id: "prototype-demo-catalog-test",
  brands: Object.fromEntries(D.BRANDS.map((b: { v: string }) => [b.v, (D.MODELS[b.v] ?? []).map((m: { v: string }) => m.v)])),
  equipment: D.EQUIPMENT_GROUPS.flatMap((g: { items: [string, string][] }) => g.items.map(([k]) => k)),
  exteriorColors: D.EXT_COLORS.map((c: { v: string }) => c.v),
  interiorColors: D.INT_COLORS.map((c: { v: string }) => c.v),
  interiorMaterials: optionsOf("material"),
});
const NOW = new Date("2026-10-15T12:00:00Z");
const EXTRA = { plannedRegistration: "passenger", listPriorities: { extColor: "must", intColor: "nice", material: "must" } } as const;

/** Ekte eksport fra prototypens logikk. */
function exportOf(mutate: (s: any) => void = () => {}): any { // eslint-disable-line @typescript-eslint/no-explicit-any
  const s = L.emptyState();
  mutate(s);
  const r = L.exportDraft(s, NOW);
  if (!r.ok) throw new Error("prototypen godtok ikke utkastet: " + JSON.stringify(r.errors));
  return r.draft;
}
const adapt = (doc: unknown, ...rest: unknown[]): AdaptResult => adaptPrototypeDraft(doc, CATALOG, rest.length ? rest[0] : EXTRA);
function ok(r: AdaptResult) {
  if (!r.ok) throw new Error("forventet ok: " + JSON.stringify({ kind: r.kind, issues: r.issues, unsupported: r.unsupported }));
  return r;
}
function fail(r: AdaptResult) {
  if (r.ok) throw new Error("forventet feil");
  return r;
}
const codes = (r: AdaptResult) => fail(r).issues.map((i) => `${i.path}:${i.code}`);
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
function deepFreeze<T>(x: T): T {
  if (typeof x === "object" && x !== null) { Object.values(x).forEach(deepFreeze); Object.freeze(x); }
  return x;
}

/** Et begrenset GLS-utkast med bare støttede kriterier. */
function glsDraft(): any { // eslint-disable-line @typescript-eslint/no-explicit-any
  return exportOf((s) => {
    const v = s.values;
    v.brand = "mercedes-benz"; v.model = "gls"; v.variant = "GLS 450 d 4MATIC (fritekst, ikke i noen forslagsliste)";
    v.modelYear = { from: "2021", to: "" };
    v.firstReg = { from: "2021-06", to: "2023" };
    v.mileage = "150000";
    v.body = ["suv"]; v.seats = { from: "7", to: "7" };
    v.fuel = ["diesel", "plugin_hybrid"]; v.gear = ["automatic"]; v.drive = ["awd"];
    v.extColor = ["black", "white"]; v.intColor = ["beige"]; v.material = ["leather"];
    s.eq.camera_360 = "must"; s.eq.carplay = "must"; s.eq.panoramic_roof = "nice"; s.eq.air_suspension = "nice";
    s.budget.amount = "750 000"; s.budget.deviationOn = true; s.budget.deviation = "10";
    s.budget.costs[0].currency = "EUR"; s.budget.costs[0].included = true; // transport: ukjent beløp i EUR
    s.budget.costs[2].amount = "0"; s.budget.costs[2].vat = "none"; // forsikring: uttrykkelig 0
    const c = L.newCost("Tollagring", ""); c.amount = "2 000"; c.currency = "EUR"; c.vat = "excl"; c.included = true;
    s.budget.costs.push(c);
  });
}

// ------------------------------------------------------------------ 1. vellykket konvertering

describe("vellykket konvertering av et begrenset GLS-utkast (ekte eksport)", () => {
  const doc = glsDraft();
  const r = ok(adapt(doc));

  it("bilidentitet, krav og lister overføres uten oppdiktede verdier", () => {
    const s = r.spec;
    expect(s.vehicle).toEqual({ brand: "mercedes-benz", model: "gls", variant: "GLS 450 d 4MATIC (fritekst, ikke i noen forslagsliste)" });
    expect(s.requirements.modelYear).toEqual({ min: 2021, max: null });
    expect(s.requirements.firstRegistration).toEqual({ from: { precision: "month", year: 2021, month: 6 }, to: { precision: "year", year: 2023 } });
    expect(s.requirements.maxMileageKm).toBe(150000);
    expect(s.requirements.seats).toEqual({ min: 7, max: 7 });
    expect(s.requirements.bodyTypes).toEqual(["suv"]);
    expect(s.requirements.fuels).toEqual(["diesel", "plugin_hybrid"]);
    expect(s.requirements.transmissions).toEqual(["automatic"]);
    expect(s.requirements.driveTrains).toEqual(["awd"]);
    expect(r.origin).toBe("user");
  });

  it("utstyr beholder må-ha/ønskelig per element; lister får eksplisitt tilleggsprioritet", () => {
    expect(r.spec.equipment).toEqual([
      { key: "camera_360", priority: "must" }, { key: "carplay", priority: "must" },
      { key: "panoramic_roof", priority: "nice" }, { key: "air_suspension", priority: "nice" },
    ].sort((a, b) => Object.keys(doc.equipment).indexOf(a.key) - Object.keys(doc.equipment).indexOf(b.key)));
    expect(r.spec.appearance.exteriorColors).toEqual({ values: ["black", "white"], priority: "must" });
    expect(r.spec.appearance.interiorColors).toEqual({ values: ["beige"], priority: "nice" });
    expect(r.spec.appearance.interiorMaterials).toEqual({ values: ["leather"], priority: "must" });
  });

  it("budsjett 750 000 kr + 10 % = 825 000 kr i øre/basispunkter; kostnadslinjer bevart uten å øke grensen", () => {
    expect(r.spec.budget.maxTotalNokMinor).toBe(75_000_000n);
    expect(r.spec.budget.deviationBasisPoints).toBe(1000);
    expect(upperLimitMinor(r.spec.budget)).toBe(82_500_000n);
    const byId = Object.fromEntries(r.spec.budget.costs.map((x) => [x.id, x]));
    expect(Object.keys(byId)).toEqual(["transport", "travel", "insurance", "prep", "custom-1"]);
    expect(byId.transport).toMatchObject({ kind: "transport", currency: "EUR", amountMinor: null, includedInBudget: true, vatBasis: null });
    expect(byId.travel).toMatchObject({ currency: "NOK", amountMinor: null, includedInBudget: false });
    expect(byId.insurance).toMatchObject({ currency: "NOK", amountMinor: 0n, vatBasis: "none" });
    expect(byId.prep).toMatchObject({ kind: "preparation", amountMinor: null });
    expect(byId["custom-1"]).toMatchObject({ kind: "custom", label: "Tollagring", currency: "EUR", amountMinor: 200_000n, vatBasis: "excl", includedInBudget: true });
    expect(upperLimitMinor({ ...r.spec.budget, costs: [] })).toBe(82_500_000n);
  });

  it("planlagt registrering kommer bare fra tilleggsinput", () => {
    expect(r.spec.plannedRegistration).toEqual({ requested: "passenger" });
  });

  it("domenets JSON → import gir samme betydning (rundtur)", () => {
    expect(r.json.schema).toBe("merovo.search-model");
    expect(r.json.modelVersion).toBe(1);
    expect(r.json.budget.maxTotal).toEqual({ amountMinor: "75000000", currency: "NOK" });
    const back = specFromJson(JSON.parse(JSON.stringify(r.json)), CATALOG);
    expect(back.ok && back.value).toEqual(r.spec);
    // eksisterende serialisering gir samme JSON
    const again = specToJson(r.spec, CATALOG);
    expect(again.ok && again.value).toEqual(r.json);
  });

  it("original input er uendret og resultatet deler ingen referanser med den", () => {
    const frozen = deepFreeze(clone(doc));
    const before = JSON.stringify(frozen);
    const res = ok(adapt(frozen));
    expect(JSON.stringify(frozen)).toBe(before);
    res.spec.requirements.bodyTypes.push("sedan");
    expect(JSON.stringify(frozen)).toBe(before);
  });

  it("«ønskelig» er ikke et krav: en bil uten ønsket utstyr ekskluderes ikke og får ikke kontrollbehov", () => {
    const c = glsCandidate("x", { equipment: { present: ["camera_360", "carplay"], absent: ["panoramic_roof", "air_suspension"], listComplete: true } });
    const spec = { ...r.spec, requirements: { ...r.spec.requirements, modelYear: null, firstRegistration: null, maxMileageKm: null, seats: null, bodyTypes: [], fuels: [], transmissions: [], driveTrains: [] }, appearance: { exteriorColors: null, interiorColors: null, interiorMaterials: null }, vehicle: { brand: "mercedes-benz", model: "gls", variant: null } };
    const ev = evaluateCandidate(spec, c);
    expect(ev.status).toBe("match");
    expect(ev.wishes.notFulfilled).toEqual(["equipment:panoramic_roof", "equipment:air_suspension"]);
  });
});

describe("prototypens «Fyll ut GLS-eksempel» (faktisk eksempeltilstand)", () => {
  const doc = (() => { const r = L.exportDraft(L.exampleState(), NOW); return r.draft; })();

  it("inneholder ingen utfylte ustøttede valg (alle kriterier er støttet) — kartlagt mot mappingtabellen", () => {
    const filled = Object.keys(doc.criteria);
    expect(filled.sort()).toEqual(["brand", "extColor", "model", "modelYear", "seats"]);
    for (const id of filled) expect(mappingFor("field", id)?.status, id).toBe("supported_now");
    for (const key of Object.keys(doc.equipment)) expect(CATALOG.hasEquipment(key), key).toBe(true);
    expect(doc.origin).toBe("demo-example");
  });

  it("uten fargeprioritet feiler konverteringen (ingen standard); med prioritet gir den 825 000 kr-grense", () => {
    expect(codes(adapt(doc, { plannedRegistration: "unspecified" }))).toContain("extra.listPriorities.extColor:missing_input");
    const r = ok(adapt(doc, { plannedRegistration: "unspecified", listPriorities: { extColor: "nice" } }));
    expect(r.origin).toBe("demo-example");
    expect(r.spec.appearance.exteriorColors).toEqual({ values: ["black", "white"], priority: "nice" });
    expect(upperLimitMinor(r.spec.budget)).toBe(82_500_000n);
    expect(r.spec.equipment.map((e) => `${e.key}:${e.priority}`).sort()).toEqual(
      ["air_suspension:nice", "camera_360:must", "carplay:must", "heated_seats_front:nice", "panoramic_roof:nice"],
    );
  });
});

// ------------------------------------------------------------------ 2. blokkering av ustøttede valg

/** Gyldig utfylt eksempelverdi for ethvert prototypefelt (utledet fra prototypens egen katalog). */
function sampleValue(f: Field, s: any): void { // eslint-disable-line @typescript-eslint/no-explicit-any
  const opts = (f.options ?? []).map((o) => o.v).filter((v) => v !== "");
  switch (f.kind) {
    case "brand": s.values.brand = "mercedes-benz"; break;
    case "model": s.values.brand = "mercedes-benz"; s.values.model = "gls"; break;
    case "variant": s.values.brand = "mercedes-benz"; s.values.model = "gls"; s.values.variant = "GLS 450 4MATIC"; break;
    case "packages": s.values.brand = "mercedes-benz"; s.values.model = "gls"; s.values.packages = ["AMG Line"]; break;
    case "range": s.values[f.id] = { from: String(f.min), to: "" }; break;
    case "max": s.values[f.id] = String(f.min); break;
    case "regrange": s.values[f.id] = { from: "2021-06", to: "" }; break;
    case "month": s.values[f.id] = "2030-01"; break;
    case "text": s.values[f.id] = "tekst"; break;
    case "weight": s.values[f.id] = { type: "curb", max: "1000" }; break;
    case "consumption": s.values[f.id] = { unit: "l100", max: "8" }; break;
    case "power": s.values[f.id] = { unit: "kw", from: "100", to: "", fromW: null, toW: null }; break;
    case "multi": case "colors": s.values[f.id] = [opts[0]]; break;
    case "select": case "radio": case "towbar": case "equipSelect": s.values[f.id] = opts[0]; break;
    default: throw new Error("ukjent felttype i prototypen: " + f.kind);
  }
}

describe("ustøttede, utfylte valg blokkeres systematisk mot mappingtabellen", () => {
  const unsupportedFields = ALL_FIELDS.filter((f) => mappingFor("field", f.id)?.status !== "supported_now");

  it("alle prototypens felt finnes i adapterens felttabell og mappingtabellen, og omvendt (katalogendring gir ikke stille bortfall)", () => {
    expect(ALL_FIELDS.length).toBeGreaterThan(40);
    expect(PROTOTYPE_FIELDS.map((f) => f.id)).toEqual(ALL_FIELDS.map((f) => f.id));
    expect(PROTOTYPE_MAPPING.filter((r) => r.kind === "field").map((r) => r.prototypeId).sort()).toEqual(ALL_FIELDS.map((f) => f.id).sort());
    for (const f of ALL_FIELDS) {
      const t = PROTOTYPE_FIELDS.find((x) => x.id === f.id)!;
      const isText = f.kind === "text";
      expect({ id: t.id, label: t.label, kind: t.kind, unit: t.unit, min: t.min, max: t.max }, f.id).toEqual({
        id: f.id, label: f.label, kind: f.kind, unit: f.unit, min: f.min, max: isText ? undefined : f.max,
      });
      if (isText) expect(t.maxLength, f.id).toBe(f.max);
      if (f.kind === "variant") expect(t.maxLength, f.id).toBe(60);
      if (f.kind === "max") expect(t.minimum, f.id).toBe(Boolean(f.minimum));
    }
  });

  for (const f of unsupportedFields) {
    it(`${f.id} («${f.label}») utfylt → blokkert med feltsti, visningsnavn og grunn; ingen spec`, () => {
      const doc = exportOf((s) => sampleValue(f, s));
      expect(f.id in doc.criteria, "eksport inneholder feltet").toBe(true);
      const res = adapt(doc);
      const r = fail(res);
      const row = mappingFor("field", f.id)!;
      expect(r.kind).toBe("blocked");
      expect(r.issues).toEqual([]);
      const mine = r.unsupported.filter((u) => u.prototypeId === f.id);
      expect(mine).toEqual([{ path: `criteria.${f.id}`, prototypeId: f.id, label: f.label, status: row.status, reason: row.note }]);
      expect(res).not.toHaveProperty("spec");
      expect(res).not.toHaveProperty("json");
    });
  }

  it("flere ustøttede felt rapporteres samlet, og tomme felt blokkerer ikke", () => {
    const doc = exportOf((s) => { sampleValue(ALL_FIELDS.find((f) => f.id === "doors")!, s); sampleValue(ALL_FIELDS.find((f) => f.id === "power")!, s); s.values.vat = ""; s.values.damage = ""; });
    const r = fail(adapt(doc));
    expect(r.unsupported.map((u) => u.prototypeId).sort()).toEqual(["doors", "power"]);
  });

  it("0 er utfylt (Tidligere eiere maks 0 blokkerer); tom streng/tom liste/null er ikke utfylt", () => {
    const zero = exportOf((s) => { s.values.owners = "0"; });
    expect(zero.criteria.owners.value).toBe(0);
    expect(fail(adapt(zero)).unsupported.map((u) => u.prototypeId)).toEqual(["owners"]);
    const empty = clone(glsDraft());
    empty.criteria.owners = { value: null, unit: "eiere", bound: "max" };
    empty.criteria.doors = "";
    empty.criteria.packages = [];
    empty.criteria.cruise = "";
    empty.criteria.damage = "";
    empty.criteria.inspection = "";
    ok(adapt(empty));
  });

  it("blokkert resultat gjelder også «ikke relevant for matching» (freeText)", () => {
    const r = fail(adapt(exportOf((s) => { s.values.freeText = "søk i tekst"; })));
    expect(r.unsupported).toEqual([expect.objectContaining({ prototypeId: "freeText", status: "not_relevant_for_matching" })]);
  });

  it("hengerfeste/cruise/klima blokkeres via kriteriet; prioriteten alene gir feil", () => {
    const doc = exportOf((s) => { s.values.cruise = "adaptive"; });
    expect(doc.equipment.cruise).toEqual({ priority: "must" });
    expect(fail(adapt(doc)).unsupported.map((u) => u.prototypeId)).toEqual(["cruise"]);
    const bare = glsDraft();
    bare.equipment.cruise = { priority: "nice" };
    expect(codes(adapt(bare))).toContain("equipment.cruise:priority_without_value");
  });

  it("støttede felt: hvert enkelt utfylt felt endrer resultatet (ingen felt faller stille bort)", () => {
    const base = ok(adapt(exportOf(), { plannedRegistration: "unspecified" })).json;
    const supported = ALL_FIELDS.filter((f) => mappingFor("field", f.id)?.status === "supported_now");
    expect(supported.length).toBe(14);
    for (const f of supported) {
      const doc = exportOf((s) => sampleValue(f, s));
      const r = ok(adapt(doc, { plannedRegistration: "unspecified", listPriorities: { extColor: "must", intColor: "must", material: "must" } }));
      expect(JSON.stringify(r.json), f.id).not.toBe(JSON.stringify(base));
    }
  });
});

// ------------------------------------------------------------------ 3. tilleggsinput

describe("tilleggsinput: registrering og listeprioritet", () => {
  const doc = glsDraft();

  it("planlagt registrering må oppgis; unspecified er et gyldig, uttrykkelig valg", () => {
    expect(codes(adapt(doc, {}))).toContain("extra.plannedRegistration:missing_input");
    expect(codes(adapt(doc, undefined))).toContain("extra:missing_input");
    expect(codes(adapt(doc, null))).toContain("extra:missing_input");
    expect(codes(adapt(doc, { plannedRegistration: "truck", listPriorities: EXTRA.listPriorities }))).toContain("extra.plannedRegistration:invalid_scenario");
    expect(codes(adapt(doc, { plannedRegistration: undefined, listPriorities: EXTRA.listPriorities }))).toContain("extra.plannedRegistration:missing_input");
    for (const requested of ["passenger", "van", "unspecified"] as const) {
      expect(ok(adapt(doc, { ...EXTRA, plannedRegistration: requested })).spec.plannedRegistration.requested).toBe(requested);
    }
  });

  it("varebil utledes ikke fra karosseri, og van endrer verken karosserifilter eller beløp", () => {
    const vanBody = exportOf((s) => { s.values.body = ["van"]; });
    const a = ok(adapt(vanBody, { plannedRegistration: "passenger" }));
    expect(a.spec.plannedRegistration.requested).toBe("passenger");
    expect(a.spec.requirements.bodyTypes).toEqual(["van"]);
    const b = ok(adapt(glsDraft(), { ...EXTRA, plannedRegistration: "van" }));
    const c = ok(adapt(glsDraft(), { ...EXTRA, plannedRegistration: "passenger" }));
    expect(b.spec.requirements).toEqual(c.spec.requirements);
    expect(b.spec.budget).toEqual(c.spec.budget);
    expect(upperLimitMinor(b.spec.budget)).toBe(upperLimitMinor(c.spec.budget));
    expect(b.spec.plannedRegistration.requested).toBe("van");
    // ingen scenario uten uttrykkelig input, selv med van-karosseri
    expect(codes(adapt(vanBody, {}))).toContain("extra.plannedRegistration:missing_input");
  });

  it("fargeprioritet gjettes ikke: manglende eller ugyldig prioritet for en utfylt liste gir feltfeil", () => {
    expect(codes(adapt(doc, { plannedRegistration: "van" }))).toEqual(expect.arrayContaining([
      "extra.listPriorities.extColor:missing_input", "extra.listPriorities.intColor:missing_input", "extra.listPriorities.material:missing_input",
    ]));
    expect(codes(adapt(doc, { plannedRegistration: "van", listPriorities: { extColor: "must", intColor: "nice" } }))).toEqual(["extra.listPriorities.material:missing_input"]);
    for (const bad of ["MUST", "maybe", "", 1, null, undefined]) {
      const c = codes(adapt(doc, { plannedRegistration: "van", listPriorities: { ...EXTRA.listPriorities, extColor: bad } }));
      expect(c, String(bad)).toContain("extra.listPriorities.extColor:invalid_priority");
    }
    expect(codes(adapt(doc, { plannedRegistration: "van", listPriorities: { ...EXTRA.listPriorities, bogus: "must" } }))).toContain("extra.listPriorities.bogus:unknown_key");
    expect(codes(adapt(doc, { plannedRegistration: "van", extraKey: 1, listPriorities: EXTRA.listPriorities }))).toContain("extra.extraKey:unknown_key");
    expect(codes(adapt(doc, { plannedRegistration: "van", listPriorities: "must" }))).toContain("extra.listPriorities:not_object");
  });

  it("prioritet på en tom liste skaper ikke et kriterium", () => {
    const bare = exportOf(); // ingen farger/materiale
    const r = ok(adapt(bare, { plannedRegistration: "unspecified", listPriorities: { extColor: "must", intColor: "must", material: "nice" } }));
    expect(r.spec.appearance).toEqual({ exteriorColors: null, interiorColors: null, interiorMaterials: null });
    // og en tom liste i dokumentet ([]) er heller ikke et kriterium
    const withEmpty = clone(bare);
    withEmpty.criteria.extColor = [];
    expect(ok(adapt(withEmpty, { plannedRegistration: "unspecified", listPriorities: { extColor: "must" } })).spec.appearance.exteriorColors).toBeNull();
  });

  it("«nice» på en liste forblir «nice» (ikke oppgradert til krav)", () => {
    const r = ok(adapt(doc, { plannedRegistration: "van", listPriorities: { extColor: "nice", intColor: "nice", material: "nice" } }));
    expect(r.spec.appearance.exteriorColors?.priority).toBe("nice");
    const car = glsCandidate("x", { exteriorColor: "grey", equipment: { present: ["camera_360", "carplay"], absent: [], listComplete: false } });
    const only = { ...emptySpec(), appearance: r.spec.appearance };
    expect(evaluateCandidate(only, car).status).toBe("match");
  });
});

// ------------------------------------------------------------------ 4. budsjett, ukjent vs 0, valuta

describe("budsjett og kostnadslinjer", () => {
  it("tomt utkast: fire ukjente faste kostnadslinjer i NOK, ingen budsjett, avvik avslått", () => {
    const r = ok(adapt(exportOf(), { plannedRegistration: "unspecified" }));
    expect(r.spec.budget.maxTotalNokMinor).toBeNull();
    expect(r.spec.budget.deviationBasisPoints).toBeNull();
    expect(r.spec.budget.costs.map((c) => [c.id, c.currency, c.amountMinor, c.vatBasis, c.includedInBudget])).toEqual([
      ["transport", "NOK", null, null, false], ["travel", "NOK", null, null, false], ["insurance", "NOK", null, null, false], ["prep", "NOK", null, null, false],
    ]);
    expect(r.spec.vehicle).toEqual({ brand: null, model: null, variant: null });
    expect(r.spec.plannedRegistration.requested).toBe("unspecified");
    expect(r.spec.equipment).toEqual([]);
  });

  it("avslått avvik gir grense = budsjett; avvik 0 % og 100 % overføres eksakt; brøkøre rundes ned", () => {
    const off = ok(adapt(exportOf((s) => { s.budget.amount = "750 000"; }), EXTRA));
    expect(off.spec.budget.deviationBasisPoints).toBeNull();
    expect(upperLimitMinor(off.spec.budget)).toBe(75_000_000n);
    const zero = ok(adapt(exportOf((s) => { s.budget.amount = "750 000"; s.budget.deviationOn = true; s.budget.deviation = "0"; }), EXTRA));
    expect(zero.spec.budget.deviationBasisPoints).toBe(0);
    const full = ok(adapt(exportOf((s) => { s.budget.amount = "750 000"; s.budget.deviationOn = true; s.budget.deviation = "100"; }), EXTRA));
    expect(full.spec.budget.deviationBasisPoints).toBe(10000);
    expect(upperLimitMinor(full.spec.budget)).toBe(150_000_000n);
    const frac = ok(adapt(exportOf((s) => { s.budget.amount = "100,01"; s.budget.deviationOn = true; s.budget.deviation = "12,34"; }), EXTRA));
    expect(frac.spec.budget.maxTotalNokMinor).toBe(10_001n);
    expect(frac.spec.budget.deviationBasisPoints).toBe(1234);
    expect(upperLimitMinor(frac.spec.budget)).toBe(11_235n);
  });

  it("ukjent beløp med valuta, uttrykkelig 0 og egne linjer skilles og bevares (alle valutaer)", () => {
    const doc = exportOf((s) => {
      s.budget.costs[0].currency = "SEK"; // ukjent SEK
      s.budget.costs[1].amount = "0"; s.budget.costs[1].currency = "EUR"; // 0 EUR
      s.budget.costs[3].amount = "1 234,56"; s.budget.costs[3].vat = "incl"; s.budget.costs[3].included = true;
      const a = L.newCost("Egen A", ""); a.currency = "GBP"; a.included = true;
      const b = L.newCost("Egen B", ""); b.amount = "5"; b.currency = "PLN"; b.vat = "excl";
      s.budget.costs.push(a, b);
    });
    const c = Object.fromEntries(ok(adapt(doc, EXTRA)).spec.budget.costs.map((x) => [x.id, x]));
    expect(c.transport).toMatchObject({ currency: "SEK", amountMinor: null });
    expect(c.travel).toMatchObject({ currency: "EUR", amountMinor: 0n });
    expect(c.prep).toMatchObject({ currency: "NOK", amountMinor: 123_456n, vatBasis: "incl", includedInBudget: true });
    expect(c["custom-1"]).toMatchObject({ label: "Egen A", currency: "GBP", amountMinor: null, includedInBudget: true });
    expect(c["custom-2"]).toMatchObject({ label: "Egen B", currency: "PLN", amountMinor: 500n, vatBasis: "excl" });
    expect(c.insurance).toMatchObject({ amountMinor: null });
  });

  it("kostnadslinjer endrer aldri budsjettgrensen, uansett beløp og inkludering", () => {
    const heavy = exportOf((s) => { s.budget.amount = "750 000"; s.budget.deviationOn = true; s.budget.deviation = "10"; s.budget.costs[0].amount = "900 000"; s.budget.costs[0].included = true; });
    const light = exportOf((s) => { s.budget.amount = "750 000"; s.budget.deviationOn = true; s.budget.deviation = "10"; });
    expect(upperLimitMinor(ok(adapt(heavy, EXTRA)).spec.budget)).toBe(82_500_000n);
    expect(upperLimitMinor(ok(adapt(light, EXTRA)).spec.budget)).toBe(82_500_000n);
  });

  it("budsjettfelt som ikke lar seg representere blokkerer tydelig (ikke endring/tap)", () => {
    const d = glsDraft();
    d.budget.costs[4].label = "x".repeat(61); // over domenets 60 tegn
    expect(codes(adapt(d))).toContain("budget.costs[4].label:too_long");
    const e = glsDraft();
    e.budget.costs[4].label = " med mellomrom ";
    expect(codes(adapt(e))).toContain("budget.costs[4].label:untrimmed");
    const g = glsDraft();
    g.budget.costs[4].label = "styre\u0000tegn";
    expect(codes(adapt(g))).toContain("budget.costs[4].label:control_chars");
  });
});

// ------------------------------------------------------------------ 5. katalog

describe("katalogreferanser: eksplisitte nøkler, ingen fuzzy matching", () => {
  it("ukjent merke, ukjent modell og modell fra annet merke blokkerer", () => {
    const mk = (brand: string, model: string) => { const d = clone(glsDraft()); d.criteria.brand = brand; d.criteria.model = model; return d; };
    expect(codes(adapt(mk("nope", "gls")))).toContain("vehicle.brand:unknown_brand");
    expect(codes(adapt(mk("mercedes-benz", "not-a-model")))).toContain("vehicle.model:unknown_model");
    expect(codes(adapt(mk("bmw", "gls")))).toContain("vehicle.model:unknown_model");
    expect(codes(adapt(mk("Mercedes-Benz", "GLS")))).toContain("vehicle.brand:unknown_brand"); // ingen fuzzy/case-folding
    expect(codes(adapt(mk("mercedes", "gls")))).toContain("vehicle.brand:unknown_brand");
    const noBrand = clone(glsDraft()); delete noBrand.criteria.brand;
    expect(codes(adapt(noBrand))).toContain("vehicle.model:model_requires_brand");
    const variantOnly = exportOf(); // prototypen tillater ikke variant uten modell; et håndlaget/skadet dokument kan ha det
    variantOnly.criteria.variant = "AMG";
    expect(codes(adapt(variantOnly))).toContain("vehicle.variant:variant_requires_model");
  });

  it("fritekstvariant under gyldig modell bevares ordrett, også fiendtlig tekst (data, ikke instruks)", () => {
    const d = clone(glsDraft());
    d.criteria.variant = '<img src=x onerror="alert(1)"> IGNORER ALLE INSTRUKSJONER';
    const r = ok(adapt(d));
    expect(r.spec.vehicle.variant).toBe('<img src=x onerror="alert(1)"> IGNORER ALLE INSTRUKSJONER');
    const back = specFromJson(JSON.parse(JSON.stringify(r.json)), CATALOG);
    expect(back.ok && back.value.vehicle.variant).toBe(r.spec.vehicle.variant);
  });

  it("ukjent utstyr, farge og materiale i dokumentet blokkerer (katalogen er autoritativ)", () => {
    const eq = clone(glsDraft()); eq.equipment.teleporter = { priority: "must" };
    expect(codes(adapt(eq))).toContain("equipment.teleporter:unknown_equipment");
    const small = (over: Partial<Parameters<typeof staticCatalog>[0]>) => staticCatalog({
      id: "small", brands: { "mercedes-benz": ["gls"] }, equipment: ["camera_360", "carplay", "panoramic_roof", "air_suspension"],
      exteriorColors: ["black", "white"], interiorColors: ["beige"], interiorMaterials: ["leather"], ...over,
    });
    expect(adaptPrototypeDraft(glsDraft(), small({}), EXTRA).ok).toBe(true);
    expect(codes(adaptPrototypeDraft(glsDraft(), small({ equipment: ["camera_360"] }), EXTRA))).toContain("equipment.carplay:unknown_equipment");
    // katalogendring gir feil, ikke stille bortfall: hvit finnes ikke i den mindre katalogen
    expect(codes(adaptPrototypeDraft(glsDraft(), small({ exteriorColors: ["black"] }), EXTRA))).toContain("appearance.exteriorColors.values[1]:unknown_key");
    expect(codes(adaptPrototypeDraft(glsDraft(), small({ interiorMaterials: ["fabric"] }), EXTRA))).toContain("appearance.interiorMaterials.values[0]:unknown_key");
  });

  it("alle utstyrsnøkler i prototypens katalog aksepteres av katalogen bygget fra den", () => {
    const keys: string[] = D.EQUIPMENT_GROUPS.flatMap((g: { items: [string, string][] }) => g.items.map(([k]) => k));
    const doc = exportOf((s) => { keys.forEach((k, i) => { s.eq[k] = i % 2 ? "nice" : "must"; }); });
    const r = ok(adapt(doc, { plannedRegistration: "unspecified" }));
    expect(r.spec.equipment.length).toBe(keys.length);
    expect(new Set(r.spec.equipment.map((e) => e.key)).size).toBe(keys.length);
  });
});

// ------------------------------------------------------------------ 6. dokumentvalidering

describe("dokumentvalidering: versjon, struktur, enheter og skadet eksport", () => {
  const base = () => clone(glsDraft());

  it("v1 gir klar beskjed om å eksportere på nytt; andre versjoner og skjemaer avvises", () => {
    const v1 = base(); v1.schemaVersion = 1;
    const r = fail(adapt(v1));
    expect(r.issues).toEqual([expect.objectContaining({ path: "schemaVersion", code: "v1_not_supported", message: expect.stringMatching(/eksporter den på nytt/) })]);
    for (const v of [0, 3, 2.5, "2", null, undefined]) { const d = base(); d.schemaVersion = v; expect(codes(adapt(d)), String(v)).toEqual(["schemaVersion:unsupported_version"]); }
    const other = base(); other.schema = "merovo.search-model";
    expect(codes(adapt(other))).toEqual(["schema:wrong_schema"]);
    for (const bad of [null, undefined, [], "x", 5, true]) expect(codes(adapt(bad))).toEqual([":not_object"]);
  });

  it("ukjente toppnivånøkler og ukjente kriterier avvises (ikke ignorert)", () => {
    const a = base(); a.hacked = 1;
    expect(codes(adapt(a))).toContain("hacked:unknown_key");
    const b = base(); b.criteria.hacked = "x";
    expect(codes(adapt(b))).toContain("criteria.hacked:unknown_key");
    const c = base(); c.criteria.toString = "x"; c.criteria.constructor = "x";
    expect(codes(adapt(c))).toEqual(expect.arrayContaining(["criteria.toString:unknown_key", "criteria.constructor:unknown_key"]));
    const d = JSON.parse(JSON.stringify(base()).replace('"criteria":{', '"criteria":{"__proto__":{"x":1},'));
    expect(codes(adapt(d))).toContain("criteria.__proto__:unknown_key");
    const e = base(); e.budget.extra = 1;
    expect(codes(adapt(e))).toContain("budget.extra:unknown_key");
    const f = base(); f.equipment.toString = { priority: "must" };
    expect(codes(adapt(f))).toContain("equipment.toString:unknown_equipment");
  });

  it("feil containertyper og manglende seksjoner", () => {
    for (const k of ["criteria", "equipment", "budget"]) {
      for (const bad of [null, [], "x", 3]) { const d = base(); d[k] = bad; expect(fail(adapt(d)).issues.some((i) => i.path === k), `${k}=${JSON.stringify(bad)}`).toBe(true); }
      const d = base(); delete d[k]; expect(codes(adapt(d))).toContain(`${k}:missing_key`);
    }
    const o = base(); o.origin = "hacker";
    expect(codes(adapt(o))).toContain("origin:invalid_value");
    const n = base(); n.notice = 5;
    expect(codes(adapt(n))).toContain("notice:not_string");
  });

  it("feil enheter, grenser og typer i støttede felt", () => {
    const t = (mutate: (d: any) => void, code: string, path: string) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      const d = base(); mutate(d); const c = codes(adapt(d)); expect(c, `${path} ${code}: ${c.join(",")}`).toContain(`${path}:${code}`);
    };
    t((d) => { d.criteria.modelYear.unit = "years"; }, "wrong_unit", "criteria.modelYear");
    t((d) => { d.criteria.modelYear.from = 1949; }, "out_of_range", "criteria.modelYear.from");
    t((d) => { d.criteria.modelYear.from = 2021.5; }, "out_of_range", "criteria.modelYear.from");
    t((d) => { d.criteria.modelYear.from = "2021"; }, "out_of_range", "criteria.modelYear.from");
    t((d) => { d.criteria.seats.unit = "personer"; }, "wrong_unit", "criteria.seats");
    t((d) => { d.criteria.seats.to = 21; }, "out_of_range", "criteria.seats.to");
    t((d) => { d.criteria.mileage.unit = "mi"; }, "wrong_unit", "criteria.mileage");
    t((d) => { d.criteria.mileage.bound = "min"; }, "wrong_bound", "criteria.mileage");
    t((d) => { d.criteria.mileage.value = 0; }, "out_of_range", "criteria.mileage.value");
    t((d) => { d.criteria.firstReg.format = "YYYY"; }, "wrong_unit", "criteria.firstReg");
    t((d) => { d.criteria.firstReg.from = "2021-13"; }, "invalid_date", "criteria.firstReg.from");
    t((d) => { d.criteria.firstReg.from = "21"; }, "invalid_date", "criteria.firstReg.from");
    t((d) => { d.criteria.firstReg.to = "1800"; }, "invalid_date", "criteria.firstReg.to");
    t((d) => { d.criteria.body = "suv"; }, "invalid_value", "criteria.body");
    t((d) => { d.criteria.body = ["suv", "suv"]; }, "invalid_value", "criteria.body");
    t((d) => { d.criteria.body = [1]; }, "invalid_value", "criteria.body");
    t((d) => { d.criteria.body = ["spaceship"]; }, "invalid_value", "requirements.bodyTypes[0]");
    t((d) => { d.criteria.fuel = ["steam"]; }, "invalid_value", "requirements.fuels[0]");
    t((d) => { d.criteria.brand = 5; }, "not_string", "criteria.brand");
    t((d) => { d.criteria.variant = "x".repeat(61); }, "invalid_value", "criteria.variant");
    t((d) => { d.criteria.modelYear = { from: 2021, to: null }; }, "missing_key", "criteria.modelYear.unit");
    t((d) => { d.criteria.modelYear.hacked = 1; }, "unknown_key", "criteria.modelYear.hacked");
    t((d) => { d.criteria.seats = { from: 8, to: 7, unit: "seter" }; }, "min_above_max", "requirements.seats");
    t((d) => { d.criteria.firstReg = { from: "2023", to: "2021-01", format: "ÅÅÅÅ[-MM]" }; }, "from_after_to", "requirements.firstRegistration");
  });

  it("budsjett: feil valuta, beløpsformat, avvik og kostnadslinjer", () => {
    const t = (mutate: (d: any) => void, code: string, path: string) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      const d = base(); mutate(d); const c = codes(adapt(d)); expect(c, `${path} ${code}: ${c.join(",")}`).toContain(`${path}:${code}`);
    };
    t((d) => { d.budget.currency = "EUR"; }, "currency_not_nok", "budget.currency");
    t((d) => { d.budget.maxPurchaseCost.currency = "EUR"; }, "currency_not_nok", "budget.maxPurchaseCost.currency");
    t((d) => { d.budget.maxPurchaseCost.amountMinor = 75000000; }, "invalid_amount", "budget.maxPurchaseCost");
    t((d) => { d.budget.maxPurchaseCost.amountMinor = "1.5"; }, "invalid_amount", "budget.maxPurchaseCost");
    t((d) => { d.budget.maxPurchaseCost.amountMinor = "-5"; }, "invalid_amount", "budget.maxPurchaseCost");
    const zero = exportOf((st) => { st.budget.amount = "750 000"; });
    zero.budget.maxPurchaseCost.amountMinor = "0";
    expect(codes(adapt(zero))).toContain("budget.maxTotalNokMinor:invalid_amount");
    t((d) => { d.budget.deviation.basisPoints = 10001; }, "out_of_range", "budget.deviation.basisPoints");
    t((d) => { d.budget.deviation.basisPoints = 10.5; }, "out_of_range", "budget.deviation.basisPoints");
    t((d) => { d.budget.deviation.enabled = "yes"; }, "not_boolean", "budget.deviation.enabled");
    t((d) => { d.budget.deviation.enabled = false; }, "inconsistent", "budget.deviation.basisPoints");
    t((d) => { d.budget.deviation.maxAllowed.amountMinor = "82500001"; }, "inconsistent", "budget.deviation.maxAllowed");
    t((d) => { d.budget.deviation.maxAllowed = null; }, "inconsistent", "budget.deviation.maxAllowed");
    t((d) => { d.budget.costs = "x"; }, "not_array", "budget.costs");
    t((d) => { d.budget.costs[0].kind = "ferry"; }, "invalid_kind", "budget.costs[0].kind");
    t((d) => { d.budget.costs[0].vatBasis = "mixed"; }, "invalid_vat_basis", "budget.costs[0].vatBasis");
    t((d) => { d.budget.costs[0].includedInBudget = "ja"; }, "not_boolean", "budget.costs[0].includedInBudget");
    t((d) => { d.budget.costs[4].amount.currency = "NOK"; }, "inconsistent", "budget.costs[4].amount.currency");
    t((d) => { d.budget.costs[4].extra = 1; }, "unknown_key", "budget.costs[4].extra");
    t((d) => { d.budget.costs[4].label = 5; }, "not_string", "budget.costs[4].label");
    t((d) => { d.budget.costs.push(clone(d.budget.costs[0])); }, "duplicate", "budget.costs[5].kind");
    t((d) => { d.budget.costs[0].currency = "ZZZ"; }, "unsupported_currency", "budget.costs[0].currency");
  });

  it("skadet effektfelt (utfylt men ustøttet) klassifiseres ikke som gyldig/blokkert, men som ugyldig dokument", () => {
    const power = exportOf((s) => { s.values.power = { unit: "kw", from: "100", to: "", fromW: null, toW: null }; });
    expect(power.criteria.power.normalizedWatts).toEqual({ from: 100000, to: null });
    const intact = fail(adapt(power));
    expect(intact.kind).toBe("blocked");
    for (const mutate of [
      (d: any) => { d.criteria.power.normalizedWatts.from = 100600; }, // eslint-disable-line @typescript-eslint/no-explicit-any
      (d: any) => { d.criteria.power.normalizedWatts.to = 5; }, // eslint-disable-line @typescript-eslint/no-explicit-any
      (d: any) => { d.criteria.power.approxKw.from = 99; }, // eslint-disable-line @typescript-eslint/no-explicit-any
      (d: any) => { d.criteria.power.normalizedWatts = null; }, // eslint-disable-line @typescript-eslint/no-explicit-any
      (d: any) => { d.criteria.power.unit = "PS"; }, // eslint-disable-line @typescript-eslint/no-explicit-any
      (d: any) => { d.criteria.power.from = 5000; }, // eslint-disable-line @typescript-eslint/no-explicit-any
    ]) {
      const d = clone(power); mutate(d);
      const r = fail(adapt(d));
      expect(r.kind, JSON.stringify(d.criteria.power)).toBe("invalid");
      expect(r.issues.length).toBeGreaterThan(0);
    }
    // hk-eksempel fra FIX1: 100 kW → 136 hk bevarer 100000 W og er gyldig (men ustøttet)
    const hp = exportOf((s) => { s.values.power = { unit: "hp", from: "136", to: "", fromW: 100000, toW: null }; });
    expect(fail(adapt(hp)).kind).toBe("blocked");
  });

  it("feil i flere felt rapporteres samtidig sammen med blokkerte valg; ingen delvis spec", () => {
    const d = exportOf((s) => { sampleValue(ALL_FIELDS.find((f) => f.id === "doors")!, s); s.values.brand = "mercedes-benz"; s.values.model = "gls"; });
    d.criteria.seats = { from: 1, to: 2, unit: "x" };
    const res = adapt(d);
    const r = fail(res);
    expect(r.kind).toBe("invalid");
    expect(r.unsupported.map((u) => u.prototypeId)).toEqual(["doors"]);
    expect(res).not.toHaveProperty("spec");
  });
});

// ------------------------------------------------------------------ 7. robusthet

describe("robusthet: skadet input gir aldri unntak, mutasjon eller delvis spec", () => {
  const GARBAGE: unknown[] = [null, undefined, 0, -1, 1.5, "", "x", true, false, [], {}, [null], { a: 1 }, "2021", 99999999999999999999n];

  /** Alle stier (opp til dybde 4) i dokumentet. */
  function paths(x: unknown, prefix: (string | number)[] = [], depth = 0): (string | number)[][] {
    if (depth > 4 || typeof x !== "object" || x === null) return [];
    const out: (string | number)[][] = [];
    for (const k of Object.keys(x)) {
      const p = [...prefix, Array.isArray(x) ? Number(k) : k];
      out.push(p, ...paths((x as Record<string, unknown>)[k], p, depth + 1));
    }
    return out;
  }
  const setAt = (root: any, path: (string | number)[], v: unknown) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    let n = root; for (const k of path.slice(0, -1)) n = n[k]; n[path[path.length - 1]!] = v;
  };

  it("hver sti i et ekte dokument erstattet med søppel: ingen unntak, uendret original, konsistent resultat", () => {
    const doc = glsDraft();
    const ps = paths(doc);
    expect(ps.length).toBeGreaterThan(60);
    let rejected = 0;
    for (const p of ps) {
      for (const g of GARBAGE) {
        const d = clone(doc);
        try { setAt(d, p, g === undefined ? undefined : typeof g === "bigint" ? g : g); } catch { continue; }
        const frozen = deepFreeze(d);
        const snapshot = JSON.stringify(frozen, (_k, v) => (typeof v === "bigint" ? `${v}n` : v));
        let res: AdaptResult | undefined;
        expect(() => { res = adapt(frozen); }, `${p.join(".")}=${String(g)}`).not.toThrow();
        expect(JSON.stringify(frozen, (_k, v) => (typeof v === "bigint" ? `${v}n` : v))).toBe(snapshot);
        if (!res!.ok) {
          rejected++;
          expect(res).not.toHaveProperty("spec");
          expect(res!.issues.length + res!.unsupported.length, `${p.join(".")}=${String(g)}`).toBeGreaterThan(0);
        } else {
          // godtatt → må være et fullt gyldig, rundturbart resultat
          const back = specFromJson(JSON.parse(JSON.stringify(res!.json)), CATALOG);
          expect(back.ok && back.value, `${p.join(".")}=${String(g)}`).toEqual(res!.spec);
        }
      }
    }
    expect(rejected).toBeGreaterThan(ps.length); // de aller fleste erstatningene er ugyldige
  });

  it("kastende getters og Proxy-objekter gir invalid, ikke unntak", () => {
    const evil = { schema: "merovo.search-draft", schemaVersion: 2, get criteria(): never { throw new Error("boom"); }, equipment: {}, budget: {} };
    const r = fail(adapt(evil));
    expect(r.kind).toBe("invalid");
    expect(fail(adapt(new Proxy({}, { ownKeys() { throw new Error("x"); } }))).kind).toBe("invalid");
    expect(() => adaptPrototypeDraft(glsDraft(), { ...CATALOG, hasEquipment: () => { throw new Error("katalog"); } }, EXTRA)).not.toThrow();
  });
});

// ------------------------------------------------------------------ 8. kontrakt mot prototypen og modulgrenser

describe("kontrakt mot prototypen og modulgrenser", () => {
  it("effektkonverteringene i adapteren er identiske med prototypens (kopi sammenlignet)", () => {
    // via observerbar atferd: normalizedWatts fra prototypen aksepteres for hele hk- og kW-området
    for (const [unit, max, mk] of [["kw", 2200, "kW"], ["hp", 3000, "hk"]] as const) {
      for (let n = 1; n <= max; n += n < 50 ? 1 : 37) {
        const doc = exportOf((s) => { s.values.power = { unit, from: String(n), to: "", fromW: null, toW: null }; });
        expect(doc.criteria.power.unit).toBe(mk);
        expect(fail(adapt(doc)).kind, `${n} ${mk}`).toBe("blocked"); // gyldig (ikke invalid) → konsistensreglene stemmer med prototypen
      }
    }
  });

  it("alle gyldige eksporter fra prototypen (tilfeldige utfyllinger) er strukturelt gyldige for adapteren", () => {
    // Ingen eksport fra prototypen skal gi «invalid»: den er enten ok eller blokkert på ustøttede felt.
    let seed = 12345;
    const rnd = (n: number) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
    for (let i = 0; i < 150; i++) {
      const s = L.emptyState();
      for (const f of ALL_FIELDS) if (rnd(3) === 0) { try { sampleValue(f, s); } catch { /* ignorer */ } }
      if (rnd(2)) { s.values.brand = "mercedes-benz"; s.values.model = "gls"; }
      for (const g of D.EQUIPMENT_GROUPS) for (const [k] of g.items) if (rnd(6) === 0) s.eq[k] = rnd(2) ? "must" : "nice";
      if (rnd(2)) { s.budget.amount = String(1000 * (1 + rnd(2000))); if (rnd(2)) { s.budget.deviationOn = true; s.budget.deviation = String(rnd(101)); } }
      s.budget.costs.forEach((c: any) => { if (rnd(3) === 0) { c.currency = D.CURRENCIES[rnd(7)]; if (rnd(2)) c.amount = String(rnd(100000)); c.vat = ["", "incl", "excl", "none"][rnd(4)]; c.included = rnd(2) === 0; } }); // eslint-disable-line @typescript-eslint/no-explicit-any
      const r = L.exportDraft(s, NOW);
      if (!r.ok) continue; // prototypen godtar ikke utkastet
      const res = adapt(r.draft, { plannedRegistration: "unspecified", listPriorities: { extColor: "must", intColor: "nice", material: "must" } });
      expect(res.ok || res.kind === "blocked", JSON.stringify(res.ok ? "" : res.issues) + JSON.stringify(r.draft).slice(0, 300)).toBe(true);
      if (res.ok) {
        const back = specFromJson(JSON.parse(JSON.stringify(res.json)), CATALOG);
        expect(back.ok && back.value).toEqual(res.spec);
      } else {
        // blokkert ⇔ minst ett utfylt, ustøttet kriterium finnes
        const unsupportedFilled = Object.keys(r.draft.criteria).filter((id) => mappingFor("field", id)?.status !== "supported_now");
        expect(res.unsupported.map((u) => u.prototypeId).sort()).toEqual(unsupportedFilled.sort());
      }
    }
  });

  it("domenelaget importerer aldri adapteren; adapteren importerer bare domenet (@/domain) og relative moduler", () => {
    const ROOT = join(__dirname, "..");
    const domain = ["types", "validation", "evaluation", "budget", "serialization", "mapping", "catalog", "factory"];
    for (const f of domain) expect(readFileSync(join(ROOT, `src/domain/search-v2/${f}.ts`), "utf8"), f).not.toMatch(/adapters/);
    for (const f of ["adapt", "fields"]) {
      const text = readFileSync(join(ROOT, `src/adapters/search-prototype/${f}.ts`), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, ""); // uten kommentarer
      for (const m of text.matchAll(/from\s+["']([^"']+)["']/g)) expect(/^(@\/domain\/|\.\/)/.test(m[1]!), `${f} → ${m[1]}`).toBe(true);
      expect(text, f).not.toMatch(/\b(fetch|XMLHttpRequest|localStorage|document|window)\b\s*[.(]|require\(|prototypes\/|Date\.now\(|Math\.random/);
    }
  });
});

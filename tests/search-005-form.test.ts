/**
 * SEARCH-005 — skjema ↔ søkemodell, kostnads-id-er, forhåndsvisning og kontrakter mot prototype/kilde.
 * Forventninger er utledet uavhengig (håndregnet BigInt, prototypens data.js, de faktiske syntetiske annonsene).
 */
import { createRequire } from "node:module";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SYNTHETIC_SOURCE_CAPABILITIES } from "@/adapters/search-candidate/capabilities";
import { SYNTHETIC_MAPPING_DATA } from "@/adapters/search-candidate/synthetic-mapping-data";
import { buildCandidateAdapter } from "@/adapters/search-candidate/candidate";
import { DEMO_BRANDS, DEMO_CATALOG, DEMO_EQUIPMENT_GROUPS, DEMO_EXTERIOR_COLORS, DEMO_INTERIOR_COLORS, DEMO_INTERIOR_MATERIALS, DEMO_MODELS } from "@/adapters/search-catalog/demo-catalog";
import { PROTOTYPE_FIELDS } from "@/adapters/search-prototype/fields";
import { upperLimitMinor } from "@/domain/search-v2/budget";
import { specFromJson } from "@/domain/search-v2/serialization";
import { PROTOTYPE_MAPPING } from "@/domain/search-v2/mapping";
import { MarketplaceError } from "@/providers/marketplace/errors";
import { EMPTY_QUERY, SyntheticMarketplaceProvider } from "@/providers/marketplace/synthetic/provider";
import { EXAMPLES } from "@/server/search-examples";
import { minorToField, parseMinor, parsePercentBp, parseRegistration, parseSearchFormValues, specToFormValues, type FormValues } from "@/server/search-form";
import { previewSearch } from "@/server/search-preview";
import { summarizeSpec } from "@/lib/search-summary";
import { mapError } from "@/server/search-draft-errors";

const require_ = createRequire(import.meta.url);
const PROTO = join(__dirname, "../prototypes/merovo-search/js");
/* eslint-disable @typescript-eslint/no-explicit-any */
const D: any = require_(join(PROTO, "data.js"));
/* eslint-enable @typescript-eslint/no-explicit-any */

let seq = 0;
const ids = () => (seq++).toString(16).padStart(12, "0");
const demo = (id: string, patch: FormValues = {}): FormValues => ({ ...EXAMPLES.find((e) => e.id === id)!.values(), ...patch });
const parse = (v: FormValues) => parseSearchFormValues(v, DEMO_CATALOG, { newCostId: ids });
const ok = (v: FormValues) => { const r = parse(v); if (!r.ok || !r.spec || !r.json) throw new Error(JSON.stringify([r.errors, r.general])); return r; };

describe("katalog og felt: kontrakt mot prototypen", () => {
  it("demokatalogen er identisk med prototypens data.js (merker, modeller, varianter, farger, materialer, utstyr)", () => {
    expect(DEMO_BRANDS.map((b) => [b.key, b.label])).toEqual(D.BRANDS.map((b: any) => [b.v, b.l])); // eslint-disable-line @typescript-eslint/no-explicit-any
    for (const b of D.BRANDS) expect(DEMO_MODELS[b.v]!.map((m) => [m.key, m.label, [...m.variants]])).toEqual(D.MODELS[b.v].map((m: any) => [m.v, m.l, m.variants])); // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(Object.keys(DEMO_MODELS)).toEqual(D.BRANDS.map((b: any) => b.v)); // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(DEMO_EXTERIOR_COLORS.map((c) => [c.key, c.label])).toEqual(D.EXT_COLORS.map((c: any) => [c.v, c.l])); // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(DEMO_INTERIOR_COLORS.map((c) => [c.key, c.label])).toEqual(D.INT_COLORS.map((c: any) => [c.v, c.l])); // eslint-disable-line @typescript-eslint/no-explicit-any
    const mats = D.SECTIONS.flatMap((s: any) => [...s.fields, ...(s.advanced?.fields ?? [])]).find((f: any) => f.id === "material").options; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(DEMO_INTERIOR_MATERIALS.map((c) => [c.key, c.label])).toEqual(mats.map((c: any) => [c.v, c.l])); // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(DEMO_EQUIPMENT_GROUPS.map((g) => [g.id, g.section, g.title, g.visible, g.items.map((i) => [i.key, i.label])]))
      .toEqual(D.EQUIPMENT_GROUPS.map((g: any) => [g.id, g.section, g.title, g.visible, g.items])); // eslint-disable-line @typescript-eslint/no-explicit-any
  });

  it("skjemaet tilbyr nøyaktig de støttede prototypekriteriene; «Kommer senere» er resten (ingenting kan fylles ut og så gå tapt)", () => {
    const supported = PROTOTYPE_MAPPING.filter((m) => m.kind === "field" && m.status === "supported_now").map((m) => m.prototypeId).sort();
    expect(supported).toEqual(["body", "brand", "drive", "extColor", "firstReg", "fuel", "gear", "intColor", "material", "mileage", "model", "modelYear", "seats", "variant"]);
    // Alle ikke-støttede felt finnes i prototypekatalogen og står som planned_later/not_relevant (ikke som skjemafelt)
    const later = PROTOTYPE_MAPPING.filter((m) => m.kind === "field" && m.status === "planned_later").map((m) => m.prototypeId);
    for (const id of later) expect(PROTOTYPE_FIELDS.some((f) => f.id === id), id).toBe(true);
  });
});

describe("skjema → spesifikasjon", () => {
  it("fylt skjema gir gyldig spesifikasjon; penger er bigint internt og heltallsstreng i dokumentet", () => {
    const r = ok(demo("demo-bmw"));
    expect(r.spec!.budget.maxTotalNokMinor).toBe(45_000_000n);
    expect(r.json!.budget.maxTotal).toEqual({ amountMinor: "45000000", currency: "NOK" });
    expect(() => JSON.stringify(r.json)).not.toThrow(); // ingen bigint i JSON-dokumentet
    expect(r.spec!.budget.costs[0]).toMatchObject({ id: "transport", currency: "EUR", amountMinor: null, includedInBudget: true });
  });

  it("750 000 kr + 10 % er bare grensen 825 000 kr — aldri et beregnet treff", () => {
    const r = ok(demo("demo-bmw", { budgetMax: "750 000", budgetDeviation: "10" }));
    expect(upperLimitMinor(r.spec!.budget)).toBe(82_500_000n);
    expect(summarizeSpec(r.spec!).budget.join(" ")).toMatch(/825.000/);
  });

  it("GLS-eksempelet kan ikke lagres før prioritet og planlagt registrering er valgt uttrykkelig; km er ikke satt", () => {
    const r = parse(demo("gls"));
    expect(r.ok).toBe(false);
    expect(r.errors.exteriorColorsPriority).toMatch(/Må ha.*Ønskelig/);
    expect(r.errors.plannedRegistration).toMatch(/Uavklart/);
    const fixed = ok(demo("gls", { exteriorColorsPriority: "nice", plannedRegistration: "unspecified" }));
    expect(fixed.spec!.requirements.maxMileageKm).toBeNull();
    expect(fixed.spec!.requirements.seats).toEqual({ min: 7, max: 7 });
    expect(summarizeSpec(fixed.spec!).notSet).toContain("Kilometerstand");
  });

  it("budsjett kan være usatt; ugyldige verdier lagres aldri som gyldig spesifikasjon", () => {
    expect(ok(demo("demo-bmw", { budgetMax: "", budgetDeviation: "" })).spec!.budget.maxTotalNokMinor).toBeNull();
    for (const [k, v] of [["budgetMax", "0"], ["budgetMax", "-5"], ["budgetMax", "12,345"], ["budgetMax", "abc"], ["budgetMax", "90071992547409.92"], ["budgetDeviation", "100,5"], ["budgetDeviation", "x"]] as const) {
      const r = parse(demo("demo-bmw", { [k]: v }));
      expect(r.ok, `${k}=${v}`).toBe(false);
      expect(r.spec).toBeNull();
      expect(r.json).toBeNull();
    }
    expect(parse(demo("demo-bmw", { budgetMax: "", budgetDeviation: "10" })).errors.budgetDeviation).toMatch(/krever et budsjett/);
  });

  it("ukjent beløp (tomt) beholder valuta; 0 er eksplisitt 0; forskjell bevares gjennom lagre → åpne → lagre", () => {
    const v = demo("demo-bmw", {
      "cost.insurance.use": "true", "cost.insurance.currency": "SEK", "cost.insurance.amount": "0", "cost.insurance.included": "true",
      "custom.0.label": "Frakt hjem", "custom.0.currency": "DKK", "custom.0.amount": "", "custom.0.vat": "incl",
    });
    const r1 = ok(v);
    const ins = r1.spec!.budget.costs.find((c) => c.id === "insurance")!;
    const cus = r1.spec!.budget.costs.find((c) => c.kind === "custom")!;
    expect(ins).toMatchObject({ amountMinor: 0n, currency: "SEK" });
    expect(cus).toMatchObject({ amountMinor: null, currency: "DKK", vatBasis: "incl", includedInBudget: false });
    // lagre → åpne (spec → skjema) → lagre: identisk dokument
    const r2 = ok(specToFormValues(r1.name!, r1.spec!));
    expect(r2.json).toEqual(r1.json);
  });

  it("tillater ikke ukjent valuta, ukjent utstyr eller ugyldig kostnadsid; fritekstvariant og datopresisjon bevares", () => {
    expect(parse(demo("demo-bmw", { "cost.transport.currency": "XXX" })).errors["cost.transport.currency"]).toBeDefined();
    expect(parse(demo("demo-bmw", { "eq:not_real": "must" })).general.join()).toMatch(/Ukjent utstyr/);
    expect(parse(demo("demo-bmw", { "custom.0.id": "custom-0", "custom.0.label": "x" })).errors["custom.0.label"]).toMatch(/Ugyldig linje-id/);
    const r = ok(demo("demo-bmw", { variant: "320d «spesial» ¤ æøå", regFrom: "2021-03", regTo: "2023-05-17" }));
    expect(r.spec!.vehicle.variant).toBe("320d «spesial» ¤ æøå");
    expect(r.spec!.requirements.firstRegistration).toEqual({ from: { precision: "month", year: 2021, month: 3 }, to: { precision: "date", year: 2023, month: 5, day: 17 } });
    expect(specToFormValues("n", r.spec!).regFrom).toBe("2021-03");
    expect(specToFormValues("n", r.spec!).regTo).toBe("2023-05-17");
  });

  it("farge-/materialprioritet og planlagt registrering må velges; prioritet uten valg avvises", () => {
    expect(parse(demo("demo-bmw", { exteriorColorsPriority: "" })).errors.exteriorColorsPriority).toBeDefined();
    expect(parse(demo("demo-bmw", { exteriorColors: [], exteriorColorsPriority: "must" })).errors.exteriorColorsPriority).toMatch(/ingen/);
    expect(parse(demo("demo-bmw", { plannedRegistration: "" })).errors.plannedRegistration).toBeDefined();
    expect(parse(demo("demo-bmw", { plannedRegistration: "truck" })).errors.plannedRegistration).toBeDefined();
    for (const s of ["passenger", "van", "unspecified"]) expect(ok(demo("demo-bmw", { plannedRegistration: s })).spec!.plannedRegistration.requested).toBe(s);
    // sju seter er et eget krav og utledes ikke av modell
    expect(ok(demo("demo-bmw")).spec!.requirements.seats).toBeNull();
  });

  it("brukerinput som ikke hører til skjemaet (firma, versjon, aktiv) leses aldri og når aldri dokumentet", () => {
    const r = ok(demo("demo-bmw", { dealership_id: "x", version: "9", active: "true", expectedVersion: "3" } as FormValues));
    expect(JSON.stringify(r.json)).not.toMatch(/dealership|active|"version"/);
  });

  it("tallparsing er eksakt: ingen flyttall, norsk format, øregrenser", () => {
    expect(parseMinor("750 000", 2)).toBe(75_000_000n);
    expect(parseMinor("1 250,50", 2)).toBe(125_050n);
    expect(parseMinor("0,05", 2)).toBe(5n);
    expect(parseMinor("", 2)).toBeNull();
    expect(parseMinor("1,005", 2)).toBe("invalid");
    expect(parseMinor("90071992547409.91", 2)).toBe(9_007_199_254_740_991n);
    expect(parseMinor("90071992547409.92", 2)).toBe("invalid");
    expect(parsePercentBp("10")).toBe(1000);
    expect(parsePercentBp("0,5")).toBe(50);
    expect(parsePercentBp("100")).toBe(10_000);
    expect(parsePercentBp("100,01")).toBe("invalid");
    expect(parseRegistration("2021-02-30")).toBe("invalid");
    expect(minorToField(75_000_000n)).toBe("750 000");
    expect(parseMinor(minorToField(125_050n), 2)).toBe(125_050n);
  });
});

describe("stabile kostnads-id-er", () => {
  const base = () => demo("demo-bmw", {
    "custom.0.label": "A", "custom.0.amount": "10", "custom.1.label": "B", "custom.1.amount": "20", "custom.2.label": "C", "custom.2.amount": "30",
  });
  it("nye egendefinerte linjer får varige, unike id-er (c-<12 hex>); prototypens custom-<n> brukes aldri", () => {
    const r = ok(base());
    const c = r.spec!.budget.costs.filter((x) => x.kind === "custom");
    expect(c.map((x) => x.id)).toEqual(["c-000000000000", "c-000000000001", "c-000000000002"].map((_, i) => c[i]!.id));
    expect(new Set(c.map((x) => x.id)).size).toBe(3);
    for (const x of c) expect(x.id).toMatch(/^c-[0-9a-f]{12}$/);
    expect(c.some((x) => /^custom-\d+$/.test(x.id))).toBe(false);
  });
  it("sletting, omrekkefølge og endring beholder id-ene til gjenværende linjer", () => {
    const first = ok(base());
    const [a, b, c] = first.spec!.budget.costs.filter((x) => x.kind === "custom");
    const form = specToFormValues(first.name!, first.spec!);
    // slett A (remove), og bytt rekkefølge på B og C ved å bytte radene
    const swapped: FormValues = { ...form, "custom.0.remove": "true" };
    for (const k of ["id", "label", "amount", "currency", "vat", "included"]) { swapped[`custom.1.${k}`] = form[`custom.2.${k}`] ?? ""; swapped[`custom.2.${k}`] = form[`custom.1.${k}`] ?? ""; }
    const second = ok(swapped);
    const after = second.spec!.budget.costs.filter((x) => x.kind === "custom");
    expect(after.map((x) => x.id)).toEqual([c!.id, b!.id]);
    expect(after.map((x) => x.id)).not.toContain(a!.id);
    // endring av beskrivelse/beløp beholder id
    const edited = ok({ ...specToFormValues(second.name!, second.spec!), "custom.0.label": "C endret", "custom.0.amount": "99" });
    const e0 = edited.spec!.budget.costs.filter((x) => x.kind === "custom")[0]!;
    expect(e0).toMatchObject({ id: c!.id, label: "C endret", amountMinor: 9900n });
    // ny linje etter sletting får en NY id (slettede id-er gjenbrukes ikke)
    const withNew = ok({ ...specToFormValues(edited.name!, edited.spec!), "custom.2.label": "Ny" });
    const nid = withNew.spec!.budget.costs.filter((x) => x.kind === "custom").map((x) => x.id);
    expect(new Set(nid).size).toBe(3);
    expect(nid).not.toContain(a!.id);
  });
  it("dupliserte eller kolliderende id-er avvises", () => {
    const f = demo("demo-bmw", { "custom.0.id": "c-0000000000aa", "custom.0.label": "A", "custom.1.id": "c-0000000000aa", "custom.1.label": "B" });
    expect(parse(f).errors["custom.1.label"]).toMatch(/flere ganger/);
  });
});

describe("forhåndsvisning mot syntetiske annonser", () => {
  const prov = () => new SyntheticMarketplaceProvider();
  it("GLS-eksempelet gir null fullstendige treff og forklarer hva kilden ikke kan oppgi", async () => {
    const r = ok(demo("gls", { exteriorColorsPriority: "nice", plannedRegistration: "unspecified" }));
    const out = await previewSearch(r.spec!, prov());
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.counts.match).toBe(0);
    expect(out.coverage).toMatchObject({ evaluated: 109, sourceTotal: 109, truncated: false, rejectedBySource: 0, notAdapted: 0 });
    expect(out.sourceCannotSupply).toEqual(expect.arrayContaining(["modelYear", "seats", "equipment:camera_360", "equipment:carplay"]));
    // ingen GLS i datasettet: ingen bil har modelKey «gls»
    expect(out.items.some((i) => i.candidate.modelKey === "gls")).toBe(false);
  });

  it("demofixturen gir minst ett kjent treff og ett kjent kravbrudd; kravbrudd har forrang; ønsker utelukker aldri alene", async () => {
    const r = ok(demo("demo-bmw"));
    const out = await previewSearch(r.spec!, prov());
    if (!out.ok) throw new Error("kilden feilet");
    expect(out.counts.match).toBeGreaterThanOrEqual(1);
    expect(out.counts.excluded).toBeGreaterThanOrEqual(1);
    expect(out.counts.match + out.counts.needsReview + out.counts.excluded).toBe(109);
    for (const i of out.items) {
      const v = i.assessment.vehicle;
      if (v.excludedBy.length) expect(v.status).toBe("excluded");
      // fargeønsket («nice») er aldri årsak til utelukkelse eller «må kontrolleres»
      expect(v.excludedBy).not.toContain("exteriorColors");
      expect(v.unknownMust).not.toContain("exteriorColors");
    }
    // samme krav uten ønsket gir samme statuser
    const noWish = ok(demo("demo-bmw", { exteriorColors: [], exteriorColorsPriority: "" }));
    const out2 = await previewSearch(noWish.spec!, prov());
    if (!out2.ok) throw new Error("kilden feilet");
    expect(out2.items.map((i) => i.assessment.vehicle.status)).toEqual(out.items.map((i) => i.assessment.vehicle.status));
  });

  it("ingen kandidat blir fullt treff eller får bekreftet budsjettstatus uten kostnadsvurdering; ikke beregnet med grunn", async () => {
    const r = ok(demo("demo-bmw"));
    const out = await previewSearch(r.spec!, prov());
    if (!out.ok) throw new Error("kilden feilet");
    for (const i of out.items) {
      expect(i.assessment.isFullHit).toBe(false);
      expect(i.assessment.budget).toMatchObject({ status: "not_calculated", reason: "no_assessment", budgetMinor: 45_000_000n, upperLimitMinor: 49_500_000n });
    }
    // lokal mva.-påstand i annonsen gir ingen nettojustering: annonseprisen er uendret fra kilden
    const withVat = out.items.find((i) => i.listing.price?.vat.reclaimableClaim === "claimed" || i.listing.price?.vat.statedRateBasisPoints !== null);
    if (withVat) expect(i0(withVat.listing.price!.amount)).toBe(i0(withVat.listing.price!.amount));
  });

  it("budsjett usatt: også da ikke beregnet (no_budget)", async () => {
    const r = ok(demo("demo-bmw", { budgetMax: "", budgetDeviation: "" }));
    const out = await previewSearch(r.spec!, prov());
    if (!out.ok) throw new Error("kilden feilet");
    expect(out.items[0]!.assessment.budget).toMatchObject({ status: "not_calculated", reason: "no_budget" });
  });

  it("kildefeil gir feil uten resultater (ingen delvis dekning påstås)", async () => {
    const r = ok(demo("demo-bmw"));
    for (const code of ["unavailable", "timeout", "rate_limit", "malformed_data"] as const) {
      const out = await previewSearch(r.spec!, new SyntheticMarketplaceProvider({ failAll: code }));
      expect(out).toMatchObject({ ok: false, code });
    }
    // feil på side 2 gir feil, ikke et delvis resultat
    const out = await previewSearch(r.spec!, new SyntheticMarketplaceProvider({ failures: { search: [null, "unavailable"] } }));
    expect(out.ok).toBe(false);
  });

  it("avkorting markeres: kildens resultatgrense gir truncated=true og færre vurderte enn sourceTotal", async () => {
    const r = ok(demo("demo-bmw"));
    const out = await previewSearch(r.spec!, new SyntheticMarketplaceProvider({ resultCap: 30 }));
    if (!out.ok) throw new Error("kilden feilet");
    expect(out.coverage.truncated).toBe(true);
    expect(out.coverage.evaluated).toBe(30);
    expect(out.coverage.sourceTotal).toBe(109);
  });

  it("ugyldig providersvar avvises som malformed_data; uventet feil gir nøytral melding uten rå tekst", async () => {
    const r = ok(demo("demo-bmw"));
    const bad = { source: "synthetic-demo", search: async () => ({ items: "x" }), getListing: async () => null } as never;
    expect(await previewSearch(r.spec!, bad)).toMatchObject({ ok: false, code: "malformed_data" });
    const boom = { source: "synthetic-demo", search: async () => { throw new Error("hemmelig: passord=abc"); }, getListing: async () => null } as never;
    const out = await previewSearch(r.spec!, boom);
    expect(out).toMatchObject({ ok: false, code: "internal" });
    expect(JSON.stringify(out)).not.toMatch(/hemmelig|passord/);
    expect(new MarketplaceError("timeout", "x").retryable).toBe(true);
  });

  it("kildeevner (capabilities) stemmer med de faktiske annonsene: false = alltid ukjent, true = kjent for minst én", async () => {
    const built = buildCandidateAdapter(SYNTHETIC_MAPPING_DATA, DEMO_CATALOG);
    if (!built.ok) throw new Error("mapping");
    const p = new SyntheticMarketplaceProvider();
    const listings = [...(await p.search(EMPTY_QUERY, { page: 1, pageSize: 100 })).items, ...(await p.search(EMPTY_QUERY, { page: 2, pageSize: 100 })).items];
    const cands = listings.flatMap((l) => { const x = built.adapter.adapt(l); return x.ok ? [x.candidate] : []; });
    expect(cands.length).toBe(109);
    const val: Record<string, (c: (typeof cands)[number]) => unknown> = {
      brand: (c) => c.brandKey, model: (c) => c.modelKey, variant: (c) => c.variant, modelYear: (c) => c.modelYear, firstRegistration: (c) => c.firstRegistration,
      maxMileage: (c) => c.mileageKm, seats: (c) => c.seats, bodyTypes: (c) => c.bodyType, fuels: (c) => c.fuel, transmissions: (c) => c.transmission,
      driveTrains: (c) => c.driveTrain, exteriorColors: (c) => c.exteriorColor, interiorColors: (c) => c.interiorColor, interiorMaterials: (c) => c.interiorMaterial,
    };
    for (const [k, supplies] of Object.entries(SYNTHETIC_SOURCE_CAPABILITIES.fields)) {
      const any = cands.some((c) => val[k]!(c) !== null);
      expect(any, k).toBe(Boolean(supplies));
    }
    expect(cands.every((c) => c.equipment === null)).toBe(!SYNTHETIC_SOURCE_CAPABILITIES.equipment);
  });
});

describe("lagring: feilkoder og lesing", () => {
  it("databasefeil mappes til konflikt/ugyldig/ingen tilgang; ukjent kode gir generell feil uten rå tekst", () => {
    expect(mapError({ code: "23514", message: "search_draft_conflict: søket er endret" })).toBe("conflict");
    expect(mapError({ code: "23514", message: "new row violates check constraint" })).toBe("invalid");
    expect(mapError({ code: "42501", message: "x" })).toBe("forbidden");
    expect(mapError({ code: "XX000", message: "x" })).toBe("failed");
  });
  it("lagret dokument som ikke lenger passer katalogen avvises ved åpning (databasen kontrollerer ikke katalogen)", () => {
    const doc = ok(demo("demo-bmw")).json!;
    expect(specFromJson(doc, DEMO_CATALOG).ok).toBe(true);
    const bad = JSON.parse(JSON.stringify(doc));
    bad.vehicle.model = "finnes-ikke";
    expect(specFromJson(bad, DEMO_CATALOG).ok).toBe(false);
  });
});

function i0(m: { amountMinor: number; currency: string } | null) { return m ? `${m.amountMinor}${m.currency}` : null; }

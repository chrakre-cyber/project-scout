/**
 * DEMO-RESULTS-001: det kuraterte syntetiske BMW iX3-resultatsettet. Klassifiseringen skal komme fra evaluatoren (samme vei som søkesiden);
 * testene fester hvilke annonser som havner hvor og hvorfor, og at ukjent forblir ukjent. Alle data er syntetiske demodata.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEMO_CATALOG } from "@/adapters/search-catalog/demo-catalog";
import { demoIx3RawListings } from "@/providers/marketplace/synthetic/fixtures/demo-ix3";
import { syntheticRawListings } from "@/providers/marketplace/synthetic/fixtures";
import { SyntheticMarketplaceProvider } from "@/providers/marketplace/synthetic/provider";
import { VEHICLE_STATUS_LABEL } from "@/lib/search-labels";
import { orderForPresentation } from "@/lib/search-explain";
import { EXAMPLES } from "@/server/search-examples";
import { parseSearchFormValues } from "@/server/search-form";
import { specFromJson, specToJson } from "@/domain/search-v2/serialization";
import { previewSearch } from "@/server/search-preview";
import { detailForDisplay, previewForDisplay } from "@/server/search-display";
import { IX3_DEMO_IMAGES } from "@/server/demo-media";
import { publicIdFor } from "@/server/public-ids";
import { VEHICLE_STATUS_LABEL as LABEL } from "@/lib/search-labels";

let seq = 0;
const ids = () => (seq++).toString(16).padStart(12, "0");
const example = EXAMPLES.find((e) => e.id === "demo-ix3")!;
const parsed = parseSearchFormValues(example.values(), DEMO_CATALOG, { newCostId: ids });
if (!parsed.ok || !parsed.spec) throw new Error(JSON.stringify([parsed.errors, parsed.general]));
const spec = parsed.spec;

async function run() {
  const out = await previewSearch(spec, new SyntheticMarketplaceProvider());
  if (!out.ok) throw new Error("forhåndsvisning feilet: " + out.code);
  return out;
}
const idOf = (i: { listing: { sourceListingId: string } }) => i.listing.sourceListingId;

describe("DEMO-RESULTS-001: syntetisk BMW iX3-sett", () => {
  it("søket er merket syntetisk, og alle iX3-postene er syntetiske og merket som demo", () => {
    expect(example.note).toMatch(/Syntetiske demodata/);
    expect(example.note).toMatch(/ikke hentet fra noen leverandør/);
    expect(demoIx3RawListings.length).toBeGreaterThanOrEqual(8);
    expect(demoIx3RawListings.length).toBeLessThanOrEqual(12);
    for (const l of demoIx3RawListings) {
      expect(l.id).toMatch(/^dix3-\d{3}$/);
      expect(JSON.stringify(l)).toMatch(/syntetisk/i);
      expect(JSON.stringify(l)).not.toMatch(/mobile\.de/i);
    }
  });

  it("søket gir minst ett «Oppfyller kravene», ett «Må kontrolleres» og ett «Oppfyller ikke kravene» (etiketter fra evaluatoren)", async () => {
    const out = await run();
    const iX3 = out.items.filter((i) => idOf(i).startsWith("dix3-"));
    const labels = new Set(iX3.map((i) => VEHICLE_STATUS_LABEL[i.assessment.vehicle.status]));
    expect(labels).toEqual(new Set(["Oppfyller kravene", "Må kontrolleres", "Oppfyller ikke kravene"]));
    const by = (s: string) => iX3.filter((i) => i.assessment.vehicle.status === s).map(idOf).sort();
    expect(by("match")).toEqual(["dix3-001", "dix3-002", "dix3-003"]);
    expect(by("needs_review")).toEqual(["dix3-004", "dix3-005", "dix3-006"]);
    expect(by("excluded")).toEqual(["dix3-007", "dix3-008", "dix3-009", "dix3-010"]);
  });

  it("annonsen på toppen av iX3-resultatene er den modellerte «Inspiring»-bilen (dix3-001), rangert av presentasjonsrekkefølgen", async () => {
    const out = await run();
    const ordered = orderForPresentation(out.items.filter((i) => idOf(i).startsWith("dix3-")));
    expect(idOf(ordered[0]!)).toBe("dix3-001");
    expect(ordered[0]!.assessment.vehicle.status).toBe("match");
    const c = ordered[0]!.candidate;
    expect(c).toMatchObject({ brandKey: "bmw", modelKey: "ix3", variant: "Inspiring", mileageKm: 22_000, fuel: "electric", transmission: "automatic", exteriorColor: "grey" });
    expect(c.firstRegistration).toMatchObject({ year: 2024, month: 3 });
    expect(ordered[0]!.listing.price?.stated).toEqual({ amount: "36950", currency: "EUR" });
    expect(ordered[0]!.listing.price?.basis).toBe("net");
  });

  it("ukjent forblir ukjent: manglende felt gir «Må kontrolleres», aldri en antatt verdi", async () => {
    const out = await run();
    const get = (id: string) => out.items.find((i) => idOf(i) === id)!;
    expect(get("dix3-004").candidate.mileageKm).toBeNull();
    expect(get("dix3-006").candidate.transmission).toBeNull();
    expect(get("dix3-005").assessment.vehicle.status).toBe("needs_review");
    // utstyr, interiørfarge og drivlinje finnes bare i annonseteksten og når aldri evaluatoren: ukjent, aldri «ikke utstyrt»
    const top = get("dix3-001");
    expect(top.candidate.equipment).toBeNull();
    expect(top.candidate.interiorColor).toBeNull();
    expect(top.candidate.driveTrain).toBeNull();
  });

  it("batterihelse og bakhjulsdrift er ikke søkekriterier", () => {
    expect(JSON.stringify(spec, (_k, v) => (typeof v === "bigint" ? v.toString() : v))).not.toMatch(/batter|rwd|bakhjul/i);
    expect(spec.requirements.driveTrains).toEqual([]); // hjuldrift er i skjemaet, men demosøket krever den ikke (kilden kan ikke oppgi den)
  });

  it("iX3-postene endrer ikke øvrige datasett: ingen andre poster er iX3", () => {
    const others = syntheticRawListings.filter((l) => !l.id.startsWith("dix3-"));
    expect(others.some((l) => l.vehicle.model === "iX3")).toBe(false);
  });

  it("budsjettet i demosøket er 450 000 NOK med 8 000 NOK transport ekskl. mva. som inngår", () => {
    expect(spec.budget.maxTotalNokMinor).toBe(45_000_000n);
    expect(spec.budget.costs).toEqual([expect.objectContaining({ kind: "transport", currency: "NOK", amountMinor: 800_000n, vatBasis: "excl", includedInBudget: true })]);
  });
});

describe("DEMO-RESULTS-001: lokale demo-assets og berikelse", () => {
  const ROOT = join(__dirname, "..");
  const pid = (id: string) => publicIdFor("synthetic-demo", id, "synthetic");
  const EXPECTED = [
    "fd2067ac-7084-4171-809f-68ed2478385a", "8f28cf3f-953c-41f9-ae50-35397f3598d5", "d3aa8613-dc57-4661-bd9d-b71244ce70c6", "266b1dd3-7737-42c7-8266-cdd51de47372",
    "6b7d602a-b44e-4d37-8b20-8e7213f369ca", "0184fcc1-8bd6-4ce6-a766-d91071135c7d", "bace29ac-7d45-4db3-8f3f-cf2128a0b904", "39633f28-0749-4357-88af-14b7fc737e09",
  ];

  it("resultatkortet for BMW iX3 har hovedbildet som lokal asset; resten av iX3-postene har ingen bilder (ingen gjenbruk)", async () => {
    const out = await previewForDisplay(spec, { now: () => new Date() });
    if (!out.ok) throw new Error("feilet");
    const withMedia = out.items.filter((i) => i.media !== null);
    expect(withMedia).toHaveLength(1);
    expect(withMedia[0]!.media!.images[0]!.src).toBe("/demo/vehicles/bmw-ix3/fd2067ac-7084-4171-809f-68ed2478385a.jpg");
    expect(withMedia[0]!.listing.listingId).toBe(pid("dix3-001"));
    expect(withMedia[0]!.assessment.vehicle.status).toBe("match"); // fra evaluatoren
    expect(out.items.filter((i) => i.enrichment !== null)).toHaveLength(1);
  });

  it("detaljen har galleriet i riktig rekkefølge; alle filer finnes lokalt og er ikke eksterne URL-er", async () => {
    const d = await detailForDisplay(spec, pid("dix3-001"), { now: () => new Date() });
    if (d.kind !== "ok") throw new Error(d.kind);
    const m = d.item.media!;
    expect(m.origin).toBe("local_demo_asset");
    expect(m.images.map((i) => i.src)).toEqual(EXPECTED.map((id) => `/demo/vehicles/bmw-ix3/${id}.jpg`));
    expect(m.images.map((i) => i.group)).toEqual(["exterior", "exterior", "exterior", "exterior", "interior", "interior", "interior", "detail"]);
    expect(new Set(m.images.map((i) => i.src)).size).toBe(8);
    for (const i of IX3_DEMO_IMAGES) {
      expect(i.src).toMatch(/^\/demo\/vehicles\/bmw-ix3\/[0-9a-f-]+\.jpg$/);
      expect(existsSync(join(ROOT, "public", i.src)), i.src).toBe(true);
      expect(readFileSync(join(ROOT, "public", i.src)).subarray(0, 2).toString("hex")).toBe("ffd8"); // faktisk JPEG
      expect(i.alt).toMatch(/^Demobilde/);
    }
    expect(d.item.listing.attribution).toBeTruthy(); // eksisterende syntetisk-merking beholdes
  });

  it("berikelsen (batteristatus 96,3 %, 78 kWh, hengerfeste) vises, men er ikke krav og endrer ikke vurderingen", async () => {
    const d = await detailForDisplay(spec, pid("dix3-001"), { now: () => new Date() });
    if (d.kind !== "ok") throw new Error(d.kind);
    expect(d.item.enrichment).toMatchObject({ origin: "demo_enrichment", batteryHealthPct: 96.3, batteryCapacityKwh: 78, powerHp: 286, owners: 1 });
    expect(d.item.enrichment!.knownEquipment).toContain("Hengerfeste");
    // schemaet har ikke hengerfeste/batterihelse: søket endres ikke
    expect(JSON.stringify(spec, (_k, v) => (typeof v === "bigint" ? v.toString() : v))).not.toMatch(/tow|henger|batter/i);
    expect(d.item.assessment.vehicle.status).toBe("match");
    expect(LABEL[d.item.assessment.vehicle.status]).toBe("Oppfyller kravene");
  });

  it("evaluatoren ser fortsatt utstyr som ukjent (berikelsen når ikke kandidaten): ønskene er «ikke oppgitt»", async () => {
    const out = await run();
    const top = out.items.find((i) => idOf(i) === "dix3-001")!;
    expect(top.candidate.equipment).toBeNull();
    expect(top.candidate.interiorColor).toBeNull();
  });

  it("andre annonser enn dix3-001 har ingen berikelse eller bilder", async () => {
    for (const n of ["002", "004", "007"]) {
      const d = await detailForDisplay(spec, pid(`dix3-${n}`), { now: () => new Date() });
      if (d.kind !== "ok") throw new Error(d.kind);
      expect(d.item.media).toBeNull();
      expect(d.item.enrichment).toBeNull();
    }
  });

  it("ingen live provider-kall: demo-media, galleri og berikelse har ingen nettverk, miljøvariabler eller eksterne adresser", () => {
    for (const f of ["src/server/demo-media.ts", "src/components/search/ListingGallery.tsx", "src/components/search/DemoEnrichment.tsx"]) {
      const t = readFileSync(join(ROOT, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
      expect(t, f).not.toMatch(/fetch\(|process\.env|https?:\/\/|XMLHttpRequest/i);
    }
  });
});

describe("DEMO-RESULTS-001: søk med «Bakhjulsdrift» som krav (slik BMW iX3-søket kan være lagret i UI)", () => {
  // Samme semantikk som det lagrede søket: skjema → validert spec → lagret JSON → spec lest tilbake → forhåndsvisning.
  // Hjuldrift er et KRAV (ingen ønskeprioritet i schemaet), og den syntetiske kilden kan ikke oppgi hjuldrift.
  const stored = () => {
    const r = parseSearchFormValues({ ...example.values(), driveTrains: ["rwd"] }, DEMO_CATALOG, { newCostId: ids });
    if (!r.ok || !r.spec) throw new Error(JSON.stringify([r.errors, r.general]));
    const j = specToJson(r.spec, DEMO_CATALOG);
    if (!j.ok) throw new Error("kunne ikke serialiseres");
    const back = specFromJson(JSON.parse(JSON.stringify(j.value)), DEMO_CATALOG);
    if (!back.ok) throw new Error("kunne ikke leses tilbake");
    return back.value;
  };

  it("kravet når evaluatoren; ukjent hjuldrift gir «Må kontrolleres» for dix3-001 (ikke «Oppfyller kravene»), og ingen annonse oppfyller kravene", async () => {
    const s = stored();
    expect(s.requirements.driveTrains).toEqual(["rwd"]);
    const out = await previewSearch(s, new SyntheticMarketplaceProvider());
    if (!out.ok) throw new Error(out.code);
    expect(out.sourceCannotSupply).toContain("driveTrains");
    const top = out.items.find((i) => idOf(i) === "dix3-001")!;
    expect(top.candidate.driveTrain).toBeNull(); // berikelsen når aldri kandidaten
    expect(top.assessment.vehicle.status).toBe("needs_review");
    expect(top.assessment.vehicle.unknownMust).toEqual(["driveTrains"]);
    expect(top.assessment.vehicle.criteria.find((c) => c.criterion === "driveTrains")).toMatchObject({ priority: "must", status: "unknown", reason: "candidate_value_missing" });
    expect(out.items.filter((i) => idOf(i).startsWith("dix3-") && i.assessment.vehicle.status === "match")).toEqual([]);
    expect(out.counts.match).toBe(0);
  });
});

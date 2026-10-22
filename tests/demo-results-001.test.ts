/**
 * DEMO-RESULTS-001: det kuraterte syntetiske BMW iX3-resultatsettet. Klassifiseringen skal komme fra evaluatoren (samme vei som søkesiden);
 * testene fester hvilke annonser som havner hvor og hvorfor, og at ukjent forblir ukjent. Alle data er syntetiske demodata.
 */
import { describe, expect, it } from "vitest";
import { DEMO_CATALOG } from "@/adapters/search-catalog/demo-catalog";
import { demoIx3RawListings } from "@/providers/marketplace/synthetic/fixtures/demo-ix3";
import { syntheticRawListings } from "@/providers/marketplace/synthetic/fixtures";
import { SyntheticMarketplaceProvider } from "@/providers/marketplace/synthetic/provider";
import { VEHICLE_STATUS_LABEL } from "@/lib/search-labels";
import { orderForPresentation } from "@/lib/search-explain";
import { EXAMPLES } from "@/server/search-examples";
import { parseSearchFormValues } from "@/server/search-form";
import { previewSearch } from "@/server/search-preview";

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
});

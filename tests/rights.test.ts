/** Rene regler for lagringsrettigheter (DEC-028): hva som holdes tilbake og hvordan det merkes. */
import { describe, expect, it } from "vitest";
import { applyStoragePolicy, type StoragePolicy } from "@/domain/rights";
import { canonicalJson, projectSnapshot } from "@/domain/search-run";
import { fetchAll } from "./helpers";

const ALL: StoragePolicy = { profileVersion: 1, retentionSeconds: 60, allowPrice: true, allowSpecs: true, allowText: false, allowImages: false, allowSellerData: true };

describe("applyStoragePolicy", () => {
  it("tillatt alt: utdraget er uendret og withheld er tom", async () => {
    for (const l of (await fetchAll()).slice(0, 20)) {
      const base = projectSnapshot(l);
      expect(applyStoragePolicy(base, ALL)).toEqual({ ...base, withheld: [] });
    }
  });

  it("hver datatype holdes tilbake uavhengig av de andre, og merkes", async () => {
    const l = (await fetchAll()).find((x) => x.price && x.seller && x.specs.fuel)!;
    const base = projectSnapshot(l);
    const noPrice = applyStoragePolicy(base, { ...ALL, allowPrice: false });
    expect(noPrice.price).toBeNull();
    expect(noPrice.withheld).toEqual(["price"]);
    expect(noPrice.make).toBe(base.make);
    const noSpecs = applyStoragePolicy(base, { ...ALL, allowSpecs: false });
    expect([noSpecs.make, noSpecs.model, noSpecs.fuel, noSpecs.mileage, noSpecs.firstRegistration]).toEqual([null, null, null, null, null]);
    expect(noSpecs.price).toEqual(base.price);
    expect(noSpecs.withheld).toEqual(["specs"]);
    const noSeller = applyStoragePolicy(base, { ...ALL, allowSellerData: false });
    expect([noSeller.sellerType, noSeller.sellerCountry]).toEqual([null, null]);
    expect(noSeller.withheld).toEqual(["seller"]);
  });

  it("identitet, kilde og tidspunkter beholdes alltid; input muteres ikke", async () => {
    const base = projectSnapshot((await fetchAll())[0]!);
    const copy = structuredClone(base);
    const out = applyStoragePolicy(base, { ...ALL, allowPrice: false, allowSpecs: false, allowSellerData: false });
    expect(base).toEqual(copy);
    expect(out).toMatchObject({ source: base.source, sourceListingId: base.sourceListingId, firstSeenAt: base.firstSeenAt, lastSeenAt: base.lastSeenAt, provenanceKind: "synthetic" });
  });

  it("«tilbakeholdt» er skilt fra «ikke oppgitt» for en annonse uten pris", async () => {
    const noPrice = (await fetchAll()).find((l) => l.price === null)!;
    const stated = applyStoragePolicy(projectSnapshot(noPrice), ALL);
    expect(stated.price).toBeNull();
    expect(stated.withheld).toEqual([]); // ikke oppgitt i annonsen
    expect(applyStoragePolicy(projectSnapshot(noPrice), { ...ALL, allowPrice: false }).withheld).toEqual(["price"]);
  });

  it("er deterministisk (samme hash for samme input og policy)", async () => {
    const base = projectSnapshot((await fetchAll())[3]!);
    const p = { ...ALL, allowPrice: false };
    expect(canonicalJson(applyStoragePolicy(base, p))).toBe(canonicalJson(applyStoragePolicy(structuredClone(base), p)));
  });
});

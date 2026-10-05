/** SyntheticMarketplaceProvider: kontrakt, paginering, revisjoner, filtre og feil. */
import { describe, expect, it } from "vitest";
import { MarketplaceError, MARKETPLACE_ERROR_CODES } from "@/providers/marketplace/errors";
import { EMPTY_QUERY, SyntheticMarketplaceProvider } from "@/providers/marketplace/synthetic/provider";
import { fetchAll, raw } from "./helpers";

const q = (o: Partial<typeof EMPTY_QUERY>) => ({ ...EMPTY_QUERY, ...o });

async function expectError(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toBeInstanceOf(MarketplaceError);
  await expect(p).rejects.toMatchObject({ code });
}

describe("search og getListing", () => {
  it("getListing gir samme normaliserte annonse som search", async () => {
    const provider = new SyntheticMarketplaceProvider();
    for (const l of await fetchAll(provider)) expect(await provider.getListing(l.sourceListingId)).toEqual(l);
    expect(await provider.getListing("finnes-ikke")).toBeNull();
  });

  it("paginerer uten hull eller duplikater, og siste side har nextPage null", async () => {
    const provider = new SyntheticMarketplaceProvider();
    const ids: string[] = [];
    let total = 0;
    for (let page: number | null = 1; page !== null; ) {
      const res = await provider.search(EMPTY_QUERY, { page, pageSize: 7 });
      expect(res.items.length).toBeLessThanOrEqual(7);
      ids.push(...res.items.map((l) => l.sourceListingId));
      total = res.sourceTotal;
      page = res.nextPage;
    }
    expect(ids.length).toBe(total);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(ids);
    const beyond = await provider.search(EMPTY_QUERY, { page: 999, pageSize: 7 });
    expect(beyond.items).toEqual([]);
    expect(beyond.nextPage).toBeNull();
  });

  it("avviser ugyldige sidevinduer og spørringer som invalid_query", async () => {
    const p = new SyntheticMarketplaceProvider();
    await expectError(p.search(EMPTY_QUERY, { page: 0 }), "invalid_query");
    await expectError(p.search(EMPTY_QUERY, { pageSize: 101 }), "invalid_query");
    await expectError(p.search(EMPTY_QUERY, { pageSize: 1.5 }), "invalid_query");
    await expectError(p.search(EMPTY_QUERY, { modifiedSince: "i går" }), "invalid_query");
    await expectError(p.search(q({ yearMin: 2022, yearMax: 2020 }), {}), "invalid_query");
  });

  it("markerer truncation når kilden har flere treff enn grensen, uten å skjule totalen", async () => {
    const p = new SyntheticMarketplaceProvider({ resultCap: 50 });
    const first = await p.search(EMPTY_QUERY, { page: 1, pageSize: 20 });
    expect(first.truncated).toBe(true);
    expect(first.sourceTotal).toBeGreaterThan(50);
    const third = await p.search(EMPTY_QUERY, { page: 3, pageSize: 20 });
    expect(third.items.length).toBe(10);
    expect(third.nextPage).toBeNull();
    const untruncated = await new SyntheticMarketplaceProvider().search(EMPTY_QUERY, {});
    expect(untruncated.truncated).toBe(false);
  });

  it("bruker injisert klokke for fetchedAt", async () => {
    const p = new SyntheticMarketplaceProvider({ now: () => new Date("2026-10-05T08:00:00Z") });
    expect((await p.search(EMPTY_QUERY, {})).fetchedAt).toBe("2026-10-05T08:00:00.000Z");
  });
});

describe("endret annonse, duplikat og ødelagte poster", () => {
  it("leverer siste revisjon, og eldre revisjon når kilden ses på et tidligere tidspunkt", async () => {
    const latest = await new SyntheticMarketplaceProvider().getListing("demo-004");
    expect(latest?.price?.amount?.amountMinor).toBe(5_490_000);
    const before = await new SyntheticMarketplaceProvider({ asOf: "2026-10-02T00:00:00Z" }).getListing("demo-004");
    expect(before?.price?.amount?.amountMinor).toBe(5_690_000);
    expect(before?.sourceModifiedAt).toBe("2026-10-01T07:45:00.000Z");
  });

  it("slår sammen identiske duplikater til én annonse", async () => {
    const all = await fetchAll();
    expect(all.filter((l) => l.sourceListingId === "syn-020")).toHaveLength(1);
  });

  it("avviser motstridende poster og ødelagte poster uten å miste resten av siden", async () => {
    const p = new SyntheticMarketplaceProvider({
      records: [
        raw({ id: "a" }),
        raw({ id: "b", price: { amount: "1000", currency: "EUR" } }),
        raw({ id: "b", price: { amount: "2000", currency: "EUR" } }), // samme modifiedAt, annen pris
        raw({ id: "c", price: { amount: "ikke et tall", currency: "EUR" } }),
        raw({ id: "d" }),
      ],
    });
    const page = await p.search(EMPTY_QUERY, {});
    expect(page.items.map((l) => l.sourceListingId)).toEqual(["a", "d"]);
    expect(page.rejected.map((r) => r.sourceListingId)).toEqual(["b", "c"]);
    expect(page.sourceTotal).toBe(4);
    await expectError(p.getListing("b"), "malformed_data");
  });
});

describe("filtre og enheter", () => {
  it("regner miles om eksakt bare for sammenligning mot km-grense", async () => {
    const p = new SyntheticMarketplaceProvider();
    const merc = q({ make: "mercedes-benz", model: "E-Klasse" }); // 38 000 mi ≈ 61 155 km
    const ids = async (maxKm: number) => (await p.search({ ...merc, maxMileageKm: maxKm }, {})).items.map((l) => l.sourceListingId);
    expect(await ids(61_155)).not.toContain("demo-008");
    expect(await ids(61_156)).toContain("demo-008");
    expect((await p.getListing("demo-008"))?.specs.mileage).toEqual({ value: 38_000, unit: "mi" });
  });

  it("ekskluderer ikke annonser med ukjent verdi; DEV-010 avgjør needs_review", async () => {
    const p = new SyntheticMarketplaceProvider();
    const res = await p.search(q({ make: "Mercedes-Benz", yearMin: 2023 }), {});
    expect(res.items.map((l) => l.sourceListingId)).toContain("demo-008"); // ukjent registrering
  });

  it("sammenligner ikke pris på tvers av valuta", async () => {
    const p = new SyntheticMarketplaceProvider();
    const res = await fetchAll(p);
    const cheapEur = q({ maxPrice: { amountMinor: 100, currency: "EUR" } });
    const items = [];
    for (let page: number | null = 1; page !== null; ) {
      const r = await p.search(cheapEur, { page, pageSize: 100 });
      items.push(...r.items);
      page = r.nextPage;
    }
    expect(items.some((l) => l.price?.amount?.currency === "EUR")).toBe(false);
    expect(items.map((l) => l.sourceListingId)).toContain("demo-009"); // USD: ikke sammenlignbar
    expect(items.length).toBeLessThan(res.length);
  });

  it("modifiedSince tar med ukjent endringstid og utelater eldre endringer", async () => {
    const p = new SyntheticMarketplaceProvider();
    const ids = (await p.search(q({ make: "Skoda", model: "Octavia" }), { modifiedSince: "2026-10-01T00:00:00Z" })).items.map((l) => l.sourceListingId);
    expect(ids).toContain("demo-005"); // modifiedAt ukjent
    const old = (await p.search(q({ make: "Volvo", model: "V60" }), { modifiedSince: "2026-10-01T00:00:00Z" })).items;
    expect(old.map((l) => l.sourceListingId)).not.toContain("demo-003"); // endret 30.09
  });
});

describe("simulerte feil uten nettverk", () => {
  it("kan simulere alle feiltyper, og bare transiente er retryable", async () => {
    for (const code of MARKETPLACE_ERROR_CODES) {
      const p = new SyntheticMarketplaceProvider({ failAll: code });
      await expectError(p.search(EMPTY_QUERY, {}), code);
      const err = await p.getListing("demo-001").catch((e: MarketplaceError) => e);
      expect((err as MarketplaceError).retryable).toBe(["rate_limit", "timeout", "unavailable"].includes(code));
    }
  });

  it("feil i én forespørsel påvirker ikke neste", async () => {
    const p = new SyntheticMarketplaceProvider({ failures: { search: ["timeout", null] } });
    await expectError(p.search(EMPTY_QUERY, {}), "timeout");
    expect((await p.search(EMPTY_QUERY, {})).items.length).toBeGreaterThan(0);
  });
});

/** Rangering, deduplisering, snapshot og kanonisk JSON for søkekjøringer. */
import { describe, expect, it } from "vitest";
import { canonicalJson, evaluateAndRank, projectSnapshot } from "@/domain/search-run";
import { EMPTY_QUERY } from "@/providers/marketplace/synthetic/provider";
import { fetchAll } from "./helpers";

describe("canonicalJson", () => {
  it("er uavhengig av nøkkelrekkefølge og ignorerer undefined", () => {
    expect(canonicalJson({ b: 1, a: { d: [1, { z: 1, y: 2 }], c: null } })).toBe(canonicalJson({ a: { c: null, d: [1, { y: 2, z: 1 }] }, b: 1, x: undefined }));
    expect(canonicalJson({ a: 1 })).not.toBe(canonicalJson({ a: "1" }));
  });
});

describe("evaluateAndRank", () => {
  it("rangerer treff før «må kontrolleres», deretter nyest først-sett, deretter ID; rank er 1..n", async () => {
    const all = await fetchAll();
    const f = { ...EMPTY_QUERY, make: "Volkswagen", yearMin: 2018 };
    const { planned, excluded } = evaluateAndRank(f, all);
    expect(planned.length + excluded).toBe(all.length);
    expect(planned.map((p) => p.rank)).toEqual(planned.map((_, i) => i + 1));
    const firstReview = planned.findIndex((p) => p.status === "needs_review");
    if (firstReview >= 0) expect(planned.slice(firstReview).every((p) => p.status === "needs_review")).toBe(true);
    // Deterministisk uavhengig av inputrekkefølge
    expect(evaluateAndRank(f, [...all].reverse()).planned.map((p) => p.listing.sourceListingId)).toEqual(planned.map((p) => p.listing.sourceListingId));
  });

  it("fjerner duplikater på (kilde, ID) og teller dem", async () => {
    const all = await fetchAll();
    const r = evaluateAndRank(EMPTY_QUERY, [...all, all[0]!, all[1]!]);
    expect(r.duplicates).toBe(2);
    expect(r.planned.length).toBe(all.length);
  });

  it("tomt resultat er gyldig", () => {
    expect(evaluateAndRank({ ...EMPTY_QUERY, make: "Ingenting" }, [])).toEqual({ planned: [], excluded: 0, duplicates: 0 });
  });
});

describe("projectSnapshot", () => {
  it("tar ikke med annonsetekst, selgerby eller proveniensnotater, og er stabil", async () => {
    const all = await fetchAll();
    for (const l of all) {
      const s = projectSnapshot(l);
      const json = canonicalJson(s);
      expect(json).toBe(canonicalJson(projectSnapshot(structuredClone(l))));
      expect(Object.keys(s)).not.toContain("text");
      if (l.text) expect(json).not.toContain(l.text);
      if (l.seller?.city) expect(json).not.toContain(l.seller.city);
      expect(s.provenanceKind).toBe("synthetic");
      expect(json.length).toBeLessThan(8000);
    }
  });
  it("beholder ustøttet valuta uten omregning og manglende pris som null", async () => {
    const all = await fetchAll();
    const unsupported = all.find((l) => l.price && l.price.amount === null);
    if (unsupported) expect(projectSnapshot(unsupported).price?.amountMinor).toBeNull();
    const none = all.find((l) => l.price === null);
    if (none) expect(projectSnapshot(none).price).toBeNull();
  });
});

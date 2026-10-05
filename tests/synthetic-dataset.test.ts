/**
 * Invarianter for hele det syntetiske datasettet etter normalisering
 * (CLAUDE.md pkt. 3–4, SPRINT_1_HANDOFF DEV-003).
 */
import { beforeAll, describe, expect, it } from "vitest";
import { demoAgents } from "@/demo/fixtures";
import type { NormalizedListing } from "@/domain/types";
import { fetchAll } from "./helpers";

let listings: NormalizedListing[];
beforeAll(async () => {
  listings = await fetchAll();
});

describe("syntetisk datasett", () => {
  it("har minst 100 unike annonser og beholder DEV-001-demoens ID-er", () => {
    const ids = listings.map((l) => l.sourceListingId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(100);
    for (let i = 1; i <= 8; i++) expect(ids).toContain(`demo-00${i}`);
  });

  it("er merket syntetisk, uten originallenke og uten mobile.de-referanser", () => {
    for (const l of listings) {
      expect(l.provenance.kind).toBe("synthetic");
      expect(l.source).toBe("synthetic-demo");
      expect(l.originalUrl).toBeNull();
    }
    const data = JSON.stringify(listings);
    expect(data).not.toMatch(/https?:|www\./i);
    expect(data).not.toMatch(/mobile\.de/i);
  });

  it("bruker aldri 0 som erstatning for ukjent", () => {
    for (const l of listings) {
      if (l.price?.amount) expect(l.price.amount.amountMinor).toBeGreaterThan(0);
      if (l.specs.powerKw !== null) expect(l.specs.powerKw).toBeGreaterThan(0);
      if (l.specs.curbWeightKg !== null) expect(l.specs.curbWeightKg).toBeGreaterThan(0);
      if (l.specs.co2?.gramsPerKm === 0) expect(l.specs.fuel).toBe("electric");
    }
  });

  it("har bare brutto/netto med belegg, og mva.-belegg fra tekst står i teksten", () => {
    for (const l of listings) {
      if (!l.price) continue;
      if (l.price.basis !== "unknown") expect(l.price.basisEvidence, l.sourceListingId).toBeTruthy();
      if (l.price.vat.origin === "listing_text") {
        for (const e of l.price.vat.evidence) expect(l.text, l.sourceListingId).toContain(e);
      }
      if (l.price.vat.origin === "none") {
        expect(l.price.vat.reclaimableClaim).toBe("unknown");
        expect(l.price.vat.statedRateBasisPoints).toBeNull();
      }
    }
  });

  it("har lastSeenAt som ikke er før firstSeenAt", () => {
    for (const l of listings) expect(l.lastSeenAt >= l.firstSeenAt, l.sourceListingId).toBe(true);
  });

  it("dekker variantene konsumentene må tåle", () => {
    const some = (f: (l: NormalizedListing) => boolean) => listings.some(f);
    expect(some((l) => l.price?.basis === "unknown")).toBe(true);
    expect(some((l) => l.price?.basis === "gross" && l.price.basisEvidence !== null)).toBe(true);
    expect(some((l) => l.price?.basis === "net" && l.price.basisEvidence !== null)).toBe(true);
    expect(some((l) => l.price?.vat.reclaimableClaim === "claimed" && l.price.basis === "unknown")).toBe(true);
    expect(some((l) => l.price !== null && l.price.amount === null && l.price.stated.currency === "USD")).toBe(true);
    expect(some((l) => l.price === null)).toBe(true);
    expect(some((l) => l.price?.amount?.currency === "CHF")).toBe(true);
    expect(some((l) => l.specs.firstRegistration?.precision === "date")).toBe(true);
    expect(some((l) => l.specs.firstRegistration?.precision === "month")).toBe(true);
    expect(some((l) => l.specs.firstRegistration?.precision === "year")).toBe(true);
    expect(some((l) => l.specs.firstRegistration === null)).toBe(true);
    expect(some((l) => l.specs.mileage?.unit === "mi")).toBe(true);
    expect(some((l) => l.specs.mileage === null)).toBe(true);
    expect(some((l) => l.sourceModifiedAt === null)).toBe(true);
    expect(some((l) => l.provenance.normalizationNotes.length > 0)).toBe(true);
  });
});

describe("demo-agenter mot provideren", () => {
  it("peker bare på annonser provideren har", () => {
    const ids = new Set(listings.map((l) => l.sourceListingId));
    for (const a of demoAgents) for (const id of a.demoListingIds) expect(ids.has(id), id).toBe(true);
  });

  it("holder seg innenfor maks 10 aktive (DEC-003) og har positivt minimum bidrag", () => {
    expect(demoAgents.filter((a) => a.status === "active").length).toBeLessThanOrEqual(10);
    for (const a of demoAgents) {
      if (a.assumptions.minimumContribution) expect(a.assumptions.minimumContribution.amountMinor).toBeGreaterThan(0);
    }
  });
});

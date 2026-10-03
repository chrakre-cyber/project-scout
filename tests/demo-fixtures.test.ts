/**
 * Kontrollerer at demodataene holder reglene i CLAUDE.md (pkt. 3–4) og
 * SPRINT_1_HANDOFF DEV-001: tydelig syntetisk, ingen oppdiktede kildelenker,
 * ukjent er null og ikke 0.
 */
import { describe, expect, it } from "vitest";
import { demoAgents, demoListings } from "@/demo/fixtures";

describe("syntetiske demoannonser", () => {
  it("har åtte unike annonser", () => {
    const ids = demoListings.map((l) => l.sourceListingId);
    expect(ids).toHaveLength(8);
    expect(new Set(ids).size).toBe(8);
  });

  it("er merket syntetisk og har ingen originallenke", () => {
    for (const l of demoListings) {
      expect(l.provenance.kind).toBe("synthetic");
      expect(l.originalUrl).toBeNull();
      expect(l.source).not.toMatch(/mobile/i);
    }
  });

  it("inneholder ingen URL-er eller mobile.de-referanser i dataene", () => {
    const data = JSON.stringify({ demoListings, demoAgents });
    expect(data).not.toMatch(/https?:|www\./i);
    expect(data).not.toMatch(/mobile\.de/i);
  });

  it("bruker null for ukjent i stedet for 0", () => {
    for (const l of demoListings) {
      const s = l.specs;
      expect(l.price.amount.amountMinor).toBeGreaterThan(0);
      expect(Number.isInteger(l.price.amount.amountMinor)).toBe(true);
      if (s.mileage) expect(s.mileage.value).toBeGreaterThan(0);
      if (s.powerKw !== null) expect(s.powerKw).toBeGreaterThan(0);
      if (s.curbWeightKg !== null) expect(s.curbWeightKg).toBeGreaterThan(0);
      // 0 g/km er bare en kjent verdi for rene elbiler.
      if (s.co2?.gramsPerKm === 0) expect(s.fuel).toBe("electric");
    }
  });

  it("dekker ukjente og upresise felt slik at UI-et viser «ikke oppgitt»", () => {
    expect(demoListings.some((l) => l.price.basis === "unknown")).toBe(true);
    expect(demoListings.some((l) => l.specs.firstRegistration?.precision === "year")).toBe(true);
    expect(demoListings.some((l) => l.specs.firstRegistration === null)).toBe(true);
    expect(demoListings.some((l) => l.specs.mileage === null)).toBe(true);
    expect(demoListings.some((l) => l.specs.mileage?.unit === "mi")).toBe(true);
  });
});

describe("demo-agenter", () => {
  it("peker bare på eksisterende annonser", () => {
    const ids = new Set(demoListings.map((l) => l.sourceListingId));
    for (const a of demoAgents) for (const id of a.demoListingIds) expect(ids.has(id)).toBe(true);
  });

  it("holder seg innenfor maks 10 aktive (DEC-003)", () => {
    expect(demoAgents.filter((a) => a.status === "active").length).toBeLessThanOrEqual(10);
  });

  it("har positivt minimum bidrag der det er satt", () => {
    for (const a of demoAgents) {
      if (a.assumptions.minimumContribution) expect(a.assumptions.minimumContribution.amountMinor).toBeGreaterThan(0);
    }
  });
});

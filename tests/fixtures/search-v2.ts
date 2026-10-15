/**
 * Fixturer for søkemodell v1 (SEARCH-002). ALT HER ER SYNTETISK TESTDATA: katalogen er ikke en produksjonsfasit
 * og kostnadsvurderingene er ikke offisielle avgiftsfasiter eller beregninger fra noen avgiftsprofil.
 */
import { staticCatalog } from "@/domain/search-v2/catalog";
import { emptyCandidate, emptySpec } from "@/domain/search-v2/factory";
import { BUDGET_BASIS } from "@/domain/search-v2/types";
import type { CandidateV2, CostAssessment, SearchSpec } from "@/domain/search-v2/types";

export const TEST_CATALOG = staticCatalog({
  id: "test-fixture-not-production",
  brands: { "mercedes-benz": ["gls", "gle", "c-klasse"], bmw: ["x5", "3-serie"], volvo: ["xc90"] },
  equipment: ["panoramic_roof", "air_suspension", "camera_360", "heated_seats_front", "carplay", "rear_camera", "laser_light", "isofix"],
  exteriorColors: ["black", "white", "grey", "blue", "other"],
  interiorColors: ["beige", "black", "brown"],
  interiorMaterials: ["leather", "fabric", "alcantara"],
});

/** Prototypens GLS-eksempel uttrykt i søkemodell v1: 750 000 kr + 10 %, ingen salgspris eller margin. */
export function glsSpec(): SearchSpec {
  const s = emptySpec();
  s.vehicle = { brand: "mercedes-benz", model: "gls", variant: null };
  s.requirements.modelYear = { min: 2021, max: null };
  s.requirements.seats = { min: 7, max: 7 };
  s.appearance.exteriorColors = { values: ["black", "white"], priority: "must" };
  s.equipment = [
    { key: "camera_360", priority: "must" },
    { key: "carplay", priority: "must" },
    { key: "panoramic_roof", priority: "nice" },
    { key: "air_suspension", priority: "nice" },
    { key: "heated_seats_front", priority: "nice" },
  ];
  s.budget = { maxTotalNokMinor: 75_000_000n, deviationBasisPoints: 1000, costs: [] };
  return s;
}

/** En GLS som oppfyller alle «must»-krav i glsSpec; utstyr kan overstyres. */
export function glsCandidate(id: string, over: Partial<CandidateV2> = {}): CandidateV2 {
  return {
    ...emptyCandidate(id),
    brandKey: "mercedes-benz", modelKey: "gls", modelYear: 2022, seats: 7, exteriorColor: "black",
    equipment: { present: ["camera_360", "carplay"], absent: [], listComplete: false },
    ...over,
  };
}

/** Syntetisk, tydelig falsk kostnadsvurdering. `totalMinor` er et valgt testtall, ikke en beregning. */
export function synthAssessment(totalMinor: bigint, over: Partial<CostAssessment> = {}): CostAssessment {
  return {
    totalMinor, currency: "NOK", basis: BUDGET_BASIS, registrationScenario: "passenger", status: "complete_validated",
    profileRef: "SYNTHETIC-TEST-PROFILE-NOT-A-TAX-REFERENCE", validUntil: "2026-12-31T23:59:59Z", coveredCostLineIds: [], ...over,
  };
}

export const NOW = "2026-10-15T12:00:00Z";

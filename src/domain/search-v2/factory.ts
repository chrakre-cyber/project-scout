/** Tomme startverdier: «ikke satt» overalt for søket, «ukjent» overalt for kandidaten. */
import type { CandidateV2, SearchSpec } from "./types";

export function emptySpec(): SearchSpec {
  return {
    vehicle: { brand: null, model: null, variant: null },
    requirements: {
      modelYear: null, firstRegistration: null, maxMileageKm: null, seats: null,
      bodyTypes: [], fuels: [], transmissions: [], driveTrains: [],
    },
    appearance: { exteriorColors: null, interiorColors: null, interiorMaterials: null },
    equipment: [],
    budget: { maxTotalNokMinor: null, deviationBasisPoints: null, costs: [] },
    plannedRegistration: { requested: "unspecified" },
  };
}

/** Kandidat der alt er ukjent (null). Ukjent er aldri 0, tom streng eller «skadefri»/«uten utstyr». */
export function emptyCandidate(id: string): CandidateV2 {
  return {
    id, brandKey: null, modelKey: null, variant: null, modelYear: null, firstRegistration: null, mileageKm: null,
    seats: null, bodyType: null, fuel: null, transmission: null, driveTrain: null,
    exteriorColor: null, interiorColor: null, interiorMaterial: null, equipment: null, packages: null, currentCategory: null,
  };
}

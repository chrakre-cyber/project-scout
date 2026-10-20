/** Byggeklosser for ECON-005c-tester. Alt er syntetisk/hypotetisk testdata; ingen leverandør har gitt noen rettighet og ingen kilde er verifisert. */
import { emptySpec } from "@/domain/search-v2/factory";
import type { CandidateV2, CostLine, SearchSpec } from "@/domain/search-v2/types";
import type { NormalizedListing } from "@/domain/types";
import type { DealerInputV1, StoredDealerInput } from "@/domain/search-economics";
import { bindingFor, confirmationContextFor } from "@/server/search-economics";
import type { ResolvedRights } from "@/domain/provider-rights";

export const NOW = new Date("2026-10-20T10:00:00Z");
export const FIRM_A = "00000000-0000-4000-a000-00000000000a";
export const FIRM_B = "00000000-0000-4000-a000-00000000000b";
export const SEARCH_1 = "11111111-1111-4111-8111-111111111111";
export const SEARCH_2 = "22222222-2222-4222-8222-222222222222";

export const listing = (over: Partial<NormalizedListing> = {}): NormalizedListing => ({
  source: "synthetic-demo", sourceListingId: "ad-1", originalUrl: null, sourceModifiedAt: "2026-10-19T08:00:00Z",
  firstSeenAt: "2026-10-19T08:00:00Z", lastSeenAt: "2026-10-20T09:00:00Z",
  price: { stated: { amount: "100000", currency: "NOK" }, amount: { amountMinor: 10_000_000, currency: "NOK" }, basis: "net", basisEvidence: "Netto eksportpris (annonsetekst)", vat: { statedRateBasisPoints: null, reclaimableClaim: "unknown", evidence: [], origin: "none" } },
  specs: {
    make: "Syntetisk", model: "Testbil", variant: null, firstRegistration: { precision: "month", year: 2023, month: 11 }, mileage: { value: 30_000, unit: "km" },
    fuel: "electric", transmission: "automatic", bodyType: "suv", powerKw: 150, co2: { gramsPerKm: 179, testMethod: "WLTP" }, curbWeightKg: 1976, color: null,
  },
  text: null, seller: { type: "dealer", countryCode: "DE", city: null }, provenance: { kind: "synthetic", description: "test", normalizationNotes: [] },
  ...over,
});

export const candidate = (over: Partial<CandidateV2> = {}): CandidateV2 => ({
  id: "13:synthetic-demo/ad-1", version: "rev1:" + "a".repeat(64), brandKey: null, modelKey: null, variant: null, modelYear: null, firstRegistration: null, mileageKm: null, seats: null,
  bodyType: null, fuel: null, transmission: null, driveTrain: null, exteriorColor: null, interiorColor: null, interiorMaterial: null, equipment: null, packages: null, currentCategory: null,
  ...over,
});

export const line = (id: string, kind: CostLine["kind"], amountMinor: bigint | null, over: Partial<CostLine> = {}): CostLine =>
  ({ id, kind, label: `linje ${id}`, currency: "NOK", amountMinor, vatBasis: "incl", includedInBudget: true, ...over });
export const specOf = (costs: CostLine[] = [], scenario: SearchSpec["plannedRegistration"]["requested"] = "passenger", maxMinor: bigint | null = 100_000_000_000n): SearchSpec =>
  ({ ...emptySpec(), budget: { maxTotalNokMinor: maxMinor, deviationBasisPoints: null, costs }, plannedRegistration: { requested: scenario } });

/** Fullstendig, gyldig forhandlerinput (dokumentert bensin/diesel-eksempel fra golden-fixturen: diesel, 1976 kg, 179 g/km, 2023-11). */
export const dealerInput = (over: Partial<DealerInputV1> = {}): DealerInputV1 => ({
  schemaVersion: 1,
  propulsion: { pistonCombustionEngine: true, externallyChargeable: false, combustionFuel: "diesel", hybridization: "none", basis: "type_approval" },
  taxWeight: { kg: 1976, basis: "vehicle_register" },
  co2: { gramsPerKm: 179, method: "wltp_combined" },
  firstRegistration: { precision: "month", value: "2023-11", basis: "vehicle_register" },
  norwegianRegistration: { date: "2026-10-30", kind: "expected" },
  customsDate: { date: "2026-10-20", kind: "actual_acceptance" },
  foreignVat: { treatment: "excluded_documented", evidence: "invoice_or_contract" },
  transportToBorder: { amount: "8000" },
  transportAfterBorder: { state: "not_applicable", basis: "test" },
  loadingHandling: { state: "not_applicable", basis: "test" },
  insurance: { amount: "0" },
  climateGas: { state: "not_applicable", basis: "test" },
  registrationFee: { state: "not_applicable", basis: "test" },
  deduction: "non_recoverable",
  vatHandling: "registered_reports_in_vat_return",
  ...over,
});

export function stored(opts: { rights: ResolvedRights; spec: SearchSpec; input?: DealerInputV1; dealershipId?: string; searchId?: string; cand?: CandidateV2; confirmedAt?: string }): StoredDealerInput {
  const cand = opts.cand ?? candidate();
  return {
    binding: bindingFor(opts.dealershipId ?? FIRM_A, opts.searchId ?? SEARCH_1, cand), input: opts.input ?? dealerInput(),
    context: confirmationContextFor(opts.spec, opts.rights), confirmedBy: "user-1", confirmedAt: opts.confirmedAt ?? "2026-10-20T09:30:00Z",
  };
}

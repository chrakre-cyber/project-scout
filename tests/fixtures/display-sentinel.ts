import type { NormalizedListing } from "@/domain/types";

/** Annonse der hvert visbart felt har en unik, søkbar sentinelverdi. */
export function sentinelListing(source = "synthetic-demo"): NormalizedListing {
  return {
    source,
    sourceListingId: "sentinel-1",
    originalUrl: "https://sentinel-url.example/ad/1",
    sourceModifiedAt: "2026-10-01T08:00:00Z",
    firstSeenAt: "2026-10-01T08:00:00Z",
    lastSeenAt: "2026-10-02T08:00:00Z",
    price: {
      stated: { amount: "31337", currency: "EUR" },
      amount: { amountMinor: 3_133_700, currency: "EUR" },
      basis: "gross",
      basisEvidence: "SENTINEL-PRISBELEGG",
      vat: { statedRateBasisPoints: 1900, reclaimableClaim: "claimed", evidence: ["SENTINEL-MVA"], origin: "listing_text" },
    },
    specs: {
      make: "SENTINEL-MERKE", model: "SENTINEL-MODELL", variant: "SENTINEL-VARIANT",
      firstRegistration: { precision: "date", year: 2019, month: 7, day: 23 },
      mileage: { value: 424_242, unit: "km" },
      fuel: "diesel", transmission: "automatic", bodyType: "estate", powerKw: 777,
      co2: { gramsPerKm: 99, testMethod: "WLTP" }, curbWeightKg: 1888, color: "SENTINEL-FARGE",
    },
    text: "SENTINEL-FRITEKST ring 12345678",
    seller: { type: "dealer", countryCode: "DE", city: "SENTINEL-BY" },
    provenance: { kind: "synthetic", description: "SENTINEL-PROVENANS", normalizationNotes: [] },
  };
}


/**
 * SYNTETISKE DEMODATA — DEV-001.
 *
 * Alt i denne filen er oppdiktet for å vise appskallet. Det er ikke
 * mobile.de-responser, ikke ekte annonser, ikke referansepriser og ikke
 * validerte avgifts- eller margintall. Merker/modeller er bare generiske
 * eksempler. Ukjente felt er bevisst `null` for å vise «ikke oppgitt».
 *
 * DEV-003 erstatter dette med en MarketplaceProvider med ≥100 fixturer.
 */
import type { NormalizedListing, SearchAgent } from "@/domain/types";

export const DEMO_SOURCE = "synthetic-demo";

const provenance = {
  kind: "synthetic",
  description: "Syntetisk demo-fixture (DEV-001). Ikke en ekte annonse.",
} as const;

export const demoListings: readonly NormalizedListing[] = [
  {
    source: DEMO_SOURCE,
    sourceListingId: "demo-001",
    originalUrl: null,
    sourceModifiedAt: "2026-10-02T14:10:00Z",
    firstSeenAt: "2026-10-03T06:30:00Z",
    price: { amount: { amountMinor: 3_249_000, currency: "EUR" }, basis: "gross", basisEvidence: "«Preis inkl. MwSt.» (syntetisk)" },
    specs: {
      make: "Volkswagen", model: "Golf", variant: "Variant 1.5 eTSI",
      firstRegistration: { precision: "month", year: 2023, month: 4 },
      mileage: { value: 28_400, unit: "km" }, fuel: "petrol", transmission: "automatic",
      bodyType: "estate", powerKw: 110, co2: { gramsPerKm: 129, testMethod: "WLTP" },
      curbWeightKg: 1_390, color: "Grå",
    },
    text: "Syntetisk annonsetekst: servicehefte, tilhengerfeste, to nøkler.",
    seller: { type: "dealer", countryCode: "DE", city: "Hamburg" },
    provenance,
  },
  {
    source: DEMO_SOURCE,
    sourceListingId: "demo-002",
    originalUrl: null,
    sourceModifiedAt: null,
    firstSeenAt: "2026-10-02T19:05:00Z",
    price: { amount: { amountMinor: 4_190_000, currency: "EUR" }, basis: "net", basisEvidence: "«Nettopreis, MwSt. ausweisbar» (syntetisk)" },
    specs: {
      make: "Toyota", model: "RAV4", variant: "2.5 Plug-in Hybrid AWD",
      firstRegistration: { precision: "date", year: 2022, month: 11, day: 15 },
      mileage: { value: 41_000, unit: "km" }, fuel: "plugin_hybrid", transmission: "automatic",
      bodyType: "suv", powerKw: 225, co2: { gramsPerKm: 22, testMethod: "WLTP" },
      curbWeightKg: null, color: "Hvit",
    },
    text: "Syntetisk annonsetekst: panoramatak, vinterhjul medfølger.",
    seller: { type: "dealer", countryCode: "DE", city: "München" },
    provenance,
  },
  {
    source: DEMO_SOURCE,
    sourceListingId: "demo-003",
    originalUrl: null,
    sourceModifiedAt: "2026-09-30T08:00:00Z",
    firstSeenAt: "2026-10-01T11:20:00Z",
    price: { amount: { amountMinor: 2_790_000, currency: "EUR" }, basis: "unknown", basisEvidence: null },
    specs: {
      make: "Volvo", model: "V60", variant: "B4 Momentum",
      firstRegistration: { precision: "year", year: 2021 },
      mileage: { value: 67_500, unit: "km" }, fuel: "hybrid", transmission: "automatic",
      bodyType: "estate", powerKw: 145, co2: null,
      curbWeightKg: null, color: null,
    },
    text: null,
    seller: { type: "unknown", countryCode: "DE", city: null },
    provenance,
  },
  {
    source: DEMO_SOURCE,
    sourceListingId: "demo-004",
    originalUrl: null,
    sourceModifiedAt: "2026-10-03T07:45:00Z",
    firstSeenAt: "2026-10-03T08:00:00Z",
    price: { amount: { amountMinor: 5_490_000, currency: "EUR" }, basis: "gross", basisEvidence: "«MwSt. ausweisbar» (syntetisk)" },
    specs: {
      make: "BMW", model: "X3", variant: "xDrive30e",
      firstRegistration: { precision: "month", year: 2024, month: 2 },
      mileage: { value: 12_900, unit: "km" }, fuel: "plugin_hybrid", transmission: "automatic",
      bodyType: "suv", powerKw: 215, co2: { gramsPerKm: 41, testMethod: "WLTP" },
      curbWeightKg: 2_045, color: "Svart",
    },
    text: "Syntetisk annonsetekst: hengerfeste, head-up display, fabrikkgaranti oppgitt.",
    seller: { type: "dealer", countryCode: "DE", city: "Köln" },
    provenance,
  },
  {
    source: DEMO_SOURCE,
    sourceListingId: "demo-005",
    originalUrl: null,
    sourceModifiedAt: null,
    firstSeenAt: "2026-09-28T15:40:00Z",
    price: { amount: { amountMinor: 1_895_000, currency: "EUR" }, basis: "gross", basisEvidence: null },
    specs: {
      make: "Skoda", model: "Octavia", variant: "Combi 2.0 TDI",
      firstRegistration: { precision: "date", year: 2020, month: 6, day: 2 },
      mileage: { value: 89_000, unit: "km" }, fuel: "diesel", transmission: "manual",
      bodyType: "estate", powerKw: 110, co2: { gramsPerKm: 117, testMethod: "NEDC" },
      curbWeightKg: 1_460, color: "Blå",
    },
    text: "Syntetisk annonsetekst: ingen skadeomtale i teksten.",
    seller: { type: "private", countryCode: "DE", city: null },
    provenance,
  },
  {
    source: DEMO_SOURCE,
    sourceListingId: "demo-006",
    originalUrl: null,
    sourceModifiedAt: "2026-10-01T09:30:00Z",
    firstSeenAt: "2026-10-02T09:35:00Z",
    price: { amount: { amountMinor: 3_650_000, currency: "EUR" }, basis: "net", basisEvidence: "«Exportpreis netto» (syntetisk; gir ikke automatisk rett til nettopris)" },
    specs: {
      make: "Audi", model: "A6", variant: "Avant 40 TDI quattro",
      firstRegistration: { precision: "month", year: 2022, month: 9 },
      mileage: null, fuel: "diesel", transmission: "automatic",
      bodyType: "estate", powerKw: 150, co2: null,
      curbWeightKg: null, color: "Grå",
    },
    text: "Syntetisk annonsetekst: kilometerstand ikke oppgitt i annonsen.",
    seller: { type: "dealer", countryCode: "AT", city: "Salzburg" },
    provenance,
  },
  {
    source: DEMO_SOURCE,
    sourceListingId: "demo-007",
    originalUrl: null,
    sourceModifiedAt: null,
    firstSeenAt: "2026-10-03T05:15:00Z",
    price: { amount: { amountMinor: 2_399_000, currency: "EUR" }, basis: "gross", basisEvidence: "«inkl. 19 % MwSt.» (syntetisk)" },
    specs: {
      make: "Hyundai", model: "Kona", variant: "Electric 64 kWh",
      firstRegistration: { precision: "month", year: 2022, month: 5 },
      mileage: { value: 34_200, unit: "km" }, fuel: "electric", transmission: "automatic",
      bodyType: "suv", powerKw: 150, co2: { gramsPerKm: 0, testMethod: "WLTP" },
      curbWeightKg: 1_685, color: "Rød",
    },
    text: "Syntetisk annonsetekst: varmepumpe, batterisertifikat ikke nevnt.",
    seller: { type: "dealer", countryCode: "DE", city: "Berlin" },
    provenance,
  },
  {
    source: DEMO_SOURCE,
    sourceListingId: "demo-008",
    originalUrl: null,
    sourceModifiedAt: null,
    firstSeenAt: "2026-09-30T20:50:00Z",
    price: { amount: { amountMinor: 4_480_000, currency: "EUR" }, basis: "unknown", basisEvidence: null },
    specs: {
      make: "Mercedes-Benz", model: "E-Klasse", variant: null,
      firstRegistration: null,
      mileage: { value: 38_000, unit: "mi" }, fuel: null, transmission: "automatic",
      bodyType: "sedan", powerKw: null, co2: null,
      curbWeightKg: null, color: null,
    },
    text: null,
    seller: null,
    provenance,
  },
];

/**
 * Demo-agenter. Koblingen til annonser (`demoListingIds`) er håndplukket for
 * demoen — det er ikke resultatet av en matching-motor (kommer i DEV-010).
 * Retail/bidrag er syntetiske eksempelinput fra en tenkt forhandler.
 */
export interface DemoAgent extends SearchAgent {
  demoListingIds: readonly string[];
}

export const demoAgents: readonly DemoAgent[] = [
  {
    id: "agent-demo-a",
    name: "Familiestasjonsvogn under 400 000",
    status: "active",
    version: 1,
    lastSuccessAt: null,
    filters: {
      make: null, model: null, yearMin: 2020, yearMax: null, maxMileageKm: 100_000,
      fuels: [], transmissions: [], bodyTypes: ["estate"], countryCodes: ["DE", "AT"],
      maxPrice: { amountMinor: 4_000_000, currency: "EUR" },
    },
    assumptions: {
      retail: {
        expectedRetailTotal: { amountMinor: 39_990_000, currency: "NOK" },
        priceBasisDescription: "Syntetisk eksempel: totalpris til sluttkunde inkl. mva. og registreringsavgifter",
      },
      minimumContribution: { amountMinor: 3_000_000, currency: "NOK" },
      preparationReserve: { amountMinor: 1_500_000, currency: "NOK" },
    },
    demoListingIds: ["demo-001", "demo-003", "demo-005", "demo-006"],
  },
  {
    id: "agent-demo-b",
    name: "Ladbar SUV, automat",
    status: "active",
    version: 3,
    lastSuccessAt: null,
    filters: {
      make: null, model: null, yearMin: 2021, yearMax: null, maxMileageKm: 60_000,
      fuels: ["plugin_hybrid", "electric"], transmissions: ["automatic"], bodyTypes: ["suv"], countryCodes: ["DE"],
      maxPrice: { amountMinor: 6_000_000, currency: "EUR" },
    },
    assumptions: {
      retail: {
        expectedRetailTotal: { amountMinor: 52_990_000, currency: "NOK" },
        priceBasisDescription: "Syntetisk eksempel: totalpris til sluttkunde inkl. mva. og registreringsavgifter",
      },
      minimumContribution: { amountMinor: 4_000_000, currency: "NOK" },
      preparationReserve: null,
    },
    demoListingIds: ["demo-002", "demo-004", "demo-007"],
  },
  {
    id: "agent-demo-c",
    name: "Mercedes E-Klasse",
    status: "paused",
    version: 2,
    lastSuccessAt: null,
    filters: {
      make: "Mercedes-Benz", model: "E-Klasse", yearMin: 2019, yearMax: null, maxMileageKm: null,
      fuels: [], transmissions: ["automatic"], bodyTypes: [], countryCodes: [],
      maxPrice: null,
    },
    assumptions: { retail: null, minimumContribution: null, preparationReserve: null },
    demoListingIds: ["demo-008"],
  },
];

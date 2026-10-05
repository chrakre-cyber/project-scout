/**
 * SYNTETISKE DEMO-AGENTER (DEV-001).
 *
 * Annonsene er flyttet til den syntetiske MarketplaceProvideren (DEV-003,
 * src/providers/marketplace/synthetic). Agentene blir her til lagring av
 * agenter kommer i DEV-004. Retail/bidrag er syntetiske eksempelinput.
 */
import type { SearchAgent } from "@/domain/types";

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

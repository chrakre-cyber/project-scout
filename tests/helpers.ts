import type { NormalizedListing } from "@/domain/types";
import type { SyntheticRawListing } from "@/providers/marketplace/synthetic/raw";
import { EMPTY_QUERY, SyntheticMarketplaceProvider } from "@/providers/marketplace/synthetic/provider";

/** Henter alle normaliserte annonser via søk med paginering, slik en konsument ville gjort. */
export async function fetchAll(provider = new SyntheticMarketplaceProvider()): Promise<NormalizedListing[]> {
  const all: NormalizedListing[] = [];
  for (let page: number | null = 1; page !== null; ) {
    const res = await provider.search(EMPTY_QUERY, { page, pageSize: 100 });
    all.push(...res.items);
    page = res.nextPage;
  }
  return all;
}

/** Minimal gyldig råpost for målrettede normaliseringstester. */
export function raw(overrides: Partial<SyntheticRawListing> = {}): SyntheticRawListing {
  return {
    id: "t-1",
    modifiedAt: "2026-10-01T10:00:00Z",
    observed: { firstSeenAt: "2026-10-01T12:00:00Z", lastSeenAt: "2026-10-02T12:00:00Z" },
    price: { amount: "20000", currency: "EUR", type: null },
    vehicle: { make: "Volkswagen", model: "Golf" },
    description: null,
    seller: null,
    ...overrides,
  };
}

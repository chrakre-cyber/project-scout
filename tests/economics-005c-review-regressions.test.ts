import { describe, expect, it } from "vitest";
import { toEconomicsInput } from "@/adapters/search-economics/to-economics-input";
import { assessEconomics, type EconomicsRequest } from "@/server/search-economics";
import { REGISTERED_PROFILES, rightsForSource } from "@/domain/provider-rights";
import { FIRM_A, NOW, SEARCH_1, candidate, dealerInput, line, listing, specOf, stored } from "./fixtures/economics-005c";

const base = (over: Partial<EconomicsRequest> = {}): EconomicsRequest => {
  const spec = specOf();
  const rights = rightsForSource("synthetic-demo", NOW, REGISTERED_PROFILES);
  return { dealershipId: FIRM_A, searchId: SEARCH_1, listing: listing(), candidate: candidate(), spec, stored: stored({ rights, spec }), profile: null, now: NOW, ...over };
};

describe("independent ECON-005c boundary regressions", () => {
  it("does not read registration when denied and dealer owns the technical input", () => {
    const l = listing();
    let reads = 0;
    Object.defineProperty(l.specs, "firstRegistration", { get() { reads++; return { precision: "month", year: 2023, month: 11 }; }, enumerable: true });
    const r = toEconomicsInput({ listing: l, spec: specOf(), dealer: { input: dealerInput(), confirmedBy: "u", confirmedAt: NOW.toISOString() }, profile: null, allowedFields: new Set(["price"]), now: NOW.toISOString() });
    expect(r.ok).toBe(true);
    expect(reads).toBe(0);
  });
  it("does not apply one listing's confirmation to another listing", () => {
    const original = listing();
    const cand = candidate({ id: `${original.source.length}:${original.source}/${original.sourceListingId}` });
    const spec = specOf();
    const rights = rightsForSource("synthetic-demo", NOW, REGISTERED_PROFILES);
    const r = assessEconomics(base({ listing: listing({ sourceListingId: "another-ad" }), candidate: cand, spec, stored: stored({ rights, spec, cand }) }));
    // A server rejection is allowed; what is forbidden is assessed+fresh under the old identity.
    expect(r.kind === "assessed" && r.dealerInput.status === "fresh").toBe(false);
  });
  it("does not issue a fresh cost assessment for a future source observation", () => {
    const r = assessEconomics(base({ listing: listing({ lastSeenAt: "2026-10-21T10:00:00Z" }) }));
    expect(r.kind === "assessed" && r.detail?.outcome.assessment !== null && r.detail?.outcome.assessment !== undefined).toBe(false);
  });
  it("does not feed a split exceeding the search line amount into the core", () => {
    const spec = specOf([line("t", "transport", 800_000n)]);
    const rights = rightsForSource("synthetic-demo", NOW, REGISTERED_PROFILES);
    const input = dealerInput({ transportToBorder: undefined, transportAfterBorder: undefined, lineScopes: { t: { split: { toBorderMinor: "10000000", afterBorderMinor: "0" } } } });
    const r = assessEconomics(base({ spec, stored: stored({ spec, rights, input }) }));
    expect(r.kind === "assessed" && r.detail?.result.transportToBorderNok === 100000n).toBe(false);
  });
});

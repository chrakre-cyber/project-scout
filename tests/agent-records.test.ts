/** Mapping databaserad → domene for agenter (R5-pengeformat). */
import { describe, expect, it } from "vitest";
import { MoneyBoundaryError } from "@/domain/currency";
import { agentFromRow, type AgentRow } from "@/server/agent-records";

const row = (o: Partial<AgentRow>): AgentRow => ({
  id: "a1", name: "Agent", filters: {}, assumptions: {}, active: false, version: 1, last_success_at: null, ...o,
});

describe("agentFromRow", () => {
  it("leser penger fra tekst eksakt og lar ukjent være null", () => {
    const a = agentFromRow(row({
      filters: { make: "BMW", maxPrice: { amountMinor: "9007199254740991", currency: "EUR" } },
      assumptions: { minimumContribution: { amountMinor: "3000000", currency: "NOK" }, preparationReserve: { amount: { amountMinor: "0", currency: "NOK" }, vatBasis: "ex_vat" } },
    }));
    expect(a.filters.maxPrice).toEqual({ amountMinor: 9007199254740991, currency: "EUR" });
    expect(a.filters.model).toBeNull();
    expect(a.assumptions.minimumContribution).toEqual({ amountMinor: 3_000_000, currency: "NOK" });
    expect(a.assumptions.preparationReserve).toEqual({ amount: { amountMinor: 0, currency: "NOK" }, vatBasis: "ex_vat" });
    expect(a.assumptions.retail.expectedRetailTotal).toBeNull();
    expect(a.status).toBe("paused");
  });

  it("feiler høyt på penger som JSON-tall i stedet for å godta mulig presisjonstap", () => {
    expect(() => agentFromRow(row({ filters: { maxPrice: { amountMinor: 100, currency: "EUR" } } }))).toThrow(MoneyBoundaryError);
  });

  it("ukjente verdier i prisgrunnlag blir null, ikke gjettet", () => {
    const a = agentFromRow(row({ assumptions: { retail: { priceBasis: { vat: "kanskje", registrationTaxes: "included" } } } }));
    expect(a.assumptions.retail.priceBasis).toEqual({ vat: null, registrationTaxes: "included" });
  });
});

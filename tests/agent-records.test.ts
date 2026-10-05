/** Validering av ny agent og mapping databaserad → domene. */
import { describe, expect, it } from "vitest";
import { MoneyBoundaryError } from "@/domain/currency";
import { agentFromRow, emptyFiltersFor, filtersToDb, validateNewAgent, type AgentRow } from "@/server/agent-records";

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};
const row = (o: Partial<AgentRow>): AgentRow => ({
  id: "a1", name: "Agent", filters: {}, assumptions: {}, active: false, version: 1, last_success_at: null, ...o,
});

describe("validateNewAgent", () => {
  it("ignorerer firma-ID og andre ukjente felt fra skjemaet", () => {
    const r = validateNewAgent(form({ name: " Golf ", make: "Volkswagen", model: "", dealership_id: "firma-b", active: "true" }));
    expect(r).toEqual({ ok: true, value: { name: "Golf", make: "Volkswagen", model: null } });
  });

  it("avviser tomt eller for langt navn og modell uten merke", () => {
    expect(validateNewAgent(form({ name: "   " })).ok).toBe(false);
    expect(validateNewAgent(form({ name: "x".repeat(121) })).ok).toBe(false);
    expect(validateNewAgent(form({ name: "A", model: "Golf" })).ok).toBe(false);
  });
});

describe("agentFromRow", () => {
  it("leser penger fra tekst eksakt og lar ukjent være null", () => {
    const a = agentFromRow(row({
      filters: { make: "BMW", maxPrice: { amountMinor: "9007199254740991", currency: "EUR" } },
      assumptions: { minimumContribution: { amountMinor: "3000000", currency: "NOK" } },
    }));
    expect(a.filters.maxPrice).toEqual({ amountMinor: 9007199254740991, currency: "EUR" });
    expect(a.filters.model).toBeNull();
    expect(a.filters.yearMin).toBeNull();
    expect(a.assumptions.minimumContribution).toEqual({ amountMinor: 3_000_000, currency: "NOK" });
    expect(a.assumptions.retail).toBeNull();
    expect(a.status).toBe("paused");
  });

  it("feiler høyt på penger som JSON-tall i stedet for å godta mulig presisjonstap", () => {
    expect(() => agentFromRow(row({ filters: { maxPrice: { amountMinor: 100, currency: "EUR" } } }))).toThrow(MoneyBoundaryError);
  });

  it("skriver filtre med penger som tekst", () => {
    const f = { ...emptyFiltersFor({ name: "x", make: null, model: null }), maxPrice: { amountMinor: 4_000_000, currency: "EUR" } };
    expect(filtersToDb(f).maxPrice).toEqual({ amountMinor: "4000000", currency: "EUR" });
  });
});

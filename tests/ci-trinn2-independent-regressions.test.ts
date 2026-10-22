/**
 * Reviewerens regresjon fra review av 9de93c1 (P2): «L4 rejects remote database / remote API before opening a database connection or writing fixtures».
 * Opprinnelig fil: reviews/CI-001-trinn2-reviewer-regresjon.test.ts.txt. Kravene og påstandene er beholdt uendret (avslag med /ikke-lokal/ og NULL kall mot Client);
 * bare testhjelperen er tilpasset: oppstarten refaktorert med en felles forhåndsvalidering (`preflightTargets`) som skriptet importerer, så importlinjene injiseres nå
 * av tests/ci/startup-harness.ts (som kjører de ekte støttemodulene) i stedet for å strippes. Utvidet til alle tre skript i tests/ci-e2e-preflight.test.ts.
 */
import { afterEach, expect, it, vi } from "vitest";
import { runStartup } from "./ci/startup-harness";

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

it.each([
  ["remote database", "postgres://test@db.example.invalid:5432/test", "http://127.0.0.1:54321"],
  ["remote API", "postgres://test@127.0.0.1:54322/test", "https://api.example.invalid"],
])("L4 rejects %s before opening a database connection or writing fixtures", async (_label, dbUrl, apiUrl) => {
  const r = await runStartup("l4-browser.e2e.mjs", { E2E_SUPABASE_MODE: "real", SUPABASE_TEST_DB_URL: dbUrl, SUPABASE_TEST_URL: apiUrl, SUPABASE_TEST_PUBLISHABLE_KEY: "test-key" });
  expect(r.error?.message ?? "").toMatch(/ikke-lokal/);
  expect(r.calls, "local-only validation must precede connect() and all fixture writes").toEqual([]);
});

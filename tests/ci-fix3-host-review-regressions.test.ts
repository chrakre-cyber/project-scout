import { afterEach, expect, it, vi } from "vitest";
import pg from "pg";
import { preflightTargets } from "./e2e/support/preflight.mjs";
import { runStartup } from "./ci/startup-harness";

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

const target = "postgres://test@127.0.0.1:54322/test?host=db.example.invalid";
const env = {
  E2E_SUPABASE_MODE: "real",
  SUPABASE_TEST_DB_URL: target,
  SUPABASE_TEST_URL: "http://127.0.0.1:54321",
  SUPABASE_TEST_PUBLISHABLE_KEY: "test-key",
};

it("rejects a remote effective pg host despite a loopback URL hostname", () => {
  // Constructor only: no connect(), DNS, network, database or browser.
  const client = new pg.Client({ connectionString: target });
  const parsed = client as unknown as { connectionParameters: { host: string } };
  expect(new URL(target).hostname).toBe("127.0.0.1");
  expect(parsed.connectionParameters.host).toBe("db.example.invalid");
  expect(() => preflightTargets({ mode: "real", env })).toThrow();
});

it("rejects an effective remote host before L4 constructs its database client", async () => {
  const r = await runStartup("l4-browser.e2e.mjs", env);
  expect(r.calls, "query parameters must not bypass the local-only guard").toEqual([]);
  expect(r.error).not.toBeNull();
});

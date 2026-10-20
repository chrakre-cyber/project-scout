/** Copy to tests/db/ and run against the existing isolated DB harness. Not run by reviewer: PostgreSQL unavailable. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { adminDb, assertLocal } from "./harness";

let db: Client;
beforeAll(async () => { assertLocal(); db = await adminDb(); });
afterAll(async () => { if (db) await db.end(); });

describe("empty derived-economics map must fail closed", () => {
  it("validator returns false rather than SQL NULL for an empty object", async () => {
    const r = await db.query("select private.economics_rights_map_valid('{}'::jsonb) as valid");
    expect(r.rows[0]!.valid).toBe(false);
  });
  it.each([false, true])("constraint rejects empty map with display=%s", async (display) => {
    await db.query("begin");
    try {
      await expect(db.query(`insert into private.provider_rights_profiles
        (provider, version, effective_from, retention_seconds, source_ref, environment, allow_derived_economics, display_derived_economics)
        values ('review-empty-map', 1, '2026-10-01T00:00:00Z', 0, 'REVIEW TEST', 'sandbox', '{}'::jsonb, $1)`, [display]))
        .rejects.toMatchObject({ code: "23514" });
    } finally { await db.query("rollback"); }
  });
});

/**
 * DATA-002D (runtime rights loading) — `private.trusted_rights_profiles()` (migrasjon 20261024090000): skrivebeskyttet leseveg for rettighetsprofiler.
 * Kjøres mot lokal Supabase eller den isolerte klyngen (`bash scripts/test-db-isolated.sh tests/db/data002d-runtime-rights-read.test.ts`).
 * Hver test kjører i en transaksjon som rulles tilbake. Radene fra funksjonen mates gjennom den FAKTISKE domene-lasteren (`buildRuntimeRights`).
 */
import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { RIGHTS_FIELD_KEYS, SYNTHETIC_RIGHTS_PROFILE } from "@/domain/provider-rights";
import { buildRuntimeRights, profileFromRow, resolveRuntimeRights } from "@/domain/rights-runtime";
import { profileDigest } from "@/server/public-ids";
import { adminDb, assertLocal } from "./harness";

let db: Client;
beforeAll(async () => { assertLocal(); db = await adminDb(); });
afterAll(async () => { if (db) await db.end(); });

async function tx<T>(fn: () => Promise<T>): Promise<T> { await db.query("begin"); try { return await fn(); } finally { await db.query("rollback"); } }
async function attempt(sql: string, params: unknown[] = []): Promise<{ ok: true; rows: Record<string, unknown>[] } | { ok: false; code: string }> {
  await db.query("savepoint s");
  try { const r = await db.query(sql, params); await db.query("release savepoint s"); return { ok: true, rows: r.rows }; }
  catch (e) { await db.query("rollback to savepoint s"); return { ok: false, code: (e as { code?: string }).code ?? "" }; }
}
const NOW = new Date("2026-10-23T12:00:00Z");
const display = (over: Record<string, boolean> = {}) => JSON.stringify({ ...Object.fromEntries(RIGHTS_FIELD_KEYS.map((k) => [k, false])), ...over });
const insertSandbox = (provider: string, status: "draft" | "verified") => db.query(
  `insert into private.provider_rights_profiles (provider, version, status, effective_from, retention_seconds, source_ref, environment, provider_name, attribution_text, display_fields, verified_by, verified_at)
   values ($1, 1, $2, '2026-10-01T00:00:00Z', 3600, 'TESTFIXTURE — hypotetisk', 'sandbox', 'Eksempel', 'Kilde', $3::jsonb, $4, $5)`,
  [provider, status, display({ price: true, source_url: true }), status === "verified" ? "test" : null, status === "verified" ? "2026-10-02T00:00:00Z" : null]);

describe("private.trusted_rights_profiles()", () => {
  it("er SECURITY DEFINER med tom search_path, stable, og kjørbar bare for scout_ingest", async () => {
    const r = (await db.query("select prosecdef, provolatile, proconfig from pg_proc where oid = 'private.trusted_rights_profiles()'::regprocedure")).rows[0]!;
    expect(r).toEqual({ prosecdef: true, provolatile: "s", proconfig: ["search_path=\"\""] });
    for (const role of ["anon", "authenticated", "service_role", "public"]) {
      expect((await db.query("select has_function_privilege($1, 'private.trusted_rights_profiles()', 'execute') x", [role])).rows[0]!.x, role).toBe(false);
    }
    expect((await db.query("select has_function_privilege('scout_ingest', 'private.trusted_rights_profiles()', 'execute') x")).rows[0]!.x).toBe(true);
  });

  it("ordinære roller kan ikke kalle den (ingen lesing av rettighetsprofiler utenfor den betrodde veien)", async () => {
    for (const role of ["anon", "authenticated"]) {
      await tx(async () => {
        await db.query(`set local role ${role}`);
        const r = await attempt("select * from private.trusted_rights_profiles()");
        expect(r.ok, role).toBe(false);
        if (!r.ok) expect(r.code, role).toBe("42501");
      });
    }
  });

  it("scout_ingest kan kalle funksjonen, men fortsatt ikke lese tabellen direkte", async () => {
    await tx(async () => {
      await db.query("set local role scout_ingest");
      const viaFn = await attempt("select provider from private.trusted_rights_profiles()");
      expect(viaFn.ok).toBe(true);
      const direct = await attempt("select * from private.provider_rights_profiles");
      expect(direct.ok).toBe(false);
      if (!direct.ok) expect(direct.code).toBe("42501");
    });
  });

  it("leverer ALLE statuser (utkast, verifisert, trukket) slik at avslagsårsaken blir riktig — ikke bare profilen som gjelder", async () => {
    await tx(async () => {
      await insertSandbox("rt-verified", "verified");
      await insertSandbox("rt-draft", "draft");
      await insertSandbox("rt-revoked", "verified");
      await db.query("update private.provider_rights_profiles set status = 'revoked' where provider = 'rt-revoked'");
      const rows = (await db.query("select * from private.trusted_rights_profiles()")).rows;
      const byProvider = Object.fromEntries(rows.map((r) => [r.provider as string, r.status as string]));
      expect(byProvider).toMatchObject({ "rt-verified": "verified", "rt-draft": "draft", "rt-revoked": "revoked", "synthetic-demo": "verified" });
    });
  });

  it("raden fra faktisk database tolkes av domene-lasteren: syntetisk rad = kodeprofilen (samme avtrykk, ingen konflikt); verifisert gjelder, utkast/trukket avslås med riktig årsak", async () => {
    await tx(async () => {
      await insertSandbox("rt-verified", "verified");
      await insertSandbox("rt-draft", "draft");
      await insertSandbox("rt-revoked", "verified");
      await db.query("update private.provider_rights_profiles set status = 'revoked' where provider = 'rt-revoked'");
      const rows = (await db.query("select * from private.trusted_rights_profiles()")).rows;

      const synthetic = rows.find((r) => r.provider === "synthetic-demo")!;
      const mapped = profileFromRow(synthetic);
      expect(mapped.ok).toBe(true);
      if (mapped.ok) {
        expect(profileDigest(mapped.profile)).toBe(profileDigest(SYNTHETIC_RIGHTS_PROFILE)); // DB-raden speiler kodeprofilen (backfill-migrasjonene)
        expect(mapped.profile).toEqual({ ...SYNTHETIC_RIGHTS_PROFILE, verifiedAt: mapped.profile.verifiedAt }); // verifiedAt = tidspunktet migrasjonen ble anvendt (ikke en rettighet, ikke i avtrykket)
      }

      const rt = buildRuntimeRights({ codeProfiles: [SYNTHETIC_RIGHTS_PROFILE], database: rows, now: NOW, digestOf: profileDigest });
      expect(rt.status).toBe("ok");
      expect(rt.rejected).toEqual([]);
      expect(resolveRuntimeRights(rt, "synthetic-demo", NOW).inForce).toBe(true);
      const ok = resolveRuntimeRights(rt, "rt-verified", NOW);
      expect(ok.inForce && ok.profile.display.price).toBe(true);
      expect(ok.inForce && ok.profile.display.images).toBe(false);
      expect(resolveRuntimeRights(rt, "rt-draft", NOW)).toMatchObject({ inForce: false, reason: "not_verified" });
      expect(resolveRuntimeRights(rt, "rt-revoked", NOW)).toMatchObject({ inForce: false, reason: "revoked" });
      expect(resolveRuntimeRights(rt, "finnes-ikke", NOW)).toMatchObject({ inForce: false, reason: "unknown_provider" });
    });
  });

  it("er skrivebeskyttet: funksjonen endrer ingenting (ingen rad, ingen sidevirkning på tabellen)", async () => {
    await tx(async () => {
      const before = (await db.query("select md5(string_agg(row(p.*)::text, '|' order by p.provider, p.version)) m from private.provider_rights_profiles p")).rows[0]!.m;
      await db.query("select * from private.trusted_rights_profiles()");
      const after = (await db.query("select md5(string_agg(row(p.*)::text, '|' order by p.provider, p.version)) m from private.provider_rights_profiles p")).rows[0]!.m;
      expect(after).toBe(before);
    });
  });
});

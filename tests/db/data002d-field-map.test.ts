/**
 * DATA-002D — `private.rights_field_map_valid` er total (true/false, aldri NULL) og `display_fields`/`matching_fields` krever IS TRUE
 * (migrasjon 20261022090000). Direkte databasetilkobling som eier; kjøres mot lokal Supabase eller den isolerte klyngen
 * (`bash scripts/test-db-isolated.sh tests/db/data002d-field-map.test.ts`). Hver test kjører i en transaksjon som rulles tilbake.
 * Oppgraderingstestene (scratch-database med eldre rader) kjøres bare i den isolerte klyngen.
 */
import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { RIGHTS_FIELD_KEYS, SYNTHETIC_RIGHTS_PROFILE, noRights, validateProfile, type ProviderRightsProfile } from "@/domain/provider-rights";
import { adminDb, assertLocal } from "./harness";
import { profile } from "../fixtures/rights-profiles";

let db: Client;
beforeAll(async () => { assertLocal(); db = await adminDb(); });
afterAll(async () => { if (db) await db.end(); });

async function tx<T>(fn: () => Promise<T>): Promise<T> { await db.query("begin"); try { return await fn(); } finally { await db.query("rollback"); } }
async function attempt(sql: string, params: unknown[] = []): Promise<{ ok: true; rows: Record<string, unknown>[] } | { ok: false; code: string; message: string }> {
  await db.query("savepoint s");
  try { const r = await db.query(sql, params); await db.query("release savepoint s"); return { ok: true, rows: r.rows }; }
  catch (e) { await db.query("rollback to savepoint s"); const x = e as { code?: string; message?: string }; return { ok: false, code: x.code ?? "", message: x.message ?? "" }; }
}
const full = (v: boolean, over: Record<string, unknown> = {}) => ({ ...Object.fromEntries(RIGHTS_FIELD_KEYS.map((k) => [k, v])), ...over });
const insertMap = (column: "display_fields" | "matching_fields", map: string) =>
  attempt(`insert into private.provider_rights_profiles (provider, version, effective_from, retention_seconds, source_ref, environment, ${column}) values ('example-sandbox', 1, '2026-10-01T00:00:00Z', 0, 'TESTFIXTURE', 'sandbox', $1::jsonb) returning *`, [map]);

// [beskrivelse, JSON, gyldig?]
const FORMS: Array<[string, unknown, boolean]> = [
  ["tomt objekt", {}, false], ["null-JSON", null, false], ["tom liste", [], false], ["liste med boolske", [true], false], ["streng", "x", false], ["tall", 5, false], ["boolsk", true, false],
  ["én nøkkel", { title: true }, false], ["12 av 13 nøkler", (() => { const m = full(false); delete (m as Record<string, unknown>).title; return m; })(), false],
  ["13 nøkler + ekstra", full(false, { vin: true }), false], ["ikke-boolsk verdi", full(false, { price: "ja" }), false], ["null-verdi", full(false, { price: null }), false],
  ["tall som verdi", full(false, { price: 1 }), false], ["objekt som verdi", full(false, { price: { v: true } }), false],
  ["alle false", full(false), true], ["alle true", full(true), true], ["blandet", full(false, { title: true, price: true, images: false }), true],
];

describe("DATA-002D: validatoren er total", () => {
  it.each(FORMS)("rights_field_map_valid(%s) er nøyaktig true/false", async (_n, json, want) => {
    const v = (await db.query("select private.rights_field_map_valid($1::jsonb) v", [JSON.stringify(json)])).rows[0]!.v;
    expect(v).toBe(want);
  });
  it("SQL NULL som argument gir false (ikke NULL)", async () => {
    expect((await db.query("select private.rights_field_map_valid(null) v")).rows[0]!.v).toBe(false);
  });
  it("funksjonen er fortsatt immutable, med tom search_path, og ikke kjørbar av ordinære roller", async () => {
    const r = (await db.query("select provolatile, proconfig, prosecdef from pg_proc where oid = 'private.rights_field_map_valid(jsonb)'::regprocedure")).rows[0]!;
    expect(r.provolatile).toBe("i");
    expect(r.proconfig).toEqual(["search_path=\"\""]);
    for (const role of ["anon", "authenticated", "service_role", "public"]) {
      expect((await db.query("select has_function_privilege($1, 'private.rights_field_map_valid(jsonb)', 'execute') x", [role])).rows[0]!.x, role).toBe(false);
    }
  });
});

describe("DATA-002D: display_fields og matching_fields avviser tomme og ugyldige kart", () => {
  for (const column of ["display_fields", "matching_fields"] as const) {
    it.each(FORMS.filter(([, , ok]) => !ok))(`${column}: ugyldig kart avvises med 23514 (%s)`, async (_n, json) => {
      await tx(async () => {
        const r = await insertMap(column, JSON.stringify(json));
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.code).toBe("23514");
        expect((await db.query("select count(*)::int n from private.provider_rights_profiles where provider = 'example-sandbox'")).rows[0]!.n).toBe(0);
      });
    });
    it.each(FORMS.filter(([, , ok]) => ok))(`${column}: gyldig kart godtas (%s)`, async (_n, json) => {
      await tx(async () => {
        const r = await insertMap(column, JSON.stringify(json));
        expect(r.ok).toBe(true);
        if (r.ok) expect(r.rows[0]![column]).toEqual(json);
      });
    });
    it(`${column}: UPDATE til tomt kart avvises (constraint; vakttriggeren avviser i tillegg enhver endring)`, async () => {
      await tx(async () => {
        const i = await insertMap(column, JSON.stringify(full(false)));
        if (!i.ok) throw new Error(i.message);
        const r = await attempt(`update private.provider_rights_profiles set ${column} = '{}'::jsonb where provider = 'example-sandbox'`);
        expect(r.ok).toBe(false);
      });
    });
  }
  it("constraintene krever IS TRUE (definisjonen i katalogen)", async () => {
    const defs = (await db.query("select conname, pg_get_constraintdef(oid) d from pg_constraint where conrelid = 'private.provider_rights_profiles'::regclass and conname in ('provider_rights_profiles_display_valid','provider_rights_profiles_matching_valid') order by conname")).rows;
    expect(defs).toHaveLength(2);
    for (const d of defs) expect(d.d as string).toMatch(/IS TRUE/);
  });
});

describe("DATA-002D: default-deny og uendrede rader", () => {
  it("nye profiler har fortsatt alle felt false i begge kart (default-deny) og er ikke i kraft", async () => {
    await tx(async () => {
      const r = await attempt("insert into private.provider_rights_profiles (provider, version, effective_from, retention_seconds, source_ref, environment) values ('example-sandbox', 1, '2026-10-01', 0, 'TESTFIXTURE', 'sandbox') returning *");
      if (!r.ok) throw new Error(r.message);
      expect(r.rows[0]!.display_fields).toEqual(noRights());
      expect(r.rows[0]!.matching_fields).toEqual(noRights());
      expect((await db.query("select * from private.rights_profile_in_force('example-sandbox', now())")).rows).toHaveLength(0);
    });
  });
  it("synthetic-demo v1 er uendret og speiler TS-profilen", async () => {
    const r = (await db.query("select display_fields, matching_fields from private.provider_rights_profiles where provider = 'synthetic-demo' and version = 1")).rows[0]!;
    expect(r.display_fields).toEqual(SYNTHETIC_RIGHTS_PROFILE.display);
    expect(r.matching_fields).toEqual(SYNTHETIC_RIGHTS_PROFILE.matching);
  });
});

describe("DATA-002D: samsvar med TypeScript (`validateProfile`)", () => {
  it("for hvert kart og begge feltkart: databasen lagrer nøyaktig når TypeScript regner kartet som gyldig", async () => {
    for (const [name, json] of FORMS.map(([n, j]) => [n, j] as const)) {
      for (const column of ["display_fields", "matching_fields"] as const) {
        const key = column === "display_fields" ? "display" : "matching";
        const tsIssue = validateProfile({ ...profile(), [key]: json } as unknown as ProviderRightsProfile).includes(key);
        await tx(async () => {
          const r = await insertMap(column, JSON.stringify(json));
          expect(r.ok, `${name} i ${column}`).toBe(!tsIssue);
        });
      }
    }
  });
});

// ------------------------------------------------------------------ oppgradering (bare isolert klynge)
describe.skipIf(!process.env.SCOUT_DB_ISOLATED)("DATA-002D: oppgradering fra eldre tilstand", () => {
  async function scratch<T>(fn: (c: Client, apply: () => Promise<void>) => Promise<T>): Promise<T> {
    const { readFileSync, readdirSync } = await import("node:fs");
    const { Client: Pg } = await import("pg");
    const name = `data002d_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    await db.query(`create database ${name}`);
    const u = new URL(process.env.SUPABASE_TEST_DB_URL!); u.pathname = `/${name}`;
    const c = new Pg({ connectionString: u.toString() });
    await c.connect();
    try {
      await c.query(readFileSync("tests/db/support/supabase-shim.sql", "utf8").replace(/^create role .*$/gm, ""));
      const dir = process.env.MIGRATIONS_DIR ?? "supabase/migrations";
      const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
      const mine = files.find((f) => f.includes("data002d"));
      for (const f of files) if (f !== mine && !f.includes("search005") && !f.includes("econ005c")) await c.query(readFileSync(`${dir}/${f}`, "utf8"));
      await c.query(readFileSync("supabase/seed.sql", "utf8"));
      return await fn(c, async () => { if (!mine) throw new Error("migrasjon DATA-002D finnes ikke i MIGRATIONS_DIR"); await c.query(readFileSync(`${dir}/${mine}`, "utf8")); });
    } finally { await c.end(); await db.query(`drop database ${name}`); }
  }
  const legacyRow = (provider: string, display: unknown, matching: unknown) => ({
    sql: `insert into private.provider_rights_profiles (provider, version, status, effective_from, retention_seconds, source_ref, verified_by, verified_at, environment, provider_name, attribution_text, display_fields, matching_fields)
          values ($1, 1, 'verified', '2026-10-01', 3600, 'LEGACY', 'test', '2026-10-02', 'live', 'Legacy', 'Kilde', $2::jsonb, $3::jsonb)`,
    params: [provider, JSON.stringify(display), JSON.stringify(matching)],
  });
  const snapshot = "select md5(string_agg(row(p.*)::text, '|' order by p.provider, p.version)) m from private.provider_rights_profiles p";

  it("gyldige eksisterende rader: migrasjonen går gjennom, radene er byte-for-byte uendret, og `{}` avvises etterpå", async () => {
    await scratch(async (c, apply) => {
      const a = legacyRow("legacy-valid", full(true), full(false, { title: true }));
      await c.query(a.sql, a.params);
      const before = (await c.query(snapshot)).rows[0]!.m;
      await apply();
      expect((await c.query(snapshot)).rows[0]!.m).toBe(before);
      const bad = legacyRow("legacy-new", {}, full(false));
      await expect(c.query(bad.sql, bad.params)).rejects.toMatchObject({ code: "23514" });
    });
  });

  it.each([["display_fields", {}, full(false)], ["matching_fields", full(false), {}], ["begge", {}, {}]] as const)(
    "ugyldig eksisterende rad (%s): migrasjonen STOPPER med presis forklaring, ingenting endres (ingen antatte rettigheter, ingen omgåelse av immutabilitet)",
    async (_n, display, matching) => {
      await scratch(async (c, apply) => {
        // eneste måte en ugyldig rad kan finnes på er NULL-hullet (tomt kart); øvrige ugyldige former avviste den gamle CHECK-en allerede
        const a = legacyRow("legacy-bad", display, matching);
        await c.query(a.sql, a.params);
        const before = (await c.query(snapshot)).rows[0]!.m;
        await expect(apply()).rejects.toThrow(/data002d_invalid_existing_rows.*legacy-bad@v1/s);
        expect((await c.query(snapshot)).rows[0]!.m).toBe(before); // ingen rad endret
        // funksjon og constraints er uendret (migrasjonen kjører i én transaksjon som ble rullet tilbake): `{}` gir fortsatt NULL
        expect((await c.query("select private.rights_field_map_valid('{}'::jsonb) v")).rows[0]!.v).toBeNull();
      });
    });
  it("kartlegging: meldingen nevner bare ugyldige rader (provider@versjon) og skiller display/matching", async () => {
    await scratch(async (c, apply) => {
      const good = legacyRow("legacy-good", full(true), full(true)); await c.query(good.sql, good.params);
      const bad = legacyRow("legacy-bad", {}, full(false)); await c.query(bad.sql, bad.params);
      let msg = "";
      await apply().catch((e: Error) => { msg = e.message; });
      expect(msg).toContain("legacy-bad@v1 (display_fields UGYLDIG, matching_fields ok)");
      expect(msg).not.toContain("legacy-good");
      expect(msg).not.toContain("synthetic-demo");
    });
  });
});

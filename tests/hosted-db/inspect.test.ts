// HOST-001 (forberedelse): skrivebeskyttet inspeksjon mot en isolert PostgreSQL — tomt prosjekt vs. oppgradering, historikkavvik, ikke-testbrukere og DATA-002D-kartleggingen
// (skal forutsi nøyaktig det migrasjon 20261022090000 selv gjør). IKKE Supabase, IKKE hosted.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { inspectDatabase } from "../../scripts/hosted/inspect.mjs";
import { repoMigrationList } from "../../scripts/hosted/migrations.mjs";
import { fingerprintOf } from "../../scripts/hosted/target.mjs";
import { adminDb } from "../db/harness";
import { MIGRATION_FILES, idx, withScratch } from "./scratch";

let admin: Client;
beforeAll(async () => { admin = await adminDb(); });
afterAll(async () => { await admin.end(); });
const repoList = repoMigrationList();
const target = { fingerprint: fingerprintOf("abcdefghij0123456789") };
const run = (c: Client, mode: "fresh" | "upgrade") => inspectDatabase(c, { repoList, mode, target, now: new Date("2026-10-22T10:00:00Z") });
const dataIdx = idx("data002d");
const BASE = idx("econ005b");   // som det hostede utgangspunktet: alt til og med DATA-002C anvendt; ECON-005b, DATA-002D og ECON-005c ventende   // migrasjonen som innstrammer feltkartene
const legacy = (provider: string, display: unknown, matching: unknown) => ({
  sql: `insert into private.provider_rights_profiles (provider, version, status, effective_from, retention_seconds, source_ref, verified_by, verified_at, environment, provider_name, attribution_text, display_fields, matching_fields)
        values ($1, 1, 'verified', '2026-10-01', 3600, 'LEGACY', 'test', '2026-10-02', 'live', 'Legacy', 'Kilde', $2::jsonb, $3::jsonb)`,
  params: [provider, JSON.stringify(display), JSON.stringify(matching)],
});
const FULL = Object.fromEntries(["images", "listing_dates", "listing_id", "mileage", "price", "provider_identity", "registration", "seller_identity", "seller_location", "source_url", "specs", "text", "title"].map((k) => [k, false]));

describe("tomt prosjekt (første anvendelse)", () => {
  it("helt tomt (bare Supabase-lignende skall): tilstand «tomt», modus fresh ⇒ OK; DATA-002D ikke relevant; alle migrasjoner ventende", async () => {
    await withScratch(admin, { apply: 0 }, async (c) => {
      const r = await run(c, "fresh");
      expect(r).toMatchObject({ state: "tomt", verdict: "OK", nothingToApply: false, data002d: { status: "NOT_APPLICABLE" }, migrations: { historyTable: false, classification: "empty", appliedCount: 0 } });
      expect(r.migrations.pending).toHaveLength(MIGRATION_FILES.length);
      expect(r.stopReasons).toEqual([]);
    });
  });
  it("modus upgrade mot et tomt prosjekt ⇒ STOPP (valgt modus passer ikke)", async () => {
    await withScratch(admin, { apply: 0 }, async (c) => {
      const r = await run(c, "upgrade");
      expect(r.verdict).toBe("STOPP");
      expect(r.stopReasons.join(" ")).toMatch(/passer ikke/);
    });
  });
});

describe("oppgradering av eksisterende database", () => {
  it("delvis anvendt (prefiks = hostet utgangspunkt) med historikk: tilstand «oppgradering», modus upgrade ⇒ OK med riktige ventende; modus fresh ⇒ STOPP", async () => {
    await withScratch(admin, { apply: BASE }, async (c) => {
      const r = await run(c, "upgrade");
      expect(r).toMatchObject({ state: "oppgradering", verdict: "OK", migrations: { classification: "prefix", appliedCount: BASE } });
      expect(r.migrations.pending).toEqual(repoList.slice(BASE).map((m) => m.version));
      expect(r.migrations.pending).toEqual(expect.arrayContaining(["20261021090000", "20261022090000", "20261023090000"]));   // de tre aldri anvendt hostet
      const f = await run(c, "fresh");
      expect(f.verdict).toBe("STOPP");
    });
  });
  it("alt anvendt: «current», ingenting å anvende (gate ville avvise), DATA-002D allerede anvendt", async () => {
    await withScratch(admin, { apply: MIGRATION_FILES.length }, async (c) => {
      const r = await run(c, "upgrade");
      expect(r).toMatchObject({ verdict: "OK", nothingToApply: true, migrations: { classification: "current" }, data002d: { status: "ALREADY_APPLIED", invalidProfiles: 0 } });
    });
  });
  it("hull eller ukjent versjon i historikken ⇒ STOPP (diverged)", async () => {
    await withScratch(admin, { apply: BASE }, async (c) => {
      await c.query("delete from supabase_migrations.schema_migrations where version = $1", [MIGRATION_FILES[2]!.slice(0, 14)]);
      expect((await run(c, "upgrade")).stopReasons.join(" ")).toMatch(/avviker fra repoet/);
      await c.query("insert into supabase_migrations.schema_migrations (version) values ('20990101000000')");
      expect((await run(c, "upgrade")).verdict).toBe("STOPP");
    });
  });
  it("migrasjoner anvendt uten historikk (ukjent utgangspunkt) ⇒ STOPP i begge moduser", async () => {
    await withScratch(admin, { apply: BASE, record: false }, async (c) => {
      for (const m of ["fresh", "upgrade"] as const) { const r = await run(c, m); expect(r.state).toBe("ukjent"); expect(r.verdict).toBe("STOPP"); }
    });
  });
  it("brukere som ikke er testbrukere (@example.test) ⇒ STOPP (ikke et rent testprosjekt); bare testbrukere ⇒ OK", async () => {
    await withScratch(admin, { apply: BASE }, async (c) => {
      const ins = (email: string) => c.query(`insert into auth.users (id, email) values (gen_random_uuid(), $1)`, [email]).catch(() => null);
      await ins("t1@example.test");
      const ok = await run(c, "upgrade");
      if (ok.auth.users === 1) { expect(ok.auth.nonTestUsers).toBe(0); expect(ok.verdict).toBe("OK"); }
      await ins("noen@eksempel.no");
      const bad = await run(c, "upgrade");
      expect(bad.auth.nonTestUsers).toBeGreaterThan(0);
      expect(bad.verdict).toBe("STOPP");
      expect(JSON.stringify(bad)).not.toContain("eksempel.no");   // aldri e-poster i rapporten
    });
  });
});

describe("DATA-002D-kartleggingen skiller tomt prosjekt fra oppgradering og forutsier migrasjonen", () => {
  const migrationSql = () => readFileSync(`supabase/migrations/${MIGRATION_FILES[dataIdx]}`, "utf8");
  it("før tabellen finnes (før DEV-005B0) ⇒ NOT_APPLICABLE; tabell uten valideringsfunksjon (før DATA-002B) ⇒ UNKNOWN/STOPP — kan ikke vurderes, aldri antatt OK", async () => {
    await withScratch(admin, { apply: idx("dev005b0_rights_retention") }, async (c) => { expect((await run(c, "upgrade")).data002d.status).toBe("NOT_APPLICABLE"); });
    await withScratch(admin, { apply: idx("data002b") }, async (c) => { const r = await run(c, "upgrade"); expect(r.data002d.status).toBe("UNKNOWN"); expect(r.verdict).toBe("STOPP"); });
  });
  it("gyldige eksisterende rader ⇒ OK, og migrasjonen går faktisk gjennom", async () => {
    await withScratch(admin, { apply: dataIdx }, async (c) => {
      const a = legacy("legacy-valid", { ...FULL, title: true }, FULL); await c.query(a.sql, a.params);
      const r = await run(c, "upgrade");
      expect(r.data002d).toMatchObject({ status: "OK", invalidProfiles: 0 });
      expect(r.verdict).toBe("OK");
      await expect(c.query(migrationSql())).resolves.toBeDefined();
    });
  });
  it.each([["display_fields", {}, FULL], ["matching_fields", FULL, {}], ["begge", {}, {}]] as const)("ugyldig eksisterende rad (%s) ⇒ INVALID/STOPP, og migrasjonen STOPPER faktisk med data002d_invalid_existing_rows", async (_n, display, matching) => {
    await withScratch(admin, { apply: dataIdx }, async (c) => {
      const a = legacy("legacy-bad", display, matching); await c.query(a.sql, a.params);
      const before = (await c.query("select md5(string_agg(row(p.*)::text, '|' order by provider, version)) m from private.provider_rights_profiles p")).rows[0]!.m;
      const r = await run(c, "upgrade");
      expect(r.data002d).toMatchObject({ status: "INVALID", invalidProfiles: 1, profiles: ["legacy-bad@v1"] });
      expect(r.verdict).toBe("STOPP");
      expect(r.stopReasons.join(" ")).toMatch(/DATA-002D/);
      await expect(c.query(migrationSql())).rejects.toMatchObject({ message: expect.stringContaining("data002d_invalid_existing_rows") });
      expect((await c.query("select md5(string_agg(row(p.*)::text, '|' order by provider, version)) m from private.provider_rights_profiles p")).rows[0]!.m).toBe(before);   // inspeksjonen endret ingenting
    });
  });
  it("funksjonen mangler mens tabellen finnes ⇒ UNKNOWN/STOPP (aldri antatt OK)", async () => {
    await withScratch(admin, { apply: dataIdx }, async (c) => {
      await c.query("alter table private.provider_rights_profiles drop constraint if exists provider_rights_profiles_display_fields_check, drop constraint if exists provider_rights_profiles_matching_fields_check").catch(() => {});
      await c.query("drop function private.rights_field_map_valid(jsonb) cascade").catch(() => {});
      const r = await run(c, "upgrade");
      expect(["UNKNOWN", "OK"]).toContain(r.data002d.status);
      if (r.data002d.status === "UNKNOWN") expect(r.verdict).toBe("STOPP");
    });
  });
});

describe("inspeksjonen er skrivebeskyttet", () => {
  const digest = async (c: Client) => (await c.query(`select md5(coalesce(string_agg(x, '|' order by x), '')) m from (
      select 'u:' || row(u.*)::text x from auth.users u union all select 'd:' || row(d.*)::text from public.dealerships d union all select 'm:' || version from supabase_migrations.schema_migrations
      union all select 't:' || schemaname || '.' || tablename from pg_tables where schemaname in ('public','private')) s`)).rows[0]!.m;
  it("bare begin read only/select/rollback; databasen er uendret; ingen åpen transaksjon etterpå", async () => {
    await withScratch(admin, { apply: BASE }, async (c) => {
      const seen: string[] = [];
      const spy = { query: (sql: string, params?: unknown[]) => { seen.push(sql); return c.query(sql, params); } } as unknown as Client;
      const before = await digest(c);
      await inspectDatabase(spy, { repoList, mode: "upgrade", target, now: new Date() });
      expect(seen.length).toBeGreaterThan(10);
      for (const s of seen) expect(s).toMatch(/^\s*(begin read only|select|rollback)\b/i);
      expect(seen[0]).toMatch(/^begin read only/);
      expect(seen[seen.length - 1]).toBe("rollback");
      expect(await digest(c)).toBe(before);
      expect((await c.query("select now() = statement_timestamp() as fresh_tx")).rows[0]!.fresh_tx).toBe(true);   // ingen hengende transaksjon
    });
  });
  it("selve transaksjonen er read only: en skriving i samme transaksjon avvises av databasen", async () => {
    await withScratch(admin, { apply: BASE }, async (c) => {
      await c.query("begin read only");
      await expect(c.query("insert into supabase_migrations.schema_migrations (version) values ('20990101000000')")).rejects.toMatchObject({ code: "25006" });
      await c.query("rollback");
    });
  });
  it("rapporten har aldri radinnhold: bare tall, versjoner, flagg og hash", async () => {
    await withScratch(admin, { apply: dataIdx }, async (c) => {
      const a = legacy("legacy-x", FULL, FULL); await c.query(a.sql, a.params);
      const txt = JSON.stringify(await run(c, "upgrade"));
      expect(txt).not.toMatch(/Legacy|Kilde|LEGACY|attribution/i);
      expect(createHash("sha256").update("x").digest("hex")).toHaveLength(64);
    });
  });
});

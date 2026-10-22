/**
 * ECON-005b — rettigheter for avledet økonomi i `private.provider_rights_profiles` (migrasjon 20261021090000).
 * Direkte databasetilkobling som eier (tabellen ligger i `private`); kjøres mot lokal Supabase eller den isolerte klyngen
 * (`bash scripts/test-db-isolated.sh tests/db/econ005b-rights.test.ts`). Hver test kjører i en transaksjon som rulles tilbake.
 * Ingen Auth/PostgREST i den isolerte klyngen; tilgangsbevisene gjelder roller (`authenticated`, `anon`) via SET ROLE, ikke service-role.
 */
import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ECONOMICS_FIELD_KEYS, RIGHTS_FIELD_KEYS, SYNTHETIC_RIGHTS_PROFILE, canDeriveEconomics, canDisplayEconomics, noEconomicsRights, noRights, resolveRights, validateProfile,
  type EconomicsFieldKey, type ProviderRightsProfile,
} from "@/domain/provider-rights";
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
const fieldMap = (m: Readonly<Record<string, boolean>>) => JSON.stringify(m);
/** TS-profil → kolonner (speiler `DATA-002B`-testenes insert; alle felt uttrykkelig). */
function insertProfile(p: ProviderRightsProfile) {
  const cols: Record<string, unknown> = {
    provider: p.providerId, version: p.version, status: p.status, effective_from: p.validFrom, effective_to: p.validUntil, retention_seconds: p.storage.retentionSeconds,
    source_ref: p.sourceRef, verified_by: p.verifiedBy, verified_at: p.verifiedAt, environment: p.environment, provider_name: p.providerName,
    display_fields: fieldMap(p.display), matching_fields: fieldMap(p.matching), attribution_required: p.attribution.required, attribution_text: p.attribution.text,
    geography_unrestricted: p.geography.unrestricted, allow_derived_economics: fieldMap(p.derivedEconomics.allow), display_derived_economics: p.derivedEconomics.display,
  };
  const keys = Object.keys(cols);
  const casts: Record<string, string> = { display_fields: "::jsonb", matching_fields: "::jsonb", allow_derived_economics: "::jsonb" };
  return attempt(`insert into private.provider_rights_profiles (${keys.join(",")}) values (${keys.map((k, i) => `$${i + 1}${casts[k] ?? ""}`).join(",")}) returning *`, keys.map((k) => cols[k]));
}
const insertRaw = (cols: Record<string, unknown>) => {
  const base: Record<string, unknown> = { provider: "example-sandbox", version: 1, effective_from: "2026-10-01T00:00:00Z", retention_seconds: 0, source_ref: "TESTFIXTURE", environment: "sandbox" };
  const all = { ...base, ...cols };
  const keys = Object.keys(all);
  const casts: Record<string, string> = { allow_derived_economics: "::jsonb", display_fields: "::jsonb" };
  return attempt(`insert into private.provider_rights_profiles (${keys.join(",")}) values (${keys.map((k, i) => `$${i + 1}${casts[k] ?? ""}`).join(",")}) returning *`, keys.map((k) => all[k]));
};
const econ = (m: Partial<Record<EconomicsFieldKey, boolean>>) => JSON.stringify({ ...noEconomicsRights(), ...m });
const verified = { status: "verified", verified_by: "test", verified_at: "2026-10-02T00:00:00Z", attribution_text: "Kilde", provider_name: "Eksempel" };

describe("ECON-005b: migrasjon, default og backfill", () => {
  it("synthetic-demo v1 har uttrykkelig true og speiler TS-profilen; ingen annen profil har fått noe", async () => {
    const rows = (await db.query("select provider, version, environment, allow_derived_economics, display_derived_economics from private.provider_rights_profiles order by provider, version")).rows;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ provider: "synthetic-demo", version: 1, environment: "synthetic", display_derived_economics: SYNTHETIC_RIGHTS_PROFILE.derivedEconomics.display });
    expect(rows[0]!.allow_derived_economics).toEqual(SYNTHETIC_RIGHTS_PROFILE.derivedEconomics.allow);
  });
  it("nye profiler er default nei (alle felt false, visning false) uten at kolonnene oppgis", async () => {
    await tx(async () => {
      const r = await insertRaw({});
      if (!r.ok) throw new Error(r.message);
      expect(r.rows[0]!.allow_derived_economics).toEqual({ price: false, registration: false, specs: false });
      expect(r.rows[0]!.display_derived_economics).toBe(false);
    });
  });
  it("kolonnene er NOT NULL", async () => {
    await tx(async () => {
      for (const c of ["allow_derived_economics", "display_derived_economics"]) {
        const r = await insertRaw({ [c]: null });
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.code).toBe("23502");
      }
    });
  });
  it.each([
    ["mangler nøkkel", JSON.stringify({ price: true, registration: true })],
    ["ekstra nøkkel", JSON.stringify({ price: true, registration: true, specs: true, mileage: true })],
    ["ikke-boolsk verdi", JSON.stringify({ price: "ja", registration: false, specs: false })],
    ["ikke et objekt", JSON.stringify([true, true, true])],
    ["null-verdi", JSON.stringify({ price: null, registration: false, specs: false })],
  ])("ugyldig feltkart avvises: %s", async (_n, map) => {
    await tx(async () => {
      const r = await insertRaw({ allow_derived_economics: map });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe("23514");
    });
  });
  it("validatoren er total: returnerer nøyaktig true/false (aldri NULL) for tomt, ugyldig og gyldig kart", async () => {
    const cases: Array<[string, boolean]> = [
      ["{}", false], ["null", false], ["[]", false], ["[true,true,true]", false], ['"x"', false], ["5", false], ["true", false],
      ['{"price":true}', false], ['{"price":true,"registration":true}', false], ['{"price":true,"registration":true,"specs":true,"mileage":true}', false],
      ['{"price":"ja","registration":false,"specs":false}', false], ['{"price":null,"registration":false,"specs":false}', false], ['{"price":1,"registration":0,"specs":0}', false],
      ['{"price":false,"registration":false,"specs":false}', true], ['{"price":true,"registration":false,"specs":true}', true], ['{"price":true,"registration":true,"specs":true}', true],
    ];
    for (const [j, want] of cases) expect((await db.query("select private.economics_rights_map_valid($1::jsonb) v", [j])).rows[0]!.v, j).toBe(want);
    expect((await db.query("select private.economics_rights_map_valid(null) v")).rows[0]!.v).toBe(false);
  });
  it.each([false, true])("tomt kart `{}` avvises av databasen med visning=%s (23514), og kolonnen forblir uten tomt kart", async (display) => {
    await tx(async () => {
      const r = await insertRaw({ allow_derived_economics: "{}", display_derived_economics: display });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe("23514");
      // også med uttrykkelig verifisert profil og ellers gyldige felt
      const v = await insertRaw({ ...verified, allow_derived_economics: "{}", display_derived_economics: display });
      expect(v.ok).toBe(false);
      if (!v.ok) expect(v.code).toBe("23514");
      expect((await db.query("select count(*)::int n from private.provider_rights_profiles where allow_derived_economics = '{}'::jsonb")).rows[0]!.n).toBe(0);
    });
  });
  it("UPDATE til tomt kart avvises også (constraint, ikke bare insert)", async () => {
    await tx(async () => {
      const i = await insertRaw({});
      if (!i.ok) throw new Error(i.message);
      const r = await attempt("update private.provider_rights_profiles set allow_derived_economics = '{}'::jsonb where provider = 'example-sandbox'");
      expect(r.ok).toBe(false);
    });
  });
  it("visning uten noe tillatt felt avvises; med ett tillatt felt godtas", async () => {
    await tx(async () => {
      const bad = await insertRaw({ display_derived_economics: true });
      expect(bad.ok).toBe(false);
      if (!bad.ok) expect(bad.code).toBe("23514");
      expect((await insertRaw({ display_derived_economics: true, allow_derived_economics: econ({ specs: true }) })).ok).toBe(true);
    });
  });
});

describe("ECON-005b: uforanderlighet (eksisterende vakt er bevart og utvidet)", () => {
  it.each([
    ["allow_derived_economics (utvid)", `allow_derived_economics = '${econ({ price: true, registration: true, specs: true })}'::jsonb`],
    ["allow_derived_economics (innskrenk)", `allow_derived_economics = '${econ({ price: true })}'::jsonb`],
    ["display_derived_economics (slå av)", "display_derived_economics = false"],
  ])("endring av %s på en verifisert profil avvises", async (_c, set) => {
    await tx(async () => {
      const i = await insertRaw({ ...verified, allow_derived_economics: econ({ price: true, registration: true }), display_derived_economics: true });
      if (!i.ok) throw new Error(i.message);
      const r = await attempt(`update private.provider_rights_profiles set ${set} where provider = 'example-sandbox'`);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.message).toMatch(/rights_profile_immutable/);
    });
  });
  it("også et utkast kan ikke få utvidet avledet-økonomi-rett på plass; og utvidelse via trukket/forkortet er ikke mulig", async () => {
    await tx(async () => {
      const i = await insertRaw({});
      if (!i.ok) throw new Error(i.message);
      const r = await attempt(`update private.provider_rights_profiles set allow_derived_economics = '${econ({ price: true })}'::jsonb where provider = 'example-sandbox'`);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.message).toMatch(/rights_profile_immutable/);
    });
  });
  it("synthetic-demo v1 kan ikke få endret rettigheten etter migrasjonen", async () => {
    await tx(async () => {
      for (const set of ["display_derived_economics = false", `allow_derived_economics = '${econ({})}'::jsonb`]) {
        const r = await attempt(`update private.provider_rights_profiles set ${set} where provider = 'synthetic-demo'`);
        expect(r.ok).toBe(false);
      }
    });
  });
  it("tilbakekalling og forkortet virkningsperiode virker fortsatt og lukker avledet økonomi umiddelbart", async () => {
    await tx(async () => {
      const i = await insertRaw({ ...verified, allow_derived_economics: econ({ price: true }), display_derived_economics: true });
      if (!i.ok) throw new Error(i.message);
      const at = (t: string) => `select private.can_derive_economics('example-sandbox', ${t}, array['price']) d, private.can_display_economics('example-sandbox', ${t}, array['price'], array[]::text[]) v`;
      expect((await db.query(at("now()"))).rows[0]).toEqual({ d: true, v: true });
      expect((await attempt("update private.provider_rights_profiles set effective_to = now() + interval '1 day' where provider = 'example-sandbox'")).ok).toBe(true);
      expect((await db.query(at("now() + interval '2 days'"))).rows[0]).toEqual({ d: false, v: false }); // utløpt
      expect((await attempt("update private.provider_rights_profiles set status = 'revoked' where provider = 'example-sandbox'")).ok).toBe(true);
      expect((await db.query(at("now()"))).rows[0]).toEqual({ d: false, v: false }); // trukket
    });
  });
});

describe("ECON-005b: SQL-funksjonene er fail-closed", () => {
  const derive = async (provider: string, fields: string[] | null, at = "now()") => (await db.query(`select private.can_derive_economics($1, ${at}, $2::text[]) r`, [provider, fields])).rows[0]!.r;
  const display = async (provider: string, fields: string[] | null, reveals: string[] | null, at = "now()") => (await db.query(`select private.can_display_economics($1, ${at}, $2::text[], $3::text[]) r`, [provider, fields, reveals])).rows[0]!.r;
  it("syntetisk demo: tillatt; ukjent leverandør, tom/null/ukjent felt: nei", async () => {
    expect(await derive("synthetic-demo", ["price", "registration", "specs"])).toBe(true);
    expect(await display("synthetic-demo", ["price"], ["price"])).toBe(true);
    expect(await derive("ukjent", ["price"])).toBe(false);
    expect(await display("ukjent", ["price"], [])).toBe(false);
    for (const f of [[], null, ["title"], ["price", "mileage"], [""], ["PRICE"], ["price", null as unknown as string]]) expect(await derive("synthetic-demo", f as string[] | null)).toBe(false);
    expect(await display("synthetic-demo", ["price"], null)).toBe(false);
    expect(await display("synthetic-demo", ["price"], ["vin"])).toBe(false);
    expect(await display("synthetic-demo", [], [])).toBe(false);
  });
  it("før begynnelsen av profilens periode gjelder ingenting (tidspunkt styrer)", async () => {
    expect(await derive("synthetic-demo", ["price"], "'2026-09-30T00:00:00Z'::timestamptz")).toBe(false);
    expect(await derive("synthetic-demo", ["price"], "'2026-10-01T00:00:00Z'::timestamptz")).toBe(true);
  });
  it("funksjonene er ikke kjørbare av ordinære roller (anon/authenticated/service_role) — ingen klienttilgang", async () => {
    for (const fn of ["private.can_derive_economics(text,timestamptz,text[])", "private.can_display_economics(text,timestamptz,text[],text[])", "private.economics_rights_map_valid(jsonb)"]) {
      for (const role of ["anon", "authenticated", "service_role"]) {
        expect((await db.query("select has_function_privilege($1, $2, 'execute') x", [role, fn])).rows[0]!.x).toBe(false);
      }
    }
  });
  it("ordinær innlogget rolle kan ikke kalle funksjonene eller lese profiltabellen (SET ROLE authenticated/anon)", async () => {
    for (const role of ["authenticated", "anon"]) {
      await db.query("begin");
      try {
        await db.query(`set local role ${role}`);
        const f = await attempt("select private.can_derive_economics('synthetic-demo', now(), array['price'])");
        const t = await attempt("select * from private.provider_rights_profiles");
        const w = await attempt("update private.provider_rights_profiles set display_derived_economics = true");
        expect(f.ok, `${role}: funksjon`).toBe(false);
        expect(t.ok, `${role}: tabell`).toBe(false);
        expect(w.ok, `${role}: skriving`).toBe(false);
        for (const r of [f, t, w]) if (!r.ok) expect(r.code).toBe("42501");
      } finally { await db.query("rollback"); }
    }
  });
});

// ------------------------------------------------------------------ differensialtest TypeScript ↔ SQL
describe("ECON-005b: samsvar TypeScript ↔ SQL (differensialtest)", () => {
  const A = (m: Partial<Record<EconomicsFieldKey, boolean>>) => ({ ...noEconomicsRights(), ...m });
  const shownPrice = { price: true } as const;
  type Cfg = [string, ProviderRightsProfile];
  const base = (over: NonNullable<Parameters<typeof profile>[0]>): ProviderRightsProfile => profile({ providerId: "diff-kilde", environment: "sandbox", providerName: "Diff", ...over });
  const configs: Cfg[] = [
    ["ingen rett", base({})],
    ["alle felt, ingen visning", base({ derivedEconomics: { allow: A({ price: true, registration: true, specs: true }), display: false } })],
    ["alle felt + visning, pris vises", base({ derivedEconomics: { allow: A({ price: true, registration: true, specs: true }), display: true } })],
    ["alle felt + visning, pris vises IKKE", base({ display: { price: false }, derivedEconomics: { allow: A({ price: true, registration: true, specs: true }), display: true } })],
    ["bare price + visning", base({ derivedEconomics: { allow: A(shownPrice), display: true } })],
    ["bare specs + visning, ingen visning av title/images", base({ display: { title: false }, derivedEconomics: { allow: A({ specs: true }), display: true } })],
    ["registration alene uten visning", base({ derivedEconomics: { allow: A({ registration: true }), display: false } })],
    ["utløper 2026-10-25", base({ validUntil: "2026-10-25T00:00:00Z", derivedEconomics: { allow: A({ price: true, registration: true, specs: true }), display: true } })],
    ["begynner 2026-10-22", base({ validFrom: "2026-10-22T00:00:00Z", derivedEconomics: { allow: A({ price: true }), display: true } })],
    ["utkast", base({ status: "draft", verifiedBy: null, verifiedAt: null, derivedEconomics: { allow: A({ price: true, registration: true, specs: true }), display: true } })],
  ];
  const subsets = <T,>(xs: readonly T[]) => Array.from({ length: 1 << xs.length }, (_, m) => xs.filter((_x, i) => m & (1 << i)));
  const fieldSets: string[][] = [...subsets(ECONOMICS_FIELD_KEYS).map((s) => [...s]), ["title"], ["price", "mileage"], []];
  const revealSets: string[][] = [[], ["price"], ["title"], ["images"], ["price", "title"], ["vin"], ["price", "registration", "specs"]];
  const times = ["2026-10-20T12:00:00Z", "2026-10-21T00:00:00Z", "2026-10-22T00:00:00Z", "2026-10-25T00:00:00Z", "2026-09-01T00:00:00Z"];

  it("alle konfigurasjoner: TS-profilene er gyldige og SQL gir samme beslutning som TS for alle felt-, avsløring- og tidspunktkombinasjoner", async () => {
    let compared = 0;
    for (const [name, p] of configs) {
      expect(validateProfile(p), name).toEqual([]);
      await tx(async () => {
        const ins = await insertProfile(p);
        expect(ins.ok, `${name}: ${ins.ok ? "" : ins.message}`).toBe(true);
        for (const t of times) {
          const r = resolveRights(p.providerId, [p], new Date(t));
          for (const f of fieldSets) {
            const sqlD = (await db.query("select private.can_derive_economics($1, $2::timestamptz, $3::text[]) r", [p.providerId, t, f])).rows[0]!.r;
            expect(sqlD, `${name} @${t} derive ${JSON.stringify(f)}`).toBe(canDeriveEconomics(r, f));
            for (const rv of revealSets) {
              const sqlV = (await db.query("select private.can_display_economics($1, $2::timestamptz, $3::text[], $4::text[]) r", [p.providerId, t, f, rv])).rows[0]!.r;
              expect(sqlV, `${name} @${t} display ${JSON.stringify(f)} reveals ${JSON.stringify(rv)}`).toBe(canDisplayEconomics(r, f, rv));
              compared++;
            }
          }
        }
      });
    }
    expect(compared).toBeGreaterThan(1500);
  });
  it("tilbakekalt profil: SQL og TS avslår begge (etter at en verifisert profil trekkes)", async () => {
    const p = base({ derivedEconomics: { allow: A({ price: true }), display: true } });
    await tx(async () => {
      expect((await insertProfile(p)).ok).toBe(true);
      expect((await attempt("update private.provider_rights_profiles set status = 'revoked' where provider = 'diff-kilde'")).ok).toBe(true);
      const t = new Date("2026-10-20T12:00:00Z");
      const r = resolveRights(p.providerId, [{ ...p, status: "revoked" }], t);
      expect(canDeriveEconomics(r, ["price"])).toBe(false);
      expect((await db.query("select private.can_derive_economics('diff-kilde', $1::timestamptz, array['price']) r", [t.toISOString()])).rows[0]!.r).toBe(false);
    });
  });
  it("høyeste versjon i kraft: ny verifisert versjon uten rett overstyrer (og samsvarer med TS)", async () => {
    const v1 = base({ validUntil: "2026-10-21T00:00:00Z", derivedEconomics: { allow: A({ price: true }), display: true } });
    const v2 = base({ version: 2, validFrom: "2026-10-21T00:00:00Z", derivedEconomics: { allow: A({}), display: false } });
    await tx(async () => {
      expect((await insertProfile(v1)).ok).toBe(true);
      expect((await insertProfile(v2)).ok).toBe(true);
      for (const t of ["2026-10-20T12:00:00Z", "2026-10-21T00:00:00Z", "2026-10-22T00:00:00Z"]) {
        const r = resolveRights("diff-kilde", [v1, v2], new Date(t));
        expect((await db.query("select private.can_derive_economics('diff-kilde', $1::timestamptz, array['price']) r", [t])).rows[0]!.r, t).toBe(canDeriveEconomics(r, ["price"]));
      }
    });
  });
  it("gyldighet av kartet: SQL-validatoren og TypeScript (`validateProfile`) er enige for tomt og ugyldig kart, med visning false og true", async () => {
    const maps: unknown[] = [
      {}, { price: true }, { price: true, registration: true }, { price: true, registration: true, specs: true, mileage: true }, { price: "ja", registration: false, specs: false },
      { price: null, registration: false, specs: false }, [], null, "x", 5,
      { price: false, registration: false, specs: false }, { price: true, registration: false, specs: false }, { price: true, registration: true, specs: true },
    ];
    for (const m of maps) {
      const sqlValid = (await db.query("select private.economics_rights_map_valid($1::jsonb) v", [JSON.stringify(m)])).rows[0]!.v as boolean;
      for (const display of [false, true]) {
        const tsInvalid = validateProfile({ ...profile(), derivedEconomics: { allow: m, display } } as unknown as ProviderRightsProfile).includes("derivedEconomics");
        // TS krever i tillegg koherens (visning ⇒ minst ett tillatt felt) – samme som tabellens egen constraint; kartgyldighet alene er sant for begge når SQL sier ugyldig
        if (!sqlValid) expect(tsInvalid, `${JSON.stringify(m)} display=${display}`).toBe(true);
        const coherent = !display || (sqlValid && Object.values(m as Record<string, boolean>).some((v) => v === true));
        expect(tsInvalid, `${JSON.stringify(m)} display=${display}`).toBe(!(sqlValid && coherent));
        // og databasen: lagring lykkes nøyaktig når TS regner profilen som gyldig på dette punktet
        await tx(async () => {
          const r = await insertRaw({ allow_derived_economics: JSON.stringify(m), display_derived_economics: display });
          expect(r.ok, `${JSON.stringify(m)} display=${display}`).toBe(!tsInvalid);
        });
      }
    }
  });
  it("TS og SQL bruker samme feltnøkler og samme standard (kilde til sannhet: konstantene)", async () => {
    expect([...ECONOMICS_FIELD_KEYS]).toEqual(["price", "registration", "specs"]);
    expect(RIGHTS_FIELD_KEYS).toEqual(expect.arrayContaining([...ECONOMICS_FIELD_KEYS]));
    expect(noRights()).not.toHaveProperty("derivedEconomics");
    const def = (await db.query("select column_default d from information_schema.columns where table_schema='private' and table_name='provider_rights_profiles' and column_name='allow_derived_economics'")).rows[0]!.d as string;
    expect(JSON.parse(def.replace(/^'|'::jsonb$/g, ""))).toEqual(noEconomicsRights());
    const dd = (await db.query("select column_default d from information_schema.columns where table_schema='private' and table_name='provider_rights_profiles' and column_name='display_derived_economics'")).rows[0]!.d;
    expect(dd).toBe("false");
  });
});

// ------------------------------------------------------------------ oppgradering med eksisterende profiler (bare i den isolerte klyngen)
describe.skipIf(!process.env.SCOUT_DB_ISOLATED)("ECON-005b: oppgradering — eksisterende ikke-syntetiske profiler får ingenting", () => {
  it("scratch-database bygges til og med DATA-002C, legacy-profiler legges inn, ECON-005b anvendes: bare synthetic-demo v1 får true", async () => {
    const { readFileSync, readdirSync } = await import("node:fs");
    const { Client: Pg } = await import("pg");
    const name = `econ005b_upgrade_${Date.now()}`;
    const adminUrl = new URL(process.env.SUPABASE_TEST_DB_URL!);
    await db.query(`create database ${name}`);
    const u = new URL(adminUrl); u.pathname = `/${name}`;
    const c = new Pg({ connectionString: u.toString() });
    await c.connect();
    try {
      // rollene (anon/authenticated/service_role) finnes allerede i klyngen fra hoveddatabasens shim
      await c.query(readFileSync("tests/db/support/supabase-shim.sql", "utf8").replace(/^create role .*$/gm, ""));
      const dir = process.env.MIGRATIONS_DIR ?? "supabase/migrations"; // MIGRATIONS_DIR: endret kopi ved mutasjonskontroll
      const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
      const mine = files.find((f) => f.includes("econ005b"))!;
      for (const f of files) if (f !== mine && !f.includes("search005") && !f.includes("econ005c")) await c.query(readFileSync(`${dir}/${f}`, "utf8"));
      await c.query(readFileSync("supabase/seed.sql", "utf8"));
      // legacy: en verifisert live-profil med alle visnings-/matchingsrettigheter og lagring, og en verifisert sandbox-profil, før ECON-005b
      const all = fieldMap(Object.fromEntries(RIGHTS_FIELD_KEYS.map((k) => [k, true])));
      await c.query(`insert into private.provider_rights_profiles (provider, version, status, effective_from, retention_seconds, source_ref, verified_by, verified_at, environment, provider_name, attribution_text, display_fields, matching_fields, allow_price, allow_specs)
        values ('legacy-live', 1, 'verified', '2026-10-01', 3600, 'LEGACY', 'test', '2026-10-02', 'live', 'Legacy', 'Kilde', $1::jsonb, $1::jsonb, true, true),
               ('legacy-sandbox', 1, 'verified', '2026-10-01', 3600, 'LEGACY', 'test', '2026-10-02', 'sandbox', 'Legacy2', 'Kilde', $1::jsonb, $1::jsonb, true, true)`, [all]);
      await c.query(readFileSync(`${dir}/${mine}`, "utf8"));
      const rows = (await c.query("select provider, environment, allow_derived_economics a, display_derived_economics d from private.provider_rights_profiles order by provider")).rows;
      expect(rows).toEqual([
        { provider: "legacy-live", environment: "live", a: noEconomicsRights(), d: false },
        { provider: "legacy-sandbox", environment: "sandbox", a: noEconomicsRights(), d: false },
        { provider: "synthetic-demo", environment: "synthetic", a: SYNTHETIC_RIGHTS_PROFILE.derivedEconomics.allow, d: true },
      ]);
      for (const p of ["legacy-live", "legacy-sandbox"]) {
        expect((await c.query("select private.can_derive_economics($1, now(), array['price']) r", [p])).rows[0]!.r).toBe(false);
        expect((await c.query("select private.can_display_economics($1, now(), array['price'], array[]::text[]) r", [p])).rows[0]!.r).toBe(false);
      }
    } finally { await c.end(); await db.query(`drop database ${name}`); }
  });
});

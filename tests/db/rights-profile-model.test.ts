/**
 * DATA-002B — utvidet rettighetsprofil (`private.provider_rights_profiles`): backfill, default-deny, constraints og uforanderlighet.
 * Bruker bare direkte databasetilkobling som databaseeier (tabellen ligger i `private` og er utilgjengelig for appen), så filen kan kjøres
 * både mot lokal Supabase og mot den isolerte klyngen (`bash scripts/test-db-isolated.sh tests/db/rights-profile-model.test.ts`).
 * I den isolerte klyngen finnes ikke Auth/PostgREST; bevisene gjelder PostgreSQLs constraints og triggere.
 * Hver test kjører i en transaksjon som rulles tilbake — ingen testdata blir liggende.
 */
import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { RIGHTS_FIELD_KEYS, SYNTHETIC_RIGHTS_PROFILE } from "@/domain/provider-rights";
import { adminDb, assertLocal } from "./harness";

let db: Client;
beforeAll(async () => { assertLocal(); db = await adminDb(); });
afterAll(async () => { if (db) await db.end(); });

const map = (over: Record<string, boolean | string | null> = {}) => JSON.stringify({ ...Object.fromEntries(RIGHTS_FIELD_KEYS.map((k) => [k, false])), ...over });

/** Kjører `fn` i en transaksjon som alltid rulles tilbake. Feil fra databasen returneres som {code,message}. */
async function tx<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  await db.query("begin");
  try { return await fn(db); } finally { await db.query("rollback"); }
}
async function attempt(sql: string, params: unknown[] = []): Promise<{ ok: true; rows: Record<string, unknown>[] } | { ok: false; code: string; message: string }> {
  await db.query("savepoint s");
  try { const r = await db.query(sql, params); await db.query("release savepoint s"); return { ok: true, rows: r.rows }; }
  catch (e) { await db.query("rollback to savepoint s"); const x = e as { code?: string; message?: string }; return { ok: false, code: x.code ?? "", message: x.message ?? "" }; }
}
const insert = (cols: Record<string, unknown>) => {
  const base: Record<string, unknown> = { provider: "example-sandbox", version: 1, effective_from: "2026-10-01T00:00:00Z", retention_seconds: 0, source_ref: "TESTFIXTURE", environment: "sandbox" };
  const all = { ...base, ...cols };
  const keys = Object.keys(all);
  const casts: Record<string, string> = { display_fields: "::jsonb", matching_fields: "::jsonb", allowed_countries: "::text[]" };
  return { sql: `insert into private.provider_rights_profiles (${keys.join(",")}) values (${keys.map((k, i) => `$${i + 1}${casts[k] ?? ""}`).join(",")}) returning *`, params: keys.map((k) => all[k]) };
};

describe("DATA-002B: migrasjonen og backfill av synthetic-demo v1", () => {
  it("synthetic-demo v1 er backfylt in place og speiler TS-profilen (ingen annen profil finnes)", async () => {
    const rows = (await db.query("select * from private.provider_rights_profiles order by provider, version")).rows;
    expect(rows.map((r) => `${r.provider}@${r.version}`)).toEqual(["synthetic-demo@1"]);
    const r = rows[0]!;
    const p = SYNTHETIC_RIGHTS_PROFILE;
    expect(r).toMatchObject({
      environment: p.environment, status: p.status, provider_name: p.providerName, retention_seconds: p.storage.retentionSeconds,
      cache_seconds: p.storage.cacheSeconds, history_retention_seconds: p.storage.historyRetentionSeconds,
      multi_customer_reuse: p.usage.multiCustomerReuse, re_evaluation_allowed: p.usage.reEvaluation, alerts_allowed: p.usage.alerts,
      geography_unrestricted: p.geography.unrestricted, allowed_countries: [], attribution_required: p.attribution.required,
      attribution_text: p.attribution.text, deep_link_required: p.deepLinkRequired, on_revocation: p.onRevocation,
      allow_price: p.storage.storable.price, allow_specs: p.storage.storable.specs, allow_text: p.storage.storable.text,
      allow_images: p.storage.storable.images, allow_seller_data: p.storage.storable.sellerData,
    });
    expect(r.display_fields).toEqual(p.display);
    expect(r.matching_fields).toEqual(p.matching);
    expect(new Date(r.effective_from as string).toISOString()).toBe(new Date(p.validFrom).toISOString());
    expect(r.effective_to).toBeNull();
  });

  it("profilen som gjelder nå for synthetic-demo er fortsatt v1; ukjent leverandør gir ingen rad (default-deny)", async () => {
    expect((await db.query("select version from private.rights_profile_in_force('synthetic-demo', now())")).rows).toEqual([{ version: 1 }]);
    expect((await db.query("select * from private.rights_profile_in_force('mobile-sandbox', now())")).rows).toHaveLength(0);
  });

  it("nye profiler er default-deny: tomme feltkart, ingen cache/historikk/gjenbruk/varsler/geografi, trukket-oppførsel hide_and_purge", async () => {
    await tx(async () => {
      const i = insert({});
      const r = await attempt(i.sql, i.params);
      if (!r.ok) throw new Error(r.message);
      const row = r.rows[0]!;
      expect(row.status).toBe("draft");
      expect(row.display_fields).toEqual(Object.fromEntries(RIGHTS_FIELD_KEYS.map((k) => [k, false])));
      expect(row.matching_fields).toEqual(Object.fromEntries(RIGHTS_FIELD_KEYS.map((k) => [k, false])));
      expect(row).toMatchObject({ cache_seconds: 0, history_retention_seconds: 0, multi_customer_reuse: false, re_evaluation_allowed: false, alerts_allowed: false,
        geography_unrestricted: false, allowed_countries: [], attribution_required: true, deep_link_required: false, on_revocation: "hide_and_purge",
        allow_price: false, allow_specs: false, allow_text: false, allow_images: false, allow_seller_data: false });
      // et utkast er aldri «i kraft»
      expect((await db.query("select * from private.rights_profile_in_force('example-sandbox', now())")).rows).toHaveLength(0);
    });
  });
});

describe("DATA-002B: constraints", () => {
  it.each([
    ["ugyldig miljø", { environment: "production" }],
    ["feltkart mangler nøkkel", { display_fields: JSON.stringify({ title: true }) }],
    ["feltkart med ekstra nøkkel", { matching_fields: map({ vin: true }) }],
    ["feltkart med ikke-boolsk verdi", { display_fields: map({ price: "ja" }) }],
    ["historikk lengre enn lagring", { retention_seconds: 100, history_retention_seconds: 101 }],
    ["ugyldig landkode", { allowed_countries: ["Germany"] }],
    ["ukjent landkode", { allowed_countries: ["ZZ"] }],
    ["ubegrenset geografi sammen med land", { geography_unrestricted: true, allowed_countries: ["DE"] }],
    ["negativ cache", { cache_seconds: -1 }],
    ["ugyldig revokasjonsoppførsel", { on_revocation: "keep" }],
    ["tomt leverandørnavn", { provider_name: "" }],
  ])("avvises: %s", async (_n, cols) => {
    await tx(async () => {
      const i = insert(cols as Record<string, unknown>);
      const r = await attempt(i.sql, i.params);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe("23514");
    });
  });

  it("verifisert profil: attribusjonstekst er påkrevd når attribusjon kreves; live/sandbox krever leverandørnavn; syntetisk gjør ikke", async () => {
    await tx(async () => {
      const verified = { status: "verified", verified_by: "test", verified_at: "2026-10-02T00:00:00Z" };
      const noText = insert({ ...verified, provider_name: "Eksempel" });
      expect((await attempt(noText.sql, noText.params)).ok).toBe(false);
      const noName = insert({ ...verified, attribution_text: "Kilde" });
      expect((await attempt(noName.sql, noName.params)).ok).toBe(false);
      const okSandbox = insert({ ...verified, attribution_text: "Kilde", provider_name: "Eksempel" });
      expect((await attempt(okSandbox.sql, okSandbox.params)).ok).toBe(true);
      const synthetic = insert({ ...verified, provider: "example-synthetic", environment: "synthetic", attribution_text: "Syntetisk" });
      expect((await attempt(synthetic.sql, synthetic.params)).ok).toBe(true);
      const noAttributionNeeded = insert({ ...verified, provider: "example-two", attribution_required: false, provider_name: "To" });
      expect((await attempt(noAttributionNeeded.sql, noAttributionNeeded.params)).ok).toBe(true);
    });
  });

  it("verifisert profil kan ikke uten verifiseringsinfo (eksisterende regel er uendret)", async () => {
    await tx(async () => {
      const i = insert({ status: "verified", attribution_text: "x", provider_name: "y" });
      const r = await attempt(i.sql, i.params);
      expect(r.ok).toBe(false);
    });
  });
});

describe("DATA-002B: uforanderlighet og tilbakekalling (vakttriggeren dekker de nye kolonnene)", () => {
  const verified = { status: "verified", verified_by: "test", verified_at: "2026-10-02T00:00:00Z", attribution_text: "Kilde", provider_name: "Eksempel", display_fields: map({ title: true }), matching_fields: map({ title: true }) };

  it.each([
    ["display_fields", "display_fields = '" + map({ title: true, price: true }) + "'::jsonb"],
    ["matching_fields", "matching_fields = '" + map({ title: false }) + "'::jsonb"],
    ["allowed_countries", "allowed_countries = '{DE}'"],
    ["environment", "environment = 'live'"],
    ["attribution_text", "attribution_text = 'Annen'"],
    ["multi_customer_reuse", "multi_customer_reuse = true"],
    ["cache_seconds", "cache_seconds = 5"],
    ["on_revocation", "on_revocation = 'hide_only'"],
    ["provider_name", "provider_name = 'Annet'"],
  ])("endring av %s på en eksisterende profil avvises (opprett ny versjon)", async (_c, set) => {
    await tx(async () => {
      const i = insert(verified);
      const ins = await attempt(i.sql, i.params);
      if (!ins.ok) throw new Error(ins.message);
      const r = await attempt(`update private.provider_rights_profiles set ${set} where provider = 'example-sandbox'`);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.message).toMatch(/rights_profile_immutable/);
    });
  });

  it("tilbakekalling og forkortet virkningsperiode er fortsatt tillatt; trukket profil gjelder ikke lenger; trukket kan ikke gjenopprettes", async () => {
    await tx(async () => {
      const i = insert(verified);
      const ins = await attempt(i.sql, i.params);
      if (!ins.ok) throw new Error(ins.message);
      expect((await db.query("select version from private.rights_profile_in_force('example-sandbox', now())")).rows).toEqual([{ version: 1 }]);
      expect((await attempt("update private.provider_rights_profiles set effective_to = now() + interval '1 day' where provider = 'example-sandbox'")).ok).toBe(true);
      expect((await attempt("update private.provider_rights_profiles set status = 'revoked' where provider = 'example-sandbox'")).ok).toBe(true);
      expect((await db.query("select * from private.rights_profile_in_force('example-sandbox', now())")).rows).toHaveLength(0);
      const back = await attempt("update private.provider_rights_profiles set status = 'verified' where provider = 'example-sandbox'");
      expect(back.ok).toBe(false);
    });
  });

  it("DEV-005B0-reglene gjelder fortsatt: bare én verifisert profil per leverandør om gangen", async () => {
    await tx(async () => {
      const a = insert(verified);
      expect((await attempt(a.sql, a.params)).ok).toBe(true);
      const b = insert({ ...verified, version: 2 });
      const r = await attempt(b.sql, b.params);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.message).toMatch(/rights_profile_overlap/);
    });
  });
});

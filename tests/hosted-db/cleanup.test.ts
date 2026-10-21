// HOST-001 (forberedelse): opprydding av testdata (H4) mot en isolert PostgreSQL. Tørrkjøring er skrivebeskyttet; sletting rammer bare testdata, ruller tilbake ved feil og er idempotent. IKKE Supabase, IKKE hosted.
import { randomUUID } from "node:crypto";
import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { executeCleanup, planCleanup } from "../../scripts/hosted/cleanup.mjs";
import { adminDb, createFirmWithMember, createUser } from "../db/harness";

let db: Client;
const PROFILE = JSON.stringify({ schemaVersion: 1, vatHandling: "unknown", deduction: "unknown" });
const ids: Record<string, string> = {};
beforeAll(async () => {
  db = await adminDb();
  const a = await createUser(db, "hosted-a"), b = await createUser(db, "hosted-b"), c = await createUser(db, "hosted-c");
  ids.firmA = await createFirmWithMember(db, "H-Firma A", a); ids.firmB = await createFirmWithMember(db, "H-Firma B", b);
  // ikke-testbruker med eget firma, og et BLANDET firma (testbruker c + ikke-testbruker)
  const real = async (email: string) => { const id = randomUUID(); await db.query("insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change) values ('00000000-0000-0000-0000-000000000000',$1,'authenticated','authenticated',$2,'x',now(),now(),now(),'','','','')", [id, email]); return id; };
  ids.real1 = await real("kunde1@kunde.no"); ids.real2 = await real("kunde2@kunde.no");
  ids.firmR = (await db.query("select private.admin_create_dealership($1) id", ["H-Ekte firma"])).rows[0].id; await db.query("select private.admin_add_member($1,$2)", ["kunde1@kunde.no", ids.firmR]);
  ids.firmM = (await db.query("select private.admin_create_dealership($1) id", ["H-Blandet firma"])).rows[0].id; await db.query("select private.admin_add_member($1,$2)", [c.email, ids.firmM]); await db.query("select private.admin_add_member($1,$2)", ["kunde2@kunde.no", ids.firmM]);
  ids.firmO = (await db.query("select private.admin_create_dealership($1) id", ["H-Foreldreløst"])).rows[0].id;
  for (const f of [ids.firmA, ids.firmB, ids.firmR, ids.firmM]) await db.query("insert into public.dealer_economics_profiles (dealership_id, payload) values ($1, $2::jsonb)", [f, PROFILE]);
});
afterAll(async () => {
  await db.query("drop trigger if exists h_boom on auth.users").catch(() => {});
  await db.query("delete from public.dealer_economics_profiles where dealership_id = any($1::uuid[])", [[ids.firmR, ids.firmM]]).catch(() => {});
  await db.query("delete from public.dealership_members where dealership_id = any($1::uuid[])", [[ids.firmR, ids.firmM]]).catch(() => {});
  await db.query("delete from public.dealerships where id = any($1::uuid[])", [[ids.firmR, ids.firmM, ids.firmO]]).catch(() => {});
  await db.query("delete from auth.users where email like '%@kunde.no' or email like '%@example.test'").catch(() => {});
  await db.end();
});
const snap = async () => (await db.query(`select md5(string_agg(x, '|' order by x)) m from (select 'u:' || id::text x from auth.users union all select 'd:' || id::text from public.dealerships
  union all select 'm:' || user_id::text from public.dealership_members union all select 'p:' || dealership_id::text from public.dealer_economics_profiles) s`)).rows[0]!.m as string;

describe("tørrkjøring", () => {
  it("skrivebeskyttet: bare tall; teller testbrukere/-firma, blandet og foreldreløst firma separat; databasen er uendret", async () => {
    const before = await snap();
    const seen: string[] = [];
    const spy = { query: (sql: string, p?: unknown[]) => { seen.push(sql); return db.query(sql, p); } } as unknown as Client;
    const { plan } = await planCleanup(spy);
    expect(plan).toMatchObject({ testUsers: 2, testFirms: 2, blockedFirms: 1, rows: { dealer_economics_profiles: 2 } });
    expect(plan.orphanFirms).toBeGreaterThanOrEqual(1);
    expect(seen[0]).toBe("begin read only"); expect(seen[seen.length - 1]).toBe("rollback");
    for (const s of seen) expect(s).toMatch(/^\s*(begin read only|select|rollback)\b/i);
    expect(await snap()).toBe(before);
    expect(JSON.stringify(plan)).not.toMatch(/kunde|example\.test|[0-9a-f]{8}-[0-9a-f]{4}/);   // aldri e-poster eller IDer
  });
});

describe("sletting", () => {
  it("feil midt i slettingen ruller ALT tilbake (ingenting halvt slettet)", async () => {
    await db.query("create or replace function public.h_boom() returns trigger language plpgsql as $$ begin raise exception 'boom'; end $$");
    await db.query("create trigger h_boom before delete on auth.users for each row execute function public.h_boom()");
    const before = await snap();
    const r = await executeCleanup(db);
    expect(r.ok).toBe(false);
    expect(await snap()).toBe(before);
    await db.query("drop trigger h_boom on auth.users");
    await db.query("drop function public.h_boom()");
  });
  it("sletter bare testdata: testbrukere og -firma med data; rører ikke ikke-testbrukere, blandet firma (og dets testbruker) eller foreldreløst firma; verifiserer etterpå", async () => {
    const r = await executeCleanup(db);
    expect(r).toMatchObject({ ok: true, before: { testUsers: 2, testFirms: 2 }, after: { testUsers: 0, testFirms: 0 } });
    const left = (sql: string, p: unknown[]) => db.query(sql, p).then((x) => x.rows[0]!.n as number);
    expect(await left("select count(*)::int n from public.dealerships where id = any($1::uuid[])", [[ids.firmA, ids.firmB]])).toBe(0);
    expect(await left("select count(*)::int n from public.dealerships where id = any($1::uuid[])", [[ids.firmR, ids.firmM, ids.firmO]])).toBe(3);
    expect(await left("select count(*)::int n from public.dealer_economics_profiles where dealership_id = any($1::uuid[])", [[ids.firmR, ids.firmM]])).toBe(2);
    expect(await left("select count(*)::int n from auth.users where email like '%@kunde.no'", [])).toBe(2);
    expect(await left("select count(*)::int n from public.dealership_members where dealership_id = $1", [ids.firmM])).toBe(2);   // testbrukeren i blandet firma er beholdt
  });
  it("idempotent: ny kjøring finner ingenting nytt å slette og endrer ingenting", async () => {
    const before = await snap();
    const { plan } = await planCleanup(db);
    expect(plan).toMatchObject({ testFirms: 0, blockedFirms: 1 });
    const r = await executeCleanup(db);
    expect(r.ok).toBe(true);
    expect(await snap()).toBe(before);
  });
});

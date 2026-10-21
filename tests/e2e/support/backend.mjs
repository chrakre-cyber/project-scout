// TESTHJELPER (CI-001 trinn 2): velger Supabase-backend for e2e-skriptene. To tydelig adskilte moduser:
//  - «emulator» (standard): tests/e2e/support/mini-supabase.mjs — EMULATOR av Auth/PostgREST over en isolert PostgreSQL. IKKE Supabase.
//  - «real» (E2E_SUPABASE_MODE=real): EKTE lokal Supabase-stakk (GoTrue + PostgREST). URL og publishable key kommer fra SUPABASE_TEST_URL / SUPABASE_TEST_PUBLISHABLE_KEY
//    (satt av scripts/test-e2e-real-supabase.sh, aldri skrevet ut). Bare localhost godtas. Testbrukere settes inn som databaseeier (som tests/db/harness.ts) og ryddes bort etterpå.
// Skriptene skriver «MODUS: …» først i utskriften så ingen kan forveksle de to.
import { startMiniSupabase } from "./mini-supabase.mjs";

export const MODE = process.env.E2E_SUPABASE_MODE === "real" ? "real" : "emulator";
const local = (u) => ["127.0.0.1", "localhost"].includes(new URL(u).hostname);

export async function connectBackend({ db, dbUrl, users, port, pgModulePath }) {
  console.log(`MODUS: ${MODE === "real" ? "EKTE lokal Supabase (GoTrue + PostgREST)" : "EMULATOR (mini-supabase over isolert PostgreSQL) — IKKE Supabase"}`);
  if (MODE === "emulator") {
    const emu = await startMiniSupabase({ dbUrl, users, port, pgModulePath });
    return { mode: MODE, url: emu.url, publishableKey: "test-publishable-key-not-secret", log: emu.log, close: () => emu.close(), cleanup: async () => {} };
  }
  const url = process.env.SUPABASE_TEST_URL ?? "", key = process.env.SUPABASE_TEST_PUBLISHABLE_KEY ?? "";
  if (!url || !key) throw new Error("Ekte modus krever SUPABASE_TEST_URL og SUPABASE_TEST_PUBLISHABLE_KEY (bruk scripts/test-e2e-real-supabase.sh)");
  if (!local(url) || !local(dbUrl)) throw new Error("Nekter å kjøre mot ikke-lokal Supabase/database");
  for (const u of users) {
    await db.query(`insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      select $1::text, $2::uuid, jsonb_build_object('sub', $1::text, 'email', $3::text), 'email', now(), now(), now()
      where not exists (select 1 from auth.identities where user_id = $2::uuid)`, [u.id, u.id, u.email]);
  }
  return {
    mode: MODE, url, publishableKey: key, log: null, close: async () => {},
    cleanup: async ({ firmIds, users: us }) => {
      const q = (sql, p) => db.query(sql, p).catch(() => {});
      await q("delete from public.dealer_economics_inputs where dealership_id = any($1::uuid[])", [firmIds]);
      await q("delete from public.dealer_economics_profiles where dealership_id = any($1::uuid[])", [firmIds]);
      await q("delete from public.search_drafts where dealership_id = any($1::uuid[])", [firmIds]);
      await q("delete from public.dealership_members where dealership_id = any($1::uuid[])", [firmIds]);
      await q("delete from public.dealerships where id = any($1::uuid[])", [firmIds]);
      await q("delete from auth.users where id = any($1::uuid[])", [us.map((x) => x.id)]);
    },
  };
}

/**
 * Testoppsett for lokal Supabase. Oppsett (brukere, firma, medlemskap) gjøres
 * som databaseeier via direkte tilkobling — tilsvarer prosjekteiers kontrollerte
 * administrasjon. Alle tilgangspåstander kjøres som ordinære brukere via Auth +
 * PostgREST med publishable key. Ingen service-role-nøkkel brukes.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Client } from "pg";

export const env = {
  url: process.env.SUPABASE_TEST_URL ?? "",
  key: process.env.SUPABASE_TEST_PUBLISHABLE_KEY ?? "",
  dbUrl: process.env.SUPABASE_TEST_DB_URL ?? "",
};

export function assertLocal() {
  if (!env.url || !env.key || !env.dbUrl) throw new Error("Mangler SUPABASE_TEST_* — kjør via `npm run test:db`.");
  for (const u of [env.url, env.dbUrl]) {
    const host = new URL(u).hostname;
    if (host !== "127.0.0.1" && host !== "localhost") throw new Error(`Nekter å kjøre mot ikke-lokal host ${host}`);
  }
}

export async function adminDb(): Promise<Client> {
  const c = new Client({ connectionString: env.dbUrl });
  await c.connect();
  return c;
}

export interface TestUser {
  id: string;
  email: string;
  password: string;
}

const RUN = randomBytes(4).toString("hex");

export async function createUser(db: Client, label: string): Promise<TestUser> {
  const id = randomUUID();
  const email = `${label}-${RUN}@example.test`;
  const password = randomBytes(18).toString("base64url");
  await db.query(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
       raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
       confirmation_token, recovery_token, email_change_token_new, email_change)
     values ('00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2,
       extensions.crypt($3, extensions.gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')`,
    [id, email, password],
  );
  await db.query(
    `insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
     values ($1::text, $2::uuid, jsonb_build_object('sub', $1::text, 'email', $3::text), 'email', now(), now(), now())`,
    [id, id, email],
  );
  return { id, email, password };
}

export async function createFirmWithMember(db: Client, name: string, user: TestUser): Promise<string> {
  const { rows } = await db.query("select private.admin_create_dealership($1) as id", [`${name} ${RUN}`]);
  const firmId = rows[0].id as string;
  await db.query("select private.admin_add_member($1, $2)", [user.email, firmId]);
  return firmId;
}

export async function signIn(user: TestUser): Promise<SupabaseClient> {
  const client = createClient(env.url, env.key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  if (error) throw new Error(`Innlogging feilet for testbruker: ${error.message}`);
  return client;
}

export function anonClient(): SupabaseClient {
  return createClient(env.url, env.key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function cleanup(db: Client, firmIds: string[], users: TestUser[]) {
  await db.query("delete from public.search_agents where dealership_id = any($1::uuid[])", [firmIds]);
  await db.query("delete from public.dealership_members where dealership_id = any($1::uuid[])", [firmIds]);
  await db.query("delete from public.dealerships where id = any($1::uuid[])", [firmIds]);
  await db.query("delete from auth.users where id = any($1::uuid[])", [users.map((u) => u.id)]);
}

/** Direkte DB-tilkobling som ordinær bruker: rolle authenticated + JWT-claims, som PostgREST gjør. */
export async function asUser(db: Client, user: TestUser) {
  await db.query("begin");
  await db.query("select set_config('role', 'authenticated', true), set_config('request.jwt.claims', $1, true)", [
    JSON.stringify({ sub: user.id, role: "authenticated" }),
  ]);
}

/** Komplett agent (klar for aktivering) i DB-format (DEC-020), for tester som aktiverer. */
export const READY = {
  filters: { make: "Volkswagen" },
  assumptions: {
    retail: { expectedRetailTotal: { amountMinor: "39990000", currency: "NOK" }, priceBasis: { vat: "included", registrationTaxes: "included" } },
    minimumContribution: { amountMinor: "3000000", currency: "NOK" },
    preparationReserve: { amount: { amountMinor: "1500000", currency: "NOK" }, vatBasis: "ex_vat" },
  },
};

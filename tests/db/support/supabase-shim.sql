-- SHIM: gjør en vanlig, isolert PostgreSQL-database lik nok lokal Supabase til at repoets migrasjoner og RLS kan kjøres.
-- ALDRI mot Supabase (hverken lokal eller hostet): Supabase har allerede disse objektene. Brukes kun av
-- scripts/test-db-isolated.sh i en midlertidig database opprettet for testen.
--
-- Hva som etterlignes: rollene anon/authenticated/service_role, schema `auth` (users, identities, uid()/jwt()/role()),
-- schema `extensions` (pgcrypto) og Supabases standard grants på public. Hva som IKKE finnes: GoTrue (Auth-tjeneste),
-- PostgREST, JWT-validering. Tester som bruker Auth/PostgREST kan derfor ikke kjøres mot dette; RLS, constraints, triggere og
-- grants kjøres av den ekte PostgreSQL-motoren med rolle `authenticated` og JWT-claims i `request.jwt.claims`.
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;

create schema extensions;
create extension pgcrypto with schema extensions;

create schema auth;
create table auth.users (
  instance_id uuid, id uuid primary key, aud text, role text, email text, encrypted_password text,
  email_confirmed_at timestamptz, raw_app_meta_data jsonb, raw_user_meta_data jsonb, created_at timestamptz, updated_at timestamptz,
  confirmation_token text, recovery_token text, email_change_token_new text, email_change text
);
create table auth.identities (
  provider_id text not null, user_id uuid not null references auth.users (id) on delete cascade, identity_data jsonb not null,
  provider text not null, last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz
);
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
                  (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid
$$;
create function auth.role() returns text language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''),
                  (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'))::text
$$;
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim', true), ''), nullif(current_setting('request.jwt.claims', true), ''))::jsonb
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid(), auth.role(), auth.jwt() to anon, authenticated, service_role;

-- Supabase gir anon/authenticated/service_role alle rettigheter på nye tabeller/funksjoner i public som standard
-- (migrasjonene tilbakekaller dette eksplisitt; skjemaet skal derfor etterlignes).
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

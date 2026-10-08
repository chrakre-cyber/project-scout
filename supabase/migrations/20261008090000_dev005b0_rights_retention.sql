-- DEV-005B0: Provider Rights & Retention Foundation (DEC-028, DEC-029).
--
-- Provider-uavhengig fundament for lagringsrettigheter og retensjon. Ingen ekstern kilde er koblet til,
-- ingen global `listings`/`listing_revisions` (DEV-005B er fortsatt BLOCKED).
--
--  1. `private.provider_rights_profiles`: versjonert rettighetsprofil per provider (virkningsperiode, kilde,
--     verifisering, tillatt retensjon og hvilke datatyper som kan lagres). Default-deny: uten gyldig, verifisert
--     profil i kraft kan ingen kjøring starte og ingen resultater lagres.
--  2. `rights_profile_version` og `expires_at` på `search_runs` og `search_run_results`. Utløpte rader er usynlige
--     for brukere umiddelbart (RLS) og slettes av `private.purge_expired_search_runs`.
--  3. Betrodd skrivevei (FU-005-1): ordinære brukere kan ikke lenger sette inn resultater eller ferdigstille
--     kjøringer. Det gjøres av SECURITY DEFINER-funksjoner som bare rollen `scout_ingest` kan kjøre. Rollen er
--     NOLOGIN i migrasjonen; passord settes utenfor git av prosjekteier. Dette er IKKE service-role.
--  4. `synthetic-demo` migreres til en eksplisitt profil (v1) med kort test-retensjon, slik at DEV-005A virker.
--
-- Eksisterende rader backfilles (retensjon regnet fra created_at). Brukerens rett til å starte en kjøring er uendret.

-- ---------------------------------------------------------------------------
-- 1. Rolle for betrodd skrivevei (ingen tabellrettigheter, ingen BYPASSRLS)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'scout_ingest') then
    create role scout_ingest nologin noinherit nosuperuser nocreatedb nocreaterole nobypassrls;
  end if;
end
$$;
alter role scout_ingest set statement_timeout = '30s';

-- ---------------------------------------------------------------------------
-- 2. Rettighetsprofiler
-- ---------------------------------------------------------------------------
create table private.provider_rights_profiles (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  version integer not null check (version >= 1),
  status text not null default 'draft' check (status in ('draft', 'verified', 'revoked')),
  effective_from timestamptz not null,
  -- Eksklusiv slutt. NULL = ingen slutt. Kan bare forkortes etter opprettelse.
  effective_to timestamptz,
  -- Tillatt lagringstid i sekunder. 0 = ingen persistent lagring tillatt. Maks 10 år.
  retention_seconds integer not null check (retention_seconds between 0 and 315360000),
  allow_price boolean not null default false,
  allow_specs boolean not null default false,
  allow_text boolean not null default false,
  allow_images boolean not null default false,
  allow_seller_data boolean not null default false,
  -- Kontrakt/avtale/dokument profilen bygger på (CLAUDE.md pkt. 5: kilde, virkningsdato, versjon).
  source_ref text not null check (char_length(source_ref) between 1 and 500),
  verified_by text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  constraint provider_rights_profiles_version_key unique (provider, version),
  constraint provider_rights_profiles_period_check check (effective_to is null or effective_to > effective_from),
  constraint provider_rights_profiles_verified_check check (
    status <> 'verified' or (verified_by is not null and char_length(verified_by) > 0 and verified_at is not null))
);
alter table private.provider_rights_profiles enable row level security;
revoke all on private.provider_rights_profiles from public, anon, authenticated, service_role;

create function private.rights_profiles_guard() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if (new.id, new.provider, new.version, new.effective_from, new.retention_seconds, new.allow_price, new.allow_specs,
        new.allow_text, new.allow_images, new.allow_seller_data, new.source_ref, new.created_at)
       is distinct from
       (old.id, old.provider, old.version, old.effective_from, old.retention_seconds, old.allow_price, old.allow_specs,
        old.allow_text, old.allow_images, old.allow_seller_data, old.source_ref, old.created_at) then
      raise exception 'rights_profile_immutable: en profil kan ikke endres; opprett ny versjon' using errcode = 'check_violation';
    end if;
    if old.status = 'revoked' and new.status <> 'revoked' then
      raise exception 'rights_profile_immutable: en trukket profil kan ikke gjenopprettes' using errcode = 'check_violation';
    end if;
    if old.status = 'verified' and new.status = 'draft' then
      raise exception 'rights_profile_immutable: en verifisert profil kan ikke settes tilbake til utkast' using errcode = 'check_violation';
    end if;
    if old.status = 'verified' and (new.verified_by is distinct from old.verified_by or new.verified_at is distinct from old.verified_at) then
      raise exception 'rights_profile_immutable: verifiseringen kan ikke endres' using errcode = 'check_violation';
    end if;
    if old.effective_to is not null and (new.effective_to is null or new.effective_to > old.effective_to) then
      raise exception 'rights_profile_immutable: virkningsperioden kan bare forkortes' using errcode = 'check_violation';
    end if;
  end if;
  -- Bare én verifisert profil kan gjelde per provider til enhver tid.
  if new.status = 'verified' and exists (
    select 1 from private.provider_rights_profiles o
    where o.provider = new.provider and o.status = 'verified' and o.id <> new.id
      and tstzrange(o.effective_from, o.effective_to) && tstzrange(new.effective_from, new.effective_to)) then
    raise exception 'rights_profile_overlap: en annen verifisert profil gjelder i samme periode' using errcode = 'check_violation';
  end if;
  return new;
end
$$;
create trigger provider_rights_profiles_guard before insert or update on private.provider_rights_profiles
for each row execute function private.rights_profiles_guard();

-- Profilen som gjelder for en provider på et tidspunkt (verifisert og innenfor virkningsperioden), ellers ingen rad.
create function private.rights_profile_in_force(p_provider text, p_at timestamptz)
returns setof private.provider_rights_profiles
language sql stable security definer set search_path = ''
as $$
  select p.* from private.provider_rights_profiles p
  where p.provider = p_provider and p.status = 'verified'
    and p.effective_from <= p_at and (p.effective_to is null or p_at < p.effective_to)
  order by p.version desc
  limit 1
$$;

-- Syntetisk demokilde: eksplisitt profil med kort, trygg test-retensjon (7 dager). Ingen ekstern avtale finnes.
insert into private.provider_rights_profiles
  (provider, version, status, effective_from, effective_to, retention_seconds,
   allow_price, allow_specs, allow_text, allow_images, allow_seller_data, source_ref, verified_by, verified_at)
values
  ('synthetic-demo', 1, 'verified', '2026-10-01T00:00:00Z', null, 604800,
   true, true, false, false, true,
   'Intern syntetisk demokilde (DEV-003/DEV-005A): ingen ekte annonser og ingen eksterne vilkår. Retensjon er en test-verdi, ikke en leverandøravtale.',
   'DEV-005B0 (intern profil for syntetiske data)', now());

-- ---------------------------------------------------------------------------
-- 3. Rettighets- og utløpskolonner på kjøringer og resultater (backfill av eksisterende rader)
-- ---------------------------------------------------------------------------
alter table public.search_runs
  add column rights_profile_id uuid references private.provider_rights_profiles (id) on delete restrict,
  add column rights_profile_version integer check (rights_profile_version >= 1),
  add column expires_at timestamptz;
alter table public.search_run_results
  add column rights_profile_version integer check (rights_profile_version >= 1),
  add column expires_at timestamptz;

-- Backfill: den gamle update-triggeren avviser endring av avsluttede rader, så den slås av i denne transaksjonen.
alter table public.search_runs disable trigger search_runs_before_update;
update public.search_runs r
set rights_profile_id = p.id, rights_profile_version = p.version, expires_at = r.created_at + make_interval(secs => p.retention_seconds)
from private.provider_rights_profiles p
where p.provider = r.provider and p.version = 1;
alter table public.search_runs enable trigger search_runs_before_update;

update public.search_run_results x
set rights_profile_version = r.rights_profile_version, expires_at = r.expires_at
from public.search_runs r
where r.id = x.search_run_id;

alter table public.search_runs
  alter column rights_profile_id set not null,
  alter column rights_profile_version set not null,
  alter column expires_at set not null,
  add constraint search_runs_expiry_after_start check (expires_at > started_at);
alter table public.search_run_results
  alter column rights_profile_version set not null,
  alter column expires_at set not null;
create index search_runs_expires_idx on public.search_runs (expires_at);

-- Ny feilkode: profilen utløp eller ble trukket mens kjøringen pågikk.
alter table public.search_runs drop constraint search_runs_error_code_check;
alter table public.search_runs add constraint search_runs_error_code_check check (error_code is null or error_code in
  ('authentication', 'forbidden', 'rate_limit', 'invalid_query', 'timeout', 'unavailable', 'malformed_data', 'abandoned', 'internal', 'rights_blocked'));

-- ---------------------------------------------------------------------------
-- 4. Triggere (erstatter DEV-005-versjonene): rettighetskontroll, utløp og datatyper
-- ---------------------------------------------------------------------------
create or replace function private.search_runs_before_insert() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  a public.search_agents%rowtype;
  prof private.provider_rights_profiles%rowtype;
begin
  -- Fremmed og ukjent agent er umulige å skille: begge gir samme feil som RLS, før noe annet sjekkes.
  -- Uten bruker (auth.uid() null: eier/serverjobb) slås agenten opp uten firmabegrensning.
  select * into a from public.search_agents s
  where s.id = new.agent_id
    and ((select auth.uid()) is null or s.dealership_id in (select private.my_dealership_ids()))
  for share;
  if not found then
    raise exception 'new row violates row-level security policy for table "search_runs"' using errcode = 'insufficient_privilege';
  end if;

  if not a.active then
    raise exception 'search_run_agent_inactive: agenten er ikke aktiv' using errcode = 'check_violation';
  end if;
  if not private.agent_ready(a.filters, a.assumptions) then
    raise exception 'search_run_agent_not_ready: agenten oppfyller ikke aktiveringskravene' using errcode = 'check_violation';
  end if;
  if new.requested_agent_version is not null and new.requested_agent_version <> a.version then
    raise exception 'search_run_stale_agent: agenten er endret etter at siden ble lastet' using errcode = 'check_violation';
  end if;

  -- Default-deny: persistent lagring krever en verifisert rettighetsprofil som gjelder nå.
  select * into prof from private.rights_profile_in_force(new.provider, now());
  if not found then
    if exists (select 1 from private.provider_rights_profiles p where p.provider = new.provider and p.status in ('verified', 'revoked')) then
      raise exception 'search_run_rights_profile_expired: rettighetsprofilen for kilden er utløpt eller trukket' using errcode = 'check_violation';
    end if;
    raise exception 'search_run_rights_profile_missing: ingen verifisert rettighetsprofil finnes for kilden' using errcode = 'check_violation';
  end if;
  if prof.retention_seconds <= 0 then
    raise exception 'search_run_rights_storage_not_allowed: profilen tillater ikke persistent lagring' using errcode = 'check_violation';
  end if;

  -- Selvhelbredelse: en kjøring som henger i running (prosess døde) slippes slik at agenten kan kjøres igjen.
  update public.search_runs r set status = 'failed', error_code = 'abandoned'
  where r.agent_id = a.id and r.status = 'running' and r.started_at < now() - interval '5 minutes';

  -- Alt som ikke kan stoles på fra klienten settes her.
  new.dealership_id := a.dealership_id;
  new.agent_version := a.version;
  new.criteria_snapshot := jsonb_build_object(
    'schemaVersion', 1, 'agentName', a.name, 'filters', a.filters, 'assumptions', a.assumptions);
  new.rights_profile_id := prof.id;
  new.rights_profile_version := prof.version;
  new.expires_at := now() + make_interval(secs => prof.retention_seconds);
  new.status := 'running';
  new.counts := null;
  new.error_code := null;
  new.started_at := now();
  new.finished_at := null;
  new.created_at := now();
  return new;
end
$$;

create or replace function private.search_runs_before_update() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  stored integer;
  m integer;
  nr integer;
  prof private.provider_rights_profiles%rowtype;
begin
  if old.status <> 'running' then
    raise exception 'search_run_invalid_transition: en avsluttet kjøring kan ikke endres' using errcode = 'check_violation';
  end if;
  if new.status not in ('completed', 'failed') then
    raise exception 'search_run_invalid_transition: kjøringen kan bare gå fra running til completed eller failed' using errcode = 'check_violation';
  end if;
  if (new.id, new.dealership_id, new.agent_id, new.agent_version, new.requested_agent_version, new.request_token,
      new.provider, new.criteria_snapshot, new.started_at, new.created_at, new.rights_profile_id, new.rights_profile_version, new.expires_at)
     is distinct from
     (old.id, old.dealership_id, old.agent_id, old.agent_version, old.requested_agent_version, old.request_token,
      old.provider, old.criteria_snapshot, old.started_at, old.created_at, old.rights_profile_id, old.rights_profile_version, old.expires_at) then
    raise exception 'search_run_immutable: kriterier, agent, rettighetsprofil og tidspunkt kan ikke endres' using errcode = 'check_violation';
  end if;

  if new.status = 'completed' then
    -- Et fullført resultat er lagret data: profilen må fortsatt gjelde og kjøringen må ikke ha utløpt.
    select * into prof from private.provider_rights_profiles p where p.id = old.rights_profile_id;
    if not found or prof.status <> 'verified' or now() < prof.effective_from
       or (prof.effective_to is not null and now() >= prof.effective_to) or old.expires_at <= now() then
      raise exception 'search_run_rights_profile_expired: rettighetsprofilen er utløpt, så kjøringen kan ikke fullføres' using errcode = 'check_violation';
    end if;
    -- NULL regnes som bestått i IF/CHECK: manglende tellere avvises derfor eksplisitt.
    m := (new.counts ->> 'matches')::integer;
    nr := (new.counts ->> 'needsReview')::integer;
    select count(*) into stored from public.search_run_results where search_run_id = new.id;
    if new.error_code is not null or m is null or nr is null or m + nr <> stored then
      raise exception 'search_run_counts_mismatch: tellerne stemmer ikke med lagrede resultater' using errcode = 'check_violation';
    end if;
  end if;
  new.finished_at := now();
  return new;
end
$$;

create or replace function private.search_run_results_before_insert() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  r public.search_runs%rowtype;
  prof private.provider_rights_profiles%rowtype;
  base_keys text[] := array['source', 'sourceListingId', 'sourceModifiedAt', 'firstSeenAt', 'lastSeenAt', 'provenanceKind', 'withheld',
    'price', 'sellerType', 'sellerCountry', 'make', 'model', 'variant', 'firstRegistration', 'mileage', 'fuel', 'transmission', 'bodyType'];
  spec_keys text[] := array['make', 'model', 'variant', 'firstRegistration', 'mileage', 'fuel', 'transmission', 'bodyType'];
  seller_keys text[] := array['sellerType', 'sellerCountry'];
  k text;
begin
  select * into r from public.search_runs s
  where s.id = new.search_run_id
    and ((select auth.uid()) is null or s.dealership_id in (select private.my_dealership_ids()))
  for share;
  if not found then
    raise exception 'new row violates row-level security policy for table "search_run_results"' using errcode = 'insufficient_privilege';
  end if;
  if r.status <> 'running' then
    raise exception 'search_run_not_running: resultater kan bare legges til mens kjøringen pågår' using errcode = 'check_violation';
  end if;
  if new.source <> r.provider then
    raise exception 'search_run_result_source_mismatch: kilden stemmer ikke med kjøringens provider' using errcode = 'check_violation';
  end if;

  -- Lagring krever at kjøringens profil fortsatt gjelder og at kjøringen ikke har utløpt.
  select * into prof from private.provider_rights_profiles p where p.id = r.rights_profile_id;
  if not found or prof.status <> 'verified' or now() < prof.effective_from
     or (prof.effective_to is not null and now() >= prof.effective_to) or r.expires_at <= now() then
    raise exception 'search_run_rights_profile_expired: rettighetsprofilen er utløpt, resultater kan ikke lagres' using errcode = 'check_violation';
  end if;

  -- Datatyper: bare det profilen tillater kan lagres. Ukjente nøkler avvises (fail closed).
  if jsonb_typeof(new.listing_snapshot) = 'object' then
    if prof.allow_text then base_keys := base_keys || array['text']; end if;
    if prof.allow_images then base_keys := base_keys || array['images']; end if;
    if not coalesce(private.keys_subset(new.listing_snapshot, base_keys), false) then
      raise exception 'search_run_rights_data_type_not_allowed: snapshot inneholder felt profilen ikke tillater' using errcode = 'check_violation';
    end if;
    if not prof.allow_price and coalesce(jsonb_typeof(new.listing_snapshot -> 'price'), 'null') <> 'null' then
      raise exception 'search_run_rights_data_type_not_allowed: pris kan ikke lagres' using errcode = 'check_violation';
    end if;
    if not prof.allow_specs then
      foreach k in array spec_keys loop
        if coalesce(jsonb_typeof(new.listing_snapshot -> k), 'null') <> 'null' then
          raise exception 'search_run_rights_data_type_not_allowed: spesifikasjoner kan ikke lagres' using errcode = 'check_violation';
        end if;
      end loop;
    end if;
    if not prof.allow_seller_data then
      foreach k in array seller_keys loop
        if coalesce(jsonb_typeof(new.listing_snapshot -> k), 'null') <> 'null' then
          raise exception 'search_run_rights_data_type_not_allowed: selgerdata kan ikke lagres' using errcode = 'check_violation';
        end if;
      end loop;
    end if;
  end if;

  new.dealership_id := r.dealership_id;
  new.rights_profile_version := r.rights_profile_version;
  new.expires_at := r.expires_at;
  new.created_at := now();
  return new;
end
$$;

-- ---------------------------------------------------------------------------
-- 5. Betrodd skrivevei (FU-005-1): bare scout_ingest kan lagre og ferdigstille autoritative resultater
-- ---------------------------------------------------------------------------
-- Funksjonene tar firma-ID som forventning og avviser en kjøring som ikke tilhører firmaet eller ikke pågår.
-- Selve valideringen (rettighetsprofil, datatyper, tellere, statusoverganger) ligger i tabelltriggerne over.
create function private.trusted_run_policy(p_dealership_id uuid, p_run_id uuid)
returns table (profile_version integer, retention_seconds integer, expires_at timestamptz,
  allow_price boolean, allow_specs boolean, allow_text boolean, allow_images boolean, allow_seller_data boolean)
language plpgsql stable security definer set search_path = ''
as $$
declare
  x record;
begin
  select r.rights_profile_version as v, p.retention_seconds as rs, r.expires_at as ex,
         p.allow_price as ap, p.allow_specs as asp, p.allow_text as at_, p.allow_images as ai, p.allow_seller_data as asd
  into x
  from public.search_runs r join private.provider_rights_profiles p on p.id = r.rights_profile_id
  where r.id = p_run_id and r.dealership_id = p_dealership_id and r.status = 'running';
  if not found then
    raise exception 'trusted_run_not_found: kjøringen finnes ikke for firmaet eller pågår ikke' using errcode = 'no_data_found';
  end if;
  return query select x.v, x.rs, x.ex, x.ap, x.asp, x.at_, x.ai, x.asd;
end
$$;

create function private.trusted_store_results(p_dealership_id uuid, p_run_id uuid, p_rows jsonb) returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  n integer;
begin
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) not between 1 and 500 then
    raise exception 'trusted_invalid_input: rader må være en liste med 1–500 elementer' using errcode = 'invalid_parameter_value';
  end if;
  perform 1 from public.search_runs r
  where r.id = p_run_id and r.dealership_id = p_dealership_id and r.status = 'running' for share;
  if not found then
    raise exception 'trusted_run_not_found: kjøringen finnes ikke for firmaet eller pågår ikke' using errcode = 'no_data_found';
  end if;
  insert into public.search_run_results
    (search_run_id, source, source_listing_id, content_hash, rank, match_status, unknown_criteria, listing_snapshot)
  select p_run_id, x.source, x.source_listing_id, x.content_hash, x.rank, x.match_status, x.unknown_criteria, x.listing_snapshot
  from jsonb_to_recordset(p_rows) as x(source text, source_listing_id text, content_hash text, rank integer,
    match_status text, unknown_criteria jsonb, listing_snapshot jsonb);
  get diagnostics n = row_count;
  return n;
end
$$;

create function private.trusted_complete_run(p_dealership_id uuid, p_run_id uuid, p_counts jsonb) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.search_runs set status = 'completed', counts = p_counts
  where id = p_run_id and dealership_id = p_dealership_id and status = 'running';
  if not found then
    raise exception 'trusted_run_not_found: kjøringen finnes ikke for firmaet eller pågår ikke' using errcode = 'no_data_found';
  end if;
end
$$;

create function private.trusted_fail_run(p_dealership_id uuid, p_run_id uuid, p_error_code text) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.search_runs set status = 'failed', error_code = p_error_code
  where id = p_run_id and dealership_id = p_dealership_id and status = 'running';
  if not found then
    raise exception 'trusted_run_not_found: kjøringen finnes ikke for firmaet eller pågår ikke' using errcode = 'no_data_found';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 6. Retensjon: sletting av utløpte kjøringer og resultater (kan kalles manuelt; planlegging kommer senere)
-- ---------------------------------------------------------------------------
create function private.purge_expired_search_runs(p_batch integer default 500, out runs_deleted integer, out results_deleted integer)
language plpgsql security definer set search_path = ''
as $$
declare
  ids uuid[];
begin
  if p_batch is null or p_batch < 1 or p_batch > 5000 then
    raise exception 'purge_invalid_batch: batch må være 1–5000' using errcode = 'invalid_parameter_value';
  end if;
  -- En utløpt kjøring som henger i running avsluttes først, slik at den kan slettes.
  update public.search_runs set status = 'failed', error_code = 'abandoned'
  where status = 'running' and expires_at <= now() and started_at < now() - interval '5 minutes';

  select coalesce(array_agg(s.id), '{}') into ids from (
    select id from public.search_runs
    where expires_at <= now() and status <> 'running'
    order by expires_at
    limit p_batch
    for update skip locked) s;

  delete from public.search_run_results where search_run_id = any(ids);
  get diagnostics results_deleted = row_count;
  delete from public.search_runs where id = any(ids);
  get diagnostics runs_deleted = row_count;
end
$$;

-- ---------------------------------------------------------------------------
-- 7. Rettigheter og RLS
-- ---------------------------------------------------------------------------
-- Brukere kan starte en kjøring, men ikke skrive resultater eller avslutte den (forfalskning av autoritative resultater).
revoke update (status, counts, error_code) on public.search_runs from authenticated;
revoke insert (search_run_id, source, source_listing_id, content_hash, rank, match_status, unknown_criteria, listing_snapshot)
  on public.search_run_results from authenticated;
drop policy search_runs_update_own on public.search_runs;
drop policy search_run_results_insert_own on public.search_run_results;

-- Data utenfor retensjon er usynlig umiddelbart, også før den er slettet.
drop policy search_runs_select_own on public.search_runs;
create policy search_runs_select_own on public.search_runs
  for select to authenticated using (dealership_id in (select private.my_dealership_ids()) and expires_at > now());
drop policy search_run_results_select_own on public.search_run_results;
create policy search_run_results_select_own on public.search_run_results
  for select to authenticated using (dealership_id in (select private.my_dealership_ids()) and expires_at > now());

-- Nye funksjoner er ikke kjørbare av ordinære roller (default privileges kan gi authenticated/service_role execute).
revoke execute on all functions in schema private from public, anon;
revoke execute on function
  private.rights_profiles_guard(), private.rights_profile_in_force(text, timestamptz),
  private.trusted_run_policy(uuid, uuid), private.trusted_store_results(uuid, uuid, jsonb),
  private.trusted_complete_run(uuid, uuid, jsonb), private.trusted_fail_run(uuid, uuid, text),
  private.purge_expired_search_runs(integer)
from public, anon, authenticated, service_role;

grant usage on schema private to scout_ingest;
grant execute on function
  private.trusted_run_policy(uuid, uuid), private.trusted_store_results(uuid, uuid, jsonb),
  private.trusted_complete_run(uuid, uuid, jsonb), private.trusted_fail_run(uuid, uuid, text),
  private.purge_expired_search_runs(integer)
to scout_ingest;

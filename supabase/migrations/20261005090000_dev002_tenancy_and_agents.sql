-- DEV-002: firma (tenant), medlemskap og søkeagenter med RLS.
--
-- Kilde: DATABASE_SCHEMA.md (dealerships, dealership_members, search_agents).
-- Øvrige tabeller i den logiske modellen lages i oppgavene som tar dem i bruk.
--
-- Prinsipper:
-- * RLS på alle tabeller. Ordinær bruker (rolle authenticated) ser og endrer bare
--   data for firmaet i sitt medlemskap. anon har ingen tilgang.
-- * Medlemskap og firma opprettes bare av kontrollert administrasjon (private.*),
--   aldri fra nettleseren.
-- * Maks 10 aktive agenter per firma håndheves atomisk i databasen (DEC-003).
-- * Penger i JSON: {"amountMinor": "<heltall som tekst>", "currency": "XXX"}, maks
--   2^53-1 (DEC-020, DEV-001 review R5).

create schema if not exists private;
revoke all on schema private from public;
alter default privileges in schema private revoke execute on functions from public;

-- ---------------------------------------------------------------------------
-- Tabeller
-- ---------------------------------------------------------------------------

create table public.dealerships (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 200),
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  created_at timestamptz not null default now()
);

-- MVP: én membership per bruker (user_id er primærnøkkel).
create table public.dealership_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  dealership_id uuid not null references public.dealerships (id) on delete restrict,
  created_at timestamptz not null default now()
);
create index dealership_members_dealership_id_idx on public.dealership_members (dealership_id);

-- Penge-JSON ved databasegrensen. Beløpet er tekst for å unngå presisjonstap i
-- JSON/JavaScript, og begrenses til 2^53-1 slik at domenet kan bruke number trygt.
create function private.is_money_json(j jsonb) returns boolean
language sql immutable parallel safe set search_path = ''
as $$
  select case
    when j is null or jsonb_typeof(j) <> 'object' then false
    when (select count(*) from jsonb_object_keys(j)) <> 2 then false
    when jsonb_typeof(j -> 'amountMinor') <> 'string' or jsonb_typeof(j -> 'currency') <> 'string' then false
    when (j ->> 'amountMinor') !~ '^[1-9][0-9]{0,15}$' then false
    when (j ->> 'currency') !~ '^[A-Z]{3}$' then false
    else (j ->> 'amountMinor')::bigint <= 9007199254740991
  end
$$;

-- Felt som kan inneholde penger i agentens JSON. Fravær eller JSON-null er lov.
create function private.agent_money_valid(filters jsonb, assumptions jsonb) returns boolean
language sql immutable parallel safe set search_path = ''
as $$
  select bool_and(v is null or jsonb_typeof(v) = 'null' or private.is_money_json(v))
  from (values
    (filters -> 'maxPrice'),
    (assumptions -> 'retail' -> 'expectedRetailTotal'),
    (assumptions -> 'minimumContribution'),
    (assumptions -> 'preparationReserve')
  ) as t(v)
$$;

create table public.search_agents (
  id uuid primary key default gen_random_uuid(),
  dealership_id uuid not null references public.dealerships (id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  filters jsonb not null default '{}'::jsonb check (jsonb_typeof(filters) = 'object'),
  assumptions jsonb not null default '{}'::jsonb check (jsonb_typeof(assumptions) = 'object'),
  active boolean not null default false,
  version integer not null default 1 check (version >= 1),
  last_success_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Gjør det mulig for senere tabeller (opportunities m.fl.) å bruke sammensatt FK
  -- (agent_id, dealership_id) slik at en agent ikke kan kobles til et annet firma.
  constraint search_agents_id_dealership_key unique (id, dealership_id),
  constraint search_agents_money_format check (private.agent_money_valid(filters, assumptions))
);
create index search_agents_dealership_id_idx on public.search_agents (dealership_id);
create index search_agents_active_idx on public.search_agents (dealership_id) where active;

-- ---------------------------------------------------------------------------
-- Triggere: versjon, tidsstempler, firmabytte og aktiv-grense
-- ---------------------------------------------------------------------------

create function private.search_agents_before_write() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.version := 1;
    new.created_at := now();
    new.updated_at := now();
    return new;
  end if;

  if new.dealership_id is distinct from old.dealership_id then
    raise exception 'search_agents.dealership_id kan ikke endres' using errcode = 'check_violation';
  end if;
  new.created_at := old.created_at;
  if (new.name, new.filters, new.assumptions, new.active) is distinct from (old.name, old.filters, old.assumptions, old.active) then
    new.version := old.version + 1;
    new.updated_at := now();
  else
    new.version := old.version;
    new.updated_at := old.updated_at;
  end if;
  return new;
end
$$;

create trigger search_agents_before_write
before insert or update on public.search_agents
for each row execute function private.search_agents_before_write();

-- Atomisk grense: låser firmaraden før telling, slik at samtidige aktiveringer i
-- samme firma serialiseres. Den som venter teller på nytt etter at den andre har
-- committet (READ COMMITTED gir nytt snapshot per setning i plpgsql). Under
-- REPEATABLE READ/SERIALIZABLE gir konflikten serialiseringsfeil i stedet.
-- SECURITY DEFINER fordi telling og lås må se alle agenter i firmaet uavhengig av
-- RLS; funksjonen gjør ingenting annet.
create function private.enforce_active_agent_limit() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  active_count integer;
begin
  if not new.active then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.active then
    return new;
  end if;

  perform 1 from public.dealerships where id = new.dealership_id for no key update;

  select count(*) into active_count
  from public.search_agents
  where dealership_id = new.dealership_id and active and id <> new.id;

  if active_count >= 10 then
    raise exception 'active_agent_limit: maks 10 aktive agenter per firma'
      using errcode = 'check_violation', hint = 'Pause en annen agent før denne aktiveres.';
  end if;
  return new;
end
$$;

create trigger search_agents_active_limit
before insert or update of active on public.search_agents
for each row execute function private.enforce_active_agent_limit();

-- ---------------------------------------------------------------------------
-- Rettigheter og RLS
-- ---------------------------------------------------------------------------

-- Supabase gir anon/authenticated alle rettigheter på nye tabeller som standard.
revoke all on public.dealerships, public.dealership_members, public.search_agents from public, anon, authenticated;

grant usage on schema private to authenticated;

-- Firma-ID-er for innlogget bruker. SECURITY DEFINER for å unngå rekursiv RLS.
create function private.my_dealership_ids() returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select dealership_id from public.dealership_members where user_id = (select auth.uid())
$$;

revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.my_dealership_ids() to authenticated;
-- Brukes av CHECK-constraint og må kunne kjøres av den som skriver.
grant execute on function private.is_money_json(jsonb) to authenticated;
grant execute on function private.agent_money_valid(jsonb, jsonb) to authenticated;

alter table public.dealerships enable row level security;
alter table public.dealership_members enable row level security;
alter table public.search_agents enable row level security;

grant select on public.dealerships to authenticated;
grant select on public.dealership_members to authenticated;
grant select on public.search_agents to authenticated;
-- Kolonnevise rettigheter: version, last_success_at og tidsstempler settes av databasen/serverjobber.
grant insert (dealership_id, name, filters, assumptions, active) on public.search_agents to authenticated;
grant update (name, filters, assumptions, active) on public.search_agents to authenticated;
-- Ingen DELETE i MVP (pause erstatter sletting, DEV-004).

create policy dealerships_select_own on public.dealerships
  for select to authenticated
  using (id in (select private.my_dealership_ids()));

create policy dealership_members_select_self on public.dealership_members
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy search_agents_select_own on public.search_agents
  for select to authenticated
  using (dealership_id in (select private.my_dealership_ids()));

create policy search_agents_insert_own on public.search_agents
  for insert to authenticated
  with check (dealership_id in (select private.my_dealership_ids()));

create policy search_agents_update_own on public.search_agents
  for update to authenticated
  using (dealership_id in (select private.my_dealership_ids()))
  with check (dealership_id in (select private.my_dealership_ids()));

-- ---------------------------------------------------------------------------
-- Kontrollert administrasjon (kjøres av prosjekteier i SQL-editor / psql)
-- ---------------------------------------------------------------------------

create function private.admin_create_dealership(p_name text) returns uuid
language sql set search_path = ''
as $$
  insert into public.dealerships (name) values (p_name) returning id
$$;

create function private.admin_add_member(p_user_email text, p_dealership_id uuid) returns void
language plpgsql set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  select id into v_user_id from auth.users where lower(email) = lower(p_user_email);
  if v_user_id is null then
    raise exception 'Fant ingen Auth-bruker med e-post %', p_user_email;
  end if;
  insert into public.dealership_members (user_id, dealership_id) values (v_user_id, p_dealership_id);
end
$$;

revoke execute on function private.admin_create_dealership(text) from public, anon, authenticated, service_role;
revoke execute on function private.admin_add_member(text, uuid) from public, anon, authenticated, service_role;

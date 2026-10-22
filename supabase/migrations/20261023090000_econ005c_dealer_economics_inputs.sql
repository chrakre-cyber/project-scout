-- ECON-005c: forhandlerens egne opplysninger til økonomiberegningen, bundet til firma, søk, kandidat og revisjon (plan P2/E5), samt firmaets standardprofil
-- (mva.-håndtering og fradragsstatus; standard ukjent).
--
-- Lagrer BARE forhandlerinput og bekreftelseskonteksten (kostnadsgrunnlag, planlagt scenario, rettighetsavtrykk) — aldri avledede beregningsresultater (E9) og aldri
-- annonse-/leverandørdata. Nytt og adskilt: ingen eksisterende tabell, constraint, trigger, policy eller funksjon endres.
--
-- HVA DATABASEN GARANTERER: firmabinding (firma settes av databasen fra membership, aldri fra klienten; søket må tilhøre samme firma via sammensatt FK mot
--   search_drafts(id, dealership_id)); nøkkelen (firma, søk, kandidat, revisjon, schemaversjon) er unik; payload er et objekt med bare kjente toppnøkler, riktig
--   schemaversjon og størrelse ≤ 16 000 byte; konteksten har nøyaktig tre felt; bekreftelsesbruker og -tidspunkt settes av databasen; nøkkelkolonnene er uforanderlige;
--   RLS: bare eget firma kan leses/opprettes/endres, ingen anon, ingen sletting, ingen service-role.
-- HVA DATABASEN IKKE GARANTERER: dyp semantikk i payload (beløpsformat, datoer, grunnlagsverdier, kurser). Serveren validerer hele dokumentet (`parseDealerInput`) før
--   hver lagring og når et lagret dokument leses; databasen er en strukturgrense, ikke eneste forsvar.

-- ---------------------------------------------------------------------------
-- Strukturvalidering (kun CHECK; totale: alltid true/false)
-- ---------------------------------------------------------------------------
create function private.dealer_input_payload_valid(j jsonb) returns boolean
language sql immutable parallel safe set search_path = ''
as $$
  select coalesce(
    case when j is null or jsonb_typeof(j) <> 'object' then false
    else
      not exists (select 1 from jsonb_object_keys(j) k where k not in (
        'schemaVersion','propulsion','taxWeight','co2','firstRegistration','norwegianRegistration','customsDate','foreignVat','fx','transportToBorder',
        'transportAfterBorder','loadingHandling','insurance','climateGas','registrationFee','deduction','vatHandling','lineScopes','evidenceRef'))
      and j -> 'schemaVersion' = '1'::jsonb
      and not exists (select 1 from jsonb_each(j) e where e.key in ('propulsion','taxWeight','co2','firstRegistration','norwegianRegistration','customsDate','foreignVat','fx',
        'transportToBorder','transportAfterBorder','loadingHandling','insurance','climateGas','registrationFee','lineScopes') and jsonb_typeof(e.value) <> 'object')
      and (not j ? 'deduction' or j ->> 'deduction' in ('recoverable','non_recoverable','unknown'))
      and (not j ? 'vatHandling' or j ->> 'vatHandling' in ('registered_reports_in_vat_return','not_registered_pays_at_import','unknown'))
      and (not j ? 'evidenceRef' or (jsonb_typeof(j -> 'evidenceRef') = 'string' and char_length(j ->> 'evidenceRef') between 1 and 200))
    end, false)
$$;

create function private.dealer_input_context_valid(j jsonb) returns boolean
language sql immutable parallel safe set search_path = ''
as $$
  select coalesce(
    case when j is null or jsonb_typeof(j) <> 'object' then false
    else (select count(*) from jsonb_object_keys(j)) = 3
      and j ? 'costBasis' and j ? 'registrationScenario' and j ? 'rightsDigest'
      and jsonb_typeof(j -> 'costBasis') = 'string' and char_length(j ->> 'costBasis') <= 10000
      and j ->> 'registrationScenario' in ('passenger','van','unspecified')
      and jsonb_typeof(j -> 'rightsDigest') = 'string' and (j ->> 'rightsDigest') ~ '^[0-9a-f]{64}$'
    end, false)
$$;

create function private.dealer_profile_payload_valid(j jsonb) returns boolean
language sql immutable parallel safe set search_path = ''
as $$
  select coalesce(
    case when j is null or jsonb_typeof(j) <> 'object' then false
    else not exists (select 1 from jsonb_object_keys(j) k where k not in ('schemaVersion','vatHandling','deduction'))
      and j -> 'schemaVersion' = '1'::jsonb
      and (not j ? 'vatHandling' or j ->> 'vatHandling' in ('registered_reports_in_vat_return','not_registered_pays_at_import','unknown'))
      and (not j ? 'deduction' or j ->> 'deduction' in ('recoverable','non_recoverable','unknown'))
    end, false)
$$;

-- ---------------------------------------------------------------------------
-- Forhandlerinput per (firma, søk, kandidat, revisjon, schemaversjon)
-- ---------------------------------------------------------------------------
create table public.dealer_economics_inputs (
  id uuid primary key default gen_random_uuid(),
  dealership_id uuid not null,
  search_id uuid not null,
  candidate_id text not null check (char_length(candidate_id) between 1 and 300 and candidate_id !~ '[[:cntrl:]]'),
  candidate_version text not null check (char_length(candidate_version) between 1 and 100 and candidate_version !~ '[[:cntrl:]]'),
  input_schema_version integer not null check (input_schema_version = 1),
  payload jsonb not null check (private.dealer_input_payload_valid(payload) is true and octet_length(payload::text) <= 16000),
  context jsonb not null check (private.dealer_input_context_valid(context) is true),
  confirmed_by uuid,
  confirmed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Søket må tilhøre samme firma: sammensatt FK mot search_drafts (id, dealership_id). Feilen er den samme for ukjent søk og søk i et annet firma.
  constraint dealer_economics_inputs_search_fk foreign key (search_id, dealership_id) references public.search_drafts (id, dealership_id) on delete restrict,
  constraint dealer_economics_inputs_key unique (dealership_id, search_id, candidate_id, candidate_version, input_schema_version)
);

create function private.dealer_economics_inputs_before_insert() returns trigger
language plpgsql set search_path = ''
as $$
declare uid uuid := (select auth.uid());
begin
  if uid is not null then
    new.dealership_id := (select dm.dealership_id from public.dealership_members dm where dm.user_id = uid);
  end if;
  if new.dealership_id is null then
    raise exception 'new row violates row-level security policy for table "dealer_economics_inputs"' using errcode = 'insufficient_privilege';
  end if;
  new.confirmed_by := uid;
  new.confirmed_at := now();
  new.created_at := now();
  new.updated_at := now();
  return new;
end
$$;
create trigger dealer_economics_inputs_before_insert before insert on public.dealer_economics_inputs
for each row execute function private.dealer_economics_inputs_before_insert();

create function private.dealer_economics_inputs_before_update() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if (new.id, new.dealership_id, new.search_id, new.candidate_id, new.candidate_version, new.input_schema_version, new.created_at)
     is distinct from (old.id, old.dealership_id, old.search_id, old.candidate_id, old.candidate_version, old.input_schema_version, old.created_at) then
    raise exception 'dealer_input_immutable: nøkkelen (firma, søk, kandidat, revisjon, schemaversjon) kan ikke endres' using errcode = 'check_violation';
  end if;
  if (new.payload, new.context) is distinct from (old.payload, old.context) then
    -- En endring er en ny bekreftelse: bruker og tidspunkt settes av databasen.
    new.confirmed_by := (select auth.uid());
    new.confirmed_at := now();
    new.updated_at := now();
  else
    new.confirmed_by := old.confirmed_by;
    new.confirmed_at := old.confirmed_at;
    new.updated_at := old.updated_at;
  end if;
  return new;
end
$$;
create trigger dealer_economics_inputs_before_update before update on public.dealer_economics_inputs
for each row execute function private.dealer_economics_inputs_before_update();

-- ---------------------------------------------------------------------------
-- Firmaets standardprofil (mva.-håndtering og fradragsstatus): én rad per firma
-- ---------------------------------------------------------------------------
create table public.dealer_economics_profiles (
  dealership_id uuid primary key references public.dealerships (id) on delete restrict,
  payload jsonb not null check (private.dealer_profile_payload_valid(payload) is true),
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function private.dealer_economics_profiles_before_insert() returns trigger
language plpgsql set search_path = ''
as $$
declare uid uuid := (select auth.uid());
begin
  if uid is not null then
    new.dealership_id := (select dm.dealership_id from public.dealership_members dm where dm.user_id = uid);
  end if;
  if new.dealership_id is null then
    raise exception 'new row violates row-level security policy for table "dealer_economics_profiles"' using errcode = 'insufficient_privilege';
  end if;
  new.updated_by := uid; new.created_at := now(); new.updated_at := now();
  return new;
end
$$;
create trigger dealer_economics_profiles_before_insert before insert on public.dealer_economics_profiles
for each row execute function private.dealer_economics_profiles_before_insert();

create function private.dealer_economics_profiles_before_update() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if (new.dealership_id, new.created_at) is distinct from (old.dealership_id, old.created_at) then
    raise exception 'dealer_profile_immutable: firma kan ikke endres' using errcode = 'check_violation';
  end if;
  if new.payload is distinct from old.payload then
    new.updated_by := (select auth.uid()); new.updated_at := now();
  else
    new.updated_by := old.updated_by; new.updated_at := old.updated_at;
  end if;
  return new;
end
$$;
create trigger dealer_economics_profiles_before_update before update on public.dealer_economics_profiles
for each row execute function private.dealer_economics_profiles_before_update();

-- ---------------------------------------------------------------------------
-- Rettigheter og RLS: eget firma, ingen anon, ingen sletting
-- ---------------------------------------------------------------------------
revoke all on public.dealer_economics_inputs, public.dealer_economics_profiles from public, anon, authenticated;
alter table public.dealer_economics_inputs enable row level security;
alter table public.dealer_economics_profiles enable row level security;

grant select on public.dealer_economics_inputs to authenticated;
-- Klienten oppgir bare nøkkel (søk, kandidat, revisjon, schemaversjon) og innhold. Firma, bruker, tidspunkt og id settes av databasen.
grant insert (search_id, candidate_id, candidate_version, input_schema_version, payload, context) on public.dealer_economics_inputs to authenticated;
grant update (payload, context) on public.dealer_economics_inputs to authenticated;
grant select on public.dealer_economics_profiles to authenticated;
grant insert (payload) on public.dealer_economics_profiles to authenticated;
grant update (payload) on public.dealer_economics_profiles to authenticated;

create policy dealer_economics_inputs_select_own on public.dealer_economics_inputs
  for select to authenticated using (dealership_id in (select private.my_dealership_ids()));
create policy dealer_economics_inputs_insert_own on public.dealer_economics_inputs
  for insert to authenticated with check (dealership_id in (select private.my_dealership_ids()));
create policy dealer_economics_inputs_update_own on public.dealer_economics_inputs
  for update to authenticated using (dealership_id in (select private.my_dealership_ids())) with check (dealership_id in (select private.my_dealership_ids()));
create policy dealer_economics_profiles_select_own on public.dealer_economics_profiles
  for select to authenticated using (dealership_id in (select private.my_dealership_ids()));
create policy dealer_economics_profiles_insert_own on public.dealer_economics_profiles
  for insert to authenticated with check (dealership_id in (select private.my_dealership_ids()));
create policy dealer_economics_profiles_update_own on public.dealer_economics_profiles
  for update to authenticated using (dealership_id in (select private.my_dealership_ids())) with check (dealership_id in (select private.my_dealership_ids()));

-- CHECK-funksjonene må kunne kjøres av den som skriver; triggerfunksjonene trenger ingen EXECUTE for brukere.
revoke execute on function private.dealer_input_payload_valid(jsonb), private.dealer_input_context_valid(jsonb), private.dealer_profile_payload_valid(jsonb) from public, anon, service_role;
grant execute on function private.dealer_input_payload_valid(jsonb), private.dealer_input_context_valid(jsonb), private.dealer_profile_payload_valid(jsonb) to authenticated;
revoke execute on function
  private.dealer_economics_inputs_before_insert(), private.dealer_economics_inputs_before_update(),
  private.dealer_economics_profiles_before_insert(), private.dealer_economics_profiles_before_update()
from public, anon, authenticated, service_role;

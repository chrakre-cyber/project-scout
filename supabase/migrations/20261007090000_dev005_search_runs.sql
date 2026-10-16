-- DEV-005: manuelle søkekjøringer for aktive agenter mot MarketplaceProvider, med lagret kriteriesnapshot og
-- resultatsnapshot per kjøring. Tabellene er tenant-isolert med RLS; ingen service-role i appflyten.
--
-- Avgrensning mot DATABASE_SCHEMA (DEC-026): `search_runs` følger skjemaet (finished_at, counts, error_code),
-- men checkpoint-kolonner, `listings`/`listing_revisions` og `agent_locks` er utsatt (planlagte kjøringer, DEV-013,
-- og rettighetsavklaring BUS-002/DEC-015). Revisjon identifiseres av `content_hash` i resultatsnapshotet.
--
-- Prinsipper:
--  * DB-triggerne avgjør alt som ikke kan stoles på fra klienten: firma, agentversjon, kriteriesnapshot, status
--    og tidsstempler. Klienten oppgir bare agent_id, request_token og forventet agentversjon.
--  * Fremmed eller ukjent agent/kjøring gir samme 42501 som RLS, før noe annet avsløres (jf. QA-001 F1).
--  * Én `running` per agent (delvis unik indeks) og unik (agent_id, request_token) gir idempotens ved dobbeltklikk.
--  * En kjøring som henger i `running` over 5 minutter settes til `failed/abandoned` neste gang agenten kjøres.
--  * Ingen matchinglogikk i databasen: treffene bestemmes av domenelaget og lagres bare.

-- ---------------------------------------------------------------------------
-- Hjelpefunksjon: gyldige tellere
-- ---------------------------------------------------------------------------
create function private.search_run_counts_valid(c jsonb) returns boolean
language sql immutable parallel safe set search_path = ''
as $$
  select coalesce(
    jsonb_typeof(c) = 'object'
    and private.keys_subset(c, array['sourceTotal','fetched','matches','needsReview','excluded','rejected','duplicates','pages','truncated'])
    and not exists (
      select 1 from jsonb_each(c) e
      where e.key <> 'truncated' and not (jsonb_typeof(e.value) = 'number' and (e.value #>> '{}') ~ '^[0-9]{1,9}$'))
    and (c -> 'truncated' is null or jsonb_typeof(c -> 'truncated') = 'boolean'),
    false)
$$;

-- ---------------------------------------------------------------------------
-- Tabeller
-- ---------------------------------------------------------------------------
create table public.search_runs (
  id uuid primary key default gen_random_uuid(),
  dealership_id uuid not null references public.dealerships (id) on delete restrict,
  agent_id uuid not null,
  -- Agentens versjon og kriterier slik de var da kjøringen startet (satt av databasen).
  agent_version integer not null check (agent_version >= 1),
  requested_agent_version integer check (requested_agent_version >= 1),
  request_token uuid not null,
  provider text not null check (provider in ('synthetic-demo')),
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  criteria_snapshot jsonb not null check (jsonb_typeof(criteria_snapshot) = 'object' and octet_length(criteria_snapshot::text) <= 20000),
  counts jsonb check (counts is null or private.search_run_counts_valid(counts)),
  error_code text check (error_code is null or error_code in
    ('authentication', 'forbidden', 'rate_limit', 'invalid_query', 'timeout', 'unavailable', 'malformed_data', 'abandoned', 'internal')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  constraint search_runs_agent_fkey foreign key (agent_id, dealership_id) references public.search_agents (id, dealership_id) on delete restrict,
  constraint search_runs_id_dealership_key unique (id, dealership_id),
  constraint search_runs_token_key unique (agent_id, request_token),
  constraint search_runs_finished_consistent check ((status = 'running') = (finished_at is null)),
  constraint search_runs_error_consistent check ((status = 'failed') = (error_code is not null)),
  constraint search_runs_completed_has_counts check (status <> 'completed' or counts is not null)
);
create unique index search_runs_one_running_per_agent on public.search_runs (agent_id) where status = 'running';
create index search_runs_agent_started_idx on public.search_runs (agent_id, started_at desc);
create index search_runs_dealership_idx on public.search_runs (dealership_id);

create table public.search_run_results (
  id uuid primary key default gen_random_uuid(),
  search_run_id uuid not null,
  dealership_id uuid not null,
  source text not null check (source in ('synthetic-demo')),
  source_listing_id text not null check (char_length(source_listing_id) between 1 and 200),
  -- Revisjonsidentitet: sha256 over kanonisk JSON av hele den normaliserte annonsen på kjøretidspunktet.
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  rank integer not null check (rank between 1 and 2000),
  match_status text not null check (match_status in ('match', 'needs_review')),
  -- Kriterier som ikke kunne avgjøres (ukjent verdi hos kilden). Tom liste = bekreftet treff.
  unknown_criteria jsonb not null default '[]'::jsonb check (
    private.opt_enum_array(unknown_criteria, array['make','model','variant','year','mileage','fuel','transmission','bodyType','country','price'])
    and jsonb_typeof(unknown_criteria) = 'array'
    and ((match_status = 'match') = (jsonb_array_length(unknown_criteria) = 0))),
  -- Minimalt snapshot (ingen annonsetekst eller selgerdetaljer), se src/domain/search-run.ts.
  listing_snapshot jsonb not null check (coalesce(
    jsonb_typeof(listing_snapshot) = 'object'
    and octet_length(listing_snapshot::text) <= 8000
    and listing_snapshot ->> 'sourceListingId' = source_listing_id
    and listing_snapshot ->> 'source' = source, false)),
  created_at timestamptz not null default now(),
  constraint search_run_results_run_fkey foreign key (search_run_id, dealership_id) references public.search_runs (id, dealership_id) on delete restrict,
  constraint search_run_results_listing_key unique (search_run_id, source, source_listing_id),
  constraint search_run_results_rank_key unique (search_run_id, rank)
);
create index search_run_results_dealership_idx on public.search_run_results (dealership_id);

-- ---------------------------------------------------------------------------
-- Triggere
-- ---------------------------------------------------------------------------
create function private.search_runs_before_insert() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  a public.search_agents%rowtype;
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

  -- Selvhelbredelse: en kjøring som henger i running (prosess døde) slippes slik at agenten kan kjøres igjen.
  update public.search_runs r set status = 'failed', error_code = 'abandoned'
  where r.agent_id = a.id and r.status = 'running' and r.started_at < now() - interval '5 minutes';

  -- Alt som ikke kan stoles på fra klienten settes her.
  new.dealership_id := a.dealership_id;
  new.agent_version := a.version;
  new.criteria_snapshot := jsonb_build_object(
    'schemaVersion', 1, 'agentName', a.name, 'filters', a.filters, 'assumptions', a.assumptions);
  new.status := 'running';
  new.counts := null;
  new.error_code := null;
  new.started_at := now();
  new.finished_at := null;
  new.created_at := now();
  return new;
end
$$;
create trigger search_runs_before_insert before insert on public.search_runs
for each row execute function private.search_runs_before_insert();

create function private.search_runs_before_update() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  stored integer;
  m integer;
  nr integer;
begin
  if old.status <> 'running' then
    raise exception 'search_run_invalid_transition: en avsluttet kjøring kan ikke endres' using errcode = 'check_violation';
  end if;
  if new.status not in ('completed', 'failed') then
    raise exception 'search_run_invalid_transition: kjøringen kan bare gå fra running til completed eller failed' using errcode = 'check_violation';
  end if;
  if (new.id, new.dealership_id, new.agent_id, new.agent_version, new.requested_agent_version, new.request_token,
      new.provider, new.criteria_snapshot, new.started_at, new.created_at)
     is distinct from
     (old.id, old.dealership_id, old.agent_id, old.agent_version, old.requested_agent_version, old.request_token,
      old.provider, old.criteria_snapshot, old.started_at, old.created_at) then
    raise exception 'search_run_immutable: kriterier, agent og tidspunkt kan ikke endres' using errcode = 'check_violation';
  end if;

  if new.status = 'completed' then
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
create trigger search_runs_before_update before update on public.search_runs
for each row execute function private.search_runs_before_update();

create function private.search_run_results_before_insert() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  r public.search_runs%rowtype;
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
  new.dealership_id := r.dealership_id;
  new.created_at := now();
  return new;
end
$$;
create trigger search_run_results_before_insert before insert on public.search_run_results
for each row execute function private.search_run_results_before_insert();

-- ---------------------------------------------------------------------------
-- Rettigheter og RLS
-- ---------------------------------------------------------------------------
revoke all on public.search_runs, public.search_run_results from public, anon, authenticated;
alter table public.search_runs enable row level security;
alter table public.search_run_results enable row level security;

grant select on public.search_runs, public.search_run_results to authenticated;
-- Kolonnevise rettigheter. Firma, agentversjon, kriterier, status ved opprettelse og tidsstempler settes av databasen.
grant insert (agent_id, request_token, requested_agent_version, provider) on public.search_runs to authenticated;
grant update (status, counts, error_code) on public.search_runs to authenticated;
grant insert (search_run_id, source, source_listing_id, content_hash, rank, match_status, unknown_criteria, listing_snapshot)
  on public.search_run_results to authenticated;
-- Ingen DELETE og ingen UPDATE på resultater: en kjøring er et historisk spor.

create policy search_runs_select_own on public.search_runs
  for select to authenticated using (dealership_id in (select private.my_dealership_ids()));
create policy search_runs_insert_own on public.search_runs
  for insert to authenticated with check (dealership_id in (select private.my_dealership_ids()));
create policy search_runs_update_own on public.search_runs
  for update to authenticated
  using (dealership_id in (select private.my_dealership_ids()) and status = 'running')
  with check (dealership_id in (select private.my_dealership_ids()));

create policy search_run_results_select_own on public.search_run_results
  for select to authenticated using (dealership_id in (select private.my_dealership_ids()));
create policy search_run_results_insert_own on public.search_run_results
  for insert to authenticated with check (dealership_id in (select private.my_dealership_ids()));

-- Nye funksjoner er ikke kjørbare av ordinære roller; bare CHECK-hjelperen må kunne kjøres av den som skriver.
revoke execute on all functions in schema private from public, anon;
revoke execute on function private.search_runs_before_insert(), private.search_runs_before_update(),
  private.search_run_results_before_insert() from authenticated;
grant execute on function private.search_run_counts_valid(jsonb) to authenticated;

-- DEV-005B0 review-rettelse (P2): lagrede providerdata skal bare være lesbare mens BEGGE er sant (DEC-028):
--   1. raden har ikke nådd `expires_at`, og
--   2. den tilknyttede rettighetsprofilen er fortsatt `verified` og gjelder nå (innenfor effective_from/effective_to).
-- En trukket (revoked) eller utløpt profil skjuler dermed eksisterende kjøringer og resultater umiddelbart, og
-- `effective_to` virker som øvre grense for synlighet. Konservativ MVP-regel (default-deny).
--
-- Hvorfor ny migrasjon og ikke redigering av 20261008090000: migrasjoner er append-only i dette prosjektet (CLAUDE.md pkt. 8,
-- «ikke endre migrasjoner som allerede er kjørt hosted»), 20261008090000 er allerede levert til og gjennomgått av uavhengig
-- review som en fast artefakt, og en ny migrasjon virker likt enten den eldre er anvendt hosted eller ikke.
--
-- Endringer:
--  * `private.rights_profile_active(profile_id)`: SECURITY DEFINER-boolean brukt av RLS-policyene (ingen tabelltilgang for brukere).
--  * SELECT-policyene på search_runs og search_run_results krever aktiv profil (resultater via sin synlige kjøring).
--  * `expires_at` for nye kjøringer kappes ved profilens `effective_to`.
--  * `trusted_run_policy` nekter en kjøring hvis profilen ikke lenger gjelder, før providerbehandling starter.
--  * `purge_expired_search_runs` fjerner også rader som ikke lenger er tillatt synlige (profil trukket/utløpt);
--    pågående kjøringer med slik profil avsluttes først som failed/rights_blocked.

-- ---------------------------------------------------------------------------
-- 1. Hjelper: gjelder profilen nå?
-- ---------------------------------------------------------------------------
create function private.rights_profile_active(p_profile_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from private.provider_rights_profiles p
    where p.id = p_profile_id and p.status = 'verified'
      and p.effective_from <= now() and (p.effective_to is null or now() < p.effective_to))
$$;
revoke execute on function private.rights_profile_active(uuid) from public, anon, service_role;
grant execute on function private.rights_profile_active(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Backfill: kapp eksisterende expires_at ved profilens effective_to (der den ligger etter kjøringens start)
-- ---------------------------------------------------------------------------
alter table public.search_runs disable trigger search_runs_before_update;
update public.search_runs r set expires_at = p.effective_to
from private.provider_rights_profiles p
where p.id = r.rights_profile_id and p.effective_to is not null and p.effective_to < r.expires_at and p.effective_to > r.started_at;
alter table public.search_runs enable trigger search_runs_before_update;
update public.search_run_results x set expires_at = r.expires_at
from public.search_runs r
where r.id = x.search_run_id and x.expires_at <> r.expires_at;

-- ---------------------------------------------------------------------------
-- 3. Start av kjøring: retensjonen kan ikke strekke seg forbi effective_to (resten er uendret fra 20261008090000)
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
  -- Retensjonen kan aldri strekke seg forbi profilens slutt (effective_to er eksklusiv og > now() her).
  new.expires_at := least(now() + make_interval(secs => prof.retention_seconds), coalesce(prof.effective_to, 'infinity'::timestamptz));
  new.status := 'running';
  new.counts := null;
  new.error_code := null;
  new.started_at := now();
  new.finished_at := null;
  new.created_at := now();
  return new;
end
$$;

-- ---------------------------------------------------------------------------
-- 4. Betrodd policy: nekt en kjøring hvis profilen ikke lenger gjelder, før providerbehandling starter
-- ---------------------------------------------------------------------------
create or replace function private.trusted_run_policy(p_dealership_id uuid, p_run_id uuid)
returns table (profile_version integer, retention_seconds integer, expires_at timestamptz,
  allow_price boolean, allow_specs boolean, allow_text boolean, allow_images boolean, allow_seller_data boolean)
language plpgsql stable security definer set search_path = ''
as $$
declare
  x record;
begin
  select r.rights_profile_version as v, p.retention_seconds as rs, r.expires_at as ex,
         p.allow_price as ap, p.allow_specs as asp, p.allow_text as at_, p.allow_images as ai, p.allow_seller_data as asd,
         private.rights_profile_active(r.rights_profile_id) as active
  into x
  from public.search_runs r join private.provider_rights_profiles p on p.id = r.rights_profile_id
  where r.id = p_run_id and r.dealership_id = p_dealership_id and r.status = 'running';
  if not found then
    raise exception 'trusted_run_not_found: kjøringen finnes ikke for firmaet eller pågår ikke' using errcode = 'no_data_found';
  end if;
  -- Trukket/utløpt profil eller utløpt kjøring: ingen providerbehandling. Serveren avslutter kjøringen som rights_blocked.
  if not x.active or x.ex <= now() then
    raise exception 'search_run_rights_profile_expired: rettighetsprofilen gjelder ikke lenger, kjøringen kan ikke behandles' using errcode = 'check_violation';
  end if;
  return query select x.v, x.rs, x.ex, x.ap, x.asp, x.at_, x.ai, x.asd;
end
$$;

-- ---------------------------------------------------------------------------
-- 5. Purge: slett også rader som ikke lenger er tillatt synlige (profil trukket/utløpt)
-- ---------------------------------------------------------------------------
create or replace function private.purge_expired_search_runs(p_batch integer default 500, out runs_deleted integer, out results_deleted integer)
language plpgsql security definer set search_path = ''
as $$
declare
  ids uuid[];
begin
  if p_batch is null or p_batch < 1 or p_batch > 5000 then
    raise exception 'purge_invalid_batch: batch må være 1–5000' using errcode = 'invalid_parameter_value';
  end if;
  -- En pågående kjøring hvis profil er trukket/utløpt kan ikke fullføres: avslutt den slik at den kan slettes.
  update public.search_runs set status = 'failed', error_code = 'rights_blocked'
  where status = 'running' and not private.rights_profile_active(rights_profile_id);
  -- En utløpt kjøring som henger i running avsluttes først, slik at den kan slettes.
  update public.search_runs set status = 'failed', error_code = 'abandoned'
  where status = 'running' and expires_at <= now() and started_at < now() - interval '5 minutes';

  select coalesce(array_agg(s.id), '{}') into ids from (
    select id from public.search_runs
    where status <> 'running' and (expires_at <= now() or not private.rights_profile_active(rights_profile_id))
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
-- 6. RLS: lesbart bare mens raden ikke er utløpt OG profilen gjelder (fail closed)
-- ---------------------------------------------------------------------------
drop policy search_runs_select_own on public.search_runs;
create policy search_runs_select_own on public.search_runs
  for select to authenticated using (
    dealership_id in (select private.my_dealership_ids())
    and expires_at > now()
    and private.rights_profile_active(rights_profile_id));

-- Resultater følger sin kjøring: underspørringen er selv underlagt kjøringens policy (firma, utløp og profil).
drop policy search_run_results_select_own on public.search_run_results;
create policy search_run_results_select_own on public.search_run_results
  for select to authenticated using (
    dealership_id in (select private.my_dealership_ids())
    and expires_at > now()
    and search_run_id in (select r.id from public.search_runs r));

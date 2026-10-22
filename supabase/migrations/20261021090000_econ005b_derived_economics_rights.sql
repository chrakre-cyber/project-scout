-- ECON-005b: rettigheter for avledet økonomiberegning (landed cost) som egen rett i den eksisterende rettighetsprofilen.
-- Additiv: ingen ny tabell, ingen endring av RLS, kjøringstriggere, purge, synlighetsregler eller betrodd skriveveg.
--   allow_derived_economics   — per kildefelt (price, registration, specs): kan feltet brukes som input til økonomiberegning?
--   display_derived_economics — separat rett til å VISE det avledede resultatet.
-- Begge er default-deny (alle false). Ingen sandbox-/live-profil får noe automatisk: bare `synthetic-demo` v1 settes eksplisitt til true
-- (backfill in place, samme begrunnelse som DATA-002B: en ny verifisert versjon ville forkortet v1 og skjult eksisterende kjøringer via
-- DEC-028-synlighetsregelen). Etter denne migrasjonen er de nye kolonnene uforanderlige på samme måte som de øvrige rettighetskolonnene.
-- Avledede tall lagres ikke (ECON-005 E9); denne migrasjonen lagrer bare rettigheter. Kildene for økonomiparametere og økonomiflagg berøres ikke.

-- 1. Validering av feltkart: nøyaktig disse nøklene, alle boolske. Funksjonen er TOTAL og returnerer alltid true/false, aldri NULL
--    (en CHECK godtar NULL: `array_agg` over et tomt objekt gir NULL, og NULL = array[...] gir NULL). CASE sikrer at nøkkelfunksjonen
--    bare kalles på objekter; tomt nøkkelsett sammenlignes som tom liste. Constrainten under bruker i tillegg `is true`.
create function private.economics_rights_map_valid(j jsonb) returns boolean
language sql immutable set search_path = ''
as $$
  select coalesce(
    case when j is null or jsonb_typeof(j) <> 'object' then false
         else coalesce((select array_agg(k order by k) from jsonb_object_keys(j) k), array[]::text[]) = array['price','registration','specs']
              and not exists (select 1 from jsonb_each(j) e where jsonb_typeof(e.value) <> 'boolean')
    end,
    false)
$$;
revoke execute on function private.economics_rights_map_valid(jsonb) from public, anon, authenticated, service_role;

-- 2. Nye kolonner (default-deny).
alter table private.provider_rights_profiles
  add column allow_derived_economics jsonb not null default '{"price":false,"registration":false,"specs":false}'::jsonb,
  add column display_derived_economics boolean not null default false;

-- 3. Backfill (vakttriggeren kjenner ikke de nye kolonnene ennå). Alle andre profiler (ingen forventes) beholder default-deny.
update private.provider_rights_profiles
set allow_derived_economics = '{"price":true,"registration":true,"specs":true}'::jsonb,
    display_derived_economics = true
where provider = 'synthetic-demo' and version = 1 and environment = 'synthetic';

alter table private.provider_rights_profiles
  add constraint provider_rights_profiles_economics_valid check (private.economics_rights_map_valid(allow_derived_economics) is true),
  -- Visning av avledet økonomi uten at noe felt kan brukes til beregning er meningsløst og avvises (fail-closed).
  add constraint provider_rights_profiles_economics_display_check check (
    not display_derived_economics or allow_derived_economics <> '{"price":false,"registration":false,"specs":false}'::jsonb);

-- 4. Vakttrigger: de nye kolonnene er uforanderlige (som resten); logikken er ellers identisk med DATA-002B.
create or replace function private.rights_profiles_guard() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if (new.id, new.provider, new.version, new.effective_from, new.retention_seconds, new.allow_price, new.allow_specs,
        new.allow_text, new.allow_images, new.allow_seller_data, new.source_ref, new.created_at,
        new.environment, new.provider_name, new.display_fields, new.matching_fields, new.cache_seconds, new.history_retention_seconds,
        new.multi_customer_reuse, new.re_evaluation_allowed, new.alerts_allowed, new.geography_unrestricted, new.allowed_countries,
        new.attribution_required, new.attribution_text, new.deep_link_required, new.on_revocation,
        new.allow_derived_economics, new.display_derived_economics)
       is distinct from
       (old.id, old.provider, old.version, old.effective_from, old.retention_seconds, old.allow_price, old.allow_specs,
        old.allow_text, old.allow_images, old.allow_seller_data, old.source_ref, old.created_at,
        old.environment, old.provider_name, old.display_fields, old.matching_fields, old.cache_seconds, old.history_retention_seconds,
        old.multi_customer_reuse, old.re_evaluation_allowed, old.alerts_allowed, old.geography_unrestricted, old.allowed_countries,
        old.attribution_required, old.attribution_text, old.deep_link_required, old.on_revocation,
        old.allow_derived_economics, old.display_derived_economics) then
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

-- 5. Beslutningsfunksjoner (speiler TypeScript `canDeriveEconomics` / `canDisplayEconomics`). Fail-closed: ingen profil i kraft, tom/null feltliste,
--    ukjent felt eller manglende rett ⇒ false. Ikke kjørbare av ordinære roller; den betrodde serversiden (ECON-005c) får bruke dem.
create function private.can_derive_economics(p_provider text, p_at timestamptz, p_fields text[]) returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select cardinality(p_fields) > 0
        and not exists (
          select 1 from unnest(p_fields) f
          where f is null or f not in ('price','registration','specs') or coalesce((pr.allow_derived_economics ->> f)::boolean, false) is not true)
     from private.rights_profile_in_force(p_provider, p_at) pr),
    false)
$$;

create function private.can_display_economics(p_provider text, p_at timestamptz, p_fields text[], p_reveals text[]) returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select private.can_derive_economics(p_provider, p_at, p_fields)
        and pr.display_derived_economics
        and p_reveals is not null
        and not exists (
          select 1 from unnest(p_reveals) k
          where k is null or coalesce((pr.display_fields ->> k)::boolean, false) is not true)
     from private.rights_profile_in_force(p_provider, p_at) pr),
    false)
$$;

revoke execute on function private.can_derive_economics(text, timestamptz, text[]) from public, anon, authenticated, service_role;
revoke execute on function private.can_display_economics(text, timestamptz, text[], text[]) from public, anon, authenticated, service_role;

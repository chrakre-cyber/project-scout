-- DATA-002B: utvider `private.provider_rights_profiles` (DEV-005B0, DEC-028) til én samlet rettighetsprofil for
-- lagring, visning og bruk. Additiv: ingen ny tabell, ingen endring av RLS, kjøringstriggere, purge eller betrodd skriveveg.
-- Alle nye kolonner er default-deny (false / 0 / tom). Eksisterende kolonner (`retention_seconds`, `allow_*`) er fortsatt
-- LAGRINGSRETTEN. `display_fields` («kan vises») og `matching_fields` («kan brukes internt til vurdering») er adskilte rettigheter.
-- Ingen ekstern leverandør er koblet til; bare `synthetic-demo` v1 backfylles (in place, ikke ny versjon: en ny verifisert versjon
-- ville krevd å forkorte v1, og eksisterende kjøringer ville da blitt skjult av synlighetsregelen i DEC-028).

-- ---------------------------------------------------------------------------
-- 1. Validering av feltkart (nøyaktig disse nøklene, alle boolske)
-- ---------------------------------------------------------------------------
create function private.rights_field_map_valid(j jsonb) returns boolean
language sql immutable set search_path = ''
as $$
  select j is not null
    and jsonb_typeof(j) = 'object'
    and (select array_agg(k order by k) from jsonb_object_keys(j) k) = array[
      'images','listing_dates','listing_id','mileage','price','provider_identity','registration','seller_identity',
      'seller_location','source_url','specs','text','title']
    and not exists (select 1 from jsonb_each(j) e where jsonb_typeof(e.value) <> 'boolean')
$$;
revoke execute on function private.rights_field_map_valid(jsonb) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Nye kolonner (default-deny)
-- ---------------------------------------------------------------------------
alter table private.provider_rights_profiles
  add column environment text,
  add column provider_name text,
  add column display_fields jsonb not null default
    '{"title":false,"price":false,"mileage":false,"registration":false,"specs":false,"text":false,"seller_identity":false,"seller_location":false,"images":false,"provider_identity":false,"source_url":false,"listing_id":false,"listing_dates":false}'::jsonb,
  add column matching_fields jsonb not null default
    '{"title":false,"price":false,"mileage":false,"registration":false,"specs":false,"text":false,"seller_identity":false,"seller_location":false,"images":false,"provider_identity":false,"source_url":false,"listing_id":false,"listing_dates":false}'::jsonb,
  add column cache_seconds integer not null default 0 check (cache_seconds between 0 and 315360000),
  add column history_retention_seconds integer not null default 0 check (history_retention_seconds between 0 and 315360000),
  add column multi_customer_reuse boolean not null default false,
  add column re_evaluation_allowed boolean not null default false,
  add column alerts_allowed boolean not null default false,
  add column geography_unrestricted boolean not null default false,
  add column allowed_countries text[] not null default '{}',
  add column attribution_required boolean not null default true,
  add column attribution_text text,
  add column deep_link_required boolean not null default false,
  add column on_revocation text not null default 'hide_and_purge' check (on_revocation in ('hide_and_purge', 'hide_only'));

-- ---------------------------------------------------------------------------
-- 3. Backfill (vakttriggeren kjenner ikke de nye kolonnene ennå). Ingen annen provider enn synthetic-demo skal finnes;
--    om en finnes, får den miljø `live` og ingen rettigheter (default-deny) — aldri oppfunnede tillatelser.
-- ---------------------------------------------------------------------------
update private.provider_rights_profiles
set environment = case when provider = 'synthetic-demo' then 'synthetic' else 'live' end;

update private.provider_rights_profiles
set provider_name = 'Syntetisk demokilde',
    display_fields = '{"title":true,"price":true,"mileage":true,"registration":true,"specs":true,"text":true,"seller_identity":true,"seller_location":true,"images":false,"provider_identity":true,"source_url":true,"listing_id":true,"listing_dates":true}'::jsonb,
    matching_fields = '{"title":true,"price":true,"mileage":true,"registration":true,"specs":true,"text":true,"seller_identity":true,"seller_location":true,"images":false,"provider_identity":true,"source_url":true,"listing_id":true,"listing_dates":true}'::jsonb,
    multi_customer_reuse = true, re_evaluation_allowed = true, alerts_allowed = false,
    geography_unrestricted = true,
    attribution_required = true, attribution_text = 'Syntetiske demodata – ikke ekte leverandørdata'
where provider = 'synthetic-demo' and version = 1;

alter table private.provider_rights_profiles
  alter column environment set not null,
  add constraint provider_rights_profiles_environment_check check (environment in ('synthetic', 'sandbox', 'live')),
  add constraint provider_rights_profiles_display_valid check (private.rights_field_map_valid(display_fields)),
  add constraint provider_rights_profiles_matching_valid check (private.rights_field_map_valid(matching_fields)),
  add constraint provider_rights_profiles_history_check check (history_retention_seconds <= retention_seconds),
  add constraint provider_rights_profiles_countries_check check (allowed_countries <@ array[
    'AT','BE','BG','CH','CY','CZ','DE','DK','EE','ES','FI','FR','GB','GR','HR','HU','IE','IS','IT','LI','LT','LU','LV','MT','NL','NO','PL','PT','RO','SE','SI','SK']::text[]),
  add constraint provider_rights_profiles_geography_check check (not geography_unrestricted or cardinality(allowed_countries) = 0),
  add constraint provider_rights_profiles_provider_name_check check (provider_name is null or char_length(provider_name) between 1 and 100),
  -- En verifisert profil som krever attribusjon må si hvilken tekst som skal vises, og live-profiler må ha et leverandørnavn.
  add constraint provider_rights_profiles_attribution_check check (
    status <> 'verified' or not attribution_required or (attribution_text is not null and char_length(attribution_text) between 1 and 300)),
  add constraint provider_rights_profiles_live_name_check check (
    status <> 'verified' or environment = 'synthetic' or provider_name is not null);

-- ---------------------------------------------------------------------------
-- 4. Vakttrigger: de nye kolonnene er uforanderlige på samme måte som de eksisterende (unntatt status/verifisering/effective_to).
-- ---------------------------------------------------------------------------
create or replace function private.rights_profiles_guard() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if (new.id, new.provider, new.version, new.effective_from, new.retention_seconds, new.allow_price, new.allow_specs,
        new.allow_text, new.allow_images, new.allow_seller_data, new.source_ref, new.created_at,
        new.environment, new.provider_name, new.display_fields, new.matching_fields, new.cache_seconds, new.history_retention_seconds,
        new.multi_customer_reuse, new.re_evaluation_allowed, new.alerts_allowed, new.geography_unrestricted, new.allowed_countries,
        new.attribution_required, new.attribution_text, new.deep_link_required, new.on_revocation)
       is distinct from
       (old.id, old.provider, old.version, old.effective_from, old.retention_seconds, old.allow_price, old.allow_specs,
        old.allow_text, old.allow_images, old.allow_seller_data, old.source_ref, old.created_at,
        old.environment, old.provider_name, old.display_fields, old.matching_fields, old.cache_seconds, old.history_retention_seconds,
        old.multi_customer_reuse, old.re_evaluation_allowed, old.alerts_allowed, old.geography_unrestricted, old.allowed_countries,
        old.attribution_required, old.attribution_text, old.deep_link_required, old.on_revocation) then
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

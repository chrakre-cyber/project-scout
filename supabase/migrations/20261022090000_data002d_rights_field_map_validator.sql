-- DATA-002D: `private.rights_field_map_valid` (DATA-002B) skal alltid gi true/false. For et tomt objekt ('{}') ga den SQL NULL
-- (`array_agg` over ingen nøkler er NULL, og NULL = array[...] er NULL), og en CHECK godtar NULL: `display_fields`/`matching_fields` = '{}'
-- kunne lagres, mens TypeScript (`validateProfile`) regner kartet som ugyldig. Samme feil ble rettet for `economics_rights_map_valid` i
-- ECON-005b. Additiv: den historiske DATA-002B-migrasjonen er uendret. Ingen rettigheter gis, ingen rader endres, ingen RLS/trigger/guard berøres.
--
-- 1. Kartlegging FØR innstramming: finnes det eksisterende rader som ikke er gyldige (inkl. tomme kart)? Da stoppes migrasjonen med presis
--    forklaring. Det fylles IKKE inn antatte rettigheter, og profilimmutabiliteten (vakttriggeren) omgås ikke: en slik rad må rettes eksplisitt
--    av eier som en ny profilversjon (eller fjernes via dokumentert prosess) før denne migrasjonen kan anvendes.
do $$
declare bad text;
begin
  select string_agg(format('%s@v%s (display_fields %s, matching_fields %s)', provider, version,
                           case when private.rights_field_map_valid(display_fields) is true then 'ok' else 'UGYLDIG' end,
                           case when private.rights_field_map_valid(matching_fields) is true then 'ok' else 'UGYLDIG' end), '; ' order by provider, version)
    into bad
  from private.provider_rights_profiles
  where private.rights_field_map_valid(display_fields) is not true or private.rights_field_map_valid(matching_fields) is not true;
  if bad is not null then
    raise exception 'data002d_invalid_existing_rows: eksisterende rettighetsprofiler har ugyldige (f.eks. tomme) feltkart og må avklares av eier før innstramming: %', bad
      using errcode = 'check_violation';
  end if;
end
$$;

-- 2. Total validator: nøyaktig de 13 nøklene, alle boolske. CASE sikrer at nøkkelfunksjonen bare kalles på objekter; tomt nøkkelsett
--    sammenlignes som tom liste (⇒ false); ytre coalesce gir boolsk retur uansett.
create or replace function private.rights_field_map_valid(j jsonb) returns boolean
language sql immutable set search_path = ''
as $$
  select coalesce(
    case when j is null or jsonb_typeof(j) <> 'object' then false
         else coalesce((select array_agg(k order by k) from jsonb_object_keys(j) k), array[]::text[]) = array[
                'images','listing_dates','listing_id','mileage','price','provider_identity','registration','seller_identity',
                'seller_location','source_url','specs','text','title']
              and not exists (select 1 from jsonb_each(j) e where jsonb_typeof(e.value) <> 'boolean')
    end,
    false)
$$;

-- 3. Constraintene krever IS TRUE (NULL kan aldri slippe gjennom, heller ikke ved en framtidig endring av funksjonen).
alter table private.provider_rights_profiles
  drop constraint provider_rights_profiles_display_valid,
  drop constraint provider_rights_profiles_matching_valid,
  add constraint provider_rights_profiles_display_valid check (private.rights_field_map_valid(display_fields) is true),
  add constraint provider_rights_profiles_matching_valid check (private.rights_field_map_valid(matching_fields) is true);

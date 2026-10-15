-- SEARCH-005: lagrede søkeutkast (søkemodell v1, `merovo.search-model`) per firma.
--
-- Nytt og adskilt fra `search_agents`: ingen eksisterende tabell, constraint, trigger, policy eller funksjon endres.
-- Et søkeutkast er IKKE en aktiv agent: ingen `active`-kolonne, ingen telling mot grensen på ti aktive agenter,
-- ingen planlagt kjøring og ingen kobling til search_runs. Aktivering av nye søk er et senere, eget oppdrag.
--
-- HVA DATABASEN KONTROLLERER (struktur og semantikk som kan avgjøres uten katalog):
--   * dokumentet er `merovo.search-model` modellversjon 1 med nøyaktig de forventede nøklene på alle nivåer;
--   * typer, enheter og grenser (modellår 1950–2100, seter 1–20, km 1–2 000 000, basispunkter 0–10 000, registreringsdato
--     med presisjon og gyldig kalenderdato, fra ≤ til);
--   * enum-verdier (karosseri, drivstoff, gir, hjuldrift, prioritet, kostnadstype, mva.-grunnlag, registreringsscenario),
--     ingen duplikater, ingen styretegn, ingen overflødig mellomrom i fritekst;
--   * penger som heltallsstrenger ≤ 2^53-1 (DEC-020): budsjett i NOK > 0, kostnadsbeløp ≥ 0 eller null (= ukjent) med valuta
--     bevart, valuta fra det støttede settet (NOK, EUR, SEK, DKK, CHF, GBP, PLN — samme sett som src/domain/currency.ts);
--   * kostnadslinjer: høyst 30, unike id-er (^[a-z0-9][a-z0-9_-]{0,39}$), faste typer høyst én gang.
-- HVA DATABASEN IKKE KONTROLLERER: at merke, modell, farge, materiale og utstyr finnes i KATALOGEN. Katalogen er data i
--   appen (src/adapters/search-catalog), ikke i databasen. Serveren validerer hele dokumentet mot katalogen (`specFromJson`)
--   før hver lagring og hver åpning. Databasen garanterer derfor struktur, ikke katalogtilhørighet.
--
-- Prinsipper (som search_runs):
--   * firma settes av databasen fra membership (aldri fra klienten); klienten kan bare oppgi navn og dokument;
--   * versjon og tidsstempler settes av databasen; atomisk konfliktsjekk: hver UPDATE må oppgi `base_version` lik
--     gjeldende `version`, ellers avvises den (også ved direkte API-skriving), og feltet nullstilles etter hver skriving
--     slik at en senere UPDATE som utelater det også avvises;
--   * RLS: bare eget firma kan leses, opprettes og endres; ingen anon-tilgang; ingen sletting; ingen service-role.

-- ---------------------------------------------------------------------------
-- Hjelpefunksjoner (strukturvalidering). Kjøres bare som CHECK; returnerer false ved enhver feil.
-- ---------------------------------------------------------------------------
create function private.jsonb_is_int(v jsonb, lo bigint, hi bigint) returns boolean
language sql immutable parallel safe set search_path = ''
as $$
  select coalesce(jsonb_typeof(v) = 'number' and (v #>> '{}') ~ '^(0|-?[1-9][0-9]{0,15})$'
                  and (v #>> '{}')::bigint between lo and hi, false)
$$;

-- Tekst som data: ikke tom, ingen styretegn, ingen mellomrom først/sist, høyst `max` tegn.
create function private.jsonb_is_text(v jsonb, max_len integer) returns boolean
language sql immutable parallel safe set search_path = ''
as $$
  select coalesce(jsonb_typeof(v) = 'string' and char_length(v #>> '{}') between 1 and max_len
                  and (v #>> '{}') !~ '[[:cntrl:]]' and (v #>> '{}') = btrim(v #>> '{}'), false)
$$;

create function private.jsonb_is_key(v jsonb, pattern text) returns boolean
language sql immutable parallel safe set search_path = ''
as $$
  select coalesce(jsonb_typeof(v) = 'string' and (v #>> '{}') ~ pattern, false)
$$;

-- Nøyaktig disse nøklene (alle påkrevd, ingen andre).
create function private.jsonb_exact_keys(o jsonb, keys text[]) returns boolean
language sql immutable parallel safe set search_path = ''
as $$
  select jsonb_typeof(o) = 'object'
     and (select count(*) from jsonb_object_keys(o)) = cardinality(keys)
     and not exists (select 1 from unnest(keys) k where not (o ? k))
$$;

-- Heltallsstreng i minste enhet, høyst 2^53-1; `allow_zero` styrer om 0 er lov.
create function private.jsonb_is_minor(v jsonb, allow_zero boolean) returns boolean
language sql immutable parallel safe set search_path = ''
as $$
  select coalesce(jsonb_typeof(v) = 'string'
    and (v #>> '{}') ~ case when allow_zero then '^(0|[1-9][0-9]{0,15})$' else '^[1-9][0-9]{0,15}$' end
    and (v #>> '{}')::bigint <= 9007199254740991, false)
$$;

-- Liste av distinkte strenger som alle er blant `allowed` (tom liste er lov).
create function private.jsonb_enum_list(v jsonb, allowed text[]) returns boolean
language sql immutable parallel safe set search_path = ''
as $$
  select coalesce(jsonb_typeof(v) = 'array'
    and (select coalesce(bool_and(jsonb_typeof(e) = 'string' and (e #>> '{}') = any(allowed)), true) and count(*) = count(distinct e)
         from jsonb_array_elements(v) e), false)
$$;

-- Intervall {min,max,unit}: minst én side, heltall innen grensene, min ≤ max, riktig enhet.
create function private.jsonb_int_range(v jsonb, unit_name text, lo bigint, hi bigint) returns boolean
language sql immutable parallel safe set search_path = ''
as $$
  select coalesce(
    private.jsonb_exact_keys(v, array['min','max','unit'])
    and v -> 'unit' = to_jsonb(unit_name)
    and (v -> 'min' = 'null'::jsonb or private.jsonb_is_int(v -> 'min', lo, hi))
    and (v -> 'max' = 'null'::jsonb or private.jsonb_is_int(v -> 'max', lo, hi))
    and not (v -> 'min' = 'null'::jsonb and v -> 'max' = 'null'::jsonb)
    and (v -> 'min' = 'null'::jsonb or v -> 'max' = 'null'::jsonb or (v ->> 'min')::bigint <= (v ->> 'max')::bigint),
    false)
$$;

-- Førstegangsregistrering med presisjon (ingen oppdiktet måned/dag). Returnerer (earliest, latest) som ÅÅÅÅMMDD, ellers null.
create function private.reg_bounds(d jsonb) returns integer[]
language plpgsql immutable parallel safe set search_path = ''
as $$
declare
  prec text;
  y integer; m integer; dd integer;
  last_day integer;
begin
  if jsonb_typeof(d) <> 'object' then return null; end if;
  prec := d ->> 'precision';
  if prec = 'year' then
    if not private.jsonb_exact_keys(d, array['precision','year']) or not private.jsonb_is_int(d -> 'year', 1900, 2100) then return null; end if;
    y := (d ->> 'year')::integer;
    return array[y * 10000 + 101, y * 10000 + 1231];
  elsif prec = 'month' then
    if not private.jsonb_exact_keys(d, array['precision','year','month'])
       or not private.jsonb_is_int(d -> 'year', 1900, 2100) or not private.jsonb_is_int(d -> 'month', 1, 12) then return null; end if;
    y := (d ->> 'year')::integer; m := (d ->> 'month')::integer;
    last_day := extract(day from (make_date(y, m, 1) + interval '1 month' - interval '1 day'))::integer;
    return array[y * 10000 + m * 100 + 1, y * 10000 + m * 100 + last_day];
  elsif prec = 'date' then
    if not private.jsonb_exact_keys(d, array['precision','year','month','day'])
       or not private.jsonb_is_int(d -> 'year', 1900, 2100) or not private.jsonb_is_int(d -> 'month', 1, 12)
       or not private.jsonb_is_int(d -> 'day', 1, 31) then return null; end if;
    y := (d ->> 'year')::integer; m := (d ->> 'month')::integer; dd := (d ->> 'day')::integer;
    last_day := extract(day from (make_date(y, m, 1) + interval '1 month' - interval '1 day'))::integer;
    if dd > last_day then return null; end if;
    return array[y * 10000 + m * 100 + dd, y * 10000 + m * 100 + dd];
  end if;
  return null;
end
$$;

create function private.jsonb_prioritized_list(v jsonb) returns boolean
language sql immutable parallel safe set search_path = ''
as $$
  select coalesce(v = 'null'::jsonb or (
    private.jsonb_exact_keys(v, array['values','priority'])
    and v ->> 'priority' in ('must','nice') and jsonb_typeof(v -> 'priority') = 'string'
    and jsonb_typeof(v -> 'values') = 'array'
    and jsonb_array_length(v -> 'values') between 1 and 50
    and (select bool_and(private.jsonb_is_key(e, '^[a-z0-9][a-z0-9_-]{0,59}$')) and count(*) = count(distinct e)
         from jsonb_array_elements(v -> 'values') e)), false)
$$;

create function private.search_spec_costs_valid(c jsonb) returns boolean
language plpgsql immutable parallel safe set search_path = ''
as $$
begin
  if jsonb_typeof(c) <> 'array' or jsonb_array_length(c) > 30 then return false; end if;
  if exists (
    select 1 from jsonb_array_elements(c) e
    where not (
      private.jsonb_exact_keys(e, array['id','kind','label','currency','amountMinor','vatBasis','includedInBudget'])
      and private.jsonb_is_key(e -> 'id', '^[a-z0-9][a-z0-9_-]{0,39}$')
      and jsonb_typeof(e -> 'kind') = 'string'
      and (e ->> 'kind') in ('transport','travel','insurance','preparation','conversion','approval','custom')
      and private.jsonb_is_text(e -> 'label', 60)
      and jsonb_typeof(e -> 'currency') = 'string' and (e ->> 'currency') in ('NOK','EUR','SEK','DKK','CHF','GBP','PLN')
      and (e -> 'amountMinor' = 'null'::jsonb or private.jsonb_is_minor(e -> 'amountMinor', true))
      and (e -> 'vatBasis' = 'null'::jsonb or (jsonb_typeof(e -> 'vatBasis') = 'string' and (e ->> 'vatBasis') in ('incl','excl','none')))
      and jsonb_typeof(e -> 'includedInBudget') = 'boolean')) then
    return false;
  end if;
  -- unike id-er, og faste kostnadstyper høyst én gang
  if (select count(*) <> count(distinct e ->> 'id') from jsonb_array_elements(c) e) then return false; end if;
  if exists (select 1 from jsonb_array_elements(c) e where (e ->> 'kind') <> 'custom' group by e ->> 'kind' having count(*) > 1) then return false; end if;
  return true;
end
$$;

-- Hele dokumentet. Ved enhver uventet feil (typer som ikke kan castes osv.) er svaret false, ikke et unntak.
create function private.search_spec_valid(j jsonb) returns boolean
language plpgsql immutable parallel safe set search_path = ''
as $$
declare
  v jsonb; r jsonb; a jsonb; b jsonb; fr jsonb; f_lo integer[]; f_hi integer[];
  k text;
begin
  if not private.jsonb_exact_keys(j, array['schema','modelVersion','vehicle','requirements','appearance','equipment','budget','plannedRegistration']) then return false; end if;
  if j -> 'schema' <> to_jsonb('merovo.search-model'::text) or j -> 'modelVersion' <> '1'::jsonb then return false; end if;

  -- bilidentitet
  v := j -> 'vehicle';
  if not private.jsonb_exact_keys(v, array['brand','model','variant']) then return false; end if;
  if v -> 'brand' <> 'null'::jsonb and not private.jsonb_is_key(v -> 'brand', '^[a-z0-9][a-z0-9_-]{0,59}$') then return false; end if;
  if v -> 'model' <> 'null'::jsonb and not private.jsonb_is_key(v -> 'model', '^[a-z0-9][a-z0-9_-]{0,59}$') then return false; end if;
  if v -> 'variant' <> 'null'::jsonb and not private.jsonb_is_text(v -> 'variant', 100) then return false; end if;
  if v -> 'model' <> 'null'::jsonb and v -> 'brand' = 'null'::jsonb then return false; end if;
  if v -> 'variant' <> 'null'::jsonb and v -> 'model' = 'null'::jsonb then return false; end if;

  -- krav
  r := j -> 'requirements';
  if not private.jsonb_exact_keys(r, array['modelYear','firstRegistration','maxMileage','seats','bodyTypes','fuels','transmissions','driveTrains']) then return false; end if;
  if r -> 'modelYear' <> 'null'::jsonb and not private.jsonb_int_range(r -> 'modelYear', 'year', 1950, 2100) then return false; end if;
  if r -> 'seats' <> 'null'::jsonb and not private.jsonb_int_range(r -> 'seats', 'seats', 1, 20) then return false; end if;
  if r -> 'maxMileage' <> 'null'::jsonb and not (
       private.jsonb_exact_keys(r -> 'maxMileage', array['value','unit']) and (r -> 'maxMileage' -> 'unit') = to_jsonb('km'::text)
       and private.jsonb_is_int(r -> 'maxMileage' -> 'value', 1, 2000000)) then return false; end if;
  fr := r -> 'firstRegistration';
  if fr <> 'null'::jsonb then
    if not private.jsonb_exact_keys(fr, array['from','to']) then return false; end if;
    if fr -> 'from' = 'null'::jsonb and fr -> 'to' = 'null'::jsonb then return false; end if;
    if fr -> 'from' <> 'null'::jsonb then f_lo := private.reg_bounds(fr -> 'from'); if f_lo is null then return false; end if; end if;
    if fr -> 'to' <> 'null'::jsonb then f_hi := private.reg_bounds(fr -> 'to'); if f_hi is null then return false; end if; end if;
    if f_lo is not null and f_hi is not null and f_lo[1] > f_hi[2] then return false; end if;
  end if;
  if not private.jsonb_enum_list(r -> 'bodyTypes', array['sedan','estate','suv','hatchback','coupe','convertible','van','other']) then return false; end if;
  if not private.jsonb_enum_list(r -> 'fuels', array['petrol','diesel','electric','hybrid','plugin_hybrid','other']) then return false; end if;
  if not private.jsonb_enum_list(r -> 'transmissions', array['manual','automatic']) then return false; end if;
  if not private.jsonb_enum_list(r -> 'driveTrains', array['awd','fwd','rwd']) then return false; end if;

  -- utseende
  a := j -> 'appearance';
  if not private.jsonb_exact_keys(a, array['exteriorColors','interiorColors','interiorMaterials']) then return false; end if;
  foreach k in array array['exteriorColors','interiorColors','interiorMaterials'] loop
    if not private.jsonb_prioritized_list(a -> k) then return false; end if;
  end loop;

  -- utstyr: hvert element med egen prioritet, unike nøkler
  if jsonb_typeof(j -> 'equipment') <> 'array' or jsonb_array_length(j -> 'equipment') > 200 then return false; end if;
  if exists (select 1 from jsonb_array_elements(j -> 'equipment') e where not (
       private.jsonb_exact_keys(e, array['key','priority']) and private.jsonb_is_key(e -> 'key', '^[a-z0-9][a-z0-9_-]{0,59}$')
       and jsonb_typeof(e -> 'priority') = 'string' and (e ->> 'priority') in ('must','nice'))) then return false; end if;
  if (select count(*) <> count(distinct e ->> 'key') from jsonb_array_elements(j -> 'equipment') e) then return false; end if;

  -- budsjett
  b := j -> 'budget';
  if not private.jsonb_exact_keys(b, array['maxTotal','deviationBasisPoints','costs']) then return false; end if;
  if b -> 'maxTotal' <> 'null'::jsonb and not (
       private.jsonb_exact_keys(b -> 'maxTotal', array['amountMinor','currency']) and (b -> 'maxTotal' -> 'currency') = to_jsonb('NOK'::text)
       and private.jsonb_is_minor(b -> 'maxTotal' -> 'amountMinor', false)) then return false; end if;
  if b -> 'deviationBasisPoints' <> 'null'::jsonb and not private.jsonb_is_int(b -> 'deviationBasisPoints', 0, 10000) then return false; end if;
  if not private.search_spec_costs_valid(b -> 'costs') then return false; end if;

  -- planlagt registrering
  if not (private.jsonb_exact_keys(j -> 'plannedRegistration', array['requested'])
          and jsonb_typeof(j -> 'plannedRegistration' -> 'requested') = 'string'
          and (j -> 'plannedRegistration' ->> 'requested') in ('passenger','van','unspecified')) then return false; end if;
  return true;
exception when others then
  return false;
end
$$;

-- ---------------------------------------------------------------------------
-- Tabell
-- ---------------------------------------------------------------------------
create table public.search_drafts (
  id uuid primary key default gen_random_uuid(),
  dealership_id uuid not null references public.dealerships (id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 120 and name = btrim(name) and name !~ '[[:cntrl:]]'),
  -- Det versjonerte dokumentet (SearchSpecJson). Ingen kildeutdrag og ingen resultater lagres her.
  spec jsonb not null check (private.search_spec_valid(spec) and octet_length(spec::text) <= 30000),
  -- Redigeringsversjon: settes av databasen. Starter på 1 og øker når navn eller dokument faktisk endres.
  version integer not null default 1 check (version >= 1),
  -- Klientens påstand om hvilken versjon den redigerer. Må være lik `version` ved hver UPDATE; nullstilles av triggeren.
  base_version integer,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint search_drafts_id_dealership_key unique (id, dealership_id)
);
create index search_drafts_dealership_updated_idx on public.search_drafts (dealership_id, updated_at desc);

-- ---------------------------------------------------------------------------
-- Triggere (SECURITY INVOKER: leser membership som den innloggede brukeren via RLS)
-- ---------------------------------------------------------------------------
create function private.search_drafts_before_insert() returns trigger
language plpgsql set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is not null then
    -- Firma utledes fra membership; klienten kan ikke oppgi det (kolonnen er ikke skrivbar for authenticated).
    new.dealership_id := (select dm.dealership_id from public.dealership_members dm where dm.user_id = uid);
  end if;
  if new.dealership_id is null then
    raise exception 'new row violates row-level security policy for table "search_drafts"' using errcode = 'insufficient_privilege';
  end if;
  new.version := 1;
  new.base_version := null;
  new.created_by := uid;
  new.updated_by := uid;
  new.created_at := now();
  new.updated_at := now();
  return new;
end
$$;
create trigger search_drafts_before_insert before insert on public.search_drafts
for each row execute function private.search_drafts_before_insert();

create function private.search_drafts_before_update() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if (new.id, new.dealership_id, new.created_by, new.created_at) is distinct from (old.id, old.dealership_id, old.created_by, old.created_at) then
    raise exception 'search_draft_immutable: id, firma og opprettelse kan ikke endres' using errcode = 'check_violation';
  end if;
  -- Atomisk konfliktsjekk. Raden er låst av UPDATE; ved samtidig endring evalueres triggeren på den nyeste committede raden.
  if new.base_version is distinct from old.version then
    raise exception 'search_draft_conflict: søket er endret etter at du åpnet det' using errcode = 'check_violation',
      hint = 'Åpne søket på nytt og gjør endringen igjen.';
  end if;
  if (new.name, new.spec) is distinct from (old.name, old.spec) then
    new.version := old.version + 1;
    new.updated_at := now();
    new.updated_by := (select auth.uid());
  else
    new.version := old.version;
    new.updated_at := old.updated_at;
    new.updated_by := old.updated_by;
  end if;
  new.base_version := null;
  return new;
end
$$;
create trigger search_drafts_before_update before update on public.search_drafts
for each row execute function private.search_drafts_before_update();

-- ---------------------------------------------------------------------------
-- Rettigheter og RLS
-- ---------------------------------------------------------------------------
revoke all on public.search_drafts from public, anon, authenticated;
alter table public.search_drafts enable row level security;

grant select on public.search_drafts to authenticated;
-- Klienten oppgir bare navn og dokument. Firma, id, versjon, tidspunkt og opphav settes av databasen.
grant insert (name, spec) on public.search_drafts to authenticated;
grant update (name, spec, base_version) on public.search_drafts to authenticated;
-- Ingen DELETE (sletting av utkast er ikke en del av denne leveransen).

create policy search_drafts_select_own on public.search_drafts
  for select to authenticated
  using (dealership_id in (select private.my_dealership_ids()));

create policy search_drafts_insert_own on public.search_drafts
  for insert to authenticated
  with check (dealership_id in (select private.my_dealership_ids()));

create policy search_drafts_update_own on public.search_drafts
  for update to authenticated
  using (dealership_id in (select private.my_dealership_ids()))
  with check (dealership_id in (select private.my_dealership_ids()));

-- CHECK-funksjonene må kunne kjøres av den som skriver. Triggerfunksjonene trenger ingen EXECUTE-rettighet for brukere.
revoke execute on all functions in schema private from public, anon;
grant execute on function
  private.jsonb_is_int(jsonb, bigint, bigint), private.jsonb_is_text(jsonb, integer), private.jsonb_is_key(jsonb, text),
  private.jsonb_exact_keys(jsonb, text[]), private.jsonb_is_minor(jsonb, boolean), private.jsonb_enum_list(jsonb, text[]),
  private.jsonb_int_range(jsonb, text, bigint, bigint), private.reg_bounds(jsonb), private.jsonb_prioritized_list(jsonb),
  private.search_spec_costs_valid(jsonb), private.search_spec_valid(jsonb)
to authenticated;
revoke execute on function private.search_drafts_before_insert(), private.search_drafts_before_update() from public, anon, authenticated, service_role;

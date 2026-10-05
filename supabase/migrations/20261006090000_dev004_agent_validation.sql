-- DEV-004: validering av søkeagenter og krav til aktivering i databasen.
--
-- Databasen er den autoritative grensen: samme regler som src/domain/agent-validation.ts,
-- slik at heller ikke direkte API-kall med brukerens egen sesjon kan lagre ugyldige
-- agenter eller aktivere ufullstendige. Serveren gir de forståelige feilmeldingene.
--
-- filters: null / tom liste = «alle». assumptions: null = ikke oppgitt (blokkerer aktivering).
-- Penger: DEC-020 ({"amountMinor": "<tekst>", "currency": "XXX"}). Forutsetninger i NOK.
-- R7 / DEC-023: uten merke kreves bekreftet bredt søk og minst ett annet kriterium.

-- Hjelpefunksjoner (CASE for å unngå cast-feil på ugyldig input).
create function private.jnull(v jsonb) returns boolean
language sql immutable parallel safe set search_path = ''
as $$ select v is null or jsonb_typeof(v) = 'null' $$;

create function private.opt_text(v jsonb, max_len integer) returns boolean
language sql immutable parallel safe set search_path = ''
as $$
  select case
    when private.jnull(v) then true
    when jsonb_typeof(v) <> 'string' then false
    else char_length(v #>> '{}') between 1 and max_len and btrim(v #>> '{}') = (v #>> '{}')
  end
$$;

create function private.opt_int(v jsonb, lo bigint, hi bigint) returns boolean
language sql immutable parallel safe set search_path = ''
as $$
  select case
    when private.jnull(v) then true
    when jsonb_typeof(v) <> 'number' then false
    when (v #>> '{}') !~ '^[0-9]{1,10}$' then false
    else (v #>> '{}')::bigint between lo and hi
  end
$$;

create function private.opt_enum_array(v jsonb, allowed text[]) returns boolean
language sql immutable parallel safe set search_path = ''
as $$
  select case
    when private.jnull(v) then true
    when jsonb_typeof(v) <> 'array' then false
    else (select coalesce(bool_and(jsonb_typeof(e) = 'string' and (e #>> '{}') = any(allowed)), true)
            and count(*) = count(distinct e)
          from jsonb_array_elements(v) e)
  end
$$;

create function private.opt_enum(v jsonb, allowed text[]) returns boolean
language sql immutable parallel safe set search_path = ''
as $$
  select private.jnull(v) or (jsonb_typeof(v) = 'string' and (v #>> '{}') = any(allowed))
$$;

create function private.keys_subset(o jsonb, allowed text[]) returns boolean
language sql immutable parallel safe set search_path = ''
as $$
  select jsonb_typeof(o) = 'object' and coalesce((select bool_and(k = any(allowed)) from jsonb_object_keys(o) k), true)
$$;

-- 0 er lov (klargjøringsreserve), ellers samme format som is_money_json.
create function private.is_money_json_allow_zero(j jsonb) returns boolean
language sql immutable parallel safe set search_path = ''
as $$
  select case
    when j is null or jsonb_typeof(j) <> 'object' then false
    when (select count(*) from jsonb_object_keys(j)) = 2 and j ->> 'amountMinor' = '0'
      and jsonb_typeof(j -> 'currency') = 'string' and (j ->> 'currency') ~ '^[A-Z]{3}$' then true
    else private.is_money_json(j)
  end
$$;

create function private.agent_filters_valid(f jsonb) returns boolean
language sql immutable parallel safe set search_path = ''
as $$
  select coalesce(case when jsonb_typeof(f) <> 'object' then false else
    private.keys_subset(f, array['make','model','variant','yearMin','yearMax','maxMileageKm','fuels','transmissions',
      'bodyTypes','countryCodes','maxPrice','broadSearchConfirmed'])
    and private.opt_text(f -> 'make', 60)
    and private.opt_text(f -> 'model', 60)
    and private.opt_text(f -> 'variant', 60)
    and (private.jnull(f -> 'model') or not private.jnull(f -> 'make'))
    and (private.jnull(f -> 'variant') or not private.jnull(f -> 'model'))
    -- Øvre årsgrense i databasen er statisk (2100); serveren bruker inneværende år + 1.
    and private.opt_int(f -> 'yearMin', 1900, 2100)
    and private.opt_int(f -> 'yearMax', 1900, 2100)
    and (private.jnull(f -> 'yearMin') or private.jnull(f -> 'yearMax')
         or case when private.opt_int(f -> 'yearMin', 1900, 2100) and private.opt_int(f -> 'yearMax', 1900, 2100)
                 then (f ->> 'yearMin')::int <= (f ->> 'yearMax')::int else false end)
    and private.opt_int(f -> 'maxMileageKm', 1, 2000000)
    and private.opt_enum_array(f -> 'fuels', array['petrol','diesel','electric','hybrid','plugin_hybrid','other'])
    and private.opt_enum_array(f -> 'transmissions', array['manual','automatic'])
    and private.opt_enum_array(f -> 'bodyTypes', array['sedan','estate','suv','hatchback','coupe','convertible','van','other'])
    and private.opt_enum_array(f -> 'countryCodes', array['DE','AT','NL','BE','LU','FR','IT','ES','DK','SE','PL','CZ','CH'])
    and (private.jnull(f -> 'maxPrice')
         or (private.is_money_json(f -> 'maxPrice') and (f -> 'maxPrice' ->> 'currency') = any(array['NOK','EUR','SEK','DKK','CHF','GBP','PLN'])))
    and (private.jnull(f -> 'broadSearchConfirmed') or jsonb_typeof(f -> 'broadSearchConfirmed') = 'boolean')
  end, false)
$$;

create function private.nok_money_or_null(v jsonb, allow_zero boolean) returns boolean
language sql immutable parallel safe set search_path = ''
as $$
  select private.jnull(v)
    or ((case when allow_zero then private.is_money_json_allow_zero(v) else private.is_money_json(v) end) and (v ->> 'currency') = 'NOK')
$$;

create function private.agent_assumptions_valid(a jsonb) returns boolean
language sql immutable parallel safe set search_path = ''
as $$
  select coalesce(case when jsonb_typeof(a) <> 'object' then false else
    private.keys_subset(a, array['retail','minimumContribution','preparationReserve'])
    and (private.jnull(a -> 'retail') or (
      private.keys_subset(a -> 'retail', array['expectedRetailTotal','priceBasis'])
      and private.nok_money_or_null(a -> 'retail' -> 'expectedRetailTotal', false)
      and (private.jnull(a -> 'retail' -> 'priceBasis') or (
        private.keys_subset(a -> 'retail' -> 'priceBasis', array['vat','registrationTaxes'])
        and private.opt_enum(a -> 'retail' -> 'priceBasis' -> 'vat', array['included','excluded'])
        and private.opt_enum(a -> 'retail' -> 'priceBasis' -> 'registrationTaxes', array['included','excluded'])))))
    and private.nok_money_or_null(a -> 'minimumContribution', false)
    and (private.jnull(a -> 'preparationReserve') or (
      private.keys_subset(a -> 'preparationReserve', array['amount','vatBasis'])
      and private.nok_money_or_null(a -> 'preparationReserve' -> 'amount', true)
      and private.opt_enum(a -> 'preparationReserve' -> 'vatBasis', array['ex_vat','incl_vat'])))
  end, false)
$$;

-- Krav for aktivering (forutsetter gyldige filters/assumptions, som sjekkes separat).
-- NB: CHECK godtar NULL som bestått; derfor coalesce(…, false) rundt hele uttrykket
-- og eksplisitt sammenligning for flagget som kan mangle.
create function private.agent_ready(f jsonb, a jsonb) returns boolean
language sql immutable parallel safe set search_path = ''
as $$
  select coalesce(
    (not private.jnull(f -> 'make')
      or (coalesce((f -> 'broadSearchConfirmed') = 'true'::jsonb, false) and (
        not private.jnull(f -> 'yearMin') or not private.jnull(f -> 'yearMax') or not private.jnull(f -> 'maxMileageKm')
        or coalesce(jsonb_array_length(case when jsonb_typeof(f -> 'fuels') = 'array' then f -> 'fuels' end), 0) > 0
        or coalesce(jsonb_array_length(case when jsonb_typeof(f -> 'transmissions') = 'array' then f -> 'transmissions' end), 0) > 0
        or coalesce(jsonb_array_length(case when jsonb_typeof(f -> 'bodyTypes') = 'array' then f -> 'bodyTypes' end), 0) > 0
        or coalesce(jsonb_array_length(case when jsonb_typeof(f -> 'countryCodes') = 'array' then f -> 'countryCodes' end), 0) > 0
        or not private.jnull(f -> 'maxPrice'))))
    and not private.jnull(a -> 'retail' -> 'expectedRetailTotal')
    and not private.jnull(a -> 'retail' -> 'priceBasis' -> 'vat')
    and not private.jnull(a -> 'retail' -> 'priceBasis' -> 'registrationTaxes')
    and not private.jnull(a -> 'minimumContribution')
    and not private.jnull(a -> 'preparationReserve' -> 'amount')
    and not private.jnull(a -> 'preparationReserve' -> 'vatBasis'),
    false)
$$;

-- Erstatter DEV-002s rene pengeformat-sjekk (dekkes nå av de fullstendige sjekkene).
alter table public.search_agents drop constraint search_agents_money_format;
drop function private.agent_money_valid(jsonb, jsonb);

-- Oppgradering fra DEV-002: en aktiv agent som ikke oppfyller aktiveringskravene
-- (kunne bare oppstå via direkte API-kall) pauses, slik at constraintet kan legges
-- til. Antallet rapporteres; agentene beholdes uendret ellers.
do $$
declare
  paused integer;
begin
  update public.search_agents set active = false
  where active and not private.agent_ready(filters, assumptions);
  get diagnostics paused = row_count;
  raise notice 'DEV-004: % aktiv(e) agent(er) uten komplette krav ble pauset', paused;
end
$$;

alter table public.search_agents
  add constraint search_agents_filters_valid check (private.agent_filters_valid(filters)),
  add constraint search_agents_assumptions_valid check (private.agent_assumptions_valid(assumptions)),
  add constraint search_agents_ready_when_active check (not active or private.agent_ready(filters, assumptions));

-- CHECK-funksjonene kjøres med rettighetene til den som skriver.
revoke execute on all functions in schema private from public, anon;
grant execute on function
  private.jnull(jsonb), private.opt_text(jsonb, integer), private.opt_int(jsonb, bigint, bigint),
  private.opt_enum_array(jsonb, text[]), private.opt_enum(jsonb, text[]), private.keys_subset(jsonb, text[]),
  private.is_money_json_allow_zero(jsonb), private.agent_filters_valid(jsonb), private.nok_money_or_null(jsonb, boolean),
  private.agent_assumptions_valid(jsonb), private.agent_ready(jsonb, jsonb)
to authenticated;

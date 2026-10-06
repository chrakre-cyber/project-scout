-- QA-001-FIX: retter to funn i grensetriggeren fra DEV-002 uten å endre den migrasjonen.
--
-- F1 (P1): Triggeren kjører FØR RLS WITH CHECK. En bruker i firma A som kjente B sin dealership_id fikk
--   23514 «active_agent_limit» når B hadde 10 aktive agenter, og 42501 ellers. Det røpet tilstand i et
--   annet firma. Nå avvises forsøk mot et firma som ikke er brukerens med samme 42501 og melding som RLS,
--   FØR noe telles eller låses. Svaret er dermed identisk uansett hva B har.
--   Direkte databasekall uten bruker (auth.uid() er null: eier/serverjobb) påvirkes ikke og får grensen som før.
--
-- F2 (P2): Tellingen bruker transaksjonens snapshot. Under REPEATABLE READ kan to transaksjoner om siste
--   plass begge se 9 og ende med 11 aktive (verifisert). Kommentaren i DEV-002-migrasjonen om at dette gir
--   serialiseringsfeil var feil for REPEATABLE READ. Nå avvises aktivering eksplisitt i den isolasjonen.
--   READ COMMITTED (standard, Data API) bruker radlås + ny telling per setning og er uendret.
--   SERIALIZABLE gir serialiseringsfeil (40001) i konflikt og er uendret. Se DEC-025.
create or replace function private.enforce_active_agent_limit() returns trigger
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

  -- F1: tenantsjekk før alt som kan avsløre noe om firmaet. not exists (ikke NOT IN) slik at NULL avvises.
  if (select auth.uid()) is not null
     and not exists (select 1 from private.my_dealership_ids() m(id) where m.id = new.dealership_id) then
    raise exception 'new row violates row-level security policy for table "search_agents"'
      using errcode = 'insufficient_privilege';
  end if;

  -- F2: grensen er bare trygg når hver telling ser nylig committede rader.
  if current_setting('transaction_isolation') = 'repeatable read' then
    raise exception 'active_agent_limit_isolation: aktivering av agenter krever read committed eller serializable'
      using errcode = 'feature_not_supported',
            hint = 'Bruk standard isolasjonsnivå (read committed) eller serializable og prøv på nytt ved 40001.';
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

-- create or replace beholder eier og rettigheter, men sikre at funksjonen fortsatt ikke kan kjøres av ordinære roller.
revoke execute on function private.enforce_active_agent_limit() from public, anon, authenticated;

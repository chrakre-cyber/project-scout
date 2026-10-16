-- DATA-002C: rettighetsprofiler som kan ha vært brukt for sandbox-/produksjonsdata må ikke forsvinne.
-- DEV-005B0/DATA-002B-vakten nekter allerede å ENDRE en profils rettigheter på plass (alle statuser). Her nektes også SLETTING av
-- verifiserte eller trukne profiler for sandbox- og produksjonskilder (FK `on delete restrict` beskytter bare profiler som kjøringer peker på).
-- Syntetiske utviklingsprofiler og utkast kan fortsatt slettes (før-live-unntaket); unntaket gjelder ikke sandbox/live.
create function private.rights_profiles_no_delete() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if old.status in ('verified', 'revoked') and old.environment in ('sandbox', 'live') then
    raise exception 'rights_profile_immutable: en verifisert eller trukket profil for en sandbox-/produksjonskilde kan ikke slettes' using errcode = 'check_violation';
  end if;
  return old;
end
$$;
revoke execute on function private.rights_profiles_no_delete() from public, anon, authenticated, service_role;
create trigger provider_rights_profiles_no_delete before delete on private.provider_rights_profiles
for each row execute function private.rights_profiles_no_delete();

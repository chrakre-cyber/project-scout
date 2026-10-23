-- DATA-002D: skrivebeskyttet leseveg for rettighetsprofiler til kjøretiden.
--
-- Bakgrunn: `private.provider_rights_profiles` er den autoritative rettighetskilden, men alle rettigheter er tilbakekalt og ingen eksisterende
-- funksjon leverer profilene til applikasjonen (`rights_profile_in_force` er revokert fra alle roller; `trusted_run_policy` gjelder én kjøring).
-- Kjøretiden hadde derfor en hardkodet profilliste (`REGISTERED_PROFILES`). Denne migrasjonen legger til EN funksjon som returnerer ALLE
-- profilrader (alle statuser, så trukket/utkast gir riktig avslagsårsak) til den begrensede rollen `scout_ingest` — og ingen andre.
--
-- Additiv og skrivebeskyttet: ingen tabell-, constraint-, trigger-, RLS- eller dataendring. Tolkning av radene og fail-closed ligger i
-- domenekoden (`profileFromRow`), ikke her. Funksjonen gir aldri en tillatelse; den leverer bare raden slik den er lagret.

create function private.trusted_rights_profiles()
returns setof private.provider_rights_profiles
language sql stable security definer set search_path = ''
as $$
  select p.* from private.provider_rights_profiles p order by p.provider, p.version
$$;

revoke execute on function private.trusted_rights_profiles() from public, anon, authenticated, service_role;
grant execute on function private.trusted_rights_profiles() to scout_ingest;

-- LOKAL utvikling: to syntetiske firmaer. Kjøres av `supabase db reset`, ikke mot
-- hostet prosjekt. Ingen brukere eller passord her; testbrukere opprettes med
-- tilfeldige passord av testene (tests/db) eller manuelt i Supabase Auth.
insert into public.dealerships (id, name) values
  ('00000000-0000-4000-a000-00000000000a', 'Syntetisk Firma A (demo)'),
  ('00000000-0000-4000-a000-00000000000b', 'Syntetisk Firma B (demo)');

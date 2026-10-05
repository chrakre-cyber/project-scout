# DB-/RLS-tester (DEV-002)

Kjøres mot **lokal** Supabase, aldri mot hostet prosjekt (`assertLocal()` stopper ellers).

```bash
npx supabase start
npx supabase db reset   # migrasjoner fra tom database + seed
npm run test:db
```

Oppsett (brukere med tilfeldige passord, firma, medlemskap) gjøres som databaseeier, slik prosjekteier gjør i SQL-editoren. Alle tilgangspåstander kjøres som ordinære innloggede brukere via Supabase Auth og PostgREST med publishable key, eller som rollen `authenticated` med JWT-claims (samtidighetstesten). Ingen service-role-nøkkel brukes.

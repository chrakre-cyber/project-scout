# DB-/RLS-tester (DEV-002, DEV-004, QA-001)

Kjøres mot **lokal** Supabase, aldri mot hostet prosjekt (`assertLocal()` stopper ellers).

```bash
npx supabase start
npx supabase db reset   # migrasjoner fra tom database + seed
npm run test:db         # alle DB-tester (6 filer)
```

Oppsett (brukere med tilfeldige passord, firma, medlemskap) gjøres som databaseeier, slik prosjekteier gjør i SQL-editoren. Alle tilgangspåstander kjøres som ordinære innloggede brukere via Supabase Auth og PostgREST med publishable key, eller som rollen `authenticated` med JWT-claims (transaksjonstestene). Ingen service-role-nøkkel brukes.

| Fil | Oppgave | Innhold |
|---|---|---|
| `rls.test.ts` | DEV-002 | Grunnleggende isolasjon, rettigheter, constraints, R5, atomisk maks 10 |
| `agents.test.ts` | DEV-004 | Validering og aktivering i databasen, 10 agentoppsett, pause/reaktivering, RLS for endring |
| `qa-isolation.test.ts` | QA-001 | Symmetrisk A→B / B→A: embeds, filtertriks, JWT-forfalskning, metadata, RPC/skjema, anon, sesjon |
| `qa-limit.test.ts` | QA-001 | Batch >10 i ett kall, samtidighet på tvers av klienter/brukere, transaksjonsisolasjon (F1, F2 som `it.fails`) |
| `qa-validation.test.ts` | QA-001 | Differensialtest domene↔database (400 utkast), NULL-sikkerhet, pengegrensen per felt |
| `qa-catalog.test.ts` | QA-001 | Katalogrevisjon: RLS, rettigheter, funksjoner, constraints, triggere, konfig; vakt for fremtidige tabeller |

`it.fails` brukes for åpne funn (se `reviews/QA-001-gate-G1.md`): testen er grønn så lenge funnet er åpent og blir rød når det rettes, da fjernes `.fails`.

Andre QA-kontroller (se `reviews/QA-001-gate-G1.md`):

```bash
npm run qa:migrations   # ren oppbygging, oppgradering fra DEV-002-data, atomisk feil, schema-likhet (destruktiv lokalt, kjører db reset)
npm run qa:secrets      # secret-skann: repo, historikk, build-artefakter, faktiske lokale nøkler
npm run qa:demo         # demomodus uten .env.local, DEV-003-regresjon (bygger på nytt)
# e2e i nettleser (krever bygg med .env.local mot lokal stack og `next start -p 3100`):
PW=<playwright> PG=$PWD/node_modules/pg DB_URL=<lokal DB_URL> node tests/e2e/qa001-app-paths.e2e.mjs
```

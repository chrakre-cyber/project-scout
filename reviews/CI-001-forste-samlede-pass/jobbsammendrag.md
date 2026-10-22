<!-- Sanert rapport slik den ble skrevet til den offentlige Actions-loggen for kjøring 39629190050 (steget «L1–L3 og L7»), gjengitt ordrett uten tidsstempler. Ingen rå statusfiler, nøkler, forespørsler eller sesjonsdata. -->
# Lokal Supabase på GitHub-runner — L1–L3 og L7

Kjørt mot en lokal Supabase-stakk i en container på runneren. IKKE hosted Supabase, ikke emulator, ikke pilotgodkjenning, ingen regel-/parametergodkjenning.

- node v22.23.3
- Docker version 28.0.4, build b8034c0
- psql (PostgreSQL) 16.15 (Ubuntu 16.15-1.pgdg24.04+2)
- supabase CLI 2.119.0
- OS Linux 6.17.0-1022-azure

## L1 lokal Supabase fra tom database (start + db reset): BESTÅTT
- 12 migrasjoner anvendt fra tom database og registrert i rekkefølge
- PostgreSQL: PostgreSQL 17.11
- image: public.ecr.aws/supabase/gotrue:v2.197.0
- image: public.ecr.aws/supabase/kong:2.8.1
- image: public.ecr.aws/supabase/postgres:17.11.0.002
- image: public.ecr.aws/supabase/postgrest:v16.4

## L2 oppgraderingstester (qa:migrations): BESTÅTT
- 50 PASS, 0 FAIL

## L3a DB-suiten mot Supabase-stakken (ekte Auth/PostgREST; test-db.sh): HOPPET OVER (ikke bestått)
- 542 tester: 536 bestått, 0 feilet, 6 hoppet over
- 6 av de 6 navngitte oppgraderingstestene er hoppet over her (krever isolert klynge, SCOUT_DB_ISOLATED) — regnes IKKE som bestått i L3a; de kan bare dekkes av L3b

## L3b seks navngitte oppgraderingstester i SEPARAT midlertidig PostgreSQL-klynge (IKKE Supabase): BESTÅTT
- 6 av 6 navngitte oppgraderingstester kjørt og bestått (IKKE Supabase-stakken: midlertidig lokal PostgreSQL-klynge (postgres (PostgreSQL) 16.15 (Ubuntu 16.15-1.pgdg24.04+2)) med shim)
- 87 øvrige tester i filene ble utelatt av filteret og er ikke talt

## L3 samlet (L3a + L3b): BESTÅTT
- L3a: SKIPPED — 542 tester: 536 bestått, 0 feilet, 6 hoppet over
- L3b: PASS — 6 av 6 navngitte oppgraderingstester kjørt og bestått (IKKE Supabase-stakken: midlertidig lokal PostgreSQL-klynge (postgres (PostgreSQL) 16.15 (Ubuntu 16.15-1.pgdg24.04+2)) med shim)
- 6 hoppet over i L3a er hver for seg kjørt og bestått i L3b (separat klynge, ikke Supabase)

## L4a innlogging mot ekte GoTrue og tokenvalidering i PostgREST (API-nivå, tests/db): BESTÅTT
- 11 av 11 navngitte tester kjørt og bestått

## L6 firmaskille via ekte PostgREST: search_drafts, dealer_economics_inputs, dealer_economics_profiles (tests/db): BESTÅTT
- 14 av 14 navngitte tester kjørt og bestått

## L7 hemmelighetsskann (qa:secrets, inkl. build-artefakter): BESTÅTT
- 21 PASS, 0 FAIL, 0 SKIP

## L4b innlogging i nettleser mot ekte lokal Supabase (l4-browser, Playwright + forhåndsinstallert Chrome, modus: ekte): BESTÅTT
- L4b l4-browser: 12 OK, 0 FEIL, 0 HOPPET av 12 faste forventede sjekker (modus: ekte)

## L5a econ006 i nettleser mot ekte lokal Supabase (modus: ekte): BESTÅTT
- L5a econ006: 94 OK, 0 FEIL, 0 HOPPET av 93 faste forventede sjekker (modus: ekte)

## L5b econ006d i nettleser mot ekte lokal Supabase (modus: ekte): BESTÅTT
- L5b econ006d: 26 OK, 0 FEIL, 0 HOPPET av 26 faste forventede sjekker (modus: ekte)

## L5 samlet (L5a + L5b): BESTÅTT
- L5a: PASS
- L5b: PASS

## Åpne kontroller
- Hosted Supabase (Trinn H): ÅPEN, separat beslutning
- L3c (de seks oppgraderingstestene mot stakkens Postgres): utsatt

## Samlet: PASS

Alle åtte kontroller (L1, L2, L3, L4a, L4b, L5, L6, L7) bestått. Hosted (Trinn H) er fortsatt åpent.

<!-- Sanert rapport slik den ble skrevet til den offentlige Actions-loggen for kjøring 39578387230 (steget «L1–L3 og L7»). Gjengitt ordrett uten tidsstempler; ingen rå statusfiler, nøkler eller usanitert utskrift. -->
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
- image: ghcr.io/supabase/gotrue:v2.197.0
- image: ghcr.io/supabase/kong:2.8.1
- image: ghcr.io/supabase/postgres:17.11.0.002
- image: ghcr.io/supabase/postgrest:v16.4

## L2 oppgraderingstester (qa:migrations): BESTÅTT
- 50 PASS, 0 FAIL

## L3a DB-suiten mot Supabase-stakken (ekte Auth/PostgREST; test-db.sh): HOPPET OVER (ikke bestått)
- 517 tester: 511 bestått, 0 feilet, 6 hoppet over
- 6 av de 6 navngitte oppgraderingstestene er hoppet over her (krever isolert klynge, SCOUT_DB_ISOLATED) — regnes IKKE som bestått i L3a; de kan bare dekkes av L3b

## L3b seks navngitte oppgraderingstester i SEPARAT midlertidig PostgreSQL-klynge (IKKE Supabase): BESTÅTT
- 6 av 6 navngitte oppgraderingstester kjørt og bestått (IKKE Supabase-stakken: midlertidig lokal PostgreSQL-klynge (postgres (PostgreSQL) 16.15 (Ubuntu 16.15-1.pgdg24.04+2)) med shim)
- 87 øvrige tester i filene ble utelatt av filteret og er ikke talt

## L3 samlet (L3a + L3b): BESTÅTT
- L3a: SKIPPED — 517 tester: 511 bestått, 0 feilet, 6 hoppet over
- L3b: PASS — 6 av 6 navngitte oppgraderingstester kjørt og bestått (IKKE Supabase-stakken: midlertidig lokal PostgreSQL-klynge (postgres (PostgreSQL) 16.15 (Ubuntu 16.15-1.pgdg24.04+2)) med shim)
- 6 hoppet over i L3a er hver for seg kjørt og bestått i L3b (separat klynge, ikke Supabase)

## L7 hemmelighetsskann (qa:secrets, inkl. build-artefakter): BESTÅTT
- 21 PASS, 0 FAIL, 0 SKIP

## Åpne kontroller (ikke del av dette workflowet)
- L4 innlogging via ekte GoTrue: ÅPEN, ikke kjørt
- L5 lagring/gjenåpning via ekte PostgREST (nettleserforløp): ÅPEN, ikke kjørt
- L6 firmaskille med ekte JWT-er: ÅPEN, ikke kjørt
- Playwright-integrasjon: ÅPEN, ikke kjørt
- Hosted Supabase (Trinn H): ÅPEN, separat beslutning

## Samlet: PASS

Alle fire kontroller bestått. L4–L6 og Trinn H er fortsatt åpne.

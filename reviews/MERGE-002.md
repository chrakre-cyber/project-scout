# MERGE-002 — forberedelse av PR for DATA-fundamentet (16.10.2026)

**Status: klar til kontrollert PR** (ingen regresjon funnet; ingen kodeendring i denne oppgaven). PR er **ikke** opprettet og ingenting er slått sammen. Ingenting er deployet.

## 1. Gren og tilstand
- Branch: `claude/wonderful-bardeen-yussx3`. Arbeidstreet var rent før denne rapporten. Hode ved kontroll: `635ca55` (pushet til origin).
- `origin/main` = `a334815` (merge av PR #2, UI-001). Branchen har ikke mergecommiten `a334815`, men beholder UI-001-innholdet (`f076364` er felles forgjenger); `git merge-tree` mot `origin/main` gir **ingen konflikter**.
- Oppsummert diff mot `origin/main`: 35 filer, +2721 / −87 (kode, tester, migrasjoner, dokumenter; ingen ZIP-artefakter).

## 2. Commits som inngår (11, eldst først)
| Oppgave | Commit | Innhold |
|---|---|---|
| PARTNER-001 | `f67fbc1` | sjekkliste for ekstern partnertilgang + hostingstatus i backlogg (kun dokumentasjon) |
| DATA-001 | `43f7829` | dataplan A→D, display-right-design, profilmodell, multi-provider, dedup, proveniens (kun dokumentasjon) |
| DATA-002A | `646ea41`, `6c38f49`, `4bfa680` | vurdering; display-right-fundament (`Field`-tilstander, `applyDisplayPolicy`, `DisplayableListing`, `search-display`-grense, arkitekturvakt); hash i rapport |
| DATA-002B | `61c8e0b`, `1ad2596`, `bbb265a` | vurdering; samlet rettighetsprofil (utvider DEV-005B0), matching vs visning, migrasjon `20261016090000`; hash i rapport |
| DATA-002C | `7b1717c`, `e9cf250`, `635ca55` | vurdering; opak Merovo-id, serverintern proveniens, fail-closed, slettevakt (migrasjon `20261016100000`), rettet DATA-002B-regresjon i `rights-retention`-DB-testen; hash i rapport |
Alle fem oppgavene er til stede (PARTNER-001, DATA-001, DATA-002A, DATA-002B, DATA-002C). Ingen andre oppgaver ligger i PR-en.

## 3. Migrasjoner
Alle migrasjoner i repoet i kjøringsrekkefølge (filnavnrekkefølge = anvendelsesrekkefølge):
| # | Fil | I `main` i dag? | Nytt i denne PR-en |
|---|---|---|---|
| 1 | `20261005090000_dev002_tenancy_and_agents.sql` | ja | – |
| 2 | `20261006090000_dev004_agent_validation.sql` | ja | – |
| 3 | `20261006100000_qa001_fix_active_limit_trigger.sql` | ja | – |
| 4 | `20261007090000_dev005_search_runs.sql` | ja | – |
| 5 | `20261008090000_dev005b0_rights_retention.sql` | ja | – |
| 6 | `20261009090000_dev005b0_rights_visibility.sql` | ja | – |
| 7 | `20261015090000_search005_search_drafts.sql` | ja | – |
| 8 | **`20261016090000_data002b_rights_profile_model.sql`** | nei | **ja** — utvider `private.provider_rights_profiles` (additiv; backfill av `synthetic-demo` v1 in place; ny funksjon `private.rights_field_map_valid`; erstatter vakttriggeren) |
| 9 | **`20261016100000_data002c_profile_delete_guard.sql`** | nei | **ja** — nekter sletting av verifiserte/trukne sandbox-/live-profiler |
Etter merge trenger `main` og det hostede Supabase-prosjektet **migrasjon 8 og 9, i den rekkefølgen**. Om migrasjon 1–7 er anvendt hosted kan ikke denne rapporten avgjøre (kontroller med `supabase migration list` eller SQL-editoren).
**Forhåndskontroll før migrasjon 8 hosted:** `select provider, version, status from private.provider_rights_profiles;` skal bare returnere `synthetic-demo | 1 | verified`. Finnes en annen verifisert, ikke-syntetisk profil, vil den få miljø `live` uten leverandørnavn og migrasjonen vil feile (constraint `provider_rights_profiles_live_name_check`) — avklar manuelt i så fall. Migrasjonene har ingen «ned»-variant; test dem først mot et staging-/kopiprosjekt og ta backup.
**Appen krever dem ikke for å kjøre:** dagens kjøretid leser ikke rettighetsprofiler fra databasen (bruker den kodede syntetiske profilen), så en deploy av koden bryter ikke uten migrasjonene. De bør likevel anvendes slik at DB og kode er i samsvar, og før noe leser profiler fra databasen.

## 4. Kontroller faktisk kjørt (på `635ca55`, denne økten)
| Kontroll | Resultat |
|---|---|
| `git status` | rent |
| `git merge-tree` mot `origin/main` | ingen konflikter |
| `npx tsc --noEmit` | uten feil |
| `npx eslint .` | uten feil |
| `npx vitest run` | **29 filer, 635 / 635** bestått |
| `npm run build` | OK |
| `bash scripts/qa-secret-scan.sh` | ingen funn (lokal-Supabase-delen hoppet over: ingen stack) |
| `bash scripts/test-e2e-search005.sh` (Chromium mot **testemulator** + isolert PG, ikke Supabase) | **77 / 77** |
| `bash scripts/qa-partner-mode.sh` (to bygg, ingen Supabase) | alle kontroller bestått |
| `bash scripts/qa-demo-mode.sh` (demomodus, ingen Supabase) | alle kontroller bestått |
| `bash scripts/test-db-isolated.sh tests/db/rights-profile-model.test.ts tests/db/qa-catalog.test.ts tests/db/search-drafts.test.ts` (isolert PostgreSQL 16 + shim, **ikke Supabase**; alle 9 migrasjoner anvendt) | **114 / 114**; «OPPGRADERING OK» |
| `bash scripts/test-db-mutations.sh` | alle 6 bevisste feil oppdaget |
Ingen av kontrollene satte `SCOUT_PUBLIC_ID_KEY`, `SCOUT_ENABLE_LEGACY_ROUTES`, `SCOUT_SYNTHETIC_FAILURE` eller `SCOUT_INGEST_DATABASE_URL` — de bekrefter at den syntetiske demoen virker uten dem.

## 5. Kontroller IKKE kjørt (ingen påstand om at de består)
- **Alle DB-/RLS-/sikkerhetssuiter som krever Supabase Auth:** `agents`, `rls`, `qa-isolation`, `qa-limit`, `qa-validation`, `search-runs`, `rights-retention` (inkludert den oppdaterte filen — bare profiltabell-delen er kjørt som utdrag mot isolert PostgreSQL, 6/6), samt `npm run test:db` mot lokal Supabase.
- Ingen test er kjørt mot det **hostede** Supabase-prosjektet i denne økten (DB, RLS eller Auth). Migrasjon 8 og 9 er anvendt bare i den isolerte klyngen.
- Eldre Supabase-e2e-skript (`dev002-auth`, `dev004-agents`, `qa001-app-paths`, `dev005-search-runs`; de krever også `SCOUT_ENABLE_LEGACY_ROUTES=1` ved bygging) og `scripts/qa-upgrade-check.sh`.
- Manuell test på `demo.merovo.eu` etter deploy.

## 6. Miljøvariabler
| Variabel | I dag | Senere |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | påkrevd (uendret) | – |
| **`SCOUT_PUBLIC_ID_KEY`** | **IKKE påkrevd for den nåværende syntetiske hostede demoen** (innebygd, ikke-hemmelig pepper brukes for syntetiske kilder; verifisert ved at alle kontrollene over kjørte uten den) | **PÅKREVD før sandbox-/live-leverandørdata** (server-only, minst 16 tegn; uten den feiler id-generering lukket og annonsene vises ikke) |
| `SCOUT_ENABLE_LEGACY_ROUTES` | skal være **udefinert** (bygg-tid) | uendret |
| `SCOUT_SYNTHETIC_FAILURE` | skal være **udefinert** | uendret |
| `SCOUT_INGEST_DATABASE_URL` | ikke nødvendig for partnerdemoen | nødvendig bare for gamle agentkjøringer / senere ingestion |
Merk: hvis `SCOUT_PUBLIC_ID_KEY` settes (valgfritt) på den hostede demoen, endrer alle resultat-URL-er seg; så lenge den er udefinert er id-ene stabile.

## 7. Deploymentrisiko
1. **Resultat-URL-er endres:** detaljlenker bruker nå en opak id (`m1_…`); gamle bokmerker/lenker med `syn-…`/`demo-…` gir 404 (de ble aldri lovet som varige). Påvirker bare brukere som har lagret slike lenker.
2. **Ingen hosting-konfigurasjon påkrevd** for å deploye koden; ingen ny påkrevd variabel; ingen DB-endring påkrevd for at appen skal virke.
3. **Migrasjon 8/9** er irreversible og bør kjøres mot staging først (se forhåndskontroll). Feil i migrasjon 8 påvirker ikke appens kjøretid, men blokkerer senere profil-lasting fra DB.
4. **Detaljoppslag** går gjennom leverandørens sider (2 kall for den syntetiske kilden); ikke et problem nå, men kvotekrevende for ekte leverandører (egen oppgave før ekte data).
5. **Uverifisert mot hostet Supabase:** RLS/tenant-isolasjon er ikke kjørt på nytt mot faktisk Supabase i denne økten. Ingen DB-/auth-/tenantkode er endret i PR-en utover rettighetsprofiltabellen (privat skjema, utilgjengelig for appens brukere), men en rask hostet røyktest (to kontoer, `/searches`) anbefales etter deploy.
6. Legacy-isolasjon, innlogging og demomodus er uendret og dekket av `qa-partner-mode.sh`/`qa-demo-mode.sh`/e2e (ikke mot hostet miljø).
7. PR-en inneholder kode-/dokumentendringer fra flere oppgaver; alle står i REVIEW i backloggen (Christian har akseptert DATA-001/002A/002B/002C og PARTNER-001 for definert omfang). Codex-review av DEV-006-sporet er ikke bekreftet i repoet.

## 8. Foreslått PR
**Tittel:** `DATA foundation: display-rights, provider rights profile model, opaque listing IDs and provenance (DATA-001, 002A–C, PARTNER-001)`

**Beskrivelse:**
> ## Hva
> Fundamentet som må på plass før noen leverandørdata kan nå `/searches`. Alt er fortsatt syntetisk; ingen leverandør er koblet til, ingen credentials er brukt, ingen live data, bilder, VIN eller deduplisering.
> - **PARTNER-001** / **DATA-001**: dokumentasjon (partnertilgangssjekkliste; plan for syntetisk → sandbox → pilot → produksjon).
> - **DATA-002A**: `DisplayableListing` + `applyDisplayPolicy` (value/unknown/withheld/unavailable), `search-display`-grense, arkitekturvakt mot rå annonser i `/searches`-UI.
> - **DATA-002B**: én samlet rettighetsprofil (utvider DEV-005B0): miljø, visning og matching som separate rettigheter, cache/historikk/gjenbruk/geografi/attribusjon; syntetisk policy avledet av profilen.
> - **DATA-002C**: opak Merovo-id i URL-er (leverandørens id er serverintern), serverintern proveniens, fail-closed ved ukjent/endret/utløpt/trukket profil og utløpte kildedata, slettevakt for sandbox/live-profiler.
>
> ## Migrasjoner (rekkefølge, i tillegg til de eksisterende 7)
> 1. `20261016090000_data002b_rights_profile_model.sql`
> 2. `20261016100000_data002c_profile_delete_guard.sql`
> Appen kjører uten dem (profiler leses ikke fra DB ennå), men de bør anvendes hosted. Forhåndskontroll og risiko: se `reviews/MERGE-002.md`.
>
> ## Miljøvariabler
> Ingen nye påkrevde. `SCOUT_PUBLIC_ID_KEY` er **ikke** påkrevd for den syntetiske demoen, men **påkrevd før sandbox/live**. `SCOUT_ENABLE_LEGACY_ROUTES` og `SCOUT_SYNTHETIC_FAILURE` skal være udefinert.
>
> ## Kontroller kjørt
> tsc, eslint, vitest 635/635, build, e2e (emulator) 77/77, `qa-partner-mode.sh`, `qa-demo-mode.sh`, secret-skann, isolerte DB-tester 114/114 + mutasjonstester 6/6.
> **Ikke kjørt:** DB-/RLS-suiter som krever Supabase Auth (inkl. hovedparten av `rights-retention`), eldre e2e-skript, noe mot hostet Supabase.
>
> ## Kjent endring
> Detalj-URL-er bruker opake id-er; gamle `syn-…`-lenker gir 404.
> Se `reviews/MERGE-002.md`, `reviews/DATA-002A.md`, `reviews/DATA-002B.md`, `reviews/DATA-002C.md`.

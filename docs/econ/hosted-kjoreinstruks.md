# HOST-001 — kjøreinstruks for hosted testprosjekt (H2–H4) — FORBEREDELSE, IKKE UTFØRT

**Status 22.10.2026 (2):** forberedelsen er reviewet (re-review av 0d50a8d, ingen nye blokkerende funn). **Ingen hosted kjøring er godkjent;** H1–H4 er ikke utført, og H3-nettleserdelene er fortsatt uforberedt. Avklaringer som trengs før H1/H2 er samlet i `reviews/HOST-001-avklaringer.md`.

**Status 22.10.2026:** skript, tester og rapportformat er klargjort offline og levert til uavhengig review. **Ingenting er kjørt mot hosted.** Ingen credentials er etterspurt eller brukt. Hvert trinn under krever **Christians uttrykkelige tillatelse hver for seg** (se «Tillatelser»). Planen/rekkefølgen: `docs/econ/hosted-plan-h1-h4.md`. Dette er et hosted **TESTPROSJEKT** — aldri produksjon, aldri pilotdata. Økonomiflagg forblir `false`.

## 1. Kartlegging: hva som kan gjenbrukes
| Del | Gjenbrukt? | Hvordan / hvorfor ikke |
|---|---|---|
| `supabase/migrations` (12 filer) | **ja, uendret** | settet som anvendes; repoets hash brukes i gate og rapport |
| DATA-002D-kartleggingen (DO-blokken i migrasjon `20261022090000`) | **ja, utvidet** | samme betingelse kjøres **skrivebeskyttet FØR** anvendelse (`inspect`), og testet mot den faktiske migrasjonen (forutsier at den stopper) |
| `tests/db/auth-gotrue.test.ts` (L4a), `tests/db/rest-isolation.test.ts` (L6) | **ja** | eneste endring: `assertLocal()` → `assertTarget()` (lokal sperre uendret som standard) |
| `tests/db/harness.ts` (`createUser`, `createFirmWithMember`, `signIn`, `cleanup`) | **ja** | testbrukere settes inn som databaseeier (direkte DB-tilkobling) som lokalt |
| `scripts/ci/evaluate.mjs` (`evaluateGroup`), `sanitize.mjs` | **ja** | vurdering av L4a/L6 på fastlåst identitet; sanering av all utskrift |
| `scripts/qa-secret-scan.sh` | **ja** | L7 (build mot hosted URL + skann); kjent lokal-stakk-SKIP er eneste tillatte unntak |
| `scripts/test-db-isolated.sh` | **ja (bare offline-testing)** | isolert PostgreSQL for å teste inspeksjon og opprydding uten hosted |
| `supabase db push --dry-run` / `db push` | **ja (CLI)** | kjøres av `cli.mjs`, utskrift fanges og saneres |
| `scripts/qa-upgrade-check.sh`, `supabase db reset`, `scripts/test-db.sh`, hele DB-suiten (L3a), L3b, L2 | **nei** | destruktive/lokale (`db reset`, `supabase status`), eller krever lokal stakk/isolert klynge |
| utløpt-token-testen i L4a | **delvis** | krever JWT-hemmeligheten; utelates (⇒ L4a DELVIS) hvis `SUPABASE_TEST_JWT_SECRET` ikke oppgis |
| `tests/e2e/*` (L4b/L5a/L5b), observatørproxyen | **ikke forberedt** | lokal-preflight, direkte lokal DB og en observatør som bare støtter loopback-`http`. Å gjøre dem hosted-egnet er en egen, uavhengig reviewet oppgave (rapporten viser dem som IKKE KJØRT) |
Localhost-sperrene (`assertLocal`, `tests/e2e/support/preflight.mjs`, `scripts/test-e2e-real-supabase.sh`, `scripts/test-db.sh`) er **uendret** og kjent hosted-fri (statisk test).

## 2. Tomt prosjekt vs. oppgradering av eksisterende database (må velges uttrykkelig)
| | `fresh` (tomt prosjekt) | `upgrade` (eksisterende database) |
|---|---|---|
| Utgangspunkt | ingen migrasjoner registrert, ingen tabeller i `public`/`private`, ingen brukere | migrasjonshistorikk er et sammenhengende prefiks av repoets rekkefølge (typisk alt til og med DATA-002C) |
| STOPP hvis | databasen ikke er tom, eller historikken avviker | databasen er tom, historikken har hull/ukjente versjoner, eller tabeller finnes uten historikk |
| DATA-002D | **ikke relevant** (ingen rader å kartlegge; migrasjonens egen kartlegging passerer trivielt) — vises som «IKKE RELEVANT», teller ikke | **påkrevd PASS** før noe anvendes: ugyldige/tomme feltkart ⇒ STOPP, ingenting fylles inn eller omgås; tilstand «UNKNOWN» (tabell uten funksjon) ⇒ STOPP |
| Anvendelse | `SCOUT_HOSTED_STAGE=h2-apply` + gate | i tillegg `SCOUT_HOSTED_BACKUP=bekreftet` (eier bekrefter sikkerhetskopi/PITR) |
Begge: brukere som ikke har e-post på `@example.test` ⇒ STOPP (ikke et rent testprosjekt). De tre migrasjonene som aldri er anvendt hostet (`20261021090000`, `20261022090000`, `20261023090000`) vises som ventende.

## 3. Oppsett (credentials aldri i chat, git, logger eller rapporter)
Eier oppretter prosjektet (H1) og lagrer verdiene i `.env.hosted.local` i repoets rot (**ignorert av git**, `chmod 600`; filen leses som shell: bare `NAVN='verdi'`-linjer). Skriptene skriver aldri ut verdiene; alt som vises saneres mot dem, og målet vises bare som fingeravtrykk.
| Variabel | Innhold |
|---|---|
| `SCOUT_HOSTED_PROJECT_REF` | prosjektets 20-tegns ref |
| `SCOUT_HOSTED_CONFIRM` | `TESTPROSJEKT:<ref>` — eier bekrefter at dette er et tomt testprosjekt uten pilot-/produksjonsdata |
| `SCOUT_HOSTED_MODE` | `fresh` eller `upgrade` |
| `SUPABASE_TEST_URL` | `https://<ref>.supabase.co` (nøyaktig) |
| `SUPABASE_TEST_DB_URL` | direkte (`db.<ref>.supabase.co`, bruker `postgres`) eller pooler (`*.pooler.supabase.com`, bruker `postgres.<ref>`); **må ha nøyaktig én `?sslmode=verify-full`** (manglende, svakere eller duplisert sslmode og andre `ssl*`-parametere avvises); ingen `host/port/dbname/options`-parametere. Alle våre databaseklienter (CLI, H3-testharness, opprydding) bygges av eksplisitte felt (aldri `connectionString`) med sertifikatkontroll; Supabase CLI følger `sslmode` i adressen |
| `SUPABASE_TEST_PUBLISHABLE_KEY` | prosjektets publishable key |
| `SCOUT_HOSTED_DB_CA_FILE` | **valgfri** sti til offentlig CA-sertifikat (PEM; ikke hemmelig) for sertifikatkontrollen; uleselig fil ⇒ avvist, aldri svakere ssl |
| `SUPABASE_TEST_JWT_SECRET` + `SCOUT_HOSTED_JWT_ALG=HS256` | **valgfrie, begge kreves sammen**; uten dem utelates ALLE hemmelighetsavhengige tester (i dag: utløpt-token-testen) og L4a rapporteres DELVIS. Eier må bekrefte HS256-signering; prosjekter med asymmetriske nøkler godtar ikke HS256-kontrolltokens. «Feil nøkkel»-testen bruker et faktisk utstedt token og trenger ikke hemmeligheten |
| `SCOUT_HOSTED_STAGE` | settes **per kommando** til nøyaktig trinnet som er tillatt |
| `SCOUT_HOSTED_BACKUP` | `bekreftet` (bare `upgrade` + anvendelse) |
| `SCOUT_HOSTED_CLEANUP_CONFIRM` | `SLETT:<fingeravtrykk>` (bare sletting i H4) |
Alt valideres av `scripts/hosted/target.mjs`: samme prosjekt i alle adresser, ingen localhost, ingen overstyringsparametere, ellers avvises kjøringen før noen forbindelse åpnes.

## 4. Trinnene (alle kommandoer via `bash scripts/hosted/run.sh <kommando>`)
| # | Trinn / kommando | Krever tillatelse | Hva som skjer | Gate/stopp |
|---|---|---|---|---|
| 0 | `check-target` | nei (ingen forbindelse) | validerer oppsettet, viser fingeravtrykk (brukes i `SLETT:<fingeravtrykk>`) | avvist ved feil |
| 1 | `SCOUT_HOSTED_STAGE=h2-inspect … inspect` | **ja: h2-inspect** | (forkaster tidligere dry-run/anvendelse) skrivebeskyttet (`begin read only`, bare SELECT, rollback): historikk, tabeller, tall, brukere, DATA-002D; lagrer `.hosted/inspect.json` | STOPP ved avvik fra valgt modus eller DATA-002D ≠ OK |
| 2 | `SCOUT_HOSTED_STAGE=h2-dry-run … dry-run` | **ja: h2-dry-run** | gate (inspeksjon < 60 min, samme prosjekt/modus/repo-hash) → `supabase db push --dry-run`; listen må være **nøyaktig** de ventende migrasjonene | FEIL ved annen liste/CLI-feil |
| 3 | `SCOUT_HOSTED_STAGE=h2-apply … apply` | **ja: h2-apply** | gate + vellykket nylig dry-run (+ sikkerhetskopi ved `upgrade`) → `supabase db push`; deretter kontroll at historikken = repoet | aldri uten inspeksjon + dry-run |
| 4 | `SCOUT_HOSTED_STAGE=h3-api … h3-api` | **ja: h3-api** | krever historikk = repo; kjører L4a + L6 mot hosted (`SCOUT_HOSTED_TESTS=1`), bygger mot hosted URL og skanner (L7) | L4a DELVIS uten JWT-hemmelighet; nettleserdelene IKKE KJØRT |
| 5 | `SCOUT_HOSTED_STAGE=h4-cleanup … cleanup` | **ja: h4-cleanup** | **tørrkjøring**: bare tall for hva som ville slettes | – |
| 6 | `SCOUT_HOSTED_STAGE=h4-cleanup-execute SCOUT_HOSTED_CLEANUP_CONFIRM=SLETT:<fp> … cleanup --execute` | **ja: h4-cleanup-execute** (krever dessuten nylig, under 60 min, tørrkjøring for samme mål/modus/migrasjonsgrunnlag) | sletter bare testdata (`@example.test`-brukere og firma der alle medlemmer er slike) i én transaksjon, ruller tilbake hvis noe gjenstår; rører ikke blandede/andre firma eller skjema | tilbakerulling ved feil |
| 7 | `report h2|h3|h4` | nei (ingen forbindelse) | lager sanert rapport fra `.hosted/*.json`. **Hvert belegg er bundet til mål, modus, migrasjonsgrunnlag (repo-hash) og tidspunkt (og kjeden inspeksjon → dry-run → anvendelse; for H4 tørrkjøring → sletting → kontroll).** Belegg som mangler binding, hører til et annet mål/en annen modus/et annet migrasjonsgrunnlag, er eldre enn 24 t eller ikke henger sammen **forkastes** og vises som «ikke verifisert» (aldri bestått); gjenværende belegg vises med faktisk tidspunkt | – |
| 8 | eier sletter selve testprosjektet | **eier** | kan ikke gjøres eller måles herfra; rapporten viser «IKKE KJØRT» til eier bekrefter | – |
Supabase CLI får databaseadressen som argument (`--db-url`); kjør derfor bare fra eierens egen maskin, og all CLI-utskrift fanges og saneres før den vises.

## 5. Rapportformat (se `docs/econ/hosted-rapportformat-eksempel.md` — syntetiske data)
Per trinn: modus (TOMT/OPPGRADERING), fingeravtrykk, versjonslinjer, punkter med BESTÅTT / FEILET / HOPPET OVER / DELVIS / IKKE KJØRT (og «IKKE RELEVANT» kun for DATA-002D i `fresh`), samlet utfall. **Samlet BESTÅTT krever at alle påkrevde punkter er PASS**; hoppet, delvis, ikke kjørt og ukjent status teller aldri som bestått. Teksten saneres mot kjente verdier og avvises hvis den fortsatt ser ut som en hemmelighet. Rapporter som skal inn i repoet skal være sanerte utdata fra `report`, aldri rå logger.

## 6. Tillatelser
Jeg gjør **ingenting** av punkt 1–8 uten at du har tillatt akkurat det trinnet. Opprettelse av prosjekt, secrets/innstillinger i GitHub, betalte planer og sletting av prosjektet er dine handlinger. Kjøring via Actions er ikke forberedt (repoet er offentlig).

## 7. Begrensninger og uverifiserte antakelser
- **Ikke kjørt mot hosted:** alt er testet mot isolert PostgreSQL (ikke Supabase), falske klienter og syntetiske data.
- **Ikke verifisert hos Supabase:** at `postgres`-rollen kan sette inn i `auth.users` og bruke `extensions.crypt` slik testharnessen gjør; CLI-ets dry-run-utskriftsformat (listen leses som `<14 sifre>_*.sql`; avvik ⇒ FEIL, ikke bestått); at pooler-tilkobling oppfører seg likt; rate limits for innlogging (testene gjør mange; vent mellom kjøringer); at `qa-secret-scan.sh` oppfører seg likt uten lokal stakk.
- **H3 er bare API-nivå:** L4b/L5a/L5b er ikke forberedt, så samlet H3 kan **ikke** bli BESTÅTT før de er gjort hosted-egnet og reviewet.
- Inspeksjonens «tomt prosjekt» forutsetter at Supabase-skallet har ingen tabeller i `public`/`private`; et nytt prosjekt med ekstra tabeller gir STOPP (ukjent utgangspunkt), ikke antatt OK.
- Sletting (H4) er bare testdata; skjema/migrasjoner fjernes ikke.

## 8. Windows (HOST-001-FIX2) — verktøy, oppstart av programmer og hva som er faktisk testet
**Verktøy på Windows 11:** Node ≥ 20.9 (Node 24 er innenfor `engines`; prosjektet er testet på Node 22 — Node 24 er ikke prøvd av oss), npm, **Git for Windows med Git Bash** (installeres av eier; velg «Checkout as-is, commit as-is»). Docker, Chrome og PostgreSQL trengs ikke for H2 eller H3 på API-nivå.
**Oppstart uten shell:** `cli.mjs` starter ikke `npx`/`npm` (de er `.cmd`-filer som ikke kan startes uten shell på Windows, og en shell ville tolket databaseadressen med passord). I stedet startes Node direkte med JS-inngangen fra de låste pakkene: `supabase` → `node_modules/supabase/dist/supabase.js` (starter den native CLI-en `@supabase/cli-windows-x64` → `.exe`), `vitest` → `vitest.mjs`, `next` → `dist/bin/next` (`npm run build` = `next build`). `bash` er Git Bash sin `bash.exe` (leter i Program Files, LocalAppData og PATH; **WSLs `C:\Windows\System32\bash.exe` avvises**; kan overstyres med `SCOUT_BASH=<sti til Git Bash sin bash.exe>`). Manglende program/pakke gir en tydelig feil, aldri bestått.
**Linjeslutt:** `.gitattributes` har `*.sh text eol=lf` (egen del av FIX2-diffen) så skriptene får LF også med Git for Windows.
**Selvtest på maskinen (etter at `npm ci` er godkjent og kjørt):** `node scripts/hosted/windows-selftest.mjs` — ingen nettverk, ingen hosted, ingen credentials. Den starter `vitest`, `next` og `supabase` med `--version`, `bash --version`, og sender 19 «farlige» argumenter (mellomrom, anførselstegn, `& | ^ % $`, backticks, `;`, `*`, norske tegn, tom streng) gjennom prosessoppstarten og kontrollerer at de kommer uendret fram og at ingen kommando ble kjørt. Utskriften sier hvilken plattform som ble kjørt.
**Bivirkning:** `supabase --version` (i selvtesten) kan skrive lokal metadata til `supabase/.temp/` (git-ignorert; ikke en migrasjon eller hosted handling).
**Simulert vs. faktisk:** repoets tester **simulerer** Windows (innsprøytet plattform/sti/filsystem) og kjører **faktisk** på Linux. De beviser stiforming, valg av bash, avvisning av WSL, ingen shell og argumentbevaring *på Linux* — **ikke** hvordan Windows' prosessoppstart, libuv-siteringen eller `supabase.exe` oppfører seg. Bare en kjøring av selvtesten som viser «plattform: win32» er en faktisk Windows-kjøring. Ikke kjørt på Windows i denne leveransen.
**Lesing av miljøfilen:** `scripts/hosted/run.sh` (Git Bash) leser `.env.hosted.local`; Node ≥ 20.6 kan også lese filen direkte: `node --env-file=.env.hosted.local scripts/hosted/cli.mjs <kommando>` (ikke verifisert på Windows). L7 i H3 trenger Git Bash uansett.
**Også rettet:** CLI-ets «er dette hovedmodulen»-sjekk brukte `file://${argv[1]}`, som aldri stemmer på Windows (`file:///C:/…`); CLI-et ville avsluttet stille uten å gjøre noe. Nå brukes `pathToFileURL`.
